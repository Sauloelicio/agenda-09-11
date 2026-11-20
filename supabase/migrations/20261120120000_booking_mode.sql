-- ==============================================================================
-- BOOKING MODE: agendamento por horário (padrão) ou por dia
-- ==============================================================================
-- "day": o cliente escolhe apenas a data. A capacidade do serviço é por dia e
--       o agendamento é gravado com time = '00:00' (sentinela de "dia inteiro").
-- "time": fluxo convencional, com grade de horários, almoço e intervalos.
-- ==============================================================================

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS booking_mode text NOT NULL DEFAULT 'time';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenant_settings_booking_mode_check'
  ) THEN
    ALTER TABLE public.tenant_settings
      ADD CONSTRAINT tenant_settings_booking_mode_check
      CHECK (booking_mode IN ('time', 'day'));
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- Criação do tenant: novo parâmetro _booking_mode.
-- A assinatura antiga é removida para evitar sobrecarga ambígua no PostgREST.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_tenant_with_owner(
  text, text, text, text, text, text, text, text, integer[], text, text, text, integer, numeric, integer
);

CREATE OR REPLACE FUNCTION public.create_tenant_with_owner(
  _name text,
  _slug text,
  _segment text,
  _phone text,
  _primary_color text,
  _site_style text,
  _open_time text,
  _close_time text,
  _open_weekdays integer[],
  _lunch_start text,
  _lunch_end text,
  _service_name text,
  _service_duration integer,
  _service_price numeric,
  _service_capacity integer,
  _booking_mode text DEFAULT 'time'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  _tenant_id uuid;
  _service_id uuid;
  _professional_name text;
  _clean_phone text := regexp_replace(COALESCE(_phone, ''), '\D', '', 'g');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  _booking_mode := COALESCE(_booking_mode, 'time');

  -- No modo "dia" não existe grade: expediente vira o dia todo e não há almoço.
  IF _booking_mode = 'day' THEN
    _open_time := '00:00';
    _close_time := '23:59';
    _lunch_start := NULL;
    _lunch_end := NULL;
  END IF;

  IF length(trim(COALESCE(_name, ''))) NOT BETWEEN 2 AND 100
    OR _slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    OR _segment NOT IN ('salon', 'barbershop', 'gym', 'clinic', 'services')
    OR length(_clean_phone) < 10
    OR COALESCE(_primary_color, '') !~ '^#[0-9A-Fa-f]{6}$'
    OR _site_style NOT IN ('clean', 'warm', 'bold')
    OR _booking_mode NOT IN ('time', 'day')
    OR _open_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    OR _close_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    OR _close_time <= _open_time
    OR ((_lunch_start IS NULL) <> (_lunch_end IS NULL))
    OR (
      _lunch_start IS NOT NULL AND (
        _lunch_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        OR _lunch_end !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        OR _lunch_end <= _lunch_start
        OR _lunch_start < _open_time
        OR _lunch_end > _close_time
      )
    )
    OR COALESCE(array_length(_open_weekdays, 1), 0) = 0
    OR NOT (_open_weekdays <@ ARRAY[0, 1, 2, 3, 4, 5, 6])
    OR length(trim(COALESCE(_service_name, ''))) NOT BETWEEN 1 AND 100
    OR _service_duration NOT BETWEEN 5 AND 720
    OR _service_price < 0
    OR _service_capacity NOT BETWEEN 1 AND 500
  THEN
    RAISE EXCEPTION 'invalid_tenant_data';
  END IF;

  INSERT INTO public.tenants (
    name, slug, segment, phone, email, primary_color, site_style,
    plan, subscription_status, trial_started_at, trial_ends_at
  )
  VALUES (
    trim(_name), _slug, _segment, _clean_phone,
    NULLIF(auth.jwt() ->> 'email', ''), _primary_color, _site_style,
    'trial', 'trial', statement_timestamp(), statement_timestamp() + interval '5 days'
  )
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO _tenant_id;
  IF _tenant_id IS NULL THEN RAISE EXCEPTION 'slug_already_exists'; END IF;

  INSERT INTO public.tenant_members (tenant_id, user_id, role)
  VALUES (_tenant_id, auth.uid(), 'owner');

  INSERT INTO public.tenant_settings (
    tenant_id, open_time, close_time, lunch_start, lunch_end,
    service_minutes, slot_interval_minutes, open_weekdays, booking_mode
  )
  VALUES (
    _tenant_id, _open_time, _close_time,
    CASE WHEN _segment = 'gym' THEN NULL ELSE _lunch_start END,
    CASE WHEN _segment = 'gym' THEN NULL ELSE _lunch_end END,
    _service_duration, _service_duration, _open_weekdays, _booking_mode
  );

  INSERT INTO public.tenant_services (
    tenant_id, name, duration_minutes, price, max_capacity, sort_order
  )
  VALUES (_tenant_id, trim(_service_name), _service_duration, _service_price, _service_capacity, 1)
  RETURNING id INTO _service_id;

  _professional_name := split_part(trim(_name), ' ', 1);
  INSERT INTO public.tenant_professionals (tenant_id, name, role, phone)
  VALUES (
    _tenant_id,
    COALESCE(NULLIF(_professional_name, ''), 'Atendimento Principal'),
    CASE WHEN _segment = 'gym' THEN 'Coach Responsável'
      WHEN _segment = 'barbershop' THEN 'Barbeiro'
      ELSE 'Especialista' END,
    _clean_phone
  );

  RETURN _tenant_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- Slots ocupados: no modo "dia" não há grade de horários.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_tenant_occupied_slots(
  _tenant_id uuid,
  _date date,
  _service_id uuid,
  _professional_id uuid DEFAULT NULL
)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  _service public.tenant_services;
  _settings public.tenant_settings;
  _slot text;
  _blocked text[] := ARRAY[]::text[];
BEGIN
  IF NOT public.tenant_public_booking_enabled(_tenant_id) THEN
    RAISE EXCEPTION 'subscription_required';
  END IF;

  SELECT * INTO _service FROM public.tenant_services
  WHERE id = _service_id AND tenant_id = _tenant_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'service_not_found'; END IF;

  IF _professional_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tenant_professionals
    WHERE id = _professional_id AND tenant_id = _tenant_id AND active
  ) THEN RAISE EXCEPTION 'professional_not_found'; END IF;

  SELECT * INTO _settings FROM public.tenant_settings WHERE tenant_id = _tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'tenant_not_found'; END IF;

  IF _settings.booking_mode = 'day' THEN
    RETURN _blocked;
  END IF;

  IF NOT (_settings.open_weekdays @> ARRAY[extract(dow FROM _date)::integer]) THEN
    RETURN _blocked;
  END IF;

  FOR _slot IN
    SELECT to_char(g, 'HH24:MI')
    FROM generate_series(
      _date + _settings.open_time::time,
      _date + _settings.close_time::time - make_interval(mins => _service.duration_minutes),
      make_interval(mins => GREATEST(5, _settings.slot_interval_minutes))
    ) AS g
    WHERE _settings.lunch_start IS NULL
       OR _settings.lunch_end IS NULL
       OR NOT (
         g::time < _settings.lunch_end::time
         AND (g + make_interval(mins => _service.duration_minutes))::time > _settings.lunch_start::time
       )
  LOOP
    IF public.tenant_slot_conflict(
      _tenant_id, _date, _slot, _service_id, _professional_id, NULL
    ) THEN
      _blocked := _blocked || _slot;
    END IF;
  END LOOP;

  RETURN _blocked;
END;
$$;

-- ------------------------------------------------------------------------------
-- Vagas restantes em um dia (modo "dia").
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_tenant_day_availability(
  _tenant_id uuid,
  _date date,
  _service_id uuid,
  _professional_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  _service public.tenant_services;
  _settings public.tenant_settings;
  _busy integer;
BEGIN
  IF NOT public.tenant_public_booking_enabled(_tenant_id) THEN
    RAISE EXCEPTION 'subscription_required';
  END IF;

  SELECT * INTO _service FROM public.tenant_services
  WHERE id = _service_id AND tenant_id = _tenant_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'service_not_found'; END IF;

  SELECT * INTO _settings FROM public.tenant_settings WHERE tenant_id = _tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'tenant_not_found'; END IF;

  IF _settings.booking_mode <> 'day'
    OR _date < (statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date
    OR NOT (_settings.open_weekdays @> ARRAY[extract(dow FROM _date)::integer])
  THEN
    RETURN 0;
  END IF;

  SELECT count(*) INTO _busy
  FROM public.tenant_appointments
  WHERE tenant_id = _tenant_id
    AND service_id = _service_id
    AND date = _date
    AND status = 'active';

  RETURN GREATEST(0, _service.max_capacity - _busy);
END;
$$;

-- ------------------------------------------------------------------------------
-- Booking público: no modo "dia" reserva o dia inteiro (time = '00:00').
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.book_tenant_appointment(
  _tenant_id uuid,
  _service_id uuid,
  _professional_id uuid,
  _name text,
  _phone text,
  _service_name text,
  _date date,
  _time text,
  _price numeric DEFAULT 0.00
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  _service public.tenant_services;
  _settings public.tenant_settings;
  _chosen_professional_id uuid := _professional_id;
  _chosen_professional_name text;
  _clean_phone text := regexp_replace(COALESCE(_phone, ''), '\D', '', 'g');
  _id uuid;
  _staff_count integer;
  _slot_start timestamp;
  _weekday integer;
  _busy_count integer;
BEGIN
  IF NOT public.tenant_public_booking_enabled(_tenant_id) THEN
    RAISE EXCEPTION 'subscription_required';
  END IF;

  IF length(trim(COALESCE(_name, ''))) NOT BETWEEN 2 AND 100
    OR length(_clean_phone) NOT BETWEEN 10 AND 15
    OR _date < (statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date
  THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  SELECT * INTO _service FROM public.tenant_services
  WHERE id = _service_id AND tenant_id = _tenant_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'service_not_found'; END IF;

  SELECT * INTO _settings FROM public.tenant_settings WHERE tenant_id = _tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'tenant_not_found'; END IF;

  -- ----------------------------------------------------------------------------
  -- MODO DIA: uma ou mais vagas por data, sem grade de horários.
  -- ----------------------------------------------------------------------------
  IF _settings.booking_mode = 'day' THEN
    IF NOT (_settings.open_weekdays @> ARRAY[extract(dow FROM _date)::integer]) THEN
      RAISE EXCEPTION 'invalid_slot';
    END IF;

    IF _professional_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.tenant_professionals
      WHERE id = _professional_id AND tenant_id = _tenant_id AND active
    ) THEN
      RAISE EXCEPTION 'professional_not_found';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext(_tenant_id::text || ':day:' || _date::text));

    SELECT count(*) INTO _busy_count
    FROM public.tenant_appointments
    WHERE tenant_id = _tenant_id
      AND service_id = _service_id
      AND date = _date
      AND status = 'active';

    IF _busy_count >= _service.max_capacity THEN
      RAISE EXCEPTION 'slot_taken';
    END IF;

    IF _chosen_professional_id IS NULL THEN
      SELECT p.id, p.name INTO _chosen_professional_id, _chosen_professional_name
      FROM public.tenant_professionals p
      WHERE p.tenant_id = _tenant_id AND p.active
      ORDER BY p.name
      LIMIT 1;
    END IF;

    INSERT INTO public.tenant_appointments (
      tenant_id, service_id, professional_id, service_name, professional_name,
      client_name, phone, date, time, price
    )
    VALUES (
      _tenant_id, _service.id, _chosen_professional_id, _service.name, _chosen_professional_name,
      trim(_name), _clean_phone, _date, '00:00', _service.price
    )
    RETURNING id INTO _id;

    RETURN _id;
  END IF;

  -- ----------------------------------------------------------------------------
  -- MODO HORÁRIO: regras existentes (inalteradas).
  -- ----------------------------------------------------------------------------
  IF _time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
    RAISE EXCEPTION 'invalid_slot';
  END IF;

  _weekday := extract(dow FROM _date)::integer;
  _slot_start := _date + _time::time;

  IF NOT (_settings.open_weekdays @> ARRAY[_weekday])
    OR _slot_start < _date + _settings.open_time::time
    OR _slot_start + make_interval(mins => _service.duration_minutes)
      > _date + _settings.close_time::time
    OR (
      _settings.lunch_start IS NOT NULL AND _settings.lunch_end IS NOT NULL
      AND _slot_start < _date + _settings.lunch_end::time
      AND _slot_start + make_interval(mins => _service.duration_minutes)
        > _date + _settings.lunch_start::time
    )
    OR _slot_start <= (statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')
  THEN
    RAISE EXCEPTION 'invalid_slot';
  END IF;

  IF _professional_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tenant_professionals
    WHERE id = _professional_id AND tenant_id = _tenant_id AND active
  ) THEN
    RAISE EXCEPTION 'professional_not_found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(_tenant_id::text || ':' || _date::text));

  SELECT count(*) INTO _staff_count FROM public.tenant_professionals
    WHERE tenant_id = _tenant_id AND active;

  IF _service.max_capacity > 1 THEN
    IF public.tenant_slot_conflict(_tenant_id, _date, _time, _service_id, NULL, NULL) THEN
      RAISE EXCEPTION 'slot_taken';
    END IF;
    _chosen_professional_id := NULL;
  ELSIF _chosen_professional_id IS NOT NULL THEN
    IF public.tenant_slot_conflict(_tenant_id, _date, _time, _service_id, _chosen_professional_id, NULL) THEN
      RAISE EXCEPTION 'slot_taken';
    END IF;
  ELSIF _staff_count > 0 THEN
    SELECT p.id, p.name INTO _chosen_professional_id, _chosen_professional_name
    FROM public.tenant_professionals p
    WHERE p.tenant_id = _tenant_id AND p.active
      AND NOT public.tenant_slot_conflict(_tenant_id, _date, _time, _service_id, p.id, NULL)
    ORDER BY p.name
    LIMIT 1;
    IF _chosen_professional_id IS NULL THEN RAISE EXCEPTION 'slot_taken'; END IF;
  ELSE
    IF public.tenant_slot_conflict(_tenant_id, _date, _time, _service_id, NULL, NULL) THEN
      RAISE EXCEPTION 'slot_taken';
    END IF;
  END IF;

  IF _chosen_professional_id IS NOT NULL AND _chosen_professional_name IS NULL THEN
    SELECT name INTO _chosen_professional_name
    FROM public.tenant_professionals
    WHERE id = _chosen_professional_id AND tenant_id = _tenant_id;
  END IF;

  INSERT INTO public.tenant_appointments (
    tenant_id, service_id, professional_id, service_name, professional_name,
    client_name, phone, date, time, price
  )
  VALUES (
    _tenant_id, _service.id, _chosen_professional_id, _service.name, _chosen_professional_name,
    trim(_name), _clean_phone, _date, _time, _service.price
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

-- ------------------------------------------------------------------------------
-- Reagendamento pelo cliente.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.change_tenant_appointment(
  _appointment_id uuid,
  _phone text,
  _new_date date DEFAULT NULL,
  _new_time text DEFAULT NULL,
  _cancel boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  _appointment public.tenant_appointments;
  _service public.tenant_services;
  _settings public.tenant_settings;
  _slot_start timestamp;
  _weekday integer;
  _busy_count integer;
  _today date := (statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  SELECT * INTO _appointment FROM public.tenant_appointments
  WHERE id = _appointment_id
    AND phone = regexp_replace(COALESCE(_phone, ''), '\D', '', 'g')
    AND status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'appointment_not_found'; END IF;

  SELECT * INTO _settings FROM public.tenant_settings
  WHERE tenant_id = _appointment.tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'tenant_not_found'; END IF;

  IF _settings.booking_mode = 'day' THEN
    IF _appointment.date <= _today THEN RAISE EXCEPTION 'too_late'; END IF;
  ELSE
    IF (_appointment.date + _appointment.time::time)
      - (statement_timestamp() AT TIME ZONE 'America/Sao_Paulo') < interval '2 hours'
    THEN RAISE EXCEPTION 'too_late'; END IF;
  END IF;

  IF _cancel THEN
    UPDATE public.tenant_appointments SET status = 'cancelled' WHERE id = _appointment.id;
    RETURN;
  END IF;

  IF _new_date IS NULL THEN RAISE EXCEPTION 'invalid_input'; END IF;
  IF NOT public.tenant_public_booking_enabled(_appointment.tenant_id) THEN
    RAISE EXCEPTION 'subscription_required';
  END IF;

  SELECT * INTO _service FROM public.tenant_services
  WHERE id = _appointment.service_id
    AND tenant_id = _appointment.tenant_id
    AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'service_not_found'; END IF;

  -- MODO DIA: troca apenas a data; o horário permanece como sentinela.
  IF _settings.booking_mode = 'day' THEN
    IF _new_date < _today
      OR NOT (_settings.open_weekdays @> ARRAY[extract(dow FROM _new_date)::integer])
    THEN RAISE EXCEPTION 'invalid_slot'; END IF;

    PERFORM pg_advisory_xact_lock(hashtext(
      _appointment.tenant_id::text || ':day:' || _new_date::text
    ));

    SELECT count(*) INTO _busy_count
    FROM public.tenant_appointments
    WHERE tenant_id = _appointment.tenant_id
      AND service_id = _appointment.service_id
      AND date = _new_date
      AND status = 'active'
      AND id <> _appointment.id;

    IF _busy_count >= _service.max_capacity THEN RAISE EXCEPTION 'slot_taken'; END IF;

    UPDATE public.tenant_appointments
    SET date = _new_date, time = '00:00'
    WHERE id = _appointment.id;
    RETURN;
  END IF;

  -- MODO HORÁRIO
  IF _new_time IS NULL THEN RAISE EXCEPTION 'invalid_input'; END IF;
  IF _new_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'invalid_slot'; END IF;

  _weekday := extract(dow FROM _new_date)::integer;
  _slot_start := _new_date + _new_time::time;

  IF NOT (_settings.open_weekdays @> ARRAY[_weekday])
    OR _slot_start < _new_date + _settings.open_time::time
    OR _slot_start + make_interval(mins => _service.duration_minutes)
      > _new_date + _settings.close_time::time
    OR (
      _settings.lunch_start IS NOT NULL AND _settings.lunch_end IS NOT NULL
      AND _slot_start < _new_date + _settings.lunch_end::time
      AND _slot_start + make_interval(mins => _service.duration_minutes)
        > _new_date + _settings.lunch_start::time
    )
    OR _slot_start <= (statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')
  THEN
    RAISE EXCEPTION 'invalid_slot';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(
    _appointment.tenant_id::text || ':' || _new_date::text
  ));

  IF public.tenant_slot_conflict(
    _appointment.tenant_id,
    _new_date,
    _new_time,
    _appointment.service_id,
    _appointment.professional_id,
    _appointment.id
  ) THEN
    RAISE EXCEPTION 'slot_taken';
  END IF;

  UPDATE public.tenant_appointments
  SET date = _new_date, time = _new_time
  WHERE id = _appointment.id;
END;
$$;

-- ------------------------------------------------------------------------------
-- Reagendamento pelo painel (admin).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_tenant_appointment(
  _appointment_id uuid,
  _status text DEFAULT NULL,
  _date date DEFAULT NULL,
  _time text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  _appointment public.tenant_appointments;
  _service public.tenant_services;
  _settings public.tenant_settings;
  _target_date date;
  _target_time text;
  _target_start timestamp;
  _weekday integer;
  _busy_count integer;
  _today date := (statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  SELECT * INTO _appointment
  FROM public.tenant_appointments
  WHERE id = _appointment_id
  FOR UPDATE;
  IF NOT FOUND OR NOT public.is_tenant_member(_appointment.tenant_id) THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF NOT public.tenant_has_access(_appointment.tenant_id) THEN
    RAISE EXCEPTION 'subscription_required';
  END IF;
  IF _status IS NOT NULL AND _status NOT IN ('active', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT * INTO _settings FROM public.tenant_settings
  WHERE tenant_id = _appointment.tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'tenant_not_found'; END IF;

  SELECT * INTO _service FROM public.tenant_services
  WHERE id = _appointment.service_id
    AND tenant_id = _appointment.tenant_id
    AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'service_not_found'; END IF;

  IF _date IS NOT NULL THEN
    _target_date := _date;

    IF _settings.booking_mode = 'day' THEN
      IF _target_date < _today
        OR NOT (_settings.open_weekdays @> ARRAY[extract(dow FROM _target_date)::integer])
      THEN RAISE EXCEPTION 'invalid_slot'; END IF;

      PERFORM pg_advisory_xact_lock(hashtext(
        _appointment.tenant_id::text || ':day:' || _target_date::text
      ));

      SELECT count(*) INTO _busy_count
      FROM public.tenant_appointments
      WHERE tenant_id = _appointment.tenant_id
        AND service_id = _appointment.service_id
        AND date = _target_date
        AND status = 'active'
        AND id <> _appointment_id;

      IF _busy_count >= _service.max_capacity THEN RAISE EXCEPTION 'slot_taken'; END IF;
    ELSE
      IF _time IS NULL OR _time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
        RAISE EXCEPTION 'invalid_slot';
      END IF;

      _target_time := _time;
      _target_start := _target_date + _target_time::time;
      _weekday := extract(dow FROM _target_date)::integer;

      IF _target_date < _today
        OR _target_start <= (statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')
        OR NOT (_settings.open_weekdays @> ARRAY[_weekday])
        OR _target_start < _target_date + _settings.open_time::time
        OR _target_start + make_interval(mins => _service.duration_minutes)
          > _target_date + _settings.close_time::time
        OR (
          _settings.lunch_start IS NOT NULL AND _settings.lunch_end IS NOT NULL
          AND _target_start < _target_date + _settings.lunch_end::time
          AND _target_start + make_interval(mins => _service.duration_minutes)
            > _target_date + _settings.lunch_start::time
        )
      THEN
        RAISE EXCEPTION 'invalid_slot';
      END IF;

      PERFORM pg_advisory_xact_lock(hashtext(
        _appointment.tenant_id::text || ':' || _target_date::text
      ));

      IF public.tenant_slot_conflict(
        _appointment.tenant_id,
        _target_date,
        _target_time,
        _appointment.service_id,
        _appointment.professional_id,
        _appointment.id
      ) THEN
        RAISE EXCEPTION 'slot_taken';
      END IF;
    END IF;
  END IF;

  UPDATE public.tenant_appointments
  SET status = COALESCE(_status, status),
      date = COALESCE(_date, date),
      time = CASE
        WHEN _date IS NOT NULL AND _settings.booking_mode = 'day' THEN '00:00'
        ELSE COALESCE(_time, time)
      END
  WHERE id = _appointment_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- Permissões.
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_tenant_with_owner(
  text, text, text, text, text, text, text, text, integer[], text, text, text, integer, numeric, integer, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_tenant_with_owner(
  text, text, text, text, text, text, text, text, integer[], text, text, text, integer, numeric, integer, text
) TO authenticated;

REVOKE ALL ON FUNCTION public.get_tenant_day_availability(uuid, date, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_day_availability(uuid, date, uuid, uuid) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_tenant_occupied_slots(uuid, date, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_tenant_appointment(uuid, uuid, uuid, text, text, text, date, text, numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_tenant_appointment(uuid, text, date, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_appointment(uuid, text, date, text) TO authenticated;

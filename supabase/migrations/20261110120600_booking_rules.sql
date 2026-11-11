-- ==============================================================================
-- MIGRATION 0006: BOOKING RULES
-- Correções de regra de negócio:
--  1. Detecção de sobreposição por INTERVALO (não apenas horário idêntico).
--  2. Reagendamento do cliente valida expediente, almoço e dias abertos.
--  3. Reservas concorrentes serializadas por tenant + data (advisory lock).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Helper: existe conflito para este slot?
-- Considera a duração real de cada serviço e o escopo de profissional/capacidade.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tenant_slot_conflict(
  _tenant_id uuid,
  _date date,
  _time text,
  _service_id uuid,
  _professional_id uuid,
  _exclude_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  WITH svc AS (
    SELECT max_capacity, duration_minutes
    FROM public.tenant_services
    WHERE id = _service_id AND tenant_id = _tenant_id AND active
  ),
  staff AS (
    SELECT count(*) AS total
    FROM public.tenant_professionals
    WHERE tenant_id = _tenant_id AND active
  ),
  active AS (
    SELECT a.id, a.service_id, a.professional_id,
           a.time::time AS starts_at, s.duration_minutes
    FROM public.tenant_appointments a
    JOIN public.tenant_services s
      ON s.id = a.service_id AND s.tenant_id = a.tenant_id
    WHERE a.tenant_id = _tenant_id
      AND a.date = _date
      AND a.status = 'active'
      AND (_exclude_id IS NULL OR a.id <> _exclude_id)
  ),
  overlap AS (
    SELECT a.*
    FROM active a
    WHERE _time::time < (a.starts_at + make_interval(mins => a.duration_minutes))
      AND a.starts_at < (_time::time + make_interval(mins => (SELECT duration_minutes FROM svc)))
  )
  SELECT CASE
    WHEN (SELECT max_capacity FROM svc) > 1 THEN
      (SELECT count(*) FROM overlap o
        WHERE o.service_id = _service_id AND o.starts_at = _time::time)
        >= (SELECT max_capacity FROM svc)
      OR EXISTS (
        SELECT 1 FROM overlap o
        WHERE NOT (o.service_id = _service_id AND o.starts_at = _time::time)
      )
    WHEN _professional_id IS NOT NULL THEN
      EXISTS (SELECT 1 FROM overlap o WHERE o.professional_id = _professional_id)
    WHEN (SELECT total FROM staff) > 0 THEN
      (SELECT count(DISTINCT o.professional_id) FROM overlap o
        WHERE o.professional_id IS NOT NULL)
        >= (SELECT total FROM staff)
    ELSE
      EXISTS (SELECT 1 FROM overlap)
  END;
$$;

REVOKE ALL ON FUNCTION public.tenant_slot_conflict(uuid, date, text, uuid, uuid, uuid) FROM PUBLIC;

-- ------------------------------------------------------------------------------
-- Slots ocupados: expande cada agendamento para todos os slots da grade que
-- colidem com o intervalo real (mesma regra usada no booking).
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
-- Booking público com checagem de sobreposição por intervalo.
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
BEGIN
  IF NOT public.tenant_public_booking_enabled(_tenant_id) THEN
    RAISE EXCEPTION 'subscription_required';
  END IF;

  IF length(trim(COALESCE(_name, ''))) NOT BETWEEN 2 AND 100
    OR length(_clean_phone) NOT BETWEEN 10 AND 15
    OR _time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    OR _date < (statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date
  THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  SELECT * INTO _service FROM public.tenant_services
  WHERE id = _service_id AND tenant_id = _tenant_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'service_not_found'; END IF;

  SELECT * INTO _settings FROM public.tenant_settings WHERE tenant_id = _tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'tenant_not_found'; END IF;

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
-- Reagendamento pelo cliente: agora valida expediente/almoço/dias abertos
-- e usa a mesma checagem de sobreposição do booking.
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
BEGIN
  SELECT * INTO _appointment FROM public.tenant_appointments
  WHERE id = _appointment_id
    AND phone = regexp_replace(COALESCE(_phone, ''), '\D', '', 'g')
    AND status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'appointment_not_found'; END IF;

  IF (_appointment.date + _appointment.time::time)
    - (statement_timestamp() AT TIME ZONE 'America/Sao_Paulo') < interval '2 hours'
  THEN RAISE EXCEPTION 'too_late'; END IF;

  IF _cancel THEN
    UPDATE public.tenant_appointments SET status = 'cancelled' WHERE id = _appointment.id;
    RETURN;
  END IF;

  IF _new_date IS NULL OR _new_time IS NULL THEN RAISE EXCEPTION 'invalid_input'; END IF;
  IF _new_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'invalid_slot'; END IF;

  IF NOT public.tenant_public_booking_enabled(_appointment.tenant_id) THEN
    RAISE EXCEPTION 'subscription_required';
  END IF;

  SELECT * INTO _service FROM public.tenant_services
  WHERE id = _appointment.service_id
    AND tenant_id = _appointment.tenant_id
    AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'service_not_found'; END IF;

  SELECT * INTO _settings FROM public.tenant_settings
  WHERE tenant_id = _appointment.tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'tenant_not_found'; END IF;

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
-- Reagendamento pelo painel (admin): mesma regra de intervalo do booking.
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
BEGIN
  SELECT * INTO _appointment FROM public.tenant_appointments
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
  IF (_date IS NULL) <> (_time IS NULL) THEN
    RAISE EXCEPTION 'invalid_slot';
  END IF;

  IF _date IS NOT NULL THEN
    IF _time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
      RAISE EXCEPTION 'invalid_slot';
    END IF;

    SELECT * INTO _service FROM public.tenant_services
    WHERE id = _appointment.service_id
      AND tenant_id = _appointment.tenant_id
      AND active;
    IF NOT FOUND THEN RAISE EXCEPTION 'service_not_found'; END IF;

    SELECT * INTO _settings FROM public.tenant_settings
    WHERE tenant_id = _appointment.tenant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'tenant_not_found'; END IF;

    _target_date := _date;
    _target_time := _time;
    _target_start := _target_date + _target_time::time;
    _weekday := extract(dow FROM _target_date)::integer;

    IF _target_date < (statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date
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

  UPDATE public.tenant_appointments
  SET status = COALESCE(_status, status),
      date = COALESCE(_date, date),
      time = COALESCE(_time, time)
  WHERE id = _appointment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_occupied_slots(uuid, date, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.book_tenant_appointment(uuid, uuid, uuid, text, text, text, date, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.change_tenant_appointment(uuid, text, date, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_tenant_appointment(uuid, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_occupied_slots(uuid, date, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_tenant_appointment(uuid, uuid, uuid, text, text, text, date, text, numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_tenant_appointment(uuid, text, date, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_appointment(uuid, text, date, text) TO authenticated;

COMMENT ON FUNCTION public.tenant_slot_conflict(uuid, date, text, uuid, uuid, uuid) IS
  'Checagem interna de conflito por intervalo de tempo, profissional e capacidade.';

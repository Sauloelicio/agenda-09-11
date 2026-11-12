-- ==============================================================================
-- APLICACAO MANUAL NO SUPABASE (fallback do `supabase db push`)
--
-- Use SOMENTE em um projeto Supabase vazio (sem as tabelas deste app).
-- Cole este arquivo inteiro no SQL Editor do Dashboard e execute uma unica vez.
--
-- Gerado a partir de supabase/migrations/ (ordem cronologica).
-- Nao inclui supabase/seed.sql (dados de demonstracao sao apenas locais).
-- ==============================================================================

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FONTE: supabase/migrations/20261110120000_initial.sql
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
create type public.app_role as enum ('admin');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null, role app_role not null, unique(user_id, role));
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create or replace function public.grant_first_admin() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role='admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_admin after insert on auth.users for each row execute function public.grant_first_admin();

create or replace function public.admin_exists() returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.user_roles where role='admin') $$;
grant execute on function public.admin_exists() to anon, authenticated;

create table public.services (id uuid primary key default gen_random_uuid(), name text not null, active boolean not null default true, sort_order int not null default 0, created_at timestamptz not null default now());
grant select on public.services to anon, authenticated;
grant insert, update, delete on public.services to authenticated;
grant all on public.services to service_role;
alter table public.services enable row level security;
create policy "public read services" on public.services for select using (true);
create policy "admin write services" on public.services for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.blocked_dates (id uuid primary key default gen_random_uuid(), date date not null unique, created_at timestamptz not null default now());
grant select on public.blocked_dates to anon, authenticated;
grant insert, update, delete on public.blocked_dates to authenticated;
grant all on public.blocked_dates to service_role;
alter table public.blocked_dates enable row level security;
create policy "public read blocked" on public.blocked_dates for select using (true);
create policy "admin write blocked" on public.blocked_dates for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into public.services(name, sort_order) values ('Unha postiças realista',1),('Gel na tips',2),('Fibra de vidro',3),('Molde F1',4),('Cílios',5),('Sobrancelhas',6);
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FONTE: supabase/migrations/20261110120100_business_settings.sql
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
create table public.business_settings (
  id int primary key default 1 check (id = 1),
  open_time text not null default '09:00',
  close_time text not null default '18:00',
  lunch_start text default '12:00',
  lunch_end text default '13:30',
  service_minutes int not null default 60,
  slot_interval_minutes int not null default 60,
  open_weekdays int[] not null default '{1,2,3,4,5,6}',
  updated_at timestamptz not null default now()
);
grant select on public.business_settings to anon, authenticated;
grant update on public.business_settings to authenticated;
grant all on public.business_settings to service_role;
alter table public.business_settings enable row level security;
create policy "public read settings" on public.business_settings for select using (true);
create policy "admin update settings" on public.business_settings for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.business_settings (id) values (1);
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FONTE: supabase/migrations/20261110120200_appointments.sql
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  phone text NOT NULL,
  service text NOT NULL,
  date date NOT NULL,
  time text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all appointments" ON public.appointments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE UNIQUE INDEX appointments_unique_active_slot ON public.appointments(date, time) WHERE status = 'active';
CREATE INDEX appointments_phone_idx ON public.appointments(phone);

CREATE OR REPLACE FUNCTION public.get_occupied_times(_date date)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  select coalesce(array_agg(time), '{}') from public.appointments where date=_date and status='active'
$$;

CREATE OR REPLACE FUNCTION public.book_appointment(_name text, _phone text, _service text, _date date, _time text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
declare _id uuid; _p text := regexp_replace(_phone,'\D','','g');
begin
  if length(trim(_name)) < 2 or length(_p) < 10 or _date < (now() at time zone 'America/Maceio')::date then
    raise exception 'invalid';
  end if;
  insert into public.appointments(client_name, phone, service, date, time)
  values (left(trim(_name),100), _p, left(_service,100), _date, _time) returning id into _id;
  return _id;
exception when unique_violation then raise exception 'slot_taken';
end $$;

CREATE OR REPLACE FUNCTION public.find_my_appointment(_phone text)
RETURNS TABLE(id uuid, client_name text, service text, date date, "time" text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  select a.id, a.client_name, a.service, a.date, a.time from public.appointments a
  where a.phone = regexp_replace(_phone,'\D','','g') and a.status='active'
    and (a.date + a.time::time) > (now() at time zone 'America/Maceio')
  order by a.date, a.time limit 1
$$;

CREATE OR REPLACE FUNCTION public.reschedule_appointment(_id uuid, _phone text, _date date, _time text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
declare a public.appointments;
begin
  select * into a from public.appointments where id=_id and phone=regexp_replace(_phone,'\D','','g') and status='active';
  if not found then raise exception 'not_found'; end if;
  if (a.date + a.time::time) - (now() at time zone 'America/Maceio') < interval '2 hours' then raise exception 'too_late'; end if;
  if _date < (now() at time zone 'America/Maceio')::date then raise exception 'invalid'; end if;
  update public.appointments set date=_date, time=_time where id=_id;
exception when unique_violation then raise exception 'slot_taken';
end $$;

CREATE OR REPLACE FUNCTION public.cancel_appointment(_id uuid, _phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
declare a public.appointments;
begin
  select * into a from public.appointments where id=_id and phone=regexp_replace(_phone,'\D','','g') and status='active';
  if not found then raise exception 'not_found'; end if;
  if (a.date + a.time::time) - (now() at time zone 'America/Maceio') < interval '2 hours' then raise exception 'too_late'; end if;
  update public.appointments set status='cancelled' where id=_id;
end $$;

GRANT EXECUTE ON FUNCTION public.get_occupied_times(date), public.book_appointment(text,text,text,date,text),
  public.find_my_appointment(text), public.reschedule_appointment(uuid,text,date,text), public.cancel_appointment(uuid,text) TO anon, authenticated;
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FONTE: supabase/migrations/20261110120300_multi_tenant.sql
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
-- ==============================================================================
-- MIGRATION 0003: MULTI-TENANT B2B SAAS SCHEDULING PLATFORM
-- Suporta nichos: Manicures (1:1), Barbearias (equipe), Academias (turmas)
-- ==============================================================================

-- 1. Tabela de Tenants (Organizações / Negócios)
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  segment text NOT NULL DEFAULT 'salon' CHECK (segment IN ('salon', 'barbershop', 'gym', 'clinic', 'services')),
  phone text NOT NULL,
  email text,
  logo_url text,
  primary_color text DEFAULT '#ec4899',
  bio text,
  address text,
  plan text NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial', 'basic', 'pro', 'enterprise')),
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '5 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS em tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 2. Tabela de Vínculo de Usuários / Membros com o Tenant
CREATE TABLE IF NOT EXISTS public.tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members view own tenancy" ON public.tenant_members;
CREATE POLICY "members view own tenancy" ON public.tenant_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 3. Tabela de Profissionais / Atendentes da Equipe
CREATE TABLE IF NOT EXISTS public.professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'Profissional',
  phone text,
  avatar_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS professionals_tenant_idx ON public.professionals(tenant_id);
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read active professionals" ON public.professionals;
DROP POLICY IF EXISTS "tenant manage professionals" ON public.professionals;

-- 4. Adequação da Tabela Services (adicionando tenant_id, duration_minutes, price, max_capacity)
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS duration_minutes int NOT NULL DEFAULT 60;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS price numeric(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS max_capacity int NOT NULL DEFAULT 1; -- 1 para individual, >1 para turmas
CREATE INDEX IF NOT EXISTS services_tenant_idx ON public.services(tenant_id);

-- 5. Adequação da Tabela Business Settings (removendo a trava de id=1 e associando a tenant_id)
ALTER TABLE public.business_settings DROP CONSTRAINT IF EXISTS business_settings_id_check;
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS business_settings_tenant_idx ON public.business_settings(tenant_id);

-- 6. Adequação da Tabela Appointments (adicionando tenant_id, professional_id, service_id, price)
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS price numeric(10,2) NOT NULL DEFAULT 0.00;
CREATE INDEX IF NOT EXISTS appointments_tenant_date_idx ON public.appointments(tenant_id, date);

-- Remover índice mono-tenant antigo de data/hora única
DROP INDEX IF EXISTS public.appointments_unique_active_slot;

-- Tenant booking RPCs are installed with the access and trial checks in migration 0004.
DO $$
BEGIN
  IF to_regprocedure('public.get_tenant_occupied_slots(uuid,date,uuid,uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_tenant_occupied_slots(uuid, date, uuid, uuid) FROM PUBLIC, anon, authenticated';
  END IF;
  IF to_regprocedure('public.book_tenant_appointment(uuid,uuid,uuid,text,text,text,date,text,numeric)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.book_tenant_appointment(uuid, uuid, uuid, text, text, text, date, text, numeric) FROM PUBLIC, anon, authenticated';
  END IF;
END;
$$;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FONTE: supabase/migrations/20261110120400_real_tenant_accounts.sql
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
-- Persistent owner workspaces, public booking endpoints, and server-enforced trial access.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS site_style text NOT NULL DEFAULT 'warm',
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trial';

UPDATE public.tenants
SET trial_started_at = COALESCE(trial_started_at, trial_ends_at - interval '5 days'),
    subscription_status = CASE
      WHEN plan = 'trial' THEN 'trial'
      ELSE 'past_due'
    END
WHERE trial_started_at IS NULL OR subscription_status = 'trial';

ALTER TABLE public.tenants
  ALTER COLUMN trial_started_at SET DEFAULT now(),
  ALTER COLUMN trial_started_at SET NOT NULL,
  ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '5 days');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenants_site_style_check'
      AND conrelid = 'public.tenants'::regclass
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_site_style_check CHECK (site_style IN ('clean', 'warm', 'bold'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenants_subscription_status_check'
      AND conrelid = 'public.tenants'::regclass
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_subscription_status_check
      CHECK (subscription_status IN ('trial', 'active', 'expired', 'past_due', 'canceled'));
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.tenant_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  open_time text NOT NULL DEFAULT '09:00',
  close_time text NOT NULL DEFAULT '18:00',
  lunch_start text,
  lunch_end text,
  service_minutes integer NOT NULL DEFAULT 60 CHECK (service_minutes BETWEEN 5 AND 720),
  slot_interval_minutes integer NOT NULL DEFAULT 30 CHECK (slot_interval_minutes BETWEEN 5 AND 720),
  open_weekdays integer[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6],
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(open_weekdays) > 0),
  CHECK (open_weekdays <@ ARRAY[0, 1, 2, 3, 4, 5, 6]),
  CHECK (open_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CHECK (close_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CHECK (close_time > open_time),
  CHECK (
    (lunch_start IS NULL AND lunch_end IS NULL)
    OR (
      lunch_start IS NOT NULL
      AND lunch_end IS NOT NULL
      AND lunch_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND lunch_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND lunch_end > lunch_start
      AND lunch_start >= open_time
      AND lunch_end <= close_time
    )
  )
);

CREATE TABLE IF NOT EXISTS public.tenant_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  description text,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 5 AND 720),
  price numeric(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  max_capacity integer NOT NULL DEFAULT 1 CHECK (max_capacity BETWEEN 1 AND 500),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS tenant_services_active_idx
  ON public.tenant_services (tenant_id, active, sort_order);

CREATE TABLE IF NOT EXISTS public.tenant_professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  role text NOT NULL DEFAULT 'Profissional',
  phone text,
  avatar_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS tenant_professionals_active_idx
  ON public.tenant_professionals (tenant_id, active);

CREATE TABLE IF NOT EXISTS public.tenant_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_id uuid NOT NULL,
  professional_id uuid,
  service_name text NOT NULL,
  professional_name text,
  client_name text NOT NULL CHECK (length(trim(client_name)) BETWEEN 2 AND 100),
  phone text NOT NULL,
  date date NOT NULL,
  time text NOT NULL CHECK (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  price numeric(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, service_id)
    REFERENCES public.tenant_services(tenant_id, id) ON DELETE RESTRICT
);
ALTER TABLE public.tenant_appointments
  DROP CONSTRAINT IF EXISTS tenant_appointments_tenant_id_professional_id_fkey;
ALTER TABLE public.tenant_appointments
  DROP CONSTRAINT IF EXISTS tenant_appointments_professional_fk;
ALTER TABLE public.tenant_appointments
  ADD CONSTRAINT tenant_appointments_professional_fk
  FOREIGN KEY (tenant_id, professional_id)
  REFERENCES public.tenant_professionals(tenant_id, id) ON DELETE SET NULL (professional_id);
CREATE INDEX IF NOT EXISTS tenant_appointments_tenant_date_idx
  ON public.tenant_appointments (tenant_id, date, time);
CREATE INDEX IF NOT EXISTS tenant_appointments_phone_idx
  ON public.tenant_appointments (tenant_id, phone, date)
  WHERE status = 'active';

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read tenants" ON public.tenants;
DROP POLICY IF EXISTS "owner update tenant" ON public.tenants;
DROP POLICY IF EXISTS "members view own tenancy" ON public.tenant_members;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = _tenant_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.tenant_has_access(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants
    WHERE id = _tenant_id
      AND (
        subscription_status = 'active'
        OR (subscription_status = 'trial' AND trial_ends_at > statement_timestamp())
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.tenant_public_booking_enabled(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT public.tenant_has_access(_tenant_id);
$$;

REVOKE ALL ON FUNCTION public.is_tenant_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tenant_has_access(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tenant_public_booking_enabled(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_has_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_public_booking_enabled(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS tenant_member_select ON public.tenants;
DROP POLICY IF EXISTS tenant_owner_update ON public.tenants;
DROP POLICY IF EXISTS member_read_self ON public.tenant_members;
DROP POLICY IF EXISTS tenant_settings_owner_read ON public.tenant_settings;
DROP POLICY IF EXISTS tenant_settings_owner_write ON public.tenant_settings;
DROP POLICY IF EXISTS tenant_services_public_read ON public.tenant_services;
DROP POLICY IF EXISTS tenant_services_owner_read ON public.tenant_services;
DROP POLICY IF EXISTS tenant_services_owner_write ON public.tenant_services;
DROP POLICY IF EXISTS tenant_professionals_owner_read ON public.tenant_professionals;
DROP POLICY IF EXISTS tenant_professionals_owner_write ON public.tenant_professionals;
DROP POLICY IF EXISTS tenant_appointments_owner_read ON public.tenant_appointments;
DROP POLICY IF EXISTS "public read active professionals" ON public.professionals;
DROP POLICY IF EXISTS "tenant manage professionals" ON public.professionals;
DROP POLICY IF EXISTS legacy_professionals_public_read ON public.professionals;
DROP POLICY IF EXISTS legacy_professionals_owner_read ON public.professionals;
DROP POLICY IF EXISTS legacy_professionals_owner_write ON public.professionals;

CREATE POLICY tenant_member_select ON public.tenants
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(id));
CREATE POLICY tenant_owner_update ON public.tenants
  FOR UPDATE TO authenticated
  USING (public.is_tenant_member(id) AND public.tenant_has_access(id))
  WITH CHECK (public.is_tenant_member(id) AND public.tenant_has_access(id));

CREATE POLICY member_read_self ON public.tenant_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY tenant_settings_owner_read ON public.tenant_settings
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));
CREATE POLICY tenant_settings_owner_write ON public.tenant_settings
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id) AND public.tenant_has_access(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id) AND public.tenant_has_access(tenant_id));

CREATE POLICY tenant_services_public_read ON public.tenant_services
  FOR SELECT TO anon, authenticated
  USING (active AND public.tenant_public_booking_enabled(tenant_id));
CREATE POLICY tenant_services_owner_read ON public.tenant_services
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));
CREATE POLICY tenant_services_owner_write ON public.tenant_services
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id) AND public.tenant_has_access(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id) AND public.tenant_has_access(tenant_id));

CREATE POLICY tenant_professionals_owner_read ON public.tenant_professionals
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));
CREATE POLICY tenant_professionals_owner_write ON public.tenant_professionals
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id) AND public.tenant_has_access(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id) AND public.tenant_has_access(tenant_id));

CREATE POLICY tenant_appointments_owner_read ON public.tenant_appointments
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY legacy_professionals_public_read ON public.professionals
  FOR SELECT TO anon, authenticated
  USING (active AND public.tenant_public_booking_enabled(tenant_id));
CREATE POLICY legacy_professionals_owner_read ON public.professionals
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));
CREATE POLICY legacy_professionals_owner_write ON public.professionals
  FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id) AND public.tenant_has_access(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id) AND public.tenant_has_access(tenant_id));

REVOKE ALL ON public.tenants, public.tenant_members, public.tenant_settings,
  public.tenant_services, public.tenant_professionals, public.tenant_appointments
  FROM anon, authenticated;
GRANT SELECT ON public.tenants, public.tenant_members, public.tenant_settings,
  public.tenant_services, public.tenant_professionals, public.tenant_appointments
  TO authenticated;
GRANT UPDATE (name, phone, email, logo_url, primary_color, site_style, bio, address)
  ON public.tenants TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tenant_settings,
  public.tenant_services, public.tenant_professionals TO authenticated;

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
  _service_capacity integer
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
  IF length(trim(COALESCE(_name, ''))) NOT BETWEEN 2 AND 100
    OR _slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    OR _segment NOT IN ('salon', 'barbershop', 'gym', 'clinic', 'services')
    OR length(_clean_phone) < 10
    OR COALESCE(_primary_color, '') !~ '^#[0-9A-Fa-f]{6}$'
    OR _site_style NOT IN ('clean', 'warm', 'bold')
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
    service_minutes, slot_interval_minutes, open_weekdays
  )
  VALUES (
    _tenant_id, _open_time, _close_time,
    CASE WHEN _segment = 'gym' THEN NULL ELSE _lunch_start END,
    CASE WHEN _segment = 'gym' THEN NULL ELSE _lunch_end END,
    _service_duration, _service_duration, _open_weekdays
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

REVOKE ALL ON FUNCTION public.create_tenant_with_owner(
  text, text, text, text, text, text, text, text, integer[], text, text, text, integer, numeric, integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_tenant_with_owner(
  text, text, text, text, text, text, text, text, integer[], text, text, text, integer, numeric, integer
) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_tenant_page(_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT jsonb_build_object(
    'tenant', jsonb_build_object(
    'id', t.id, 'slug', t.slug, 'name', t.name, 'segment', t.segment,
    'phone', t.phone, 'primary_color', t.primary_color, 'site_style', t.site_style,
    'bio', t.bio, 'address', t.address,
    'created_at', t.created_at
    ),
    'settings', to_jsonb(s),
    'services', COALESCE((
      SELECT jsonb_agg(to_jsonb(sv) - 'tenant_id' ORDER BY sv.sort_order)
      FROM public.tenant_services sv
      WHERE sv.tenant_id = t.id AND sv.active
    ), '[]'::jsonb),
    'professionals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'tenant_id', p.tenant_id, 'name', p.name,
        'role', p.role, 'avatar_url', p.avatar_url, 'active', p.active
      ) ORDER BY p.name)
      FROM public.tenant_professionals p
      WHERE p.tenant_id = t.id AND p.active
    ), '[]'::jsonb),
    'can_book', public.tenant_public_booking_enabled(t.id)
  )
  FROM public.tenants t
  JOIN public.tenant_settings s ON s.tenant_id = t.id
  WHERE t.slug = lower(trim(_slug))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_tenant_page(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_page(text) TO anon, authenticated;

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
  _capacity integer;
  _staff_count integer;
  _occupied text[];
BEGIN
  IF NOT public.tenant_public_booking_enabled(_tenant_id) THEN
    RAISE EXCEPTION 'subscription_required';
  END IF;

  SELECT max_capacity INTO _capacity
  FROM public.tenant_services
  WHERE id = _service_id AND tenant_id = _tenant_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'service_not_found'; END IF;

  IF _professional_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tenant_professionals
    WHERE id = _professional_id AND tenant_id = _tenant_id AND active
  ) THEN
    RAISE EXCEPTION 'professional_not_found';
  END IF;

  SELECT count(*) INTO _staff_count
  FROM public.tenant_professionals WHERE tenant_id = _tenant_id AND active;

  SELECT COALESCE(array_agg(q.time), ARRAY[]::text[]) INTO _occupied
  FROM (
    SELECT a.time
    FROM public.tenant_appointments a
    WHERE a.tenant_id = _tenant_id
      AND a.date = _date
      AND a.status = 'active'
      AND (
        (_capacity > 1 AND a.service_id = _service_id)
        OR (_capacity = 1 AND (
          (_professional_id IS NOT NULL AND a.professional_id = _professional_id)
          OR (_professional_id IS NULL AND _staff_count > 0
            AND a.professional_id IS NOT NULL
            AND a.professional_id IN (
              SELECT id FROM public.tenant_professionals
              WHERE tenant_id = _tenant_id AND active
            )
          )
          OR (_professional_id IS NULL AND _staff_count = 0)
        ))
      )
    GROUP BY a.time
    HAVING (
      (_capacity > 1 AND count(*) >= _capacity)
      OR (_capacity = 1 AND _professional_id IS NOT NULL AND count(*) >= 1)
      OR (_capacity = 1 AND _professional_id IS NULL AND _staff_count = 0 AND count(*) >= 1)
      OR (_capacity = 1 AND _professional_id IS NULL AND _staff_count > 0
        AND count(DISTINCT a.professional_id) >= _staff_count)
    )
  ) q;
  RETURN COALESCE(_occupied, ARRAY[]::text[]);
END;
$$;

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
  _busy_count integer;
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
    OR _time < _settings.open_time
    OR (_slot_start + make_interval(mins => _service.duration_minutes))::time > _settings.close_time::time
    OR (
      _settings.lunch_start IS NOT NULL AND _settings.lunch_end IS NOT NULL
      AND _slot_start::time < _settings.lunch_end::time
      AND (_slot_start + make_interval(mins => _service.duration_minutes))::time > _settings.lunch_start::time
    )
    OR _slot_start <= statement_timestamp() AT TIME ZONE 'America/Sao_Paulo'
  THEN
    RAISE EXCEPTION 'invalid_slot';
  END IF;

  IF _professional_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tenant_professionals
    WHERE id = _professional_id AND tenant_id = _tenant_id AND active
  ) THEN
    RAISE EXCEPTION 'professional_not_found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(_tenant_id::text || _date::text || _time));
  SELECT count(*) INTO _staff_count FROM public.tenant_professionals
    WHERE tenant_id = _tenant_id AND active;

  IF _service.max_capacity > 1 THEN
    SELECT count(*) INTO _busy_count FROM public.tenant_appointments
    WHERE tenant_id = _tenant_id AND service_id = _service_id
      AND date = _date AND time = _time AND status = 'active';
    IF _busy_count >= _service.max_capacity THEN RAISE EXCEPTION 'slot_taken'; END IF;
    _chosen_professional_id := NULL;
  ELSIF _chosen_professional_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.tenant_appointments
      WHERE tenant_id = _tenant_id AND professional_id = _chosen_professional_id
        AND date = _date AND time = _time AND status = 'active'
    ) THEN RAISE EXCEPTION 'slot_taken'; END IF;
  ELSIF _staff_count > 0 THEN
    SELECT p.id, p.name INTO _chosen_professional_id, _chosen_professional_name
    FROM public.tenant_professionals p
    WHERE p.tenant_id = _tenant_id AND p.active
      AND NOT EXISTS (
        SELECT 1 FROM public.tenant_appointments a
        WHERE a.tenant_id = _tenant_id AND a.professional_id = p.id
          AND a.date = _date AND a.time = _time AND a.status = 'active'
      )
    ORDER BY p.name
    LIMIT 1;
    IF _chosen_professional_id IS NULL THEN RAISE EXCEPTION 'slot_taken'; END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.tenant_appointments
      WHERE tenant_id = _tenant_id AND date = _date AND time = _time AND status = 'active'
    ) THEN RAISE EXCEPTION 'slot_taken'; END IF;
  END IF;

  IF _chosen_professional_id IS NOT NULL AND _chosen_professional_name IS NULL THEN
    SELECT name INTO _chosen_professional_name
    FROM public.tenant_professionals WHERE id = _chosen_professional_id AND tenant_id = _tenant_id;
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

CREATE OR REPLACE FUNCTION public.find_tenant_appointments(_tenant_id uuid, _phone text)
RETURNS TABLE(id uuid, client_name text, service_name text, date date, "time" text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT a.id, a.client_name, a.service_name, a.date, a.time
  FROM public.tenant_appointments a
  WHERE a.tenant_id = _tenant_id
    AND a.phone = regexp_replace(COALESCE(_phone, ''), '\D', '', 'g')
    AND a.status = 'active'
    AND (a.date + a.time::time) > (statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')
  ORDER BY a.date, a.time
  LIMIT 10;
$$;

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
  _occupied text[];
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
  IF NOT public.tenant_public_booking_enabled(_appointment.tenant_id) THEN
    RAISE EXCEPTION 'subscription_required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(
    _appointment.tenant_id::text || _new_date::text || _new_time
  ));
  _occupied := public.get_tenant_occupied_slots(
    _appointment.tenant_id, _new_date, _appointment.service_id, _appointment.professional_id
  );
  IF _new_time = ANY(_occupied) THEN RAISE EXCEPTION 'slot_taken'; END IF;
  UPDATE public.tenant_appointments
  SET date = _new_date, time = _new_time
  WHERE id = _appointment.id;
END;
$$;

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
  _busy_count integer;
  _staff_count integer;
  _weekday integer;
BEGIN
  SELECT * INTO _appointment
  FROM public.tenant_appointments
  WHERE id = _appointment_id
  FOR UPDATE;
  IF NOT FOUND OR NOT public.is_tenant_member(_appointment.tenant_id) THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.tenant_has_access(_appointment.tenant_id) THEN RAISE EXCEPTION 'subscription_required'; END IF;
  IF _status IS NOT NULL AND _status NOT IN ('active', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;
  IF (_date IS NULL) <> (_time IS NULL) THEN RAISE EXCEPTION 'invalid_slot'; END IF;

  IF _date IS NOT NULL THEN
    IF _time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'invalid_slot'; END IF;
    SELECT * INTO _service FROM public.tenant_services
    WHERE id = _appointment.service_id AND tenant_id = _appointment.tenant_id AND active;
    IF NOT FOUND THEN RAISE EXCEPTION 'service_not_found'; END IF;
    SELECT * INTO _settings FROM public.tenant_settings
    WHERE tenant_id = _appointment.tenant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'tenant_not_found'; END IF;
    _target_date := _date;
    _target_time := _time;
    _target_start := _target_date + _target_time::time;
    _weekday := extract(dow FROM _target_date)::integer;

    IF _target_date < (statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date
      OR _target_start <= statement_timestamp() AT TIME ZONE 'America/Sao_Paulo'
      OR NOT (_settings.open_weekdays @> ARRAY[_weekday])
      OR _target_start < (_target_date + _settings.open_time::time)
      OR (_target_start + make_interval(mins => _service.duration_minutes))
        > (_target_date + _settings.close_time::time)
      OR (
        _settings.lunch_start IS NOT NULL AND _settings.lunch_end IS NOT NULL
        AND _target_start < (_target_date + _settings.lunch_end::time)
        AND (_target_start + make_interval(mins => _service.duration_minutes))
          > (_target_date + _settings.lunch_start::time)
      )
    THEN RAISE EXCEPTION 'invalid_slot'; END IF;

    PERFORM pg_advisory_xact_lock(hashtext(
      _appointment.tenant_id::text || _target_date::text || _target_time
    ));
    SELECT count(*) INTO _staff_count FROM public.tenant_professionals
    WHERE tenant_id = _appointment.tenant_id AND active;

    IF _service.max_capacity > 1 THEN
      SELECT count(*) INTO _busy_count FROM public.tenant_appointments
      WHERE tenant_id = _appointment.tenant_id AND service_id = _appointment.service_id
        AND date = _target_date AND time = _target_time AND status = 'active'
        AND id <> _appointment_id;
      IF _busy_count >= _service.max_capacity THEN RAISE EXCEPTION 'slot_taken'; END IF;
    ELSIF _appointment.professional_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.tenant_appointments
        WHERE tenant_id = _appointment.tenant_id
          AND professional_id = _appointment.professional_id
          AND date = _target_date AND time = _target_time AND status = 'active'
          AND id <> _appointment_id
      ) THEN RAISE EXCEPTION 'slot_taken'; END IF;
    ELSIF _staff_count > 0 THEN
      SELECT count(DISTINCT professional_id) INTO _busy_count
      FROM public.tenant_appointments
      WHERE tenant_id = _appointment.tenant_id
        AND date = _target_date AND time = _target_time AND status = 'active'
        AND id <> _appointment_id AND professional_id IS NOT NULL;
      IF _busy_count >= _staff_count THEN RAISE EXCEPTION 'slot_taken'; END IF;
    ELSE
      IF EXISTS (
        SELECT 1 FROM public.tenant_appointments
        WHERE tenant_id = _appointment.tenant_id
          AND date = _target_date AND time = _target_time AND status = 'active'
          AND id <> _appointment_id
      ) THEN RAISE EXCEPTION 'slot_taken'; END IF;
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
REVOKE ALL ON FUNCTION public.find_tenant_appointments(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.change_tenant_appointment(uuid, text, date, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_tenant_appointment(uuid, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_occupied_slots(uuid, date, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_tenant_appointment(uuid, uuid, uuid, text, text, text, date, text, numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_tenant_appointments(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_tenant_appointment(uuid, text, date, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_appointment(uuid, text, date, text) TO authenticated;

COMMENT ON TABLE public.tenant_appointments IS 'Private owner-managed appointment records; public operations are exposed only through validated RPCs.';
COMMENT ON COLUMN public.tenants.trial_started_at IS 'Set by create_tenant_with_owner using database time; never client-controlled.';
COMMENT ON COLUMN public.tenants.trial_ends_at IS 'Five-day trial deadline set by the database when the owner creates the workspace.';

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FONTE: supabase/migrations/20261110120500_tenant_clients.sql
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
-- ==============================================================================
-- MIGRATION 0005: TENANT CLIENTS
-- Cadastro de clientes por tenant, sem login.
-- Populado automaticamente a partir dos agendamentos (trigger).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 100),
  phone text NOT NULL CHECK (length(regexp_replace(phone, '\D', '', 'g')) BETWEEN 10 AND 15),
  email text,
  notes text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  total_appointments integer NOT NULL DEFAULT 0 CHECK (total_appointments >= 0),
  UNIQUE (tenant_id, phone)
);

CREATE INDEX IF NOT EXISTS tenant_clients_tenant_name_idx
  ON public.tenant_clients (tenant_id, name);

ALTER TABLE public.tenant_clients ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tenant_clients FROM anon, authenticated;
GRANT SELECT ON public.tenant_clients TO authenticated;
GRANT UPDATE (name, phone, email, notes) ON public.tenant_clients TO authenticated;
GRANT ALL ON public.tenant_clients TO service_role;

DROP POLICY IF EXISTS "members read tenant clients" ON public.tenant_clients;
CREATE POLICY "members read tenant clients"
  ON public.tenant_clients FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "members update tenant clients" ON public.tenant_clients;
CREATE POLICY "members update tenant clients"
  ON public.tenant_clients FOR UPDATE TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

-- Sincroniza o cliente sempre que um agendamento ativo é criado.
CREATE OR REPLACE FUNCTION public.sync_tenant_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tenant_clients (
    tenant_id, name, phone, first_seen_at, last_seen_at, total_appointments
  )
  VALUES (
    NEW.tenant_id, trim(NEW.client_name), NEW.phone, now(), now(), 1
  )
  ON CONFLICT (tenant_id, phone) DO UPDATE
    SET name = EXCLUDED.name,
        last_seen_at = now(),
        total_appointments = tenant_clients.total_appointments + 1;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_tenant_client() FROM PUBLIC;

DROP TRIGGER IF EXISTS tenant_appointments_sync_client ON public.tenant_appointments;
CREATE TRIGGER tenant_appointments_sync_client
AFTER INSERT ON public.tenant_appointments
FOR EACH ROW
EXECUTE FUNCTION public.sync_tenant_client();

-- Backfill defensivo (no-op em banco vazio).
INSERT INTO public.tenant_clients (
  tenant_id, name, phone, first_seen_at, last_seen_at, total_appointments
)
SELECT
  a.tenant_id,
  max(a.client_name),
  a.phone,
  min(a.created_at),
  max(a.created_at),
  count(*)
FROM public.tenant_appointments a
WHERE a.status = 'active'
  AND length(regexp_replace(a.phone, '\D', '', 'g')) BETWEEN 10 AND 15
GROUP BY a.tenant_id, a.phone
ON CONFLICT (tenant_id, phone) DO NOTHING;

COMMENT ON TABLE public.tenant_clients IS
  'Cadastro de clientes por tenant. Criado automaticamente pelos agendamentos; não requer login.';

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FONTE: supabase/migrations/20261110120600_booking_rules.sql
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
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


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FONTE: supabase/migrations/20261112120000_auto_confirm_users.sql
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
-- ==============================================================================
-- Cadastro sem confirmação de e-mail
--
-- Todo usuário criado em auth.users já nasce com email_confirmed_at
-- preenchido. Com isso:
--   * o GoTrue não envia e-mail de confirmação;
--   * o signup devolve sessão e o usuário entra direto no sistema;
--   * contas antigas que ficaram pendentes são confirmadas agora.
--
-- O ajuste preferencial continua sendo desligar "Confirm email" no painel
-- (Authentication > Sign In / Providers > Email). Este trigger garante o
-- mesmo comportamento em nível de banco, inclusive para cadastros feitos
-- pela Admin API e por integrações.
-- ==============================================================================

create or replace function public.auto_confirm_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  -- confirmed_at é coluna gerada (LEAST(email_confirmed_at, phone_confirmed_at)),
  -- portanto só email_confirmed_at precisa ser definido.
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;

comment on function public.auto_confirm_new_user() is
  'Marca o usuário como confirmado no INSERT: remove a exigência de confirmação de e-mail no cadastro.';

drop trigger if exists on_auth_user_created_auto_confirm on auth.users;
create trigger on_auth_user_created_auto_confirm
  before insert on auth.users
  for each row
  execute function public.auto_confirm_new_user();

-- O GoTrue grava em auth.users como supabase_auth_admin.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.auto_confirm_new_user() to supabase_auth_admin;
  end if;
end;
$$;

-- Confirma as contas que ficaram pendentes antes desta migration.
update auth.users
   set email_confirmed_at = now()
 where email_confirmed_at is null
   and deleted_at is null;

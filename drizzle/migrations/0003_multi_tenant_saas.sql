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

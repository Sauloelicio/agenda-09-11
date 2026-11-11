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

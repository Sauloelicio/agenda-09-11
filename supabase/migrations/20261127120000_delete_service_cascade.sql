-- ==============================================================================
-- Exclusão de serviços com agendamentos vinculados
--
-- Antes, a FK (tenant_id, service_id) de tenant_appointments usava
-- ON DELETE RESTRICT: qualquer serviço com agendamentos não podia ser removido.
-- Agora a exclusão do serviço remove também seus agendamentos (CASCADE),
-- permitindo a remoção pelo painel do estabelecimento.
--
-- Idempotente: pode ser executada mais de uma vez.
-- ==============================================================================

DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.tenant_appointments'::regclass
      AND confrelid = 'public.tenant_services'::regclass
      AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.tenant_appointments DROP CONSTRAINT %I', fk.conname);
  END LOOP;
END $$;

ALTER TABLE public.tenant_appointments
  ADD CONSTRAINT tenant_appointments_service_fk
  FOREIGN KEY (tenant_id, service_id)
  REFERENCES public.tenant_services(tenant_id, id)
  ON DELETE CASCADE;

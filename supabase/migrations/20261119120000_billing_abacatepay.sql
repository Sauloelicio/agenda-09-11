-- ==============================================================================
-- MIGRATION: FATURAMENTO COM ABACATE PAY
--
-- Registra o estado da assinatura de cada tenant, guarda os eventos do webhook
-- (idempotência), grava as faturas pagas e expõe RPCs somente para service_role.
-- Nenhuma dependência de pg_cron/pg_net: quem dispara os Jobs é a aplicação.
-- Idempotente: pode ser aplicada mais de uma vez.
-- ==============================================================================

-- 1. Colunas de faturamento na tabela de tenants.
-- billing_reminder_stage controla os avisos de expiração do teste grátis.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS billing_customer_id text,
  ADD COLUMN IF NOT EXISTS billing_subscription_id text,
  ADD COLUMN IF NOT EXISTS billing_checkout_id text,
  ADD COLUMN IF NOT EXISTS billing_method text,
  ADD COLUMN IF NOT EXISTS billing_tax_id text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS billing_reminder_stage integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_updated_at timestamptz;

-- Restrição do método de pagamento adicionada separadamente para ser idempotente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'tenants'
      AND constraint_name = 'tenants_billing_method_check'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_billing_method_check
      CHECK (billing_method IS NULL OR billing_method IN ('CARD', 'PIX'));
  END IF;
END;
$$;

-- 2. Log de eventos do webhook. A PK text é o id do log da AbacatePay (log_...),
-- garantindo que o mesmo evento nunca seja aplicado duas vezes.
CREATE TABLE IF NOT EXISTS public.billing_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id text,
  checkout_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS billing_events_tenant_idx
  ON public.billing_events (tenant_id);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_events_master_read ON public.billing_events;
CREATE POLICY billing_events_master_read ON public.billing_events
  FOR SELECT TO authenticated
  USING (public.is_master());

-- Somente leitura para o painel master; escrita é feita pelo service_role.
REVOKE ALL ON public.billing_events FROM anon, authenticated;
GRANT SELECT ON public.billing_events TO authenticated;

-- 3. Faturas pagas. billing_payment_id é o id do pagamento da AbacatePay e
-- impede duplicidade de cobrança quando o webhook é reenviado.
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  billing_payment_id text UNIQUE,
  billing_subscription_id text,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  status text NOT NULL,
  method text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_tenant_idx
  ON public.invoices (tenant_id);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoices_tenant_read ON public.invoices;
CREATE POLICY invoices_tenant_read ON public.invoices
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id) OR public.is_master());

-- Membros e master podem consultar; nenhuma escrita via cliente autenticado.
REVOKE ALL ON public.invoices FROM anon, authenticated;
GRANT SELECT ON public.invoices TO authenticated;

-- 4. Aplicação idempotente de eventos de assinatura vindos do webhook.
-- p_status e p_canceled_due_to são mantidos para compatibilidade com o payload;
-- o estado efetivo é derivado do tipo do evento.
CREATE OR REPLACE FUNCTION public.billing_apply_subscription_event(
  p_event_id text,
  p_event_type text,
  p_tenant_id uuid,
  p_subscription_id text,
  p_checkout_id text,
  p_status text,
  p_trial_ends_at timestamptz,
  p_current_period_end timestamptz,
  p_amount_cents integer,
  p_payment_id text,
  p_method text,
  p_canceled_due_to text,
  p_payload jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  _affected integer;
BEGIN
  -- Registra o evento primeiro. Se o id já existir, nada é alterado.
  INSERT INTO public.billing_events (
    id, event_type, tenant_id, subscription_id, checkout_id, payload, processed_at
  )
  VALUES (
    p_event_id, p_event_type, p_tenant_id, p_subscription_id, p_checkout_id,
    COALESCE(p_payload, '{}'::jsonb), now()
  )
  ON CONFLICT (id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Evento sem tenant identificado fica apenas no log para investigação.
  IF p_tenant_id IS NULL THEN
    RETURN false;
  END IF;

  CASE p_event_type
    -- Início do teste grátis: zera o estágio de lembretes e o período pago.
    WHEN 'subscription.trial_started' THEN
      UPDATE public.tenants
         SET subscription_status = 'trial',
             plan = 'basic',
             billing_subscription_id = COALESCE(p_subscription_id, billing_subscription_id),
             billing_checkout_id = COALESCE(p_checkout_id, billing_checkout_id),
             billing_method = COALESCE(p_method, billing_method),
             trial_started_at = now(),
             trial_ends_at = COALESCE(p_trial_ends_at, now() + interval '5 days'),
             current_period_end = NULL,
             billing_reminder_stage = 0,
             billing_updated_at = now(),
             updated_at = now()
       WHERE id = p_tenant_id;

    -- Assinatura confirmada ou renovada: ativa a conta e registra a fatura paga.
    WHEN 'subscription.completed', 'subscription.renewed' THEN
      UPDATE public.tenants
         SET subscription_status = 'active',
             plan = 'basic',
             billing_subscription_id = COALESCE(p_subscription_id, billing_subscription_id),
             billing_checkout_id = COALESCE(p_checkout_id, billing_checkout_id),
             billing_method = COALESCE(p_method, billing_method),
             current_period_end = COALESCE(p_current_period_end, now() + interval '1 month'),
             billing_reminder_stage = 0,
             billing_updated_at = now(),
             updated_at = now()
       WHERE id = p_tenant_id;

      IF p_payment_id IS NOT NULL AND p_amount_cents > 0 THEN
        INSERT INTO public.invoices (
          tenant_id, billing_payment_id, billing_subscription_id,
          amount_cents, status, method, paid_at
        )
        VALUES (
          p_tenant_id, p_payment_id, p_subscription_id,
          p_amount_cents, 'PAID', p_method, now()
        )
        ON CONFLICT (billing_payment_id) DO NOTHING;
      END IF;

    -- Falha de cobrança: entende em atraso, mas nunca cancela um tenant cancelado.
    WHEN 'subscription.payment_failed' THEN
      UPDATE public.tenants
         SET subscription_status = 'past_due',
             billing_updated_at = now(),
             updated_at = now()
       WHERE id = p_tenant_id
         AND subscription_status <> 'canceled';

    -- Cancelamento: mantém o fim do período informado pelo gateway.
    WHEN 'subscription.cancelled' THEN
      UPDATE public.tenants
         SET subscription_status = 'canceled',
             current_period_end = COALESCE(p_current_period_end, current_period_end),
             billing_updated_at = now(),
             updated_at = now()
       WHERE id = p_tenant_id;

    -- Outros eventos são apenas registrados no log de auditoria.
    ELSE
      NULL;
  END CASE;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.billing_apply_subscription_event(
  text, text, uuid, text, text, text, timestamptz, timestamptz,
  integer, text, text, text, jsonb
) IS 'Aplica eventos do webhook AbacatePay com idempotência pelo id do log.';

REVOKE ALL ON FUNCTION public.billing_apply_subscription_event(
  text, text, uuid, text, text, text, timestamptz, timestamptz,
  integer, text, text, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_apply_subscription_event(
  text, text, uuid, text, text, text, timestamptz, timestamptz,
  integer, text, text, text, jsonb
) TO service_role;

-- 5. Expiração automática dos trials sem assinatura ativa. Trials que já
-- possuem subscription_id são renovados pelo webhook e não são expirados aqui.
CREATE OR REPLACE FUNCTION public.billing_expire_trials()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  _expired integer;
BEGIN
  UPDATE public.tenants
     SET subscription_status = 'expired',
         updated_at = now()
   WHERE subscription_status = 'trial'
     AND trial_ends_at <= now()
     AND billing_subscription_id IS NULL;

  GET DIAGNOSTICS _expired = ROW_COUNT;
  RETURN _expired;
END;
$$;

COMMENT ON FUNCTION public.billing_expire_trials() IS
  'Expira testes grátis vencidos que não possuem assinatura de cartão.';

REVOKE ALL ON FUNCTION public.billing_expire_trials()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_expire_trials() TO service_role;

-- 6. Lembretes de fim de trial (dia 4, 5 e 6), no máximo um por estágio.
CREATE OR REPLACE FUNCTION public.billing_get_due_reminders()
RETURNS TABLE(
  tenant_id uuid,
  tenant_name text,
  owner_email text,
  stage integer,
  trial_ends_at timestamptz,
  plan text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  WITH due AS (
    SELECT t.id,
           t.name,
           t.email,
           t.trial_ends_at,
           t.plan,
           t.billing_reminder_stage,
           CASE
             WHEN t.trial_ends_at - now() > interval '48 hours' THEN 1
             WHEN t.trial_ends_at - now() > interval '24 hours' THEN 2
             ELSE 3
           END AS reminder_stage
      FROM public.tenants t
     WHERE t.subscription_status = 'trial'
       AND t.billing_subscription_id IS NULL
       AND t.trial_ends_at > now()
       AND t.trial_ends_at <= now() + interval '3 days'
  )
  SELECT d.id AS tenant_id,
         d.name AS tenant_name,
         COALESCE((
           SELECT u.email
             FROM public.tenant_members m
             JOIN auth.users u ON u.id = m.user_id
            WHERE m.tenant_id = d.id
              AND m.role = 'owner'
            ORDER BY m.created_at
            LIMIT 1
         ), d.email) AS owner_email,
         d.reminder_stage AS stage,
         d.trial_ends_at,
         d.plan
    FROM due d
   WHERE d.billing_reminder_stage < d.reminder_stage
   ORDER BY d.trial_ends_at;
$$;

COMMENT ON FUNCTION public.billing_get_due_reminders() IS
  'Lista tenants em trial que ainda não receberam o lembrete do estágio atual.';

REVOKE ALL ON FUNCTION public.billing_get_due_reminders()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_get_due_reminders() TO service_role;

-- 7. Marca o lembrete como enviado, nunca regressando o estágio.
CREATE OR REPLACE FUNCTION public.billing_mark_reminder_sent(
  p_tenant_id uuid,
  p_stage integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  UPDATE public.tenants
     SET billing_reminder_stage = greatest(billing_reminder_stage, p_stage)
   WHERE id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION public.billing_mark_reminder_sent(uuid, integer) IS
  'Registra o maior estágio de aviso de expiração já enviado ao tenant.';

REVOKE ALL ON FUNCTION public.billing_mark_reminder_sent(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_mark_reminder_sent(uuid, integer)
  TO service_role;

-- 8. Associa o cliente/checkout da AbacatePay ao tenant (etapa do checkout).
CREATE OR REPLACE FUNCTION public.billing_set_customer(
  p_tenant_id uuid,
  p_customer_id text,
  p_checkout_id text,
  p_tax_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  UPDATE public.tenants
     SET billing_customer_id = p_customer_id,
         billing_checkout_id = COALESCE(p_checkout_id, billing_checkout_id),
         billing_tax_id = COALESCE(p_tax_id, billing_tax_id),
         billing_updated_at = now()
   WHERE id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION public.billing_set_customer(uuid, text, text, text) IS
  'Salva os identificadores de cliente, checkout e CPF/CNPJ do faturamento.';

REVOKE ALL ON FUNCTION public.billing_set_customer(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_set_customer(uuid, text, text, text)
  TO service_role;

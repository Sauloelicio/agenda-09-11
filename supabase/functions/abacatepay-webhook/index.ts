// POST /functions/v1/abacatepay-webhook
// Recebe eventos de assinatura da Abacate Pay e aplica no banco via RPC.
import {
  abacateFetch,
  createServiceClient,
  handleOptions,
  jsonResponse,
  verifyWebhook,
} from '../_shared/billing.ts'

type SubscriptionStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'canceled'
  | null

interface SubscriptionPayload {
  id?: string
  amount?: number
  method?: string
  status?: string
  cancelledDueTo?: string | null
  trialDays?: number
  trialEndsAt?: string | null
  currentPeriodStart?: string | null
  currentPeriodEnd?: string | null
  nextChargeAt?: string | null
}

interface CheckoutPayload {
  id?: string
  externalId?: string
  metadata?: { tenantId?: string }
  methods?: string[]
}

interface PaymentPayload {
  id?: string
  amount?: number
}

interface WebhookPayload {
  id?: string
  event?: string
  data?: {
    subscription?: SubscriptionPayload
    customer?: { id?: string; name?: string; email?: string; taxId?: string }
    checkout?: CheckoutPayload
    payment?: PaymentPayload
  }
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HANDLED_EVENTS = new Set([
  'subscription.trial_started',
  'subscription.completed',
  'subscription.renewed',
  'subscription.payment_failed',
  'subscription.cancelled',
])

function isoAfterDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

function isoAfterMonth(): string {
  const date = new Date()
  date.setUTCMonth(date.getUTCMonth() + 1)
  return date.toISOString()
}

function toIsoOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function statusFromPayload(status: unknown): SubscriptionStatus {
  switch (String(status ?? '').toUpperCase()) {
    case 'TRIAL':
    case 'TRIALING':
      return 'trial'
    case 'ACTIVE':
      return 'active'
    case 'PAST_DUE':
    case 'PASTDUE':
    case 'UNPAID':
      return 'past_due'
    case 'CANCELED':
    case 'CANCELLED':
      return 'canceled'
    default:
      return null
  }
}

/** O status do payload é a fonte da verdade para eventos fora de ordem. */
function resolveStatus(
  event: string,
  subscription: SubscriptionPayload,
): SubscriptionStatus {
  if (event === 'subscription.trial_started') return 'trial'
  if (event === 'subscription.cancelled') return 'canceled'
  const fromPayload = statusFromPayload(subscription.status)
  if (fromPayload) return fromPayload
  return event === 'subscription.payment_failed' ? 'past_due' : 'active'
}

Deno.serve(async (req: Request): Promise<Response> => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405)
  }

  // O corpo bruto é necessário para validar a assinatura HMAC.
  const raw = await req.text()

  try {
    await verifyWebhook(req, raw)
  } catch (error) {
    console.error(
      '[abacatepay-webhook] assinatura inválida',
      error instanceof Error ? error.message : 'erro desconhecido',
    )
    return jsonResponse({ error: 'Webhook inválido' }, 401)
  }

  let payload: WebhookPayload
  try {
    payload = JSON.parse(raw) as WebhookPayload
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400)
  }

  const event = payload.event ?? ''
  if (event === 'checkout.completed' || !HANDLED_EVENTS.has(event)) {
    return jsonResponse({ received: true, processed: false })
  }
  // O id do log (log_...) é a chave de idempotência no banco.
  if (!payload.id) {
    return jsonResponse({ error: 'Evento sem identificador' }, 400)
  }

  const subscription = payload.data?.subscription ?? {}
  const checkout = payload.data?.checkout ?? {}
  const payment = payload.data?.payment ?? {}

  const externalId = checkout.externalId ?? ''
  const candidateTenantId = externalId.includes('_')
    ? externalId.split('_')[1]
    : undefined
  const tenantId =
    candidateTenantId && UUID_REGEX.test(candidateTenantId)
      ? candidateTenantId
      : checkout.metadata?.tenantId

  const subscriptionId = subscription.id
  if (!tenantId || !UUID_REGEX.test(tenantId) || !subscriptionId) {
    console.error('[abacatepay-webhook] evento sem tenant ou assinatura identificável')
    return jsonResponse({ received: true, processed: false })
  }

  const status = resolveStatus(event, subscription)

  // Best-effort: detalhes da assinatura complementam o payload do webhook.
  let remote: SubscriptionPayload | null = null
  try {
    remote = await abacateFetch<SubscriptionPayload>(
      `/subscriptions/get?id=${encodeURIComponent(subscriptionId)}`,
    )
  } catch {
    remote = null
  }

  let trialEndsAt: string | null = null
  let currentPeriodEnd: string | null = null

  if (event === 'subscription.trial_started') {
    const fallback = isoAfterDays(5)
    trialEndsAt = toIsoOrNull(remote?.trialEndsAt) ?? fallback
    currentPeriodEnd =
      toIsoOrNull(remote?.currentPeriodEnd) ?? trialEndsAt ?? fallback
  } else if (
    event === 'subscription.completed' ||
    event === 'subscription.renewed'
  ) {
    trialEndsAt = toIsoOrNull(remote?.trialEndsAt)
    currentPeriodEnd =
      toIsoOrNull(remote?.currentPeriodEnd) ?? isoAfterMonth()
  } else {
    trialEndsAt = toIsoOrNull(remote?.trialEndsAt)
    currentPeriodEnd = toIsoOrNull(remote?.currentPeriodEnd)
  }

  const amountCents = Number(
    payment.amount ?? subscription.amount ?? 0,
  )
  const method = subscription.method ?? checkout.methods?.[0] ?? null

  try {
    const supabase = createServiceClient()
    const { data: processed, error } = await supabase.rpc(
      'billing_apply_subscription_event',
      {
        p_event_id: payload.id,
        p_event_type: event,
        p_tenant_id: tenantId,
        p_subscription_id: subscriptionId,
        p_checkout_id: checkout.id ?? null,
        p_status: status,
        p_trial_ends_at: trialEndsAt,
        p_current_period_end: currentPeriodEnd,
        p_amount_cents: Number.isFinite(amountCents) ? Math.round(amountCents) : 0,
        p_payment_id: payment.id ?? null,
        p_method: method,
        p_canceled_due_to: subscription.cancelledDueTo ?? null,
        p_payload: payload,
      },
    )
    if (error) throw error

    return jsonResponse({ received: true, processed: processed === true })
  } catch (error) {
    console.error(
      '[abacatepay-webhook] falha ao processar evento',
      error instanceof Error ? error.message : 'erro desconhecido',
    )
    return jsonResponse({ error: 'Erro interno ao processar o webhook' }, 500)
  }
})

// POST /functions/v1/create-checkout
// Cria (ou reaproveita) o cliente e inicia uma assinatura na Abacate Pay.
import {
  abacateFetch,
  createAnonClient,
  createServiceClient,
  getBearerToken,
  handleOptions,
  jsonResponse,
  PLAN_PRICES,
  PLAN_PRODUCTS,
  requireUser,
  SITE_URL,
  type BillingMethod,
  type Plan,
} from '../_shared/billing.ts'

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

interface CheckoutBody {
  tenantId?: unknown
  plan?: unknown
  method?: unknown
  taxId?: unknown
}

interface AbacateCustomer {
  id: string
}

interface AbacateSubscription {
  id: string
  url: string
}

function digits(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).replace(/\D/g, '')
    : ''
}

Deno.serve(async (req: Request): Promise<Response> => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405)
  }

  try {
    let body: CheckoutBody
    try {
      body = (await req.json()) as CheckoutBody
    } catch {
      throw new HttpError(400, 'Corpo da requisição inválido')
    }

    const tenantId = typeof body.tenantId === 'string' ? body.tenantId.trim() : ''
    const plan = body.plan as Plan
    const method = body.method as BillingMethod

    if (!tenantId) {
      throw new HttpError(400, 'Informe o estabelecimento (tenantId)')
    }
    if (
      !plan ||
      !Object.prototype.hasOwnProperty.call(PLAN_PRICES, plan)
    ) {
      throw new HttpError(400, 'Plano inválido')
    }
    if (method !== 'CARD' && method !== 'PIX') {
      throw new HttpError(400, 'Forma de pagamento inválida')
    }

    const anon = createAnonClient()
    let user
    try {
      user = await requireUser(req, anon)
    } catch {
      throw new HttpError(401, 'Não autenticado')
    }
    const token = getBearerToken(req)
    if (!token) throw new HttpError(401, 'Não autenticado')

    const supabase = createServiceClient()

    // is_master() depende de auth.uid(): precisa ser chamado com o JWT do usuário.
    const userClient = createAnonClient(token)
    const { data: isMaster, error: masterError } = await userClient.rpc(
      'is_master',
    )
    if (masterError) {
      throw new HttpError(500, 'Não foi possível verificar as permissões')
    }

    const { data: membership, error: membershipError } = await supabase
      .from('tenant_members')
      .select('tenant_id')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .maybeSingle()
    if (membershipError) {
      throw new HttpError(500, 'Não foi possível verificar as permissões')
    }

    if (!membership && isMaster !== true) {
      throw new HttpError(403, 'Você não tem permissão para assinar este plano')
    }

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, email, phone, slug, billing_tax_id')
      .eq('id', tenantId)
      .maybeSingle()
    if (tenantError) {
      throw new HttpError(500, 'Não foi possível carregar o estabelecimento')
    }
    if (!tenant) {
      throw new HttpError(404, 'Estabelecimento não encontrado')
    }

    const email = tenant.email || user.email
    if (!email) {
      throw new HttpError(400, 'É necessário um e-mail para criar a assinatura')
    }
    const taxId = digits(body.taxId ?? (tenant as { billing_tax_id?: unknown }).billing_tax_id)
    const cellphone = digits(tenant.phone)

    // customers/create faz upsert por taxId, e-mail ou celular.
    const customer = await abacateFetch<AbacateCustomer>('/customers/create', {
      method: 'POST',
      body: {
        email,
        name: tenant.name ?? undefined,
        cellphone: cellphone || undefined,
        taxId: taxId.length >= 11 ? taxId : undefined,
      },
    })
    if (!customer?.id) {
      throw new HttpError(500, 'Não foi possível criar o cliente de cobrança')
    }

    const productId = PLAN_PRODUCTS[plan][method]
    if (!productId) {
      throw new HttpError(500, 'Produto deste plano/forma de pagamento não configurado')
    }

    const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const externalId = `tenant_${tenantId}_${method}_${yyyymmdd}`

    const subscription = await abacateFetch<AbacateSubscription>(
      '/subscriptions/create',
      {
        method: 'POST',
        body: {
          items: [{ id: productId, quantity: 1 }],
          customerId: customer.id,
          externalId,
          completionUrl: `${SITE_URL}/admin?billing=return`,
          returnUrl: `${SITE_URL}/planos`,
          methods: [method],
          ...(method === 'CARD'
            ? { retryPolicy: { maxRetry: 3, retryEvery: 2 } }
            : {}),
          metadata: { tenantId, plan, method },
        },
      },
    )
    if (!subscription?.url || !subscription?.id) {
      throw new HttpError(500, 'Não foi possível iniciar a assinatura')
    }

    const { error: setCustomerError } = await supabase.rpc(
      'billing_set_customer',
      {
        p_tenant_id: tenantId,
        p_customer_id: customer.id,
        p_checkout_id: subscription.id,
        p_tax_id: taxId || null,
      },
    )
    if (setCustomerError) {
      throw new HttpError(500, 'Não foi possível salvar os dados de cobrança')
    }

    return jsonResponse({
      url: subscription.url,
      checkoutId: subscription.id,
      customerId: customer.id,
      plan,
      method,
    })
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500
    if (status >= 500) {
      console.error(
        '[create-checkout] falha',
        error instanceof Error ? error.message : 'erro desconhecido',
      )
    }
    const message =
      status >= 500
        ? 'Erro interno ao criar o checkout. Tente novamente em instantes.'
        : error instanceof Error
          ? error.message
          : 'Não foi possível criar o checkout'
    return jsonResponse({ error: message }, status)
  }
})

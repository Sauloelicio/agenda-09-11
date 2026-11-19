// Worker Cloudflare: dispara a Edge Function de faturamento duas vezes ao dia.
// As rotas HTTP continuam sendo servidas pelos assets (SPA).
interface BillingCronEnv {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  CRON_SECRET: string
}

interface ScheduledControllerLike {
  readonly cron: string
  readonly scheduledTime: number
  noRetry(): void
}

interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void
}

async function runBillingCron(env: BillingCronEnv): Promise<void> {
  const supabaseUrl = env.SUPABASE_URL?.replace(/\/$/, '')
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  const cronSecret = env.CRON_SECRET

  if (!supabaseUrl || !serviceKey || !cronSecret) {
    console.error('[billing-cron worker] variáveis de ambiente ausentes')
    return
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/billing-cron`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'x-cron-secret': cronSecret,
        'Content-Type': 'application/json',
      },
      body: '{}',
    },
  )

  const body = await response.text()
  if (!response.ok) {
    throw new Error(`billing-cron respondeu ${response.status}: ${body}`)
  }
  console.log('[billing-cron worker] rotina concluída', body)
}

export default {
  async scheduled(
    _controller: ScheduledControllerLike,
    env: BillingCronEnv,
    ctx: ExecutionContextLike,
  ): Promise<void> {
    const promise = runBillingCron(env).catch((error: unknown) => {
      console.error(
        '[billing-cron worker] erro',
        error instanceof Error ? error.message : 'erro desconhecido',
      )
    })
    ctx.waitUntil(promise)
  },

  async fetch(): Promise<Response> {
    return new Response('Not Found', { status: 404 })
  },
}

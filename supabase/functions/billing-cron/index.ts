// POST /functions/v1/billing-cron
// Expira testes vencidos e envia lembretes de renovação via Resend.
import {
  createServiceClient,
  getEnv,
  handleOptions,
  jsonResponse,
  SITE_URL,
  timingSafeEqual,
} from '../_shared/billing.ts'

interface ReminderRow {
  tenant_id: string
  tenant_name: string | null
  owner_email: string | null
  stage: number
  trial_ends_at: string | null
  plan: string | null
}

interface ReminderCopy {
  subject: string
  intro: string
}

const REMINDER_COPY: Record<number, ReminderCopy> = {
  1: {
    subject: 'Faltam 2 dias para o fim do seu teste',
    intro: 'Seu período de teste do Agendou.SaaS termina em 2 dias.',
  },
  2: {
    subject: 'Faltam 24 horas para o fim do seu teste',
    intro: 'Seu período de teste do Agendou.SaaS termina em 24 horas.',
  },
  3: {
    subject: 'Seu teste termina hoje',
    intro: 'Seu período de teste do Agendou.SaaS termina hoje.',
  },
}

const DEFAULT_FROM = 'Agendou.SaaS <avisos@agendaresolvida.com.br>'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDate(value: string | null): string {
  if (!value) return 'em breve'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'em breve'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
}

function buildEmail(row: ReminderRow, copy: ReminderCopy): string {
  const name = escapeHtml(row.tenant_name ?? 'sua conta')
  const plan = escapeHtml(row.plan ?? 'contratado')
  const endsAt = escapeHtml(formatDate(row.trial_ends_at))
  const link = escapeHtml(`${SITE_URL}/planos`)

  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#f5f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
      <h1 style="font-size:22px;margin:0 0 16px">${escapeHtml(copy.subject)}</h1>
      <p>Olá, ${name}!</p>
      <p>${escapeHtml(copy.intro)} Escolha o plano <strong>${plan}</strong> para continuar agendando sem interrupções.</p>
      <p><strong>Fim do teste:</strong> ${endsAt}</p>
      <p style="margin:28px 0">
        <a href="${link}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;display:inline-block">Ver planos e assinar</a>
      </p>
      <p><strong>Atenção:</strong> não há carência. Assim que o teste terminar, o acesso à plataforma será bloqueado até que uma assinatura ativa seja confirmada.</p>
      <p><strong>Como funciona a cobrança:</strong> no cartão de crédito você tem 5 dias grátis antes da primeira cobrança. No Pix Automático, a cobrança é imediata — sem período de teste.</p>
      <p style="font-size:12px;color:#6b7280;margin-top:28px">Se você já assinou, ignore esta mensagem.</p>
    </div>
  </body>
</html>`
}

Deno.serve(async (req: Request): Promise<Response> => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405)
  }

  const configuredSecret = getEnv('CRON_SECRET')
  const providedSecret = req.headers.get('x-cron-secret') ?? ''
  if (
    !configuredSecret ||
    !providedSecret ||
    !timingSafeEqual(providedSecret, configuredSecret)
  ) {
    return jsonResponse({ error: 'Não autorizado' }, 401)
  }

  let expired = 0
  let reminders = 0
  let emailsSent = 0
  let skipped = 0

  try {
    const supabase = createServiceClient()

    const { data: expiredCount, error: expireError } = await supabase.rpc(
      'billing_expire_trials',
    )
    if (expireError) throw expireError
    expired = Number(expiredCount ?? 0) || 0

    const { data: dueRows, error: dueError } = await supabase.rpc(
      'billing_get_due_reminders',
    )
    if (dueError) throw dueError

    const rows = (dueRows ?? []) as ReminderRow[]
    reminders = rows.length

    const resendKey = getEnv('RESEND_API_KEY')
    const from = getEnv('BILLING_FROM_EMAIL') ?? DEFAULT_FROM
    if (!resendKey) {
      skipped = rows.length
    }

    for (const row of rows) {
      if (!resendKey) continue

      const copy = REMINDER_COPY[row.stage]
      if (!copy || !row.owner_email) {
        skipped += 1
        continue
      }

      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: [row.owner_email],
            subject: copy.subject,
            html: buildEmail(row, copy),
          }),
        })
        if (!response.ok) {
          throw new Error(`Resend retornou ${response.status}`)
        }
      } catch (error) {
        skipped += 1
        console.error(
          '[billing-cron] falha ao enviar e-mail',
          error instanceof Error ? error.message : 'erro desconhecido',
        )
        continue
      }

      const { error: markError } = await supabase.rpc(
        'billing_mark_reminder_sent',
        {
          p_tenant_id: row.tenant_id,
          p_stage: row.stage,
        },
      )
      if (markError) {
        skipped += 1
        console.error('[billing-cron] falha ao marcar lembrete como enviado')
        continue
      }
      emailsSent += 1
    }

    return jsonResponse({ expired, reminders, emailsSent, skipped })
  } catch (error) {
    console.error(
      '[billing-cron] falha na rotina',
      error instanceof Error ? error.message : 'erro desconhecido',
    )
    return jsonResponse({ error: 'Erro interno na rotina de faturamento' }, 500)
  }
})

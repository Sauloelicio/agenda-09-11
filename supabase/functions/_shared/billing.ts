// Helpers compartilhados entre as Edge Functions de faturamento.
// Nenhuma dependência local: supabase-js é carregado diretamente do esm.sh.
import {
  createClient,
  type SupabaseClient,
  type User,
} from 'https://esm.sh/@supabase/supabase-js@2'

export type Plan = 'basic' | 'pro' | 'enterprise'
export type BillingMethod = 'CARD' | 'PIX'

const ABACATE_API_URL = 'https://api.abacatepay.com/v2'
const DEFAULT_SITE_URL = 'https://agendaresolvida.com.br'

// Chave pública de verificação do webhook (192 bytes, fornecida pela Abacate Pay).
const WEBHOOK_SIGNATURE_KEY_BASE64 =
  't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9'

export function getEnv(name: string): string | undefined {
  const value = Deno.env.get(name)
  if (value === undefined || value.trim() === '') return undefined
  return value.trim()
}

function corsHeaders(corsOrigin?: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': corsOrigin ?? '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

export function jsonResponse(
  body: unknown,
  status = 200,
  corsOrigin?: string,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(corsOrigin),
    },
  })
}

export function handleOptions(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null
  return new Response(null, { status: 204, headers: corsHeaders() })
}

export function createServiceClient(): SupabaseClient {
  const url = getEnv('SUPABASE_URL')
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Configuração do Supabase incompleta')

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Cliente anônimo. Quando `accessToken` é informado, ele é usado em todas as
 * chamadas PostgREST — necessário para RPCs que dependem de auth.uid(). */
export function createAnonClient(accessToken?: string): SupabaseClient {
  const url = getEnv('SUPABASE_URL')
  const key = getEnv('SUPABASE_ANON_KEY') ?? getEnv('SUPABASE_PUBLISHABLE_KEY')
  if (!url || !key) throw new Error('Configuração do Supabase incompleta')

  return createClient(url, key, {
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

export function getBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match?.[1]?.trim() ?? null
}

export async function requireUser(
  req: Request,
  supabase: SupabaseClient,
): Promise<User> {
  const token = getBearerToken(req)
  if (!token) throw new Error('unauthenticated')

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) throw new Error('unauthenticated')

  return data.user
}

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error !== '') return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message !== '') return message
  }
  return fallback
}

/** Chama a API v2 da Abacate Pay. O envelope `{data, success, error}` é
 * validado e apenas `data` é devolvido. */
export async function abacateFetch<T = unknown>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: Record<string, unknown> } = {},
): Promise<T> {
  const apiKey = getEnv('ABACATE_API_KEY')
  if (!apiKey) throw new Error('Chave da Abacate Pay não configurada')

  const method = options.method ?? 'GET'
  const response = await fetch(`${ABACATE_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  })

  let envelope: {
    data?: T
    success?: boolean
    error?: unknown
  } | null = null
  try {
    envelope = await response.json()
  } catch {
    throw new Error('Resposta inválida da Abacate Pay')
  }

  if (!response.ok || envelope?.success !== true) {
    throw new Error(
      errorMessage(
        envelope?.error,
        `Falha na Abacate Pay (status ${response.status})`,
      ),
    )
  }

  return envelope.data as T
}

/** Comparação em tempo constante sobre os bytes UTF-8 das duas strings. */
export function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const bytesA = encoder.encode(a)
  const bytesB = encoder.encode(b)

  let diff = bytesA.length ^ bytesB.length
  const length = Math.max(bytesA.length, bytesB.length)
  for (let i = 0; i < length; i += 1) {
    diff |= (bytesA[i] ?? 0) ^ (bytesB[i] ?? 0)
  }
  return diff === 0
}

/** Valida secret do webhook e a assinatura HMAC-SHA256 do corpo BRUTO. */
export async function verifyWebhook(
  req: Request,
  rawBody: string,
): Promise<void> {
  const url = new URL(req.url)
  const providedSecret =
    req.headers.get('x-webhook-secret') ??
    url.searchParams.get('webhookSecret') ??
    ''
  const expectedSecret = getEnv('WEBHOOK_SECRET')

  if (!expectedSecret || !timingSafeEqual(providedSecret, expectedSecret)) {
    throw new Error('invalid_webhook_secret')
  }

  const providedSignature = req.headers.get('x-webhook-signature') ?? ''
  let keyBytes: Uint8Array
  try {
    const decoded = atob(WEBHOOK_SIGNATURE_KEY_BASE64)
    keyBytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0))
  } catch {
    throw new Error('invalid_webhook_signature')
  }

  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(rawBody),
  )
  const expectedSignature = btoa(
    String.fromCharCode(...new Uint8Array(signature)),
  )

  if (!timingSafeEqual(providedSignature, expectedSignature)) {
    throw new Error('invalid_webhook_signature')
  }
}

export const PLAN_PRODUCTS: Record<Plan, Record<BillingMethod, string>> = {
  basic: {
    CARD: getEnv('ABACATE_PRODUCT_BASIC_CARD') ?? '',
    PIX: getEnv('ABACATE_PRODUCT_BASIC_PIX') ?? '',
  },
  pro: {
    CARD: getEnv('ABACATE_PRODUCT_PRO_CARD') ?? '',
    PIX: getEnv('ABACATE_PRODUCT_PRO_PIX') ?? '',
  },
  enterprise: {
    CARD: getEnv('ABACATE_PRODUCT_ENTERPRISE_CARD') ?? '',
    PIX: getEnv('ABACATE_PRODUCT_ENTERPRISE_PIX') ?? '',
  },
}

export const PLAN_PRICES: Record<Plan, number> = {
  basic: 2990,
  pro: 5990,
  enterprise: 11990,
}

export const SITE_URL = getEnv('SITE_URL') ?? DEFAULT_SITE_URL

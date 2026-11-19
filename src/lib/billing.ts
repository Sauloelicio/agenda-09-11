import { supabase } from '@/integrations/supabase/client';

export type BillingPlan = 'basic' | 'pro' | 'enterprise';
export type BillingMethod = 'CARD' | 'PIX';

export interface BillingPlanInfo {
  id: BillingPlan;
  name: string;
  description: string;
  priceCents: number;
  highlights: string[];
}

/** Preços em centavos. O básico é R$ 29,90; os demais são derivados dele. */
export const BILLING_PLANS: BillingPlanInfo[] = [
  {
    id: 'basic',
    name: 'Básico / Solo',
    description: 'Para profissionais autônomos e agenda única.',
    priceCents: 2990,
    highlights: ['Agendamentos ilimitados', 'Link próprio personalizado', '1 profissional'],
  },
  {
    id: 'pro',
    name: 'Profissional / Salão',
    description: 'Para barbearias, estúdios e equipes pequenas.',
    priceCents: 5990,
    highlights: ['Tudo do Básico', 'Até 5 profissionais', 'Escolha de atendente'],
  },
  {
    id: 'enterprise',
    name: 'Academia & Turmas',
    description: 'Para academias, boxes e estúdios coletivos.',
    priceCents: 11990,
    highlights: ['Tudo do Profissional', 'Aulas com limite de vagas', 'Profissionais ilimitados'],
  },
];

export const TRIAL_DAYS = 5;

export function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(cents / 100);
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function maskTaxId(value: string): string {
  const digits = digitsOnly(value).slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function isValidCpf(value: string): boolean {
  if (value.length !== 11 || /^(\d)\1{10}$/.test(value)) return false;
  for (let size = 9; size < 11; size += 1) {
    let sum = 0;
    for (let i = 0; i < size; i += 1) sum += Number(value[i]) * (size + 1 - i);
    let check = (sum * 10) % 11;
    if (check === 10) check = 0;
    if (check !== Number(value[size])) return false;
  }
  return true;
}

function isValidCnpj(value: string): boolean {
  if (value.length !== 14 || /^(\d)\1{13}$/.test(value)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const calc = (weights: number[]) => {
    const sum = weights.reduce((acc, weight, i) => acc + Number(value[i]) * weight, 0);
    const check = sum % 11;
    return check < 2 ? 0 : 11 - check;
  };
  return calc(weights1) === Number(value[12]) && calc(weights2) === Number(value[13]);
}

export function isValidTaxId(value: string): boolean {
  const digits = digitsOnly(value);
  return digits.length === 11 ? isValidCpf(digits) : digits.length === 14 && isValidCnpj(digits);
}

export interface CheckoutResult {
  url: string;
  checkoutId?: string;
  customerId?: string;
  plan?: BillingPlan;
  method?: BillingMethod;
}

export async function startCheckout(params: {
  tenantId: string;
  plan: BillingPlan;
  method: BillingMethod;
  taxId?: string;
}): Promise<CheckoutResult> {
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: {
      tenantId: params.tenantId,
      plan: params.plan,
      method: params.method,
      taxId: params.taxId ? digitsOnly(params.taxId) : undefined,
    },
  });

  if (error) {
    let message = error.message;
    try {
      const withContext = error as Error & { context?: Response };
      if (withContext.context) {
        const body = await withContext.context.json() as { error?: string; message?: string };
        message = body.error ?? body.message ?? message;
      }
    } catch {
      // mantém a mensagem original se o corpo não for JSON
    }
    throw new Error(message || 'Não foi possível iniciar o pagamento.');
  }

  if (!data?.url) {
    throw new Error(data?.error ?? 'O pagamento não retornou um link válido. Tente novamente.');
  }

  return data as CheckoutResult;
}

# Faturamento com Abacate Pay

Implementação de assinaturas com trial de **5 dias no cartão**, **Pix Automático com cobrança imediata** e aviso antes do bloqueio. Preço base: **R$ 29,90/mês** (Pro R$ 59,90, Enterprise R$ 119,90).

## Fluxo

1. O cadastro cria o tenant com `trial_ends_at = now() + 5 dias`.
2. No fim do onboarding, o usuário é levado a `/planos?welcome=1` e pode:
   - **Cartão**: checkout com produto `trialDays: 5` — R$ 0 hoje, cartão salvo, primeira cobrança no 6º dia (`subscription.renewed`).
   - **Pix Automático**: autorização no banco e primeira mensalidade cobrada na hora (`subscription.completed`), sem trial.
   - **Explorar primeiro**: usa os 5 dias do banco e assina depois pelo painel.
3. O webhook `abacatepay-webhook` atualiza `tenants` e grava faturas em `invoices`, com idempotência pelo `id` do evento (`log_...`).
4. Aos 2 dias, 24 horas e no último dia, o cron envia e-mails via Resend e mostra banner no painel. Sem assinatura, o acesso é bloqueado no fim do trial (sem carência).

## 1. Aplicar a migration

No SQL Editor do Supabase, rode o conteúdo de `supabase/migrations/20261119120000_billing_abacatepay.sql`. A migration é idempotente e cria:

- colunas `billing_*` e `current_period_end` em `tenants`;
- `billing_events` (log do webhook) e `invoices`;
- RPCs `billing_apply_subscription_event`, `billing_expire_trials`, `billing_get_due_reminders`, `billing_mark_reminder_sent`, `billing_set_customer` (somente `service_role`).

## 2. Criar os 6 produtos na Abacate Pay

Use o **mesmo ambiente** (teste ou produção) da chave de API. `trialDays` apenas nos produtos de cartão:

| EnvVar | `externalId` sugerido | Preço | `cycle` | `trialDays` |
|---|---|---|---|---|
| `ABACATE_PRODUCT_BASIC_CARD` | `saas_basic_card` | 2990 | MONTHLY | 5 |
| `ABACATE_PRODUCT_BASIC_PIX` | `saas_basic_pix` | 2990 | MONTHLY | — |
| `ABACATE_PRODUCT_PRO_CARD` | `saas_pro_card` | 5990 | MONTHLY | 5 |
| `ABACATE_PRODUCT_PRO_PIX` | `saas_pro_pix` | 5990 | MONTHLY | — |
| `ABACATE_PRODUCT_ENTERPRISE_CARD` | `saas_enterprise_card` | 11990 | MONTHLY | 5 |
| `ABACATE_PRODUCT_ENTERPRISE_PIX` | `saas_enterprise_pix` | 11990 | MONTHLY | — |

Exemplo (repita para cada linha, trocando os valores):

```bash
curl -X POST https://api.abacatepay.com/v2/products/create \
  -H "Authorization: Bearer $ABACATE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "externalId": "saas_basic_card",
    "name": "Agendou.SaaS — Básico (cartão)",
    "description": "Assinatura mensal com 5 dias de teste",
    "price": 2990,
    "currency": "BRL",
    "cycle": "MONTHLY",
    "trialDays": 5
  }'
```

Guarde os `prod_...` retornados para as variáveis de ambiente.

## 3. Secrets das Edge Functions

```bash
supabase secrets set \
  ABACATE_API_KEY="..." \
  WEBHOOK_SECRET="$(openssl rand -hex 32)" \
  CRON_SECRET="$(openssl rand -hex 32)" \
  RESEND_API_KEY="re_..." \
  BILLING_FROM_EMAIL="Agendou.SaaS <avisos@agendaresolvida.com.br>" \
  SITE_URL="https://agendaresolvida.com.br" \
  ABACATE_PRODUCT_BASIC_CARD="prod_..." \
  ABACATE_PRODUCT_BASIC_PIX="prod_..." \
  ABACATE_PRODUCT_PRO_CARD="prod_..." \
  ABACATE_PRODUCT_PRO_PIX="prod_..." \
  ABACATE_PRODUCT_ENTERPRISE_CARD="prod_..." \
  ABACATE_PRODUCT_ENTERPRISE_PIX="prod_..."
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`/`SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já são injetados pelo Supabase, mas confirme no dashboard se algum estiver faltando. O `CRON_SECRET` precisa ser o **mesmo** configurado no Worker.

## 4. Deploy das functions

```bash
supabase functions deploy create-checkout
supabase functions deploy abacatepay-webhook --no-verify-jwt
supabase functions deploy billing-cron --no-verify-jwt
```

`create-checkout` **deve** verificar JWT (usa o login do dono). Webhook e cron não têm JWT do usuário: a autenticação é feita por secret/HMAC no código.

## 5. Webhook na Abacate Pay

Em **Desenvolvedor → Webhooks**:

- URL: `https://ftywkjwvtwnjmnmnfdln.supabase.co/functions/v1/abacatepay-webhook`
- Secret: o mesmo `WEBHOOK_SECRET`
- Eventos: `subscription.trial_started`, `subscription.completed`, `subscription.renewed`, `subscription.payment_failed`, `subscription.cancelled`

Não marque `checkout.completed` — ele é processado junto com os eventos de assinatura e causaria duplicidade.

## 6. E-mails (Resend)

1. Crie conta no Resend (free: 100 e-mails/dia).
2. Verifique o domínio `agendaresolvida.com.br` e adicione os registros DNS SPF/DKIM/DMARC indicados.
3. Configure `RESEND_API_KEY` e `BILLING_FROM_EMAIL`.

Sem `RESEND_API_KEY`, a rotina **não marca** os lembretes como enviados — eles são reenviados na próxima execução assim que a chave for configurada.

## 7. Cron no Cloudflare Worker

O `wrangler.jsonc` já contém `main: workers/billing-cron.ts` e o trigger `0 8,20 * * *` (08:00 e 20:00 UTC = 05:00 e 17:00 em Brasília). Configure os secrets e faça o deploy:

```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put CRON_SECRET   # idêntico ao da Edge Function
wrangler deploy
```

Atenção: esse deploy publica também os assets estáticos de `./dist`. Rode `npm run build` antes.

## 8. Testes

1. Use o **Modo Teste** da Abacate Pay e cartões de teste para aprovado/recusado.
2. Cadastre uma agenda, escolha cartão, confirme que chega `subscription.trial_started` e que `tenants.subscription_status = 'trial'` com `trial_ends_at` ≈ 5 dias.
3. Avance o `trial_ends_at` no banco para `now() + 2 dias` e rode o cron manualmente:

```bash
curl -X POST https://ftywkjwvtwnjmnmnfdln.supabase.co/functions/v1/billing-cron \
  -H "x-cron-secret: $CRON_SECRET"
```

4. Confira o e-mail, o banner no painel e o bloqueio em `/admin` quando o trial vence.
5. Teste o Pix Automático em modo teste e confirme `subscription.completed` → `subscription_status = 'active'` e fatura em `invoices`.

## 9. Antes de ir para produção

- [ ] Mudar a Abacate Pay do modo teste para produção e trocar a API key.
- [ ] `SITE_URL=https://agendaresolvida.com.br` e `completionUrl`/`returnUrl` apontando para o domínio final.
- [ ] Atualizar Supabase Auth → Site URL `https://agendaresolvida.com.br` e redirect `https://agendaresolvida.com.br/**`.
- [ ] Adicionar `www.agendaresolvida.com.br` ao Worker e ativar **Always Use HTTPS** na Cloudflare.
- [ ] **Revogar o token Cloudflare** usado na migração e apagar `/home/saulo/.cache/verify/.cf_token`.
- [ ] **Rotacionar a service role key do Supabase** que foi exposta em contexto anterior e atualizar todos os secrets.
- [ ] Apagar o projeto na Vercel somente após confirmar login e redirecionamentos no domínio final.

## Arquivos envolvidos

- `supabase/migrations/20261119120000_billing_abacatepay.sql`
- `supabase/functions/_shared/billing.ts`
- `supabase/functions/create-checkout/index.ts`
- `supabase/functions/abacatepay-webhook/index.ts`
- `supabase/functions/billing-cron/index.ts`
- `workers/billing-cron.ts`
- `src/lib/billing.ts`, `src/components/BillingDialog.tsx`, `src/components/BillingBanner.tsx`
- `src/pages/PlansPage.tsx`, `src/pages/AdminDashboard.tsx`, `src/pages/Onboarding.tsx`, `src/pages/LandingPage.tsx`

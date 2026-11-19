import React, { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CalendarClock, Check, CreditCard, Loader2, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BillingDialog } from '@/components/BillingDialog';
import { useSaas } from '@/contexts/SaasContext';
import { useAuth } from '@/contexts/AuthContext';
import { BILLING_PLANS, TRIAL_DAYS, formatBRL, type BillingMethod, type BillingPlan } from '@/lib/billing';

const PlansPage: React.FC = () => {
  const { user, membershipsLoading } = useAuth();
  const { tenants, workspaceLoading, workspaceError } = useSaas();
  const [searchParams] = useSearchParams();
  const [selected, setSelected] = useState<{ plan: BillingPlan; method: BillingMethod } | null>(null);
  const tenant = tenants.find((item) => user?.ownedTenantIds.includes(item.id)) ?? tenants[0];

  if (membershipsLoading || workspaceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!tenant) return <Navigate to="/admin" replace />;

  const welcome = searchParams.get('welcome') === '1';
  const status = tenant.subscription_status ?? 'trial';
  const blocked = status === 'expired' || status === 'past_due' || status === 'canceled';
  const active = status === 'active';

  const openCheckout = (plan: BillingPlan, method: BillingMethod) => setSelected({ plan, method });

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            {blocked ? <AlertCircle className="h-6 w-6" /> : <CalendarClock className="h-6 w-6" />}
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {welcome
              ? 'Sua agenda está pronta 🎉'
              : blocked
                ? 'Seu período de teste terminou'
                : active
                  ? 'Gerencie sua assinatura'
                  : 'Escolha seu plano'}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            {workspaceError
              ? 'Não foi possível consultar os dados da sua agenda.'
              : blocked
                ? `O acesso de ${tenant.name} está suspenso. Seus dados continuam salvos — assine para voltar a receber agendamentos.`
                : active
                  ? `Assinatura de ${tenant.name} ativa. Você pode trocar de plano a qualquer momento.`
                  : `Bem-vindo, ${tenant.name}! Teste grátis de ${TRIAL_DAYS} dias no cartão, sem carência e sem bloqueio surpresa: avisamos antes por e-mail e no painel.`}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {BILLING_PLANS.map((plan) => (
            <Card key={plan.id} className="flex flex-col justify-between">
              <CardHeader>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold">{formatBRL(plan.priceCents)}</span>
                  <span className="text-xs text-muted-foreground">/mês</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {plan.highlights.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" /> {item}
                    </li>
                  ))}
                </ul>
                <div className="grid gap-2 pt-2 sm:grid-cols-2">
                  <Button size="sm" className="h-9 text-xs" onClick={() => openCheckout(plan.id, 'CARD')}>
                    <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Cartão
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs"
                    onClick={() => openCheckout(plan.id, 'PIX')}
                  >
                    <QrCode className="mr-1.5 h-3.5 w-3.5" /> Pix
                  </Button>
                </div>
                <p className="text-center text-[11px] text-muted-foreground">
                  {plan.id === 'basic' ? 'Cartão: 5 dias grátis · Pix: cobrança imediata' : 'Cobrança mensal recorrente'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col items-center gap-2">
          {welcome && (
            <Button variant="ghost" asChild>
              <Link to="/admin">Explorar minha agenda primeiro</Link>
            </Button>
          )}
          {!welcome && (
            <Button variant="outline" asChild>
              <Link to="/admin">Voltar ao painel</Link>
            </Button>
          )}
          <p className="max-w-lg text-center text-xs text-muted-foreground">
            Pagamento processado pela Abacate Pay. O trial com cartão cobra R$ 0 na contratação e inicia as
            cobranças automáticas no 6º dia. No Pix Automático, a primeira mensalidade é debitada na autorização.
          </p>
        </div>
      </div>

      {selected && (
        <BillingDialog
          open
          onOpenChange={(open) => !open && setSelected(null)}
          tenantId={tenant.id}
          tenantName={tenant.name}
          defaultPlan={selected.plan}
          defaultMethod={selected.method}
          welcome={welcome}
        />
      )}
    </main>
  );
};

export default PlansPage;

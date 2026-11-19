import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BillingDialog } from '@/components/BillingDialog';
import { TRIAL_DAYS, type BillingPlan } from '@/lib/billing';
import type { Tenant } from '@/types/saas';

interface BillingBannerProps {
  tenant: Tenant;
  demoMode?: boolean;
  defaultPlan?: BillingPlan;
}

export const BillingBanner: React.FC<BillingBannerProps> = ({ tenant, demoMode = false, defaultPlan }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPlan, setDialogPlan] = useState<BillingPlan | undefined>(defaultPlan);

  if (demoMode) return null;

  const status = tenant.subscription_status ?? 'trial';
  const isActive = status === 'active';
  const isBlocked = status === 'expired' || status === 'past_due' || status === 'canceled';
  const daysRemaining = Math.max(
    0,
    Math.ceil((Date.parse(tenant.trial_ends_at) - Date.now()) / (24 * 60 * 60 * 1000))
  );
  const urgent = daysRemaining <= 2;
  const renewalDate = tenant.current_period_end
    ? new Date(tenant.current_period_end).toLocaleDateString('pt-BR')
    : null;

  if (isActive) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="font-semibold">Assinatura ativa</span>
          {renewalDate && <span className="text-muted-foreground">· Próxima cobrança em {renewalDate}</span>}
        </p>
        <Button size="sm" variant="ghost" asChild className="h-8 text-xs">
          <Link to="/planos">Gerenciar plano <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
        </Button>
      </div>
    );
  }

  const openDialog = (plan?: BillingPlan) => {
    setDialogPlan(plan);
    setDialogOpen(true);
  };

  if (isBlocked) {
    return (
      <>
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-bold text-foreground">Sua agenda está suspensa</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Regularize a assinatura para voltar a receber agendamentos. Seus dados estão preservados.
              </p>
            </div>
          </div>
          <Button size="sm" className="h-9 text-xs" onClick={() => openDialog()}>
            <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Regularizar agora
          </Button>
        </div>
        <BillingDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          tenantId={tenant.id}
          tenantName={tenant.name}
          defaultPlan={dialogPlan}
        />
      </>
    );
  }

  return (
    <>
      <div
        className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
          urgent ? 'border-amber-500/40 bg-amber-500/10' : 'border-primary/20 bg-primary/5'
        }`}
      >
        <div className="flex items-start gap-2.5">
          <Clock3 className={`mt-0.5 h-5 w-5 shrink-0 ${urgent ? 'text-amber-600' : 'text-primary'}`} />
          <div>
            <p className="text-sm font-bold text-foreground">
              {daysRemaining > 1
                ? `Seu teste grátis termina em ${daysRemaining} dias`
                : daysRemaining === 1
                  ? 'Seu teste grátis termina amanhã'
                  : 'Seu teste grátis termina hoje'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {urgent
                ? 'Avisamos por e-mail. Sem assinatura, o acesso será bloqueado ao fim do teste.'
                : `Assine com cartão para ter ${TRIAL_DAYS} dias grátis e cobrança automática depois. Ou use Pix Automático com cobrança imediata.`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" asChild className="h-9 text-xs">
            <Link to="/planos">Ver planos</Link>
          </Button>
          <Button size="sm" className="h-9 text-xs" onClick={() => openDialog()}>
            <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Assinar com cartão
          </Button>
        </div>
      </div>
      <BillingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tenantId={tenant.id}
        tenantName={tenant.name}
        defaultPlan={dialogPlan}
      />
    </>
  );
};

export default BillingBanner;

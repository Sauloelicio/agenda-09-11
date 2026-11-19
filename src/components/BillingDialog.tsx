import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Loader2, QrCode, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  BILLING_PLANS,
  TRIAL_DAYS,
  formatBRL,
  isValidTaxId,
  maskTaxId,
  startCheckout,
  type BillingMethod,
  type BillingPlan,
} from '@/lib/billing';

interface BillingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantName?: string;
  defaultPlan?: BillingPlan;
  defaultMethod?: BillingMethod;
  /** Primeiro acesso após criar a agenda: oferece a opção de explorar antes de assinar. */
  welcome?: boolean;
}

export const BillingDialog: React.FC<BillingDialogProps> = ({
  open,
  onOpenChange,
  tenantId,
  tenantName,
  defaultPlan = 'basic',
  defaultMethod = 'CARD',
  welcome = false,
}) => {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<BillingPlan>(defaultPlan);
  const [method, setMethod] = useState<BillingMethod>(defaultMethod);
  const [taxId, setTaxId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlan(defaultPlan);
    setMethod(defaultMethod);
  }, [open, defaultPlan, defaultMethod]);

  const handleConfirm = async () => {
    const cleanTaxId = taxId.replace(/\D/g, '');
    if (cleanTaxId && !isValidTaxId(cleanTaxId)) {
      toast.error('CPF ou CNPJ inválido. Confira os números digitados.');
      return;
    }

    setLoading(true);
    try {
      const result = await startCheckout({
        tenantId,
        plan,
        method,
        taxId: cleanTaxId || undefined,
      });
      window.location.assign(result.url);
    } catch (error) {
      console.error('Checkout failed:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível abrir o pagamento. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{welcome ? 'Escolha como continuar' : 'Contratar plano'}</DialogTitle>
          <DialogDescription>
            {welcome
              ? `A agenda de ${tenantName ?? 'seu negócio'} está pronta. Capture o meio de pagamento agora ou explore primeiro.`
              : `O pagamento é processado pela Abacate Pay. Seu trial termina em ${TRIAL_DAYS} dias após a contratação com cartão.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Plano</Label>
            <RadioGroup value={plan} onValueChange={(value) => setPlan(value as BillingPlan)} className="grid gap-2">
              {BILLING_PLANS.map((item) => (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    plan === item.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <RadioGroupItem value={item.id} className="mt-1" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold">{item.name}</span>
                      <span className="text-sm font-bold text-primary">{formatBRL(item.priceCents)}/mês</span>
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <RadioGroup value={method} onValueChange={(value) => setMethod(value as BillingMethod)} className="grid gap-2 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  method === 'CARD' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}
              >
                <RadioGroupItem value="CARD" className="mt-1" />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <CreditCard className="h-4 w-4" /> Cartão
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {TRIAL_DAYS} dias grátis. O cartão fica salvo e a cobrança começa no 6º dia.
                  </span>
                </span>
              </label>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  method === 'PIX' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}
              >
                <RadioGroupItem value="PIX" className="mt-1" />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <QrCode className="h-4 w-4" /> Pix Automático
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Débito automático no banco. A primeira mensalidade é cobrada na hora, sem trial.
                  </span>
                </span>
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="billing-tax-id">CPF ou CNPJ (opcional)</Label>
            <Input
              id="billing-tax-id"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              value={taxId}
              onChange={(event) => setTaxId(maskTaxId(event.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Se deixar em branco, o checkout da Abacate Pay solicita o documento.
            </p>
          </div>

          <p className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            Você será redirecionado para o checkout seguro da Abacate Pay. Avisamos por e-mail e no painel
            antes de qualquer bloqueio.
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {welcome && (
            <Button
              type="button"
              variant="ghost"
              className="w-full sm:w-auto"
              disabled={loading}
              onClick={() => {
                onOpenChange(false);
                navigate('/admin', { replace: true });
              }}
            >
              Explorar primeiro
            </Button>
          )}
          <Button type="button" className="w-full sm:w-auto" disabled={loading} onClick={handleConfirm}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continuar para o pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BillingDialog;

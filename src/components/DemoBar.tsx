import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Sparkles, 
  Scissors, 
  Dumbbell, 
  PlusCircle, 
  Home, 
  ChevronUp, 
  ChevronDown, 
  Zap,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSaas } from '@/contexts/SaasContext';
import { useAuth } from '@/contexts/AuthContext';

/**
 * DemoBar — barra flutuante apenas para navegação entre as páginas PÚBLICAS de demo.
 * Não exibe botão de acesso ao painel admin (área privada do proprietário).
 */
export const DemoBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenants, setCurrentTenant } = useSaas();
  const { isAuthenticated } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  const isDemoBooking = tenants.some(
    (tenant) =>
      location.pathname === `/${tenant.slug}` ||
      location.pathname === `/agendar/${tenant.slug}`,
  );
  if (!isDemoBooking) return null;
  if (isDismissed) return null;

  const goToTenant = (slug: string) => {
    const found = tenants.find((t) => t.slug === slug);
    if (found) {
      setCurrentTenant(found);
    }
    navigate(`/${slug}`);
  };

  return (
    <div className="fixed bottom-3 right-3 sm:right-6 z-50 transition-all duration-200">
      <div className="bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-2.5 max-w-sm sm:max-w-md text-foreground">
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold tracking-tight flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              Demo — Explore os Nichos
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setIsDismissed(true)}
              title="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="pt-2 space-y-2 border-t border-border/50 mt-2">
            <p className="text-[10px] text-muted-foreground leading-tight px-1">
              Veja como clientes fazem o agendamento em cada tipo de negócio:
            </p>

            <div className="grid grid-cols-3 gap-1.5 text-xs">
              <Button
                size="sm"
                variant={location.pathname === '/laryssa-nails' ? 'default' : 'outline'}
                className="h-8 text-[11px] px-2 font-medium"
                onClick={() => goToTenant('laryssa-nails')}
              >
                <Sparkles className="h-3 w-3 mr-1 text-pink-500" />
                Manicure
              </Button>

              <Button
                size="sm"
                variant={location.pathname === '/barbearia-vintage' ? 'default' : 'outline'}
                className="h-8 text-[11px] px-2 font-medium"
                onClick={() => goToTenant('barbearia-vintage')}
              >
                <Scissors className="h-3 w-3 mr-1 text-amber-500" />
                Barbearia
              </Button>

              <Button
                size="sm"
                variant={location.pathname === '/iron-gym' ? 'default' : 'outline'}
                className="h-8 text-[11px] px-2 font-medium"
                onClick={() => goToTenant('iron-gym')}
              >
                <Dumbbell className="h-3 w-3 mr-1 text-blue-500" />
                Academia
              </Button>
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <Button
                size="sm"
                variant={location.pathname === '/onboarding' ? 'secondary' : 'ghost'}
                className="flex-1 h-7 text-[11px]"
                onClick={() => navigate('/onboarding')}
              >
                <PlusCircle className="h-3 w-3 mr-1 text-emerald-500" />
                Criar meu negócio
              </Button>

              <Button
                size="sm"
                variant={location.pathname === '/' ? 'secondary' : 'ghost'}
                className="h-7 px-2 text-[11px]"
                onClick={() => navigate('/')}
              >
                <Home className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default DemoBar;

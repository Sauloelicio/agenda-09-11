import { Link, Navigate } from 'react-router-dom';
import { CalendarClock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSaas } from '@/contexts/SaasContext';
import { useAuth } from '@/contexts/AuthContext';

const PlansPage = () => {
  const { user, membershipsLoading } = useAuth();
  const { tenants, workspaceLoading, workspaceError } = useSaas();
  const tenant = tenants.find((item) => user?.ownedTenantIds.includes(item.id));

  if (membershipsLoading || workspaceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!tenant) return <Navigate to="/admin" replace />;

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarClock className="h-6 w-6" />
          </div>
          <CardTitle>Seu período de teste terminou</CardTitle>
          <CardDescription>
            {workspaceError
              ? 'Não foi possível consultar os dados da sua agenda.'
              : `O acesso de ${tenant.name} está suspenso até a contratação de um plano.`}
            {' '}Os dados da sua agenda continuam salvos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Para continuar usando os recursos de agendamento, escolha um plano. A contratação e o processamento
            de pagamentos ainda não estão disponíveis nesta etapa.
          </p>
          <Button disabled className="w-full">Contratação de planos em breve</Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">Voltar à página inicial</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
};

export default PlansPage;

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSaas } from '@/contexts/SaasContext';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Link } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /**
   * Se fornecido, além de checar autenticação verifica se o usuário
   * é dono do tenantId. Se não for, mostra tela de acesso negado.
   */
  requireOwnerOf?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireOwnerOf,
}) => {
  const { isAuthenticated, isLoading, isOwnerOf } = useAuth();
  const location = useLocation();

  // Enquanto verifica sessão
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Não autenticado → redirect para login mantendo a rota de retorno
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Autenticado mas não é dono do tenant solicitado
  if (requireOwnerOf && !isOwnerOf(requireOwnerOf)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-2xl">
          <CardHeader className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 border border-destructive/20 mx-auto mb-2">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar o painel deste estabelecimento.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground text-center">
              Apenas o proprietário cadastrado pode gerenciar esse negócio.
              Se você é o dono, verifique se fez login com o e-mail correto.
            </p>
            <Button asChild className="w-full">
              <Link to="/admin">Ir para o meu painel</Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link to="/">Página inicial</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

/**
 * Componente específico para proteger /admin:
 * verifica autenticação E se o usuário é dono do currentTenant.
 */
export const AdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, membershipsLoading, authError, reloadOwnedTenants, user } = useAuth();
  const { currentTenant, tenants, workspaceLoading, workspaceError } = useSaas();
  const location = useLocation();

  if (isLoading || membershipsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-2xl">
          <CardHeader>
            <CardTitle>Não foi possível carregar sua conta</CardTitle>
            <CardDescription>{authError}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={() => { void reloadOwnedTenants(); }}>Tentar novamente</Button>
            <Button variant="outline" asChild><Link to="/">Página inicial</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (workspaceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full shadow-2xl">
          <CardHeader>
            <CardTitle>Não foi possível carregar sua agenda</CardTitle>
            <CardDescription>{workspaceError}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
            <Button variant="outline" asChild><Link to="/">Página inicial</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ownedTenant = tenants.find((tenant) => user?.ownedTenantIds.includes(tenant.id));
  if (!ownedTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full text-center p-6">
          <CardTitle className="mb-2">Sua conta ainda não tem uma agenda</CardTitle>
          <p className="text-sm text-muted-foreground mb-4">Crie seu negócio para começar o teste gratuito de cinco dias.</p>
          <Button asChild><Link to="/onboarding">Criar minha agenda</Link></Button>
        </Card>
      </div>
    );
  }

  const selectedTenant = currentTenant && user?.ownedTenantIds.includes(currentTenant.id)
    ? currentTenant
    : ownedTenant;

  if (
    selectedTenant.subscription_status === 'expired'
    || selectedTenant.subscription_status === 'past_due'
    || selectedTenant.subscription_status === 'canceled'
    || (selectedTenant.subscription_status === 'trial'
      && Date.parse(selectedTenant.trial_ends_at) <= Date.now())
  ) {
    return <Navigate to="/planos" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

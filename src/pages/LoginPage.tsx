import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  ArrowLeft,
  Calendar,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type Mode = 'login' | 'register' | 'recovery' | 'update-password';

interface LoginPageProps {
  /** Se definido, após login redireciona para cá (default: /admin) */
  redirectTo?: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({ redirectTo }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    login,
    register,
    requestPasswordReset,
    updatePassword,
    isPasswordRecovery,
    isAuthenticated,
    isLoading: isAuthLoading,
  } = useAuth();

  // Permite passar ?mode=register na URL
  const searchParams = new URLSearchParams(location.search);
  const initialMode: Mode = searchParams.get('mode') === 'register'
    ? 'register'
    : searchParams.get('mode') === 'recovery' ? 'recovery' : 'login';

  const [mode, setMode] = useState<Mode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);

  React.useEffect(() => {
    if (isPasswordRecovery) setMode('update-password');
  }, [isPasswordRecovery]);

  const locationState = location.state as { from?: string } | null;
  const destination = redirectTo || locationState?.from
    || (sessionStorage.getItem('onboarding_draft_v1') ? '/onboarding?complete=1' : '/admin');

  React.useEffect(() => {
    if (!isAuthLoading && isAuthenticated && !isPasswordRecovery && initialMode !== 'recovery') {
      navigate(destination, { replace: true });
    }
  }, [destination, initialMode, isAuthLoading, isAuthenticated, isPasswordRecovery, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'recovery') {
        const result = await requestPasswordReset(email);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        setRecoverySent(true);
        toast.success('Se o e-mail estiver cadastrado, enviaremos um link para redefinir sua senha.');
        return;
      }

      if (mode === 'update-password') {
        if (password !== confirmPassword) {
          toast.error('As senhas não coincidem.');
          return;
        }
        const result = await updatePassword(password);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success('Senha atualizada com sucesso.');
        navigate('/admin', { replace: true });
        return;
      }

      if (mode === 'register') {
        if (!name.trim()) {
          toast.error('Informe seu nome completo.');
          return;
        }
        if (password !== confirmPassword) {
          toast.error('As senhas não coincidem.');
          return;
        }

        const result = await register({ email, password, name });
        if (!result.success) {
          toast.error(result.error);
          return;
        }

        if (result.requiresEmailConfirmation) {
          toast.success('Conta criada. Confirme seu e-mail para entrar e concluir a configuração da agenda.');
          navigate('/login', { replace: true });
          return;
        }

        toast.success('Conta criada! Bem-vindo(a).');
        navigate(destination, { replace: true });
      } else {
        const result = await login({ email, password });
        if (!result.success) {
          toast.error(result.error);
          return;
        }

        toast.success('Bem-vindo(a) de volta!');
        navigate(destination, { replace: true });
      }
    } catch (error) {
      console.error('Authentication action failed:', error);
      toast.error('Não foi possível concluir a operação. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex flex-col justify-center py-10 px-4">
      <div className="max-w-md w-full mx-auto">
        {/* Back */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Página Inicial
            </Link>
          </Button>

          <Badge variant="outline" className="px-3 py-1 font-semibold text-xs border-primary/30 text-primary flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Área Segura
          </Badge>
        </div>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-3">
            <Calendar className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">AgendaFácil</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {mode === 'login'
              ? 'Entre na sua conta para gerenciar sua agenda'
              : mode === 'register' ? 'Crie sua conta e comece a usar em minutos'
                : mode === 'recovery' ? 'Receba um link seguro para redefinir sua senha'
                  : 'Escolha uma nova senha para sua conta'}
          </p>
        </div>

        <Card className="shadow-2xl border-border/80">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">
              {mode === 'login' ? 'Entrar na Conta'
                : mode === 'register' ? 'Criar Conta Grátis'
                  : mode === 'recovery' ? 'Recuperar Senha' : 'Definir Nova Senha'}
            </CardTitle>
            <CardDescription>
              {mode === 'login'
                ? 'Acesse seu painel de administração'
                : mode === 'register' ? '5 dias grátis, sem cartão de crédito'
                  : mode === 'recovery' ? 'Enviaremos instruções para seu e-mail cadastrado'
                    : 'Sua nova senha deve ter pelo menos 8 caracteres'}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name (register only) */}
              {mode === 'register' && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Seu nome completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Maria Silva"
                      className="pl-9"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="voce@exemplo.com"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus={mode === 'login'}
                  />
                </div>
              </div>

              {/* Password */}
              {mode !== 'recovery' && (
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={mode === 'register' || mode === 'update-password' ? 'Mínimo 8 caracteres' : '••••••••'}
                    className="pl-9 pr-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              )}

              {/* Confirm Password (register only) */}
              {(mode === 'register' || mode === 'update-password') && (
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirmar senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Repita a senha"
                      className="pl-9"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full h-11 font-semibold text-sm" disabled={isLoading || (mode === 'recovery' && recoverySent)}>
                {isLoading
                  ? 'Aguarde...'
                  : mode === 'login' ? 'Entrar no Painel'
                    : mode === 'register' ? 'Criar Minha Conta Grátis'
                      : mode === 'recovery' ? recoverySent ? 'E-mail enviado' : 'Enviar link de recuperação'
                        : 'Salvar Nova Senha'}
              </Button>
            </form>

            {/* Toggle mode */}
            {mode === 'login' && (
              <div className="mt-3 text-center">
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => { setMode('recovery'); setRecoverySent(false); }}
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            <div className="mt-5 text-center text-sm text-muted-foreground">
              {mode === 'login' ? (
                <>
                  Não tem conta?{' '}
                  <button
                    type="button"
                    className="text-primary font-semibold hover:underline"
                    onClick={() => setMode('register')}
                  >
                    Criar conta grátis
                  </button>
                </>
              ) : mode === 'register' ? (
                <>
                  Já tem conta?{' '}
                  <button
                    type="button"
                    className="text-primary font-semibold hover:underline"
                    onClick={() => setMode('login')}
                  >
                    Fazer login
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="text-primary font-semibold hover:underline"
                  onClick={() => setMode('login')}
                >
                  Voltar para entrar
                </button>
              )}
            </div>

            {/* Security notice */}
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/50 p-3">
              <ShieldCheck className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Sua conta é <strong>privada e segura</strong>. Apenas você tem acesso ao seu painel,
                agendamentos e faturamento. Nenhum dado seu é exibido para clientes.
              </p>
            </div>

            {/* Onboarding link */}
            {mode === 'login' && (
              <div className="mt-3 text-center">
                <Link
                  to="/onboarding"
                  className="text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  Cadastrar um novo estabelecimento
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;

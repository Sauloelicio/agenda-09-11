import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  Smartphone, 
  Clock, 
  Users, 
  TrendingUp, 
  ShieldCheck, 
  Scissors, 
  Dumbbell, 
  HeartHandshake,
  Star,
  Zap,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSaas } from '@/contexts/SaasContext';

export const LandingPage = () => {
  const navigate = useNavigate();
  const { tenants, setCurrentTenant } = useSaas();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const handleTestDemo = (slug: string) => {
    const tenant = tenants.find((t) => t.slug === slug);
    if (tenant) {
      setCurrentTenant(tenant);
      navigate(`/${slug}`);
    }
  };

  const handleGoAdmin = (slug: string) => {
    navigate(`/demo/admin/${slug}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20">
              <Calendar className="h-5 w-5" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-primary bg-clip-text text-transparent">
              Agendou<span className="text-primary font-black">.SaaS</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#solucoes" className="hover:text-foreground transition-colors">Soluções</a>
            <a href="#demos" className="hover:text-foreground transition-colors">Demos ao Vivo</a>
            <a href="#recursos" className="hover:text-foreground transition-colors">Recursos</a>
            <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/login">Entrar na minha conta</Link>
            </Button>
            <Button size="sm" className="shadow-md shadow-primary/25 font-semibold" asChild>
              <Link to="/onboarding">
                Criar Conta Grátis (5 dias)
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28 border-b border-border/40">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
        
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <Badge variant="outline" className="mb-6 px-3.5 py-1.5 border-primary/40 bg-primary/5 text-primary gap-1.5 text-xs font-semibold rounded-full shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            SaaS de Agendamento Inteligente & Multi-Nicho
          </Badge>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.15] mb-6">
            Automatize seus agendamentos e lote sua agenda pelo{' '}
            <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-primary bg-clip-text text-transparent">
              WhatsApp
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 font-normal leading-relaxed">
            Feito para <strong>manicures, barbearias, academias com turmas e prestadores de serviços</strong>. 
            Crie sua conta em 2 minutos, envie seu link personalizado e receba agendamentos no automático 24 horas por dia.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto mb-10">
            <Button size="lg" className="w-full sm:w-auto h-12 px-8 font-semibold text-base shadow-lg shadow-primary/25" asChild>
              <Link to="/onboarding">
                Começar Teste Grátis (5 dias)
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-6 text-base" asChild>
              <a href="#demos">Ver Demonstrações</a>
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Sem cartão de crédito
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> 5 dias grátis de acesso total
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Ativação imediata no WhatsApp
            </span>
          </div>
        </div>
      </section>

      {/* Live Demos Section */}
      <section id="demos" className="py-16 md:py-24 bg-muted/30 border-b border-border/40">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Badge variant="secondary" className="mb-3">Demonstração Interativa</Badge>
            <h2 className="text-3xl font-bold tracking-tight">Experimente como seu cliente ou como administrador</h2>
            <p className="text-muted-foreground mt-2">
              Veja como a experiência se adapta perfeitamente a cada segmento de mercado com dados reais pré-carregados.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Manicure Demo */}
            <Card className="hover:border-pink-500/50 transition-all hover:shadow-lg flex flex-col justify-between border-border/80">
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-pink-500/10 text-pink-500 flex items-center justify-center mb-3">
                  <Sparkles className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="w-fit text-pink-600 border-pink-200 bg-pink-50 text-[10px] uppercase font-bold tracking-wider">
                  Nicho: Estética & Unhas
                </Badge>
                <CardTitle className="text-xl mt-2">Laryssa Resende Nails</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Atendimento individual (1:1), escolha de serviços detalhados (gel, fibra, postiça) e cálculo automático de duração.
                </p>
              </CardHeader>
              <CardContent className="space-y-2 pt-2 border-t border-border/50">
                <Button 
                  onClick={() => handleTestDemo('laryssa-nails')}
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white font-medium"
                >
                  Agendar como Cliente
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
                <Button 
                  onClick={() => handleGoAdmin('laryssa-nails')}
                  variant="outline" 
                  className="w-full text-xs"
                >
                  Ver Painel da Dona
                </Button>
              </CardContent>
            </Card>

            {/* Barber Demo */}
            <Card className="hover:border-amber-500/50 transition-all hover:shadow-lg flex flex-col justify-between border-border/80">
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
                  <Scissors className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="w-fit text-amber-600 border-amber-200 bg-amber-50 text-[10px] uppercase font-bold tracking-wider">
                  Nicho: Barbearia & Salão
                </Badge>
                <CardTitle className="text-xl mt-2">Barbearia Vintage Club</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Múltiplos profissionais simultâneos (Carlos e Rodrigo), seleção de barbeiro favorito e combos de serviços.
                </p>
              </CardHeader>
              <CardContent className="space-y-2 pt-2 border-t border-border/50">
                <Button 
                  onClick={() => handleTestDemo('barbearia-vintage')}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium"
                >
                  Agendar como Cliente
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
                <Button 
                  onClick={() => handleGoAdmin('barbearia-vintage')}
                  variant="outline" 
                  className="w-full text-xs"
                >
                  Ver Painel da Barbearia
                </Button>
              </CardContent>
            </Card>

            {/* Gym Demo */}
            <Card className="hover:border-blue-500/50 transition-all hover:shadow-lg flex flex-col justify-between border-border/80">
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3">
                  <Dumbbell className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="w-fit text-blue-600 border-blue-200 bg-blue-50 text-[10px] uppercase font-bold tracking-wider">
                  Nicho: Academia & Cross
                </Badge>
                <CardTitle className="text-xl mt-2">Iron Gym & Cross</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Turmas coletivas com <strong>vagas limitadas</strong> (Spinning 15 vagas, Cross 18 vagas), instrutores e controle de lotação.
                </p>
              </CardHeader>
              <CardContent className="space-y-2 pt-2 border-t border-border/50">
                <Button 
                  onClick={() => handleTestDemo('iron-gym')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  Reservar Vaga na Turma
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
                <Button 
                  onClick={() => handleGoAdmin('iron-gym')}
                  variant="outline" 
                  className="w-full text-xs"
                >
                  Ver Painel da Academia
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How it solves problems */}
      <section id="recursos" className="py-16 md:py-24 border-b border-border/40">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight">Tudo o que você precisa para gerenciar seus clientes</h2>
            <p className="text-muted-foreground mt-2">
              Elimine a perda de tempo respondendo mensagens no WhatsApp o dia inteiro para achar um horário vago.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="flex flex-col gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Smartphone className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">Link Próprio no WhatsApp</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Coloque o link na sua bio do Instagram e no WhatsApp Business. Seu cliente agenda sozinho em menos de 30 segundos.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">Zero Conflito de Horários</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Horários ocupados desaparecem automaticamente. Intervalos de almoço e dias de folga são calculados na hora.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">Equipes ou Aulas Coletivas</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Controle múltiplos profissionais na mesma loja ou configure limites de alunos por horário para academias e estúdios.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">Relatório de Faturamento</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Acompanhe o faturamento previsto do mês, quantidade de atendimentos e serviços mais lucrativos da sua operação.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">Regra Anti-Cancelamento</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Trava automática de 2 horas para cancelamento ou remarcação pelo próprio cliente, evitando que você fique no prejuízo.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">Pronto em 2 Minutos</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Nosso onboarding em 3 passos configura seus horários, regras e serviços sem precisar de conhecimento técnico.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planos" className="py-16 md:py-24 bg-muted/20 border-b border-border/40">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <Badge variant="secondary" className="mb-3">Preços Transparentes</Badge>
            <h2 className="text-3xl font-bold tracking-tight">Planos simples para acelerar seu negócio</h2>
            <p className="text-muted-foreground mt-2">
              Comece com 5 dias gratuitos sem cartão. Escolha o plano depois de ver os agendamentos entrando.
            </p>

            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-3 mt-6">
              <span className={`text-sm ${billingCycle === 'monthly' ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                Mensal
              </span>
              <button
                type="button"
                onClick={() => setBillingCycle(c => c === 'monthly' ? 'yearly' : 'monthly')}
                className="w-12 h-6 rounded-full bg-primary p-1 relative transition-colors focus:outline-none"
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
              <span className={`text-sm flex items-center gap-1.5 ${billingCycle === 'yearly' ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                Anual <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 border-none font-bold">2 meses grátis</Badge>
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-stretch">
            {/* Basic Plan */}
            <Card className="flex flex-col justify-between border-border/80 hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-xl">Básico / Solo</CardTitle>
                <p className="text-xs text-muted-foreground">Para profissionais autônomos e manicures.</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-foreground">
                    R$ {billingCycle === 'monthly' ? '49' : '39'}
                  </span>
                  <span className="text-xs text-muted-foreground">/mês</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Agendamentos ilimitados</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> 1 Profissional / Agenda única</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Link próprio personalizado</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Confirmação no WhatsApp</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Painel de Faturamento</li>
                </ul>
                <Button className="w-full mt-6" variant="outline" asChild>
                  <Link to="/onboarding">Criar Conta Grátis (5 dias)</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Pro Plan (Highlighted) */}
            <Card className="flex flex-col justify-between border-primary shadow-xl shadow-primary/10 relative overflow-hidden bg-card">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                Mais Escolhido
              </div>
              <CardHeader>
                <CardTitle className="text-xl">Profissional / Salão</CardTitle>
                <p className="text-xs text-muted-foreground">Para barbearias, estúdios e equipes.</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-foreground">
                    R$ {billingCycle === 'monthly' ? '89' : '72'}
                  </span>
                  <span className="text-xs text-muted-foreground">/mês</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Tudo do plano Básico</li>
                  <li className="flex items-center gap-2 font-medium text-foreground"><Check className="h-4 w-4 text-emerald-500" /> Até 5 profissionais simultâneos</li>
                  <li className="flex items-center gap-2 font-medium text-foreground"><Check className="h-4 w-4 text-emerald-500" /> Escolha de atendente pelo cliente</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Relatórios de comissão por atendente</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Suporte prioritário via WhatsApp</li>
                </ul>
                <Button className="w-full mt-6 shadow-md shadow-primary/25 font-bold" asChild>
                  <Link to="/onboarding">Criar Conta Grátis (5 dias)</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Gym / Enterprise Plan */}
            <Card className="flex flex-col justify-between border-border/80 hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-xl">Academia & Turmas</CardTitle>
                <p className="text-xs text-muted-foreground">Para academias, box de cross e estúdios coletivos.</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-foreground">
                    R$ {billingCycle === 'monthly' ? '149' : '119'}
                  </span>
                  <span className="text-xs text-muted-foreground">/mês</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Tudo do plano Profissional</li>
                  <li className="flex items-center gap-2 font-medium text-foreground"><Check className="h-4 w-4 text-emerald-500" /> Aulas coletivas com limite de vagas</li>
                  <li className="flex items-center gap-2 font-medium text-foreground"><Check className="h-4 w-4 text-emerald-500" /> Profissionais e instrutores ilimitados</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Controle de lista de presença</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Gerente de conta exclusivo</li>
                </ul>
                <Button className="w-full mt-6" variant="outline" asChild>
                  <Link to="/onboarding">Criar Conta Grátis (5 dias)</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 border-t border-border/40 text-center text-xs text-muted-foreground">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">Agendou.SaaS</span> - Plataforma Multitenant de Agendamentos
          </div>
          <p>© 2026 Todos os direitos reservados. Feito para alta conversão.</p>
        </div>
      </footer>
    </div>
  );
};
export default LandingPage;

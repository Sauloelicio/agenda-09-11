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
  Zap,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/login">Entrar na minha conta</Link>
            </Button>
            <Button size="sm" className="h-10 px-3 sm:px-4 shadow-md shadow-primary/25 font-semibold" asChild>
              <Link to="/onboarding">
                <span className="sm:hidden">Começar</span>
                <span className="hidden sm:inline">Criar conta grátis</span>
                <ArrowRight className="ml-1.5 hidden h-4 w-4 sm:block" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-primary/5 via-background to-background pt-8 pb-10 sm:pt-14 sm:pb-14 md:pt-20 md:pb-20">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
        
        <div className="container mx-auto grid max-w-6xl items-center gap-8 px-4 md:grid-cols-2 md:gap-12">
          <div className="text-left">
            <Badge variant="outline" className="mb-4 gap-1.5 rounded-full border-primary/40 bg-primary/5 px-3 py-1 text-[11px] font-semibold text-primary shadow-sm sm:text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              Agenda online para o seu negócio
            </Badge>

            <h1 className="mb-4 max-w-xl text-3xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Agenda em ordem.
              <span className="mt-1 block bg-gradient-to-r from-amber-500 via-primary to-emerald-600 bg-clip-text text-transparent">
                Mais tempo livre.
              </span>
            </h1>

            <p className="mb-6 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              Seu cliente escolhe o horário online. Você cuida do negócio.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button size="lg" className="h-12 w-full px-6 text-base font-semibold shadow-lg shadow-primary/25 sm:w-auto" asChild>
                <Link to="/onboarding">
                  Criar agenda grátis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <a href="#demos" className="self-center py-2 text-sm font-semibold text-primary underline-offset-4 hover:underline sm:self-auto sm:px-3">
                Ver demonstração
              </a>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> 5 dias grátis
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Sem cartão de crédito
              </span>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Beleza <span className="px-1 text-primary">·</span> Saúde <span className="px-1 text-primary">·</span> Pets <span className="px-1 text-primary">·</span> Serviços
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-md md:max-w-lg">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-primary/10 blur-2xl" />
            <Card className="overflow-hidden rounded-3xl border-border/70 bg-card/95 shadow-xl shadow-foreground/5">
              <CardHeader className="flex-row items-center justify-between space-y-0 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Agenda de hoje</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">Tudo em ordem, de um só lugar</p>
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-full bg-emerald-500/10 text-emerald-700">
                  8 horários
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
                <div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-3">
                  <span className="w-12 text-sm font-bold tabular-nums text-foreground">09:00</span>
                  <span className="h-9 w-1 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">Corte e finalização</p>
                    <p className="text-xs text-muted-foreground">Com Ana • 45 min</p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-border/70 p-3">
                  <span className="w-12 text-sm font-bold tabular-nums text-foreground">10:30</span>
                  <span className="h-9 w-1 rounded-full bg-amber-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">Próximo horário</p>
                    <p className="text-xs text-muted-foreground">Cliente confirmado</p>
                  </div>
                  <Clock className="h-5 w-5 shrink-0 text-muted-foreground" />
                </div>
                <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                  <span className="text-muted-foreground">Seu link pronto para compartilhar</span>
                  <span className="font-semibold text-primary">agendou.app/voce</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Live Demos Section */}
      <section id="demos" className="py-16 md:py-24 bg-muted/30 border-b border-border/40">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
            <Badge variant="secondary" className="mb-3">Demonstração interativa</Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Veja como funciona</h2>
            <p className="hidden sm:block text-muted-foreground mt-2">
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
                <p className="hidden sm:block text-xs text-muted-foreground">
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
                <p className="hidden sm:block text-xs text-muted-foreground">
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
                <p className="hidden sm:block text-xs text-muted-foreground">
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
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Mais tempo para cuidar do seu negócio</h2>
            <p className="hidden sm:block text-muted-foreground mt-2">
              Elimine a perda de tempo respondendo mensagens no WhatsApp o dia inteiro para achar um horário vago.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-5 sm:gap-8 lg:grid-cols-3">
            <div className="flex flex-col gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Smartphone className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">Link Próprio no WhatsApp</h3>
              <p className="hidden sm:block text-sm text-muted-foreground leading-relaxed">
                Coloque o link na sua bio do Instagram e no WhatsApp Business. Seu cliente agenda sozinho em menos de 30 segundos.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">Zero Conflito de Horários</h3>
              <p className="hidden sm:block text-sm text-muted-foreground leading-relaxed">
                Horários ocupados desaparecem automaticamente. Intervalos de almoço e dias de folga são calculados na hora.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">Equipes ou Aulas Coletivas</h3>
              <p className="hidden sm:block text-sm text-muted-foreground leading-relaxed">
                Controle múltiplos profissionais na mesma loja ou configure limites de alunos por horário para academias e estúdios.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">Relatório de Faturamento</h3>
              <p className="hidden sm:block text-sm text-muted-foreground leading-relaxed">
                Acompanhe o faturamento previsto do mês, quantidade de atendimentos e serviços mais lucrativos da sua operação.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">Regra Anti-Cancelamento</h3>
              <p className="hidden sm:block text-sm text-muted-foreground leading-relaxed">
                Trava automática de 2 horas para cancelamento ou remarcação pelo próprio cliente, evitando que você fique no prejuízo.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">Pronto em 2 Minutos</h3>
              <p className="hidden sm:block text-sm text-muted-foreground leading-relaxed">
                Nosso onboarding em 3 passos configura seus horários, regras e serviços sem precisar de conhecimento técnico.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planos" className="py-16 md:py-24 bg-muted/20 border-b border-border/40">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
            <Badge variant="secondary" className="mb-3">Preços transparentes</Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Um plano para cada momento</h2>
            <p className="hidden sm:block text-muted-foreground mt-2">
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

import React, { useRef, useState } from 'react';
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
  const [activeDemoStep, setActiveDemoStep] = useState(0);
  const [activeDemoCard, setActiveDemoCard] = useState(0);
  const demoTrackRef = useRef<HTMLDivElement>(null);

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

  const selectDemoCard = (index: number) => {
    const track = demoTrackRef.current;
    const card = track?.querySelectorAll<HTMLElement>('[data-demo-card]').item(index);
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    setActiveDemoCard(index);
  };

  const updateActiveDemoCard = (track: HTMLDivElement) => {
    const cards = Array.from(track.querySelectorAll<HTMLElement>('[data-demo-card]'));
    const trackCenter = track.getBoundingClientRect().left + track.clientWidth / 2;
    const nearestCard = cards.reduce((nearest, card, index) => {
      const cardCenter = card.getBoundingClientRect().left + card.offsetWidth / 2;
      const nearestCenter = cards[nearest].getBoundingClientRect().left + cards[nearest].offsetWidth / 2;
      return Math.abs(cardCenter - trackCenter) < Math.abs(nearestCenter - trackCenter) ? index : nearest;
    }, 0);
    setActiveDemoCard((current) => current === nearestCard ? current : nearestCard);
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
            <a href="#demos" className="hover:text-foreground transition-colors">Demonstrações</a>
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
      <section className="relative overflow-hidden border-b border-[#3b352b] bg-[#171613] pb-10 pt-8 text-white sm:pb-14 sm:pt-14 md:pb-20 md:pt-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_75%_20%,rgba(197,165,114,0.2),transparent_50%)]" />
        <div className="pointer-events-none absolute -bottom-36 -left-32 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        
        <div className="container relative mx-auto grid max-w-6xl items-center gap-8 px-4 md:grid-cols-2 md:gap-12">
          <div className="text-left">
            <Badge variant="outline" className="mb-4 gap-1.5 rounded-full border-[#c5a572]/40 bg-[#c5a572]/10 px-3 py-1 text-[11px] font-semibold text-[#e2c89c] sm:text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              Agendamento simples, do seu jeito
            </Badge>

            <h1 className="mb-4 max-w-xl text-4xl font-extrabold leading-[1.04] tracking-tight text-white sm:text-5xl md:text-6xl">
              Seu cliente agenda.
              <span className="mt-1 block text-[#d8bd90]">
                Você ganha tempo.
              </span>
            </h1>

            <p className="mb-6 max-w-lg text-base leading-relaxed text-white/70 sm:text-lg">
              Uma página de agendamento com a identidade do seu negócio. Fácil de compartilhar, simples de usar.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button size="lg" className="h-12 w-full bg-[#c5a572] px-6 text-base font-semibold text-[#211e1b] shadow-lg shadow-black/20 hover:bg-[#d4b989] sm:w-auto" asChild>
                <Link to="/onboarding">
                  Criar minha agenda grátis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <a href="#demos" className="self-center py-2 text-sm font-semibold text-[#e2c89c] underline-offset-4 hover:underline sm:self-auto sm:px-3">
                Explorar demonstrações
              </a>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-white/60">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[#d8bd90]" /> 5 dias grátis
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[#d8bd90]" /> Sem cartão de crédito
              </span>
            </div>
            <p className="mt-4 text-xs text-white/50">
              Para beleza, barbearias, academias e prestadores de serviços
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-sm md:max-w-md">
            <div className="absolute -inset-5 -z-10 rounded-[2rem] bg-[#c5a572]/10 blur-2xl" />
            <div className="rounded-[2rem] border border-white/15 bg-[#0f0e0c] p-3 shadow-2xl shadow-black/40">
              <div className="overflow-hidden rounded-[1.5rem] bg-[#f7f5f0] text-[#211e1b]">
                <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#211e1b] text-[#d8bd90]">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold">Studio Aurora</span>
                  </div>
                  <span className="rounded-full bg-[#211e1b]/5 px-2.5 py-1 text-[10px] font-semibold text-[#625b4f]">AGENDA ONLINE</span>
                </div>

                <div className="min-h-[255px] px-4 py-5 sm:min-h-[275px] sm:px-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9b8968]">EXPERIÊNCIA DO CLIENTE</p>
                      <p className="mt-1 text-base font-bold">
                        {activeDemoStep === 0 && 'O que você precisa?'}
                        {activeDemoStep === 1 && 'Escolha seu horário'}
                        {activeDemoStep === 2 && 'Agendamento registrado'}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-[#817b71]">{activeDemoStep + 1} / 3</span>
                  </div>

                  {activeDemoStep === 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-xl border border-[#c5a572] bg-white p-3 shadow-sm">
                        <div>
                          <p className="text-sm font-semibold">Corte e finalização</p>
                          <p className="mt-0.5 text-xs text-[#817b71]">45 min · a partir de R$ 60</p>
                        </div>
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#211e1b] text-[#e2c89c]">
                          <Check className="h-3 w-3" />
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-black/5 bg-white p-3">
                        <div>
                          <p className="text-sm font-semibold">Tratamento especial</p>
                          <p className="mt-0.5 text-xs text-[#817b71]">60 min · consulte o valor</p>
                        </div>
                        <span className="h-5 w-5 rounded-full border border-black/15" />
                      </div>
                    </div>
                  )}

                  {activeDemoStep === 1 && (
                    <div className="rounded-2xl border border-black/5 bg-white p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-bold">Selecione um dia</span>
                        <Calendar className="h-4 w-4 text-[#9b8968]" />
                      </div>
                      <div className="mb-3 grid grid-cols-4 gap-2 text-center">
                        {['Hoje', 'Amanhã', 'Qui', 'Sex'].map((day, index) => (
                          <span key={day} className={`rounded-lg py-2 text-[10px] font-semibold ${index === 1 ? 'bg-[#211e1b] text-[#e2c89c]' : 'bg-[#f5f3ee] text-[#625b4f]'}`}>
                            {day}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {['09:30', '10:15', '11:00', '14:30'].map((time, index) => (
                          <span key={time} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${index === 1 ? 'border-[#211e1b] bg-[#211e1b] text-[#e2c89c]' : 'border-black/10 text-[#625b4f]'}`}>
                            {time}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeDemoStep === 2 && (
                    <div className="flex min-h-[150px] flex-col items-center justify-center rounded-2xl border border-[#c5a572]/30 bg-white px-4 py-5 text-center">
                      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#e9f2e9] text-emerald-700">
                        <CheckCircle2 className="h-6 w-6" />
                      </span>
                      <p className="text-sm font-bold">Horário reservado!</p>
                      <p className="mt-1 max-w-[230px] text-xs leading-relaxed text-[#817b71]">
                        O horário fica registrado na agenda. O cliente pode seguir pelo WhatsApp.
                      </p>
                    </div>
                  )}
                </div>

                <div className="border-t border-black/5 bg-white px-4 py-3">
                  <div className="mb-3 flex gap-1.5" aria-label="Etapas da demonstração">
                    {[0, 1, 2].map((step) => (
                      <button
                        key={step}
                        type="button"
                        aria-label={`Mostrar etapa ${step + 1}`}
                        aria-pressed={activeDemoStep === step}
                        onClick={() => setActiveDemoStep(step)}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${activeDemoStep === step ? 'bg-[#b99a67]' : 'bg-[#e6e2d9]'}`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#817b71]">
                      {activeDemoStep === 0 ? '1. Serviço' : activeDemoStep === 1 ? '2. Horário' : '3. Reserva'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveDemoStep((step) => (step + 1) % 3)}
                      className="rounded-lg bg-[#211e1b] px-3 py-2 text-xs font-semibold text-[#e2c89c] transition-colors hover:bg-[#3b352b]"
                    >
                      {activeDemoStep === 2 ? 'Ver novamente' : 'Próximo passo'}
                      <ArrowRight className="ml-1.5 inline h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-white/45">Uma prévia demonstrativa da experiência de agendamento</p>
          </div>
        </div>
      </section>

      {/* Live Demos Section */}
      <section id="demos" className="py-16 md:py-24 bg-muted/30 border-b border-border/40">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
            <Badge variant="secondary" className="mb-3">Escolha uma experiência</Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Veja o Agendou no seu segmento</h2>
            <p className="hidden sm:block text-muted-foreground mt-2">
              Explore demonstrações interativas com dados fictícios e descubra como cada agenda pode funcionar.
            </p>
          </div>

          <div
            ref={demoTrackRef}
            onScroll={(event) => updateActiveDemoCard(event.currentTarget)}
            aria-label="Demonstrações de agendamento"
            className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:p-0"
          >
            {/* Manicure Demo */}
            <Card data-demo-card className="w-[min(88vw,22rem)] shrink-0 snap-center border-border/80 transition-all hover:border-pink-500/50 hover:shadow-lg md:w-auto">
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
            <Card data-demo-card className="w-[min(88vw,22rem)] shrink-0 snap-center border-border/80 transition-all hover:border-amber-500/50 hover:shadow-lg md:w-auto">
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
            <Card data-demo-card className="w-[min(88vw,22rem)] shrink-0 snap-center border-border/80 transition-all hover:border-blue-500/50 hover:shadow-lg md:w-auto">
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
          <div className="mt-3 flex items-center justify-center gap-3 md:hidden">
            <div className="flex items-center gap-2" aria-label="Paginação das demonstrações">
              {[0, 1, 2].map((index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Ver demonstração ${index + 1} de 3`}
                  aria-current={activeDemoCard === index ? 'true' : undefined}
                  onClick={() => selectDemoCard(index)}
                  className={`h-2.5 rounded-full transition-all ${activeDemoCard === index ? 'w-7 bg-primary' : 'w-2.5 bg-border'}`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">Deslize para explorar</span>
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

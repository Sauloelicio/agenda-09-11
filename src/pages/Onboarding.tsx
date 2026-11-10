import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle, 
  Building2, 
  Clock, 
  Scissors, 
  Dumbbell, 
  Briefcase, 
  Check, 
  Calendar,
  DollarSign,
  Paintbrush,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { SegmentType, SiteStyle } from '@/types/saas';
import { toast } from 'sonner';

const SEGMENTS = [
  {
    id: 'salon' as SegmentType,
    title: 'Manicure & Estética',
    desc: 'Atendimento individual (1:1), unhas, cílios, sobrancelhas e tratamentos de beleza.',
    icon: Sparkles,
    badge: '1 cliente por horário',
    defaultService: 'Aplicação Fibra de Vidro',
    defaultPrice: 120,
    defaultDuration: 60,
    defaultCapacity: 1,
  },
  {
    id: 'barbershop' as SegmentType,
    title: 'Barbearia & Salão',
    desc: 'Cortes, barbas, combos com múltiplos barbeiros e escolha de profissional favorito.',
    icon: Scissors,
    badge: 'Múltiplos profissionais',
    defaultService: 'Corte Degradê & Barba',
    defaultPrice: 70,
    defaultDuration: 45,
    defaultCapacity: 1,
  },
  {
    id: 'gym' as SegmentType,
    title: 'Academia & Aulas Coletivas',
    desc: 'Spinning, Treino Funcional, Crossfit, Pilates com turmas e limite de vagas por horário.',
    icon: Dumbbell,
    badge: 'Turmas com N vagas',
    defaultService: 'Aula de Treino Funcional',
    defaultPrice: 35,
    defaultDuration: 50,
    defaultCapacity: 15,
  },
  {
    id: 'services' as SegmentType,
    title: 'Outros Serviços / Consultoria',
    desc: 'Tatuagem, clínicas, massoterapia, psicólogos e prestadores autônomos.',
    icon: Briefcase,
    badge: 'Personalizado',
    defaultService: 'Sessão de Atendimento',
    defaultPrice: 100,
    defaultDuration: 60,
    defaultCapacity: 1,
  },
];

const WEEKDAYS = [
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
  { id: 6, label: 'Sáb' },
  { id: 0, label: 'Dom' },
];

const COLOR_PALETTES = [
  { name: 'Grafite', color: '#292723', mood: 'Sofisticado e atemporal', soft: '#f1efeb' },
  { name: 'Champanhe', color: '#a77b3f', mood: 'Elegante e acolhedor', soft: '#f7f1e7' },
  { name: 'Terracota', color: '#b85c45', mood: 'Autoral e caloroso', soft: '#f8eeeb' },
  { name: 'Oliva', color: '#62734d', mood: 'Natural e equilibrado', soft: '#f0f2ec' },
  { name: 'Azul petróleo', color: '#286675', mood: 'Seguro e contemporâneo', soft: '#edf3f4' },
  { name: 'Vinho', color: '#773f56', mood: 'Marcante e elegante', soft: '#f5eef1' },
];

const SITE_STYLES: { id: SiteStyle; title: string; description: string; radius: string }[] = [
  { id: 'clean', title: 'Minimalista', description: 'Leve, organizado e direto ao ponto.', radius: '0.5rem' },
  { id: 'warm', title: 'Acolhedor', description: 'Formas suaves e um clima mais próximo.', radius: '1.25rem' },
  { id: 'bold', title: 'Marcante', description: 'Mais contraste para destacar sua marca.', radius: '0.75rem' },
];

export const Onboarding = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, reloadOwnedTenants } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isCreating, setIsCreating] = useState(false);
  const draftCompletionStarted = useRef(false);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [slug, setSlug] = useState('');
  const [segment, setSegment] = useState<SegmentType>('salon');
  const [primaryColor, setPrimaryColor] = useState(COLOR_PALETTES[2].color);
  const [siteStyle, setSiteStyle] = useState<SiteStyle>('warm');
  const selectedPalette = COLOR_PALETTES.find((palette) => palette.color === primaryColor) ?? COLOR_PALETTES[0];
  const selectedSiteStyle = SITE_STYLES.find((style) => style.id === siteStyle) ?? SITE_STYLES[1];
  const progressPercent = Math.round((step / 4) * 100);

  const getColorForeground = (color: string) => {
    const channels = color.match(/[\da-f]{2}/gi)?.map((channel) => parseInt(channel, 16) / 255) ?? [];
    if (channels.length !== 3) return '#ffffff';
    const luminance = channels.reduce((sum, channel, index) => {
      const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      return sum + linear * [0.2126, 0.7152, 0.0722][index];
    }, 0);
    return luminance > 0.4 ? '#211e1b' : '#ffffff';
  };

  // Business Hours
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('19:00');
  const [openWeekdays, setOpenWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6]);

  // First Service
  const [serviceName, setServiceName] = useState('Aplicação de Fibra de Vidro');
  const [servicePrice, setServicePrice] = useState<number>(120);
  const [serviceDuration, setServiceDuration] = useState<number>(60);
  const [serviceCapacity, setServiceCapacity] = useState<number>(1);

  // Auto-slug generator
  const handleNameChange = (val: string) => {
    setName(val);
    const generatedSlug = val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    setSlug(generatedSlug);
  };

  const isSlugTaken = false;

  const handleSelectSegment = (selected: SegmentType) => {
    setSegment(selected);
    const suggestedColor = ({
      salon: '#b85c45',
      barbershop: '#292723',
      gym: '#286675',
      clinic: '#62734d',
      services: '#773f56',
    } satisfies Record<SegmentType, string>)[selected];
    setPrimaryColor(suggestedColor);
    const template = SEGMENTS.find((s) => s.id === selected);
    if (template) {
      setServiceName(template.defaultService);
      setServicePrice(template.defaultPrice);
      setServiceDuration(template.defaultDuration);
      setServiceCapacity(template.defaultCapacity);
      if (selected === 'gym') {
        setOpenTime('06:00');
        setCloseTime('22:00');
      }
    }
  };

  const handleToggleWeekday = (dayId: number) => {
    setOpenWeekdays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId].sort()
    );
  };

  const submitTenant = useCallback(async (data: {
    name: string;
    phone: string;
    slug: string;
    segment: SegmentType;
    primary_color: string;
    site_style: SiteStyle;
    open_time: string;
    close_time: string;
    open_weekdays: number[];
    first_service_name: string;
    first_service_price: number;
    first_service_duration: number;
    first_service_capacity: number;
  }) => {
    setIsCreating(true);
    try {
      const { error } = await supabase.rpc('create_tenant_with_owner', {
        _name: data.name,
        _phone: data.phone,
        _slug: data.slug,
        _segment: data.segment,
        _primary_color: data.primary_color,
        _site_style: data.site_style,
        _open_time: data.open_time,
        _close_time: data.close_time,
        _open_weekdays: data.open_weekdays,
        _lunch_start: data.segment === 'gym' ? null : '12:00',
        _lunch_end: data.segment === 'gym' ? null : '13:30',
        _service_name: data.first_service_name,
        _service_price: data.first_service_price,
        _service_duration: data.first_service_duration,
        _service_capacity: data.first_service_capacity,
      });

      if (error) {
        toast.error(error.message.includes('slug_already_exists')
          ? 'Este link já está em uso. Escolha outro.'
          : 'Não foi possível criar sua agenda. Confira os dados e tente novamente.');
        console.error('Tenant creation failed:', error.message);
        return;
      }

      sessionStorage.removeItem('onboarding_draft_v1');
      await reloadOwnedTenants();
      toast.success('Agenda criada! Seu teste de cinco dias começou.');
      navigate('/admin', { replace: true });
    } catch (error) {
      console.error('Tenant creation failed:', error);
      toast.error('Não foi possível criar sua agenda. Tente novamente.');
    } finally {
      setIsCreating(false);
    }
  }, [navigate, reloadOwnedTenants]);

  useEffect(() => {
    if (!isAuthenticated
      || new URLSearchParams(location.search).get('complete') !== '1'
      || draftCompletionStarted.current) return;

    const savedDraft = sessionStorage.getItem('onboarding_draft_v1');
    if (!savedDraft) {
      toast.error('Não encontramos os dados do negócio. Preencha o cadastro novamente.');
      navigate('/onboarding', { replace: true });
      return;
    }

    try {
      const draft = JSON.parse(savedDraft) as Parameters<typeof submitTenant>[0];
      draftCompletionStarted.current = true;
      void submitTenant(draft);
    } catch (error) {
      console.error('Unable to restore onboarding draft:', error);
      sessionStorage.removeItem('onboarding_draft_v1');
      toast.error('Os dados do cadastro não puderam ser recuperados. Preencha novamente.');
      navigate('/onboarding', { replace: true });
    }
  }, [isAuthenticated, location.search, navigate, submitTenant]);

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !slug.trim()) {
      toast.error('Preencha os dados do seu negócio');
      setStep(1);
      return;
    }

    if (!serviceName.trim()) {
      toast.error('Digite o nome do seu primeiro serviço');
      return;
    }

    const draft = {
      name: name.trim(),
      phone: phone.trim(),
      slug: slug.trim(),
      segment,
      primary_color: primaryColor,
      site_style: siteStyle,
      open_time: openTime,
      close_time: closeTime,
      open_weekdays: openWeekdays,
      first_service_name: serviceName.trim(),
      first_service_price: Number(servicePrice) || 0,
      first_service_duration: Number(serviceDuration) || 60,
      first_service_capacity: Number(serviceCapacity) || 1,
    };

    if (!isAuthenticated) {
      sessionStorage.setItem('onboarding_draft_v1', JSON.stringify(draft));
      navigate('/login?mode=register', { state: { from: '/onboarding?complete=1' } });
      return;
    }

    await submitTenant(draft);
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-br from-background via-muted/20 to-background px-3 py-6 sm:px-4 sm:py-10">
      <div className="max-w-xl w-full mx-auto">
        {/* Back to Home & Step indicator */}
        <div className="mb-4 flex items-center justify-between sm:mb-6">
          <Button variant="ghost" size="sm" asChild className="-ml-2 min-h-10 text-muted-foreground hover:text-foreground">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Página Inicial
            </Link>
          </Button>

          <Badge variant="outline" className="border-primary/30 px-3 py-1 font-semibold text-xs text-primary">
            Passo {step} de 4 <span className="ml-1 text-muted-foreground">· {progressPercent}%</span>
          </Badge>
        </div>

        {/* Progress Bar */}
        <div
          className="mb-5 h-2 w-full overflow-hidden rounded-full bg-muted sm:mb-8"
          role="progressbar"
          aria-label="Progresso da configuração"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <div 
            className="bg-primary h-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <Card className="border-border/80 shadow-2xl">
          <CardHeader className="pb-3 text-center sm:pb-4">
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner sm:h-12 sm:w-12">
              {step === 1 && <Building2 className="h-6 w-6" />}
              {step === 2 && <Scissors className="h-6 w-6" />}
              {step === 3 && <Paintbrush className="h-6 w-6" />}
              {step === 4 && <Clock className="h-6 w-6" />}
            </div>

            <CardTitle className="text-xl font-bold sm:text-2xl">
              {step === 1 && 'Dados do seu Negócio'}
              {step === 2 && 'Qual é o seu Segmento?'}
              {step === 3 && 'A cara do seu site'}
              {step === 4 && 'Horários & Primeiro Serviço'}
            </CardTitle>
            <CardDescription className="text-sm">
              {step === 1 && 'Identifique sua empresa e escolha seu link exclusivo de agendamento.'}
              {step === 2 && 'Personalizamos as regras (individual ou turma) de acordo com seu ramo.'}
              {step === 3 && 'Escolha a identidade visual e veja como sua página de agendamento vai ficar.'}
              {step === 4 && 'Defina seu expediente básico e o primeiro serviço que seus clientes poderão agendar.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-4 pt-2 sm:px-6">
            {/* STEP 1: Name, Phone, Slug */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="biz-name" className="text-sm font-semibold">Nome da Empresa / Profissional</Label>
                  <Input
                    id="biz-name"
                    placeholder="Ex: Studio Bella Donna, Barbearia 079, Cross Fit Box"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="biz-phone" className="text-sm font-semibold">Telefone WhatsApp</Label>
                  <Input
                    id="biz-phone"
                    placeholder="(11) 98765-4321"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    É para este número que os clientes enviarão os comprovantes de agendamento.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="biz-slug" className="text-sm font-semibold">Seu Link de Agendamento</Label>
                  <div className="flex items-center rounded-md border border-input bg-muted/40 px-3 focus-within:ring-2 focus-within:ring-primary">
                    <span className="text-xs text-muted-foreground font-mono">agendou.app/</span>
                    <input
                      id="biz-slug"
                      className="w-full bg-transparent border-0 px-1 py-2 text-sm font-semibold text-primary focus:outline-none"
                      placeholder="seu-link"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    />
                  </div>
                  {isSlugTaken && (
                    <p className="text-xs text-destructive font-medium">
                      Este link já está em uso por outro assinante. Escolha outro.
                    </p>
                  )}
                </div>

                <Button 
                  className="w-full mt-4 h-11 text-base font-semibold"
                  disabled={!name.trim() || !phone.trim() || !slug.trim() || isSlugTaken}
                  onClick={() => setStep(2)}
                >
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}

            {/* STEP 2: Segment selection */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid gap-3">
                  {SEGMENTS.map((item) => {
                    const isSelected = segment === item.id;
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectSegment(item.id)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border hover:border-border/80 hover:bg-muted/40'
                        }`}
                      >
                        <div className={`p-2.5 rounded-lg shrink-0 ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-semibold text-sm text-foreground">{item.title}</h4>
                            <Badge variant="secondary" className="text-[10px] font-medium">{item.badge}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-snug">{item.desc}</p>
                        </div>
                        {isSelected && (
                          <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                  </Button>
                  <Button className="flex-1 h-11 font-semibold" onClick={() => setStep(3)}>
                    Avançar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: Website appearance */}
            {step === 3 && (
              <div className="flex flex-col gap-4 sm:gap-5">
                <section className="order-1 space-y-3">
                  <div>
                    <Label className="text-sm font-semibold">Escolha a identidade do seu negócio</Label>
                    <p className="mt-1 text-xs text-muted-foreground">A cor escolhida destaca botões e detalhes da sua página.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-3 sm:gap-2" role="group" aria-label="Paletas de cores">
                    {COLOR_PALETTES.map((palette) => {
                      const selected = primaryColor === palette.color;
                      return (
                        <button
                          key={palette.color}
                          type="button"
                          onClick={() => setPrimaryColor(palette.color)}
                          aria-pressed={selected}
                          className={`flex min-h-[66px] flex-col items-center justify-center gap-1 rounded-xl border p-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-h-[58px] sm:flex-row sm:gap-2 sm:p-2.5 sm:text-left ${
                            selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'
                          }`}
                        >
                          <span
                            className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-black/10 shadow-sm sm:h-9 sm:w-9"
                            style={{ backgroundColor: palette.color }}
                            aria-hidden="true"
                          >
                            <span className="absolute inset-x-0 bottom-0 h-2/5 border-t border-white/30" style={{ backgroundColor: palette.soft }} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[10px] font-semibold sm:text-xs">{palette.name}</span>
                            <span className="hidden truncate text-[10px] text-muted-foreground sm:block">{palette.mood}</span>
                          </span>
                          {selected && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="order-3 space-y-3 sm:order-2">
                  <div>
                    <Label className="text-sm font-semibold">Qual estilo combina com você?</Label>
                    <p className="text-xs text-muted-foreground mt-1">Isso define o formato dos elementos e o clima da página.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    {SITE_STYLES.map((style) => {
                      const selected = siteStyle === style.id;
                      return (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setSiteStyle(style.id)}
                          aria-pressed={selected}
                          className={`min-h-[66px] rounded-xl border p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-h-[82px] sm:p-3 ${
                            selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'
                          }`}
                        >
                          <span className="mb-1.5 flex h-6 items-center gap-1 sm:mb-2 sm:h-9 sm:gap-1.5">
                            <span className="h-5 w-5 shrink-0 border-2 sm:h-7 sm:w-7" style={{ backgroundColor: primaryColor, borderColor: primaryColor, borderRadius: style.radius }} />
                            <span className="h-4 flex-1 border sm:h-5" style={{ borderColor: primaryColor, borderRadius: style.radius }} />
                          </span>
                          <span className="block truncate text-[10px] font-semibold sm:text-xs">{style.title}</span>
                          <span className="mt-1 hidden text-[10px] leading-snug text-muted-foreground sm:block">{style.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="order-2 overflow-hidden rounded-2xl border border-border bg-muted/20 sm:order-3">
                  <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground">
                    <span className="flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5" />
                      Prévia da agenda do cliente
                    </span>
                    <span className="rounded-full bg-background px-2 py-1 text-[10px] font-medium">
                      Ao vivo
                    </span>
                  </div>
                  <div className="p-3 sm:p-4" style={{ backgroundColor: selectedPalette.soft }}>
                    <div className="mx-auto max-w-sm overflow-hidden border border-black/10 bg-background shadow-sm" style={{ borderRadius: selectedSiteStyle.radius }}>
                      <div className="flex items-center gap-3 border-b border-border/70 px-3 py-3">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center text-sm font-bold"
                          style={{
                            backgroundColor: `${primaryColor}18`,
                            color: primaryColor,
                            borderRadius: selectedSiteStyle.radius,
                          }}
                        >
                          {(name.trim()[0] || 'N').toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{name.trim() || 'Nome do seu negócio'}</span>
                          <span className="block text-[10px] text-muted-foreground">Agendamento online</span>
                        </span>
                        <Badge
                          variant="outline"
                          className="shrink-0 border-current px-2 py-0.5 text-[9px] font-semibold"
                          style={{ color: primaryColor, borderColor: `${primaryColor}55` }}
                        >
                          {segment === 'barbershop' ? 'BARBEARIA' : segment === 'gym' ? 'AULAS' : segment === 'clinic' ? 'SAÚDE' : segment === 'services' ? 'SERVIÇOS' : 'BELEZA'}
                        </Badge>
                      </div>

                      <div className="space-y-3 p-3">
                        <div>
                          <p className="text-xs font-bold">Escolha seu serviço</p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">Selecione uma opção para continuar</p>
                        </div>
                        <div
                          className="flex items-center justify-between gap-3 border p-2.5"
                          style={{ borderColor: `${primaryColor}66`, borderRadius: selectedSiteStyle.radius }}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Sparkles className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold">{serviceName.trim() || 'Seu primeiro serviço'}</span>
                              <span className="mt-0.5 block text-[10px] text-muted-foreground">{serviceDuration || 60} min · atendimento online</span>
                            </span>
                          </span>
                          <span className="shrink-0 text-xs font-bold" style={{ color: primaryColor }}>
                            R$ {Number(servicePrice || 0).toFixed(2)}
                          </span>
                        </div>

                        <div>
                          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" style={{ color: primaryColor }} />
                            Próximos horários
                          </p>
                          <div className="grid grid-cols-3 gap-1.5">
                            {['09:00', '10:30', '14:00'].map((time, index) => (
                              <span
                                key={time}
                                className="rounded-md border px-2 py-1.5 text-center text-[10px] font-medium"
                                style={index === 1
                                  ? { backgroundColor: primaryColor, borderColor: primaryColor, color: getColorForeground(primaryColor) }
                                  : { borderColor: `${primaryColor}40`, color: primaryColor }}
                              >
                                {time}
                              </span>
                            ))}
                          </div>
                        </div>

                        <span
                          className="block w-full px-3 py-2.5 text-center text-xs font-semibold"
                          style={{
                            backgroundColor: primaryColor,
                            color: getColorForeground(primaryColor),
                            borderRadius: selectedSiteStyle.radius,
                          }}
                        >
                          Continuar agendamento
                          <ArrowRight className="ml-1.5 inline h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="order-4 flex items-center gap-3 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                  </Button>
                  <Button className="flex-1 h-11 font-semibold" onClick={() => setStep(4)}>
                    Avançar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 4: Hours & First Service */}
            {step === 4 && (
              <form onSubmit={handleComplete} className="space-y-4">
                {/* Working hours */}
                <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Expediente Básico
                  </span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="open-time" className="text-xs">Abertura</Label>
                      <Input
                        id="open-time"
                        type="time"
                        value={openTime}
                        onChange={(e) => setOpenTime(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="close-time" className="text-xs">Fechamento</Label>
                      <Input
                        id="close-time"
                        type="time"
                        value={closeTime}
                        onChange={(e) => setCloseTime(e.target.value)}
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Dias de Funcionamento</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS.map((day) => {
                        const active = openWeekdays.includes(day.id);
                        return (
                          <Button
                            key={day.id}
                            type="button"
                            size="sm"
                            variant={active ? 'default' : 'outline'}
                            className="h-7 text-xs px-2.5"
                            onClick={() => handleToggleWeekday(day.id)}
                          >
                            {day.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* First Service configuration */}
                <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Primeiro Serviço Cadastrado
                  </span>

                  <div className="space-y-1">
                    <Label htmlFor="srv-name" className="text-xs">Nome do Serviço / Aula</Label>
                    <Input
                      id="srv-name"
                      placeholder="Ex: Corte Cabelo, Aula Spinning, Manicure"
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      className="h-9"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="srv-price" className="text-xs">Preço (R$)</Label>
                      <Input
                        id="srv-price"
                        type="number"
                        min={0}
                        value={servicePrice}
                        onChange={(e) => setServicePrice(Number(e.target.value))}
                        className="h-9"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="srv-dur" className="text-xs">Duração (min)</Label>
                      <Input
                        id="srv-dur"
                        type="number"
                        min={5}
                        step={5}
                        value={serviceDuration}
                        onChange={(e) => setServiceDuration(Number(e.target.value))}
                        className="h-9"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="srv-cap" className="text-xs">
                        {segment === 'gym' ? 'Vagas / Horário' : 'Vagas (1:1)'}
                      </Label>
                      <Input
                        id="srv-cap"
                        type="number"
                        min={1}
                        value={serviceCapacity}
                        onChange={(e) => setServiceCapacity(Number(e.target.value))}
                        className="h-9"
                      />
                    </div>
                  </div>
                  {segment === 'gym' && (
                    <p className="text-[11px] text-blue-600 dark:text-blue-400">
                      💡 Em academias, configure a capacidade para o número de alunos suportados na sala (ex: 15 vagas).
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(3)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                  </Button>
                  <Button type="submit" className="flex-1 h-11 font-bold shadow-lg shadow-primary/20" disabled={isCreating}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {isCreating ? 'Criando sua agenda...' : isAuthenticated ? 'Concluir e Abrir Painel' : 'Continuar e Criar Conta'}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
export default Onboarding;

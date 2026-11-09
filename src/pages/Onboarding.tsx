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
  { name: 'Rosa', color: '#e54878', mood: 'Delicado e elegante' },
  { name: 'Verde', color: '#0f9f83', mood: 'Natural e tranquilo' },
  { name: 'Azul', color: '#2563eb', mood: 'Moderno e confiável' },
  { name: 'Violeta', color: '#8b5cf6', mood: 'Criativo e sofisticado' },
  { name: 'Âmbar', color: '#d97706', mood: 'Acolhedor e marcante' },
  { name: 'Grafite', color: '#334155', mood: 'Clássico e minimalista' },
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
  const [primaryColor, setPrimaryColor] = useState(COLOR_PALETTES[0].color);
  const [siteStyle, setSiteStyle] = useState<SiteStyle>('warm');

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
    const suggestedColor = selected === 'barbershop'
      ? COLOR_PALETTES[4].color
      : selected === 'gym'
        ? COLOR_PALETTES[2].color
        : selected === 'salon'
          ? COLOR_PALETTES[0].color
          : COLOR_PALETTES[3].color;
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
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex flex-col justify-center py-10 px-4">
      <div className="max-w-xl w-full mx-auto">
        {/* Back to Home & Step indicator */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Página Inicial
            </Link>
          </Button>

          <Badge variant="outline" className="px-3 py-1 font-semibold text-xs border-primary/30 text-primary">
            Passo {step} de 4
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-muted h-2 rounded-full mb-8 overflow-hidden">
          <div 
            className="bg-primary h-full transition-all duration-300 ease-out"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        <Card className="shadow-2xl border-border/80">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-2 shadow-inner">
              {step === 1 && <Building2 className="h-6 w-6" />}
              {step === 2 && <Scissors className="h-6 w-6" />}
              {step === 3 && <Paintbrush className="h-6 w-6" />}
              {step === 4 && <Clock className="h-6 w-6" />}
            </div>

            <CardTitle className="text-2xl font-bold">
              {step === 1 && 'Dados do seu Negócio'}
              {step === 2 && 'Qual é o seu Segmento?'}
              {step === 3 && 'A cara do seu site'}
              {step === 4 && 'Horários & Primeiro Serviço'}
            </CardTitle>
            <CardDescription className="text-sm">
              {step === 1 && 'Identifique sua empresa e escolha seu link exclusivo de agendamento.'}
              {step === 2 && 'Personalizamos as regras (individual ou turma) de acordo com seu ramo.'}
              {step === 3 && 'Escolha as cores e o estilo visual. Você já pode ver uma prévia da página.'}
              {step === 4 && 'Defina seu expediente básico e o primeiro serviço que seus clientes poderão agendar.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-2">
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
              <div className="space-y-5">
                <section className="space-y-3">
                  <div>
                    <Label className="text-sm font-semibold">Escolha a cor da sua marca</Label>
                    <p className="text-xs text-muted-foreground mt-1">Ela será usada nos botões e nos destaques do seu site.</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {COLOR_PALETTES.map((palette) => {
                      const selected = primaryColor === palette.color;
                      return (
                        <button
                          key={palette.color}
                          type="button"
                          onClick={() => setPrimaryColor(palette.color)}
                          aria-pressed={selected}
                          className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition-colors ${
                            selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'
                          }`}
                        >
                          <span className="h-8 w-8 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: palette.color }} />
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold">{palette.name}</span>
                            <span className="block truncate text-[10px] text-muted-foreground">{palette.mood}</span>
                          </span>
                          {selected && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-3">
                  <div>
                    <Label className="text-sm font-semibold">Qual estilo combina com você?</Label>
                    <p className="text-xs text-muted-foreground mt-1">Isso define o formato dos elementos e o clima da página.</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {SITE_STYLES.map((style) => {
                      const selected = siteStyle === style.id;
                      return (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setSiteStyle(style.id)}
                          aria-pressed={selected}
                          className={`rounded-xl border p-3 text-left transition-colors ${
                            selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'
                          }`}
                        >
                          <span className="mb-2 flex h-9 items-center gap-1.5">
                            <span className="h-7 w-7 border-2" style={{ backgroundColor: primaryColor, borderColor: primaryColor, borderRadius: style.radius }} />
                            <span className="h-5 flex-1 border" style={{ borderColor: primaryColor, borderRadius: style.radius }} />
                          </span>
                          <span className="block text-xs font-semibold">{style.title}</span>
                          <span className="mt-1 block text-[10px] leading-snug text-muted-foreground">{style.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-border bg-muted/20">
                  <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" />
                    Prévia do seu site
                  </div>
                  <div className="bg-background p-4 text-center">
                    <span
                      className="mx-auto mb-2 flex h-9 w-9 items-center justify-center text-sm font-bold text-white"
                      style={{ backgroundColor: primaryColor, borderRadius: SITE_STYLES.find((style) => style.id === siteStyle)?.radius }}
                    >
                      {(name.trim()[0] || 'N').toUpperCase()}
                    </span>
                    <p className="font-bold">{name.trim() || 'Nome do seu negócio'}</p>
                    <p className="mb-3 text-[11px] text-muted-foreground">Agende seu horário online</p>
                    <span
                      className="inline-flex items-center rounded-md px-4 py-2 text-xs font-semibold text-white"
                      style={{ backgroundColor: primaryColor, borderRadius: SITE_STYLES.find((style) => style.id === siteStyle)?.radius }}
                    >
                      Escolher serviço
                    </span>
                  </div>
                </section>

                <div className="flex items-center gap-3 pt-1">
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

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, 
  Sparkles, 
  Lock, 
  User, 
  Phone, 
  Clock, 
  CheckCircle2, 
  MessageSquare, 
  Scissors, 
  Dumbbell, 
  Briefcase, 
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useSaas } from '@/contexts/SaasContext';
import { SiteStyle } from '@/types/saas';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const hexToHsl = (hex: string) => {
  const normalized = hex.replace('#', '');
  if (!/^[\da-f]{6}$/i.test(normalized)) return '43 74% 49%';

  const [red, green, blue] = [0, 2, 4].map((index) =>
    parseInt(normalized.slice(index, index + 2), 16) / 255
  );
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue /= 6;
  }

  return `${Math.round(hue * 360)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
};

const getThemeStyle = (color: string, style: SiteStyle): React.CSSProperties => {
  const channels = color.match(/[\da-f]{2}/gi)?.map((channel) => parseInt(channel, 16) / 255) ?? [];
  const luminance = channels.length === 3
    ? channels.reduce((sum, channel, index) => {
        const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        return sum + linear * [0.2126, 0.7152, 0.0722][index];
      }, 0)
    : 0;
  const primary = hexToHsl(color);
  const foreground = luminance > 0.4 ? '40 15% 15%' : '0 0% 100%';

  return {
    '--primary': primary,
    '--primary-foreground': foreground,
    '--accent': primary,
    '--accent-foreground': foreground,
    '--ring': primary,
    '--sidebar-primary': primary,
    '--sidebar-primary-foreground': foreground,
    '--sidebar-ring': primary,
    '--radius': style === 'clean' ? '0.5rem' : style === 'bold' ? '0.75rem' : '1.25rem',
    ...(style === 'warm' ? {
      '--background': '36 50% 97%',
      '--muted': '34 35% 93%',
      '--border': '34 25% 86%',
      '--input': '34 25% 86%',
    } : {}),
  } as React.CSSProperties;
};

export const PublicBooking = () => {
  const { slug } = useParams<{ slug: string }>();
  const { 
    getTenantBySlug, 
    setCurrentTenant,
    services: allServices, 
    professionals: allPros, 
    appointments,
    loadPublicTenantPage,
    findPublicAppointments,
    changePublicAppointment,
    bookAppointment,
    cancelAppointment,
    getAvailableSlots,
    getRemoteAvailableSlots,
  } = useSaas();

  const localTenant = slug ? getTenantBySlug(slug) : undefined;
  const [remoteWorkspace, setRemoteWorkspace] = useState<Awaited<ReturnType<typeof loadPublicTenantPage>>>(null);
  const [remotePageLoading, setRemotePageLoading] = useState(true);
  const [remotePageError, setRemotePageError] = useState(false);
  const [remoteSlots, setRemoteSlots] = useState<{ time: string; remainingCapacity: number }[]>([]);
  const [remoteAppointments, setRemoteAppointments] = useState<Awaited<ReturnType<typeof findPublicAppointments>>>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const tenant = remoteWorkspace?.tenant ?? localTenant;
  const isRemoteTenant = remoteWorkspace !== null;
  const remoteCanBook = !isRemoteTenant || remoteWorkspace?.canBook === true;

  // Form State
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedProId, setSelectedProId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [isBooked, setIsBooked] = useState(false);

  // My Appointments Lookup State
  const [lookupPhone, setLookupPhone] = useState('');
  const [isLookupOpen, setIsLookupOpen] = useState(false);

  useEffect(() => {
    if (!slug) {
      setRemotePageLoading(false);
      return;
    }

    let active = true;
    setRemotePageLoading(true);
    loadPublicTenantPage(slug)
      .then((workspace) => {
        if (active) {
          setRemoteWorkspace(workspace);
          setRemotePageError(false);
        }
      })
      .catch((error: unknown) => {
        console.error('Unable to load public tenant page:', error);
        if (active) setRemotePageError(true);
      })
      .finally(() => {
        if (active) setRemotePageLoading(false);
      });
    return () => { active = false; };
  }, [slug, loadPublicTenantPage]);

  useEffect(() => {
    if (!tenant || selectedServiceId) return;
    const sourceServices = isRemoteTenant && remoteWorkspace?.tenant.id === tenant.id
      ? remoteWorkspace.services
      : allServices;
    const firstService = sourceServices.find((service) => service.tenant_id === tenant.id && service.active);
    if (firstService) setSelectedServiceId(firstService.id);
  }, [allServices, isRemoteTenant, remoteWorkspace, selectedServiceId, tenant]);

  useEffect(() => {
    if (!isRemoteTenant || !tenant || !selectedDate || !selectedService || !remoteCanBook) {
      setRemoteSlots([]);
      return;
    }
    let active = true;
    getRemoteAvailableSlots({
      tenantId: tenant.id,
      date: selectedDate,
      serviceId: selectedService.id,
      maxCapacity: selectedService.max_capacity,
      settings: tenant.settings,
      professionalId: selectedProId || undefined,
    }).then((slots) => {
      if (active) setRemoteSlots(slots);
    }).catch((error: unknown) => {
      console.error('Unable to load available slots:', error);
      if (active) {
        setRemoteSlots([]);
        toast.error('Não foi possível consultar os horários disponíveis.');
      }
    });
    return () => { active = false; };
  }, [getRemoteAvailableSlots, isRemoteTenant, remoteCanBook, selectedDate, selectedProId, selectedService, tenant]);

  useEffect(() => {
    const cleanPhone = lookupPhone.replace(/\D/g, '');
    if (!isRemoteTenant || !tenant || cleanPhone.length < 8) {
      setRemoteAppointments([]);
      setLookupError(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      findPublicAppointments(tenant.id, cleanPhone)
        .then((found) => {
          if (active) {
            setRemoteAppointments(found);
            setLookupError(null);
          }
        })
        .catch((error: unknown) => {
          console.error('Unable to find public appointments:', error);
          if (active) setLookupError('Não foi possível consultar os agendamentos. Tente novamente.');
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [findPublicAppointments, isRemoteTenant, lookupPhone, tenant]);

  if (remotePageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-muted/20 flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8 space-y-4">
          <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Estabelecimento Não Encontrado</CardTitle>
          <CardDescription>
            {remotePageError
              ? 'Não foi possível verificar esta página agora. Tente novamente em instantes.'
              : <>O link <span className="font-mono text-foreground font-semibold">/{slug}</span> não corresponde a nenhum negócio cadastrado.</>}
          </CardDescription>
          <Button asChild className="w-full">
            <Link to="/">Voltar à Página Inicial</Link>
          </Button>
        </Card>
      </div>
    );
  }

  // Tenant specific data
  const tenantServices = (isRemoteTenant && remoteWorkspace?.tenant.id === tenant.id
    ? remoteWorkspace.services
    : allServices.filter((s) => s.tenant_id === tenant.id)).filter((service) => service.active);
  const tenantPros = (isRemoteTenant && remoteWorkspace?.tenant.id === tenant.id
    ? remoteWorkspace.professionals
    : allPros.filter((p) => p.tenant_id === tenant.id)).filter((professional) => professional.active);
  const selectedService = tenantServices.find((s) => s.id === selectedServiceId) || tenantServices[0];

  // Compute available slots
  const availableSlots = isRemoteTenant
    ? remoteSlots
    : selectedDate
    ? getAvailableSlots({
        tenantId: tenant.id,
        date: selectedDate,
        serviceId: selectedService?.id,
        professionalId: selectedProId || undefined,
      })
    : [];

  const handleBooking = async () => {
    if (!remoteCanBook) {
      toast.error('O período gratuito desta agenda terminou. O proprietário precisa escolher um plano.');
      return;
    }
    if (!clientName.trim() || !clientPhone.trim()) {
      toast.error('Preencha seu nome e telefone.');
      return;
    }
    if (!selectedService) {
      toast.error('Selecione um serviço.');
      return;
    }
    if (!selectedDate || !selectedTime) {
      toast.error('Escolha a data e o horário desejado.');
      return;
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const res = await bookAppointment({
      tenantId: tenant.id,
      serviceId: selectedService.id,
      professionalId: selectedProId || undefined,
      professionalName: tenantPros.find((professional) => professional.id === selectedProId)?.name,
      service: selectedService,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      date: dateStr,
      time: selectedTime,
    }).catch((error: unknown) => {
      console.error('Appointment creation failed:', error);
      return { success: false, error: 'Não foi possível concluir o agendamento. Tente novamente.' };
    });

    if (!res.success) {
      toast.error(res.error || 'Erro ao realizar agendamento.');
      return;
    }

    // Build WhatsApp Message
    const formattedDate = format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
    const proText = selectedProId ? `\n👤 Atendente: ${tenantPros.find(p => p.id === selectedProId)?.name}` : '';
    
    const message = `✨ Agendamento Confirmado! ✨

Olá, ${clientName}!
Seu horário foi reservado com sucesso no *${tenant.name}*!

📆 Data: ${formattedDate}
⏰ Horário: ${selectedTime}
💛 Serviço: ${selectedService.name} (R$ ${selectedService.price.toFixed(2)})${proText}

Qualquer dúvida ou alteração, é só chamar aqui mesmo.
Te esperamos no horário marcado! 🤍`;

    const encodedMessage = encodeURIComponent(message);
    const cleanWhatsApp = tenant.phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${cleanWhatsApp.replace(/^55/, '')}?text=${encodedMessage}`;

    setIsBooked(true);
    toast.success('Agendamento realizado com sucesso!');

    // Redirect to WhatsApp
    setTimeout(() => {
      window.open(whatsappUrl, '_blank');
    }, 600);
  };

  // Appointments for the current client's phone lookup
  const cleanLookup = lookupPhone.replace(/\D/g, '');
  const myAppointments = cleanLookup.length >= 8
    ? isRemoteTenant
      ? remoteAppointments
      : appointments.filter(
        (a) => a.tenant_id === tenant.id && a.client_phone.includes(cleanLookup) && a.status === 'active'
      )
    : [];

  return (
    <div
      className="public-booking min-h-screen bg-gradient-to-br from-background via-muted/30 to-background text-foreground pb-16"
      data-site-style={tenant.site_style ?? 'warm'}
      style={getThemeStyle(tenant.primary_color ?? '#e54878', tenant.site_style ?? 'warm')}
    >
      {/* Dynamic Header */}
      <header className={`bg-card border-border ${tenant.site_style === 'bold' ? 'border-b-4 border-primary shadow-md' : 'border-b shadow-xs'}`}>
        <div className="container mx-auto px-4 py-6 relative max-w-xl">
          {/* Subtle lock link to admin panel */}
          <Link 
            to="/admin" 
            onClick={() => { if (!isRemoteTenant) setCurrentTenant(tenant); }}
            title="Acessar Painel Administrativo" 
            className="absolute right-4 top-4 p-2 text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            <Lock className="h-4 w-4" />
          </Link>

          <div className="flex flex-col items-center text-center space-y-2">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xl shadow-inner">
              {tenant.segment === 'barbershop' ? (
                <Scissors className="h-7 w-7" />
              ) : tenant.segment === 'gym' ? (
                <Dumbbell className="h-7 w-7" />
              ) : (
                <Sparkles className="h-7 w-7" />
              )}
            </div>

            <h1 className={`text-2xl font-extrabold tracking-tight text-foreground ${tenant.site_style === 'bold' ? 'uppercase' : ''}`}>
              {tenant.name}
            </h1>

            {tenant.bio && (
              <p className="text-xs text-muted-foreground max-w-sm">
                {tenant.bio}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30 bg-primary/5 uppercase tracking-wider">
                {tenant.segment === 'barbershop' ? 'Barbearia & Salão' : tenant.segment === 'gym' ? 'Academia & Aulas' : 'Estética & Beleza'}
              </Badge>
              {tenant.address && (
                <span className="text-[11px] text-muted-foreground">· {tenant.address}</span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Booking Container */}
      <main className="container mx-auto px-4 pt-6 max-w-xl">
        <Card className="border-border shadow-xl backdrop-blur-xs">
          <CardHeader className="text-center pb-3">
            <CardTitle className="text-xl flex items-center justify-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Agende seu Horário
            </CardTitle>
            <CardDescription className="text-xs">
              Escolha seu serviço, selecione a data e garanta seu atendimento online.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-2">
            {!remoteCanBook && (
              <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
                O período gratuito desta agenda terminou. Novos agendamentos estão temporariamente indisponíveis.
              </div>
            )}

            {/* 1. Client Information */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-primary" />
                Seus Dados
              </span>

              <div className="grid gap-3">
                <div className="space-y-1">
                  <Label htmlFor="client-name" className="text-xs">Seu Nome Completo</Label>
                  <Input
                    id="client-name"
                    placeholder="Ex: João da Silva"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="client-phone" className="text-xs">Seu WhatsApp</Label>
                  <Input
                    id="client-phone"
                    placeholder="(00) 00000-0000"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* 2. Service Selection */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Serviço Desejado
              </span>

              <Select value={selectedServiceId} onValueChange={(val) => {
                setSelectedServiceId(val);
                setSelectedTime('');
              }}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent>
                  {tenantServices.map((srv) => (
                    <SelectItem key={srv.id} value={srv.id}>
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span className="font-medium">{srv.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {srv.duration_minutes} min · R$ {srv.price.toFixed(2)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Professional Selection (If business has professionals) */}
            {tenantPros.length > 0 && tenant.segment !== 'gym' && (
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-primary" />
                  Profissional Preferido
                </span>

                <Select value={selectedProId || 'any'} onValueChange={(val) => {
                  setSelectedProId(val === 'any' ? '' : val);
                  setSelectedTime('');
                }}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Qualquer profissional disponível" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Qualquer profissional disponível</SelectItem>
                    {tenantPros.map((pro) => (
                      <SelectItem key={pro.id} value={pro.id}>
                        {pro.name} ({pro.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 4. Date Picker */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                Escolha a Data
              </span>

              <div className="flex justify-center border border-border rounded-xl p-2 bg-card">
                <Calendar
                  mode="single"
                  locale={ptBR}
                  selected={selectedDate}
                  onSelect={(d) => {
                    if (d) {
                      setSelectedDate(d);
                      setSelectedTime('');
                    }
                  }}
                  disabled={(d) => {
                    const isPast = d < new Date(new Date().setHours(0,0,0,0));
                    const isClosed = !tenant.settings.open_weekdays.includes(d.getDay());
                    return isPast || isClosed;
                  }}
                  className="rounded-lg"
                />
              </div>
            </div>

            {/* 5. Available Slots */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Horários Disponíveis
                </span>
                {selectedDate && (
                  <span className="text-[11px] font-normal text-muted-foreground capitalize">
                    {format(selectedDate, "EEEE, dd/MM", { locale: ptBR })}
                  </span>
                )}
              </span>

              {availableSlots.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                  Nenhum horário disponível para esta data. Por favor, escolha outro dia.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableSlots.map(({ time, remainingCapacity }) => {
                    const isSelected = selectedTime === time;
                    return (
                      <Button
                        key={time}
                        type="button"
                        size="sm"
                        variant={isSelected ? 'default' : 'outline'}
                        className={`h-11 flex flex-col items-center justify-center relative ${
                          isSelected ? 'font-bold shadow-md shadow-primary/25' : ''
                        }`}
                        onClick={() => setSelectedTime(time)}
                      >
                        <span className="text-xs">{time}</span>
                        {selectedService && selectedService.max_capacity > 1 && (
                          <span className="text-[9px] opacity-75">
                            {remainingCapacity} {remainingCapacity === 1 ? 'vaga' : 'vagas'}
                          </span>
                        )}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 6. Summary & Schedule Button */}
            {selectedService && selectedDate && selectedTime && (
              <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-1.5 text-xs">
                <div className="flex justify-between font-semibold text-foreground">
                  <span>Resumo do Agendamento:</span>
                  <span className="text-primary font-bold">R$ {selectedService.price.toFixed(2)}</span>
                </div>
                <p className="text-muted-foreground">
                  📅 {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} às {selectedTime}
                </p>
                <p className="text-muted-foreground">
                  ✨ {selectedService.name} ({selectedService.duration_minutes} min)
                </p>
              </div>
            )}

            <Button
              className="w-full h-12 text-base font-bold shadow-lg shadow-primary/25 gap-2"
              disabled={!remoteCanBook || !clientName.trim() || !clientPhone.trim() || !selectedTime}
              onClick={handleBooking}
            >
              <MessageSquare className="h-5 w-5" />
              Confirmar Agendamento pelo WhatsApp
            </Button>

            {/* Reagendar / Cancelar lookup dialog */}
            <div className="text-center pt-2">
              <Dialog open={isLookupOpen} onOpenChange={setIsLookupOpen}>
                <DialogTrigger asChild>
                  <button className="text-xs text-muted-foreground hover:text-foreground underline">
                    Já tem um agendamento? Consultar ou Reagendar
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Meus Agendamentos</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label className="text-xs">Digite seu telefone cadastrado</Label>
                      <Input
                        placeholder="(00) 00000-0000"
                        value={lookupPhone}
                        onChange={(e) => setLookupPhone(e.target.value)}
                      />
                    </div>

                    {lookupError ? (
                      <p className="text-xs text-destructive text-center py-4">{lookupError}</p>
                    ) : myAppointments.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        {cleanLookup.length >= 8 
                          ? 'Nenhum agendamento ativo encontrado com este número.' 
                          : 'Digite seu telefone completo para buscar seus horários.'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {myAppointments.map((a) => (
                          <div key={a.id} className="p-3 rounded-lg border border-border flex items-center justify-between text-xs">
                            <div>
                              <p className="font-bold text-foreground">{a.date} às {a.time}</p>
                              <p className="text-muted-foreground">{a.service_name}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive h-8 text-xs"
                              onClick={async () => {
                                if (confirm('Deseja realmente cancelar este horário?')) {
                                  try {
                                    if (isRemoteTenant) {
                                      await changePublicAppointment({
                                        appointmentId: a.id,
                                        phone: lookupPhone,
                                        cancel: true,
                                      });
                                      setRemoteAppointments((previous) => previous.filter((item) => item.id !== a.id));
                                    } else {
                                      await cancelAppointment(a.id);
                                    }
                                    toast.success('Agendamento cancelado');
                                  } catch (error) {
                                    console.error('Unable to cancel public appointment:', error);
                                    toast.error(error instanceof Error ? error.message : 'Não foi possível cancelar o agendamento.');
                                  }
                                }
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
export default PublicBooking;

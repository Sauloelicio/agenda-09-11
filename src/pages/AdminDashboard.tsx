import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  DollarSign, 
  Users, 
  TrendingUp, 
  Share2, 
  ExternalLink, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  Scissors, 
  Sparkles, 
  Dumbbell, 
  Settings, 
  LogOut, 
  MessageSquare,
  AlertCircle,
  ChevronDown,
  Crown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSaas } from '@/contexts/SaasContext';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const DAYS = [
  { id: 0, label: 'Dom' },
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
  { id: 6, label: 'Sáb' },
];

export const AdminDashboard = ({ demoMode = false }: { demoMode?: boolean }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { 
    tenants, 
    currentTenant, 
    setCurrentTenant,
    services, 
    professionals, 
    appointments,
    addService,
    deleteService,
    addProfessional,
    deleteProfessional,
    updateTenantSettings,
    updateTenantInfo,
    cancelAppointment,
    rescheduleAppointment,
    getTenantMetrics
  } = useSaas();

  const [copied, setCopied] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // Modals state
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState(60);
  const [newServiceDuration, setNewServiceDuration] = useState(40);
  const [newServiceCapacity, setNewServiceCapacity] = useState(1);

  const [isProModalOpen, setIsProModalOpen] = useState(false);
  const [newProName, setNewProName] = useState('');
  const [newProRole, setNewProRole] = useState('Profissional');
  const [newProPhone, setNewProPhone] = useState('');

  // Settings form local state
  const [openTime, setOpenTime] = useState(currentTenant?.settings.open_time || '09:00');
  const [closeTime, setCloseTime] = useState(currentTenant?.settings.close_time || '19:00');
  const [lunchStart, setLunchStart] = useState(currentTenant?.settings.lunch_start || '');
  const [lunchEnd, setLunchEnd] = useState(currentTenant?.settings.lunch_end || '');
  const [openWeekdays, setOpenWeekdays] = useState<number[]>(currentTenant?.settings.open_weekdays || [1,2,3,4,5,6]);

  // Company info local state
  const [bizName, setBizName] = useState(currentTenant?.name || '');
  const [bizPhone, setBizPhone] = useState(currentTenant?.phone || '');
  const [bizBio, setBizBio] = useState(currentTenant?.bio || '');

  useEffect(() => {
    if (!currentTenant) return;
    setOpenTime(currentTenant.settings.open_time);
    setCloseTime(currentTenant.settings.close_time);
    setLunchStart(currentTenant.settings.lunch_start || '');
    setLunchEnd(currentTenant.settings.lunch_end || '');
    setOpenWeekdays(currentTenant.settings.open_weekdays);
    setBizName(currentTenant.name);
    setBizPhone(currentTenant.phone);
    setBizBio(currentTenant.bio || '');
  }, [currentTenant]);

  if (!currentTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-6">
          <p className="text-muted-foreground mb-4">Nenhum estabelecimento encontrado.</p>
          <Button asChild><Link to="/onboarding">Criar Conta</Link></Button>
        </Card>
      </div>
    );
  }

  const metrics = getTenantMetrics(currentTenant.id);
  const clientBookingUrl = `${window.location.origin}/${currentTenant.slug}`;
  const trialDaysRemaining = Math.max(
    0,
    Math.ceil((Date.parse(currentTenant.trial_ends_at) - Date.now()) / (24 * 60 * 60 * 1000))
  );

  const copyLink = () => {
    navigator.clipboard.writeText(clientBookingUrl);
    setCopied(true);
    toast.success('Link do cliente copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;
    try {
      await addService({
        name: newServiceName.trim(),
        price: Number(newServicePrice) || 0,
        duration_minutes: Number(newServiceDuration) || 30,
        max_capacity: Number(newServiceCapacity) || 1,
        active: true,
      });
      setNewServiceName('');
      setIsServiceModalOpen(false);
      toast.success('Serviço cadastrado com sucesso!');
    } catch (error) {
      console.error('Unable to create service:', error);
      toast.error('Não foi possível cadastrar o serviço. Verifique o período de acesso e tente novamente.');
    }
  };

  const handleCreateProfessional = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProName.trim()) return;
    try {
      await addProfessional({
        name: newProName.trim(),
        role: newProRole.trim() || 'Atendente',
        phone: newProPhone.trim(),
        active: true,
      });
      setNewProName('');
      setIsProModalOpen(false);
      toast.success('Profissional adicionado à equipe!');
    } catch (error) {
      console.error('Unable to create professional:', error);
      toast.error('Não foi possível adicionar o profissional. Verifique o período de acesso e tente novamente.');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateTenantSettings(currentTenant.id, {
        ...currentTenant.settings,
        open_time: openTime,
        close_time: closeTime,
        lunch_start: lunchStart || null,
        lunch_end: lunchEnd || null,
        open_weekdays: openWeekdays,
      });
      toast.success('Horários de funcionamento atualizados!');
    } catch (error) {
      console.error('Unable to save business hours:', error);
      toast.error('Não foi possível salvar os horários. Verifique o período de acesso e tente novamente.');
    }
  };

  const handleSaveCompanyInfo = async () => {
    try {
      await updateTenantInfo(currentTenant.id, {
        name: bizName,
        phone: bizPhone.replace(/\D/g, ''),
        bio: bizBio,
      });
      toast.success('Informações do negócio salvas!');
    } catch (error) {
      console.error('Unable to save business information:', error);
      toast.error('Não foi possível salvar as informações. Verifique o período de acesso e tente novamente.');
    }
  };

  const filteredAppointments = appointments.filter((a) => a.date === selectedDate);

  return (
    <div className="min-h-screen bg-muted/20 pb-16">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-card border-b border-border shadow-xs">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
                <Calendar className="h-4 w-4" />
              </div>
              <span className="font-bold text-lg hidden sm:inline">Agendou<span className="text-primary font-black">.SaaS</span></span>
            </Link>

            <div className="h-5 w-px bg-border mx-1 hidden sm:block" />

            {/* No modo demo, o seletor navega apenas entre os dados fictícios. */}
            <Select 
              value={currentTenant.id} 
              onValueChange={(id) => {
                if (demoMode) {
                  const found = tenants.find((t) => t.id === id);
                  if (found) navigate(`/demo/admin/${found.slug}`);
                  return;
                }

                if (user?.ownedTenantIds.includes(id)) {
                  const found = tenants.find((t) => t.id === id);
                  if (found) setCurrentTenant(found);
                }
              }}
            >
              <SelectTrigger className="w-[180px] sm:w-[220px] h-9 text-xs font-semibold bg-background">
                <SelectValue placeholder="Selecione o negócio" />
              </SelectTrigger>
              <SelectContent>
                {tenants
                  .filter((t) => demoMode
                    ? t.id.startsWith('tenant-')
                    : user?.ownedTenantIds.includes(t.id))
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden md:inline-flex bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs font-semibold gap-1 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {demoMode
                ? 'Demonstração fictícia'
                : currentTenant.subscription_status === 'active'
                  ? 'Assinatura ativa'
                  : `Teste grátis · ${trialDaysRemaining} ${trialDaysRemaining === 1 ? 'dia' : 'dias'}`}
            </Badge>

            {/* Nome do usuário logado */}
            {user && (
              <span className="hidden lg:inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <span className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-[10px]">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                {user.name.split(' ')[0]}
              </span>
            )}

            <Button size="sm" variant="outline" asChild className="hidden sm:inline-flex text-xs h-9">
              <Link to={`/${currentTenant.slug}`} target="_blank">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Ver Agendamento
              </Link>
            </Button>

            {!demoMode && user?.isMaster && (
              <Button size="sm" variant="outline" asChild className="h-9 text-xs border-primary/30 text-primary">
                <Link to="/master">
                  <Crown className="h-3.5 w-3.5 mr-1.5" />
                  Painel Master
                </Link>
              </Button>
            )}

            {demoMode ? (
              <Button size="sm" variant="ghost" asChild className="text-xs h-9 text-muted-foreground">
                <Link to="/">Sair da demonstração</Link>
              </Button>
            ) : (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={async () => {
                  const result = await logout();
                  if (!result.success) {
                    toast.error(result.error || 'Não foi possível encerrar a sessão.');
                    return;
                  }
                  navigate('/login');
                }}
                className="text-xs h-9 text-muted-foreground hover:text-destructive"
                title="Sair da conta"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container mx-auto px-4 pt-6 max-w-6xl space-y-6">
        {/* Banner with Customer Link */}
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Share2 className="h-3.5 w-3.5" />
              Link de Agendamento dos seus Clientes
            </span>
            <p className="text-sm font-medium text-foreground">
              Compartilhe na bio do seu Instagram ou envie por WhatsApp para receber agendamentos.
            </p>
            <p className="text-xs text-muted-foreground font-mono select-all">
              {clientBookingUrl}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Button size="sm" variant="outline" className="flex-1 md:flex-none text-xs h-9 bg-background" onClick={copyLink}>
              {copied ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              {copied ? 'Copiado!' : 'Copiar Link'}
            </Button>
            <Button size="sm" className="flex-1 md:flex-none text-xs h-9 font-semibold" asChild>
              <Link to={`/${currentTenant.slug}`} target="_blank">
                Abrir Página
                <ExternalLink className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Faturamento Previsto</p>
                <h3 className="text-xl font-bold mt-1 text-foreground">
                  R$ {metrics.totalRevenue.toFixed(2)}
                </h3>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <DollarSign className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Agendamentos Ativos</p>
                <h3 className="text-xl font-bold mt-1 text-foreground">
                  {metrics.activeAppointmentsCount}
                </h3>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Calendar className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Para Hoje</p>
                <h3 className="text-xl font-bold mt-1 text-foreground">
                  {metrics.todayAppointmentsCount}
                </h3>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Clock className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Concluídos</p>
                <h3 className="text-xl font-bold mt-1 text-foreground">
                  {metrics.completedCount}
                </h3>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <TrendingUp className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dashboard Tabs */}
        <Tabs defaultValue="appointments" className="space-y-4">
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full bg-card border border-border h-auto p-1">
            <TabsTrigger value="appointments" className="text-xs py-2">
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              Agenda do Dia
            </TabsTrigger>
            <TabsTrigger value="services" className="text-xs py-2">
              <Scissors className="h-3.5 w-3.5 mr-1.5" />
              Serviços & Preços
            </TabsTrigger>
            <TabsTrigger value="team" className="text-xs py-2">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Profissionais
            </TabsTrigger>
            <TabsTrigger value="hours" className="text-xs py-2">
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              Expediente
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs py-2">
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              Configurações
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Appointments / Agenda */}
          <TabsContent value="appointments" className="space-y-4">
            <Card className="border-border">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 gap-2">
                <div>
                  <CardTitle className="text-lg">Controle de Agendamentos</CardTitle>
                  <CardDescription className="text-xs">
                    Consulte os clientes agendados, confirme presença ou envie lembretes no WhatsApp.
                  </CardDescription>
                </div>
                
                {/* Date Picker Filter */}
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-9 text-xs w-[160px] bg-background"
                  />
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-9 text-xs"
                    onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                  >
                    Hoje
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {filteredAppointments.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground space-y-2">
                    <Calendar className="h-8 w-8 mx-auto opacity-30" />
                    <p className="text-sm font-medium">Nenhum agendamento para esta data.</p>
                    <p className="text-xs">
                      Envie seu link de agendamento para os clientes reservarem horários.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredAppointments.map((appt) => {
                      const whatsappText = encodeURIComponent(
                        `Olá, ${appt.client_name}! Confirmando seu horário hoje às ${appt.time} para ${appt.service_name} aqui na ${currentTenant.name}. Te esperamos!`
                      );
                      const whatsappHref = `https://wa.me/55${appt.client_phone.replace(/^55/, '')}?text=${whatsappText}`;

                      return (
                        <div 
                          key={appt.id} 
                          className="p-3.5 rounded-xl border border-border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-primary/40 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                              {appt.time}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-sm text-foreground">{appt.client_name}</h4>
                                <Badge 
                                  variant="secondary" 
                                  className={`text-[10px] font-semibold ${
                                    appt.status === 'completed' 
                                      ? 'bg-emerald-500/10 text-emerald-600' 
                                      : appt.status === 'cancelled'
                                      ? 'bg-rose-500/10 text-rose-600'
                                      : 'bg-blue-500/10 text-blue-600'
                                  }`}
                                >
                                  {appt.status === 'completed' ? 'Concluído' : appt.status === 'cancelled' ? 'Cancelado' : 'Confirmado'}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Serviço: <strong>{appt.service_name}</strong> · R$ {appt.price.toFixed(2)}
                              </p>
                              {appt.professional_name && (
                                <p className="text-xs text-muted-foreground">
                                  Profissional: <span className="font-medium text-foreground">{appt.professional_name}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 text-xs bg-emerald-500/5 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10"
                              asChild
                            >
                              <a href={whatsappHref} target="_blank" rel="noreferrer">
                                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                                WhatsApp
                              </a>
                            </Button>

                            {appt.status === 'active' && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 text-xs text-destructive hover:bg-destructive/10"
                                onClick={async () => {
                                  if (confirm('Deseja realmente cancelar este agendamento?')) {
                                    try {
                                      await cancelAppointment(appt.id);
                                      toast.success('Agendamento cancelado');
                                    } catch (error) {
                                      console.error('Unable to cancel appointment:', error);
                                      toast.error('Não foi possível cancelar o agendamento. Verifique o período de acesso e tente novamente.');
                                    }
                                  }
                                }}
                              >
                                Cancelar
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: Services & Pricing */}
          <TabsContent value="services" className="space-y-4">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-lg">Serviços Cadastrados</CardTitle>
                  <CardDescription className="text-xs">
                    Defina duração, valor e capacidade (individual ou turma).
                  </CardDescription>
                </div>

                <Dialog open={isServiceModalOpen} onOpenChange={setIsServiceModalOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="text-xs font-semibold">
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Novo Serviço
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Adicionar Novo Serviço / Aula</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateService} className="space-y-4 mt-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Nome do Serviço</Label>
                        <Input
                          placeholder="Ex: Corte Masculino, Aplicação Gel, Spinning"
                          value={newServiceName}
                          onChange={(e) => setNewServiceName(e.target.value)}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Preço (R$)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={newServicePrice}
                            onChange={(e) => setNewServicePrice(Number(e.target.value))}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Duração (min)</Label>
                          <Input
                            type="number"
                            min={5}
                            step={5}
                            value={newServiceDuration}
                            onChange={(e) => setNewServiceDuration(Number(e.target.value))}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Vagas / Slot</Label>
                          <Input
                            type="number"
                            min={1}
                            value={newServiceCapacity}
                            onChange={(e) => setNewServiceCapacity(Number(e.target.value))}
                          />
                        </div>
                      </div>

                      <p className="text-[11px] text-muted-foreground">
                        * Use vagas = 1 para atendimentos individuais (manicures, barbearias). Use vagas &gt; 1 para turmas (academias, estúdios).
                      </p>

                      <Button type="submit" className="w-full font-semibold">
                        Salvar Serviço
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="grid gap-3">
                  {services.map((srv) => (
                    <div 
                      key={srv.id} 
                      className="p-3.5 rounded-xl border border-border bg-card flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm">{srv.name}</h4>
                          {srv.max_capacity > 1 && (
                            <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-600">
                              {srv.max_capacity} vagas / turma
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Duração: {srv.duration_minutes} min · Preço: R$ {srv.price.toFixed(2)}
                        </p>
                      </div>

                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-destructive h-8 w-8 p-0"
                        onClick={async () => {
                          if (confirm(`Excluir o serviço "${srv.name}"?`)) {
                            try {
                              await deleteService(srv.id);
                              toast.success('Serviço removido');
                            } catch (error) {
                              console.error('Unable to delete service:', error);
                              toast.error('Não foi possível remover o serviço. Ele pode estar vinculado a agendamentos.');
                            }
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: Professionals / Team */}
          <TabsContent value="team" className="space-y-4">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-lg">Equipe & Profissionais</CardTitle>
                  <CardDescription className="text-xs">
                    Gerencie quem atende no seu estabelecimento (barbeiros, manicures, instrutores).
                  </CardDescription>
                </div>

                <Dialog open={isProModalOpen} onOpenChange={setIsProModalOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="text-xs font-semibold">
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Adicionar Profissional
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Adicionar Membro da Equipe</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateProfessional} className="space-y-4 mt-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Nome Completo</Label>
                        <Input
                          placeholder="Ex: Carlos Oliveira, Camila Rocha"
                          value={newProName}
                          onChange={(e) => setNewProName(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Cargo / Especialidade</Label>
                        <Input
                          placeholder="Ex: Barbeiro Sênior, Nail Designer, Coach"
                          value={newProRole}
                          onChange={(e) => setNewProRole(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Telefone WhatsApp</Label>
                        <Input
                          placeholder="(11) 99999-8888"
                          value={newProPhone}
                          onChange={(e) => setNewProPhone(e.target.value)}
                        />
                      </div>

                      <Button type="submit" className="w-full font-semibold">
                        Cadastrar Profissional
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="grid gap-3">
                  {professionals.map((pro) => (
                    <div 
                      key={pro.id} 
                      className="p-3.5 rounded-xl border border-border bg-card flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                          {pro.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">{pro.name}</h4>
                          <p className="text-xs text-muted-foreground">{pro.role}</p>
                          {pro.phone && <p className="text-[11px] text-muted-foreground">{pro.phone}</p>}
                        </div>
                      </div>

                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-destructive h-8 w-8 p-0"
                        onClick={async () => {
                          if (confirm(`Remover "${pro.name}" da equipe?`)) {
                            try {
                              await deleteProfessional(pro.id);
                              toast.success('Profissional removido');
                            } catch (error) {
                              console.error('Unable to delete professional:', error);
                              toast.error('Não foi possível remover o profissional. Tente novamente.');
                            }
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: Hours & Schedule */}
          <TabsContent value="hours" className="space-y-4">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Expediente e Horários</CardTitle>
                <CardDescription className="text-xs">
                  Os slots de agendamento exibidos para seus clientes são calculados com base nestas regras.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Início Expediente</Label>
                    <Input
                      type="time"
                      value={openTime}
                      onChange={(e) => setOpenTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fim Expediente</Label>
                    <Input
                      type="time"
                      value={closeTime}
                      onChange={(e) => setCloseTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Almoço Início</Label>
                    <Input
                      type="time"
                      value={lunchStart}
                      onChange={(e) => setLunchStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Almoço Fim</Label>
                    <Input
                      type="time"
                      value={lunchEnd}
                      onChange={(e) => setLunchEnd(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Dias de Atendimento</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((d) => {
                      const on = openWeekdays.includes(d.id);
                      return (
                        <Button
                          key={d.id}
                          type="button"
                          size="sm"
                          variant={on ? 'default' : 'outline'}
                          onClick={() => {
                            setOpenWeekdays(prev => 
                              prev.includes(d.id) ? prev.filter(x => x !== d.id) : [...prev, d.id].sort()
                            );
                          }}
                        >
                          {d.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <Button onClick={handleSaveSettings} className="font-semibold">
                  Salvar Alterações de Horário
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: Settings */}
          <TabsContent value="settings" className="space-y-4">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Configurações do Negócio</CardTitle>
                <CardDescription className="text-xs">
                  Altere nome exibido, WhatsApp de contato e bio do seu negócio.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Nome do Estabelecimento</Label>
                  <Input
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">WhatsApp para Receber Mensagens</Label>
                  <Input
                    value={bizPhone}
                    onChange={(e) => setBizPhone(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Descrição / Bio (Aparece no topo da página de agendamento)</Label>
                  <Input
                    value={bizBio}
                    onChange={(e) => setBizBio(e.target.value)}
                    placeholder="Ex: Cortes clássicos, manicure de alto padrão, etc."
                  />
                </div>

                <Button onClick={handleSaveCompanyInfo} className="font-semibold">
                  Salvar Informações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};
export default AdminDashboard;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CalendarDays,
  Crown,
  DollarSign,
  ExternalLink,
  LayoutDashboard,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useSaas } from '@/contexts/SaasContext';
import { supabase } from '@/integrations/supabase/client';
import type { MasterAccountRow, MasterUserRow } from '@/types/saas';

const PLAN_OPTIONS: { value: NonNullable<MasterAccountRow['plan']>; label: string }[] = [
  { value: 'trial', label: 'Teste' },
  { value: 'basic', label: 'Básico' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

const STATUS_OPTIONS: { value: NonNullable<MasterAccountRow['subscription_status']>; label: string }[] = [
  { value: 'trial', label: 'Em teste' },
  { value: 'active', label: 'Ativa' },
  { value: 'past_due', label: 'Pagamento atrasado' },
  { value: 'expired', label: 'Expirada' },
  { value: 'canceled', label: 'Cancelada' },
];

const currency = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

const dateLabel = (value: string | null | undefined) =>
  value ? format(new Date(value), 'dd/MM/yyyy', { locale: ptBR }) : '—';

const statusBadge = (status: MasterAccountRow['subscription_status']) => {
  switch (status) {
    case 'active':
      return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Ativa</Badge>;
    case 'trial':
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Em teste</Badge>;
    case 'past_due':
      return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">Atrasada</Badge>;
    case 'canceled':
      return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Cancelada</Badge>;
    default:
      return <Badge variant="outline">Expirada</Badge>;
  }
};

const MasterDashboard: React.FC = () => {
  const { user, logout, reloadOwnedTenants } = useAuth();
  const { tenants, setCurrentTenant } = useSaas();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<MasterAccountRow[]>([]);
  const [users, setUsers] = useState<MasterUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [accountsResult, usersResult] = await Promise.all([
      supabase.rpc('master_list_accounts'),
      supabase.rpc('master_list_users'),
    ]);

    if (accountsResult.error || usersResult.error) {
      const message = accountsResult.error?.message ?? usersResult.error?.message ?? 'Erro desconhecido.';
      console.error('Master dashboard load failed:', message);
      setError('Não foi possível carregar os dados do painel master.');
      setLoading(false);
      return;
    }

    setAccounts((accountsResult.data ?? []) as MasterAccountRow[]);
    setUsers((usersResult.data ?? []) as MasterUserRow[]);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    const active = accounts.filter((account) => account.subscription_status === 'active').length;
    const trial = accounts.filter((account) => account.subscription_status === 'trial').length;
    const revenue = accounts.reduce((total, account) => total + (Number(account.revenue_total) || 0), 0);
    const appointments = accounts.reduce((total, account) => total + (Number(account.appointments_count) || 0), 0);
    const clients = accounts.reduce((total, account) => total + (Number(account.clients_count) || 0), 0);
    return { active, trial, revenue, appointments, clients };
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return accounts;
    return accounts.filter((account) =>
      [account.name, account.slug, account.owner_email, account.owner_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [accounts, search]);

  const filteredUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return users;
    return users.filter((row) =>
      [row.email, row.full_name].filter(Boolean).some((value) => value.toLowerCase().includes(term)),
    );
  }, [users, userSearch]);

  const applySubscription = useCallback(async (
    account: MasterAccountRow,
    patch: { plan?: MasterAccountRow['plan']; status?: MasterAccountRow['subscription_status']; trialEndsAt?: string | null },
  ) => {
    const plan = patch.plan ?? account.plan ?? 'trial';
    const status = patch.status ?? account.subscription_status ?? 'trial';

    setBusyId(account.tenant_id);
    const { error: rpcError } = await supabase.rpc('master_set_subscription', {
      _tenant_id: account.tenant_id,
      _plan: plan,
      _status: status,
      _trial_ends_at: patch.trialEndsAt ?? null,
    });
    setBusyId(null);

    if (rpcError) {
      console.error('master_set_subscription failed:', rpcError.message);
      toast.error('Não foi possível atualizar a conta.');
      return;
    }

    toast.success(`Conta "${account.name}" atualizada.`);
    await loadData();
    await reloadOwnedTenants();
  }, [loadData, reloadOwnedTenants]);

  const handlePlanChange = (account: MasterAccountRow, plan: NonNullable<MasterAccountRow['plan']>) => {
    const status = plan === 'trial'
      ? 'trial'
      : (account.subscription_status === 'trial' ? 'active' : account.subscription_status);
    void applySubscription(account, { plan, status });
  };

  const handleStatusChange = (
    account: MasterAccountRow,
    status: NonNullable<MasterAccountRow['subscription_status']>,
  ) => {
    void applySubscription(account, { status });
  };

  const extendTrial = (account: MasterAccountRow, days: number) => {
    const currentEnd = account.trial_ends_at ? Date.parse(account.trial_ends_at) : NaN;
    const base = Math.max(Date.now(), Number.isNaN(currentEnd) ? Date.now() : currentEnd);
    const next = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
    void applySubscription(account, { status: 'trial', trialEndsAt: next });
  };

  const openPanel = (account: MasterAccountRow) => {
    const tenant = tenants.find((item) => item.id === account.tenant_id);
    if (!tenant) {
      toast.error('Conta ainda não carregada. Recarregue a página e tente novamente.');
      return;
    }
    setCurrentTenant(tenant);
    navigate('/admin');
  };

  const transferOwner = async (account: MasterAccountRow) => {
    const email = window.prompt(
      `Novo proprietário de "${account.name}" (e-mail já cadastrado):`,
      account.owner_email ?? '',
    );
    if (!email || !email.trim()) return;

    setBusyId(account.tenant_id);
    const { error: rpcError } = await supabase.rpc('master_set_tenant_owner', {
      _tenant_id: account.tenant_id,
      _email: email.trim(),
    });
    setBusyId(null);

    if (rpcError) {
      console.error('master_set_tenant_owner failed:', rpcError.message);
      toast.error(rpcError.message.includes('user_not_found')
        ? 'Não existe usuário cadastrado com esse e-mail.'
        : 'Não foi possível transferir a conta.');
      return;
    }

    toast.success('Propriedade transferida.');
    await loadData();
  };

  const deleteTenant = async (account: MasterAccountRow) => {
    const confirmation = window.prompt(
      `Isso apaga "${account.name}" e TODOS os dados (agendamentos, clientes, serviços).\nDigite o slug "${account.slug}" para confirmar:`,
    );
    if (confirmation === null) return;
    if (confirmation.trim() !== account.slug) {
      toast.error('Slug não confere. Exclusão cancelada.');
      return;
    }

    setBusyId(account.tenant_id);
    const { error: rpcError } = await supabase.rpc('master_delete_tenant', {
      _tenant_id: account.tenant_id,
    });
    setBusyId(null);

    if (rpcError) {
      console.error('master_delete_tenant failed:', rpcError.message);
      toast.error('Não foi possível excluir a conta.');
      return;
    }

    toast.success(`Conta "${account.name}" excluída.`);
    await loadData();
    await reloadOwnedTenants();
  };

  const toggleMaster = async (row: MasterUserRow) => {
    if (row.user_id === user?.id) {
      toast.error('Você não pode remover seu próprio acesso master.');
      return;
    }

    setBusyId(row.user_id);
    const { error: rpcError } = await supabase.rpc('master_set_master', {
      _user_id: row.user_id,
      _enabled: !row.is_master,
    });
    setBusyId(null);

    if (rpcError) {
      console.error('master_set_master failed:', rpcError.message);
      toast.error(rpcError.message.includes('last_master')
        ? 'A plataforma precisa de pelo menos um master.'
        : 'Não foi possível alterar o acesso master.');
      return;
    }

    toast.success(row.is_master ? 'Acesso master removido.' : 'Acesso master concedido.');
    await loadData();
  };

  const deleteUser = async (row: MasterUserRow) => {
    if (row.user_id === user?.id) {
      toast.error('Você não pode excluir a própria conta.');
      return;
    }
    if (row.is_master) {
      toast.error('Remova o acesso master antes de excluir este usuário.');
      return;
    }

    const ownedAccounts = Number(row.tenant_count) || 0;
    const warning = ownedAccounts > 0
      ? `\n\nATENÇÃO: ${ownedAccounts} conta(s) da qual este usuário é o único dono também será(ão) apagada(s), com agendamentos, clientes e serviços.`
      : '';
    const confirmation = window.prompt(
      `Excluir definitivamente o usuário ${row.email}?${warning}\n\nDigite o e-mail para confirmar:`,
    );
    if (confirmation === null) return;
    if (confirmation.trim().toLowerCase() !== row.email.trim().toLowerCase()) {
      toast.error('E-mail não confere. Exclusão cancelada.');
      return;
    }

    setBusyId(row.user_id);
    const { data, error: rpcError } = await supabase.rpc('master_delete_user', {
      _user_id: row.user_id,
    });
    setBusyId(null);

    if (rpcError) {
      console.error('master_delete_user failed:', rpcError.message);
      toast.error(rpcError.message.includes('cannot_delete_self')
        ? 'Você não pode excluir a própria conta.'
        : rpcError.message.includes('cannot_delete_master')
          ? 'Remova o acesso master antes de excluir este usuário.'
          : rpcError.message.includes('user_not_found')
            ? 'Usuário não encontrado.'
            : 'Não foi possível excluir o usuário.');
      return;
    }

    const deletedTenants = Number((data as { deleted_tenants?: number } | null)?.deleted_tenants) || 0;
    toast.success(deletedTenants > 0
      ? `Usuário excluído junto com ${deletedTenants} conta(s).`
      : 'Usuário excluído.');
    await loadData();
    await reloadOwnedTenants();
  };

  const handleLogout = async () => {
    const result = await logout();
    if (!result.success) {
      toast.error(result.error || 'Não foi possível encerrar a sessão.');
      return;
    }
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-20">
        <div className="container mx-auto max-w-7xl px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold leading-tight">Painel Master</h1>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Super Admin
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Controle total de contas e dados da plataforma
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild className="h-9 text-xs hidden sm:inline-flex">
              <Link to="/admin">
                <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" />
                Meu painel
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void handleLogout()}
              className="h-9 text-xs text-muted-foreground hover:text-destructive"
              title="Sair da conta"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Visão geral da plataforma</h2>
            <p className="text-sm text-muted-foreground">
              Logado como {user?.email}. Aqui você vê e administra todas as contas.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Ver site
              </Link>
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                <Store className="h-3.5 w-3.5" /> Contas
              </div>
              <p className="text-2xl font-bold mt-1">{accounts.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                <ShieldCheck className="h-3.5 w-3.5" /> Ativas
              </div>
              <p className="text-2xl font-bold mt-1 text-emerald-600">{stats.active}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                <CalendarDays className="h-3.5 w-3.5" /> Em teste
              </div>
              <p className="text-2xl font-bold mt-1 text-amber-600">{stats.trial}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                <DollarSign className="h-3.5 w-3.5" /> Receita
              </div>
              <p className="text-xl font-bold mt-1">{currency(stats.revenue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                <CalendarDays className="h-3.5 w-3.5" /> Agendamentos
              </div>
              <p className="text-2xl font-bold mt-1">{stats.appointments}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                <Users className="h-3.5 w-3.5" /> Clientes
              </div>
              <p className="text-2xl font-bold mt-1">{stats.clients}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="contas" className="space-y-4">
          <TabsList>
            <TabsTrigger value="contas">Contas ({accounts.length})</TabsTrigger>
            <TabsTrigger value="usuarios">Usuários ({users.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="contas" className="space-y-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por conta, slug ou e-mail do dono..."
                className="pl-9"
              />
            </div>

            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-base">Contas cadastradas</CardTitle>
                <CardDescription>
                  Altere plano, status e teste; abra o painel da conta; transfira a propriedade ou exclua tudo.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredAccounts.length === 0 ? (
                  <div className="py-14 text-center text-sm text-muted-foreground">
                    Nenhuma conta encontrada.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Conta</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Teste até</TableHead>
                        <TableHead className="text-right">Métricas</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAccounts.map((account) => (
                        <TableRow key={account.tenant_id}>
                          <TableCell className="align-top">
                            <div className="font-semibold leading-tight">{account.name}</div>
                            <div className="text-xs text-muted-foreground">/{account.slug}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {account.owner_email ?? 'sem dono'}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <Select
                              value={account.plan ?? 'trial'}
                              onValueChange={(value) => handlePlanChange(account, value as NonNullable<MasterAccountRow['plan']>)}
                              disabled={busyId === account.tenant_id}
                            >
                              <SelectTrigger className="h-8 w-[120px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PLAN_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value} className="text-xs">
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="space-y-1">
                              {statusBadge(account.subscription_status)}
                              <Select
                                value={account.subscription_status ?? 'trial'}
                                onValueChange={(value) => handleStatusChange(account, value as NonNullable<MasterAccountRow['subscription_status']>)}
                                disabled={busyId === account.tenant_id}
                              >
                                <SelectTrigger className="h-8 w-[150px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value} className="text-xs">
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="text-xs">{dateLabel(account.trial_ends_at)}</div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[11px] mt-1"
                              onClick={() => extendTrial(account, 7)}
                              disabled={busyId === account.tenant_id}
                            >
                              +7 dias
                            </Button>
                          </TableCell>
                          <TableCell className="align-top text-right text-xs text-muted-foreground whitespace-nowrap">
                            <div>{Number(account.services_count) || 0} serviços</div>
                            <div>{Number(account.professionals_count) || 0} profissionais</div>
                            <div>{Number(account.appointments_count) || 0} agendamentos</div>
                            <div>{Number(account.clients_count) || 0} clientes</div>
                            <div className="font-semibold text-foreground">{currency(account.revenue_total)}</div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={() => openPanel(account)}
                                disabled={busyId === account.tenant_id}
                              >
                                <LayoutDashboard className="h-3.5 w-3.5 mr-1" />
                                Painel
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8" asChild title="Abrir página pública">
                                <a href={`/${account.slug}`} target="_blank" rel="noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                title="Transferir propriedade"
                                onClick={() => void transferOwner(account)}
                                disabled={busyId === account.tenant_id}
                              >
                                <UserCog className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                title="Excluir conta e todos os dados"
                                onClick={() => void deleteTenant(account)}
                                disabled={busyId === account.tenant_id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usuarios" className="space-y-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Buscar por nome ou e-mail..."
                className="pl-9"
              />
            </div>

            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-base">Usuários da plataforma</CardTitle>
                <CardDescription>
                  Conceda ou remova o acesso master e exclua usuários. Contas em que o usuário é o único dono são apagadas junto.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-14 text-center text-sm text-muted-foreground">
                    Nenhum usuário encontrado.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Contas próprias</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead>Último acesso</TableHead>
                        <TableHead className="text-right">Acesso</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((row) => (
                        <TableRow key={row.user_id}>
                          <TableCell>
                            <div className="font-semibold leading-tight flex items-center gap-2">
                              {row.full_name || row.email}
                              {row.is_master && (
                                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] gap-1">
                                  <Crown className="h-3 w-3" /> master
                                </Badge>
                              )}
                              {row.user_id === user?.id && (
                                <Badge variant="outline" className="text-[10px]">você</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{row.email}</div>
                          </TableCell>
                          <TableCell className="text-sm">{Number(row.tenant_count) || 0}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{dateLabel(row.created_at)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{dateLabel(row.last_sign_in_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant={row.is_master ? 'outline' : 'default'}
                                className="h-8 text-xs"
                                onClick={() => void toggleMaster(row)}
                                disabled={busyId === row.user_id || row.user_id === user?.id}
                              >
                                {row.is_master ? 'Remover master' : 'Tornar master'}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                title={row.is_master
                                  ? 'Remova o acesso master antes de excluir'
                                  : 'Excluir usuário definitivamente'}
                                onClick={() => void deleteUser(row)}
                                disabled={busyId === row.user_id || row.user_id === user?.id || row.is_master}
                              >
                                {busyId === row.user_id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <Trash2 className="h-4 w-4" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default MasterDashboard;

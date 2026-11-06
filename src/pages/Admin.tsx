import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { ptBR } from 'date-fns/locale';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Lock, LogOut, Trash2, ArrowLeft } from 'lucide-react';
import { BusinessSettings, DEFAULT_SETTINGS, generateSlots, toMin } from '@/lib/slots';

const ADMIN_EMAIL = 'dona@juliananailsdesign.app';

type Service = { id: string; name: string; active: boolean; sort_order: number };

const toKey = (d: Date) => format(d, 'yyyy-MM-dd');

const Login = ({ onDone }: { onDone: () => void }) => {
  const [pwd, setPwd] = useState('');
  const [first, setFirst] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.rpc('admin_exists').then(({ data }) => setFirst(data === false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = first
      ? await supabase.auth.signUp({ email: ADMIN_EMAIL, password: pwd })
      : await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: pwd });
    setLoading(false);
    if (error) return toast.error(first ? 'Senha fraca ou inválida (mín. 6 caracteres)' : 'Senha incorreta');
    onDone();
  };

  return (
    <Card className="max-w-sm mx-auto mt-16">
      <CardHeader className="text-center">
        <Lock className="h-6 w-6 text-primary mx-auto" />
        <CardTitle className="text-lg">{first ? 'Crie sua senha de acesso' : 'Área da Laryssa'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <Input type="password" placeholder="Senha" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          <Button className="w-full" disabled={loading || pwd.length < 6}>Entrar</Button>
        </form>
      </CardContent>
    </Card>
  );
};

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const HoursTab = () => {
  const [s, setS] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    supabase.from('business_settings').select('*').eq('id', 1).maybeSingle()
      .then(({ data }) => data && setS(data as BusinessSettings));
  }, []);
  const set = (k: keyof BusinessSettings, v: unknown) => setS((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (toMin(s.close_time) <= toMin(s.open_time)) return toast.error('O fim deve ser depois do início');
    const { error } = await supabase.from('business_settings').update({
      open_time: s.open_time, close_time: s.close_time,
      lunch_start: s.lunch_start || null, lunch_end: s.lunch_end || null,
      service_minutes: Number(s.service_minutes), slot_interval_minutes: Number(s.slot_interval_minutes),
      open_weekdays: s.open_weekdays, updated_at: new Date().toISOString(),
    }).eq('id', 1);
    error ? toast.error('Erro ao salvar') : toast.success('Horários salvos');
  };
  const field = (label: string, el: React.ReactNode) => (
    <label className="space-y-1 text-sm"><span className="text-muted-foreground">{label}</span>{el}</label>
  );
  const preview = generateSlots({ ...s, open_weekdays: [1] }, new Date(2026, 10, 9));
  return (
    <Card><CardContent className="pt-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {field('Início do expediente', <Input type="time" value={s.open_time} onChange={(e) => set('open_time', e.target.value)} />)}
        {field('Fim do expediente', <Input type="time" value={s.close_time} onChange={(e) => set('close_time', e.target.value)} />)}
        {field('Almoço início', <Input type="time" value={s.lunch_start || ''} onChange={(e) => set('lunch_start', e.target.value)} />)}
        {field('Almoço fim', <Input type="time" value={s.lunch_end || ''} onChange={(e) => set('lunch_end', e.target.value)} />)}
        {field('Tempo de atendimento (min)', <Input type="number" min={5} value={s.service_minutes} onChange={(e) => set('service_minutes', e.target.value)} />)}
        {field('Horário a cada (min)', <Input type="number" min={5} value={s.slot_interval_minutes} onChange={(e) => set('slot_interval_minutes', e.target.value)} />)}
      </div>
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">Dias de atendimento</span>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d, i) => {
            const on = s.open_weekdays.includes(i);
            return (
              <Button key={d} type="button" size="sm" variant={on ? 'default' : 'outline'}
                onClick={() => set('open_weekdays', on ? s.open_weekdays.filter((x) => x !== i) : [...s.open_weekdays, i].sort())}>
                {d}
              </Button>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Prévia: {preview.join(', ') || 'nenhum horário'}</p>
      <Button className="w-full" onClick={save}>Salvar</Button>
    </CardContent></Card>
  );
};

const Dashboard = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [newName, setNewName] = useState('');

  const load = async () => {
    const [s, b] = await Promise.all([
      supabase.from('services').select('*').order('sort_order'),
      supabase.from('blocked_dates').select('date'),
    ]);
    setServices((s.data as Service[]) || []);
    setBlocked((b.data || []).map((r) => r.date));
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from('services').insert({ name: newName.trim(), sort_order: services.length + 1 });
    if (error) return toast.error('Erro ao adicionar');
    setNewName(''); load();
  };
  const update = async (id: string, patch: Partial<Service>) => {
    await supabase.from('services').update(patch).eq('id', id); load();
  };
  const remove = async (id: string) => {
    await supabase.from('services').delete().eq('id', id); load();
  };
  const toggleDay = async (d?: Date) => {
    if (!d) return;
    const key = toKey(d);
    if (blocked.includes(key)) {
      await supabase.from('blocked_dates').delete().eq('date', key);
      toast.success('Dia liberado');
    } else {
      await supabase.from('blocked_dates').insert({ date: key });
      toast.success('Dia bloqueado');
    }
    load();
  };

  return (
    <Tabs defaultValue="services" className="max-w-lg mx-auto">
      <TabsList className="grid grid-cols-3 w-full">
        <TabsTrigger value="services">Serviços</TabsTrigger>
        <TabsTrigger value="hours">Horários</TabsTrigger>
        <TabsTrigger value="days">Bloqueios</TabsTrigger>
      </TabsList>
      <TabsContent value="hours"><HoursTab /></TabsContent>
      <TabsContent value="services">
        <Card><CardContent className="pt-6 space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Novo serviço" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Button onClick={add}>Adicionar</Button>
          </div>
          {services.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <Input defaultValue={s.name} onBlur={(e) => e.target.value !== s.name && update(s.id, { name: e.target.value })} />
              <Switch checked={s.active} onCheckedChange={(v) => update(s.id, { active: v })} />
              <Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">O botão liga/desliga mostra ou esconde o serviço para as clientes.</p>
        </CardContent></Card>
      </TabsContent>
      <TabsContent value="days">
        <Card><CardContent className="pt-6 flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground text-center">Toque num dia para bloquear ou liberar.</p>
          <Calendar
            mode="multiple"
            locale={ptBR}
            selected={blocked.map((k) => new Date(k + 'T12:00:00'))}
            onDayClick={toggleDay}
            className="rounded-lg border"
            modifiersClassNames={{ selected: 'bg-destructive text-destructive-foreground' }}
          />
        </CardContent></Card>
      </TabsContent>
    </Tabs>
  );
};

const Admin = () => {
  const [state, setState] = useState<'loading' | 'out' | 'in' | 'denied'>('loading');

  const check = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return setState('out');
    const { data: ok } = await supabase.rpc('has_role', { _user_id: data.user.id, _role: 'admin' });
    setState(ok ? 'in' : 'denied');
  };
  useEffect(() => {
    check();
    const { data } = supabase.auth.onAuthStateChange(() => setTimeout(check, 0));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background px-4 py-6">
      <div className="max-w-lg mx-auto flex justify-between items-center mb-4">
        <Link to="/" className="text-sm text-muted-foreground flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Site</Link>
        <h1 className="font-semibold text-foreground">Painel laryssaresende.nails</h1>
        {state === 'in' ? (
          <Button variant="ghost" size="icon" onClick={() => supabase.auth.signOut()}><LogOut className="h-4 w-4" /></Button>
        ) : <span className="w-9" />}
      </div>
      {state === 'out' && <Login onDone={check} />}
      {state === 'in' && <Dashboard />}
      {state === 'denied' && <p className="text-center text-muted-foreground">Acesso não autorizado.</p>}
    </div>
  );
};

export default Admin;

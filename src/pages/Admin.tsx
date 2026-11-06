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
      <TabsList className="grid grid-cols-2 w-full">
        <TabsTrigger value="services">Serviços</TabsTrigger>
        <TabsTrigger value="days">Dias bloqueados</TabsTrigger>
      </TabsList>
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

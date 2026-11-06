import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { useAvailableTimes } from '@/hooks/use-available-times';

type Appt = { id: string; client_name: string; phone: string; service: string; date: string; time: string };

const Mover = ({ a, onDone }: { a: Appt; onDone: () => void }) => {
  const [date, setDate] = useState<Date>();
  const { times } = useAvailableTimes(date);
  const move = async (time: string) => {
    const { error } = await supabase.from('appointments').update({ date: format(date!, 'yyyy-MM-dd'), time }).eq('id', a.id);
    if (error) return toast.error(error.code === '23505' ? 'Horário já ocupado' : 'Erro ao remarcar');
    toast.success('Remarcado');
    onDone();
  };
  return (
    <div className="space-y-2 pt-2">
      <Calendar mode="single" locale={ptBR} selected={date} onSelect={setDate} className="rounded-lg border mx-auto" />
      {date && <div className="grid grid-cols-4 gap-1">{times.map((t) => <Button key={t} size="sm" variant="outline" onClick={() => move(t)}>{t}</Button>)}</div>}
    </div>
  );
};

export const AppointmentsTab = () => {
  const [day, setDay] = useState<Date>(new Date());
  const [list, setList] = useState<Appt[]>([]);
  const [moving, setMoving] = useState<string | null>(null);
  const key = format(day, 'yyyy-MM-dd');

  const load = async () => {
    const { data } = await supabase.from('appointments').select('*').eq('date', key).eq('status', 'active').order('time');
    setList((data as Appt[]) || []);
    setMoving(null);
  };
  useEffect(() => { load(); }, [key]);

  const cancel = async (id: string) => {
    if (!confirm('Cancelar este agendamento?')) return;
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
    toast.success('Cancelado');
    load();
  };

  return (
    <Card><CardContent className="pt-6 space-y-3">
      <Calendar mode="single" locale={ptBR} selected={day} onSelect={(d) => d && setDay(d)} className="rounded-lg border mx-auto" />
      <p className="text-sm font-medium text-foreground capitalize">{format(day, "EEEE, dd/MM", { locale: ptBR })}</p>
      {list.length === 0 && <p className="text-sm text-muted-foreground">Nenhum agendamento neste dia.</p>}
      {list.map((a) => (
        <div key={a.id} className="rounded-lg border border-border p-3 text-sm">
          <div className="flex justify-between gap-2">
            <div>
              <p className="font-semibold text-foreground">{a.time} · {a.client_name}</p>
              <p className="text-muted-foreground">{a.service}</p>
              <a className="text-primary" href={`https://wa.me/55${a.phone.replace(/^55/, '')}`}>{a.phone}</a>
            </div>
            <div className="flex flex-col gap-1">
              <Button size="sm" variant="outline" onClick={() => setMoving(moving === a.id ? null : a.id)}>Remarcar</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => cancel(a.id)}>Cancelar</Button>
            </div>
          </div>
          {moving === a.id && <Mover a={a} onDone={load} />}
        </div>
      ))}
    </CardContent></Card>
  );
};

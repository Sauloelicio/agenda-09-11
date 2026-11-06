import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { CalendarClock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAvailableTimes } from '@/hooks/use-available-times';
import { canClientChange } from '@/lib/slots';
import { useSchedule } from '@/contexts/ScheduleContext';

type Appt = { id: string; client_name: string; service: string; date: string; time: string };

const WHATS = '557996737776';
const fmt = (d: string) => format(new Date(d + 'T12:00:00'), "EEEE, dd/MM/yyyy", { locale: ptBR });

export const RescheduleDialog = () => {
  const { bumpSlots } = useSchedule();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [appt, setAppt] = useState<Appt | null | undefined>(undefined);
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);
  const { times, settings } = useAvailableTimes(date);

  const find = async () => {
    setBusy(true);
    const { data } = await supabase.rpc('find_my_appointment', { _phone: phone });
    setAppt((data as Appt[])?.[0] ?? null);
    setBusy(false);
  };

  const fail = (msg: string) => {
    const m = msg.includes('too_late') ? 'Faltam menos de 2 horas. Fale com a Laryssa pelo WhatsApp.'
      : msg.includes('slot_taken') ? 'Esse horário acabou de ser reservado. Escolha outro.'
      : 'Não foi possível concluir. Tente de novo.';
    toast({ title: 'Ops', description: m, variant: 'destructive' });
  };

  const reschedule = async () => {
    if (!appt || !date || !time) return;
    setBusy(true);
    const newDate = format(date, 'yyyy-MM-dd');
    const { error } = await supabase.rpc('reschedule_appointment', { _id: appt.id, _phone: phone, _date: newDate, _time: time });
    setBusy(false);
    if (error) return fail(error.message);
    bumpSlots();
    const msg = `🔄 Horário alterado!\n\nOlá, ${appt.client_name}!\nSeu atendimento na laryssaresende.nails foi remarcado.\n\n❌ Antes: ${fmt(appt.date)} às ${appt.time}\n📆 Nova data: ${fmt(newDate)}\n⏰ Novo horário: ${time}\n💛 Serviço: ${appt.service}\n\nTe esperamos! 💛🤍`;
    const url = `https://wa.me/${WHATS}?text=${encodeURIComponent(msg)}`;
    if (!window.open(url, "_blank", "noopener,noreferrer")) {
      try { (window.top ?? window).location.href = url; } catch { window.location.href = url; }
    }
  };

  const cancel = async () => {
    if (!appt || !confirm('Cancelar este agendamento?')) return;
    setBusy(true);
    const { error } = await supabase.rpc('cancel_appointment', { _id: appt.id, _phone: phone });
    setBusy(false);
    if (error) return fail(error.message);
    bumpSlots();
    toast({ title: 'Agendamento cancelado' });
    setAppt(null);
  };

  const tooLate = appt ? !canClientChange(appt.date, appt.time, new Date()) : false;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setAppt(undefined); setDate(undefined); setTime(''); } }}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full text-sm text-primary">
          <CalendarClock className="h-4 w-4 mr-2" />Remarcar ou cancelar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Remarcar ou cancelar</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Digite o telefone usado no agendamento.</p>
          <div className="flex gap-2">
            <Input inputMode="tel" placeholder="(79) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button onClick={find} disabled={busy || phone.replace(/\D/g, '').length < 10}>Buscar</Button>
          </div>
        </div>
        {appt === null && <p className="text-sm text-muted-foreground text-center">Nenhum agendamento encontrado.</p>}
        {appt && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium text-foreground">{appt.client_name}</p>
              <p className="text-muted-foreground capitalize">{fmt(appt.date)} às {appt.time}</p>
              <p className="text-muted-foreground">{appt.service}</p>
            </div>
            {tooLate ? (
              <p className="text-sm text-destructive text-center">Faltam menos de 2 horas. Para mudar, fale com a Laryssa pelo WhatsApp.</p>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">Escolha a nova data</p>
                <div className="flex justify-center">
                  <Calendar mode="single" locale={ptBR} selected={date} onSelect={(d) => { setDate(d); setTime(''); }}
                    disabled={(d) => { const t = new Date(); t.setHours(0, 0, 0, 0); return d < t || !settings.open_weekdays.includes(d.getDay()); }}
                    className="rounded-lg border" />
                </div>
                {date && (times.length ? (
                  <div className="grid grid-cols-3 gap-2">
                    {times.map((t) => (
                      <Button key={t} size="sm" variant={t === time ? 'default' : 'outline'} onClick={() => setTime(t)}>{t}</Button>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center">Sem horários livres neste dia</p>)}
                <Button className="w-full" disabled={!time || busy} onClick={reschedule}>Confirmar novo horário</Button>
                <Button variant="outline" className="w-full text-destructive" disabled={busy} onClick={cancel}>Cancelar agendamento</Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

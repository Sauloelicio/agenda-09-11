
import React from 'react';
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { CalendarIcon } from "lucide-react";
import { useSchedule } from '@/contexts/ScheduleContext';
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import { useBusinessSettings } from '@/hooks/use-business-settings';
import { supabase } from '@/integrations/supabase/client';

export const DateSelector = () => {
  const { scheduleData, setSelectedDate } = useSchedule();
  const settings = useBusinessSettings();
  const [blocked, setBlocked] = React.useState<string[]>([]);
  React.useEffect(() => {
    supabase.from('blocked_dates').select('date').then(({ data }) => setBlocked((data || []).map((r) => r.date)));
  }, []);

  return (
    <div className="space-y-3">
      <Label className="text-foreground flex items-center gap-2 text-sm">
        <CalendarIcon className="h-4 w-4 text-primary" />
        Selecione a Data
      </Label>
      <div className="flex justify-center">
        <Calendar
          mode="single"
          selected={scheduleData.selectedDate}
          onSelect={setSelectedDate}
          disabled={(date) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dayOfWeek = date.getDay();
            // Desabilita datas passadas e domingos (dia 0)
            return date < today || !settings.open_weekdays.includes(dayOfWeek) || blocked.includes(format(date, 'yyyy-MM-dd'));
          }}
          locale={ptBR}
          className="rounded-lg border border-border bg-card text-foreground scale-90 sm:scale-100"
          classNames={{
            months: "flex w-full flex-col space-y-4",
            month: "space-y-4 w-full",
            caption: "flex justify-center pt-1 relative items-center text-foreground",
            caption_label: "text-sm font-medium text-foreground",
            nav: "space-x-1 flex items-center",
            nav_button: "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 border border-border bg-transparent hover:bg-muted text-foreground h-7 w-7",
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse space-y-1",
            head_row: "flex",
            head_cell: "text-muted-foreground rounded-md w-8 font-normal text-xs",
            row: "flex w-full mt-2",
            cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
            day: "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 hover:bg-muted h-8 w-8 text-foreground",
            day_selected: "bg-primary text-primary-foreground hover:bg-primary/90",
            day_today: "bg-muted text-foreground",
            day_outside: "text-muted-foreground opacity-50",
            day_disabled: "text-muted-foreground opacity-30",
          }}
        />
      </div>
    </div>
  );
};

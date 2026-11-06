import React from 'react';
import { Clock } from 'lucide-react';
import { useBusinessSettings } from '@/hooks/use-business-settings';

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const BusinessHours = () => {
  const s = useBusinessSettings();
  return (
    <div className="mt-6 pt-6 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-primary" />
        <h3 className="text-foreground font-semibold text-sm">Horário de Funcionamento</h3>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        {DAYS.map((d, i) => (
          <div key={d} className="flex justify-between">
            <span>{d}</span>
            {s.open_weekdays.includes(i)
              ? <span>{s.open_time} às {s.close_time}</span>
              : <span className="text-destructive">Fechado</span>}
          </div>
        ))}
        {s.lunch_start && s.lunch_end && (
          <div className="text-xs italic mt-2">Intervalo de almoço: {s.lunch_start} às {s.lunch_end}</div>
        )}
      </div>
    </div>
  );
};

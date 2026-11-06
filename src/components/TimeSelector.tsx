
import React from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";
import { useSchedule } from '@/contexts/ScheduleContext';

import { useAvailableTimes } from '@/hooks/use-available-times';

export const TimeSelector = () => {
  const { scheduleData, setSelectedTime, slotsVersion } = useSchedule();
  const { times: availableTimes, settings } = useAvailableTimes(scheduleData.selectedDate, undefined, slotsVersion);
  const occupiedTimes: string[] = [];
  
  const getDayStatus = (date: Date) => settings.open_weekdays.includes(date.getDay()) ? "Aberto" : "Fechado";

  return (
    <div className="space-y-3">
      <Label className="text-foreground flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 text-primary" />
        Horários Disponíveis
        {scheduleData.selectedDate && (
          <span className="text-xs text-muted-foreground">
            ({getDayStatus(scheduleData.selectedDate)})
          </span>
        )}
      </Label>
      
      {!scheduleData.selectedDate ? (
        <div className="text-muted-foreground text-center py-6 text-sm">
          Selecione uma data primeiro
        </div>
      ) : availableTimes.length === 0 ? (
        <div className="text-muted-foreground text-center py-6 text-sm">
          Sem horários livres neste dia
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
          {availableTimes.map((time) => {
            const isOccupied = occupiedTimes.includes(time);
            const isSelected = scheduleData.selectedTime === time;
            
            return (
              <Button
                key={time}
                variant={isSelected ? "default" : "outline"}
                onClick={() => !isOccupied && setSelectedTime(time)}
                disabled={isOccupied}
                className={`text-xs p-2 h-auto ${
                  isOccupied
                    ? "bg-destructive/20 border-destructive text-destructive cursor-not-allowed opacity-60"
                    : isSelected
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted text-foreground border-border hover:border-primary"
                }`}
              >
                {time}
                {isOccupied && (
                  <span className="block text-xs text-destructive mt-1">
                    Ocupado
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
};

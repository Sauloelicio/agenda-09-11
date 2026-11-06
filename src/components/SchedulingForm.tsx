
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MessageSquare } from "lucide-react";
import { ClientForm } from './ClientForm';
import { DateSelector } from './DateSelector';
import { TimeSelector } from './TimeSelector';
import { ScheduleSummary } from './ScheduleSummary';
import { ScheduleButton } from './ScheduleButton';
import { RescheduleDialog } from './RescheduleDialog';
import { BusinessHours } from './BusinessHours';

export const SchedulingForm = () => {
  return (
    <Card className="bg-card backdrop-blur-sm border-border shadow-xl">
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-xl text-foreground flex items-center justify-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Agende seu Horário
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Preencha os dados para agendar seu atendimento
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <ClientForm />
        <DateSelector />
        <TimeSelector />
        <ScheduleSummary />
        <ScheduleButton />
        <RescheduleDialog />
        <BusinessHours />
      </CardContent>
    </Card>
  );
};

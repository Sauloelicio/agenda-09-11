
import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Phone, Sparkles } from "lucide-react";
import { useSchedule } from '@/contexts/ScheduleContext';

import { supabase } from '@/integrations/supabase/client';

export const ClientForm = () => {
  const { scheduleData, setClientName, setPhoneNumber, setSelectedService } = useSchedule();
  const [services, setServices] = React.useState<string[]>([]);
  React.useEffect(() => {
    supabase.from('services').select('name').eq('active', true).order('sort_order')
      .then(({ data }) => setServices((data || []).map((s) => s.name)));
  }, []);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-foreground flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-primary" />
          Nome Completo
        </Label>
        <Input
          id="name"
          value={scheduleData.clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Digite seu nome completo"
          className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone" className="text-foreground flex items-center gap-2 text-sm">
          <Phone className="h-4 w-4 text-primary" />
          Telefone (WhatsApp)
        </Label>
        <Input
          id="phone"
          value={scheduleData.phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="(79) 98868-9607"
          className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="service" className="text-foreground flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          Serviço Desejado
        </Label>
        <Select value={scheduleData.selectedService} onValueChange={setSelectedService}>
          <SelectTrigger className="bg-background border-border text-foreground focus:border-primary">
            <SelectValue placeholder="Selecione o serviço" />
          </SelectTrigger>
          <SelectContent>
            {services.map((service) => (
              <SelectItem key={service} value={service}>
                {service}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { MessageSquare, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSchedule } from '@/contexts/ScheduleContext';
import { supabase } from '@/integrations/supabase/client';

export const ScheduleButton = () => {
  const { scheduleData, reset } = useSchedule();
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  const isFormValid = scheduleData.clientName && 
                     scheduleData.phoneNumber && 
                     scheduleData.selectedDate && 
                     scheduleData.selectedTime &&
                     scheduleData.selectedService;

  const generateMessage = () => {
    if (!scheduleData.selectedDate) return '';
    
    const formattedDate = format(scheduleData.selectedDate, "dd/MM/yyyy", { locale: ptBR });
    const dayOfWeekName = format(scheduleData.selectedDate, "EEEE", { locale: ptBR });
    
    return `✨ Agendamento Confirmado! ✨

Olá, ${scheduleData.clientName}!
Seu horário foi reservado com sucesso na laryssaresende.nails 💅✨

📆 Data: ${dayOfWeekName}, ${formattedDate}
⏰ Horário: ${scheduleData.selectedTime}
💛 Serviço: ${scheduleData.selectedService}

Estamos felizes em te receber!
Qualquer dúvida ou alteração, é só chamar aqui mesmo. 💬

Obrigada por escolher a laryssaresende.nails.
Te esperamos no horário marcado! 💛🤍`;
  };

  const handleSchedule = async () => {
    if (!isFormValid || !scheduleData.selectedDate) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos para agendar.",
        variant: "destructive",
      });
      return;
    }

    setIsRedirecting(true);
    const { error: bookErr } = await supabase.rpc('book_appointment', {
      _name: scheduleData.clientName,
      _phone: scheduleData.phoneNumber,
      _service: scheduleData.selectedService,
      _date: format(scheduleData.selectedDate, 'yyyy-MM-dd'),
      _time: scheduleData.selectedTime,
    });
    if (bookErr) {
      setIsRedirecting(false);
      const taken = bookErr.message.includes('slot_taken');
      if (taken) reset();
      toast({
        title: taken ? "Horário indisponível" : "Não foi possível agendar",
        description: taken ? "Esse horário acabou de ser reservado. Escolha outro." : "Confira seu nome e telefone e tente de novo.",
        variant: "destructive",
      });
      return;
    }

    try {
      const message = generateMessage();
      const encodedMessage = encodeURIComponent(message);
      const whatsappNumber = "557996737776";
      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
      
      toast({
        title: "Redirecionando...",
        description: "Abrindo WhatsApp para confirmar seu agendamento.",
      });

      // Redirecionamento direto (mais confiável que window.open)
      // Abre em nova aba (wa.me recusa abrir dentro de iframes)
      const win = window.open(whatsappUrl, "_blank");
      if (!win) {
        try {
          (window.top ?? window).location.href = whatsappUrl;
        } catch {
          window.location.href = whatsappUrl;
        }
      }
      setIsRedirecting(false);
      
    } catch (error) {
      toast({
        title: "Erro ao redirecionar",
        description: "Use o botão 'Copiar Mensagem' abaixo como alternativa.",
        variant: "destructive",
      });
      setIsRedirecting(false);
    }
  };

  const handleCopyMessage = async () => {
    if (!isFormValid || !scheduleData.selectedDate) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos primeiro.",
        variant: "destructive",
      });
      return;
    }

    try {
      const message = generateMessage();
      await navigator.clipboard.writeText(message);
      
      toast({
        title: "Mensagem copiada! 📋",
        description: "Cole no WhatsApp: +55 79 9673-7776",
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar a mensagem.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-3">
      <Button 
        onClick={handleSchedule}
        disabled={!isFormValid || isRedirecting}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 text-base shadow-lg transition-all duration-200 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        size="lg"
      >
        <MessageSquare className="h-5 w-5 mr-2" />
        {isRedirecting ? "Redirecionando..." : "Agendar via WhatsApp"}
      </Button>

      <Button 
        onClick={handleCopyMessage}
        disabled={!isFormValid}
        variant="outline"
        className="w-full border-primary/20 text-foreground hover:bg-primary/5 font-medium py-3 text-sm"
        size="lg"
      >
        <Copy className="h-4 w-4 mr-2" />
        Copiar Mensagem
      </Button>

      <p className="text-muted-foreground text-xs text-center">
        Clique em "Agendar" para abrir o WhatsApp ou copie a mensagem manualmente.
      </p>
    </div>
  );
};

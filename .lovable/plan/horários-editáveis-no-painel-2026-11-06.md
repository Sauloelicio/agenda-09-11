# Horários editáveis no painel

## O que será feito
Nova aba **Horários** no painel da dona, com:
- Início do expediente (ex: 09:00)
- Fim do expediente (ex: 18:00)
- Intervalo de almoço: início e fim (ex: 12:00 às 13:30)
- Tempo de atendimento (ex: 60 min)
- De quanto em quanto tempo abre um horário (ex: a cada 60 min)
- Dias da semana em que atende (liga/desliga cada dia)
- Botão **Salvar**

No site da cliente:
- Os horários mostrados passam a seguir essas configurações.
- Só aparece horário cujo atendimento termina antes do almoço ou do fim do expediente.
- O quadro "Horário de Funcionamento" mostra os valores atualizados.

Valores iniciais = os de hoje (seg a sáb, 09:00–18:00, almoço 12:00–13:30, atendimento de 60 min a cada 60 min).

## Técnico
- Tabela `business_settings` (linha única): open_time, close_time, lunch_start, lunch_end, service_minutes, slot_interval_minutes, open_weekdays int[]. Leitura pública, escrita só admin. GRANTs + RLS.
- Função pura `generateSlots(settings, date)` em `src/lib/slots.ts` + teste com valores concretos.
- TimeSelector, DateSelector (dias fechados) e BusinessHours leem as configurações.

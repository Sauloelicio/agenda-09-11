# Modos de agendamento: por horário e por dia

A agenda suporta dois modos. O padrão continua sendo **por horário**, portanto
negócios já existentes não mudam automaticamente.

## Por horário (padrão)

O cliente escolhe data e horário na grade. Valem as regras de expediente,
intervalo entre slots, almoço e capacidade por horário já existentes.

## Por dia

O cliente escolhe **apenas a data**. O dia inteiro fica reservado e não há
grade de horários, almoço ou agendamento multi-dia.

- A capacidade do serviço (`vagas`) vale por dia. Exemplo: `vagas = 1` permite
  um cliente naquele dia; `vagas = 3` permite três.
- No banco, o agendamento é gravado com `time = '00:00'` como sentinela de
  "dia inteiro" (a coluna continua `NOT NULL`).
- A consulta `get_tenant_day_availability` devolve as vagas restantes da data.
- O link público mostra "vagas disponíveis" em vez de horários.
- O WhatsApp e o painel exibem "dia inteiro" em vez de `00:00`.

## Onde escolher

- **Cadastro:** no passo 4 de 4 do `/onboarding`, opção "Por dia".
- **Depois:** em `/admin`, aba **Expediente** ("Modo da Agenda e Expediente").

Ao trocar para "Por dia", os campos de expediente/almoço ficam ocultos no
painel e a grade pública é substituída pela disponibilidade do dia.

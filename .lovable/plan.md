# Agendamentos sem conflito + troca de horário

## O que será feito
1. **Nunca duas clientes no mesmo horário**
   - Cada agendamento passa a ser salvo online antes de abrir o WhatsApp.
   - Horários já reservados aparecem como "Ocupado" para todas as clientes, na hora.
   - Se duas clientes tentarem o mesmo horário ao mesmo tempo, só a primeira consegue. A segunda vê "Esse horário acabou de ser reservado, escolha outro".
   - Hoje os horários ocupados são de mentira (exemplos fixos). Eles serão trocados pelos reais.

2. **Troca de horário (sugestão)**
   - **Pela cliente:** botão "Remarcar ou cancelar" no site. Ela informa o telefone usado e vê o próximo agendamento dela. Pode escolher um novo horário livre ou cancelar. O horário antigo fica livre na hora.
   - **Pela Laryssa:** nova aba **Agendamentos** no painel, com a lista por dia. Ela pode remarcar ou cancelar qualquer agendamento (por exemplo, quando a cliente pede pelo WhatsApp).
   - Depois de remarcar, abre o WhatsApp com a mensagem "Horário alterado" e a nova data.
   - Limite: a cliente só pode remarcar até 2 horas antes do horário. Depois disso, precisa falar com a Laryssa.

## Técnico
- Tabela `appointments` (nome, telefone, serviço, data, horário, status). Índice único em (data, horário) para agendamentos ativos: o banco recusa duplicados.
- Sem leitura pública dos dados das clientes. Funções seguras: `get_occupied_times(data)` retorna só os horários, `book_appointment(...)`, `find_my_appointment(telefone)`, `reschedule_appointment(id, telefone, nova data/hora)` e `cancel_appointment(id, telefone)`. Admin tem leitura e edição completas (has_role).
- ScheduleContext lê horários ocupados do banco. ScheduleButton salva antes de abrir o WhatsApp.
- Teste da regra das 2 horas e do bloqueio de duplicado.

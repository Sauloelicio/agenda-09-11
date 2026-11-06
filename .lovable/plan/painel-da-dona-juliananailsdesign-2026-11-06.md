# Painel da Dona — JulianaNailsDesign

## O que será feito

1. **Acesso discreto**: ícone pequeno (cadeado) no rodapé/cabeçalho. Ao tocar, pede senha. Só a dona entra.
2. **Painel (/admin)** com 2 abas:
  - **Serviços**: adicionar, editar, remover e ativar/desativar serviços.
  - **Dias bloqueados**: escolher no calendário os dias sem atendimento (folga, feriado) e desbloquear quando quiser.
3. **Site da cliente**:
  - "Serviço Desejado" mostra os serviços cadastrados pela dona.
  - Dias bloqueados ficam travados no calendário (não dá para escolher).
4. Visual mantido branco e dourado, delicado, pensado para público feminino e celular.

## Detalhes técnicos

- Ativar Lovable Cloud (necessário para salvar serviços/dias e valer para todas as clientes).
- Login da dona: conta única por senha (seguro); o ícone abre . Tabela `user_roles` com papel admin.
- Tabelas: `services` (nome, ativo, ordem) e `blocked_dates` (data). Leitura pública; escrita só admin (RLS + has_role).
- Serviços atuais inseridos como dados iniciais.
- DateSelector passa a desabilitar datas de `blocked_dates`; ClientForm lê `services`.
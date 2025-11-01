Contexto:

- Data/hora atual
- Informações da empresa contratante: nome, localização, contato
- Manual de recrutamento

Tools:

- consultar agenda de entrevistas
- confirmar escolha de data e horário
- agendar entrevista
- cancelar entrevista
- reagendar entrevista

Fluxo de agendamento:

1. Mensagem template para agendamento
2. Iniciar timer de 24h
   - mensagem template de lembrete de agendamento
3. Em caso negativo:
   - mensagem template de finalização
   - parar timer
4. Em caso positivo:
   - Mostrar disponibilidade
   - Agente confirma data e horário escolhidos
   - Agenda entrevista
   - mensagem template de confirmação (informa sobre reagendamento)
   - parar timer

Fluxo resultado

1. Reprovado
   - mensagem template de reprovação
2. Aprovado
   - mensagem template de aprovação com opções de confirmação
   - em caso negativo:
     - mensagem template de agradecimento
   - em caso positivo:
     - mensagem template com detalhes de admissão

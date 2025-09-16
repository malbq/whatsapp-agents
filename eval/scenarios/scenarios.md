# Casos de teste

## Variações de input

- sem histórico
- histórico curto
- histórico longo
- sem arquivos
- arquivos de texto no histórico
- imagens no histórico
- sem agendamentos
- com agendamentos de curto prazo
- com agendamentos de longo prazo

## Testes

- consultar informação recente no chat, que viria na janela de mensagens recentes
- consultar informação antiga no chat, que viria do RAG
- consultar informação de um documento presente na mensagem atual
- consultar informação de um documento do histórico
- consultar informação a respeito de uma imagem da mensagem atual
- consultar informação a respeito de uma imagem do histórico
- criar agendamento
- cancelar agendamento
- listar agendamentos
- buscar informação na web
- devolver um arquivo se usuário pedir
- integração de perfil de usuário ({{ user_profile }}) no prompt influencia resposta correta
- mensagens recentes ({{ recent_messages }}) aparecem no prompt e são usadas na resposta
- memória recuperada por busca vetorial ({{ memory }}) é incluída e usada na resposta
- contexto de lembretes agendados ({{ schedule }}) é incluído e influencia a resposta

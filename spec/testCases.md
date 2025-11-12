# Systemic Test Cases

## Perfil de Usuário

- Criação automática de perfil no primeiro contato
- Atualização de perfil a partir de mensagem posterior
- Recuperação de perfil no prompt final

## Agendamentos

- Entrega de lembrete no horário exato
- Cancelamento de lembrete futuro antes da execução
- Múltiplos lembretes concorrentes para o mesmo usuário

## Robustez

- Tratamento de conteúdo não suportado (sticker, vídeo)
- Resposta adequada quando a busca vetorial retorna zero resultados
- Manejo de taxa de erro da API (retry/back-off)

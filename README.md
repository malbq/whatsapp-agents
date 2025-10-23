# Assistente de WhatsApp com IA

**Codename: zapid**

Um assistente pessoal baseado em chat para WhatsApp. Armazena mensagens como memória semântica, recupera arquivos e histórico, busca na web e oferece recomendações contextuais com foco em privacidade.

## Casos de Uso

- Armazenar e recuperar documentos
- Fazer perguntas usando contexto pessoal ou busca na web
- Encontrar lugares, restaurantes, empresas próximas
- Obter planos de treino/dieta, lembretes de refeições, receitas
- Buscar e resumir conteúdo da web

## Capacidades

- **Multimodal (Google Gemini)**: áudio/voz, imagem, documento
- **Memória semântica**: embeddings vetoriais para busca por similaridade
- **IA conversacional**: OpenAI GPT-5 Mini
- **Pesquisa na web**: Brave Search com extração de conteúdo
- **Locais**: Google Places com dados verificados e compartilhamento de contato e localização
- **Arquivos**: armazenamento e recuperação de imagens e documentos
- **Recursos nativos do WhatsApp**: reações, localização, contatos
- **Privacidade**: perfis de usuário com consentimento explícito

## Como Funciona

1. Recebemos a mensagem (texto/mídia) via WhatsApp
2. Extraímos e entendemos o conteúdo multimodal
3. Carregamos perfil, histórico recente automaticamente para o contexto da conversa
4. Decidimos ações: recuperar memórias/arquivos, pesquisar web, consultar lugares, atualizar perfil
5. Geramos e entregamos a resposta com fallback seguro
6. Pós-processamos em segundo plano: armazenamento de memória e enriquecimento de perfil

## Roadmap

### Próximas Prioridades

- Retenção de contexto aprimorada com resultados de ferramentas no histórico
- Análise de custo por operação: inferência, embedding, pesquisa na web, localização, armazenamento de arquivos, etc.
- Sistema de planos de assinatura e rastreamento de uso
- Conformidade LGPD: criptografia, consentimento explícito, termos de serviço e política de privacidade, exportação/exclusão de dados
- Observabilidade: Monitoramento e alertas de custos, métricas e logging
- Confiabilidade: redundância de infraestrutura, testes abrangentes, retry mechanisms, tratamento de erros

### Funcionalidades Futuras

- Ingestão de vídeo
- TTS para respostas em áudio
- Conversa em tempo real via [WhatsApp Cloud API Calling](https://developers.facebook.com/docs/whatsapp/cloud-api/calling)
- Novas ferramentas:
  - Geração de documentos (PDF, Word, Excel)
  - Integração com armazenamento externo (Google Drive, OneDrive, Dropbox)
  - Acesso à caixa de entrada de e-mail
  - Geração/edição de imagens

## Planos

### Gratuito

- Modelo: GPT-5 Nano ou modelo open-source
- Mensagens por dia: ~50
- Multimodal: Texto apenas
- Memória: Histórico recente apenas
- Perfil: Não
- Arquivos: Não
- Ferramentas: —

### Básico

- Modelo: GPT-5 Mini
- Mensagens por dia: ~500
- Multimodal: Sim
- Memória: Perfil + histórico completo
- Arquivos: Armazenar e recuperar
- Ferramentas: Pesquisa na web, Google Places

### Pro

- Modelo: Premium à escolha
- Mensagens: Ilimitadas
- Multimodal: Vídeo incluído
- Memória: Perfil + histórico completo
- Arquivos: Integração com armazenamento externo
- Ferramentas: Avançadas (em definição)

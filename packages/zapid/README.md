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
2. Extraímos e entendemos o conteúdo multimodal (transcrição de áudio/voz, análise de imagem, leitura de documentos)
3. Carregamos perfil e histórico recente automaticamente para o contexto da conversa
4. Decidimos ações: recuperar memórias/arquivos, pesquisar web, consultar lugares, atualizar perfil
5. Geramos e entregamos a resposta com fallback seguro
6. Pós-processamos em best‑effort: armazenamento de memória (mensagens, mídia, embeddings) e enriquecimento de perfil

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

> Os planos abaixo ainda não estão implementados; são um rascunho de produto/precificação para o futuro.

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

## Desenvolvimento e Stack

### Stack técnico

- Framework web: HonoJS v4 (via pacote `@wa/server`)
- Abstração de LLM: Vercel AI SDK (`ai`) com múltiplos provedores (OpenAI Responses + Google Gemini)
- Serviços externos: Meta Business API (WhatsApp), OpenAI Responses API, Google AI Studio
- Embeddings: Cloudflare Workers AI (geração) + vetores em PostgreSQL (extensão `vector` / pgvector)
- Armazenamento de arquivos: `unstorage` filesystem (`FilesystemStorage`); integração com Cloudflare R2 planejada para produção
- Agendador: suporte a lembretes baseado em cron via pacote `@wa/core` (integração específica do Zapid ainda em evolução)

### Convenções

- TypeScript estrito; prefira `unknown` a `any`. Valide com zod
- ESM somente; imports relativos, agrupados (std, terceiros, internos)
- Funções pequenas; retorne cedo em vez de `else`
- Evite `try/catch` amplo; deixe erros propagarem quando possível
- Sem estado global mutável; passe dependências por parâmetro
- Variáveis/Tipos: `camelCase` para variáveis/funções; `PascalCase` para tipos/classes; `UPPER_SNAKE` para env

## Arquitetura e Fluxo

Zapid segue um pipeline baseado em **Context** (estado efêmero por requisição, mantido em `AsyncLocalStorage`), com fases bem definidas:

1. `persistUser` garante `context.user` (cria ou carrega o usuário, incluindo o último perfil salvo).
2. Ingestão da mensagem: convertemos a notificação do WhatsApp em um `DB.MessageInsert` via `toUserModelMessage`:
   - texto é usado diretamente
   - voz/áudio são transcritos com Google Gemini
   - imagens são enviadas para análise (descrição + texto na imagem)
   - documentos são lidos (PDF → `parsePdf`, demais → `transcribeDocument`) e preenchemos `context.inbound`.
3. `responseGeneration` monta o contexto do agente (data/hora atual, perfil do usuário, mensagens recentes, instruções de sistema) e chama o modelo `gpt-5-mini-2025-08-07` via Vercel AI SDK para gerar um `GeneratedWhatsappMessage`.
4. Entrega da resposta: `sendWhatsappMessage` envia o output pelo cliente WhatsApp (`chat`) e popula `context.outbound` com a mensagem da IA e metadados de uso.
5. Pós-resposta (best‑effort): `storeMessageExchange` persiste mensagens e mídias:
   - faz dedupe de arquivos por hash
   - salva recursos em `resource` + storage filesystem
   - grava mensagens em `message`
   - se existir `context.improvedProfile`, grava nova versão em `user_profile_version`.
6. Embeddings: `embedMessages` extrai texto da mensagem do usuário e da última resposta (incluindo descrição de imagem/documento quando aplicável), gera embeddings via Cloudflare Workers AI e grava `snippet` para busca semântica.

Características:

- Raciocínio orientado a ferramentas (via Vercel AI SDK + `@wa/core/tools` e ferramentas locais):
  - `search_conversation_history`
  - `search_files`
  - `send_text`
  - `web_search`
  - `web_fetch`
  - `google_places`
  - `send_reaction`
  - `update_user_profile`
- Efeitos colaterais acontecem dentro de sistemas/ferramentas (persistência, storage, web search), não no core do pipeline de decisão.
- Segmentação de erros:
  - fluxo de resposta: em falha, logamos e enviamos fallback educado ao usuário
  - pós-tarefas: best‑effort; falhas são logadas e não afetam o usuário.
- Estratégia dupla de embeddings: entrada (mensagem atual do usuário) + saída (última resposta), para memória futura, personalização e busca por similaridade.
- Logging contextual com `userId`.
- Extensível: novos sistemas/ferramentas podem ser inseridos sem inflar o `Context` além do necessário.

## Estrutura do Código

- `prompts/`: prompts curtos, focados em tokens (ex.: `system.ts`, `userProfile.ts`, `recentMessages.ts`)
- `systems/`: funções assíncronas focadas, que leem/escrevem o `Context` via `getContext()`
  - Exemplos: `persistUser.ts`, `responseGeneration.ts`, `storeMessageExchange.ts`, `embedMessages.ts`
- `tools/`: ferramentas de primeira classe chamadas pelo modelo
  - Específicas do agente: `googlePlaces.ts`, `updateUserProfile.ts`
  - Genéricas (busca, histórico, envio de texto/reação, web): expostas por `@wa/core/tools`
- `context.ts`: define o tipo `Context` e o armazenamento por requisição (`runContext` / `getContext`)
- `db.ts` / `dbSchema.ts`: reuso do schema base de `@wa/core` + tabelas específicas (`user_profile_version`)
- `types.ts` / `zapid.d.ts`: tipos auxiliares do agente

## Banco de Dados

- PostgreSQL com suporte nativo a vetores (extensão `vector` / pgvector)
- Tabelas base herdadas de `@wa/core`:
  - `user`, `message`, `snippet`, `resource`, `reminder`, `raw_incoming_message`
- Tabelas específicas do Zapid:
  - `user_profile_version` (histórico de versões de perfil por usuário/mensagem)
- Vetores: `vector(768)` com similaridade cosseno (indexados em `snippet.vector`)

### Setup Inicial

1. Execute `./scripts/postgres.sh` (na raiz do monorepo) para iniciar o container PostgreSQL.
2. Conecte no banco e crie o database: `CREATE DATABASE zapid;`.
3. Habilite a extensão pgvector: `CREATE EXTENSION IF NOT EXISTS vector;`.
4. Rode as migrações:
   - `bun run --filter '@wa/agent-zapid' db:clean`
   - `bun run --filter '@wa/agent-zapid' db:generate`
   - `bun run --filter '@wa/agent-zapid' db:migrate`
   - `bun run --filter '@wa/agent-zapid' db:seed`

## Dicas de Testes

- Use o runner do Bun; mantenha testes determinísticos e pequenos
- Espelhe padrões de testes existentes em `packages/core` e em `packages/zapid/agent.integration.test.ts` (`bun run test:integration`, requer Docker e chaves de API)
- Mocks apenas para chat e dependências de IA
- Prefira asserts exatos: formas de objetos/arrays, `toThrow(ErrorClass)`, `toThrow(/mensagem/)`
- Limpe o banco em `afterEach` com helpers (veja `agent.integration.test.ts`)

## Build, lint, typecheck

A partir da raiz do repositório:

- Typecheck de todos os pacotes: `bun run typecheck`
- Lint de todos os pacotes (oxc): `bun run lint`

Dentro do pacote, scripts disponíveis:

- `bun run typecheck`
- `bun run lint`

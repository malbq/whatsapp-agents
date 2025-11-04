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

## Desenvolvimento e Stack

### Stack técnico

- Framework web: HonoJS v4 (via pacote `@batman/server`)
- Abstração de LLM: Vercel AI SDK (`ai`) com múltiplos provedores
- Serviços externos: Meta Business API (WhatsApp), OpenAI Responses API, Google AI Studio
- Embeddings: Cloudflare Workers AI (geração) + vetores em libSQL
- Armazenamento de arquivos: Cloudflare R2 (produção), `unstorage` filesystem (dev)
- Agendador: entrega de lembretes baseada em cron

### Convenções

- TypeScript estrito; prefira `unknown` a `any`. Valide com zod
- ESM somente; imports relativos, agrupados (std, terceiros, internos)
- Funções pequenas; retorne cedo em vez de `else`
- Evite `try/catch` amplo; deixe erros propagarem quando possível
- Sem estado global mutável; passe dependências por parâmetro
- Variáveis/Tipos: `camelCase` para variáveis/funções; `PascalCase` para tipos/classes; `UPPER_SNAKE` para env

## Arquitetura e Fluxo

Zapid segue um pipeline baseado em Frame (estado efêmero por requisição), com fases bem definidas:

1. PersistUser garante `frame.user`
2. IngestMessage captura entrada e mídias
3. Embedding de mensagens de entrada para enriquecimento/contexto
4. ResponseGeneration produz a resposta
5. ResponseDelivery envia a resposta (falha aqui interrompe o fluxo)
6. Pós-resposta (best-effort): armazenamento de mídia + embedding de saída, depois StoreMessageExchange, ImproveUserProfile

Características:

- Raciocínio orientado a ferramentas: `fetch_memory`, `search_files`, `send_file`, `web_search`, `web_fetch`, `google_places`, `send_reaction`, `update_user_profile`
- Efeitos colaterais acontecem dentro de sistemas/ferramentas, não no core do pipeline
- Segmentação de erros: geração, entrega e pós-processamento são blocos isolados
- Estratégia dupla de embeddings: entrada (contexto + memória futura) e saída (memória/personalização)
- Logging contextual com `userId`
- Extensível: insira novos sistemas no fluxo sem aumentar o Frame além do necessário

## Estrutura do Código

- `prompts/` prompts curtos, focados em tokens (ex.: `system.ts`, `userProfile.ts`)
- `systems/` funções assíncronas focadas, que recebem `(frame, deps, ...args)` e mutam apenas o Frame
  - Exemplos: `ingestMessage.ts`, `responseGeneration.ts`, `storeMessageExchange.ts`
- `tools/` ferramentas de primeira classe chamadas pelo modelo (ex.: `searchFiles.ts`, `googlePlaces.ts`)
- `frame.ts` tipo de Frame; `types.ts` tipos auxiliares do agente

## Banco de Dados

- LibSQL com suporte nativo a vetores
- Tabelas base: `user`, `message`, `embedding`, `raw_incoming_message`
- Vetores: `FLOAT32(384)` com similaridade cosseno (indexados)

## Dicas de Testes

- Use o runner do Bun; mantenha testes determinísticos e pequenos
- Espelhe padrões de `test/*.test.ts` quando adicionar testes
- Mocks apenas para chat e dependências de IA
- Prefira asserts exatos: formas de objetos/arrays, `toThrow(ErrorClass)`, `toThrow(/mensagem/)`
- Limpe o banco em `afterEach` com helpers

## Build, lint, typecheck

A partir da raiz do repositório:

- Typecheck de todos os pacotes: `bun run typecheck`
- Lint de todos os pacotes (oxc): `bun run lint`

Dentro do pacote, scripts disponíveis:

- `bun run typecheck`
- `bun run lint`

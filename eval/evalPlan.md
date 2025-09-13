# Prompt Optimization Implementation Plan

## Phase 1: System Prompt Override Infrastructure
- [ ] Add optional env vars `SYSTEM_PROMPT` and `SYSTEM_PROMPT_FILE` to override system prompt
- [ ] Implement `getSystemPromptOverride()` helper with caching for file reads
- [ ] Update `AIProvider.respond()` to accept optional `instructions` parameter
- [ ] Add logging when prompt overrides are applied (source: env or file)
- [ ] Keep overrides optional (don't add to validateEnv required list)
- [ ] Verify existing tests remain green with default behavior

## Phase 2: Scenario Runner
- [ ] Create `eval/runScenario.ts` CLI to execute individual scenarios
- [ ] Load scenarios from `eval/scenarios/*.json` by name or path
- [ ] Initialize ephemeral DB/storage per scenario run (mirror `eval/run.ts` pattern)
- [ ] Execute each step: call `agent()`, capture assistant response
- [ ] Validate `expectIncludes` assertions on assistant responses
- [ ] Generate reports under `eval/reports/<scenario>_<timestamp>/`
- [ ] Support `userExternalId` for multi-step scenario continuity

## Phase 3: GEPA-lite Prompt Optimization
- [ ] Create data model in `eval/promptOpt/types.ts`:
  - `Candidate { id, components: Record<string,string>, parentIds, notes, createdAt }`
  - `Result { candidateId, scenarioId, score, feedback, usage, judgeModel, timestamp }`
- [ ] Implement JSON storage in `eval/promptOpt/storage.ts` under `eval/reports/promptopt_<ts>/`
- [ ] Create judge wrapper in `eval/promptOpt/judge.ts` using Vercel AI SDK
- [ ] Build `eval/runPromptOptimization.ts` CLI:
  - Load seed candidate(s) from storage or defaults
  - Run scenarios with prompt overrides
  - Call judge LLM for scoring and textual feedback
  - Maintain Pareto set or top-mean candidates
  - Support mutation step (manual or heuristic) from feedback
- [ ] Integration: wire scenario runner to accept prompt candidate overrides
- [ ] Add focused tests for storage, judge wrapper, scenario execution with overrides

## Phase 4: Validation & Iteration
- [ ] Run small-budget optimization over subset of scenarios
- [ ] Review artifacts and judge feedback quality
- [ ] Decide promotion path: update override file/env for production or check-in new prompt version
- [ ] Document usage patterns and best practices

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

## Avaliar

- Mensagens mais recentes do chat: testar influência de K na quantidade de tokens de entrada
- Similarity search: testar influência de K na quantidade de tokens de entrada
- Se o controle de tokens de entrada for dinâmico, experimentar custo e degradação do modelo em função da quantidade de tokens de entrada
- Testar chamadas de tools
- Deduplicação de informações redundantes entre memória e histórico
- Corte de contexto ao exceder o limite de tokens preservando informação mais relevante
- testar influência da temperatura: 0 mais determinístico, ou seja, resposta mais fiel ao contexto construído via rag

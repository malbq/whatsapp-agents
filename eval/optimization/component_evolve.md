# Component Evolution Implementation Plan

## Goal

Continuously improve `eval/optimization/components.json` by:

- Identifying underperforming components
- Generating higher-quality rewrites and new candidates
- Validating and promoting winners with clear governance and versioning

## Principles (from OpenAI/Anthropic guides)

- Be explicit about role, goals, constraints, and output format
- Use delimiters/tags to scope context; avoid ambiguity
- Prefer concise, unambiguous instructions; reduce boilerplate
- Provide examples only where they add clear value
- Encourage the model to reason, but do not expose chain-of-thought to users
- Add refusal/uncertainty guidance; reward correctness over verbosity

## Phase 1 — Instrumentation & Data Model

- Add metrics for components:
  - Performance: avg score, per-criterion scores, variance, tokens used
  - Attribution: lift/delta when added/removed; co-occurrence stats
- New types (non-breaking):
  - `ComponentMetrics { id, avgScore, concision, accuracy, lift, cooccur: Record<string,number> }`
  - `ProposedChange { id, baseId, changeType: 'rewrite'|'split'|'merge'|'new', rationale, before, after, evidence }`
  - `ComponentVersion { id, version, createdAt, replacedBy? }`
- Storage layout (reuses runId folder):
  - `eval/optimization/{runId}/components/metrics.json`
  - `eval/optimization/{runId}/components/proposals/*.json`
  - `eval/optimization/{runId}/components/report.md`

## Phase 2 — Attribution & Selection

- Compute contribution estimates:
  - Ablation tests: remove one component from top candidates → re-evaluate on scenarios → measure score delta
  - Pairwise interaction: check positive/negative interactions via co-occurrence and score change
  - Rank components for action:
    - Rewrite: frequently used but middling scores; high variance; judge feedback flags
    - Split: long, multi-idea components with mixed effects
    - Merge: pairs that consistently co-occur and lift jointly
    - New: repeated patterns in top prompts missing as a reusable component
- Thresholds:
  - Rewrite if lift < population median but usage > 30% or variance > 1.5x median
  - Split if component content > 300 chars and shows opposite effects across criteria
  - Merge if Jaccard > 0.7 and joint-lift > max(individual lifts) + ε

## Phase 3 — Rewrite Generation (LLM-in-the-loop)

- Inputs to rewriter:
  - Original component (content, category), metrics, judge feedback snippets, failing scenario exemplars
- Constraints:
  - Preserve category intent (core/style/constraint/example)
  - Keep ≤ 240 chars unless category=example
  - Avoid meta or chain-of-thought requests; no user-visible reasoning
  - Enforce WhatsApp-appropriate brevity, consistent vocabulary for embeddings
- Generator spec per component: produce 3–5 variants with brief rationale, each addressing a specific deficiency (e.g., accuracy, concision, structure)
- Safety filters:
  - Reject variants adding risky behavior, tools not supported, or policy-violating text
  - Validate category fit; lint for forbidden phrases, excessive length

## Phase 4 — New Component Discovery

- Pattern mining from top prompts and judge feedback:
  - N-gram/keyword extraction (e.g., keyphrase rank) + LLM synthesis to consolidate into candidate components
  - Assign category and constraints (e.g., refusal guidance, uncertainty handling, clarification questions)
- Generate 1–3 minimal, single-purpose components; keep IDs deterministic (slug of name + short hash)

## Phase 5 — Experimentation Loop

- Add "shadow" components:
  - New IDs: keep original intact; add variants as `id__v2_{short}`; track `baseId`
- Evaluation plans:
  - Replacement A/B: replace base with each variant across scenarios
  - Additive A/B: where appropriate, add as separate component and test jointly with common sets
- Statistical selection:
  - Use paired tests over the same scenario set; require consistent improvement (e.g., +0.3 overall and +0.3 on target criteria) with non-inferiority elsewhere

## Phase 6 — Selection & Governance

- Produce artifacts:
  - `components_patch.json`: list of accepted rewrites with before/after and evidence
  - `components_report.md`: rationale, metrics, diffs, and risks
- Merge rules:
  - Rewrite: same ID, bump `version`, record `replacedBy`
  - Split: deprecate original; add 2–3 focused components; migration note
  - Merge: add consolidated component; mark sources deprecated
  - New: add with category and initial metrics baseline
- Manual review checkpoint:
  - Short review checklist (category fit, length, safety, clarity, redundancy)

## Phase 7 — Application & Versioning

- Controlled apply:
  - Default: write proposals only
  - Flag `--apply` to update `components.json` and write `CHANGELOG` entry
- Versioning:
  - Keep stable IDs where possible; if content semantics change, bump `version` and note `replacedBy`
  - Maintain a `deprecated` array in proposals to inform generator filters

## Phase 8 — Integration Changes (minimal touchpoints)

- `generator.ts`:
  - Accept shadow variants (IDs with `__v2_` suffix)
  - Optionally allow category 'task' if you want to model modality-specific instructions; otherwise map to existing categories to avoid type change
- New modules:
  - `eval/optimization/evolve.ts`: CLI orchestrator (analyze → generate → evaluate → propose → apply)
  - `eval/optimization/attribution.ts`: ablation and interaction analytics
  - `eval/optimization/rewriter.ts`: LLM rewrite with templates + validators
  - `eval/optimization/discovery.ts`: pattern mining/new component synthesis
  - `eval/optimization/validators.ts`: length, category, safety, duplicates
  - `eval/optimization/report.ts`: markdown summary + diffs

## Phase 9 — Monitoring & Rollback

- After apply:
  - Track real traffic metrics: response length, failure/refusals, user satisfaction (if available), token usage
  - Feature flag to revert to prior component set quickly

## CLI UX (examples)

- Analyze current run: `bun run eval/optimization/evolve.ts analyze --run <id>`
- Generate rewrites: `... generate --targets core_capabilities,context_usage --n 5`
- Evaluate variants: `... evaluate --scenarios eval/scenarios/*.json`
- Propose patch: `... propose`
- Apply patch: `... apply --yes`

## LLM Prompt Templates (essentials)

- Rewriter system (paraphrased from best-practice guides):
  - "You rewrite prompt fragments for a WhatsApp assistant. Preserve intent and category. Be concise. Avoid chain-of-thought exposure. Prefer unambiguous instructions. Output JSON with {variants:[{content, rationale, targetCriteria}]}. Do not add tools or policies not already present."
- Discovery prompt:
  - "Given top-performing prompts and judge feedback, extract missing, single-purpose instructions that improve accuracy/concision/helpfulness. Propose up to 3 candidate components with name, category, and ≤240-char content. Avoid overlap with existing components (list provided)."

## Acceptance Criteria

- Produces proposals with measurable lift on at least 2 scenario sets
- No regressions >0.2 on any criteria
- All accepted changes meet length, category, and safety constraints
- Full audit trail: metrics, diffs, rationale, and reproducible run folder

## References

- OpenAI Prompt Engineering Guide: platform.openai.com/docs/guides/prompt-engineering
- Anthropic resources: docs.anthropic.com (Build with Claude → Prompt Engineering), and anthropics/anthropic-cookbook on GitHub (practical prompting patterns)

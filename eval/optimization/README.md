## Prompt Optimization (GEPA-lite)

A lightweight evolutionary system that generates, evaluates, and iterates on system prompts to improve assistant quality across scenarios.

### Key modules

- `eval/optimization/run.ts`: Orchestrates runs (seed → evaluate → rank → evolve), CLI entry.
- `eval/optimization/generator.ts`: Loads `components.json`, builds prompts, seeds variants, performs crossover/mutation.
- `eval/optimization/judge.ts`: LLM judge (Vercel AI SDK + OpenAI) that scores 0–10 and returns detailed criteria and feedback using full message thread.
- `eval/optimization/storage.ts`: JSON storage per run: candidates, results, run metadata, summary.

### How it works

1. **Seeds**: Generate initial population with predefined variants (baseline, detailed, minimal, privacy_focused, efficiency_focused) plus random variants to reach target population size.
2. **Evaluate**: For each scenario, call `AIProvider.respond()` using the candidate prompt as system instructions; judge scores the response with detailed criteria (relevance, coherence, conciseness, helpfulness, accuracy).
3. **Rank**: Average score across scenarios per candidate, with efficiency scoring (score per 100 tokens) as secondary sort criterion.
4. **Evolve**: Keep elite candidates (configurable %), generate new population by crossover (configurable rate) or mutation. Feedback-based mutation uses judge feedback from low-scoring results.
5. **Generation Semantics**: Generation N evaluates candidates created in generation N-1. Generation 1 evaluates seed candidates (generation=0).
6. **Deduplication**: Candidates with identical component signatures are automatically filtered to maintain diversity.
7. Repeat for the configured number of generations.

### Run it

```bash
bun run eval/optimization/run.ts \
  --scenarios eval/optimization/scenario_example.json \
  --generations 3 \
  --population 8 \
  --seed 12345
```

Options:

- `-s, --scenarios`: Scenario config files (required)
- `-g, --generations`: Number of generations (default: 3)
- `-p, --population`: Population size per generation (default: 8)
- `-r, --seed`: Random seed for reproducible results (optional)

### Generation Semantics

The system uses a clear generation numbering scheme:

- **Generation 0**: Seed candidates (initial population)
- **Generation 1**: Evaluates generation 0 candidates, creates generation 1 variants
- **Generation N**: Evaluates generation N-1 candidates, creates generation N variants

This ensures that:

- Results are tied to the generation being evaluated
- Parent-child relationships are clear
- Evolution progression is traceable

### Scenario format

```json
{
  "name": "basic_user_question",
  "messages": [{ "role": "user", "content": "Explique brevemente o que é um índice de inflação." }]
}
```

If `messages` is absent or empty, a default single-message scenario is used.

### Components format (excerpt)

```json
{
  "components": [
    { "id": "core_identity", "name": "Core Identity", "category": "core", "content": "..." },
    {
      "id": "length_constraint",
      "name": "Length Constraint",
      "category": "constraint",
      "content": "..."
    }
  ]
}
```

Prompt assembly:

- Core sections concatenated.
- Then a "# Guidelines" section with bullet points from constraints and styles.
- Example sections appended at the end.

### Output artifacts

Per-run directory: `optimization/reports/<runId>/`

- `run.json`: run config and timing
- `candidates/*.json`: every generated prompt candidate
- `results/*.json`: judge results per candidate_scenario with detailed criteria scores
- `summary.json`: best candidate, scores, token usage, generation stats

### Key Features

#### Evolutionary Algorithm

- **Configuration-driven**: Mutation rate, crossover rate, and elite size are configurable via run config
- **Feedback integration**: Low-scoring results provide feedback to guide mutations
- **Diversity preservation**: Component signature deduplication prevents identical candidates

#### Evaluation

- **Multi-criteria scoring**: Relevance, coherence, conciseness, helpfulness, accuracy
- **Efficiency optimization**: Tracks score per 100 tokens for prompt efficiency
- **Structured feedback**: Detailed criteria and feedback for improvement guidance

#### Reproducibility

- **Seedable RNG**: Use `--seed` parameter for reproducible runs
- **Deterministic evolution**: Same seed produces identical candidate generation
- **Traceable lineage**: Clear parent-child relationships for candidates

### Recent Improvements

The system has been enhanced with several key improvements:

1. **Config Integration**: Wired mutation rate, crossover rate, and elite size from run config
2. **Generation Numbering**: Fixed semantics so candidates are properly labeled by creation generation
3. **Population Expansion**: Enhanced seed generation to fill initial population with diverse variants
4. **Judge Criteria Persistence**: Detailed scoring criteria (relevance, coherence, etc.) are preserved
5. **Feedback-Driven Mutation**: Judge feedback guides component selection in mutations
6. **Token Efficiency**: Score per 100 tokens tracked for prompt efficiency optimization
7. **Candidate Deduplication**: Prevents duplicate candidates based on component signatures
8. **Seedable RNG**: Deterministic random number generation for reproducible results

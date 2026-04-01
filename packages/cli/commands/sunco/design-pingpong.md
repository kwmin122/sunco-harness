---
name: sunco:design-pingpong
description: Cross-model design with merge + debate protocol. Spawns two models in parallel, merges outputs by section similarity, debates divergences. WARNING — 2.4x token cost.
argument-hint: "<phase> --artifact <context|plan|research> [--model-b codex|gemini] [--max-rounds 3]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - Agent
  - Task
  - AskUserQuestion
---

<context>
**Arguments:**
- `<phase>` — Phase number (e.g., `1`, `2`). Required.

**Flags:**
- `--artifact <type>` — Which artifact to generate: `context` (CONTEXT.md), `plan` (PLAN.md), or `research` (RESEARCH.md). Required.
- `--model-b <provider>` — Secondary model provider (default: codex). Options: codex, gemini, ollama.
- `--max-rounds <N>` — Maximum debate rounds for diverged sections (default: 3).
- `--similarity-threshold <N>` — Override agreement threshold (default: 0.8).
</context>

<objective>
Run a two-model design session for higher-quality planning artifacts. Each model produces its version independently, then outputs are merged section-by-section using Jaccard similarity. Divergent sections enter a structured debate protocol (critique → response → final position). Still-divergent sections are presented to the user for a final call.

Produces the merged artifact + a merge report in `.planning/pingpong/merge-report.md`.

**Cost warning**: This uses ~2.4x the tokens of a single-model run. Use for critical design decisions only.

After completion: the merged artifact replaces the standard output. Continue with the normal workflow.
</objective>

<process>
MANDATORY: Read the workflow file BEFORE taking any action.

Read and execute @$HOME/.claude/sunco/workflows/design-pingpong.md end-to-end.
</process>

<success_criteria>
- Both models spawned with identical input and produced valid output
- Section-level merge completed with similarity scores
- AGREED sections auto-merged, PARTIAL sections merged with annotations
- DIVERGED sections entered debate protocol (up to 3 rounds)
- STILL DIVERGED sections presented to user with clear tradeoffs
- Merge report written to `.planning/pingpong/merge-report.md`
- Final merged artifact written to the correct phase directory
- Token usage estimate included in report
- Changes committed: `docs(phase-[N]): design pingpong — [artifact] merged`
</success_criteria>

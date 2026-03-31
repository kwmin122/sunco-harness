# Discuss Phase Workflow

Context-gathering flow for a single phase before planning begins. Used by `/sunco:discuss`. Surfaces ambiguities through either interactive Q&A or codebase-first assumptions.

---

## Overview

Two modes, same output:

- **discuss** (default) — Ask the user targeted questions about gray areas. Best when starting a new phase with open design decisions.
- **assumptions** — Read the codebase first, generate a numbered assumption list, ask for confirmation. Best when continuing a project where patterns are established.

Both modes produce a single output file: `{N}-CONTEXT.md`.

---

## Mode Selection

Choose based on what the user passes via `--mode`:

| Mode | When to use |
|------|-------------|
| `--mode discuss` | New phase, open decisions, user wants to drive choices |
| `--mode assumptions` | Established codebase, agent can infer most choices |
| (no flag) | Default to `discuss` mode |

---

## Phase 1: Load Phase Context

Before asking anything, read:

1. `.planning/ROADMAP.md` — find Phase N goal, deliverables, requirements covered
2. `.planning/REQUIREMENTS.md` — which REQ-IDs this phase is responsible for
3. `.planning/PROJECT.md` — tech stack, constraints, key decisions already made
4. `.planning/STATE.md` — existing decisions and blockers
5. `.planning/phases/[N]-*/[N]-CONTEXT.md` — if it already exists, read it to avoid re-asking resolved questions

Create phase directory if it doesn't exist: `mkdir -p .planning/phases/[N]-[phase-name]/`

---

## Phase 2A: Discussion Mode

### Gray Area Detection

Analyze the phase goal and relevant requirements. Identify ambiguous areas by feature type:

**Architecture decisions** (how should X be structured)
- Signals: new module, new abstraction layer, cross-cutting concern
- Questions to ask: plugin vs hardcoded? class vs function? sync vs async?

**API/interface design** (what should the interface look like)
- Signals: new public function, new CLI flag, new config key
- Questions to ask: naming, defaults, error return vs throw, optional vs required?

**Data modeling** (how should data be structured/stored)
- Signals: new schema, new file format, new state field
- Questions to ask: flat vs nested? in-memory vs persistent? migration needed?

**Integration choices** (which library/service to use for X)
- Signals: new dependency, external service, external API
- Questions to ask: specific library, version pinning, fallback behavior?

**UX/behavior** (how should X behave when Y happens)
- Signals: user-visible output, interactive flow, error messages
- Questions to ask: verbose vs minimal? auto vs confirm? blocking vs streaming?

**Error handling** (what should happen when X fails)
- Signals: external calls, file I/O, network, subprocess
- Questions to ask: retry policy? user-visible error? silent skip? fatal vs recoverable?

**Performance** (acceptable limits and trade-offs)
- Signals: file watchers, large inputs, parallel execution
- Questions to ask: acceptable latency? memory limit? concurrency cap?

### Question Format

For each gray area, present the question as:

```
[Gray area description]

Options:
  A) [Option A] — [1-line tradeoff]
  B) [Option B] — [1-line tradeoff] (Recommended)
  C) Something else: [user input]
```

Mark one option as `(Recommended)` based on existing project patterns from PROJECT.md and STATE.md.

### Batching Option

If `--batch` flag is present, group related questions by category and present them together:

```
**Architecture questions (2):**
1. [Question 1]
   A) ... B) ... (Recommended)
2. [Question 2]
   A) ... B) ... (Recommended)
```

### Stopping Condition

Stop asking when:
- All identified gray areas have been resolved
- No remaining ambiguity would change the implementation approach
- User indicates they want to proceed

Aim for 3–7 questions per phase. Fewer is better — only ask what would change the plan.

---

## Phase 2B: Assumptions Mode

### Codebase Scan

Read the codebase relevant to this phase:
- Scan `packages/` for existing code patterns (naming, structure, error handling)
- Check `CLAUDE.md` for enforced conventions
- Review plans and summaries from previous phases
- Check `packages/core/` for established abstractions

### Assumption Generation

Produce a numbered list:

```
## What I would assume for Phase [N]:

1. [Assumption about architecture/approach]
   Reason: [existing pattern | convention from CLAUDE.md | implicit from requirements]
   Confidence: high | medium | low

2. [Assumption about implementation choice]
   Reason: [...]
   Confidence: [...]

...

## Questions I still have:

1. [Genuine ambiguity that cannot be inferred — needs resolution]
```

### Confirmation Step

Ask: "Are these assumptions correct? Which ones should I change?"

Accept either:
- "All good, proceed" — write CONTEXT.md with all assumptions confirmed
- Numbered corrections — update affected assumptions before writing CONTEXT.md

---

## Phase 3: Write CONTEXT.md

Created at `.planning/phases/[N]-[phase-name]/[N]-CONTEXT.md`.

Use template from `packages/cli/templates/context.md`. Fill in:

- **Phase Goal** — from ROADMAP.md
- **Requirements Covered** — REQ-IDs this phase addresses
- **Decisions Made** — each decision with chosen option and reasoning
- **Constraints** — any constraints relevant to execution
- **Out of Scope (Phase N)** — explicit exclusions to prevent scope creep
- **Open Questions** — should be empty before proceeding to plan; if non-empty, resolve them first

### Decision Entry Format

```markdown
### [Decision title]
**Decision:** [what was decided]
**Option chosen:** [A / B / other]
**Reason:** [why — reference existing pattern or user preference]
**Impact:** [files or areas affected by this choice]
```

---

## Phase 4: Route

After writing CONTEXT.md, report:

```
Phase [N] context captured.
  Decisions made: [N]
  Open questions: [N — should be 0]
  Output: .planning/phases/[N]-[name]/[N]-CONTEXT.md
```

Tell user: "Context captured. Run `/sunco:plan [N]` to create execution plans."

If open questions remain: "Resolve these [N] open questions before planning to avoid rework."

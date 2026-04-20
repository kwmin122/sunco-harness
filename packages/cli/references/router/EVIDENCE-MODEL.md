# Evidence Model — SUNCO Workflow Router

> **Clean-room notice.** SUNCO Workflow Router is a clean-room design inspired only by the general workflow idea of recurring stages (Brainstorm → Plan → Work → Review → Compound → Repeat). No code, prompts, command files, schemas, agent definitions, skill implementations, or documentation text from compound-engineering-plugin or any third-party workflow/compound/retrospective tool is copied, vendored, or adapted into SUNCO. SUNCO uses its own planning artifacts, approval boundaries, state machine, and router implementation authored independently against the SUNCO codebase.

## Principle

The router classifies stages from **evidence**, not from heuristics or LLM narrative. Evidence is tiered: what the router must read, what it may read, what it must never assume. A Freshness Gate runs before every classification; stale evidence yields `UNKNOWN`, not a guess.

## Source tiers

### Tier 1 — Deterministic required

The classifier must attempt to read each of these every invocation. Missing sources under `--strict` flag yield `EXIT 11 MISSING_DETERMINISTIC_SOURCE`; default behavior WARN + continue with reduced confidence.

| Source | Parse method | Signal contribution |
|--------|--------------|---------------------|
| `git status` | shell + line parse | working-tree state, dirty/clean signal |
| `git log origin/main..HEAD` | shell + parse | ahead/behind delta |
| `git log --since=<window>` | shell + parse | harvest window commit list |
| `.planning/STATE.md` + frontmatter | YAML parse | declared milestone/phase/status |
| `.planning/ROADMAP.md` | markdown scan | phase enumeration + milestone boundaries |
| `.planning/REQUIREMENTS.md` | markdown scan | requirement coverage per phase |
| `.planning/PROJECT.md` | markdown scan | project-level context |
| `.planning/phases/<N>/<N>-CONTEXT.md` | markdown + frontmatter | phase decisions + scope lock |
| `.planning/phases/<N>/<N>-PLAN-*.md` | markdown + frontmatter | PLAN artifact presence |
| `.planning/phases/<N>/<N>-RESEARCH.md` | markdown | research artifact presence |
| `.planning/phases/<N>/<N>-VERIFICATION.md` | markdown + frontmatter | verification layers + status |
| `.planning/phases/<N>/<N>-SUMMARY.md` | markdown | execution summary presence |
| `.planning/compound/*.md` | markdown + frontmatter | compound artifacts across history |
| `.planning/router/paused-state.json` | JSON parse | active pause pointer |
| `CHANGELOG.md` | markdown scan | release boundaries |
| `packages/cli/package.json` | JSON parse | published version |
| `packages/cli/README.md` | markdown scan | release metadata line |
| `.claude/rules/*.md` | markdown scan | codified rules (not mutated by classifier) |
| `.claude/projects/-Users-a0000/memory/MEMORY.md` + linked files | markdown scan | cross-session context |

### Tier 2 — Deterministic derived

Computed on demand from Tier 1 sources. No additional I/O beyond filesystem metadata.

| Derivation | Computation |
|------------|-------------|
| Artifact mtime ordering | `stat` + sort |
| Last commit per file | `git log -1 --format=%H -- <path>` |
| SHA drift between paired artifacts | content hash compare (e.g., SPEC ↔ CROSS-DOMAIN) |
| Phase directory contents enumeration | `ls .planning/phases/<N>/` |
| Cross-artifact reference integrity | grep + presence check |

### Tier 3 — Optional-pasted

Never assumed. User supplies via `--pasted <path>` (flag repeatable).

| Source type | Typical contents |
|-------------|------------------|
| External judge response | Reviewer/Codex verdict blocks |
| Chat transcript extract | Cross-model verify blocks, session decisions |
| External review document | PR review comments, external critique |
| CI log snippets | Failure traces the classifier did not produce itself |
| Release note drafts | Pre-publication wording input |

### Tier 4 — Explicitly unavailable

These MUST NOT be assumed present. Any classifier logic that depends on Tier 4 sources is a bug.

- LLM-internal reasoning steps not persisted to disk
- Live tool outputs from prior router invocations that were not written to `.sun/router/session/` or `.planning/router/decisions/`
- Claude Code session state beyond what is surfaced into chat history
- Any third-party service state not reflected in a readable file

## Freshness Gate (Router Step 0)

Run every router invocation. **No cache.** Aligns with v1.4 L1 wisdom: STATE.md alone is not source of truth; corroborate across multiple sources before trusting any one.

The Freshness Gate is a **7-point Freshness Gate** — the seven checks enumerated in the table below are the exact contract. Fewer than seven is under-specification; more than seven is scope creep.

| # | Check | Possible results |
|---|-------|------------------|
| 1 | `git status` clean? | `clean`, `dirty`, `conflicted` |
| 2 | `origin/main == HEAD`? | `synced`, `ahead N`, `behind N`, `diverged` |
| 3 | Most recent artifact mtime vs last commit timestamp | `aligned`, `drift>5min`, `missing` |
| 4 | `ROADMAP.md` last-modified phase matches `STATE.md`? | `aligned`, `STATE stale`, `ROADMAP stale` |
| 5 | `STATE.md` frontmatter phase exists on disk? | `exists`, `missing` |
| 6 | `.planning/phases/<state-phase>/` populated? | `populated`, `empty`, `partial` |
| 7 | Cross-artifact reference integrity | `consistent`, `mismatch table provided` |

### Freshness verdict

- **All checks aligned/synced/clean/consistent** → `freshness.status = "fresh"`; classifier proceeds.
- **Any single check flags drift** → `freshness.status = "drift"`; classifier produces `current_stage = UNKNOWN` and emits a drift report enumerating the failing checks. Drift policy below determines whether the invocation proceeds at all.
- **Two or more checks flag irreconcilable conflict (e.g., STATE says phase 53, ROADMAP lists 53 nonexistent, and HEAD commits reference phase 57)** → `freshness.status = "conflicted"`; classifier refuses all mutations; forensic trail is written to the durable tier regardless of promotion criteria so the conflict survives future invocations.

## Risk-level-keyed drift policy

A drift verdict does not automatically block the router. The invocation's intended risk level determines blocking:

| Invocation risk intent | Drift policy |
|------------------------|--------------|
| `read_only` (`/sunco:router`, `/sunco:next`, recommend-only) | **Soft-fresh allowed.** Router emits `UNKNOWN` + drift report and still provides a recommendation band LOW with advice. Non-blocking. |
| `local_mutate` (compound draft, ephemeral log write, paused-state pointer) | Soft-fresh with WARN; writes proceed to local tier. |
| `repo_mutate_official` / `repo_mutate` | **Hard-block.** Router refuses; returns UNKNOWN + drift report + remediation steps. User must resolve drift before proceeding. |
| `remote_mutate` / `external_mutate` | **Hard-block + double-ACK required.** Even after drift resolved, router requires explicit re-invocation (no cached decision). |

## UNKNOWN is not a valid `recommended_next`

`UNKNOWN` may appear as `current_stage` when the Freshness Gate prevents confident classification. It MUST NOT appear as `recommended_next`. The valid fallback is `HOLD` (router declines to recommend forward motion), enumerated in `route-decision.schema.json`.

## Evidence refs

Every route decision emits an `evidence_refs[]` array listing which Tier 1/2 sources actually contributed to the classification. Tier 3 sources, when present, appear in the array as `pasted://<path>`. Tier 4 sources are never referenced.

## Failure-fallback mode

If the evidence collector itself fails (e.g., corrupted `.planning/` tree, unreadable memory files), the router emits a **minimal route decision** with:

- `current_stage: UNKNOWN`
- `recommended_next: HOLD`
- `confidence: 0`
- `freshness.status: conflicted`
- `reason: ["evidence-collector-failure: <error summary>"]`
- `action.mode: manual_only`
- `approval_envelope.risk_level: read_only`

This minimal decision is written to the durable tier (forensic) and the router exits with a non-zero code. The user receives a remediation prompt to repair the evidence source.

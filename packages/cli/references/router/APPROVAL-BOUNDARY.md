# Approval Boundary — SUNCO Workflow Router

> **Clean-room notice.** SUNCO Workflow Router is a clean-room design inspired only by the general workflow idea of recurring stages (Brainstorm → Plan → Work → Review → Compound → Repeat). No code, prompts, command files, schemas, agent definitions, skill implementations, or documentation text from compound-engineering-plugin or any third-party workflow/compound/retrospective tool is copied, vendored, or adapted into SUNCO. SUNCO uses its own planning artifacts, approval boundaries, state machine, and router implementation authored independently against the SUNCO codebase.

## Contract principle

**Auto-routing is not auto-execution.** The router may classify the current stage and recommend the next step automatically, but mutations to the repository, remote, or external systems pass through an approval boundary. This contract specifies which mutations require explicit user acknowledgment and which do not.

This document is the operational source of truth for Phase 52b runtime enforcement and Phase 53 wrapper integration. Contract language only — runtime behavior ("the classifier will…") lives in Phase 52b artifacts.

## Six risk levels

The boundary defines six risk levels. Each level declares its ACK requirement.

| Level | Scope | ACK requirement |
|-------|-------|-----------------|
| `read_only` | Classifier run, Freshness Gate read, ephemeral route log write under `.sun/` | Not required |
| `local_mutate` | `.planning/compound/*.md` draft artifact writes; `.planning/router/decisions/*.json` durable tier writes; `.planning/router/paused-state.json` pointer overwrite; temporary reports under `.sun/` | Not required |
| `repo_mutate_official` | **Writes to official planning artifacts** — see definitional class below | **Required, per-write; blessed orchestrator batched-ACK exception applies** |
| `repo_mutate` | Source code edits under `packages/`; `git commit`; schema mutations outside the three locked schemas | Required |
| `remote_mutate` | `git push`, `git push --tag`, branch delete, PR create/close/merge | **Required, per-invocation, never cached** |
| `external_mutate` | `npm publish`, `npm login`, dependency install/uninstall, external network fetch | **Required, per-invocation, never cached, never `--batch-ack`** |

## `repo_mutate_official` definitional class

Enumeration has proven brittle (Y1 drift during v1.5 design review — new artifact types like `N-UAT.md`, `N-ARCHITECTURE.md` would fall through gaps). The class is therefore defined by **purpose**, not by file list.

### Inclusive class

The contract requires `repo_mutate_official` ACK for writes to:

- **Any file under `.planning/`** whose purpose is to record project-level or phase-level decisions, state, acceptance criteria, verification results, review outputs, execution summaries, research, plans, or design documents.
  - Canonical examples: `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/CONTEXT.md` (project-level), `.planning/phases/*/N-CONTEXT.md`, `.planning/phases/*/N-PLAN-*.md`, `.planning/phases/*/N-RESEARCH.md`, `.planning/phases/*/N-VERIFICATION.md`, `.planning/phases/*/N-SUMMARY.md`, `.planning/compound/*.md` (post-approval), `.planning/router/DESIGN-*.md`
- **Any file under `.claude/rules/`**
- **Any file under the memory system** (`.claude/projects/.../memory/`)
- **Backlog `999.x` registration** via `/sunco:backlog` skill
- **SDI counter state mutation** in memory

### Explicit exceptions (NOT `repo_mutate_official`)

The contract exempts these paths from `repo_mutate_official` ACK because their write semantics are auto-tier:

- `.planning/router/decisions/*.json` — `local_mutate` (durable log tier; deterministic promotion per `EVIDENCE-MODEL.md`)
- `.planning/router/paused-state.json` — `local_mutate` (current pause pointer; overwrites are semantically safe)
- `.planning/router/archive/**` — `read_only` after move-in
- `.sun/**` — `read_only` / `local_mutate` (gitignored session scratch)
- `.planning/compound/*.md` **draft** writes by compound-router — `local_mutate` (artifact auto-write). **Post-approval sink writes** (to memory / rules / backlog from a compound artifact's approval log) are `repo_mutate_official` — they cross back into the official class.

### Rationale

Class definition resists enumeration drift. A new phase artifact type (future `N-UAT.md`, `N-ARCHITECTURE.md`, `N-ADR-*.md`, or any `.planning/phases/*/N-*.md` following SUNCO conventions) inherits `repo_mutate_official` classification without a spec update.

## Blessed orchestrator batched-ACK exception

Certain SUNCO orchestrator commands write multiple `repo_mutate_official` files in a single invocation (e.g., `/sunco:execute` runs `sunco-executor` agents in wave-parallel and writes one `SUMMARY.md` per plan). Treating these writes as per-write ACK would produce N user prompts per invocation and break the orchestrator contract. For **blessed orchestrators**, the contract permits a single invocation-level ACK to cover all writes of the **same file class** produced within the invocation.

### Blessed orchestrator list (hardcoded, v1)

The contract blesses these commands and only these:

- `/sunco:execute` — may batch-write `SUMMARY.md` files across plans in the invoked phase
- `/sunco:verify` — may batch-write `VERIFICATION.md` layers within one phase
- `/sunco:release` — may batch-write `CHANGELOG.md` entries plus workspace version bumps across published workspace packages

### Out-of-band writes

Ad-hoc `Edit` / `Write` tool calls (invoked by an agent directly, not through a blessed orchestrator) **do not** receive batching. Per-write ACK applies. The router itself is not a blessed orchestrator; it only recommends invocation of blessed orchestrators.

### Smoke enforcement (Phase 52b)

- `[52b-runtime] blessed orchestrator list is explicit in source (no dynamic registration)`
- `[52b-runtime] ad-hoc Edit/Write bypasses blessed batching (per-write ACK enforced)`
- `[52b-runtime] Y1 class-definition test: 10 file path fixtures (5 in-class / 5 exception) classified deterministically`

## Forbidden-without-ACK hard-lock list (v1 invariant)

The router never issues these commands directly. The router proposes; the user (or user-invoked skill) executes after ACK.

```
git push (any remote)
git push --tag
git push --force*                   (requires explicit override flag + double-ACK)
git reset --hard (non-anchored)
git branch -D (non-anchored)
npm publish
npm login
npm install                         (adds dependency; audit path)
npm uninstall
pnpm add / yarn add                 (same class)
any external network fetch outside read-only context
rm -rf                              (anywhere)
memory/*.md write                   (all memory files)
.claude/rules/*.md write
.planning/REQUIREMENTS.md mutation  (additions via /sunco:reinforce are repo_mutate, not auto)
.planning/ROADMAP.md phase insertion/removal
schema file mutation                (*.schema.json in packages/cli/schemas/)
```

## R4 explicit-only reconciliation

v1.4 Phase 41 R4 rule: unknown `--surface` value → explicit error, never infer. The router extends this to stage recommendation:

- Ambiguous evidence MUST NOT drive the router to select a specific surface or scope
- Recommendations are either narrowed by evidence or returned as `MEDIUM`/`LOW` band for user selection
- The router never "guesses" at a risk level; every `action.mode` and `approval_envelope.risk_level` is determined by the deterministic classifier, not by heuristic inference

## UNKNOWN / drift policy keyed by risk level

See `EVIDENCE-MODEL.md` §Risk-level-keyed drift policy for the full table. Summary:

- `read_only` — soft-fresh allowed; classifier emits UNKNOWN + LOW band + drift report
- `local_mutate` — soft-fresh with WARN; writes proceed
- `repo_mutate` / `repo_mutate_official` — hard-block; user must resolve drift
- `remote_mutate` / `external_mutate` — hard-block plus double-ACK on re-invocation

## Consumer contract

Phase 52b runtime (`references/router/src/classifier.mjs` + sibling modules) must satisfy:

- Every route decision emits a schema-valid `approval_envelope` with a valid `risk_level` and a non-empty `triggers_required` array when `risk_level ∈ {repo_mutate_official, repo_mutate, remote_mutate, external_mutate}`.
- The classifier refuses to emit any `action.command` that matches the hard-lock list above unless `approval_envelope.forbidden_without_ack` includes the command and `action.mode = requires_user_ack`.
- When Freshness Gate reports drift and the invocation's intended risk level is `repo_mutate_official` or higher, the router returns a refusal (no `action.command` proposed) with a remediation prompt.

Phase 53 wrappers (`/sunco:do`, `/sunco:next`, `/sunco:mode`, `/sunco:manager`) must never bypass the classifier's `approval_envelope`. Bypass paths are a Phase 53 failure.

## Provenance

This contract is derived from `.planning/router/DESIGN-v1.md` §6 (approval boundary), §6.1.1 (blessed orchestrator batched-ACK), §6.2 (forbidden-without-ACK hard-lock), §6.3 (R4 reconciliation), §6.4 (UNKNOWN / drift policy), Patch K (definitional class). Design-level rationale and convergence history live in the DESIGN document; this file is the operational mirror consumed by runtime.

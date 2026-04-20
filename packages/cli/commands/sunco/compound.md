---
name: sunco:compound
description: SUNCO Compound-Router. Post-stage durable-decision consumer — reads RouteDecision logs, scores trigger, and (on threshold) auto-writes compound artifact at status=proposed. Sinks are proposal-only.
argument-hint: "[--ref <scope-ref>] [--window <ISO-from>..<ISO-to>] [--scope <release|milestone|phase|incident|ad_hoc>] [--dry-run]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---

> **Clean-room notice.** SUNCO Workflow Router is a clean-room design inspired only by the general workflow idea of recurring stages (Brainstorm → Plan → Work → Review → Compound → Repeat). No code, prompts, command files, schemas, agent definitions, skill implementations, or documentation text from compound-engineering-plugin or any third-party workflow/compound/retrospective tool is copied, vendored, or adapted into SUNCO. SUNCO uses its own planning artifacts, approval boundaries, state machine, and router implementation authored independently against the SUNCO codebase.

<objective>
Invoke the Phase 54 compound-router: read durable-tier RouteDecision logs from `.planning/router/decisions/`, score whether the observed window warrants a compound artifact per DESIGN-v1.md §8.2 L3-split trigger model, and (on threshold crossing) auto-write a structured retrospective to `.planning/compound/<scope>-<ref>-<date>.md` at `status: proposed`. Sinks (memory / rules / backlog / SDI counter) are proposal-only — emitted as structured sections within the compound artifact; downstream user ACK required before any sink state change.

**Post-stage durable-decision consumer, NOT an automatic hook** (Gate 54 U1 Codex-strict). `/sunco:compound` is user-invoked. It does not mutate `workflows/router.md`, `commands/sunco/router.md`, Phase 52b runtime modules, or the 4 wrapper command files. Automatic hook integration deferred until Phase 55 dogfood or later gate.

Contract source: `packages/cli/references/compound/{README,template}.md` + `schemas/compound.schema.json`. Runtime: `packages/cli/references/compound/src/{compound-router,sink-proposer}.mjs`. Workflow: `packages/cli/workflows/compound.md`.
</objective>

<process>
## Step 1: Resolve repo root + load durable RouteDecision logs

Resolve the repository root (walk upward from CWD until `.git/`). List files under `.planning/router/decisions/*.json`. When `--ref` or `--window` flags are provided, filter to matching decisions; otherwise consume all available durable entries.

Each RouteDecision file validates against `schemas/route-decision.schema.json` (Phase 52a). Skip files that fail structural validation (forensic trail; do not throw).

## Step 2: Derive scoring input from observed window

Build the `scoreCompound` input shape:

- `stage_exit` — the terminal stage observed (last decision's `current_stage`; prefer `RELEASE` if any decision in the window is RELEASE-stage since that's the always-on trigger)
- `event` — boolean/count flags derived from window observations:
  - `milestone_closed` — true if a milestone close signal present
  - `ci_recovered` — true if a CI-failure-followed-by-passing-commit pattern detected
  - `rollback_used` — true if a `sunco-pre-*` anchor was used
  - `post_judge_fix` — true if a post-gate-verdict corrective commit exists
  - `changes_required_acked` — true if a PROCEED CHANGES_REQUIRED decision was followed by mitigation commits
  - `sdi_observational_count`, `spec_rule_prescriptive_count`, `already_codified_count` — integer counts per observation scan
  - `plan_debt`, `gate_red_yellow` — boolean flags
  - `user_correction_count` — integer (contribution triggers at ≥2)
  - `docs_only`, `no_new_debt_gate_rollback`, `window_too_short` — dampener flags
- `window` — `{ from, to }` ISO date-time pair

## Step 3: Call `decideCompound` and branch

Delegate to `compound-router.mjs → decideCompound(input)`. Output: `{ decision, score, reasons, alwaysOn }`.

| Decision | Behavior |
|----------|----------|
| `write`  | Proceed to Step 4 (auto-write compound artifact) |
| `candidate` | Emit "compound candidate" stdout note with score + reasons; no write |
| `skip` | Emit silent-skip acknowledgement; exit |

Always-on override: if `stage_exit === 'RELEASE'` OR `event.milestone_closed === true`, decision is forced to `write` regardless of numeric score.

## Step 4: Emit sink proposals (proposal-only)

Delegate to `sink-proposer.mjs → proposeSinks(input)`. Build observational records (SDI-observational / spec-rule-prescriptive / memory-candidate) from window evidence. The proposer emits three structured record arrays: `patterns_sdi`, `rule_promotions`, `memory_proposals`. Each record carries `status: proposed`.

**PROPOSAL-ONLY BOUNDARY** (Gate 54 G3/L3):
- `patterns_sdi` → inserted into the compound artifact's `## patterns_sdi` section; proposes SDI counter delta; never writes to SDI counter state
- `rule_promotions` → inserted into `## rule_promotions` section; proposes `.claude/rules/<file>` edit with diff preview; never writes to `.claude/rules/`
- `memory_proposals` → inserted into `## memory_proposals` section; proposes memory file creation/update; never writes to `memory/`

## Step 5: Write the compound artifact (auto-write boundary)

Delegate to `compound-router.mjs → runCompound(ctx)`:

- Target path: `<repoRoot>/.planning/compound/<scope>-<ref>-<YYYYMMDD>.md`
- Path-allowlist enforced at the writer boundary — any path outside `.planning/compound/*.md` throws `CompoundWriterPathError`
- Atomic tmp-in-same-dir rename pattern (Phase 52b L5 precedent)
- `--dry-run` flag skips the write (decision preview only)

The rendered artifact body uses `packages/cli/references/compound/template.md` 8-section structure: `context`, `learnings`, `patterns_sdi` (populated from Step 4), `rule_promotions` (Step 4), `automation`, `seeds`, `memory_proposals` (Step 4), `approval_log`. `status: proposed` at write time.

## Step 6: Present artifact + sink proposal summary

Print to stdout:

- Artifact path (if written)
- Decision + score + reasons
- Proposal counts: `N patterns_sdi, M rule_promotions, K memory_proposals`
- Reminder: sinks are proposal-only; user ACK required via downstream workflow (manual review of the compound artifact → accept/reject per proposal).
</process>

<constraints>
- **Proposal-only sinks**: memory / rules / backlog / SDI counter NEVER written by this command. Only `.planning/compound/*.md` auto-write is authorized (DECISION_WRITE path).
- **Post-stage durable-decision consumer, not an automatic hook**: `workflows/router.md`, `commands/sunco/router.md`, `references/router/src/*.mjs`, 4 wrapper command files (`do/next/mode/manager.md`), and `hooks/sunco-mode-router.cjs` are byte-stable from Phase 52b/53. This command does not modify them.
- **Auto-write boundary** (path-allowlist): `.planning/compound/*.md` only. Any other path (STATE, ROADMAP, REQUIREMENTS, CHANGELOG, phase CONTEXT/PLAN/VERIFICATION/SUMMARY, `.claude/rules/`, memory, backlog) rejected at writer boundary.
- **Deterministic trigger score**: `scoreCompound` is pure; no LLM path (mirrors `confidence.mjs` I4 invariant). Smoke Section 30 asserts 100-iteration byte-identical output on fixture input.
- **8 required sections**: every auto-written artifact contains `context, learnings, patterns_sdi, rule_promotions, automation, seeds, memory_proposals, approval_log` in canonical order.
- **R1 regression guarantee preserved**: 8 stage commands (`brainstorming/plan/execute/verify/proceed-gate/ship/release/compound`) invocable standalone with byte-identical behavior. This command is additive; it does not wrap or intercept the other 7.
- **L16 immutability preserved**: `.planning/router/DESIGN-v1.md`, `.planning/ROADMAP.md`, and 8 existing schemas (`finding`, `cross-domain`, `ui-spec`, `api-spec`, `data-spec`, `event-spec`, `ops-spec`, `route-decision`) are hard-locked against mutation by this command.
- **Architecture.md defer**: `.claude/rules/architecture.md` NOT touched (Gate 54 U4 Codex-strict; namespace update deferred to Phase 56 provisional or v1.5 maintenance backlog).
</constraints>

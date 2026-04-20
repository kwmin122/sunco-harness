---
kind: design-document
version: 1
project: sunco-harness
milestone: v1.5-candidate
name: SUNCO Workflow Router
status: draft-approved-pending-kickoff
created_at: 2026-04-20
based_on_head: e27bf98
reviewed_rounds: 4
reviewers:
  - plan-verifier (claude)
  - codex
convergent: true
---

> **Clean-room notice.** SUNCO Workflow Router is a clean-room design inspired only by the general workflow idea of recurring stages (Brainstorm → Plan → Work → Review → Compound → Repeat). No code, prompts, command files, schemas, agent definitions, skill implementations, or documentation text from compound-engineering-plugin or any third-party workflow/compound/retrospective tool is copied, vendored, or adapted into SUNCO. SUNCO uses its own planning artifacts, approval boundaries, state machine, and router implementation authored independently against the SUNCO codebase.

# SUNCO Workflow Router — v1.5 Design (release-grade)

Captured 2026-04-20 post-v1.4 Impeccable Fusion shipping (`popcoru@0.12.0`, tag `v0.12.0`, commit `94041a2`). Not yet registered in `.planning/ROADMAP.md`; kickoff deferred. v1.4 stable checkpoint = `e27bf98`.

## 1. Verdict — Router-first architecture

Compound-only framing폐기. 진짜 product = **SUNCO Workflow Router** (stage state machine + evidence-based classifier + approval-boundary-enforced auto-execution). Compound는 router의 post-stage plugin 중 하나.

불변 원칙:
- **자동 라우팅 ≠ 자동 실행**. Router는 stage 판정/추천을 자동으로 하되 approval boundary 내 action은 user ACK 필수. v1.4 R4 "explicit-only triggers"와 완전 호환.
- **Freshness-first**. 모든 route decision은 Stage Classifier 실행 전에 Freshness Gate 통과 (v1.4 L1 구조화).
- **Evidence > heuristic**. Router는 repo state evidence로 stage 판정 (v1.4 L2 패턴).
- **Route decisions 2-tier**: ephemeral (session-local) + durable (promoted selected).

v1.5 공식 이름: **v1.5 SUNCO Workflow Router**. Compound는 Phase 54 scope.

## 2. SUNCO Stage Machine

### 2.1 Stage enum (10)

```
BRAINSTORM    — goal unclear OR requirements unclear (IDEATE merged per D9)
PLAN          — requirements exist, execution plan missing
WORK          — plan exists, implementation missing or in-progress
REVIEW        — implementation committed, review/findings missing
VERIFY        — review done, deterministic VERIFICATION.md missing
PROCEED       — verification exists, proceed-gate decision missing
SHIP          — proceed passed, phase-level PR/merge pending
RELEASE       — ship done, version bump + tag + publish pending
COMPOUND      — release/milestone closed OR learning event occurred
PAUSE         — context risky, handoff needed
```

`UNKNOWN`: classifier-internal only, not a recommended_next target.

### 2.2 Transitions

**Forward (happy path)**:
```
BRAINSTORM ▶ PLAN ▶ WORK ▶ REVIEW ▶ VERIFY ▶ PROCEED ▶ SHIP ▶ RELEASE ▶ COMPOUND
```

**Regress edges (explicit)**:
```
WORK     ▶ WORK        (tests fail | smoke fail; self-loop)
REVIEW   ▶ WORK        (findings require re-implementation)
VERIFY   ▶ WORK        (layer FAIL + unresolved findings; skip REVIEW if known)
VERIFY   ▶ REVIEW      (verification artifact invalid; re-triage)
PROCEED  ▶ WORK        (BLOCKED verdict; new findings)
PROCEED  ▶ REVIEW      (CHANGES_REQUIRED + ACK declined)
SHIP     ▶ WORK|REVIEW (PR review blocks / CI fails)
RELEASE  ▶ PROCEED|SHIP (pre-flight fails / registry reject)
COMPOUND (never regresses; terminal per cycle)
```

COMPOUND is terminal for its cycle; next stage is **BRAINSTORM** for the next cycle.

**Stage reset primitive**:
```
<any> ▶ <target> via /sunco:router reset <target>
```
Requires `repo_mutate_official` ACK if target overwrites official artifacts.

**Regress vs reset distinction**: A **regress edge** is triggered by evidence (test fail, gate BLOCKED, finding surfaces) and moves backward along a predefined graph edge. A **stage reset primitive** is explicit user invocation for catastrophic drift not covered by any regress edge (e.g., requirements change discovered during PLAN → reset to BRAINSTORM). Regress edges are auto-routed within `local_mutate`; stage reset is `repo_mutate_official` (ACK required) when the target overwrites official artifacts.

### 2.3 Stage contracts (10 stages × fields)

Each stage has `entry_preconditions`, `exit_conditions`, `authorized_mutations`, `forbidden_mutations`. Phase 52a deliverable: full table in `references/router/STAGE-MACHINE.md`. Two examples below.

#### BRAINSTORM

```yaml
entry_preconditions:
  - goal statement exists (user intent text OR existing REQUIREMENTS reference)
  - current phase has no acceptance criteria artifact OR user flagged goal ambiguous
exit_conditions:
  - .planning/REQUIREMENTS.md updated OR phase-level CONTEXT.md with acceptance criteria
  - at least one concrete candidate approach documented
authorized_mutations:
  - write draft to .sun/router/brainstorm-*.md (scratch)
forbidden_mutations:
  - write official REQUIREMENTS.md/CONTEXT.md without user ACK (repo_mutate_official)
  - skip to PLAN without documented candidate
```

#### VERIFY

```yaml
entry_preconditions:
  - implementation commits exist in current phase range
  - smoke/test suite is runnable
  - working tree clean OR only VERIFICATION-related changes
exit_conditions:
  - .planning/phases/N-*/N-VERIFICATION.md exists
  - frontmatter status ∈ {verified, partially-verified}
  - all 7 layers recorded with PASS|FAIL|SKIP|PENDING
authorized_mutations:
  - write VERIFICATION.md DRAFT to .sun/router/verification-draft-*.md (scratch)
  - run read-only tests
forbidden_mutations:
  - code file edits (belong in WORK or post-PROCEED fix — per regress edges)
  - git push, memory/rules mutation
  - write OFFICIAL .planning/phases/N-*/N-VERIFICATION.md without user ACK
    (repo_mutate_official; draft lives in .sun/router/ until explicit /sunco:verify invocation)
```

#### PAUSE (Patch J2)

```yaml
entry_preconditions:
  - user explicit invocation (/sunco:pause) OR router-detected high-risk condition
    (context >90% of budget, diverged branch, mid-phase incident)
  - current active stage ∈ {BRAINSTORM..COMPOUND}
exit_conditions:
  - HANDOFF.md written with current stage snapshot + next action
  - HANDOFF.json equivalent state at .planning/router/paused-state.json (current pointer, overwritten)
  - paused stage value recorded for resume
authorized_mutations:
  - write .planning/router/paused-state.json (local_mutate, current pointer — overwrites)
  - write .planning/router/decisions/*-PAUSE.json (local_mutate, durable event, append-only)
  - write HANDOFF.md via /sunco:pause skill path (repo_mutate_official, ACK required)
  - write session scratch under .sun/router/
forbidden_mutations:
  - any stage transition during PAUSE (router returns "paused" verdict until /sunco:resume)
  - any repo_mutate_official except HANDOFF.md itself
  - any remote_mutate or external_mutate
persistence_location:
  current_pointer:   .planning/router/paused-state.json            # overwritten on each pause/resume
  historical_events: .planning/router/decisions/*-PAUSE.json       # append-only log of pause events
  session_scratch:   .sun/router/session/pause-*.json              # ephemeral
  human_anchor:      HANDOFF.md                                     # repo_mutate_official, ACK required
resume_trigger:
  - explicit /sunco:resume invocation
  - reads .planning/router/paused-state.json + HANDOFF.md
  - router re-runs Freshness Gate (Step 0) BEFORE restoring paused stage
  - freshness != "fresh" → UNKNOWN stage + drift report (paused stage NOT auto-restored)
  - freshness == "fresh" → restore paused stage; recommended_next re-derived from current evidence (not cached from pause time)
re_entrance:
  PAUSE is re-entrant from any stage EXCEPT PAUSE itself
  (nested pause forbidden; router returns "already paused" verdict)
```

Remaining 7 stages (PLAN/WORK/REVIEW/PROCEED/SHIP/RELEASE/COMPOUND) follow the same contract schema; full table is a Phase 52a deliverable.

## 3. Evidence Model

### 3.1 Source tiers (strict)

| Tier | Sources | Parse method | Availability |
|------|---------|--------------|--------------|
| Deterministic (required) | `git status`, `git log origin/main..HEAD`, `git log --since=<window>`, `.planning/STATE.md` + frontmatter, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/PROJECT.md`, phase `CONTEXT.md/VERIFICATION.md/SUMMARY.md/PLAN-*.md/RESEARCH.md`, `.planning/compound/*.md`, `.planning/router/paused-state.json`, `CHANGELOG.md`, `packages/cli/package.json` version, `packages/cli/README.md` release metadata, `.claude/rules/*.md`, memory `MEMORY.md` | grep + YAML/JSON parse | Required; missing in `--strict` → UNKNOWN |
| Deterministic (derived) | mtime ordering, last-commit-per-file, SHA drift between artifacts | script | Computed on-demand |
| Optional-pasted | Judge response, chat transcript extract, external review, CI log | user `--pasted <path>` | Never assumed |
| Unavailable (never assume) | LLM reasoning, non-persisted verify blocks, live tool outputs | — | Ignore |

### 3.2 Freshness Gate (7-point)

Router Step 0. Executed every invocation (no cache).

```
1. git status clean?                              [clean | dirty | conflicted]
2. origin/main == HEAD?                           [synced | ahead N | behind N | diverged]
3. Most recent artifact mtime vs last commit ts   [aligned | drift>5min | missing]
4. ROADMAP.md last-modified phase matches STATE   [aligned | STATE stale | ROADMAP stale]
5. STATE.md frontmatter phase exists on disk      [exists | missing]
6. .planning/phases/<state-phase>/ populated?     [populated | empty | partial]
7. Cross-artifact reference integrity             [consistent | mismatch table]
```

Any FAIL → Freshness report + classifier returns UNKNOWN + no stage decision on stale evidence. Risk-level-keyed policy (§6.4) determines whether router proceeds in soft-fresh mode.

## 4. Route Decision Schema + Persistence

### 4.1 `schemas/route-decision.schema.json` (JSON Schema draft-07)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SUNCO Route Decision",
  "type": "object",
  "required": ["kind","version","ts","freshness","current_stage","recommended_next",
               "confidence","reason","preconditions","action","approval_envelope"],
  "properties": {
    "kind":    { "const": "route-decision" },
    "version": { "const": 1 },
    "ts":      { "type": "string", "format": "date-time" },
    "freshness": {
      "type": "object",
      "required": ["status", "checks"],
      "properties": {
        "status": { "enum": ["fresh", "drift", "conflicted"] },
        "checks": { "type": "array", "items": { "type": "object" } }
      }
    },
    "current_stage":    { "enum": ["BRAINSTORM","PLAN","WORK","REVIEW","VERIFY","PROCEED","SHIP","RELEASE","COMPOUND","PAUSE","UNKNOWN"] },
    "recommended_next": { "enum": ["BRAINSTORM","PLAN","WORK","REVIEW","VERIFY","PROCEED","SHIP","RELEASE","COMPOUND","PAUSE","HOLD"] },
    "confidence":       { "type": "number", "minimum": 0, "maximum": 1 },
    "reason":           { "type": "array", "items": { "type": "string" }, "minItems": 1 },
    "preconditions": {
      "type": "object",
      "required": ["satisfied", "missing"],
      "properties": {
        "satisfied": { "type": "array", "items": { "type": "string" } },
        "missing":   { "type": "array", "items": { "type": "string" } }
      }
    },
    "action": {
      "type": "object",
      "required": ["command", "mode"],
      "properties": {
        "command": { "type": "string" },
        "mode":    { "enum": ["auto_safe", "requires_user_ack", "manual_only"] },
        "args":    { "type": "object" }
      }
    },
    "approval_envelope": {
      "type": "object",
      "required": ["risk_level", "triggers_required"],
      "properties": {
        "risk_level":         { "enum": ["read_only", "local_mutate", "repo_mutate", "repo_mutate_official", "remote_mutate", "external_mutate"] },
        "triggers_required":  { "type": "array", "items": { "type": "string" } },
        "forbidden_without_ack": { "type": "array", "items": { "type": "string" } }
      }
    },
    "evidence_refs": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

### 4.2 Decision persistence (2-tier)

**Ephemeral tier** (session-local, NOT git-tracked):
`.sun/router/session/<YYYYMMDD>-<HHMMSS>-<stage>.json` — written on every router invocation. Retained 14 days, pruned by router. `.sun/` gitignored. Default path for all `read_only` routing.

**Durable tier** (git-tracked, deterministic promotion):
`.planning/router/decisions/<YYYYMMDD>-<HHMMSS>-<stage>.json` — written only when at least one of:
- (a) stage ∈ {RELEASE, COMPOUND}
- (b) milestone-close detected
- (c) freshness status = `conflicted` (forensic trail)
- (d) first route decision within newly entered phase directory
- (e) user invokes `/sunco:router --durable`

Retained indefinitely; archived to `.planning/router/archive/` after 180 days.

Promotion = deterministic rule; no LLM. Router emits both tiers in one write when promoted.

L7 from v1.4 codifies **consolidation** (ad-hoc gate scratchpads → CONTEXT.md absorption). Router decision logs are orthogonal: **structured durable telemetry** with a promotion filter. Ephemeral tier respects L7 (session-local, non-git); durable tier only surfaces load-bearing decisions.

## 5. Confidence

### 5.1 Bands

| Band | Range | Behavior |
|------|-------|----------|
| HIGH | ≥ 0.80 | Recommend + auto-proceed on `auto_safe`; `requires_user_ack` gets one-line prompt with default ACK |
| MEDIUM | 0.50–0.799 | Top-2 options + reasoning; user selects |
| LOW | < 0.50 | Evidence summary + candidate list; no recommendation |
| UNKNOWN | freshness drift/ambiguous | Freshness report; no stage decision |

### 5.2 Calibration (deterministic)

```
confidence = Σ (w_i × signal_i) / Σ (w_i)
```

Frozen weights (NOT user-tunable in v1; no `.sun/router.toml` override):
- `phase_artifacts_complete`: 0.25
- `git_state_matches_stage`: 0.20
- `state_md_alignment`: 0.15
- `test_state_known`: 0.15
- `precondition_coverage`: 0.15
- `recent_user_intent_match`: 0.10

### 5.3 Enforcement (Patch E)

1. `compute_confidence(evidence) -> number` = pure function; frozen weight map in source
2. Invariant test (Phase 52b smoke): same evidence → byte-identical confidence × 100 iterations
3. No LLM call inside `compute_confidence`; narrative reason may use LLM, number is deterministic
4. Evidence signals = pure parsers; missing → explicit 0 with reason; no heuristic fill

Smoke test invariants (27p-s):
- `confidence(empty evidence) == 0`
- `confidence(all positive) == 1.0`
- 100-iteration determinism: byte-identical
- Monotonicity: removing positive signal → non-increasing

Failure → router ships in "recommend only, HIGH-band disabled" until fixed.

## 6. Approval Boundary

### 6.1 Risk levels

| Level | Examples | Default ACK |
|-------|----------|-------------|
| `read_only` | classifier, freshness check, ephemeral route log write under `.sun/` | not required |
| `local_mutate` | `.planning/compound/*.md` draft, `.planning/router/decisions/*.json` durable tier, `.planning/router/paused-state.json`, temp reports under `.sun/` | not required |
| `repo_mutate_official` | **definitional — see §6.1.1** | **required, per-write (except §6.1.2 blessed batching)** |
| `repo_mutate` | source code edits under `packages/`, `git commit`, planning-only schema edits | required |
| `remote_mutate` | `git push`, `git push --tag`, branch delete, PR mutation | required, per-invocation, never cached |
| `external_mutate` | `npm publish`, `npm login`, dep install, external network | required, per-invocation, never cached, never `--batch-ack` |

### 6.1.1 `repo_mutate_official` definition (Patch K — class, not enumeration)

**Inclusive class**:
- Any file under `.planning/` whose purpose is to record project-level or phase-level decisions, state, acceptance criteria, verification results, review outputs, execution summaries, research, plans, or design documents. Canonical examples: `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/CONTEXT.md`, `.planning/phases/*/N-CONTEXT.md`, `.planning/phases/*/N-PLAN-*.md`, `.planning/phases/*/N-RESEARCH.md`, `.planning/phases/*/N-VERIFICATION.md`, `.planning/phases/*/N-SUMMARY.md`, `.planning/compound/*.md` (post-approval), `.planning/router/DESIGN-*.md`.
- Any file under `.claude/rules/`.
- Any file under memory system (`.claude/projects/.../memory/`).
- Backlog 999.x registration via `/sunco:backlog`.
- SDI counter state mutation in memory.

**Explicit exceptions (NOT repo_mutate_official)**:
- `.planning/router/decisions/*.json` — `local_mutate` (durable log tier; deterministic promotion per §4.2).
- `.planning/router/paused-state.json` — `local_mutate` (current pause pointer).
- `.planning/router/archive/**` — `read_only` after move-in.
- `.sun/**` — `read_only`/`local_mutate` (gitignored).
- `.planning/compound/*.md` **draft** writes by compound-router — `local_mutate` (artifact auto-write). Post-approval sink writes → `repo_mutate_official`.

Rationale: class definition avoids enumeration drift. New phase artifact types (future `N-UAT.md`, `N-ARCHITECTURE.md`) inherit classification automatically.

### 6.1.2 Blessed orchestrator batched-ACK (Patch J4)

Some SUNCO orchestrator commands legitimately write multiple `repo_mutate_official` files in a single invocation (e.g., `/sunco:execute` wave-parallel `SUMMARY.md` writes per plan). For **blessed orchestrators**, single invocation-level ACK covers all writes of the **same file class** produced within the invocation.

**Blessed orchestrators (hardcoded v1)**:
- `/sunco:execute` — batched `SUMMARY.md` across plans in the invoked phase
- `/sunco:verify` — batched `VERIFICATION.md` layers within one phase
- `/sunco:release` — batched `CHANGELOG.md` + workspace version bumps

Router itself is NOT a blessed orchestrator; it only recommends invocation of blessed orchestrators.

Outside blessed invocation: per-write ACK stands.

### 6.2 Forbidden-without-ACK hard-lock (v1 invariant)

```
git push (any remote)
git push --tag
git push --force* (requires explicit override flag + double-ACK)
git reset --hard (non-anchored)
git branch -D (non-anchored)
npm publish, npm login, npm install/uninstall, pnpm/yarn add equivalents
any external network fetch outside read-only context
rm -rf (anywhere)
memory/*.md write, .claude/rules/*.md write
.planning/REQUIREMENTS.md mutation (additions via /sunco:reinforce are repo_mutate)
.planning/ROADMAP.md phase insertion/removal
schema file mutation in packages/cli/schemas/
```

Router never issues these directly; proposes; user (or user-invoked skill) executes after ACK.

### 6.3 R4 explicit-only reconciliation

Router stage추천에서 ambiguous evidence로 surface/scope 선택 금지. Stage recommendation = evidence로 좁혀지거나 MEDIUM/LOW band로 user에게 넘김.

### 6.4 UNKNOWN / drift policy (Patch H D11)

| Invocation risk intent | Drift policy |
|------------------------|--------------|
| `read_only` | **soft-fresh 허용** — UNKNOWN + drift report, recommendation band LOW, non-blocking |
| `local_mutate` | soft-fresh with warning; writes proceed |
| `repo_mutate_official` / `repo_mutate` | **hard-block** — refuse; remediation required first |
| `remote_mutate` / `external_mutate` | **hard-block + double-ACK** — even post-drift-resolve, explicit re-invocation (no cached decision) |

## 7. Existing Command Reorganization

| Command | v1.5 role | Deprecation path |
|---------|-----------|------------------|
| `/sunco:router` **(new primary)** | Invoke router, print RouteDecision, execute `auto_safe` if safe | NEW primary UX |
| `/sunco:mode` (updated) | Router loop mode — persistent session, every input routes first | Enhanced; backward compatible |
| `/sunco:do <text>` (updated) | Intent → router with `intent_hint=<text>` | Thin wrapper |
| `/sunco:next` (updated) | `router --recommend-only` shortcut | Thin wrapper |
| `/sunco:where-am-i` (updated) | Router evidence + freshness + decision history | Diagnostic |
| `/sunco:manager` (updated) | Router with dashboard UI | Thin wrapper |
| `/sunco:auto` **(deferred to Phase 57)** | Router + `auto_safe`-only loop, `--allow <level>` for higher risks | Dangerous defaults; explicit gate before change |
| `/sunco:status` | unchanged, read-only | — |
| Stage commands (brainstorm/plan/execute/verify/proceed-gate/ship/release/compound) | **byte-identical when invoked directly** (R1 regression guarantee) | Manual override path preserved |

Router is additive. No mutation of stage commands.

## 8. Compound-Router

### 8.1 Position in stack

```
Router Main Loop → Stage exit → Post-stage Hook Dispatcher
  → compound-router.should_trigger(stage, event) → score 0-10
  → if score >= threshold: compound-router.run(scope, ref)
    1. Artifact auto-write (.planning/compound/*)
    2. Sink proposals (memory/rules/backlog/SDI — proposal only)
    3. Return "compound drafted" signal
  → Router → next stage recommendation
```

### 8.2 Trigger score (Patch E L3 split)

```
# L3 split — observational vs prescriptive
+2  SDI-observational: pattern observed ≥2 times, NOT in spec/rules
    (sink: compound artifact patterns_sdi section + counter proposal)
+3  spec-rule-prescriptive: pattern violates/extends existing spec/rule
    (sink: compound artifact rule_promotions + .claude/rules/ diff preview)
-1  pattern already codified (dedupe)

# Always-on scopes
+6  RELEASE exited successfully
+5  MILESTONE CLOSED

# Conditional
+3  PROCEED CHANGES_REQUIRED + mitigations ACKed
+3  post-judge fix commit in window
+2  CI failure recovered
+2  rollback anchor used
+1  new plan debt
+1  gate RED/YELLOW
+1  user corrected direction ≥2 times

# Dampeners
-3  docs-only, no new decisions
-2  no new debt/gate/rollback
-2  window too short (<1 commit)

score >= 5 → auto-create compound artifact, status=proposed
score 2-4 → "compound candidate" note in next route decision
score < 2 → silent skip
RELEASE/MILESTONE: always-on, threshold override
```

### 8.3 File layout (Phase 54)

```
packages/cli/references/compound/
  README.md (clean-room notice)
  template.md
  src/
    compound-router.mjs
    sink-proposer.mjs
packages/cli/schemas/compound.schema.json
packages/cli/schemas/route-decision.schema.json
packages/cli/commands/sunco/compound.md
packages/cli/commands/sunco/router.md
packages/cli/workflows/router.md
packages/cli/workflows/compound.md
.planning/compound/README.md
.planning/router/README.md (already scaffolded)
.planning/router/decisions/.keep
```

### 8.4 Write policy

- **compound artifact**: auto-write (`.planning/compound/*.md`)
- **route decision log**: auto-write (ephemeral tier; durable tier via promotion)
- **memory/rules/backlog/SDI**: proposal only — user ACK required

Compound schema (separate doc, Phase 54 deliverable) defines: `kind: compound, version: 1, scope enum, ref, window, status lifecycle (draft→proposed→partially-approved→approved→archived), source_evidence, 8 required sections, clean_room_notice const true, generated_by const`.

## 9. v1.5 Phase Plan

### Committed

| # | Phase | Scope |
|---|-------|-------|
| 52a | Router core schemas + state machine docs | `schemas/route-decision.schema.json`, `references/router/STAGE-MACHINE.md` (10 stages × full contract, forward + regress + reset), `references/router/EVIDENCE-MODEL.md`, `references/router/CONFIDENCE-CALIBRATION.md` (§5 deterministic guarantees), `.planning/router/README.md`, `.sun/router/` gitignore, smoke Section 27a-27o (schema, docs, clean-room) |
| 52b | Router classifier + evidence collector + tests | `references/router/src/classifier.mjs`, `references/router/src/evidence-collector.mjs`, `commands/sunco/router.md`, `workflows/router.md`, vitest `packages/skills-workflow/src/shared/__tests__/router-classifier.test.ts` (15+ cases), confidence invariant tests, ephemeral↔durable log writer, smoke Section 27p-27aa |
| 53 | Router wrappers (minus auto) | `/sunco:router`, `/sunco:do`, `/sunco:next`, `/sunco:mode`, `/sunco:manager` updates; `/sunco:auto` **excluded**; smoke Section 28 |
| 54 | Compound-router | compound schema + engine + scoring (L3 split) + sink proposer + workflows; smoke Section 29 |
| 55 | Router dogfood | 5 fixture scenarios + vitest + retroactive v1.4 compound + retroactive route decision backfill; smoke Section 30 |

### Mid-milestone review gate (between 55 and 56)

Dogfood results drive Phase 56/57 scope confirmation. Phase 55 FAIL → 56/57 replanning. No auto-continue.

### Provisional

| # | Phase | Scope |
|---|-------|-------|
| 56 | Release-router hardening | Release workflow sub-stage decomposition + artifact-gate integration + publish approval envelope; smoke Section 31 |

### Deferred (explicit gate post-56)

| # | Phase | Scope |
|---|-------|-------|
| 57 | `/sunco:auto` integration | Risk-level-keyed `--allow` flags, autonomous loop constrained by 52b classifier + 53 wrappers |

### Hard-locks (common to all phases)

- `.github/workflows/ci.yml` **untouched** (Path-A pattern)
- No mutations to `finding.schema.json`, `cross-domain.schema.json`, `ui-spec.schema.json`
- No source references to `compound-engineering-plugin` except clean-room notices
- No mutations to existing stage commands (brainstorm/plan/execute/verify/proceed-gate/ship/release/compound) except Phase 53/56 scoped wrappers
- `/sunco:auto` frozen until Phase 57

## 10. Dogfood scenarios (Phase 55)

| # | Scenario | Input | Expected stage | Confidence | Compound trigger |
|---|----------|-------|----------------|------------|------------------|
| 1 | New feature greenfield | no phase, no commits in window | `BRAINSTORM` | ≥0.80 | skip |
| 2 | Bugfix mid-phase | phase N commits + WIP; tests mixed | `WORK` | ≥0.80 | skip |
| 3 | Release completion | tag pushed, npm publish verified (v1.4 state) | `COMPOUND` | 1.00 | **always-on** |
| 4 | Incident recovery | CI failure + fix commit + rollback branch used | `COMPOUND` (score ≥5) | ≥0.75 | auto + SDI candidate |
| 5 | Milestone close | all milestone phases COMPLETED | `COMPOUND` | 1.00 | **always-on** |

Deterministic assertions per scenario: `current_stage` enum match, confidence band match, compound artifact existence expectation, `approval_envelope.risk_level` match.

## 11. Release-grade Acceptance Criteria (Smoke Sections)

### Section 27 — Router core (Phase 52a/52b)

```
27a  commands/sunco/router.md exists + frontmatter name=sunco:router
27b  schemas/route-decision.schema.json exists + JSON Schema draft-07 valid
27c  schema requires 10 stage enum (BRAINSTORM..PAUSE) + UNKNOWN for current_stage
27d  recommended_next enum excludes UNKNOWN (includes HOLD)
27e  references/router/STAGE-MACHINE.md defines all 10 stages with full contract fields
27f  references/router/EVIDENCE-MODEL.md defines 4 source tiers
27g  references/router/CONFIDENCE-CALIBRATION.md defines 4 bands + numeric thresholds
27h  classifier.mjs --test passes ≥15 cases covering all stages + UNKNOWN
27i  evidence-collector.mjs --test passes fresh/drift/conflicted scenarios
27j  Approval boundary forbidden-without-ACK list contains all 16+ items from §6.2
27k  .planning/router/README.md + decisions/.keep present
27l  package.json files[] includes schemas/route-decision.schema.json + references/router/
27m  clean-room grep over 10-path scope-set (Patch J5) returns 0 matches outside clean-room notice blocks
27n  Each clean-room notice file contains exact verbatim phrase
27o  No copied EveryInc content beyond clean-room notices
27p  confidence determinism: 100 iterations byte-identical
27q  confidence monotonicity: positive signal removal → non-increasing
27r  confidence bounds: empty→0, all-positive→1.0
27s  compute_confidence source has no LLM SDK import (grep anthropic/openai/agent)
27t  ephemeral log path .sun/router/session/ in .gitignore
27u  durable log promotion criteria deterministic (10 fixture verdicts)
27v  Blessed orchestrator list = {execute, verify, release}; explicit in source (no dynamic registration)
27v2 ad-hoc Edit/Write bypasses blessed batching (per-write ACK enforced)
27v3 Y1 class-definition test: 10 file path fixtures (5 in-class / 5 exception) classified deterministically
27w  repo_mutate_official refused when freshness != "fresh" (hard-block test)
27x  read_only allowed when freshness == "drift" with LOW band (soft-fresh test)
27y  stage enum = 10; IDEATE absent
27z  transition graph includes regress edges (WORK self-loop, VERIFY→WORK, PROCEED→WORK, REVIEW→WORK, SHIP→WORK|REVIEW, RELEASE→PROCEED|SHIP)
27aa PAUSE contract has all 6 fields (entry/exit/authorized/forbidden/persistence/resume); resume re-runs Freshness Gate
```

### Section 28 — Router wrappers (Phase 53)

```
28a  /sunco:mode loop invokes router first on each input
28b  /sunco:do passes intent_hint to router
28c  /sunco:next == router --recommend-only
28d  /sunco:auto UNCHANGED by Phase 53 (Phase 57 scope)
28e  Existing stage commands (brainstorm/plan/execute/verify/proceed-gate/ship/release/compound) invocable standalone with byte-identical behavior
```

### Section 29 — Compound-router (Phase 54)

Full assertion list: compound schema validity, template 8-section markers, sink proposal bucket separation (SDI-observational vs spec-rule-prescriptive), auto-write only for artifact, proposal-only for memory/rules/backlog, clean-room notice verbatim + grep, forbidden substrings.

### Section 30 — Release-router (Phase 56, provisional)

```
30a  workflows/release.md contains sub-stage decomposition (PRE_FLIGHT → VERSION_BUMP → CHANGELOG → COMMIT → TAG → PUSH → PUBLISH → VERIFY_REGISTRY → TAG_PUSH → COMPOUND_HOOK)
30b  Each sub-stage has approval_envelope metadata
30c  npm publish sub-stage risk_level=external_mutate
30d  version bump sub-stage requires workspace consistency check (Phase 51 Flag 1)
30e  release compound hook invoked after VERIFY_REGISTRY success
```

### Section 31 — Dogfood (Phase 55)

```
31a  5 fixtures under test/fixtures/router/ exist
31b  vitest runner passes all 5 dogfood scenarios
31c  Retroactive v1.4 compound artifact schema-valid
31d  Retroactive route decision log for v1.4 window (≥5 entries)
```

### Product-level non-smoke

- Clean-room: `grep -r "compound-engineering-plugin"` over 10-path scope returns 0 non-notice matches
- Regression: smoke 619 (v1.4 baseline) + new sections monotonic; pre-v1.5 byte-stable
- Approval boundary: every `remote_mutate`/`external_mutate` invocation paired with user ACK entry in log
- Freshness-first: no route decision written when `freshness.status != "fresh"` except UNKNOWN

## 12. v1.4 Learnings Incorporation

| v1.4 learning | Absorbed in |
|---------------|-------------|
| L1 Freshness checklist | §3.2 Router Step 0 (Phase 52a/52b required) |
| L2 Gate delegation + evidence > authority | §5.3 confidence enforcement; §5.1 MEDIUM band selection |
| L3 SDI observational vs prescriptive (split) | §8.2 compound scoring branches |
| L4 Push boundary | §6.2 forbidden-without-ACK list |
| L5 External-signal additive fix | §8.2 compound-router `+2 CI recovered` / `+3 post-judge fix` |
| L6 Release artifact gate | Phase 56 release-router decomposition |
| L7 Scratch consolidation | §4.2 ephemeral tier respects L7; durable tier = structured orthogonal pattern |
| L8 SemVer vs milestone label | Phase 56 VERSION_BUMP sub-stage distinguishes labels |
| Phase 51 vitest location (skills-workflow) | All 52a-56 tests at `packages/skills-workflow/src/shared/__tests__/` |
| Path-A CI-untouched | `ci.yml` unmodified in any v1.5 phase |

## 13. Open Decisions

| # | Decision | v1 position | v2 revisit |
|---|----------|-------------|------------|
| D1 | Router persistence — daemon vs on-demand | on-demand | daemon candidate |
| D2 | Decision log retention | 90 days active ephemeral, archive durable after 180 days | tunable |
| D3 | Confidence formula learned from history | deterministic weights v1 | learned v2 |
| D4 | `/sunco:router` exposure | exposed primary | possible to hide v2 |
| D5 | Compound-router threshold tunability | `.sun/router.toml` (behavior flags, NOT weight override) | — |
| D6 | R4 explicit-only reconciliation | MEDIUM/LOW band, no inference | — |
| D7 | Interaction with `.claude/` hooks | hooks unchanged; router adds no new hooks | optional v2 hook |
| D8 | Router failure fallback | UNKNOWN + freshness report; manual stage commands always available | — |
| D9 | Stage enum adjustment | IDEATE merged → BRAINSTORM (10 stages); SHIP/RELEASE kept (cardinality differs) | — |
| D10 | Workstream parallelism | v1 single active workstream per invocation; `/sunco:workstreams` remains coordination layer | cross-workstream v2 |
| D11 | UNKNOWN / drift policy | Risk-level-keyed (§6.4) | — |

## 14. Recommended Next Step (v1.5 kickoff procedure)

v1.5 kickoff (별도 세션):

1. Load this design doc as warm-up context
2. `/sunco:new-milestone v1.5` or equivalent → `.planning/PROJECT.md` + `.planning/ROADMAP.md` registration
3. Create phase scaffold directories `.planning/phases/52a-*/`, `52b-*/`, `53-*/`, `54-*/`, `55-*/`, `56-*/`
4. Phase 52a entry: `/sunco:discuss 52a` → scaffold populated from this design's §2, §3, §4, §5 sections
5. Execute Phase 52a with Full Gate 5 scrutiny (novel risk vectors: state machine correctness, evidence parser robustness, approval boundary enforcement, confidence honesty, classifier determinism, clean-room integrity)
6. Phase 52b → 53 → 54 → 55, each through Full Gate depending on risk axes
7. Mid-milestone gate: Phase 55 dogfood results review
8. Phase 56/57 scope confirmation (or re-plan)

**Convergence rounds absorbed** (history):
- Round 1: initial compound-only MVP design
- Round 2: Codex + plan-verifier → router-first architecture + 5+4 patches + D9/D10/D11 + Phase 52 split
- Round 3: Patch J (R1 IDEATE leftover / R2 PAUSE contract / R3 regress-vs-reset / X1 blessed batching / J5 grep scope)
- Round 4: Patch K (Y1 definitional `repo_mutate_official`) + Codex minor note (paused-state current vs historical)

All rounds convergent between Codex and plan-verifier; no divergence resolved via v2 relay.

---

**Status on disk**: `.planning/router/DESIGN-v1.md` saved 2026-04-20. Not registered in `.planning/ROADMAP.md`. Kickoff deferred until user explicit `/sunco:new-milestone v1.5` invocation.

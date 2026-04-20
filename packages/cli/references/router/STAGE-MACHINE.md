# Stage Machine — SUNCO Workflow Router

> **Clean-room notice.** SUNCO Workflow Router is a clean-room design inspired only by the general workflow idea of recurring stages (Brainstorm → Plan → Work → Review → Compound → Repeat). No code, prompts, command files, schemas, agent definitions, skill implementations, or documentation text from compound-engineering-plugin or any third-party workflow/compound/retrospective tool is copied, vendored, or adapted into SUNCO. SUNCO uses its own planning artifacts, approval boundaries, state machine, and router implementation authored independently against the SUNCO codebase.

## Stage enum (10)

The router recognizes ten stages in the canonical SUNCO workflow plus one classifier-internal sentinel.

| Stage | Purpose |
|-------|---------|
| `BRAINSTORM` | Goal unclear OR requirements unclear. Candidate approaches proposed. |
| `PLAN` | Requirements exist; execution plan missing. |
| `WORK` | Plan exists; implementation in progress or missing. |
| `REVIEW` | Implementation committed; review/findings not yet recorded. |
| `VERIFY` | Review complete; deterministic `VERIFICATION.md` missing. |
| `PROCEED` | Verification exists; proceed-gate decision pending. |
| `SHIP` | Proceed passed; phase-level PR/merge pending. |
| `RELEASE` | Ship done; version bump + tag + publish pending. |
| `COMPOUND` | Release/milestone closed OR significant learning event. Terminal per cycle. |
| `PAUSE` | Context risky OR user explicit pause. Re-entrant from any non-PAUSE stage. |
| `UNKNOWN` | **Classifier-internal only.** Emitted when Freshness Gate drift blocks a confident classification. Not a valid `recommended_next` target. |

## Transition graph

### Forward edges (happy path)

```
BRAINSTORM ──▶ PLAN ──▶ WORK ──▶ REVIEW ──▶ VERIFY ──▶ PROCEED ──▶ SHIP ──▶ RELEASE ──▶ COMPOUND
```

### Regress edges (explicit, evidence-triggered)

```
WORK     ──(tests fail | smoke fail)──────────▶  WORK     (self-loop: re-attempt)
REVIEW   ──(findings require re-implementation)▶  WORK
VERIFY   ──(layer FAIL + unresolved findings)──▶  WORK     (skip REVIEW if findings already known)
VERIFY   ──(verification artifact invalid)────▶  REVIEW   (re-triage findings)
PROCEED  ──(BLOCKED verdict)──────────────────▶  WORK     (new findings surfaced at gate)
PROCEED  ──(CHANGES_REQUIRED + ACK declined)──▶  REVIEW
SHIP     ──(PR review blocks | CI fails)──────▶  WORK | REVIEW
RELEASE  ──(pre-flight fails | registry reject)▶  PROCEED | SHIP
COMPOUND (never regresses)                       COMPOUND is terminal for its cycle; next stage is BRAINSTORM for the next cycle.
```

### Stage reset primitive (explicit, catastrophic drift)

```
<any> ──(explicit user invocation: /sunco:router reset <target>)──▶  <target>
```

- Covers regressions not matched by any predefined regress edge (e.g., requirements change discovered during PLAN → reset to BRAINSTORM).
- Requires `repo_mutate_official` ACK whenever the target state overwrites official planning artifacts.

### Regress vs reset distinction

- **Regress edge** — evidence-triggered (test fail, gate BLOCKED, finding surfaced), follows a predefined backward edge, auto-routed within `local_mutate`.
- **Stage reset primitive** — explicit user invocation, overwrites official artifacts, `repo_mutate_official` ACK required.

## Stage contracts

Each stage declares four fields (`entry_preconditions`, `exit_conditions`, `authorized_mutations`, `forbidden_mutations`). `PAUSE` adds three more (`persistence_location`, `resume_trigger`, `re_entrance`).

---

### BRAINSTORM

```yaml
stage: BRAINSTORM
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

### PLAN

```yaml
stage: PLAN
entry_preconditions:
  - REQUIREMENTS artifact exists with acceptance criteria
  - phase-level CONTEXT.md populated
  - no PLAN-*.md artifact yet for the active phase
exit_conditions:
  - .planning/phases/<N>/<N>-PLAN-*.md written with task breakdown
  - done_when criteria enumerated
  - gate scope drafted (where applicable)
authorized_mutations:
  - write draft PLAN to .sun/router/plan-draft-*.md (scratch)
forbidden_mutations:
  - write official PLAN-*.md without user ACK (repo_mutate_official)
  - code edits under packages/ (WORK scope)
  - git commit
```

### WORK

```yaml
stage: WORK
entry_preconditions:
  - PLAN-*.md exists for active phase
  - working tree clean OR only WIP changes for current plan
exit_conditions:
  - implementation commits land for the active plan(s)
  - tests/smoke green OR explicit regress decision
authorized_mutations:
  - file edits under packages/ and other source trees per plan scope (repo_mutate, ACK required)
  - git commit (repo_mutate, ACK required)
  - scratch under .sun/
forbidden_mutations:
  - official VERIFICATION.md write (VERIFY scope)
  - SUMMARY.md write outside of /sunco:execute blessed orchestrator context
  - git push (remote_mutate, separate ACK chain)
  - memory/rules/backlog mutation
```

### REVIEW

```yaml
stage: REVIEW
entry_preconditions:
  - implementation commits exist in current phase range
  - no REVIEW artifact yet OR prior review findings unresolved
exit_conditions:
  - findings enumerated (root-fix / mitigation / suppression / unresolved)
  - findings either resolved with evidence OR explicitly acknowledged
authorized_mutations:
  - write review draft to .sun/router/review-draft-*.md
forbidden_mutations:
  - code edits (regress to WORK if required)
  - official VERIFICATION.md write (VERIFY scope)
  - memory/rules mutation
```

### VERIFY

```yaml
stage: VERIFY
entry_preconditions:
  - implementation commits exist in current phase range
  - smoke/test suite is runnable
  - working tree clean OR only VERIFICATION-related changes
exit_conditions:
  - .planning/phases/<N>/<N>-VERIFICATION.md exists
  - frontmatter status ∈ {verified, partially-verified}
  - all 7 layers recorded with PASS | FAIL | SKIP | PENDING
authorized_mutations:
  - write VERIFICATION.md DRAFT to .sun/router/verification-draft-*.md (scratch)
  - run read-only tests (no code mutation)
forbidden_mutations:
  - code file edits (belong in WORK or post-PROCEED fix; use regress edge)
  - git push, memory/rules mutation
  - write OFFICIAL .planning/phases/<N>/<N>-VERIFICATION.md without user ACK (repo_mutate_official; draft lives in .sun/router/ until explicit /sunco:verify invocation)
```

### PROCEED

```yaml
stage: PROCEED
entry_preconditions:
  - VERIFICATION.md exists for active phase
  - no proceed-gate decision yet OR prior decision CHANGES_REQUIRED awaiting ACK
exit_conditions:
  - proceed verdict recorded: PROCEED | CHANGES_REQUIRED | BLOCKED
  - mitigations/suppressions explicitly acknowledged when PROCEED or CHANGES_REQUIRED
authorized_mutations:
  - annotate VERIFICATION.md with proceed verdict via /sunco:proceed-gate (repo_mutate_official through blessed orchestrator)
  - cross-domain findings consumption where applicable (Phase 49/M4.2 policy)
forbidden_mutations:
  - code edits (regress to WORK)
  - git push
  - memory/rules mutation
```

### SHIP

```yaml
stage: SHIP
entry_preconditions:
  - proceed verdict = PROCEED OR CHANGES_REQUIRED with all mitigations ACKed
  - branch suitable for PR / stable checkpoint
exit_conditions:
  - PR opened/merged OR stable checkpoint pushed to origin
authorized_mutations:
  - git push (remote_mutate, explicit ACK per invocation)
  - PR creation/merge (remote_mutate, explicit ACK per invocation)
forbidden_mutations:
  - version bump (RELEASE scope)
  - npm publish
  - memory/rules mutation
```

### RELEASE

```yaml
stage: RELEASE
entry_preconditions:
  - SHIP complete (commits landed on origin/main or release branch)
  - version bump eligibility confirmed (changelog, workspace version consistency)
exit_conditions:
  - tag pushed
  - npm publish verified (registry reflects new version)
  - CHANGELOG entry finalized with known-non-blocking mitigations disclosure
authorized_mutations:
  - version bump in workspace package.json files (repo_mutate_official via /sunco:release)
  - CHANGELOG.md entry (repo_mutate_official via /sunco:release)
  - git tag creation (remote_mutate on push)
  - npm publish (external_mutate, explicit ACK per invocation, never cached, never --batch-ack)
forbidden_mutations:
  - code edits (regress to PROCEED or SHIP)
  - schema mutations in packages/cli/schemas/
  - direct memory/rules mutation
```

### COMPOUND

```yaml
stage: COMPOUND
entry_preconditions:
  - RELEASE exited successfully (tag + publish verified) OR milestone CLOSED OR learning event detected with score ≥5 per compound-router scoring
exit_conditions:
  - .planning/compound/<scope>-<ref>-<date>.md written (artifact auto-write, local_mutate)
  - sink proposals (memory/rules/backlog/SDI) enumerated in approval_log with status = proposed | partially-approved | approved
authorized_mutations:
  - write .planning/compound/<scope>-<ref>-<date>.md (local_mutate; artifact auto-write)
  - write sink proposals into artifact (no direct memory/rules/backlog/SDI mutation at this stage)
forbidden_mutations:
  - auto-apply memory/rules/backlog/SDI changes (proposal only; requires downstream ACK)
  - regress to any prior stage (COMPOUND is terminal for its cycle)
  - next-cycle BRAINSTORM is a fresh invocation, not a transition
```

### PAUSE

```yaml
stage: PAUSE
entry_preconditions:
  - user explicit invocation (/sunco:pause) OR router-detected high-risk condition
    (context >90% of budget, diverged branch, mid-phase incident)
  - current active stage ∈ {BRAINSTORM, PLAN, WORK, REVIEW, VERIFY, PROCEED, SHIP, RELEASE, COMPOUND}
exit_conditions:
  - HANDOFF.md written with current stage snapshot + next action
  - .planning/router/paused-state.json written (current pointer, overwritten)
  - paused stage value recorded for resume
authorized_mutations:
  - write .planning/router/paused-state.json (local_mutate, current pointer — overwrites)
  - write .planning/router/decisions/<ts>-PAUSE.json (local_mutate, durable event, append-only)
  - write HANDOFF.md via /sunco:pause skill path (repo_mutate_official, ACK required)
  - write session scratch under .sun/router/
forbidden_mutations:
  - any stage transition during PAUSE (router returns "paused" verdict until /sunco:resume)
  - any repo_mutate_official except HANDOFF.md itself
  - any remote_mutate or external_mutate
persistence_location:
  current_pointer:   .planning/router/paused-state.json            # overwritten on each pause/resume
  historical_events: .planning/router/decisions/<ts>-PAUSE.json    # append-only log of pause events
  session_scratch:   .sun/router/session/pause-*.json              # ephemeral
  human_anchor:      HANDOFF.md                                    # repo_mutate_official, ACK required
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

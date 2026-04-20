---
name: sunco:router
description: SUNCO Workflow Router. Classifies current workflow stage from repo evidence and recommends next action, with approval-boundary enforcement. Auto-routing does NOT equal auto-execution — mutations require explicit ACK.
argument-hint: "[--intent <text>] [--durable] [--recommend-only]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
---

> **Clean-room notice.** SUNCO Workflow Router is a clean-room design inspired only by the general workflow idea of recurring stages (Brainstorm → Plan → Work → Review → Compound → Repeat). No code, prompts, command files, schemas, agent definitions, skill implementations, or documentation text from compound-engineering-plugin or any third-party workflow/compound/retrospective tool is copied, vendored, or adapted into SUNCO. SUNCO uses its own planning artifacts, approval boundaries, state machine, and router implementation authored independently against the SUNCO codebase.

<objective>
Invoke the Phase 52b router pipeline: Freshness Gate → evidence collection → stage classification → confidence compute → RouteDecision emission → ephemeral log write (+ durable log write when promotion criteria fire).

Contract source: `packages/cli/references/router/{README,STAGE-MACHINE,EVIDENCE-MODEL,CONFIDENCE-CALIBRATION,APPROVAL-BOUNDARY}.md` (Phase 52a) + `schemas/route-decision.schema.json`. Runtime modules: `packages/cli/references/router/src/{classifier,evidence-collector,confidence,decision-writer}.mjs`. Workflow: `packages/cli/workflows/router.md`.

**Auto-routing is not auto-execution.** The router is a recommender; it never issues `git push`, `npm publish`, `rm -rf`, memory writes, rules writes, or any forbidden-without-ACK operation on your behalf. See `references/router/APPROVAL-BOUNDARY.md` §Forbidden-without-ACK hard-lock list.
</objective>

<process>
## Step 1: Resolve repo root + collect evidence

Resolve the repository root (walk upward from CWD until `.git/` found). Call `collectEvidence({ repoRoot, ... })` — the adapter pattern (Phase 52b L3) lets the router be deterministic and testable; defaults use `child_process` / `fs` / `Date`.

## Step 2: Run Freshness Gate (7-point)

The evidence collector runs the Freshness Gate internally as Step 0. Any drift routes to `UNKNOWN` + `HOLD` unless the invocation's intended risk level is `read_only` (soft-fresh allowed).

Drift policy per `references/router/EVIDENCE-MODEL.md` §Risk-level-keyed drift policy:

| Intent | Drift policy |
|--------|--------------|
| `read_only` (recommend-only) | Soft-fresh; UNKNOWN + LOW band + drift report |
| `local_mutate` | Soft-fresh with warning; writes proceed |
| `repo_mutate` / `repo_mutate_official` | **Hard-block** |
| `remote_mutate` / `external_mutate` | **Hard-block + double-ACK** (no cached decision) |

## Step 3: Classify stage + compute confidence

Delegate to `classifier.mjs → classifyStage(evidence)`. Output is a schema-valid RouteDecision per `schemas/route-decision.schema.json`. The classifier produces deterministic stage inference, signal contributions for `confidence.mjs → computeConfidence`, narrative `reason[]` ordered by weight, and `approval_envelope.risk_level`.

Band behavior (`references/router/CONFIDENCE-CALIBRATION.md`):

| Band | Range | Behavior |
|------|-------|----------|
| HIGH | ≥ 0.80 | Recommendation + auto-proceed on `auto_safe`; one-line ACK prompt on `requires_user_ack` |
| MEDIUM | 0.50–0.799 | Top-2 options + reasoning; user selects |
| LOW | < 0.50 | Evidence summary + candidate list; no recommendation |

**L14 invariant**: `approval_envelope.risk_level` equal to `remote_mutate` or `external_mutate` is **NEVER** `auto_safe`, regardless of confidence band. The classifier enforces this; the structural validator rejects any decision violating it.

## Step 4: Write the decision

Delegate to `decision-writer.mjs → writeDecision(decision, ctx)`:

- **Ephemeral tier** (always): `<repoRoot>/.sun/router/session/<YYYYMMDD>-<HHMMSS>-<stage>.json` (gitignored, 14-day prune)
- **Durable tier** (when `shouldPromote` returns true): `<repoRoot>/.planning/router/decisions/<YYYYMMDD>-<HHMMSS>-<stage>.json`

Promotion criteria (DESIGN-v1.md §4.2): stage ∈ {RELEASE, COMPOUND} / milestone-closed / conflicted freshness / first-in-phase / explicit `--durable` flag.

Both writes use atomic tmp-in-same-dir rename. Path allowlist refuses writes outside the three allowed paths; `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` / phase `CONTEXT.md` are all rejected at the writer boundary.

## Step 5: Present recommendation + approval envelope

Emit the RouteDecision to the user. For `action.mode === 'auto_safe'` + HIGH band + safe risk level, the router may auto-proceed. For `requires_user_ack`, emit a one-line prompt. For `manual_only` (UNKNOWN/HOLD/drift), present evidence summary + candidate list and decline to recommend.

The router NEVER issues any operation on the `references/router/APPROVAL-BOUNDARY.md` §Forbidden-without-ACK hard-lock list directly. It proposes; the user (or user-invoked skill) executes after ACK.
</process>

<constraints>
- Auto-routing ≠ auto-execution. Approval boundary is the contract.
- Deterministic-first: the classifier is pure; narrative is ordered by frozen weights; no LLM call participates in the numeric confidence path.
- Stage commands (`/sunco:plan`, `/sunco:execute`, `/sunco:verify`, `/sunco:proceed-gate`, `/sunco:ship`, `/sunco:release`) remain **byte-identical when invoked directly** (R1 regression guarantee). Router is additive.
- `.claude/rules/`, `.github/workflows/ci.yml`, existing schemas, and all Phase 52a reference docs are hard-locked against mutation by this command.
</constraints>

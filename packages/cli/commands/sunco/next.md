---
name: sunco:next
description: "Ask the Workflow Router for the next logical step. Thin wrapper over /sunco:router --recommend-only — one-shot read-only recommendation with approval-boundary enforcement."
argument-hint: "[--dry-run] [--list] [--durable]"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<context>
**Flags:**
- `--dry-run` — Show what would be run next without actually running it.
- `--list` — Show all candidates from the router ranked by confidence signal contribution.
- `--durable` — Additionally write a durable-tier decision record at `.planning/router/decisions/*.json` (git-tracked). Default writes only the ephemeral-tier record.

**Engine:** `/sunco:next` is a thin wrapper over `/sunco:router --recommend-only`. It shares the same router runtime as `/sunco:mode`, `/sunco:do`, and `/sunco:manager`; neither wrapper duplicates stage-inference or decision-writing logic.
</context>

<objective>
One-shot "what should I do next?" recommendation from the Workflow Router. Reads repo evidence (STATE.md, ROADMAP.md, REQUIREMENTS.md, phase artifacts, git state) via the 7-point Freshness Gate, classifies current stage, and returns `recommended_next` + the matching `/sunco:*` command + approval envelope.

**After this command:** You have a recommendation. Executing it still requires ACK for any `repo_mutate` / `repo_mutate_official` / `remote_mutate` / `external_mutate` operation per the approval envelope.
</objective>

<process>
## Step 1: Invoke router in recommend-only mode

```
/sunco:router --recommend-only
```

This runs the deterministic pipeline (Freshness Gate → evidence collection → stage classification → confidence compute → narrative render → structural validation → decision write) with `read_only` risk intent. Per DESIGN §6.4 risk-level-keyed drift policy, `read_only` allows **soft-fresh** — if freshness status is `drift`, the router still returns a RouteDecision (LOW band + drift report) rather than hard-blocking.

## Step 2: Decision writing (always ephemeral; --durable gates durable tier)

Per DESIGN §4.2, the ephemeral tier at `<repoRoot>/.sun/router/session/<YYYYMMDD>-<HHMMSS>-<stage>.json` is the **default path for all read-only routing** and is written on every invocation. The `.sun/router/session/` directory is gitignored and 14-day-pruned by the router, so audit-trail write cost is bounded.

The durable tier at `<repoRoot>/.planning/router/decisions/*.json` is git-tracked and written only when (a) stage ∈ {RELEASE, COMPOUND}, (b) milestone-close detected, (c) `freshness.status === 'conflicted'` (forensic trail), (d) first route decision in newly entered phase directory, or (e) explicit `--durable` flag on this invocation.

## Step 3: Render the recommendation

Present:
- `recommended_next` stage (enum)
- `action.command` — the proposed `/sunco:*` command string
- Top reason from `reason[]` (ordered by frozen confidence weights)
- `confidence` number + band
- `approval_envelope.risk_level` + any `forbidden_without_ack[]` items
- `freshness.status` + any drift-check IDs

Example output:

```
Detected state: PLAN exists for Phase 53; no SUMMARY.md yet (recommended_next = WORK)
Next:  /sunco:execute 53   (confidence 0.86 · HIGH band · risk=local_mutate · approval=auto_safe)
Why:   phase_artifacts_complete signal fired (PLAN + CONTEXT present, no SUMMARY)
```

## Step 4: --list flag

When `--list` is set, show the candidate recommendations ranked by signal contribution:

```
Next steps (router ranking):
1. [RECOMMENDED] /sunco:execute 53 — confidence 0.86, HIGH band
2. /sunco:verify 52b            — confidence 0.31, LOW band (no missing SUMMARY, verification window passed)
3. /sunco:plan 54               — confidence 0.12, LOW band (next-phase seed)
```

## Step 5: --dry-run flag

When `--dry-run` is set, show the recommendation + reasoning but do NOT execute. Output ends with: `"Next action would be: /sunco:<command>"`.

## Step 6: Approval envelope propagation (L14 hard invariant)

If `action.mode === 'requires_user_ack'`, emit a one-line ACK prompt before executing downstream. The `approval_envelope.risk_level` determines the prompt wording; `forbidden_without_ack[]` entries (e.g., `git push`, `npm publish`) are NEVER invoked directly by this wrapper, regardless of HIGH confidence. This is the L14 invariant from Phase 52b: `remote_mutate` and `external_mutate` are NEVER `auto_safe`.

## Step 7: UNKNOWN / HOLD fallback

When the router returns `current_stage = UNKNOWN` (all 7 freshness sub-predicates failing or drift policy engaged), the recommendation becomes `recommended_next = HOLD` + the drift report. Output format:

```
Freshness: drift (2/7 checks failed)
  - state-phase-exists: missing (.planning/phases/53-router-wrappers/ not on disk at time of STATE frontmatter)
  - artifact-mtime: drift>5min (STATE.md mtime precedes last commit by 12m)
Next:   HOLD — remediate drift before routing
Why:    read-only routing under drift returns LOW band + drift report per DESIGN §6.4
```

No silent default stage is picked; HOLD is explicit.
</process>

<constraints>
- `/sunco:next` MUST delegate routing to `/sunco:router --recommend-only`. No stage inference is re-implemented here (Gate 53 L5 + L12 wrappers-share-router).
- Ephemeral-tier decision write on every invocation (Gate 53 L2 + DESIGN §4.2). Durable-tier write gated by `--durable` or the 5-criterion promotion in §4.2.
- `approval_envelope.forbidden_without_ack[]` preserved verbatim. L14 invariant: `remote_mutate` / `external_mutate` never emit `auto_safe`.
- UNKNOWN/HOLD fallback is explicit (no silent default stage pick).
- Stage commands (plan/execute/verify/proceed-gate/ship/release/compound) remain byte-identical when invoked directly (R1 regression guarantee).
</constraints>

# Execute Phase Workflow

Wave-based parallel execution orchestration for a phase. Each plan runs in a fresh agent context. Mandatory lint-gate and blast radius check are non-negotiable. Used by `/sunco:execute`.

---

## Overview

Four steps before any code is touched:

1. **Discover** — collect all plans for the phase, sort into waves
2. **Blast radius check** — identify files transitively affected beyond plan scope
3. **Execute waves** — run plans in parallel within each wave
4. **Lint-gate** — mandatory check after each plan completes

SUNCO differentiators from standard execution:
- **Blast radius check** before ANY code changes
- **Mandatory lint-gate** after EACH plan (not just at the end)
- Both are non-negotiable — there is no `--skip-gates` flag

---

## Step 1: Discover Plans

Read `.planning/phases/[N]-*/` and collect all `[N]-*-PLAN.md` files.

For each plan, extract from frontmatter:
- `plan:` — plan number (M in N-M)
- `wave:` — wave assignment (1 or 2)
- `depends_on:` — upstream plan IDs
- `title:` — human-readable title
- `files_modified:` — expected file scope

Sort into wave groups. Verify dependency chain is consistent (Wave 2 plans only depend on Wave 1).

If no plans found: error "No plans found for Phase [N]. Run `/sunco:plan [N]` first."

---

## Step 2: Blast Radius Check (MANDATORY — cannot skip)

Before any execution begins, run blast radius analysis.

### What to analyze

1. Collect all `files_modified` from all plans in this phase
2. Check the code graph if `.sun/graph/` exists (from `/sunco:graph`)
3. Walk the import tree: which files import from the files being modified?
4. Identify transitive dependents (files that depend on dependents)
5. Classify by risk level

### Risk Classification

| Condition | Risk Level | Action |
|-----------|------------|--------|
| Blast radius ≤ 3 files | LOW | Proceed silently |
| Blast radius 4-10 files | MEDIUM | Show notice, proceed |
| Blast radius > 10 files | HIGH | Ask user to confirm |
| Blast radius touches public API | HIGH | Ask user to confirm |
| Blast radius touches .planning/ | WARN | Flag unauthorized scope |

### Confirmation Prompt (HIGH risk)

```
Blast radius check: HIGH RISK

Files being modified (from plans): [N]
Files transitively affected: [N] additional files

Affected beyond plan scope:
  - [file 1] (imports from [modified file])
  - [file 2] (imports from [modified file])
  ...

Proceed anyway? [yes/abort]
```

User must explicitly type `yes` to continue. `abort` stops execution.

### Blast Radius Report

Record in execution summary regardless of risk level:
```
Blast radius: [LOW/MEDIUM/HIGH]
Files in scope: [N]
Files transitively affected: [N]
```

---

## Step 3: Execute Waves

For each wave (starting from Wave 1), execute all plans in the wave.

### Interactive Mode (--interactive)

Execute plans sequentially in the current context:
- Show plan title before starting
- Display progress after each task
- Show lint-gate result inline
- No subagents spawned

Use for: small phases, debugging, pair-programming style, quota management.

### Default Mode (parallel subagents)

Spawn one Agent (or Task) per plan in the wave. Each agent runs with fresh context.

**Per-plan agent prompt:**
```
Execute this plan completely.

Plan file: .planning/phases/[N]-[phase-name]/[N]-[M]-PLAN.md

Instructions:
1. Read the plan file completely before starting any work
2. Read all files listed in files_modified (understand current state)
3. Complete all tasks in order
4. After each task: make an atomic git commit
   Commit format: "feat([phase]-[task]): [description]"
5. Verify each acceptance criterion before moving to the next task
6. After all tasks complete: write the summary file

Summary file: .planning/phases/[N]-[phase-name]/[N]-[M]-SUMMARY.md
Use the template at: packages/cli/templates/summary.md

Do not modify files outside of files_modified in the plan frontmatter.
Do not touch .planning/ files except to write [N]-[M]-SUMMARY.md.
```

### Wave Sequencing

- Wave 1: spawn all Wave 1 plans simultaneously
- Wait for all Wave 1 plans to complete (and lint-gate to pass for each)
- Wave 2: spawn all Wave 2 plans simultaneously
- Continue until all waves done

If `--wave N` is specified: execute only that wave. Skip others.

---

## Step 4: Mandatory Lint-Gate (after each plan)

After each plan completes (agent writes SUMMARY.md), run lint-gate immediately.

### Lint-gate execution

```bash
# Primary
sunco lint

# Fallback if binary not available
npx eslint packages/ --max-warnings 0
npx tsc --noEmit
```

### Lint-gate decision rules

| Result | Action |
|--------|--------|
| PASS (zero errors) | Continue to next plan |
| FAIL — errors | STOP. Do not start next plan. Surface to user. |

### On lint-gate failure

Stop all pending plans in the current wave. Report:

```
Lint-gate FAILED after plan [N]-[M]: [title]

Errors:
  [file]:[line]: [error message]
  ...

Options:
  fix    — Fix lint errors before continuing (recommended)
  skip   — Log warning and continue (not recommended — errors will compound)
  abort  — Stop execution, report partial completion
```

On `fix`: surface the lint errors. After user (or agent) fixes, re-run lint. Then continue.
On `skip`: log visible warning in VERIFICATION.md. Continue with degraded confidence.
On `abort`: write partial VERIFICATION.md. Report which plans completed and which did not.

---

## Step 5: Collect Results

After all waves (or specified wave) complete:

For each plan:
- **Completed**: `[N]-[M]-SUMMARY.md` was written and lint passed
- **Partial**: `[N]-[M]-SUMMARY.md` was written but lint failed
- **Failed**: `[N]-[M]-SUMMARY.md` was not written

---

## Step 6: Write VERIFICATION.md

Write to `.planning/phases/[N]-[phase-name]/[N]-VERIFICATION.md`.

Use structure:

```markdown
# Phase [N] Execution Report

## Execution Summary

| Plan | Title | Wave | Status | Lint |
|------|-------|------|--------|------|
| [N]-01 | [title] | 1 | completed | pass |
| [N]-02 | [title] | 1 | completed | pass |
| [N]-03 | [title] | 2 | failed | — |

## Blast Radius
- Risk level: [LOW/MEDIUM/HIGH]
- Files in scope: [N]
- Files transitively affected: [N]

## Lint Gate Results
- [N]-01: PASS
- [N]-02: PASS
- [N]-03: NOT RUN (plan failed)

## Ready for Verify
[yes / no — reason if no]

## Issues
- [ ] [issue 1]
```

---

## Step 7: Report and Route

```
Phase [N] execution complete.
  Plans completed: [M]/[total]
  Lint gate: [all pass / N failed]
  Blast radius: [LOW/MEDIUM/HIGH]
```

If all complete and lint passes: "Run `/sunco:verify [N]` for 6-layer verification."
If partial failures: "Fix the issues above, then re-run `/sunco:execute [N] --wave [failed-wave]`."
If lint gate failed: "Fix lint errors listed above, then re-run `/sunco:execute [N] --wave [wave]`."

# SUNCO Brainstorming Wrapper

This workflow runs the vendored Superpowers `brainstorming` skill as SUNCO's second project-start layer.

## Full Lifecycle Map

Brainstorming is the second hop on a longer chain. The design is stronger when every author knows where the spec goes next and where the reader will stop if the spec is wrong.

```text
idea
  ↓
/sunco:office-hours        (pressure-test the problem, user, wedge, demand)
  ↓
/sunco:brainstorming       (vendored Superpowers — design/spec only, HARD-GATE)
  ↓
/sunco:new --from-preflight <spec>   (PROJECT.md / REQUIREMENTS.md / ROADMAP.md / STATE.md)
  ↓ per phase ─────────────────────────────────────────────────────────────────
/sunco:discuss N           (decisions + gray areas before planning)
  ↓
/sunco:plan N              (SUNCO's writing-plans: bite-sized tasks, exact paths,
                            BDD acceptance, verification steps, wave parallelization)
  ↓
/sunco:execute N           (wave-based, fresh subagent per plan, worktree isolation,
                            lint-gate between waves)
  ↓
/sunco:verify N            (7-layer swiss cheese — proof before completion)
  ↓
/sunco:review N            (multi-provider cross review; feedback loops back to
                            /sunco:quick or /sunco:execute until review passes)
  ↓
/sunco:proceed-gate        (zero unresolved findings)
  ↓
/sunco:ship N              (PR + land/release)
```

Mapping to Superpowers' 14 skills so readers can reason about it from either side:

| Superpowers skill | SUNCO equivalent | Notes |
|---|---|---|
| using-superpowers | `/sunco:mode`, `/sunco:help` | Entry + auto-routing |
| brainstorming | `/sunco:brainstorming` (this skill, vendored) | Source of truth kept verbatim |
| writing-plans | `/sunco:plan` | BDD acceptance + task verification steps |
| executing-plans | `/sunco:execute` | Wave-based |
| subagent-driven-development | `/sunco:execute` + `/sunco:workspaces` | Fresh subagent per plan + worktree |
| test-driven-development | `/sunco:test-gen`, `type: tdd` in plan | Opt-in per phase |
| systematic-debugging | `/sunco:debug` (Iron Law) | Reproduce → root cause → fix → verify |
| verification-before-completion | `/sunco:verify` + `/sunco:proceed-gate` | Proof required before ship |
| requesting-code-review | `/sunco:review` | Multi-provider |
| receiving-code-review | `/sunco:review` → `/sunco:quick`/`/sunco:execute` loop | Feedback re-execution |
| dispatching-parallel-agents | `wave.parallelization` in `/sunco:execute` | Built into plan schema |
| using-git-worktrees | `/sunco:workspaces`, `/sunco:workstreams` | Native worktree support |
| finishing-a-development-branch | `/sunco:ship`, `/sunco:land`, `/sunco:pr-branch` | Merge + release chain |
| writing-skills | `@sunco/core` `defineSkill` + `.claude/rules/conventions.md` | Pattern-based extension |

**Why this map matters for brainstorming:** the spec you write here must be implementable by `/sunco:plan` without needing to re-interview the user. Keep every decision that affects phases, tasks, or verification in the spec; keep everything that is merely opinion out of it.

## Source Of Truth

Read this file before doing anything else:

```text
$HOME/.claude/sunco/references/superpowers/brainstorming/SKILL.md
```

That file is vendored from Superpowers and must remain the behavioral source of truth. Do not paraphrase it from memory. Do not replace it with a SUNCO-specific brainstorming flow.

## SUNCO Adapter

Follow the Superpowers brainstorming process exactly through:

1. Explore project context
2. Offer visual companion when relevant
3. Ask clarifying questions one at a time
4. Propose 2-3 approaches
5. Present the design and get approval
6. Write the design doc
7. Run the spec self-review
8. Ask the user to review the written spec

The only SUNCO-specific adaptation is the terminal handoff:

- Superpowers says the terminal state is `writing-plans`.
- For SUNCO project starts, `/sunco:new --from-preflight <spec-path>` is the equivalent planning handoff.
- Do not implement after brainstorming.

## Handoff

After the user approves the written spec, run or instruct:

```text
/sunco:new --from-preflight <path-to-approved-spec>
```

If the user started with `/sunco:new` and this workflow is being executed as an embedded preflight, return the approved spec path and summary to the parent `/sunco:new` flow.

## Success Criteria

- The vendored Superpowers skill was read.
- The hard gate against implementation was honored.
- A design doc exists.
- The user approved the written spec.
- The next step is `/sunco:new --from-preflight <spec-path>`.

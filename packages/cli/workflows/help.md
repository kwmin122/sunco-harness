# SUNCO Command Catalog

All commands, organized by category. Each entry shows the command, what it does, key flags, and when to use it.

---

## Getting Started

The full feature lifecycle, from raw idea to landed PR:

```
idea
  ↓
/sunco:office-hours        (pressure-test problem, user, wedge, demand evidence)
  ↓
/sunco:brainstorming       (vendored Superpowers — design/spec, HARD-GATE: no code)
  ↓
/sunco:new --from-preflight <spec>   (PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md)
  ↓ ── per phase ──────────────────────────────────────────────────────────────
/sunco:discuss N           (decisions + gray areas)
  ↓
/sunco:plan N              (bite-sized tasks, exact paths, BDD, verification steps)
  ↓
/sunco:execute N           (wave + worktree, fresh subagent per plan, lint-gate)
  ↓
/sunco:verify N            (7-layer swiss cheese — proof before completion)
  ↓
/sunco:review N            (multi-provider review; feedback → /sunco:quick|execute loop)
  ↓
/sunco:proceed-gate        (zero unresolved findings)
  ↓
/sunco:ship N              (PR) → /sunco:land (merge + deploy)
```

For existing projects, start from wherever you are:
- Raw idea, no spec → `/sunco:office-hours` (chains into brainstorming → new)
- Have spec, no project → `/sunco:new --from-preflight <spec>`
- Know what to build → `/sunco:discuss [N]`
- Have context, need plans → `/sunco:plan [N]`
- Have plans, need execution → `/sunco:execute [N]`
- Have code, need proof → `/sunco:verify [N]` → `/sunco:review [N]`

### Superpowers ↔ SUNCO Skill Map

SUNCO treats Superpowers' 14 built-in skills as a behavioral reference and covers the whole chain:

| Superpowers skill | SUNCO equivalent |
|---|---|
| using-superpowers | `/sunco:mode`, `/sunco:help` |
| brainstorming | `/sunco:brainstorming` (vendored source of truth) |
| writing-plans | `/sunco:plan` |
| executing-plans | `/sunco:execute` |
| subagent-driven-development | wave execution + `/sunco:workspaces` worktree |
| test-driven-development | `/sunco:test-gen` + `type: tdd` plan flag |
| systematic-debugging | `/sunco:debug` (Iron Law: reproduce → root cause → fix → verify) |
| verification-before-completion | `/sunco:verify` + `/sunco:proceed-gate` |
| requesting-code-review | `/sunco:review` |
| receiving-code-review | `/sunco:review` → `/sunco:quick`/`/sunco:execute` loop |
| dispatching-parallel-agents | `wave.parallelization: true` in plans |
| using-git-worktrees | `/sunco:workspaces`, `/sunco:workstreams` |
| finishing-a-development-branch | `/sunco:ship`, `/sunco:land`, `/sunco:pr-branch` |
| writing-skills | `@sunco/core` `defineSkill` + `.claude/rules/conventions.md` |

---

## Harness Commands

Deterministic enforcement. Zero LLM cost.

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `sunco init` | Scaffold `.sun/` config and `.planning/` directory structure | `--force` to reinitialize |
| `sunco lint` | Run ESLint + tsc + architecture boundary checks | `--fix` to auto-fix, `--watch` for guard mode |
| `sunco health` | Compute health score (0–100) across 5 dimensions | `--trend` to show history |
| `sunco guard` | File watcher that auto-lints on save | `--strict` to fail on warnings |
| `sunco graph` | Build dependency graph, show blast radius | `--blast --phase N` for pre-execute check |
| `sunco settings` | Show/edit `.sun/config.toml` | `--global` for `~/.sun/config.toml` |

### `/sunco:init`
Scaffolds the project workspace. Creates `.sun/` with config and `.planning/` with template files. Run once at project start.
```
/sunco:init
```

### `/sunco:lint`
Runs ESLint with flat config, tsc, and architecture boundary rules. The mandatory gate after every execution. Non-zero exit on any error.
```
/sunco:lint
/sunco:lint --fix
```

### `/sunco:health`
Composite health score with per-dimension breakdown: architecture compliance, test coverage, complexity, documentation, dependency hygiene. Score 0–100, grade A–F.
```
/sunco:health
/sunco:health --trend
```

### `/sunco:guard`
Starts a file watcher. Runs lint automatically on every save. Stays running in the background. Use during active development.
```
/sunco:guard
/sunco:guard --strict
```

### `/sunco:graph`
Builds a code dependency graph. Used by `/sunco:execute` for blast radius analysis. Can visualize import trees and surface circular dependencies.
```
/sunco:graph
/sunco:graph --blast --phase 3
```

---

## Workflow Commands

The 6-stage review pipeline: discuss → plan → execute → verify → ship.

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `sunco discuss N` | Extract decisions for Phase N before planning | `--batch`, `--mode assumptions` |
| `sunco plan N` | Create 2-3 atomic plans for Phase N | `--skip-research`, `--skip-verify` |
| `sunco execute N` | Execute all plans in parallel waves | `--wave N`, `--interactive` |
| `sunco verify N` | 7-layer Swiss cheese verification | `--layer N`, `--skip-adversarial`, `--skip-codex` |
| `sunco ship N` | Create PR and prepare release notes | `--dry-run` |
| `sunco review N` | Cross-agent code review | `--focus security|performance|style` |
| `sunco validate N` | Validate phase against REQUIREMENTS.md | |
| `sunco research [topic]` | Parallel research agents for a topic | `--agents N` |

### `/sunco:discuss N`
Two modes: interactive Q&A (`--mode discuss`, default) or codebase-first assumptions (`--mode assumptions`). Produces `{N}-CONTEXT.md`. Always run before `/sunco:plan`.
```
/sunco:discuss 1
/sunco:discuss 2 --mode assumptions
/sunco:discuss 3 --batch
```

### `/sunco:plan N`
Reads CONTEXT.md, optionally researches implementation, creates 2-3 atomic PLAN.md files with wave assignments. Runs a 3-iteration verification loop before finalizing.
```
/sunco:plan 1
/sunco:plan 2 --skip-research
```

### `/sunco:execute N`
Wave-based parallel execution. Mandatory blast radius check before start. Mandatory lint-gate after each plan. Creates SUMMARY.md per plan.
```
/sunco:execute 1
/sunco:execute 2 --wave 1
/sunco:execute 3 --interactive
```

### `/sunco:verify N`
7-layer Swiss cheese: multi-agent review, guardrails, BDD criteria, permission audit, adversarial test, cross-model (Codex), human eval. Each layer catches different failure modes.
```
/sunco:verify 1
/sunco:verify 2 --skip-adversarial
/sunco:verify 3 --layer 2
```

### `/sunco:ship N`
Creates a PR from completed phase work. Runs final checks, generates release notes, handles branch creation.
```
/sunco:ship 1
/sunco:ship 2 --dry-run
```

---

## Debug Commands

For investigation and post-mortem analysis.

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `sunco debug [issue]` | Systematic hypothesis-driven debugging | `--file path`, `--test name` |
| `sunco diagnose` | Quick system diagnostic, surfacing obvious issues | |
| `sunco forensics` | Post-mortem for a failed phase or regression | `--phase N` |

### `/sunco:debug`
Persistent debug sessions stored in `.sun/debug/`. Follows: reproduce → hypothesize → test → fix → prevent. Sessions survive context resets.
```
/sunco:debug "TypeError in config parser"
/sunco:debug --file packages/core/src/config.ts
/sunco:debug --test "config parser test"
```

### `/sunco:forensics`
Post-mortem investigation for a failed phase, unexpected regression, or broken build. Produces a root cause report.
```
/sunco:forensics
/sunco:forensics --phase 3
```

---

## Adaptive Lifecycle Commands

Navigate scope changes, revise decisions, and manage rollback points.

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `sunco pivot` | Detect scope changes, run impact analysis, re-route phases | `--dry-run` |
| `sunco rethink N` | Revise specific decisions in a phase CONTEXT.md | `--decision D-XX` |
| `sunco backtrack` | Restore .planning/ to a rollback point (code untouched) | `--label <name>` |
| `sunco reinforce` | Add requirements to current milestone, insert phases if needed | |
| `sunco where-am-i` | Full orientation dashboard: phase, decisions, changes, rollbacks | `--json`, `--phase N` |
| `sunco impact-analysis` | Compute invalidation cascade from artifact changes | `--changed <files>` |
| `sunco design-pingpong N` | Cross-model merge + debate (2.4x cost) | `--artifact`, `--model-b` |

### `/sunco:pivot`
Detect what changed, compute impact, and re-route affected phases. Use when project direction shifts.
```
/sunco:pivot
/sunco:pivot --dry-run
```

### `/sunco:rethink N`
Revise specific decisions without starting over. Original decisions preserved in collapsed blocks.
```
/sunco:rethink 2
/sunco:rethink 2 --decision D-03
```

### `/sunco:backtrack`
Restore planning artifacts to a previous state. Lists rollback points for selection.
```
/sunco:backtrack
/sunco:backtrack --label "after-discuss-2"
```

### `/sunco:where-am-i`
Complete "you are here" dashboard: decisions, changes, blockers, rollback points.
```
/sunco:where-am-i
/sunco:where-am-i --phase 3
```

---

## Session Commands

Track where you are and resume after breaks.

| Command | Description |
|---------|-------------|
| `sunco status` | Current phase, last action, what to do next |
| `sunco progress` | Phase completion percentage, requirements coverage |
| `sunco next` | Advance to next logical step automatically |
| `sunco pause` | Save session context for later resume |
| `sunco resume` | Resume from saved session context |
| `sunco context [N]` | Show full context for Phase N |

### `/sunco:status`
The "where am I?" command. Shows current phase, last completed action, and recommended next step.
```
/sunco:status
```

### `/sunco:next`
Automatically advances to the next logical step based on current state. Decides whether to run discuss, plan, execute, or verify.
```
/sunco:next
```

### `/sunco:pause`
Creates a handoff document so work can resume after a break or context reset. Saves current state, open tasks, and next action.
```
/sunco:pause
```

---

## Ideas Commands

Capture and manage project ideas without disrupting flow.

| Command | Description |
|---------|-------------|
| `sunco note [text]` | Zero-friction idea capture, appends to IDEAS.md |
| `sunco todo [text]` | Add a task to the todo list |
| `sunco seed [text]` | Capture a forward-looking idea for future phases |
| `sunco backlog` | Review and promote backlog items to phases |

---

## Composition Commands

Shorthand commands that compose the standard workflow.

| Command | Description | Use when |
|---------|-------------|----------|
| `sunco quick [task]` | Parse intent → execute → lint-gate → commit | Small task, clear scope |
| `sunco fast [task]` | Inline execution, no subagents | Trivial, < 5 min |
| `sunco do [task]` | Routes to the right command based on intent | Unsure which command to use |
| `sunco auto [N]` | Autonomous: discuss → plan → execute → verify for Phase N | Trusted unattended execution |

### `/sunco:quick`
The fast path for small tasks. Parses intent, optionally does a brief research or discuss pass, executes, and runs the mandatory lint-gate before committing.
```
/sunco:quick "add export for parseConfig function"
/sunco:quick --discuss "add pagination to the list command"
/sunco:quick --research "switch from chalk to picocolors"
```

---

## Management Commands

Planning artifacts and project lifecycle.

| Command | Description |
|---------|-------------|
| `sunco phase N` | Show phase details, status, plans |
| `sunco milestone` | Show milestone status and progress |
| `sunco map-codebase` | Analyze codebase structure with parallel agents |
| `sunco scan` | Scan existing project and suggest phase structure |
| `sunco export` | Export project state as a portable bundle |
| `sunco agents` | Show active agents, their tasks and status |
| `sunco workstreams` | Manage parallel workstreams |
| `sunco thread` | Manage persistent context threads |
| `sunco audit-uat` | Cross-phase audit of outstanding UAT issues |
| `sunco session-report` | Generate session report with what was built |

---

## New Project Commands

| Command | Description |
|---------|-------------|
| `sunco new [idea]` | Bootstrap new project: questions → research → requirements → roadmap |
| `sunco assume [phase]` | Generate assumption list for a phase (alias for `/sunco:discuss --mode assumptions`) |

---

## Security & Safety Commands

Protect your codebase and enforce safety boundaries.

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `sunco cso` | Chief Security Officer audit — OWASP Top 10, STRIDE, secrets | `--diff`, `--scope <domain>`, `--supply-chain` |
| `sunco careful` | Destructive command guardrails (rm -rf, DROP TABLE, force-push) | |
| `sunco freeze [dir]` | Restrict edits to a specific directory | |
| `sunco unfreeze` | Remove freeze boundary | |

### `/sunco:cso`
Full security posture audit. Maps attack surface, runs OWASP Top 10 assessment, STRIDE threat model, data classification, and produces findings with exploit scenarios. Read-only — never modifies code.
```
/sunco:cso
/sunco:cso --diff
/sunco:cso --scope auth
/sunco:cso --supply-chain
```

### `/sunco:careful`
Activates safety mode. Every bash command is checked for destructive patterns before execution. Warns on rm -rf, DROP TABLE, force-push, git reset --hard, kubectl delete, etc. User can override each warning.
```
/sunco:careful
```

### `/sunco:freeze`
Locks edits to a specific directory. Edit and Write tools are blocked outside the boundary. Read, Bash, Glob, Grep are unaffected.
```
/sunco:freeze packages/core/
/sunco:unfreeze
```

---

## Review Commands

Multi-perspective plan review before implementation.

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `sunco office-hours` | Pre-project diagnostic; chains to Superpowers brainstorming by default | |
| `sunco brainstorming` | Vendored Superpowers brainstorming before SUNCO planning | |
| `sunco ceo-review` | CEO/founder-mode plan review — scope, 10-star, premises | `--expand`, `--hold`, `--selective` |
| `sunco eng-review` | Engineering review — architecture, tests, performance | |
| `sunco design-review` | Designer's eye — dimensional scoring 0-10 | `--lite` |

### `/sunco:office-hours`
Structured diagnostic before building. Two modes: Startup (6 diagnostic forcing questions) or Builder (generative design partner). For project starts, continues to `/sunco:brainstorming` by default. Produces a design doc, never code.
```
/sunco:office-hours
```

### `/sunco:brainstorming`
Runs the vendored Superpowers brainstorming flow and hands the approved spec to `/sunco:new --from-preflight`.
```
/sunco:brainstorming
```

### `/sunco:ceo-review`
Reviews the plan from a product/founder perspective. Restates the problem, describes the 10-star version, challenges premises, and makes scope decisions.
```
/sunco:ceo-review
/sunco:ceo-review --expand
/sunco:ceo-review --hold
```

### `/sunco:eng-review`
Reviews the plan from an engineering manager perspective. Architecture, code quality, test coverage (with ASCII coverage diagram), and performance. Interactive — one issue at a time.
```
/sunco:eng-review
```

### `/sunco:design-review`
Reviews the plan from a design director perspective. Scores 6 dimensions 0-10, explains what would make each a 10, and proposes specific fixes.
```
/sunco:design-review
/sunco:design-review --lite
```

---

## Operations Commands

Performance tracking, deployment, and post-deploy monitoring.

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `sunco retro [window]` | Weekly engineering retrospective with trends | `compare`, `--team` |
| `sunco benchmark` | Performance baseline and regression detection | `--baseline`, `--compare`, `--trend` |
| `sunco land [#PR] [url]` | Merge PR → wait CI → deploy → health check | |
| `sunco canary <url>` | Post-deploy continuous monitoring | `--duration`, `--baseline`, `--quick` |

### `/sunco:retro`
Comprehensive retrospective: commit analysis, session detection, hotspot analysis, streak tracking, and actionable insights. Saves history for trend tracking.
```
/sunco:retro
/sunco:retro 14d
/sunco:retro compare
/sunco:retro 30d --team
```

### `/sunco:benchmark`
Measures build time, bundle size, test speed, and vitest bench results. Compares against baselines to detect regressions.
```
/sunco:benchmark --baseline
/sunco:benchmark --compare
/sunco:benchmark --trend
```

### `/sunco:land`
Complete deploy pipeline: merge PR, wait for CI, detect deploy platform, verify production health. Mostly automated with a pre-merge readiness gate.
```
/sunco:land
/sunco:land #42
/sunco:land https://myapp.com
```

### `/sunco:canary`
Post-deploy monitoring using HTTP health checks. Periodic checks, performance tracking, regression alerts, rollback trigger.
```
/sunco:canary https://myapp.com
/sunco:canary https://myapp.com --duration 5m
/sunco:canary https://myapp.com --baseline
/sunco:canary https://myapp.com --quick
```

---

## Quick Reference: Flags That Appear Everywhere

| Flag | Meaning |
|------|---------|
| `--batch` | Group related questions together instead of one at a time |
| `--interactive` | Sequential inline execution, no subagents |
| `--auto` | Skip confirmations, run research automatically |
| `--skip-research` | Skip the research step |
| `--dry-run` | Show what would happen without doing it |
| `--wave N` | Target a specific execution wave |
| `--layer N` | Target a specific verification layer |

---

## Model Profiles

Control cost vs. quality tradeoff. Set in `.sun/config.toml` or pass per-command.

| Profile | Best for |
|---------|----------|
| `quality` | Final verification, critical phases |
| `balanced` | Default for most phases |
| `budget` | Exploration, prototypes, low-stakes tasks |
| `inherit` | Use whatever the runtime provides |

Reference: `packages/cli/references/model-profiles.md`

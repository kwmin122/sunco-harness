# SUNCO Command Catalog

All commands, organized by category. Each entry shows the command, what it does, key flags, and when to use it.

---

## Getting Started

The standard workflow for a new project:

```
/sunco:init        → scaffold .sun/ and .planning/
/sunco:new         → bootstrap from idea to roadmap
/sunco:discuss 1   → extract decisions for Phase 1
/sunco:plan 1      → create atomic execution plans
/sunco:execute 1   → run plans in parallel waves
/sunco:verify 1    → 6-layer Swiss cheese verification
/sunco:ship 1      → create PR and prepare release
```

For existing projects, start from wherever you are:
- Know what to build → `/sunco:discuss [N]`
- Have context, need plans → `/sunco:plan [N]`
- Have plans, need execution → `/sunco:execute [N]`

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
| `sunco verify N` | 6-layer Swiss cheese verification | `--layer N`, `--skip-adversarial`, `--skip-codex` |
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
6-layer Swiss cheese: multi-agent review, guardrails, BDD criteria, permission audit, adversarial test, cross-model (Codex). Each layer catches different failure modes.
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

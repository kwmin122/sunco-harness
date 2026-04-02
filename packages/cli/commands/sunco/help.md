---
name: sunco:help
description: Show all SUNCO commands, usage guide, flag reference, and getting started walkthrough
allowed-tools:
  - Bash
  - Read
---

<objective>
Display the complete SUNCO command reference organized by category. Show every available skill with a one-line description, key flags, and usage examples. Include getting started guide and troubleshooting section.
</objective>

<process>
Output the full command catalog below. Do NOT add project-specific analysis, git status, or commentary beyond the reference.

---

## Getting Started

### New project (from idea to code)

```
/sunco:init                   → scaffold .sun/ and .planning/
/sunco:new                    → questions → research → requirements → roadmap
/sunco:discuss 1              → extract decisions for Phase 1
/sunco:plan 1                 → create 2-3 atomic execution plans
/sunco:execute 1              → run plans in parallel waves
/sunco:verify 1               → 7-layer Swiss cheese verification
/sunco:ship                   → create PR and prepare release
```

### Jump in to an existing project

```
/sunco:status                 → see where you are right now
/sunco:progress               → full phase/requirement breakdown
/sunco:next                   → automatically advance to next step
/sunco:manager                → full dashboard (recommended entry point)
```

### Autonomous mode (unattended)

```
/sunco:auto                   → run all remaining phases end-to-end
/sunco:auto --from 3          → start from phase 3 (skip earlier)
/sunco:auto --only 4          → run exactly phase 4
/sunco:auto --no-discuss      → skip discussion, use codebase-derived assumptions
```

---

## Harness Commands

Deterministic enforcement. Zero LLM cost.

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `/sunco:init` | Scaffold `.sun/` config and `.planning/` directory structure | `--force` to reinitialize |
| `/sunco:lint` | Run ESLint + tsc + architecture boundary checks | `--fix` auto-fix, `--watch` guard mode |
| `/sunco:health` | Codebase health score (0–100) across 5 dimensions | `--trend` show history |
| `/sunco:guard` | File watcher — auto-lints on every save | `--strict` fail on warnings |
| `/sunco:graph` | Dependency graph + blast radius analysis | `--blast --phase N` |
| `/sunco:agents` | Analyze agent instruction files (CLAUDE.md) — efficiency score | |
| `/sunco:settings` | Show/edit `.sun/config.toml` | `--global` for `~/.sun/config.toml` |

### Examples

```
/sunco:lint                   → check for errors
/sunco:lint --fix             → auto-fix what ESLint can
/sunco:health                 → composite score with per-dimension breakdown
/sunco:health --trend         → show score history over time
/sunco:guard                  → start watching files (stays running)
/sunco:guard --strict         → fail on warnings, not just errors
/sunco:graph --blast --phase 3 → blast radius before executing phase 3
```

---

## Core Workflow Commands

The 6-stage review pipeline: discuss → plan → execute → verify → ship.

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `/sunco:discuss N` | Extract decisions for Phase N before planning | `--batch`, `--mode assumptions` |
| `/sunco:assume N` | Codebase-first assumptions (lightweight alternative to discuss) | `--silent`, `--all` |
| `/sunco:plan N` | Create 2-3 atomic plans for Phase N | `--skip-research` |
| `/sunco:execute N` | Execute all plans in parallel waves | `--wave N`, `--interactive` |
| `/sunco:verify N` | 7-layer Swiss cheese verification | `--layer N`, `--skip-adversarial`, `--skip-cross-model`, `--skip-human-eval` |
| `/sunco:review N` | Cross-agent code review | `--focus security|performance|style` |
| `/sunco:ship` | Create PR and prepare release notes | `--dry-run` |
| `/sunco:validate N` | Validate phase against REQUIREMENTS.md | |
| `/sunco:research [topic]` | Parallel research agents for a topic | `--agents N` |
| `/sunco:new` | Bootstrap new project from idea to roadmap | |

### `/sunco:discuss N`

Two modes: interactive Q&A (`--mode discuss`, default) or codebase-first (`--mode assumptions`). Produces `CONTEXT.md`. Always run before `/sunco:plan`.

```
/sunco:discuss 1              → full interactive discussion
/sunco:discuss 2 --mode assumptions → codebase-first, then surface gaps
/sunco:discuss 3 --batch      → group questions together
```

### `/sunco:plan N`

Reads CONTEXT.md, optionally researches, creates 2-3 atomic PLAN.md files with wave assignments. Runs a verification loop before finalizing.

```
/sunco:plan 1
/sunco:plan 2 --skip-research
```

### `/sunco:execute N`

Wave-based parallel execution. Mandatory blast radius check before start. Mandatory lint-gate after each plan.

```
/sunco:execute 1              → execute all plans
/sunco:execute 2 --wave 1     → execute only wave 1
/sunco:execute 3 --interactive → sequential, no subagents
```

### `/sunco:verify N`

5-layer Swiss cheese: multi-agent review, guardrails, BDD criteria, permission audit, adversarial test.

```
/sunco:verify 1
/sunco:verify 2 --skip-adversarial
/sunco:verify 3 --layer 2     → run only layer 2
```

---

## Debug Commands

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `/sunco:debug [issue]` | Systematic hypothesis-driven debugging | `--file path`, `--test name` |
| `/sunco:diagnose` | Quick system diagnostic, surfacing obvious issues | |
| `/sunco:forensics` | Post-mortem for a failed phase or regression | `--phase N` |

```
/sunco:debug "TypeError in config parser"
/sunco:debug --file packages/core/src/config.ts
/sunco:forensics --phase 3
```

---

## Session Commands

| Command | Description |
|---------|-------------|
| `/sunco:status` | Current phase, last action, what to do next |
| `/sunco:progress` | Phase completion percentage, requirements coverage |
| `/sunco:next` | Advance to next logical step automatically |
| `/sunco:pause` | Save session context for later resume |
| `/sunco:resume` | Resume from saved session context |
| `/sunco:context [N]` | Show full context for Phase N |
| `/sunco:thread` | Manage persistent cross-session context threads |

---

## Ideas Commands

| Command | Description |
|---------|-------------|
| `/sunco:note [text]` | Zero-friction idea capture, appends to IDEAS.md |
| `/sunco:todo [text]` | Add a task to the todo list |
| `/sunco:seed [text]` | Capture a forward-looking idea with trigger conditions |
| `/sunco:backlog` | Review and promote backlog items to phases |

---

## Quick Ops

| Command | Description | Use when |
|---------|-------------|----------|
| `/sunco:quick [task]` | Parse intent → execute → lint-gate → commit | Small task, clear scope |
| `/sunco:fast [task]` | Inline execution, no subagents | Trivial, < 5 min |
| `/sunco:do [task]` | Routes freeform text to the right command | Unsure which command to use |

### `/sunco:quick` flags

| Flag | Effect |
|------|--------|
| `--discuss` | Ask 2-3 clarifying questions first |
| `--research` | Spawn research agent before executing |
| `--full` | Create mini-plan + verify acceptance criteria |
| `--no-commit` | Execute and lint-gate but skip commit |

```
/sunco:quick "add export for parseConfig"
/sunco:quick --discuss "add pagination to the list command"
/sunco:quick --research "switch from chalk to picocolors"
/sunco:quick --full "refactor config loader to use Zod"
```

---

## Management Commands

| Command | Description |
|---------|-------------|
| `/sunco:phase N` | Show phase details, status, plans |
| `/sunco:milestone` | Manage milestones — audit, archive, new |
| `/sunco:release` | Prepare a versioned release |
| `/sunco:workstreams` | Manage parallel workstreams |
| `/sunco:workspaces` | Manage isolated project workspaces |
| `/sunco:map-codebase` | Analyze codebase with 4 parallel mapper agents |
| `/sunco:scan` | Scan existing project and suggest phase structure |
| `/sunco:audit-uat` | Cross-phase audit of outstanding UAT issues |
| `/sunco:session-report` | Generate session report with what was built |
| `/sunco:stats` | Project statistics — phases, plans, requirements, git metrics |
| `/sunco:export` | Generate self-contained HTML project report |
| `/sunco:manager` | Interactive command center dashboard |

---

## UI Design Commands

| Command | Description |
|---------|-------------|
| `/sunco:ui-phase` | Generate UI design contract (UI-SPEC.md) for frontend phases |
| `/sunco:ui-review` | Retroactive 6-pillar visual audit of implemented frontend code |

---

## Model Profile Commands

| Command | Description |
|---------|-------------|
| `/sunco:profile` | Manage model profiles — quality, balanced, budget |
| `/sunco:settings` | View and manage TOML configuration |
| `/sunco:update` | Update SUNCO to latest version |

---

## Universal Flags (appear across commands)

| Flag | Meaning |
|------|---------|
| `--batch` | Group related questions together instead of one at a time |
| `--interactive` | Sequential inline execution, no subagents |
| `--auto` | Skip confirmations, run research automatically |
| `--skip-research` | Skip the research step |
| `--dry-run` | Show what would happen without doing it |
| `--wave N` | Target a specific execution wave |
| `--layer N` | Target a specific verification layer |
| `--json` | Machine-readable JSON output (usable in CI) |
| `--compact` | Condensed single-screen output |
| `--no-commit` | Execute changes but skip git commit |
| `--force` | Override safety checks (use with care) |
| `--verbose` | Show full details |

---

## Model Profiles

Control cost vs. quality tradeoff. Set in `.sun/config.toml` or pass per-command.

| Profile | Best for |
|---------|----------|
| `quality` | Final verification, critical phases |
| `balanced` | Default for most phases |
| `budget` | Exploration, prototypes, low-stakes tasks |
| `inherit` | Use whatever the runtime provides |

---

## SUNCO Differentiators

- **Harness Engineering**: Lint rules that teach while blocking. Architecture violations caught before agents make them.
- **Deterministic First**: `init`, `lint`, `health`, `guard`, `agents` run at zero LLM cost — pure static analysis.
- **5-Layer Swiss Cheese Verification**: multi-agent → guardrails → BDD → permissions → adversarial.
- **6-Stage Review Pipeline**: idea → discuss → plan → execute → verify → ship.
- **Skill-Only Architecture**: Every feature is a composable skill. No hardcoded commands.
- **Proactive Recommender**: 50+ deterministic rules suggesting next-best-action after every skill.
- **Provider-Agnostic Agent Router**: Claude, OpenAI, Google, Ollama — same skill API.
- **Korean Developer First**: The first workspace OS designed for the Korean dev community.

---

## Troubleshooting

**"No SUNCO project found"**
→ Run `/sunco:init` in your project directory.

**Lint gate keeps failing**
→ Run `/sunco:lint --fix` to auto-fix what ESLint can, then check remaining errors manually.
→ Check `packages/cli/references/` for architecture rules.

**Autonomous run crashed**
→ Re-run `/sunco:auto` — it resumes from the last completed phase automatically.
→ Use `--from N` to skip to a specific phase.

**Plan not found**
→ Run `/sunco:discuss [N]` first to create CONTEXT.md, then `/sunco:plan [N]`.

**Verification partial**
→ Run `/sunco:verify [N] --layer 3` to target BDD layer specifically.
→ Run `/sunco:forensics --phase [N]` for root cause analysis.

---

---

## Workflow Quick Reference

### Standard single-phase flow (most common)

```
/sunco:discuss N   → gather context and decisions
/sunco:plan N      → create 2-3 atomic execution plans
/sunco:execute N   → execute plans in parallel waves
/sunco:verify N    → 5-layer verification
/sunco:ship        → create PR
```

### Small ad-hoc tasks

```
/sunco:quick "add export for parseConfig"              → execute + lint + commit
/sunco:quick --discuss "add pagination to list"        → clarify then execute
/sunco:quick --research "switch to picocolors"         → research then execute
/sunco:fast "rename variable X to Y in file Z"         → trivial inline execution
```

### When you're lost

```
/sunco:status      → "where am I right now?"
/sunco:next        → "what should I do next?" (auto-routes)
/sunco:manager     → full dashboard view
/sunco:do "help me figure out what to work on"   → natural language routing
```

### Autonomous (trust the pipeline)

```
/sunco:auto                         → run all phases
/sunco:auto --from 3                → resume from phase 3
/sunco:auto --only 4                → run just phase 4
/sunco:auto --dry-run               → preview only, no changes
/sunco:auto --no-discuss --budget 50000  → fast unattended run
```

### Debugging

```
/sunco:debug "error description"    → systematic hypothesis-driven debug
/sunco:diagnose                     → quick automated diagnostic
/sunco:forensics --phase 3          → post-mortem for failed phase
/sunco:lint --fix                   → fix architecture violations
```

### Milestone lifecycle

```
/sunco:milestone            → show milestone status
/sunco:milestone complete   → archive and tag
/sunco:new-milestone        → start next milestone
/sunco:stats                → full project metrics
```

---

## Common Patterns

### Starting a new feature from scratch

```
/sunco:new                           # define project idea and roadmap
/sunco:discuss 1                     # define what to build in phase 1
/sunco:plan 1                        # create atomic execution plans
/sunco:execute 1                     # build it
/sunco:verify 1                      # verify it works
/sunco:ship                          # PR + release notes
```

### Resuming after a break

```
/sunco:resume                        # restore session context
/sunco:manager                       # see current state
/sunco:next                          # get routed to the right step
```

### Handling a lint gate failure during execute

```
/sunco:lint                          # see what's failing
/sunco:lint --fix                    # auto-fix what ESLint can
/sunco:execute N                     # re-run execution
```

### Auditing before milestone close

```
/sunco:audit-uat                     # cross-phase UAT check
/sunco:milestone complete --dry-run  # preview what would happen
/sunco:milestone complete            # actually complete it
```

---

---

## Skill Architecture Note

All SUNCO commands are implemented as skills via `defineSkill()`. This means:

1. **Composable**: any skill can invoke another with `ctx.run('sunco:discuss', args)`
2. **Deterministic where possible**: `init`, `lint`, `health`, `guard` use zero LLM tokens
3. **Provider-agnostic**: agent-powered skills route through the Vercel AI SDK abstraction
4. **Proactive**: after every skill, the recommender engine suggests the next best action

This architecture means commands aren't isolated — they share state, can chain, and the recommender understands context from all of them.

---

## Debug + Investigation Reference

When something goes wrong, use this sequence:

```
/sunco:diagnose          → automated root cause scan (fast, no LLM)
/sunco:debug "issue"     → structured hypothesis-driven debugging session
/sunco:forensics --phase N → post-mortem for a failed phase
/sunco:lint              → architecture violation check
/sunco:health            → composite health score with regression detection
```

### Debug session lifecycle

`/sunco:debug` creates a persistent session in `.sun/debug/` that survives context resets:
1. Reproduce: confirm the bug is real and reproducible
2. Hypothesize: generate 3-5 ordered hypotheses with evidence
3. Test: systematically eliminate hypotheses
4. Fix: apply fix to the confirmed hypothesis
5. Prevent: add lint rule or test to prevent recurrence

---

## Release Lifecycle

```
/sunco:milestone complete    → archive, tag, update requirements
/sunco:release               → bump version, generate changelog, final checks
/sunco:ship                  → create PR with auto-generated release notes
```

### Version format

SUNCO follows semver. The `release` skill:
- Reads current version from `package.json`
- Determines bump type from commit history (feat → minor, fix → patch, BREAKING → major)
- Writes `CHANGELOG.md` entry from commit messages since last tag
- Proposes the new version for confirmation before tagging

---

## Thread and Cross-Session Context

```
/sunco:thread                → create a named persistent thread
/sunco:thread "topic"        → append to a named thread
/sunco:thread --list         → show all active threads
/sunco:pause                 → snapshot current session to a handoff doc
/sunco:resume                → restore from the most recent pause
```

Threads persist across Claude Code context resets. They hold:
- Decisions made in previous sessions
- Open questions not yet answered
- Links to relevant files and artifacts

Use `/sunco:thread` when working on a feature across multiple sessions. Use `/sunco:pause` + `/sunco:resume` for interruptions within a single feature.

---

## CI / Headless Usage

Some commands support headless output via `--json` for CI pipelines:

```bash
# Get project status as JSON
/sunco:progress --json

# Check phase completion
/sunco:query

# Run autonomous pipeline in CI (no interactive prompts)
/sunco:auto --no-discuss --no-resume --dry-run
```

For CI integration, see `/sunco:headless` which wraps the full pipeline with JSON I/O and exit codes.

---

## Config Quick Reference

Key settings in `.sun/config.toml`:

```toml
[workflow]
skip_discuss = false       # Skip discuss step in auto mode
skip_verify = false        # Skip verification (lint still runs)

[lint]
strict_mode = false        # Zero warnings (not just zero errors)

[git]
branching_strategy = "none"  # none | phase | milestone
main_branch = "main"
commit_docs = true

[autonomous]
max_phases = 0             # 0 = unlimited
max_tokens = 0             # 0 = unlimited

[model]
profile = "balanced"       # quality | balanced | budget
```

Edit with `/sunco:settings` or directly in `.sun/config.toml`.

---

---

## Keyboard Navigation

SUNCO commands are invoked via `/sunco:*` in Claude Code. There are no keyboard shortcuts natively — but you can configure keybindings for frequently used commands in `~/.claude/keybindings.json`. Use `/keybindings-help` for setup guidance.

Common keybinding candidates:
- `/sunco:manager` — daily entry point
- `/sunco:next` — advance to next step
- `/sunco:quick` — ad-hoc task execution
- `/sunco:lint --fix` — fix architecture violations
- `/sunco:status` — instant phase check

---

Usage: Run any `/sunco:*` command in Claude Code to invoke it.
</process>

---
name: sunco:help
description: Show all SUNCO commands and usage guide
allowed-tools:
  - Bash
  - Read
---

<objective>
Display the complete SUNCO command reference organized by category. Show every available skill with a one-line description. Highlight SUNCO differentiators at the bottom.
</objective>

<process>
Output the full command catalog below. Do NOT add project-specific analysis, git status, or commentary beyond the reference.

---

## SUNCO Command Reference

### Harness (Deterministic, Zero LLM Cost)
| Command | Description |
|---------|-------------|
| `/sunco:init` | Initialize project harness — detect stack, layers, conventions, generate rules |
| `/sunco:lint` | Check architecture boundaries — dependency direction, layer violations |
| `/sunco:health` | Codebase health score with trend tracking |
| `/sunco:guard` | Real-time lint-on-change with rule promotion |
| `/sunco:agents` | Analyze agent instruction files (CLAUDE.md) — efficiency score |

### Core Workflow
| Command | Description |
|---------|-------------|
| `/sunco new` | Bootstrap a new project or feature from scratch |
| `/sunco discuss` | Collaborative design discussion before planning |
| `/sunco plan` | Generate a structured execution plan |
| `/sunco execute` | Execute the current plan phase |
| `/sunco verify` | Verify implementation against acceptance criteria |
| `/sunco review` | Request code review via 6-stage pipeline |
| `/sunco ship` | Prepare and publish a release |
| `/sunco auto` | Autonomous end-to-end execution (discuss → plan → execute → verify → ship) |

### Debugging
| Command | Description |
|---------|-------------|
| `/sunco debug` | Interactive debugging with hypothesis tracking |
| `/sunco diagnose` | Automated root cause diagnosis |
| `/sunco forensics` | Post-mortem investigation for failed workflows |

### Documents
| Command | Description |
|---------|-------------|
| `/sunco doc` | Generate project documentation |
| `/sunco:export` | Generate self-contained HTML project report |

### Analysis
| Command | Description |
|---------|-------------|
| `/sunco:status` | Show current project status, phase, and progress |
| `/sunco:query` | Instant JSON state snapshot — phase, progress, next action (no LLM) |
| `/sunco:graph` | Code dependency graph and blast radius analysis |
| `/sunco stats` | Project statistics — phases, plans, requirements, git metrics |
| `/sunco map-codebase` | Analyze codebase with parallel mapper agents |

### Session
| Command | Description |
|---------|-------------|
| `/sunco pause` | Create context handoff when pausing work mid-session |
| `/sunco resume` | Resume work from previous session with full context |
| `/sunco next` | Advance to the next logical step automatically |
| `/sunco progress` | Check progress and route to next action |
| `/sunco context` | Show current session context and state |

### Ideas
| Command | Description |
|---------|-------------|
| `/sunco note` | Zero-friction idea capture |
| `/sunco todo` | Capture task as todo from current context |
| `/sunco seed` | Plant a forward-looking idea with trigger conditions |
| `/sunco backlog` | Review and promote backlog items |
| `/sunco thread` | Manage persistent context threads for cross-session work |

### Quick Ops
| Command | Description |
|---------|-------------|
| `/sunco quick` | Execute a quick task with guarantees (atomic commits, state tracking) |
| `/sunco fast` | Execute a trivial task inline — no planning overhead |
| `/sunco do` | Route freeform text to the right command automatically |

### Management
| Command | Description |
|---------|-------------|
| `/sunco phase` | Manage phases — add, insert, remove, complete |
| `/sunco milestone` | Manage milestones — audit, archive, new |
| `/sunco release` | Prepare a versioned release |
| `/sunco workstreams` | Manage parallel workstreams |
| `/sunco workspaces` | Manage isolated project workspaces |

### UI Design
| Command | Description |
|---------|-------------|
| `/sunco ui-phase` | Generate UI design contract (UI-SPEC.md) for frontend phases |
| `/sunco ui-review` | Retroactive 6-pillar visual audit of implemented frontend code |

### Config
| Command | Description |
|---------|-------------|
| `/sunco:settings` | View and manage TOML configuration |
| `/sunco profile` | Generate and manage developer behavioral profile |

### Meta
| Command | Description |
|---------|-------------|
| `/sunco:help` | Show all SUNCO commands and usage guide |
| `/sunco update` | Update SUNCO to latest version |
| `/sunco manager` | Interactive command center for managing multiple phases |

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

Usage: Run any command above in Claude Code to invoke it.
</process>

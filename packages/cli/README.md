# SUNCO

**Agent Workspace OS** — harness engineering for AI coding agents.

65 skills. 7-layer verification. Adaptive lifecycle. Zero mistakes.

```bash
npx popcoru
```

## What is SUNCO?

In an era where AI agents write code, the builder's job is not writing code — it's **setting up the field so agents make fewer mistakes**. SUNCO is that field.

- **Harness Engineering** — lint, health check, and guard enforce quality deterministically (zero LLM cost)
- **65 Skills** — every capability is a skill. No hardcoded commands.
- **7-Layer Verification** — multi-agent review, guardrails, BDD, permissions, adversarial, cross-model, human eval
- **Adaptive Lifecycle** — pivot, rethink, backtrack, reinforce when requirements change
- **Multi-Runtime** — Claude Code, Codex, Cursor, Antigravity

## Install

```bash
npx popcoru
```

Interactive installer asks: language (EN/KR), runtime (Claude Code/Codex/Cursor/Antigravity/All).

## Quick Start

```bash
/sunco:new           # idea -> questions -> research -> roadmap
/sunco:discuss 1     # extract decisions for Phase 1
/sunco:plan 1        # create atomic execution plans
/sunco:execute 1     # run plans in parallel waves
/sunco:verify 1      # 7-layer Swiss cheese verification
/sunco:ship 1        # create PR and release
```

## Commands (65)

### Harness (Zero LLM Cost)
| Command | Description |
|---------|-------------|
| `init` | Scaffold .sun/ and .planning/ |
| `lint` | Architecture boundary check |
| `health` | Codebase health score with trends |
| `guard` | Real-time lint-on-change + rule drafting |
| `agents` | Agent instruction analysis |

### Workflow
| Command | Description |
|---------|-------------|
| `new` | Bootstrap from idea to roadmap |
| `discuss` | Extract decisions before planning |
| `plan` | Create verified execution plans |
| `execute` | Wave-based parallel execution |
| `verify` | 7-layer verification |
| `ship` | Create PR after verification |
| `auto` | Full autonomous pipeline |

### Adaptive Lifecycle (NEW in v0.3.2)
| Command | Description |
|---------|-------------|
| `pivot` | Detect scope changes, re-route phases |
| `rethink` | Revise specific decisions |
| `backtrack` | Restore to rollback point |
| `reinforce` | Add requirements mid-milestone |
| `where-am-i` | Full orientation dashboard |
| `impact-analysis` | Invalidation cascade |
| `design-pingpong` | Cross-model merge + debate |

### Debug
| Command | Description |
|---------|-------------|
| `debug` | Systematic debugging with state |
| `diagnose` | Quick system diagnostic |
| `forensics` | Post-mortem analysis |

### Session
| Command | Description |
|---------|-------------|
| `status` | Current state |
| `progress` | Phase completion % |
| `next` | Auto-advance |
| `pause` / `resume` | Session management |
| `where-am-i` | Orientation dashboard |

### Composition
| Command | Description |
|---------|-------------|
| `auto` | Full pipeline (discuss -> ship) |
| `quick` | Fast execution with guarantees |
| `fast` | Skip planning, execute immediately |
| `do` | Natural language -> command routing |
| `mode` | SUNCO super mode |

## Architecture

```
sunco-tools.cjs (2,179 lines)    — Workflow automation engine
65 commands                        — Thin routers to workflows
64 workflows                       — Full process definitions
18 agents                          — Specialized AI agent definitions
15 references                      — Domain knowledge documents
25+ templates                      — Artifact templates
4 hooks                            — Git/lifecycle hooks
```

## v0.3.2 Highlights

- **Adaptive Lifecycle** — 7 new workflows for handling scope changes mid-project
- **Quality Supremacy** — executor, phase-researcher, integration-checker agents enhanced
- **Artifact Hash System** — detect changes to planning artifacts, compute invalidation cascade
- **Rollback Points** — snapshot and restore .planning/ state at any phase boundary
- **Design Pingpong** — cross-model merge + debate protocol (2.4x cost, opt-in)
- **Guard --draft-claude-rules** — auto-generate conditional .claude/rules/ from codebase patterns
- **Codex Benchmark** — A/B comparison framework for harness quality testing

## Stats

| Category | Lines |
|----------|-------|
| Workflows | 25,306 |
| Templates | 7,347 |
| References | 5,026 |
| Agents | 10,111 |
| Tools | 2,529 |
| **Total** | **50,319** |

## Links

- [GitHub](https://github.com/kwmin122/sunco-harness)
- [npm](https://www.npmjs.com/package/popcoru)
- [Landing Page](https://sunco-harness.vercel.app)

## License

MIT

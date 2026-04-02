---
description: Monorepo structure, key architecture patterns, package responsibilities
globs:
  - "packages/**"
  - "packages/*/src/**"
---

### Monorepo Structure (Turborepo + npm workspaces)
```
packages/
  core/          -- CLI engine, config (TOML), state (SQLite WAL + flat files),
                    skill system (defineSkill, scanner, resolver, registry),
                    agent router (provider-agnostic), proactive recommender,
                    UI foundation (primitives, components, adapters)
  skills-harness/ -- Deterministic backbone skills (zero LLM cost):
                    init, lint, health, agents, guard, settings, sample-prompt
  skills-workflow/ -- All workflow skills (33 skills):
                    Session: status, progress, next, context, pause, resume
                    Ideas: note, todo, seed, backlog
                    Management: phase, settings (enhanced)
                    Bootstrap: new, scan
                    Planning: discuss, assume, research, plan
                    Execution: execute, review
                    Verification: verify, validate, test-gen
                    Shipping: ship, release, milestone
                    Composition: auto, quick, fast, do
                    Debugging: debug, diagnose, forensics
  skills-extension/ -- Extension point for user-defined skills
  cli/           -- CLI entry point, Commander.js registration, preloaded skills
```

### Key Architecture Patterns
- **Skill-Only**: All functionality delivered as skills via `defineSkill()`. No hardcoded commands
- **Deterministic First**: Lint/test/health are deterministic. LLM only where judgment needed
- **Agent Router**: Provider-agnostic abstraction over Claude/OpenAI/Google/Ollama via Vercel AI SDK
- **Proactive Recommender**: 50+ deterministic rules engine suggesting next-best-action after every skill
- **Config Hierarchy**: Global (~/.sun/config.toml) -> Project (.sun/config.toml) -> Directory
- **State Engine**: SQLite WAL for structured data + FileStore for .sun/ flat files
- **UI Contract**: SkillUi (skill intent API) + UiAdapter (Ink/console/silent renderers)
- **6-Stage Review Pipeline**: idea -> discuss -> plan -> execute -> verify -> ship
- **7-Layer Swiss Cheese**: multi-agent -> guardrails -> BDD -> permissions -> adversarial -> cross-model -> human eval

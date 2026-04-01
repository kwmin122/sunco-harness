# Copilot / Cursor Instructions — {{project_name}}

> This file configures AI coding assistants (GitHub Copilot, Cursor, Windsurf, etc.) for this project.
> For the primary agent runtime (Claude Code via SUNCO), see `CLAUDE.md`.

---

## Primary Reference

All project conventions, architecture rules, and coding standards are defined in `CLAUDE.md` at the root of this repository. Read it before making suggestions.

Key sections in CLAUDE.md:
- **Project** — what SUNCO is and its core value
- **Technology Stack** — confirmed tech decisions, what NOT to use
- **Architecture** — monorepo layout, skill system, import patterns
- **Conventions** — file naming, skill patterns, testing approach

---

## Project Context

**Name:** {{project_name}}
**Language:** TypeScript (strict mode, ESM-only)
**Runtime:** Node.js {{required_node}}+
**Build:** tsup
**Test:** Vitest
**Lint:** ESLint flat config

---

## Quick Rules for Suggestions

- ESM-only: use `.js` extension in all relative imports, even for `.ts` files
- No `any` — use `unknown` and narrow explicitly
- No default exports from skill files — use named exports + `defineSkill()`
- All skills use the `defineSkill()` factory — do not write raw Commander commands
- Prefer `zod` for schema validation, `smol-toml` for TOML parsing
- Do not suggest `jest`, `webpack`, `inquirer`, `blessed`, or `axios`
- Monorepo: check which `packages/` workspace a file belongs to before importing

---

*For full conventions, read CLAUDE.md.*
*For agent execution context, SUNCO manages CLAUDE.md automatically.*

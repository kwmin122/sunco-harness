# Phase 34: Codex Layer 6 Integration — Verification

**Verified:** 2026-04-13
**Branch / HEAD:** `main` @ `3850730`
**Verdict:** **PASS**
**Director:** Opus 4.6 · **Implementer:** Sonnet 4.6 subagent (tasks 34-01-01..08 + 1 fix commit) · **Advisor channel:** not invoked
**CI:** run `24309353327` — **PASS** (Node 22 + Node 24)

---

## Executive summary

| Area | Result |
|------|--------|
| Monorepo build (`npm run build`) | **PASS** — 5/5 packages |
| Monorepo tests (`npm test`) | **PASS** — 10/10 turbo tasks, 1174+ tests total |
| CI (GH Actions) | **PASS** — run `24309353327` (push commit `3850730`) |
| CodexCliProvider created | ✅ `codex-cli`, family `openai`, transport `cli` |
| `meta` field on AgentRequest | ✅ `meta?: Readonly<Record<string, unknown>>` |
| Router.listProvidersWithFamily() | ✅ interface + implementation |
| selectCrossFamilyProviders helper | ✅ pure function, exported, tested |
| runLayer6CrossModel rewrite | ✅ no more `providers.slice(0, 2)` |
| `--require-codex` flag | ✅ wired in verify.skill.ts → Layer 6 opts |
| CodexCliProvider registered in lifecycle | ✅ conditional on isAvailable() |
| Forbidden scans | ✅ 0 `@openai`, 0 `OPENAI_API_KEY`, 0 `@anthropic-ai/sdk`, 0 `slice(0,2)` |

---

## Acceptance criteria (34-01-PLAN.md done_when)

All items confirmed ✅:

- **CodexCliProvider exists** at `packages/core/src/agent/providers/codex-cli.ts`
  - `id: 'codex-cli'`, `family: 'openai'`, `transport: 'cli'`
- **isAvailable()** returns true/false via `which codex`
- **execute()** spawns `codex review --base <ref> -c sandbox_permissions=["disk-full-read-access"] -` with stdin prompt
- **AgentRouter.listProvidersWithFamily()** returns `Array<{ id, family }>` for available providers
- **AgentRouterApi interface** includes `listProvidersWithFamily` signature
- **selectCrossFamilyProviders()** pure helper exported from `verify-layers.ts`
- **runLayer6CrossModel()** no longer uses `providers.slice(0, 2)` — deterministic cross-family selection
- **runLayer6CrossModel()** accepts `opts: { requireCodex?: boolean }`
- **Normal mode + codex available** → crossVerify with [claude, codex]
- **Normal mode + codex unavailable** → skeptical reviewer + low WARN "install codex"
- **--require-codex + codex unavailable** → high-severity FAIL, no fallback
- **--skip-cross-model precedence** preserved — Layer 6 skipped regardless of --require-codex
- **verify.skill.ts** declares `--require-codex` option
- **CodexCliProvider registered** in `packages/core/src/cli/lifecycle.ts`
- **New tests:** codex-cli.test.ts (9), router.test.ts (+3), cross-family-selection.test.ts (5), layer6-behavior.test.ts (5) = **22 new test cases**
- **All existing tests pass** — zero regressions
- **npm run build** 5/5 green
- **npm test** 10/10 green
- **CI** green after push
- **Forbidden scans** all clean
- **No new commands**, no new `.skill.ts`, no config/state schema changes
- **codex not required at build time** — isAvailable() returning false is normal

---

## Commits (9)

| SHA | Task | Summary |
|-----|------|---------|
| `e4b0891` | 34-01-01 | Create CodexCliProvider + add meta to AgentRequest |
| `374c21a` | 34-01-02 | Export CodexCliProvider from core barrels |
| `83fe5bc` | 34-01-03 | Add listProvidersWithFamily to AgentRouter + tests |
| `d1bacaf` | 34-01-04 | CodexCliProvider unit tests (9 cases) |
| `1c94c07` | 34-01-05 | selectCrossFamilyProviders + rewrite runLayer6CrossModel |
| `cfcb097` | 34-01-06 | Add --require-codex flag to verify.skill.ts |
| `2a0f647` | 34-01-07 | Tests for selectCrossFamilyProviders + Layer 6 behavior |
| `4983e12` | 34-01-08 | Register CodexCliProvider in lifecycle + final verify |
| `3850730` | 34-01-08 fix | Fix context.test.ts mock missing listProvidersWithFamily |

---

## Test delta

| Package | Before | After | Delta |
|---------|--------|-------|-------|
| @sunco/core | 355 | 368 | +13 |
| @sunco/skills-workflow | 796 | 806 | +10 |
| **Total** | **1151** | **1174** | **+23** |

---

## Risk assessment

- **Zero-cost in codex-absent environments:** CodexCliProvider.isAvailable() returns false → not registered → Layer 6 falls back to skeptical reviewer exactly as before Phase 34
- **No SDK/API surface:** Pure CLI subprocess via execa, inherits user's `~/.codex/` auth
- **Rollback:** Revert 9 commits, Layer 6 reverts to `providers.slice(0, 2)` — functional but potentially same-family

---

*Phase: 34-codex-layer6*
*Verification: 2026-04-13 by director (Opus 4.6)*

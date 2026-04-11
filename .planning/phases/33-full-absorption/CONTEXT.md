# Phase 33: Full Absorption - Context

**Gathered:** 2026-04-11
**Status:** Decisions locked. Wave 1 ready for planning. Waves 2/3 staged behind Wave 1 verify.
**Upstream:** Phase 32 (alias infra) + Phase 27 (flag-based delegation) + Phase 25 (surface discipline)
**External input:** User's "Full Absorption, wave-based" directive 2026-04-11
**Director:** Opus 4.6 · **Implementer:** Sonnet 4.6 subagent (per wave)

<domain>
## Phase Boundary

Phase 33 completes the consolidation journey started in Phase 25 / 27 / 32. The end state: users see ~13 main commands (`new`, `next`, `do`, `status`, `help`, `review`, `quick`, `plan`, `execute`, `verify`, `doc`, `note`, `debug`, `ship`), and everything else is either an alias on one of those or gone.

This is a **full-absorption phase**, not a surface-hiding phase. Satellite skill files are **deleted** and their implementations move to shared modules consumed by the absorbing skill. Aliases (Phase 32 infra) preserve CLI backward compatibility (`sunco query` still works) and `ctx.run()` backward compatibility (`ctx.run('workflow.query')` still works) via `registry.resolveId()` + default args.

**Phase 33 is split into 3 waves.** Each wave is a separate plan, executed sequentially with verify-between-waves. This is explicit user direction — no big-bang release.

### Wave 1 — Deterministic absorption (THIS PLAN, `33-01-PLAN.md`)

6 absorptions, all deterministic skills with existing delegate paths:

- `query` → `status --json` (97 lines)
- `context` → `status --brief` (224 lines — largest Wave 1 migration)
- `validate` → `verify --coverage` (209 lines; recommender rules also touch this)
- `todo` → `note --todo` (157 lines)
- `seed` → `note --seed` (128 lines)
- `backlog` → `note --backlog` (154 lines)

Wave 1 total: **969 lines of implementation to migrate**, 6 skill files deleted, 3 absorbing skills updated (`status`, `verify`, `note`), 1 recommender rules cleanup, 1 `do-route.ts` stale catalog cleanup, 6 alias declarations.

### Wave 2 — Prompt/report absorption (`33-02-PLAN.md`, drafted after Wave 1 PASS)

3 absorptions, require option design because they impact planning/verification flows:

- `export` → `doc --report`
- `assume` → `plan --assume`
- `test-gen` → `verify --generate-tests`

Wave 2 depends on Wave 1's absorption patterns (shared modules, alias declarations). Cannot start until Wave 1 ships and dogfood is clean.

### Wave 3 — Debug / review structure + compound hook (`33-03-PLAN.md`)

- `diagnose` → `debug --parse` (file deletion)
- `forensics` → `debug --postmortem` (file deletion)
- `ceo-review` / `eng-review` / `design-review` → `packages/skills-workflow/src/review/` subdir (files grouped; CLI commands remain as expert-tier aliases)
- `compound` → post-verify lifecycle hook (**different** — this is not a simple alias; it converts a command into a side effect on verify/debug/review completion)

Wave 3 runs last because `compound → hook` touches lifecycle-hooks.ts again (post-Phase 27 and post-Phase 32), and debug refactor is invasive. Stability checkpoint required.

## Final target command surface

After Phase 33 is complete, `sunco help --all` should show (roughly):

```
new, next, do, status, help, review                      (user tier, unchanged from Phase 25)
quick, plan, discuss, execute, verify, debug,            (workflow tier)
  doc, note, ship, release, milestone
auto, phase, pause, resume, settings, research,          (expert tier, visible with --all)
  init, lint, health, guard, agents, scan, graph,
  ceo-review, eng-review, design-review
```

Deprecated (hidden aliases, dispatchable but not listed):

```
fast         → quick --speed fast        (Phase 32)
progress     → status                    (Phase 32)
query        → status --json             (Phase 33 Wave 1)
context      → status --brief            (Phase 33 Wave 1)
validate     → verify --coverage         (Phase 33 Wave 1)
todo         → note --todo               (Phase 33 Wave 1)
seed         → note --seed               (Phase 33 Wave 1)
backlog      → note --backlog            (Phase 33 Wave 1)
export       → doc --report              (Phase 33 Wave 2)
assume       → plan --assume             (Phase 33 Wave 2)
test-gen     → verify --generate-tests   (Phase 33 Wave 2)
diagnose     → debug --parse             (Phase 33 Wave 3)
forensics    → debug --postmortem        (Phase 33 Wave 3)
compound     → (hook only, no CLI)       (Phase 33 Wave 3)
```

## Out of scope (confirmed by user)

- `release` → `ship` merging (different failure modes — npm/version/tag vs PR creation)
- `phase`/`milestone` → `roadmap` umbrella (command semantics too different, rollback cost high)
- `scan`/`graph` → `inspect` umbrella (not current UX bottleneck)
- `plan` + `ultraplan` merging (different axes — planning vs browser/visual review)
- `harness.check` umbrella (lint/health/guard/agents engines are different)
- Phase 31 Hashline (unrelated experimental candidate)
- Phase 29 AST-Grep (unrelated experimental candidate)

</domain>

<decisions>
## Locked Decisions (2026-04-11, director + user directive)

### Strategy

- **D-01: Full absorption is the Phase 33 target**, not surface-hiding. Satellite skill files get deleted, implementations migrate into absorber skills via shared modules. Alias infra (Phase 32) preserves backcompat transparently.

- **D-02: 3 waves, strictly sequential.** Wave 2 does NOT start until Wave 1 PASS. Wave 3 does NOT start until Wave 2 PASS. Each wave is a separate PLAN file (`33-01-PLAN.md`, `33-02-PLAN.md`, `33-03-PLAN.md`), each ships with its own commits and CI-green checkpoint.

- **D-03: Wave 3 contains compound→hook, which is semantically different** from simple alias absorption. It converts a user-facing command into a lifecycle side effect attached to verify/debug/review completion. This is the most invasive piece and MUST be last. The user explicitly objected to bundling compound→hook into an earlier wave.

- **D-04: `release`/`phase`/`milestone`/`scan`/`graph`/`ultraplan`/`harness check` are OUT.** User explicitly rejected these as either too risky, too different, or out of current UX bottleneck. Do NOT include them even as stretch goals.

### Wave 1 scope (this CONTEXT + 33-01-PLAN)

- **D-05: Wave 1 absorbs exactly 6 skills** — query, context, validate, todo, seed, backlog. No more, no less.

- **D-06: Real logic migration, not aliasing the delegate.** The absorbing skills (status, verify, note) currently call `ctx.run('workflow.context')` etc. — Phase 33 **removes** those delegates and inlines (or extracts-to-shared-module) the actual logic. Satellite files are deleted. Aliases are declared on absorbers so `sunco query`, `sunco context`, etc. still dispatch correctly.

- **D-07: Shared module extraction preferred over inline.** For each 100+ line satellite, extract to `packages/skills-workflow/src/shared/<name>.ts` as a pure function (no SkillContext surface), then have the absorber call it. This keeps absorber files readable and makes future Wave-to-Wave refactoring easier. Pure functions, no skill API.
  - `context.skill.ts` → `shared/context-view.ts`
  - `query.skill.ts` → `shared/query-snapshot.ts`
  - `validate.skill.ts` → `shared/coverage-audit.ts`
  - `todo.skill.ts` → `shared/note-todo-list.ts`
  - `seed.skill.ts` → `shared/note-seed-list.ts`
  - `backlog.skill.ts` → `shared/note-backlog-list.ts`
  - (Or consolidated: `shared/note-lists.ts` with 3 exports if the todo/seed/backlog logic shares storage patterns.)

- **D-08: Absorber CLI flags** — these flags must exist (some already do):
  - `status --brief` (exists from Phase 27 C-03, currently delegates; remove delegate)
  - `status --json` (new or existing; needs to emit a query-compatible snapshot)
  - `verify --coverage` (exists from Phase 27 C-04, currently delegates; remove delegate)
  - `note --todo`, `note --seed`, `note --backlog` (exist from Phase 27 C-05, currently delegate via `ctx.run`; remove delegates)

- **D-09: `status --json` schema** — this is a potential risk area. `query.skill.ts` outputs `{ phases, progress, state, costs, timestamp, nextAction }` while `status` (snapshot) outputs phase table + recommendation. Decision: `status --json` produces a **superset** containing both the phase/progress view and the query snapshot view under a top-level object `{ status: {...}, query: {...} }`. Sonnet has latitude to refine the exact shape but MUST preserve all fields that `query.skill.ts` currently emits (backcompat for anyone parsing it).

- **D-10: State keys preserved** — `todo.items`, `seed.items`, `backlog.items` are persisted state. They stay at the same keys regardless of skill consolidation. `note --todo` writes to `todo.items`, `note --seed` writes to `seed.items`, etc. Migration touches code, not data.

### Prerequisites (user explicit)

- **D-11: `prompts/do-route.ts` SKILL_CATALOG stale entries** — remove in Wave 1. Current catalog still contains `workflow.fast` and `workflow.progress` from Phase 32 and will accumulate more as Waves 2/3 delete skills. Wave 1's job is to (a) remove `fast`, `progress` (Phase 32 leftover) and (b) remove `query`, `context`, `validate`, `todo`, `seed`, `backlog` (Wave 1 deletions). Wave 2/3 will further trim.

- **D-12: Recommender rules scan** — `packages/core/src/recommend/rules.ts` references `workflow.validate` 6+ times (as `lastWas`, as `rec()` target). Wave 1 must rewrite these references to use `workflow.verify` with appropriate context (since the flow now is `verify --coverage` instead of a separate `validate` skill). `workflow.test-gen`, `workflow.diagnose`, `workflow.forensics` are NOT touched in Wave 1 — those are Wave 2/3 targets.

- **D-13: `rules.test.ts` hardcoded skill list** (lines 24-25) — update to remove `workflow.validate` entry. Add test coverage for the alias-resolved path if practical.

- **D-14: Backcompat tests extended** — `packages/skills-workflow/src/__tests__/alias-backcompat.test.ts` (created in Phase 32) gets +6 cases for Wave 1 alias resolution + execution equivalence.

### Safety

- **D-15: Zero regression in user-facing behavior.**
  - `sunco query` produces output that anyone currently parsing `query.skill.ts`'s JSON can still parse (superset compatible)
  - `sunco context` produces the same text rendering as before
  - `sunco validate` produces the same coverage audit output
  - `sunco todo`, `sunco seed`, `sunco backlog` produce the same list management behavior
  - State keys unchanged
- **D-16: CI must stay green after each wave.** If Wave 1 breaks CI, stop, debug, don't proceed to Wave 2.
- **D-17: `ctx.run()` backcompat** — all 6 deleted skill ids (`workflow.query`, `workflow.context`, `workflow.validate`, `workflow.todo`, `workflow.seed`, `workflow.backlog`) remain invocable via `ctx.run()` via the alias infrastructure's `registry.resolveId` + args merge.

### Ownership

- **D-18: Each wave dispatches a fresh Sonnet subagent** with the wave's PLAN as input. Director (Opus) reviews diffs, runs local verify, commits verification docs, updates ROADMAP.

- **D-19: Wave boundary gates** — between waves, director verifies:
  - Build green
  - Tests green (no regressions)
  - CI green on push
  - Forbidden scans clean (`@anthropic-ai/sdk`, OMO zoo, deleted skill ghost refs)
  - Deprecation warning for each alias works + `SUNCO_SUPPRESS_DEPRECATION` silences
  - `ctx.run()` backcompat sanity test for deleted ids

### Scope discipline

- **D-20: No new `/sunco:*` commands.** All absorber commands already exist.
- **D-21: No new `.skill.ts` files.** 6 are DELETED in Wave 1. 3+ more in later waves.
- **D-22: No schema migrations.** State DB, config schema, `.sun/active-work.json` untouched.
- **D-23: No `@anthropic-ai/sdk`, no OMO agent-zoo names, no MCP/LSP/HTTP server.**
</decisions>

<canonical_refs>
## Canonical References

### Upstream decisions
- `.planning/phases/32-alias-infra-p0-consolidation/CONTEXT.md` — alias infra contract (D-01..D-15)
- `.planning/phases/32-alias-infra-p0-consolidation/VERIFICATION.md` — alias infra shipped evidence
- `.planning/phases/25-workflow-surface-simplification/25-CONTEXT.md` — surface tier system
- User directive 2026-04-11 — 3-wave plan, compound last

### Files the Wave 1 plan will touch (full list; exact list per-task in 33-01-PLAN)

**Delete:**
- `packages/skills-workflow/src/query.skill.ts`
- `packages/skills-workflow/src/context.skill.ts`
- `packages/skills-workflow/src/validate.skill.ts`
- `packages/skills-workflow/src/todo.skill.ts`
- `packages/skills-workflow/src/seed.skill.ts`
- `packages/skills-workflow/src/backlog.skill.ts`

**Create (shared modules):**
- `packages/skills-workflow/src/shared/query-snapshot.ts`
- `packages/skills-workflow/src/shared/context-view.ts`
- `packages/skills-workflow/src/shared/coverage-audit.ts`
- `packages/skills-workflow/src/shared/note-lists.ts` (consolidates todo/seed/backlog)

**Modify:**
- `packages/skills-workflow/src/status.skill.ts` — add `--json` handler, remove `--brief` ctx.run delegate, declare `query` + `context` aliases (in addition to `progress` from Phase 32)
- `packages/skills-workflow/src/verify.skill.ts` — inline coverage audit, remove `ctx.run('workflow.validate')` delegate, declare `validate` alias
- `packages/skills-workflow/src/note.skill.ts` — inline note list helpers, remove 3 `ctx.run` delegates, declare `todo`/`seed`/`backlog` aliases
- `packages/skills-workflow/src/prompts/do-route.ts` — strip 8 stale catalog entries (fast, progress, query, context, validate, todo, seed, backlog)
- `packages/skills-workflow/src/index.ts` — remove 6 barrel exports
- `packages/cli/src/cli.ts` — remove 6 preloaded skill imports/registrations (same pattern as Phase 32 cli.ts cleanup)
- `packages/core/src/recommend/rules.ts` — replace `workflow.validate` references with `workflow.verify` + coverage context
- `packages/core/src/recommend/__tests__/rules.test.ts` — update hardcoded skill list + affected test cases
- `packages/skills-workflow/src/__tests__/alias-backcompat.test.ts` — +6 cases
- `packages/skills-workflow/src/__tests__/status.test.ts` — update any tests referencing `queryCmd` / `contextCmd` if they exist
- `packages/skills-workflow/src/__tests__/verify.test.ts` — update any tests referencing validate delegation
- `packages/skills-workflow/src/__tests__/note.test.ts` (if exists) — update delegation tests

### SUNCO rules
- `CLAUDE.md` · `.claude/rules/conventions.md` · `.claude/rules/tech-stack.md`
- `packages/cli/references/product-contract.md`
</canonical_refs>

<code_context>
## Existing Code Insights

### Size / complexity inventory (Wave 1)
| Skill | Lines | Kind | State deps |
|---|---|---|---|
| query | 97 | deterministic | reads phases/progress/costs/nextAction |
| context | 224 | deterministic | reads current phase, git branch, STATE.md |
| validate | 209 | deterministic | runs coverage tool, parses output |
| todo | 157 | deterministic | writes `todo.items` state key |
| seed | 128 | deterministic | writes `seed.items` state key |
| backlog | 154 | deterministic | writes `backlog.items` state key |

### Existing delegate chains (to remove)
| Absorber skill | Delegate call | Target |
|---|---|---|
| `status.skill.ts:83` | `ctx.run('workflow.context', {})` | context (remove, inline) |
| `verify.skill.ts:187` | `ctx.run('workflow.validate', ctx.args)` | validate (remove, inline) |
| `note.skill.ts:32` | `ctx.run('workflow.todo', ctx.args)` | todo (remove, inline) |
| `note.skill.ts:33` | `ctx.run('workflow.seed', ctx.args)` | seed (remove, inline) |
| `note.skill.ts:34` | `ctx.run('workflow.backlog', ctx.args)` | backlog (remove, inline) |

### Recommender rule touchpoints (Wave 1 subset)
- `rules.ts:504` — `lastWas(s, 'workflow.validate')` + recommend test-gen (rewire to verify coverage context; test-gen stays Wave 2)
- `rules.ts:515` — `lastWas(s, 'workflow.validate')` + recommend next action
- `rules.ts:525` — `lastWas(s, 'workflow.validate')` + retry
- `rules.ts:528` — `rec('workflow.validate', 'Retry validate', ...)` → rewrite to `rec('workflow.verify', 'Retry verify --coverage', ...)`
- `rules.ts:538` — `rec('workflow.validate', 'Re-validate', ...)` → same
- `rules.ts:585` — `rec('workflow.validate', 'Check coverage', ...)` → same
- `rules.test.ts:24` — hardcoded `'workflow.validate'` in skill list → remove
- `rules.test.ts:25` — `'workflow.test-gen'` stays (Wave 2)
- `rules.test.ts:295, 302, 303, 308, 320, 329, 333, 334, 339, 375` — cases asserting validate behavior → rewrite to verify --coverage expectations

### Ghost references from Phase 32 to clean up
- `prompts/do-route.ts:28,56` — `workflow.progress` + `workflow.fast` entries (Phase 32 leftover) — remove in Wave 1
- Possibly other stale references discovered during implementation

### State key stability
State keys (`todo.items`, `seed.items`, `backlog.items`, any others touched by these 6 skills) are PERSISTED DATA — changing them breaks `.sun/state.db` for existing users. Keys STAY. Only code moves.

### Alias infra usage (from Phase 32)
`defineSkill({ ..., aliases: [{ command, id?, defaultArgs?, hidden?, replacedBy? }] })`. The absorbing skill declares aliases. `registry.resolveCommand` / `resolveId` + `execute()` handle dispatch + args merge. Deprecation stderr line is automatic.

</code_context>

<specifics>
## Specific Ideas

### Alias declarations for absorbers (final shape)

**status.skill.ts** — after Phase 32 adds `progress`, Phase 33 Wave 1 adds `query` and `context`:
```ts
aliases: [
  { command: 'progress', id: 'workflow.progress', hidden: true, replacedBy: 'status' },
  { command: 'query', id: 'workflow.query', defaultArgs: { json: true, snapshot: 'query' }, hidden: true, replacedBy: 'status --json' },
  { command: 'context', id: 'workflow.context', defaultArgs: { brief: true }, hidden: true, replacedBy: 'status --brief' },
],
```

**verify.skill.ts** — Wave 1 adds `validate`:
```ts
aliases: [
  { command: 'validate', id: 'workflow.validate', defaultArgs: { coverage: true }, hidden: true, replacedBy: 'verify --coverage' },
],
```

**note.skill.ts** — Wave 1 adds 3 aliases:
```ts
aliases: [
  { command: 'todo', id: 'workflow.todo', defaultArgs: { todo: true }, hidden: true, replacedBy: 'note --todo' },
  { command: 'seed', id: 'workflow.seed', defaultArgs: { seed: true }, hidden: true, replacedBy: 'note --seed' },
  { command: 'backlog', id: 'workflow.backlog', defaultArgs: { backlog: true }, hidden: true, replacedBy: 'note --backlog' },
],
```

### `status --json` superset shape (D-09)

```jsonc
{
  "status": {
    "phases": [...],        // existing status phase table
    "progress": {...},       // existing progress meta
    "recommendation": {...}  // existing next best action
  },
  "query": {
    "phases": [...],         // query's phase view (possibly duplicate of status.phases)
    "progress": {...},       // duplicate
    "state": "...",
    "costs": [...],          // query-specific
    "timestamp": "...",      // query-specific
    "nextAction": {...}      // query-specific
  }
}
```

If duplicate fields are exact, Sonnet can de-dup into a shared top-level. If they differ, keep both to preserve backcompat. Sonnet's call.

### `status --brief` rendering

Currently `status --brief` does `return ctx.run('workflow.context', {})`. After Wave 1:
```ts
if (ctx.args.brief === true) {
  const view = await renderContextView(ctx);  // from shared/context-view.ts
  return { ok: true, output: view };
}
```

### `verify --coverage` inlining

Current delegate:
```ts
if (ctx.args.coverage === true) {
  return ctx.run('workflow.validate', ctx.args);
}
```

After Wave 1:
```ts
if (ctx.args.coverage === true) {
  const audit = await runCoverageAudit(ctx);  // from shared/coverage-audit.ts
  return audit;
}
```

### `note --todo` inlining

Current:
```ts
if (ctx.args.todo === true) return ctx.run('workflow.todo', ctx.args);
```

After:
```ts
if (ctx.args.todo === true) return handleTodoList(ctx);  // from shared/note-lists.ts
```

### Deprecation warning expected behavior

After Wave 1, invoking any of the deprecated commands should emit (once, to stderr):
```
[deprecated] 'query' is an alias for 'status --json'
[deprecated] 'context' is an alias for 'status --brief'
[deprecated] 'validate' is an alias for 'verify --coverage'
[deprecated] 'todo' is an alias for 'note --todo'
[deprecated] 'seed' is an alias for 'note --seed'
[deprecated] 'backlog' is an alias for 'note --backlog'
```

All suppressible via `SUNCO_SUPPRESS_DEPRECATION=1`.

### Expected test deltas

| File | Cases before | Cases after |
|---|---|---|
| `alias-backcompat.test.ts` | 8 (Phase 32) | 14 (+6 Wave 1 absorptions) |
| `rules.test.ts` | ~existing | rules for validate rewired to verify |
| `status.test.ts` | existing | may gain query/context alias resolution cases |
| `verify.test.ts` | existing | may gain validate alias resolution case |
| `note.test.ts` (if exists) | existing | may gain todo/seed/backlog alias resolution cases |

Net new test count for Wave 1: **+6 alias backcompat** minimum, plus any absorber-level regression tests Sonnet deems necessary.
</specifics>

<deferred>
## Deferred to Wave 2 (next phase, not Phase 33 Wave 1)
- `export` → `doc --report` absorption
- `assume` → `plan --assume` absorption
- `test-gen` → `verify --generate-tests` absorption
- `workflow.test-gen` references in recommender rules stay intact in Wave 1 — Wave 2 rewrites them

## Deferred to Wave 3
- `diagnose` → `debug --parse` (file migration)
- `forensics` → `debug --postmortem` (file migration)
- `ceo-review` / `eng-review` / `design-review` file grouping into `review/` subdir (command stays)
- `compound` → post-verify lifecycle hook (NOT a simple alias — converts command to side effect)
- `workflow.diagnose`/`forensics`/`compound` references in recommender rules stay intact in Wave 1 — Wave 3 rewrites them

## Deferred to a future phase (not Phase 33)
- `release` → `ship` merging
- `phase`/`milestone` → `roadmap` umbrella
- `scan`/`graph` → `inspect` umbrella
- `plan` + `ultraplan` merging
- `harness.check` umbrella
- Phase 31 Hashline stale-edit guard
- Phase 29 AST-Grep deterministic tools
- Alias telemetry (count invocations, prioritize hard-removal)
- Hard removal (delete alias entries entirely) — earliest Phase 35+ after major version bump
</deferred>

---

*Phase: 33-full-absorption*
*Wave: 1 of 3*
*Context locked: 2026-04-11 by director (Opus 4.6)*
*Wave 1 implementation: Sonnet 4.6 subagent*

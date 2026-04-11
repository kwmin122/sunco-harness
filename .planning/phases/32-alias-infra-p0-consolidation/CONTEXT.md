# Phase 32: Alias Infra + P0 Consolidation - Context

**Gathered:** 2026-04-11
**Status:** Decisions locked 2026-04-11 by director. Ready for planning.
**Upstream:** Phase 25 (surface simplification) + Phase 27 (consolidation 1st wave — flag-based) + external analysis from Cursor session
**Downstream:** Phase 33 (P1 absorption — deferred), Phase 34 (P2 structure — deferred)
**Director:** Opus 4.6 · **Implementer:** Sonnet 4.6 subagent

<domain>
## Phase Boundary

Phase 32 lays down the **alias infrastructure** in `@sunco/core` that future consolidation phases (33, 34) will rely on. Then it migrates the **two safest consolidation targets** (`fast` and `progress`) as proof the infrastructure works end-to-end without regressing existing `ctx.run()` call sites, recommender rules, or user muscle memory.

**In scope:**
- New `aliases?: AliasDefinition[]` field on `SkillDefinition` + Zod schema
- `SkillRegistry` alias resolution (id → main skill, command → main skill, with default args)
- `skill-router.ts` alias command registration + args injection at dispatch
- `harness.help` `hidden` flag respect so deprecated aliases don't pollute default help
- Delete `packages/skills-workflow/src/fast.skill.ts`
- Remove `progressSkill` inline export from `status.skill.ts`
- Declare `fast` and `progress` as aliases on `quick.skill.ts` and `status.skill.ts` respectively
- Backward-compat: `sunco fast ...`, `sunco progress`, `ctx.run('workflow.fast')`, `ctx.run('workflow.progress')` all still work
- Tests

**Out of scope (deferred to Phase 33+):**
- `context` → `status --brief` migration (requires moving logic, not just alias)
- `query` → `status --json` (schema compatibility work needed)
- `validate` → `verify --coverage` file migration (flag exists from Phase 27 C-04, file still present)
- `todo` / `seed` / `backlog` → `note` file migration (flag exists from Phase 27 C-05, files still present)
- `diagnose` / `forensics` → `debug` file migration (flags exist from Phase 27 C-02, files still present)
- `compound` → hook migration (Cursor proposal, accepted in principle, deferred)
- `test-gen` → `verify --generate-tests` (Cursor proposal, accepted, deferred)
- `export` → `doc --report` (Cursor proposal, accepted, deferred)
- `assume` → `plan --assume` (Cursor proposal, accepted, deferred)
- `pause`/`resume` consolidation (rejected — resume needs user-memorable name)
- `phase`/`milestone` → `roadmap` (rejected — router rewrite required)
- `scan`/`graph` → `inspect` (rejected — new name learning cost)
- `release` → `ship` (rejected — different failure modes)
- `harness.check` umbrella (rejected — different engines)
- Phase 31 Hashline (unrelated)
</domain>

<decisions>
## Locked Decisions (2026-04-11, director)

### Alias infrastructure design

- **D-01: Alias ownership direction** — The **absorbing** skill declares aliases. i.e. `quick.skill.ts` lists `fast` as its alias, NOT `fast.skill.ts` declaring "I'm an alias of quick". This enables file deletion and keeps alias truth in one place. (Deviation from Cursor's original proposal, which had the sunset skill own the alias; director judged the absorbing-skill model cleaner.)

- **D-02: `AliasDefinition` shape**
  ```ts
  export interface AliasDefinition {
    readonly command: CommandName;            // CLI name, e.g. 'fast'
    readonly id?: SkillId;                     // optional legacy skill id for ctx.run() compat
    readonly defaultArgs?: Record<string, unknown>;  // auto-injected at dispatch
    readonly hidden?: boolean;                 // omit from default help
    readonly replacedBy?: string;              // deprecation hint text
  }
  ```

- **D-03: Registry resolution** — Add a **new** method `resolveCommand(cmd): { skill, defaultArgs, isAlias } | undefined` and `resolveId(id): { skill, defaultArgs, isAlias } | undefined`. Do NOT mutate the existing `byCommand` / `byId` maps to hide alias-ness — callers that need the distinction (help renderer, deprecation warnings) should be able to tell.

- **D-04: Args injection point** — `skill-router.ts` dispatcher merges `defaultArgs` into `ctx.args` **before** invoking the skill. Priority: `user-provided args > defaultArgs`. This lets `sunco fast --speed slow` still work (explicit override) though it's semantically weird.

- **D-05: Deprecation warning** — When an alias command is invoked, the skill-router emits a **single stderr line** on startup: `[deprecated] 'fast' is an alias for 'quick --speed fast'`. Controlled by `SUNCO_SUPPRESS_DEPRECATION=1` env var. No interactive gating.

- **D-06: Hidden alias policy** — `hidden: true` aliases are:
  - Dispatchable via CLI (`sunco fast` works)
  - Dispatchable via `ctx.run('workflow.fast')` (via `resolveId`)
  - **Excluded** from default `help` output (Phase 25 tier respect)
  - **Excluded** from `help --all` only if their main skill is already listed (de-dup)
  - Listed in `help --aliases` (new, optional) — **deferred**, not in Phase 32 scope

### P0 migration scope

- **D-07: Phase 32 migrates exactly two targets** — `fast` and `progress`. These are the safest:
  - `fast.skill.ts` is 24 lines, pure thin wrapper, trivially deletable
  - `progressSkill` is an inline secondary export in `status.skill.ts` sharing `executeStatus`, trivially convertible to an alias declaration
  - Both have low ctx.run() fan-in outside their own definition
- **D-08: NOT migrated in Phase 32** — `context`, `query`, `validate`, `todo`, `seed`, `backlog`, `diagnose`, `forensics`. Their Phase 27 C-commits added flags but kept the files. Moving their logic requires non-trivial refactoring that belongs in Phase 33.

### Safety

- **D-09: Zero regression** — `sunco fast "task"` and `sunco quick --speed fast "task"` MUST produce identical execution (same skill id, same args, same output). Tests enforce this equivalence.
- **D-10: ctx.run() compat** — Any code path currently calling `ctx.run('workflow.fast')` or `ctx.run('workflow.progress')` MUST continue working. Registry resolves alias ids transparently. `fast.skill.ts`'s `ctx.run('workflow.quick', ...)` call becomes obsolete because `fast.skill.ts` is deleted, but nothing else in the repo calls `ctx.run('workflow.fast')` — verified by grep.
- **D-11: No schema migrations** — `.sun/active-work.json`, config schema, state DB, all untouched.
- **D-12: No new CLI commands** — Phase 25 surface discipline preserved. Alias registration does NOT count as "new command" because the command strings (`fast`, `progress`) already existed.

### Scope control

- **D-13: 1 plan, sequential** — `32-01-PLAN.md`. Single wave. No parallel.
- **D-14: Implementer = Sonnet subagent; Director = Opus (this session).** Advisor consult allowed sparingly.
- **D-15: If Phase 32 ships clean, Phase 33 draft comes next.** Phase 33 = P1 absorption (context, query, validate, todo/seed/backlog, compound hook, test-gen, export, assume). Phase 34 = P2 structure cleanup. Both require Phase 32 alias infra to exist.
</decisions>

<canonical_refs>
## Canonical References

### Core files to modify
- `packages/core/src/skill/types.ts` — add `AliasDefinition` + `SkillDefinition.aliases`
- `packages/core/src/skill/define.ts` — add Zod schema for alias array
- `packages/core/src/skill/registry.ts` — add `resolveCommand` / `resolveId` + internal alias maps
- `packages/core/src/cli/skill-router.ts` — register alias commands, inject defaultArgs, emit deprecation
- `packages/core/src/index.ts` — export `AliasDefinition` type

### Skill files
- `packages/skills-workflow/src/quick.skill.ts` — add `aliases: [...]` with `fast` entry
- `packages/skills-workflow/src/status.skill.ts` — add `aliases: [...]` with `progress` entry, **remove** `progressSkill` export
- `packages/skills-workflow/src/fast.skill.ts` — **DELETE**
- `packages/skills-workflow/src/index.ts` — update barrel (remove progressSkill/fastSkill re-exports if any)

### Help renderer
- `packages/skills-harness/src/help.skill.ts` — respect `hidden` flag when iterating aliases; exclude hidden aliases from default output

### Test files to update / add
- `packages/core/src/skill/__tests__/registry.test.ts` (existing or new) — alias resolution
- `packages/core/src/cli/__tests__/skill-router.test.ts` (existing) — alias dispatch + args injection
- `packages/skills-workflow/src/__tests__/status.test.ts` — `progressSkill` tests repoint to alias resolution
- `packages/skills-workflow/src/__tests__/alias-backcompat.test.ts` (**new**) — end-to-end backcompat: `sunco fast` ≡ `sunco quick --speed fast`

### SUNCO rules
- `CLAUDE.md` — skill-only architecture
- `.claude/rules/conventions.md` — `defineSkill()` patterns, ESM imports
- `.claude/rules/workflow.md` — gate definitions

### External context
- Cursor session analysis (pasted by user 2026-04-11) — P0/P1/P2 priority, `aliases?: Array<...>` proposal (adapted per D-01)
- Phase 25 CONTEXT (surface simplification, tier system)
- Phase 27 commit range C-01..C-06 — the flag-based consolidation this phase complements
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`SkillRegistry`** already has `byId` + `byCommand` maps. Adding a parallel `aliasByCommand` + `aliasById` is additive.
- **`skill-router.ts`** already iterates `registry.getAll()` to register Commander commands. Adding a second iteration over `skill.aliases` to register alias commands is trivial.
- **`defineSkill()`** uses Zod to validate. Adding `aliases: z.array(...).optional()` is one schema change.
- **`harness.help`** already respects `tier` filter from Phase 25. Adding a `hidden` alias filter is a minor extension.
- **`status.skill.ts`** exports both `statusSkill` and `progressSkill` sharing `executeStatus()`. Removing `progressSkill` is easy because the execute logic is already extracted.

### Established Patterns
- Duplicate registration is `console.warn` + skip (registry.ts:37-43). Alias registration should follow the same forgiveness pattern for dev friction.
- ESM `.js` import suffix
- Vitest in-source tests
- No new `.skill.ts` files allowed (Phase 25/27 discipline)

### Integration Points
- `skill-router.ts` is where alias commands get registered with Commander
- `harness.help` is where `hidden` filter applies
- `ctx.run()` (in `skill/context.ts`) already routes by id — need to add alias id resolution there
- `execute()` on registry (registry.ts:92) needs to resolve alias ids

### Risk Points
- **Commander command collision:** if alias `fast` is registered via `program.command('fast')` AND `fast.skill.ts` is still registered, Commander will error. Must delete `fast.skill.ts` file **before** registering the alias, OR registry fail-fast must catch the collision and skip the stale skill.
- **Test snapshot churn:** any test that asserts command counts (e.g. "81 commands registered") will change by 0 (alias replaces main registration). But any test asserting `progressSkill.id === 'workflow.progress'` needs updating.
- **scanner discovery:** the scanner walks `*.skill.ts` files and registers each. If `fast.skill.ts` is deleted, its auto-registration goes away. But the `fast` command still needs to exist via `quick.skill.ts`'s aliases. Make sure the scanner-then-alias registration order works: scanner first (main skills), then alias registration pass.
</code_context>

<specifics>
## Specific Ideas

### AliasDefinition shape (locked, see D-02)

```ts
export interface AliasDefinition {
  /** CLI command name for the alias (e.g. 'fast' for workflow.quick --speed fast) */
  readonly command: CommandName;
  /** Optional legacy skill id for ctx.run() backwards-compat (e.g. 'workflow.fast') */
  readonly id?: SkillId;
  /** Default args auto-injected when invoked via this alias (user args win on conflict) */
  readonly defaultArgs?: Readonly<Record<string, unknown>>;
  /** Hide from default help (kept discoverable via --all, docs) */
  readonly hidden?: boolean;
  /** Human-readable replacement hint, e.g. 'quick --speed fast' */
  readonly replacedBy?: string;
}
```

### quick.skill.ts alias declaration

```ts
export default defineSkill({
  id: 'workflow.quick',
  command: 'quick',
  aliases: [
    {
      command: 'fast',
      id: 'workflow.fast',
      defaultArgs: { speed: 'fast' },
      hidden: true,
      replacedBy: 'quick --speed fast',
    },
  ],
  // ... existing fields unchanged
});
```

### status.skill.ts alias declaration

```ts
export const statusSkill = defineSkill({
  id: 'workflow.status',
  command: 'status',
  aliases: [
    {
      command: 'progress',
      id: 'workflow.progress',
      hidden: true,
      replacedBy: 'status',
    },
  ],
  // ... existing fields unchanged
});

// progressSkill export REMOVED (was identical behavior; now an alias)
```

### Registry extension

```ts
// new internal state
private readonly aliasByCommand = new Map<string, { mainId: SkillId; defaultArgs: Record<string, unknown> }>();
private readonly aliasById = new Map<string, { mainId: SkillId; defaultArgs: Record<string, unknown> }>();

// new public API
resolveCommand(cmd: string): { skill: SkillDefinition; defaultArgs: Record<string, unknown>; isAlias: boolean } | undefined {
  const main = this.byCommand.get(cmd);
  if (main) return { skill: main, defaultArgs: {}, isAlias: false };
  const alias = this.aliasByCommand.get(cmd);
  if (!alias) return undefined;
  const skill = this.byId.get(alias.mainId);
  if (!skill) return undefined;
  return { skill, defaultArgs: alias.defaultArgs, isAlias: true };
}

resolveId(id: string): { skill: SkillDefinition; defaultArgs: Record<string, unknown>; isAlias: boolean } | undefined {
  const main = this.byId.get(id);
  if (main) return { skill: main, defaultArgs: {}, isAlias: false };
  const alias = this.aliasById.get(id);
  if (!alias) return undefined;
  const skill = this.byId.get(alias.mainId);
  if (!skill) return undefined;
  return { skill, defaultArgs: alias.defaultArgs, isAlias: true };
}

// register() extension: after registering main skill, iterate aliases
register(skill: SkillDefinition): void {
  // ... existing id/command conflict check ...
  this.byId.set(skill.id, skill);
  this.byCommand.set(skill.command, skill);

  if (skill.aliases) {
    for (const alias of skill.aliases) {
      if (this.byCommand.has(alias.command) || this.aliasByCommand.has(alias.command)) {
        console.warn(`[sun:registry] Skipping duplicate alias command: '${alias.command}'`);
        continue;
      }
      this.aliasByCommand.set(alias.command, { mainId: skill.id, defaultArgs: alias.defaultArgs ?? {} });
      if (alias.id) {
        if (this.byId.has(alias.id) || this.aliasById.has(alias.id)) {
          console.warn(`[sun:registry] Skipping duplicate alias id: '${alias.id}'`);
          continue;
        }
        this.aliasById.set(alias.id, { mainId: skill.id, defaultArgs: alias.defaultArgs ?? {} });
      }
    }
  }
}
```

### skill-router.ts extension

After registering main skills, **second pass** iterates aliases:

```ts
// Main skill registration (existing code)
for (const skill of registry.getAll()) {
  program.command(skill.command)... // existing
}

// Alias command registration (new)
for (const skill of registry.getAll()) {
  if (!skill.aliases) continue;
  for (const alias of skill.aliases) {
    const resolution = registry.resolveCommand(alias.command);
    if (!resolution || !resolution.isAlias) continue;
    program.command(alias.command)
      .description(alias.replacedBy
        ? `${skill.description} (alias for ${alias.replacedBy})`
        : skill.description)
      .action(async (...args) => {
        // Emit deprecation warning once
        if (!process.env.SUNCO_SUPPRESS_DEPRECATION) {
          process.stderr.write(
            `[deprecated] '${alias.command}' is an alias${alias.replacedBy ? ` for '${alias.replacedBy}'` : ''}\n`,
          );
        }
        // Merge defaultArgs under user args
        const merged = { ...alias.defaultArgs, ...parsedArgs };
        await executeSkill(resolution.skill, merged);
      });
  }
}
```

### Expected help output delta

Before Phase 32:
```
$ sunco help
new, next, do, status, help, review  (user tier)
```

After Phase 32:
```
$ sunco help
new, next, do, status, help, review  (user tier — UNCHANGED)

$ sunco help --all | grep fast
(no fast entry — hidden alias excluded)
(future enhancement: sunco help --aliases shows deprecated aliases)
```

### Test matrix

| Test | File | Goal |
|---|---|---|
| alias registration | `registry.test.ts` | `aliasByCommand` and `aliasById` populated from `skill.aliases` |
| resolveCommand (main) | `registry.test.ts` | returns `{ isAlias: false }` for main commands |
| resolveCommand (alias) | `registry.test.ts` | returns `{ isAlias: true, defaultArgs }` for alias commands |
| resolveId (alias) | `registry.test.ts` | `ctx.run('workflow.fast')` path works |
| duplicate alias | `registry.test.ts` | warns + skips |
| skill-router alias dispatch | `skill-router.test.ts` | `sunco fast` invokes `workflow.quick` with `speed: 'fast'` injected |
| args priority | `skill-router.test.ts` | user `--speed slow` beats alias default |
| deprecation warning | `skill-router.test.ts` | stderr contains `[deprecated]` when alias invoked |
| deprecation suppressed | `skill-router.test.ts` | `SUNCO_SUPPRESS_DEPRECATION=1` silences warning |
| help hidden | `help.test.ts` (if exists) | default help has no `fast`, `progress` entries |
| status alias | `status.test.ts` | `progressSkill` export removed; alias resolution returns `statusSkill` with no defaultArgs |
| backcompat e2e | `alias-backcompat.test.ts` (new) | `sunco fast X` and `sunco quick --speed fast X` produce equivalent SkillResult shapes |
</specifics>

<deferred>
## Deferred (Phase 33+)

- **Phase 33 (P1 absorption):** context/query/validate/todo/seed/backlog file migrations; compound → hook; test-gen → verify; export → doc; assume → plan
- **Phase 34 (P2 structure):** diagnose/forensics → `debug/` subdir; ceo/eng/design-review → `review/` subdir
- `sunco help --aliases` command to list all deprecated aliases (future polish)
- Alias telemetry (count invocations) for prioritizing removal
- Hard-remove alias ids after N months (major version bump)
- Cursor's additional proposals (compound hook, test-gen, export, assume) all folded into Phase 33 scope
</deferred>

---

*Phase: 32-alias-infra-p0-consolidation*
*Context locked: 2026-04-11 by director (Opus 4.6)*
*Implementation: Sonnet 4.6 subagent*
*Gates: plan-gate (director review) → execute → verify (Opus + CI) → ship*

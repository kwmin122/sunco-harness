# Phase 25: Workflow Surface Simplification - Research

**Researched:** 2026-04-08
**Domain:** CLI surface layering, skill metadata extension, Commander.js help customization, review auto-routing
**Confidence:** HIGH

---

## Summary

Phase 25 restructures SUNCO's user-facing CLI surface into three visibility tiers (user / workflow / expert), redesigns `sunco help` as an intent-first task card, converts `sunco review` into a smart front-door that auto-routes to ceo/eng/design-review, and promotes `do` + `next` as the main user entry points.

All changes are additive metadata extensions or controlled redirects. No skills are deleted. The largest single change is adding `tier` to `SkillDefinition` / `defineSkill()` / `SkillDefinitionSchema` in `packages/core` — every downstream consumer (registry, router, CLI program) then needs small targeted edits. The `harness.help` skill is the only net-new file.

**Primary recommendation:** Implement in three sequential plans — (1) core tier metadata + schema, (2) help skill + CLI wiring, (3) review auto-routing + recommender priority adjustment. Plans 1 and 3 are independent; Plan 2 depends on Plan 1.

---

## User Constraints (from CONTEXT.md)

All of the following are locked decisions from D-01 through D-12:

- **D-01** `defineSkill()` gets `tier: 'user' | 'workflow' | 'expert'` enum field — dedicated field, not a tag.
- **D-02** Default value for `tier` is `'workflow'`. Explicit promotion required for `user`, explicit declaration required for `expert`.
- **D-03** `sunco help` (default) = intent-first task card view, NOT a command list.
- **D-04** `sunco help --all` = three-section grouped list: User / Workflow / Expert.
- **D-05** `harness.help` is a new `kind: 'deterministic'` skill in `packages/skills-harness/`. Commander.js `configureHelp()` is NOT used.
- **D-06** `sunco --help` outputs a minimal redirect message pointing to `sunco help`.
- **D-07** `sunco review` becomes a smart front-door with auto-routing; `--type ceo|eng|design` override is supported.
- **D-08** `review` = user tier; `ceo-review`, `eng-review`, `design-review` = expert tier.
- **D-09** Auto-selected route outputs one line: `"Auto-selected: eng-review (implementation diff detected)"`.
- **D-10** No welcome/onboarding flow. `sunco` (no args) → `sunco help`.
- **D-11** Recommender priority: primary `next` > secondary `do` > tertiary `status`.
- **D-12** `sunco` (no args) → `sunco help` via CLI program mapping.

---

## Standard Stack

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Commander.js | 14.0.3 | CLI engine, no-arg action, help override | Already used, D-05 says NOT to use configureHelp but we must intercept `sunco --help` minimal output |
| Zod | 3.24.4 (installed) | Schema validation for tier enum | Already used in `defineSkill()` Zod schema |
| simple-git | 3.33.x | Diff analysis in review auto-routing | Already used in review.skill.ts |
| chalk | 5.x | Terminal color in help task card | Already used in status.skill.ts |

No new npm dependencies needed for this phase.

---

## Architecture Patterns

### Pattern 1: Tier Field Addition (Plan 25-01)

Add `tier` to three files in `packages/core`:

1. `packages/core/src/skill/types.ts` — add `SkillTier` type and `tier` field to `SkillDefinition` and `SkillDefinitionInput`.
2. `packages/core/src/skill/define.ts` — add `tier: z.enum(['user', 'workflow', 'expert']).default('workflow')` to `SkillDefinitionSchema`, and wire `tier` in the frozen output.
3. `packages/core/src/skill/registry.ts` — add `getByTier(tier: SkillTier): SkillDefinition[]` helper method.

Then annotate all existing skills with their tier. Skills not listed in the CONTEXT.md tier table default to `'workflow'`, which is correct. The user-tier skills require explicit `tier: 'user'` in their `defineSkill()` call:
- `new`, `next`, `do`, `status`, `help` (new), `review` (to be modified)

Expert-tier skills require `tier: 'expert'`:
- `ceo-review`, `eng-review`, `design-review`, `compound`, `ultraplan`, `assume`, `research`

### Pattern 2: harness.help Skill (Plan 25-02)

New file `packages/skills-harness/src/help.skill.ts`. Pattern:
- `kind: 'deterministic'`, `tier: 'user'`, `stage: 'stable'`
- Reads all registered skills from `ctx.recommend` or directly via `ctx.run` is not ideal — the help skill needs to access the registry. The cleanest approach is to expose a `getSkillsByTier()` method on the `RecommenderApi` or expose registry access through the context.

**Key finding:** `SkillContext` does NOT currently expose the `SkillRegistry`. The help skill needs registry access to enumerate tiers. Two options:
- Option A: Pass `registry` through `SkillContext` (adds `registry` field to the context interface). This is the clean approach but requires a type change.
- Option B: Store tier metadata in state at boot time (write-once). Help skill reads from state. This avoids context type change but is indirect.
- Option C: The help skill is invoked via `ctx.run('harness.help')` and the registry is not directly needed — the skill can introspect its own output by calling `ctx.recommend.getRecommendations()` or by using a shared in-memory catalog injected at registration time.

**Recommended:** Option A — add `readonly registry: SkillRegistry` to `SkillContext` (or expose a read-only `listSkills(tier?)` function). The registry is already available in `createSkillContext()` (it's passed in as a parameter). Wiring it through is a 3-line change in `packages/core/src/skill/context.ts` (or wherever `createSkillContext` lives).

The help skill output format (default, no `--all`):
```
  시작하기        sunco new
  이어서 작업     sunco next
  뭐든 시키기     sunco do "..."
  지금 상태       sunco status
  리뷰 요청       sunco review
  도움말          sunco help --all

  5 commands shown. 33 more with --all
```

With `--all`:
```
User Commands
  new      Bootstrap a new project
  next     Get the next recommended action
  ...

Workflow Commands
  discuss  Clarify decisions with AI
  ...

Expert Commands
  ceo-review  CEO/founder-mode plan review
  ...
```

### Pattern 3: CLI No-Arg → help routing (Plan 25-02)

In `packages/core/src/cli/program.ts`, add a default action for zero-argument invocation:

```ts
program.action(async () => {
  // sunco with no args → invoke help skill
  await executeHook('harness.help', {});
});
```

`program.action()` is called when no subcommand is matched. This handles D-10 / D-12.

For D-06 (`sunco --help` minimal redirect), use `program.configureHelp({ formatHelp: () => ... })` to produce a one-liner like:
```
Run 'sunco help' to see available commands and tasks.
```

### Pattern 4: review Auto-Routing (Plan 25-03)

Transform `packages/skills-workflow/src/review.skill.ts`:
- Add `tier: 'user'` to its `defineSkill()` call.
- Add option `{ flags: '--type <type>', description: 'Force review type: ceo|eng|design' }`.
- At the start of `execute()`, before current diff-generation logic, add a routing step:

```ts
async function detectReviewType(diff: string, cwd: string): Promise<'ceo' | 'eng' | 'design'> {
  // Priority: UI signals > implementation diff > strategy/scope
  const uiSignals = ['.tsx', '.jsx', '.css', '.ink.ts', 'screenshot'];
  const strategySignals = ['PRODUCT-SPEC', 'ROADMAP', 'REQUIREMENTS'];
  
  if (uiSignals.some(ext => diff.includes(ext))) return 'design';
  if (strategySignals.some(sig => diff.includes(sig))) return 'ceo';
  return 'eng'; // default: implementation diff
}
```

Then delegate: `return ctx.run('workflow.eng-review', { phase: phaseArg })` etc.

The current `review.skill.ts` does multi-provider cross-review. The new `review` is a router — the actual review content (REVIEWS.md) is produced by the specialized skills. The old `review` behavior (multi-provider cross-review) could be retained as the fallback when no specialized skill is found, or moved to a dedicated `cross-review` expert skill. Given D-08 places `review` as user tier and `ceo/eng/design-review` as expert, the routing/delegation approach is correct.

**Key finding on `ctx.run` for review delegation:** `ceo-review`, `eng-review`, and `design-review` all accept a `--phase <number>` option, but they don't currently have a common interface for being called without a phase number (e.g., against staged diff). The review router will need to either (a) always pass a phase number if one is available, or (b) call `ctx.run` with `{ phase: phaseArg }` when a phase is known, else `{}` and let the sub-skill handle it.

Looking at the sub-skills: they all read `resolvePhaseDir` from `ctx.args.phase`. Without a phase arg they will likely fail or fall back. This needs checking and potentially a small update to each sub-skill to handle the no-phase case (staged diff fallback).

### Pattern 5: Recommender Priority Adjustment (Plan 25-03)

In `packages/core/src/recommend/rules.ts`, the composition/fallback rules currently suggest `quick` and `do` at low priority. Per D-11, `next` should be higher priority than `do` which is higher than `status`.

The `suggest-quick-idle` and `suggest-do-generic` rules in `compositionRules` (Phase 9) need adjustment. Specifically, add or update a rule that fires on fresh sessions to suggest `next` first, then `do`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tier-based filtering | Custom filter logic everywhere | `registry.getByTier(tier)` method | Single filter point |
| Help layout | Custom layout engine | chalk + fixed-width string formatting (like status.skill.ts) | Already established pattern |
| Review type detection | Complex NLP | Simple keyword matching on diff content + file extensions | D-07 routing criteria are deterministic |
| No-arg CLI handling | Custom middleware | `program.action()` root handler in Commander.js | Built-in Commander.js feature |
| `--help` override | Monkey-patching | `program.configureHelp({ formatHelp })` | Commander.js built-in |

---

## Common Pitfalls

### Pitfall 1: Zod Schema Default Value

**What goes wrong:** Adding `.default('workflow')` to the Zod schema for `tier` changes the parse behavior. If `SkillDefinitionInput` has `tier` as optional but the output `SkillDefinition` has it as required, the TypeScript types must be adjusted carefully.

**Why:** `z.enum(...).default(...)` makes the field optional at input but always-present at output. `SkillDefinitionInput` should have `tier?: SkillTier`, and `SkillDefinition` should have `readonly tier: SkillTier`.

**How to avoid:** In `SkillDefinitionInput`, declare `tier?: SkillTier` (optional). In `SkillDefinition`, declare `readonly tier: SkillTier` (required). The Zod schema's `.default('workflow')` bridges the gap.

**Warning signs:** TypeScript errors on existing `defineSkill()` calls that don't have `tier` — they should compile fine after the change since it's optional with a default.

### Pitfall 2: Registry Access in SkillContext

**What goes wrong:** `SkillContext` does not expose `registry`. If `harness.help` tries to list all skills by tier, it has no mechanism to do so.

**Why:** The context was designed around task execution, not introspection. The registry is available in `createSkillContext()` but not exposed.

**How to avoid:** Add `readonly registry: Pick<SkillRegistry, 'getAll' | 'getByTier'>` to `SkillContext`. Update `createSkillContext()` to accept and wire this. This is a 1-interface / 1-factory change in `packages/core`.

**Warning signs:** `harness.help` skill cannot enumerate skills → falls back to hardcoded list (fragile).

### Pitfall 3: review Skill Behavioral Change

**What goes wrong:** The existing `review.skill.ts` implements multi-provider cross-review and writes REVIEWS.md. Changing it to a router fundamentally changes its behavior and output.

**Why:** Existing users/tests may depend on the current `review` producing REVIEWS.md directly.

**How to avoid:** The router `review` should delegate to the specialist skills. If `--type` is not specified, detect automatically. The existing multi-provider review logic can be preserved as an alternative when specialist skills are not available (graceful degradation). Consider keeping the existing logic as `cross-review` (expert tier) if needed.

**Warning signs:** Tests for `review.skill.ts` expecting `REVIEWS.md` output will break — they need updating.

### Pitfall 4: `sunco --help` vs `sunco help`

**What goes wrong:** Commander.js generates its own help output for `--help`. Overriding `formatHelp` affects ALL subcommands, not just root.

**Why:** `configureHelp()` applies globally unless scoped to specific commands.

**How to avoid:** Use `program.configureHelp({ formatHelp: (cmd, helper) => cmd.parent === null ? minimalMessage : helper.formatHelp(cmd, helper) })` to only override root-level help. Or override only on the root program command.

**Warning signs:** Subcommand `--help` output also shows minimal message (all commands show "Run sunco help").

### Pitfall 5: No-arg `program.action()` conflicts

**What goes wrong:** Commander.js `program.action()` fires even when a subcommand IS matched, depending on version.

**Why:** In Commander.js 12+, `program.action()` fires for the root command when no subcommand matches OR when invoked with no args. Need to verify behavior in 14.0.3.

**How to avoid:** Check if `program.args.length === 0` inside the action before delegating to help. Or use `program.addHelpCommand(false)` + custom no-arg handling.

**Warning signs:** `sunco status` also triggers help (root action fires before subcommand).

---

## Implementation Map

### Plan 25-01: Core Tier Metadata (M — ~1h)

| File | Action | Notes |
|------|--------|-------|
| `packages/core/src/skill/types.ts` | Modify | Add `SkillTier` type, `tier` field to `SkillDefinition` and `SkillDefinitionInput` |
| `packages/core/src/skill/define.ts` | Modify | Add `tier` to `SkillDefinitionSchema` with `.default('workflow')`, wire in frozen output |
| `packages/core/src/skill/registry.ts` | Modify | Add `getByTier(tier: SkillTier): SkillDefinition[]` method |
| `packages/core/src/skill/context.ts` (or wherever `createSkillContext` is) | Modify | Expose `registry` read methods on `SkillContext` |
| `packages/core/src/skill/types.ts` | Modify | Add `registry` field to `SkillContext` |
| All 41 existing skill files | Modify | Add `tier` annotation to each `defineSkill()` call (most omit it → default 'workflow'; user+expert need explicit) |

Skills requiring explicit `tier: 'user'` (6 skills after this phase):
- `new.skill.ts`, `next.skill.ts`, `do.skill.ts`, `status.skill.ts`, plus `review.skill.ts` (plan 25-03) and `help.skill.ts` (plan 25-02)

Skills requiring `tier: 'expert'` (7 skills):
- `ceo-review.skill.ts`, `eng-review.skill.ts`, `design-review.skill.ts`, `compound.skill.ts`, `ultraplan.skill.ts`, `assume.skill.ts`, `research.skill.ts`

### Plan 25-02: Help Skill + CLI Wiring (M — ~1.5h)

| File | Action | Notes |
|------|--------|-------|
| `packages/skills-harness/src/help.skill.ts` | Create | New `harness.help` skill, `kind: 'deterministic'`, `tier: 'user'` |
| `packages/skills-harness/src/index.ts` | Modify | Export `helpSkill` |
| `packages/cli/src/cli.ts` | Modify | Import `helpSkill`, add to `preloadedSkills` |
| `packages/core/src/cli/program.ts` | Modify | Add `program.action()` no-arg handler, minimal `--help` override |
| `packages/cli/src/cli.ts` | Modify | Wire `executeHook` through to `program.action()` for no-arg routing |

The help skill needs the `executeHook` to be available in the root `program.action()`. Currently the hook is created in `main()` and passed to `registerSkills`. It also needs to be passed to `program.action()` for the no-arg case.

### Plan 25-03: Review Auto-Routing + Recommender (M — ~1.5h)

| File | Action | Notes |
|------|--------|-------|
| `packages/skills-workflow/src/review.skill.ts` | Modify | Replace current multi-provider logic with auto-routing front-door + `--type` override |
| `packages/skills-workflow/src/ceo-review.skill.ts` | Modify | Add `tier: 'expert'` + verify it handles no-phase (staged diff) case |
| `packages/skills-workflow/src/eng-review.skill.ts` | Modify | Add `tier: 'expert'` + verify no-phase case |
| `packages/skills-workflow/src/design-review.skill.ts` | Modify | Add `tier: 'expert'` + verify no-phase case |
| `packages/core/src/recommend/rules.ts` | Modify | Adjust composition/fallback rules priority: next > do > status |

---

## Dependencies

No new npm packages required. All needed libraries are already installed:
- `chalk` (5.x) — already in skills-harness and skills-workflow
- `simple-git` (3.33.x) — already in review.skill.ts
- `zod` (3.24.4) — already in core

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| All 41 existing skill files need `tier` annotation — high edit surface area | HIGH | LOW (additive change, TS default handles missing) | Tier default is 'workflow', so skills without explicit tier are NOT broken. Only user/expert skills need changes (13 total). |
| `review.skill.ts` behavioral change breaks existing tests | MEDIUM | MEDIUM | Update test expectations; preserve old cross-review logic as graceful fallback |
| `program.action()` fires on subcommand invocations | MEDIUM | HIGH | Verify Commander.js 14.x behavior; use `process.argv.length <= 2` guard |
| SkillContext registry exposure — breaks existing context creation callsites | LOW | MEDIUM | Add as optional field or use a new `listSkills` method on recommend API instead |
| Sub-skills (ceo/eng/design-review) fail without `--phase` arg | MEDIUM | MEDIUM | Add staged diff fallback in each sub-skill (or review router passes diff context) |

---

## Open Questions

1. **Where is `createSkillContext` defined?** The canonical ref says `packages/core/src/skill/context.ts` but the file wasn't listed in the canonical refs and wasn't read. Confirm exact path before Plan 25-02.

2. **Commander.js 14.x `program.action()` semantics:** Does the root action fire when no subcommand is matched (Node.js no-arg case), or does it fire in addition to subcommands? Needs a quick check of Commander.js 14.x docs or source. The established pattern from `program.on('command:*')` suggests unknown commands are caught there, but no-arg invocation is a different case.

3. **Old `review` behavior:** Is the multi-provider cross-review (current `review.skill.ts`) still needed as a distinct skill? If yes, it should be renamed and kept as expert tier (e.g., `cross-review`). If no, it can be replaced entirely by the routing logic.

4. **Sub-skill no-phase handling:** `ceo-review`, `eng-review`, `design-review` — do they already handle the no-phase (staged diff) case? From reading the first 40 lines, they use `resolvePhaseDir` and `readPhaseArtifact`. They likely require a phase number. This needs verification before Plan 25-03.

---

## Project Constraints (from CLAUDE.md)

All of the following apply to this phase:

- **Skill-Only:** harness.help must be a `defineSkill()` skill, not a hardcoded handler.
- **Deterministic First:** help skill is `kind: 'deterministic'` (zero LLM cost). Review routing detection logic is also deterministic (file pattern matching, no LLM).
- **ESM-only:** All new imports use `.js` extension even for `.ts` source files.
- **Clean Room:** No code copied from GSD. Patterns referenced conceptually only.
- **Quality:** Each skill is a finished product — help task card, review routing, and tier annotations must all be complete.

---

## Sources

**HIGH confidence (code read directly):**
- `/packages/core/src/skill/types.ts` — SkillDefinition shape, all existing fields
- `/packages/core/src/skill/define.ts` — SkillDefinitionSchema, Zod validation pattern
- `/packages/core/src/skill/registry.ts` — SkillRegistry methods available
- `/packages/core/src/cli/skill-router.ts` — `registerSkills()` iterates `registry.getAll()`
- `/packages/core/src/cli/program.ts` — `createProgram()`, unknown command handler
- `/packages/cli/src/cli.ts` — full preloadedSkills list, main() wiring
- `/packages/skills-workflow/src/review.skill.ts` — current full implementation
- `/packages/skills-workflow/src/do.skill.ts` — routing pattern
- `/packages/skills-workflow/src/next.skill.ts` — recommender usage pattern
- `/packages/skills-harness/src/` — existing harness skills (5 skills, no help skill)
- `/packages/core/src/recommend/rules.ts` — rule structure and existing priorities
- `.planning/phases/25-workflow-surface-simplification/25-CONTEXT.md` — all locked decisions

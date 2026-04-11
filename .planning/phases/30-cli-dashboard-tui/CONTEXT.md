# Phase 30: CLI Dashboard TUI - Context

**Gathered:** 2026-04-10
**Status:** Decisions locked 2026-04-11 by director. Ready for planning.
**Upstream:** Phase 27 (`.sun/active-work.json` artifact) + existing `packages/core/src/ui/` Ink foundation

<domain>
## Phase Boundary

Phase 30 delivers a **read-only live terminal UI** for SUNCO's active-work artifact. The goal is to dogfood Phase 27's `.sun/active-work.json` by surfacing it as a polling Ink view operators can keep open in a second terminal pane. It is display-only: no writes, no mutations, no interactive skill dispatch.

**In scope:**
- A new Ink component that polls `.sun/active-work.json` at a fixed interval and renders active phase, background work, blocked state, next recommended action, recent skill calls.
- A `--live` flag on `sunco status` that hands off to the Ink component, keeping the snapshot `sunco status` invocation unchanged.
- Non-TTY graceful degradation (e.g. piped output or CI) → refuse with a pointer to one-shot `sunco status`.
- Minimal tests covering pure render and formatter helpers.

**Out of scope:**
- Writing to project state from the TUI (plan edits, skill triggers, approvals)
- File-system watchers (chokidar, fsevents) — polling only
- HTTP server / web dashboard (OMO's `oh-my-opencode-dashboard` pattern explicitly rejected)
- Multi-machine / remote aggregation
- Replacing one-shot `sunco status` (the TUI is an additive live mode)
- New top-level commands (Phase 25 surface discipline is preserved)
</domain>

<decisions>
## Locked Decisions (2026-04-11, director)

- **D-01: Entry point** — `sunco status --live`. New flag on the existing front-door skill. **No new `/sunco:*` command.** This extends the consolidation pattern established in Phase 27 (C-03 `status --brief`, C-04 `verify --coverage`). Rationale: Phase 25 reduced user surface to 5 commands; Phase 30 must not re-expand it.

- **D-02: Refresh model** — **Polling at 1000 ms** (1 Hz). No file watcher. Rationale: `.sun/active-work.json` is tiny (<10 KB), polling is platform-agnostic (no chokidar / fsevents surprises in WSL/headless CI containers), deterministic, and trivially cancellable. A `--interval <ms>` flag is **deferred** — hardcoded 1000 ms is the MVP.

- **D-03: Stack** — **Ink** (React for terminal). Already used across `packages/core/src/ui/` (primitives, components, patterns). Existing `Box`, `Text`, `Badge`, `StatusSymbol`, `StatusBar` are reusable. `blessed-contrib` is explicitly forbidden by `.claude/rules/tech-stack.md` ("NOT to Use — unmaintained since 2017").

- **D-04: Compatibility** —
  - **Minimum terminal:** 80 cols × 24 rows. Below this → render compact fallback (single-column, truncated descriptions).
  - **TTY required:** When `!process.stdout.isTTY` (piped, CI, headless), refuse with `sunco status --live requires a TTY. Use 'sunco status' for a one-shot snapshot.` and exit code 2.
  - **Color:** honor `NO_COLOR` env var and chalk's built-in detection. Fall back to monochrome if terminal lacks 16-color support.
  - **Exit keys:** `q`, `Q`, `Ctrl+C`, `Esc` all exit cleanly (Ink unmount, no stuck processes).

- **D-05: OMO parity** — **Inspiration only.** SUNCO TUI is standalone terminal-native. Does NOT implement OMO's `oh-my-opencode-dashboard` HTTP-server approach. Artifact-based + read-only + section grouping are the only concepts borrowed. No agent-zoo names, no boulder artifact, no Sisyphus references.

- **D-06: New files policy** — One new `.tsx` Ink component allowed: `packages/skills-workflow/src/dashboard-tui.tsx` (or a `src/dashboard/` subdir if it grows beyond one file). **No new `.skill.ts` file.** Modifying `status.skill.ts` to dispatch to the component when `--live` is set is the only skill change.

- **D-07: Plan count** — **1 plan.** Scope is narrow enough (one component + one flag + tests) that splitting increases overhead without benefit. Sequential wave, single plan.

- **D-08: Ownership routing** — Implementation delegated to **Sonnet subagent**. Opus (director) reviews plan, monitors execution, verifies tests pass, commits. Matches user directive "구현은 소넷, 어드바이저는 오푸스".
</decisions>

<canonical_refs>
## Canonical References

**Must-read for planning + execution:**

### Phase 30 upstream artifact
- `packages/core/src/state/active-work.ts` — read/write API (use `readActiveWork(cwd)` only)
- `packages/core/src/state/active-work.types.ts` — `ActiveWork`, `BackgroundWorkItem`, `RoutingMiss`, `CATEGORIES`

### Ink UI foundation (reusable)
- `packages/core/src/ui/primitives/{Box,Text,Badge}.tsx`
- `packages/core/src/ui/components/{StatusSymbol,ErrorBox,RecommendationCard}.tsx`
- `packages/core/src/ui/session/StatusBar.tsx`
- `packages/core/src/ui/index.ts` — barrel exports

### Target skill
- `packages/skills-workflow/src/status.skill.ts` — `--live` flag dispatch target; existing `--brief` flag (Phase 27 C-03) is the convention reference

### SUNCO rules
- `.claude/rules/tech-stack.md` — Ink 6.8.x, no blessed-contrib
- `.claude/rules/conventions.md` — `.tsx` files allowed for Ink components, ESM `.js` import suffix
- `.claude/rules/workflow.md` — phase gates
- `CLAUDE.md` — skill-only architecture, no hardcoded commands

### Phase 27 precedent (consolidation pattern)
- Commits `7e30357` (C-03 `status --brief`), `851c5a1` (C-04 `verify --coverage`) — show the flag-on-existing-skill pattern this plan extends
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Ink render pipeline** — `packages/core/src/ui/adapters/ink-adapter.tsx` (existing) renders via `render()` from Ink. `dashboard-tui.tsx` uses the same mount pattern.
- **`StatusBar`** — `packages/core/src/ui/session/StatusBar.tsx` is a 1-line footer component, directly reusable for "updated Xs ago · q to quit" footer.
- **`Box` / `Text` / `Badge`** — primitives with theme tokens already wired.
- **Category taxonomy** — `CATEGORIES` const + color mapping can reuse `RecommendationCard`'s existing color scheme.
- **Read-only graceful degrade** — `readActiveWork()` returns `DEFAULT_ACTIVE_WORK` on missing/corrupt file, so the TUI renders a "No active work yet" empty state without special handling.

### Established Patterns
- ESM-only, `.js` import suffix even for `.ts`/`.tsx`
- Ink components in `.tsx` files
- Tests: Vitest + ink-testing-library (if already present) or snapshot-lite pattern
- Hook runner integration is NOT required for the TUI (it's a read-only consumer, not a skill executor)

### Integration Points
- `status.skill.ts`: add `--live` option via Commander's `.option('--live', '...')`. On `--live`, bypass the current status rendering and hand off to the Ink component. On normal invocation (no flag), behavior is unchanged.
- Process lifecycle: the Ink render returns a handle. Unmount on SIGINT + key press. The skill function awaits the promise of exit.
</code_context>

<specifics>
## Specific Ideas

### Layout preview (80×24 target)

```
┌─ SUNCO Dashboard ─────────────────────────────────────────────────── v1.3 ─┐
│                                                                            │
│  ▶ Active Phase                                                            │
│    Phase 30 (cli-dashboard-tui) · executing · [deep]                       │
│    plan 30-01 · step execute                                               │
│                                                                            │
│  ⚙ Background work (2)                                                     │
│    - research_agent (afb87…) OMO dashboard survey · running · 4m           │
│    - verify_layer2 (b1c2e…) phase-local guard · completed · 40s ago        │
│                                                                            │
│  ⚠ Blocked                                                                 │
│    (none)                                                                  │
│                                                                            │
│  → Next                                                                    │
│    /sunco:verify · execute complete, 7-layer pending                       │
│                                                                            │
│  ⏱ Recent skill calls                                                      │
│    workflow.plan · 0:48 · 9m ago                                           │
│    workflow.execute · 4:12 · 3m ago                                        │
│                                                                            │
└─ updated 0.4s ago · polling 1s · q to quit ────────────────────────────────┘
```

### Compact fallback (<80×24)

```
SUNCO · Phase 30 · deep · executing
BG (2) · 2 running · 0 blocked
Next: /sunco:verify
[q to quit]
```

### File structure

```
packages/skills-workflow/src/
  dashboard-tui.tsx          # new — Ink component + render function
  status.skill.ts            # modified — --live flag dispatch
  shared/
    active-work-display.ts   # existing — reuse formatters where possible
  __tests__/
    dashboard-tui.test.tsx   # new — pure render + formatter tests
```

### Polling contract

- `setInterval(1000)` → call `readActiveWork(cwd)` → compare `updated_at` → if changed, setState to re-render
- On unmount (q / Ctrl+C / Esc): `clearInterval` + Ink `unmount()` + exit(0)
- On read error: show a 1-line red error bar at bottom but keep polling (graceful degrade, don't crash)
</specifics>

<deferred>
## Deferred (Phase 30+)

- `--interval <ms>` flag — hardcoded 1000 ms for MVP
- Writable panels (approvals, todo inline edit, trigger skills) — violates read-only contract
- Multi-machine aggregation — out of scope for local dev tool
- Web / HTTP dashboard (OMO pattern) — explicitly rejected, SUNCO is terminal-native
- File-system watch (chokidar) — polling is enough for 1 Hz, watch can come later if needed
- `sunco dashboard` as a dedicated command — violates Phase 25 surface discipline
- Keyboard navigation between sections, copy-to-clipboard, mouse support — UX polish, not MVP
- Theming beyond the existing `packages/core/src/ui/theme/` tokens
</deferred>

---

*Phase: 30-cli-dashboard-tui*
*Context locked: 2026-04-11 by director (Opus 4.6)*
*Implementation assigned to: Sonnet subagent*

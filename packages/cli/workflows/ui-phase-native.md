# UI Phase Workflow — Native Surface (not supported in v1)

**Status:** Not supported in v1. Candidate for v2 — see `.planning/ROADMAP.md` v1.5/v2 candidates section (added when v1.4 closes).

Native-surface UI design contracts (macOS AppKit/SwiftUI, iOS, Android, Electron, Tauri, etc.) are **out of scope for Impeccable Fusion v1.4** and will not be implemented during the 17-phase v1.4 cycle (Phases 35–51).

---

## Behavior in Phase 36/M1.2 (skeleton)

When invoked via `/sunco:ui-phase --surface native`:

- Emits the unsupported message below to the user.
- Does **not** write any `UI-SPEC.md` artifact.
- Does **not** dispatch any other surface branch.
- Exits cleanly.

**Message to user:**

```
⚠ /sunco:ui-phase --surface native is not supported in v1.
  Native-surface UI contracts are a v2 candidate
  (see .planning/ROADMAP.md v2-candidates section, added at v1.4 close).
  For CLI-surface UI contracts, use /sunco:ui-phase (no flag) or --surface cli.
  For web-surface (once Phase 40/M2.3 lands), use --surface web.
```

---

## Why v1.4 excludes native

1. **Scope discipline.** v1.4 focuses on Impeccable-based web refinement (M2) and backend-excellence reference docs (M3/M4). Native adds a new reference vendor and design-system detection surface unrelated to those goals.
2. **No Impeccable analog.** Impeccable targets web patterns; native would require a separate reference vendor not yet selected.
3. **Cross-runtime install path.** Native surface implies platform-specific code paths the CLI runtime does not yet support.

Revisit at v1.4 closeout with a fresh discuss/research cycle.

---

*Stub introduced in Phase 36/M1.2 (2026-04-18). No implementation planned for v1.4. See `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §4 Phase 1.2 for explicit v1 scope exclusion.*

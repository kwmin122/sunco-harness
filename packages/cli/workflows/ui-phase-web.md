# UI Phase Workflow — Web Surface (stub)

**Status:** Implementation pending in Phase 40/M2.3.

This surface branch will be populated by Phase 40 to generate UI design contracts for web frontends (React, Vue, Svelte, Next.js, Astro, etc.). It will draw on the vendored Impeccable reference (see `packages/cli/references/impeccable/`) for web-specific design-system patterns and component conventions.

---

## Behavior in Phase 36/M1.2 (skeleton)

When invoked via `/sunco:ui-phase --surface web`:

- Emits the stub message below to the user.
- Does **not** write any `UI-SPEC.md` artifact.
- Exits cleanly without dispatching additional workflows.
- Suggests the active alternatives (`--surface cli` or no flag).

**Message to user:**

```
⚠ /sunco:ui-phase --surface web is not yet implemented.
  Web-surface UI contracts ship in Phase 40/M2.3 (Impeccable Fusion v1.4).
  For CLI-surface UI contracts, use /sunco:ui-phase (no flag) or --surface cli.
```

---

## What lands in Phase 40/M2.3

- Impeccable-based web design-system detection (tailwind, shadcn, chakra, mui, css-modules, styled-components, plain CSS)
- Web-specific `sunco-ui-researcher` agent spawn with web component inventory
- Responsive breakpoint and a11y section in UI-SPEC.md
- Framework-aware component patterns (React, Vue, Svelte, Astro)

Until Phase 40 lands, this file remains a placeholder. Phase 37–39 will not modify it.

---

*Stub introduced in Phase 36/M1.2 (2026-04-18). Replaced by full implementation in Phase 40/M2.3. See `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §4 Phase 2.3.*

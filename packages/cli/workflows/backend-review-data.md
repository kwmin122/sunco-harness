# Backend Review Workflow — Data Surface (stub)

**Status:** Implementation pending in Phase 47/M3.6.

This stub is dispatched by `backend-review.md` (router) when the user invokes `/sunco:backend-review --surface data`. The full data-surface review workflow — schema drift detection, migration audit, persistence review — will be authored in Phase 47/M3.6 alongside the api/event/ops review stubs.

---

## Behavior in Phase 37/M1.3 (skeleton)

When invoked via `/sunco:backend-review --surface data`:

- Emits the stub message below.
- Does **not** write any artifact.
- Does **not** spawn any agent.
- Exits cleanly.

**Message to user:**

```
⚠ /sunco:backend-review --surface data is not yet implemented.
  Data-surface backend review ships in Phase 47/M3.6 (Impeccable Fusion v1.4).
```

---

*Stub introduced in Phase 37/M1.3 (2026-04-18). Replaced by full implementation in Phase 47/M3.6. See `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §4 Phase 3.6 for populating deliverables.*

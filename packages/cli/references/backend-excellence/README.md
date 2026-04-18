# Backend Excellence (clean-room)

SUNCO-authored reference library for backend engineering craft. Paralleling the Impeccable design-craft layer, this directory will host 8 clean-room reference documents covering:

1. api-design
2. data-modeling
3. boundaries-and-architecture
4. reliability-and-failure-modes
5. security-and-permissions
6. performance-and-scale
7. observability-and-operations
8. migrations-and-compatibility

**Status**: Reference documents **populated** (Phase 42/M3.1, 2026-04-18). Deterministic detector implementation follows in Phase 43/M3.2 (`src/detect-backend-smells.mjs`, 7 high-confidence rules).

## Clean-room principle

Every document and rule in this directory is **original SUNCO authorship**. Structurally inspired by Impeccable's reference-per-surface organization, but contains no content derived from Impeccable or from other external sources without explicit attribution.

See `NOTICE.md` for the full clean-room declaration.

## Load strategy (reviewer/researcher agents)

Agents should load only the references relevant to a phase's tagged subdomain, not all 8 at once. Suggested mappings (wired up in Phase 45–47):

| Surface | Primary refs | Secondary refs |
|---------|-------------|----------------|
| `backend-phase-api` / `backend-review-api` | api-design, boundaries-and-architecture, security-and-permissions | performance-and-scale, observability-and-operations |
| `backend-phase-data` / `backend-review-data` | data-modeling, migrations-and-compatibility | performance-and-scale, reliability-and-failure-modes |
| `backend-phase-event` / `backend-review-event` | reliability-and-failure-modes, boundaries-and-architecture | performance-and-scale, observability-and-operations |
| `backend-phase-ops` / `backend-review-ops` | observability-and-operations, reliability-and-failure-modes | security-and-permissions, migrations-and-compatibility |

Rule of thumb: 2–3 primary + 2 secondary per invocation. Loading all 8 is only for cross-domain audits (Phase 48–49).

## Layout

```
backend-excellence/
├── NOTICE.md
├── README.md
├── reference/
│   ├── api-design.md
│   ├── data-modeling.md
│   ├── boundaries-and-architecture.md
│   ├── reliability-and-failure-modes.md
│   ├── security-and-permissions.md
│   ├── performance-and-scale.md
│   ├── observability-and-operations.md
│   └── migrations-and-compatibility.md
└── src/
    └── detect-backend-smells.mjs  # Phase 43/M3.2 — not yet authored
```

Each reference document is 1500–3000 words, with ≥5 anti-patterns (each: Smell / bad example / Why wrong / Fix / Detection label), ≥3 positive principles, a binary yes/no rubric, and ≥3 credible references.

Every anti-pattern carries a `Detection:` label — `deterministic candidate` (Phase 43 detector scope), `heuristic` (partial static analysis, high false-positive), or `human-review only` — to scope Phase 43 detector authoring without re-reading prose.

See `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` § Phase 3.1 & 3.2 for anti-pattern taxonomy and detector rule list.

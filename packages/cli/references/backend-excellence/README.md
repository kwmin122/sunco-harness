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

**Status**: Skeleton only (Phase 35/M1.1, 2026-04-18). Reference documents land in Phase 42/M3.1. Deterministic detector rules land in Phase 43/M3.2.

## Clean-room principle

Every document and rule in this directory is **original SUNCO authorship**. Structurally inspired by Impeccable's reference-per-surface organization, but contains no content derived from Impeccable or from other external sources without explicit attribution.

See `NOTICE.md` for the full clean-room declaration.

## Planned layout (populated in Phase 42 & 43)

```
backend-excellence/
├── NOTICE.md
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
    └── detect-backend-smells.mjs  # 7 high-confidence rules
```

Each reference document: ≥1500 words, ≥5 anti-patterns with code examples, stated principles, review rubric, further-reading section.

See `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` § Phase 3.1 & 3.2 for anti-pattern taxonomy and detector rule list.

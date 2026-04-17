# Impeccable (vendored)

This directory hosts the vendored Apache-2.0 [Impeccable](https://github.com/pbakaus/impeccable) skill pack (Paul Bakaus, 2025), integrated into SUNCO via a wrapper-injection pattern.

**Status**: Skeleton only (Phase 35/M1.1, 2026-04-18). Actual vendoring lands in Phase 38/M2.1.

## Planned layout (populated in Phase 38)

```
impeccable/
├── UPSTREAM.md           # pinned commit SHA from pbakaus/impeccable
├── LICENSE               # Apache-2.0 (verbatim from upstream)
├── NOTICE.md             # upstream NOTICE + SUNCO modification record
├── SUNCO-ATTRIBUTION.md  # attribution boilerplate
├── source/               # pristine copy of Impeccable skills (no patches)
├── src/                  # pristine copy of detect-antipatterns.mjs (no patches)
└── wrapper/              # SUNCO-authored adapters (not patches)
    ├── context-injector.mjs
    ├── detector-adapter.mjs
    └── README.md
```

## SUNCO integration principle

Vendored source stays **pristine**. No patches are applied to upstream files. All SUNCO-specific adaptations live in `wrapper/` and inject runtime context (reading `.planning/domains/frontend/DESIGN-CONTEXT.md` and passing it to Impeccable skills). Upstream sync is trivial: `git fetch upstream && git merge upstream/main` — wrapper is SUNCO-owned and never conflicts.

The "canonical path" concern (rewriting `.impeccable.md` → `.planning/domains/frontend/DESIGN-CONTEXT.md`) is resolved at runtime by the wrapper context-injector, not by patching source.

See `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` § Phase 2.1 (spec alias M2.1) for vendoring execution details and wrapper e2e test requirements.

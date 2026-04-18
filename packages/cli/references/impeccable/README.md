# Impeccable (vendored)

This directory hosts the vendored Apache-2.0 [Impeccable](https://github.com/pbakaus/impeccable) skill pack (Paul Bakaus, 2025), integrated into SUNCO via a wrapper-injection pattern.

**Status**: Vendored + wrapper skeleton (Phase 38/M2.1, 2026-04-18). Detector full integration lands in Phase 41/M2.4 (`/sunco:ui-review` WRAP).

## Layout

```
impeccable/
├── UPSTREAM.md           # pinned commit SHA, provenance, refresh workflow
├── LICENSE               # Apache-2.0, © 2025 Paul Bakaus (verbatim, 10766 bytes)
├── NOTICE.md             # upstream NOTICE — Impeccable + Anthropic attribution (verbatim)
├── SUNCO-ATTRIBUTION.md  # SUNCO-authored attribution + compliance checklist
├── source/               # pristine upstream source (NO patches)
│   └── skills/           # 18 Impeccable skills (adapt, animate, audit, bolder, clarify,
│                         #   colorize, critique, delight, distill, harden, impeccable,
│                         #   layout, optimize, overdrive, polish, quieter, shape, typeset)
├── src/                  # pristine upstream executables (NO patches)
│   └── detect-antipatterns.mjs  # Node CLI detector (3590 lines, Apache-2.0)
└── wrapper/              # SUNCO-authored adapters (not patches)
    ├── context-injector.mjs     # .planning/domains/frontend/DESIGN-CONTEXT.md → .impeccable.md schema
    ├── detector-adapter.mjs     # detector JSON → IMPECCABLE-AUDIT.md (contract skeleton)
    └── README.md                # wrapper rationale, fallback policy, integration notes
```

## SUNCO integration principle

Vendored source stays **pristine**. Zero patches. All SUNCO-specific adaptations live in `wrapper/` — a separate, SUNCO-owned layer that translates between SUNCO's canonical paths (`.planning/domains/frontend/DESIGN-CONTEXT.md`) and Impeccable's conventions (`.impeccable.md`, detector JSON output).

**Why this pattern**:

- **Upstream sync is trivial**: re-clone upstream at a newer SHA, re-run Phase 38-style copy, verify pristine invariant. No merge conflicts because SUNCO never modifies upstream files.
- **License compliance is unambiguous**: Apache-2.0 §4 is satisfied by verbatim LICENSE + NOTICE + this attribution document. No derivative work on upstream — the wrapper layer is clearly SUNCO-authored.
- **Testability**: `diff -r` between `tmp/impeccable-upstream/` and `references/impeccable/` must return empty. `smoke-test.cjs` Section 13 enforces this automatically.
- **Runtime-agnostic install safety**: `install.cjs` treats `source/` and `src/` as no-replacement copies, so non-Claude runtimes (codex, cursor, etc.) don't silently rewrite upstream string literals like `.claude/skills` (which exists in `source/skills/impeccable/scripts/cleanup-deprecated.mjs`).

## Wrapper layer entry points

- **Context injection** (Phase 38/M2.1): `wrapper/context-injector.mjs` exposes `loadDesignContext(projectRoot)` — reads `.planning/domains/frontend/DESIGN-CONTEXT.md` and returns a structured object matching what Impeccable's skills expect in place of `.impeccable.md` content. See `wrapper/README.md` for the schema contract.
- **Detector adaptation** (Phase 38 contract skeleton, Phase 41/M2.4 full integration): `wrapper/detector-adapter.mjs` exposes a normalization contract — `normalizeFindings(detectorJson) → IMPECCABLE-AUDIT.md`. Full detector execution + finding-lifecycle integration is deferred to Phase 41/M2.4 per Gate 2 scope trim.
- **Fallback policy** (Phase 38 documented, Phase 41 executable): `wrapper/README.md` documents detector-unavailable behavior (LLM critique fallback). Executable fallback handling ships with `/sunco:ui-review` WRAP in Phase 41.

## Provenance

Pinned commit: `00d485659af82982aef0328d0419c49a2716d123` (2026-04-18). See `UPSTREAM.md` for full verification order, refresh workflow, and exclusion list (`src/detect-antipatterns-browser.js` excluded — Node-only runtime).

See `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` § Phase 2.1 (spec alias M2.1) for vendoring execution details. Gate 2 judges: Codex GREEN, Claude GREEN (v2 after G6/G8 scope trim + G1 license verification sub-item).

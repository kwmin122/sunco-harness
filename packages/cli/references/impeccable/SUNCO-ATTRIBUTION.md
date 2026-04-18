# SUNCO Attribution — Impeccable Integration

## Upstream project

**Impeccable** — design-craft skill pack for agent-era builders.

- Author: Paul Bakaus (2025)
- License: Apache-2.0
- Upstream: https://github.com/pbakaus/impeccable
- Structural inspiration: Anthropic's frontend-design guidelines

## Pinned version

| Field | Value |
|-------|-------|
| Pinned commit | `00d485659af82982aef0328d0419c49a2716d123` |
| Fetched | 2026-04-18 |
| Next sync review | 2026-07-18 (quarterly) |

Full provenance trail (verification order, refresh workflow, pristine-diff command, invariant preservation for `.claude/skills` and `.impeccable.md` strings): see `UPSTREAM.md` in this directory.

## SUNCO modifications

SUNCO does **not** patch upstream files. All SUNCO-specific adaptations live in `wrapper/` (context injection + detector result formatting + fallback policy).

The conceptual "modification" required — rewriting canonical reference from `.impeccable.md` to `.planning/domains/frontend/DESIGN-CONTEXT.md` — is implemented as a runtime context injector in `wrapper/context-injector.mjs`. Vendored `source/` and `src/` files stay verbatim, byte-identical to upstream@pinned-SHA.

One install-pipeline adaptation preserves the pristine invariant: `packages/cli/bin/install.cjs` uses `copyDirRecursive` (not `copyDirWithReplacement`) for `references/impeccable/source/` and `references/impeccable/src/`, so non-Claude runtime installs don't rewrite upstream `.claude/` string literals (e.g. `source/skills/impeccable/scripts/cleanup-deprecated.mjs`). This is `install.cjs` policy only — the vendored files themselves are untouched.

## Compliance checklist (Phase 38/M2.1 — all items satisfied)

- [x] `LICENSE` copied verbatim from upstream (Apache-2.0, © 2025 Paul Bakaus)
- [x] `NOTICE.md` preserves upstream NOTICE content (Impeccable + Anthropic frontend-design attribution)
- [x] This `SUNCO-ATTRIBUTION.md` present and current
- [x] Pinned SHA recorded in `UPSTREAM.md` (`00d485659af82982aef0328d0419c49a2716d123`)
- [x] Wrapper injection end-to-end test passes (see `wrapper/context-injector.mjs --test`; no source file mutation verified by `diff -r tmp/impeccable-upstream/source/skills references/impeccable/source/skills`)
- [x] Pristine invariant enforced automatically in `packages/cli/bin/smoke-test.cjs` Section 13
- [x] Browser detector (`src/detect-antipatterns-browser.js`) excluded intentionally — SUNCO v1.4 Node-only; documented in `UPSTREAM.md`

## License compatibility

SUNCO's integration usage is compliant with Apache-2.0 §4 (redistribution). The verbatim `LICENSE`, `NOTICE.md`, this attribution document, and the wrapper-not-patch pattern together satisfy the required notices. No derivative-work modifications to upstream sources — adaptations live in the SUNCO-authored `wrapper/` layer only.

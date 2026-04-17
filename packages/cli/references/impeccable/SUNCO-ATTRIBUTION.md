# SUNCO Attribution — Impeccable Integration

## Upstream project

**Impeccable** — design-craft skill pack for agent-era builders.

- Author: Paul Bakaus (2025)
- License: Apache-2.0
- Upstream: https://github.com/pbakaus/impeccable
- Structural inspiration: Anthropic's frontend-design guidelines

## Pinned version

*Populated in Phase 38/M2.1 when vendoring is executed. The `UPSTREAM.md` file in this directory will record the exact commit SHA, clone date, and upstream tag (if any) at that point.*

## SUNCO modifications

SUNCO does **not** patch upstream files. All SUNCO-specific adaptations live in `wrapper/` (context injection + detector result formatting).

The conceptual "modification" required — rewriting canonical reference from `.impeccable.md` to `.planning/domains/frontend/DESIGN-CONTEXT.md` — is implemented as a runtime context injector in `wrapper/context-injector.mjs`. Vendored `source/` and `src/` files stay verbatim.

## Compliance checklist (Phase 38/M2.1 gate)

- [ ] `LICENSE` copied verbatim from upstream
- [ ] `NOTICE.md` preserves upstream NOTICE content
- [ ] This `SUNCO-ATTRIBUTION.md` present and current
- [ ] Pinned SHA recorded in `UPSTREAM.md`
- [ ] Wrapper injection end-to-end test passes (no source file mutation verified by hash)

## License compatibility

SUNCO's integration usage is compliant with Apache-2.0 §4 (redistribution). The verbatim `LICENSE`, `NOTICE.md`, and this attribution document together satisfy the required notices.

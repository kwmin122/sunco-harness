# Backend Review Workflow — Surface Dispatcher

Router for `/sunco:backend-review`. Parses `--surface {api|data|event|ops}` (**REQUIRED, no default**) and dispatches to the corresponding backend-surface review stub. Introduced in Phase 37/M1.3 as a skeleton; all four backend-review stubs are populated in Phase 47/M3.6.

> **Non-negotiable** (spec R4 — explicit-only triggers): no automatic surface detection, no default surface. `--surface` is required. Missing or unknown values produce a usage error.

---

## Step 1: Parse Arguments

<!-- SUNCO:PARSING-BLOCK-START -->
| Token | Variable | Default |
|-------|----------|---------|
| First numeric token | `PHASE_ARG` | current phase from STATE.md |
| `--surface <name>` or `--surface=<name>` | `SURFACE` | **REQUIRED — no default** |

Normalize `SURFACE` to lowercase. Accept exactly these values: `api`, `data`, `event`, `ops`.

**Repeated flag handling.** If `--surface` appears multiple times, use the last occurrence (standard flag semantics, consistent with Phase 36 ui-phase dispatcher).

**Case normalization.** `--surface API` and `--surface api` resolve to the same value (`api`). Convention inherited from Phase 36 ui-phase dispatcher.

**Flag form.** Both `--surface <value>` and `--surface=<value>` are supported.
<!-- SUNCO:PARSING-BLOCK-END -->

**Missing flag handling (REQUIRED — no default).** If `--surface` is absent entirely, emit a usage error and exit without dispatch:

```
ERROR: --surface is required (no default).
Valid: api, data, event, ops
Usage: /sunco:backend-review [phase] --surface {api|data|event|ops}
```

**Invalid value handling.** If `SURFACE` is set but not one of the accepted values, emit a usage error with the allowed list:

```
ERROR: Invalid --surface value: <received>
Valid: api, data, event, ops
Usage: /sunco:backend-review [phase] --surface {api|data|event|ops}
```

**Duplicate warning.** When `--surface` appears multiple times:

```
⚠ --surface specified multiple times; using last value: <value>
```

---

## Step 2: Dispatch

Based on the resolved `SURFACE`:

| `SURFACE` | Include file                 | Populated in   |
|-----------|------------------------------|----------------|
| `api`     | `backend-review-api.md`      | Phase 47/M3.6  |
| `data`    | `backend-review-data.md`     | Phase 47/M3.6  |
| `event`   | `backend-review-event.md`    | Phase 47/M3.6  |
| `ops`     | `backend-review-ops.md`      | Phase 47/M3.6  |

All stubs receive the same `PHASE_ARG` resolution; the router does no additional phase parsing beyond Step 1.

**Include semantics.** When dispatching, read the full content of the target workflow file from `packages/cli/workflows/` (or `~/.claude/sunco/workflows/` in installed runtime) and follow its instructions as if invoked directly.

---

## Invariants (Phase 37/M1.3)

1. **`--surface` REQUIRED** — no default, unlike the ui-phase dispatcher (which defaults to `cli` for backward compatibility). Missing flag is a usage error.
2. **No auto-routing, no surface detection** — surface choice is always explicit (R4).
3. **Pure surface stubs** — `backend-review-{api,data,event,ops}.md` each handle one surface and do NOT re-parse `--surface`.
4. **Parallel-router symmetry** — this router's `<!-- SUNCO:PARSING-BLOCK-START/END -->` block is **byte-identical** to `backend-phase.md`'s parsing block (drift prevention). Verified in smoke-test Section 12.
5. **Case/duplicate policy** — lowercase-normalize + last-wins, consistent with Phase 36 ui-phase dispatcher (convention uniformity across SUNCO dispatcher family).
6. **Rollback anchor** — pre-Phase-37 stable state is `origin/main @ 446efc7` (Phase 36). Rollback via `git revert` (new commit), not force-push.

---

## Install sync note

Source-of-truth lives in `packages/cli/workflows/`. The installed runtime at `~/.claude/sunco/workflows/` is populated by `packages/cli/bin/install.cjs` via file copy (not symlink). After any change to this router or its surface stubs, re-run `npx popcoru` (or `node packages/cli/bin/install.cjs`) to reflect changes in the installed runtime. Phase 37 does not mutate the installed runtime by design.

---

*Router introduced in Phase 37/M1.3 (2026-04-18). Context: `.planning/phases/37-backend-dispatcher-skeleton/37-CONTEXT.md`. Spec: `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §4 Phase 1.3 + R3 reconciliation. Focused Gate 37 judges: Codex GREEN, Claude GREEN (A2/A3 YELLOW→GREEN after Phase 36 convention alignment + phase-number correction).*

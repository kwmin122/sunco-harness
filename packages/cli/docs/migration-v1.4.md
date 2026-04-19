# Migration Guide — v1.4 Impeccable Fusion

v1.4 ships the Impeccable Fusion track: frontend web-UX review (M2), backend excellence (M3), cross-domain integration (M4), and docs rollout (M5). This guide covers what changed, the non-breaking adoption path, and the new commands + flags you'll encounter.

---

## TL;DR — no action required for existing users

Every command that worked in v0.11.x works identically in v1.4. `--surface` defaults to `cli` everywhere; no existing invocation changes behavior. All COEXIST commands (`/sunco:api-design-review`, `/sunco:database-design-review`, etc.) are preserved.

If you don't touch web frontends or backend APIs, you can ignore v1.4 and keep working. When you do need those surfaces, read the track-specific adoption sections below.

---

## What's new — track summary

| Track | Milestone | New surface | Docs |
|---|---|---|---|
| Frontend Web Fusion | M2 | `/sunco:ui-phase --surface web`, `/sunco:ui-review --surface web` | [impeccable-integration.md](impeccable-integration.md) |
| Backend Excellence | M3 | `/sunco:backend-phase --surface {api\|data\|event\|ops}`, `/sunco:backend-review --surface {api\|data\|event\|ops}` | [backend-excellence.md](backend-excellence.md) |
| Cross-Domain Integration | M4 | Verify-gate cross-domain layer + `/sunco:proceed-gate --allow-low-open` | [cross-domain.md](cross-domain.md) |
| Rollout Hardening | M5 | Docs (this doc + 3 others) | — |

---

## Non-breaking adoption path

### Adopt Impeccable (web frontends)

```bash
# 1. Populate DESIGN-CONTEXT.md for the phase
/sunco:discuss ${N} --domain frontend

# 2. Generate UI-SPEC.md
/sunco:ui-phase ${N} --surface web

# 3. Review with vendored Impeccable skill + 6-pillar wrapping
/sunco:ui-review ${N} --surface web
```

**What doesn't change:** `/sunco:ui-phase ${N}` (no flag) and `/sunco:ui-review ${N}` (no flag) continue to produce CLI-surface outputs exactly as in v0.11.x. `--surface web` is opt-in.

### Adopt Backend Excellence

```bash
# 1. Populate BACKEND-CONTEXT.md via teach flow
/sunco:discuss ${N} --domain backend

# 2. Generate SPEC.md for your surface — REQUIRED flag, no default
/sunco:backend-phase ${N} --surface api
# or: --surface data
# or: --surface event
# or: --surface ops

# 3. Review with deterministic detector + LLM critique
/sunco:backend-review ${N} --surface api
```

**Why `--surface` is required:** explicit surface classification prevents ambiguity between api / data / event / ops concerns. Each surface has its own SPEC schema, its own detector rule subset, and its own reviewer behavior.

**Detector rules (Phase 43):** 7 deterministic rules fire with zero LLM cost. See [backend-excellence.md](backend-excellence.md) for the full rule list and per-surface routing.

### Adopt Cross-Domain Integration

When a phase has **both** frontend and backend surfaces:

```yaml
# In .planning/phases/${N}-*/${N}-CONTEXT.md frontmatter or body:
domains: [frontend, backend]
```

Then:

```bash
/sunco:discuss ${N} --domain frontend
/sunco:discuss ${N} --domain backend
/sunco:ui-phase ${N} --surface web
/sunco:backend-phase ${N} --surface api
/sunco:ui-review ${N} --surface web
/sunco:backend-review ${N} --surface api
/sunco:verify ${N}                    # cross-domain gate fires automatically
/sunco:proceed-gate ${N}              # consumes CROSS-DOMAIN-FINDINGS.md
/sunco:ship ${N}
```

The verify-gate's cross-domain layer is **additive** (fires only when domains include both frontend + backend, or `required_specs` lists both UI-SPEC + API-SPEC) and **deterministic-only** (4 check types: missing-endpoint / type-drift / error-state-mismatch / orphan-endpoint).

Single-domain phases skip the cross-domain layer — no behavior change.

---

## `/sunco:proceed-gate` — new severity × state policy

The existing `/sunco:proceed-gate` command gains a cross-domain severity policy when CROSS-DOMAIN-FINDINGS.md is present for the phase:

| Severity | Open state | Dismissal | Override |
|---|---|---|---|
| **HIGH** | HARD BLOCK | Rejected at schema layer + gate layer | None |
| **MEDIUM** | BLOCK | Accepted with `dismissed_rationale` ≥50 chars | — |
| **LOW** | BLOCK (default) | Accepted with `dismissed_rationale` ≥50 chars | `--allow-low-open` flag permits pass-through |

### New flag: `--allow-low-open`

```bash
/sunco:proceed-gate 05 --allow-low-open
```

Permits LOW+open findings to pass without explicit `dismissed-with-rationale` entries. HIGH+open and MED+open continue to block. Use when you have deliberate orphan-endpoints (API-defined, UI not-yet-consumed) that shouldn't block a current release.

### Non-cross-domain phases unchanged

When CROSS-DOMAIN-FINDINGS.md is absent (single-domain phases, no-SPEC phases), `/sunco:proceed-gate` retains its v0.11.x VERIFICATION.md-only behavior verbatim. The severity policy and `--allow-low-open` flag apply only to cross-domain phases.

See [cross-domain.md](cross-domain.md) for the full policy matrix and examples.

---

## yaml direct dependency

`packages/cli/package.json` now declares `yaml: ^2.4.2` as a **direct dependency**. Previously, `yaml` was only transitively available via `package-lock.json`.

**Why the change:**

- Phase 48 generator (`extract-spec-block.mjs`) uses `yaml` dynamically at runtime to parse SPEC-BLOCK YAML bodies
- Phase 49 verify-gate cross-domain layer increases runtime `yaml` usage (findings generation, lifecycle parser)
- Relying on a transitive dependency makes install-time resolvability fragile to upstream changes
- Making the dep explicit guarantees availability and declares the contract

**User impact:**

- `npm install popcoru` resolves `yaml` into your `node_modules/yaml/` deterministically
- No API change, no new `require('yaml')` you need to write — it's entirely internal to SUNCO's runtime

If you previously relied on a specific `yaml` version, `^2.4.2` is compatible with the 2.x line that was already transitively present.

---

## New commands inventory (v1.4)

Only commands with new behavior are listed — existing v0.11.x commands unchanged unless noted.

| Command | Status | Surface |
|---|---|---|
| `/sunco:ui-phase --surface web` | NEW flag | M2 — Impeccable integration |
| `/sunco:ui-review --surface web` | NEW flag | M2 — Impeccable integration |
| `/sunco:backend-phase` | NEW command | M3 — dispatcher |
| `/sunco:backend-phase --surface api` | NEW | M3 — api phase |
| `/sunco:backend-phase --surface data` | NEW | M3 — data phase |
| `/sunco:backend-phase --surface event` | NEW | M3 — event phase |
| `/sunco:backend-phase --surface ops` | NEW | M3 — ops phase |
| `/sunco:backend-review` | NEW command | M3 — dispatcher |
| `/sunco:backend-review --surface {api\|data\|event\|ops}` | NEW | M3 — review per surface |
| `/sunco:verify` | Extended | Cross-domain gate added when domains include both frontend+backend |
| `/sunco:proceed-gate` | Extended | CROSS-DOMAIN-FINDINGS consumption + severity × state policy |
| `/sunco:proceed-gate --allow-low-open` | NEW flag | LOW pass-through for cross-domain findings |

All COEXIST commands (`/sunco:api-design-review`, `/sunco:database-design-review`, etc.) remain available as v0.11.x — wrapper conversion scheduled for a future minor release, not v1.4.

---

## What didn't change

- CLI default surface: every `--surface` flag defaults to `cli`; no flag = no behavior change from v0.11.x
- VERIFICATION.md format for non-cross-domain phases
- BACKEND-AUDIT.md at audit_version:1 — Phase 47 writer discipline preserved; lifecycle lives in a separate file (CROSS-DOMAIN-FINDINGS.md at findings_version:1)
- Schema IMMUTABILITY for `ui-spec`, `api-spec`, `data-spec`, `event-spec`, `ops-spec`, `cross-domain` schemas — only `finding.schema.json` was extended in Phase 49
- `install.cjs` — no changes in v1.4 beyond v0.11.x
- Existing hooks, commands, agents, workflows, references — all preserved

---

## Rollback path

If you adopt v1.4 and need to revert:

```bash
# Workspace-level rollback (if you committed adoption via a specific branch)
git checkout <pre-v1.4-branch>

# Package rollback
npm install popcoru@0.11.1
```

Reverting to v0.11.x drops `docs/`, the M2/M3/M4 surfaces, and the extended `/sunco:proceed-gate` behavior. Existing planning artifacts (.planning/ content you wrote with v1.4) remain readable — CROSS-DOMAIN.md and CROSS-DOMAIN-FINDINGS.md are plain markdown with YAML blocks, readable without any v1.4 tooling.

---

## Reading order — recommended

1. **This doc** — understand the non-breaking adoption model
2. **[impeccable-integration.md](impeccable-integration.md)** — if you have web frontends
3. **[backend-excellence.md](backend-excellence.md)** — if you have backend surfaces
4. **[cross-domain.md](cross-domain.md)** — if you have both, or if you need to understand `/sunco:proceed-gate` severity policy

For end-to-end cross-domain flow, jump to `cross-domain.md` § "End-to-end flow (cross-domain phase)".

---

*v1.4 Impeccable Fusion — M1 Foundation + M2 Frontend Fusion + M3 Backend Excellence + M4 Cross-Domain Integration + M5 Rollout Hardening. Zero regression to existing v0.11.x behavior. Every new capability is opt-in.*

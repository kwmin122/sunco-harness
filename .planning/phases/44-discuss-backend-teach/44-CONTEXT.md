# Phase 44 — discuss backend teach

- **Spec alias**: v1.4/M3.3
- **Milestone**: M3 Backend Excellence
- **Source spec**: `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §7 Phase 3.3
- **Requirement**: IF-10 (see `.planning/REQUIREMENTS.md`:286)
- **Precedent**: Phase 39/M2.2 frontend teach @ commit `f50ebdb`
- **Status**: **Populated 2026-04-19.** Focused Gate 44 passed GREEN-CONDITIONAL; 6 convergent conditions absorbed (see Judge relay summary).

## Goal

Populate `<!-- SUNCO:DOMAIN-BACKEND-START -->`/`END` marker pair in `packages/cli/workflows/discuss-phase.md` with active backend teach logic mirroring Phase 39 frontend pattern. 5 teach questions per spec §7 Phase 3.3. BACKEND-CONTEXT.md upsert. Explicit-only trigger (R4). No detector wire, no backend-phase/review activation (Phase 45–47 scope).

## Scope in

- `packages/cli/workflows/discuss-phase.md`: replace 2-line inert BACKEND block (lines 1158–1160) with active teach logic. Marker tag lines unchanged.
- `packages/cli/bin/smoke-test.cjs`: add Section 19 (backend teach populated + R3 FRONTEND byte-identical + router byte-identical + surface stubs remain stubs)
- No new files (BACKEND-CONTEXT.md is written at runtime by agents executing the workflow, not authored at Phase 44 time)

## Scope out (hard)

- **FRONTEND marker block** (lines 1090–1156) — byte-identical required (SHA-256 assertion in smoke)
- **discuss-phase.md content outside the BACKEND marker block** (success_criteria, success cases, opening prose, fallback behavior) — no edits
- **Backend detector wiring** — Phase 43 detector is standalone; not invoked from discuss-phase (Phase 47/M3.6)
- **backend-phase / backend-review router files** (`backend-phase.md`, `backend-review.md`) — byte-identical from Phase 37 (SHA-256 assertion)
- **backend-phase-{api,data,event,ops}.md surface stubs** — remain stubs (Phase 45–46)
- **backend-review-{api,data,event,ops}.md surface stubs** — remain stubs (Phase 47)
- install.cjs / Phase 37 R3 marker tag lines / vendored Impeccable source / M2 frontend surfaces
- PIL 999.1 backlog
- BACKEND-SEED.md forward-compat slot (not in spec; YAGNI per Gate 44 A5)
- 6th required teach question (spec locks 5; optional follow-up allowed per A2)

## Key decisions (Focused Gate 44 outcomes)

### A1. Trigger policy (R4 explicit-only) — GREEN-CONDITIONAL (condition 1 absorbed)

**Trigger (strict):**
- Phase frontmatter `domains: [backend]`, OR
- `/sunco:discuss --domain backend` CLI flag

**Stack detection: advisory-only warning, NEVER auto-activates.** Detection grep set spans multiple languages (Codex-expanded from Node-only), but limited to **web frameworks only** (plan-verifier's FP concern absorbed — DB/queue/ORM markers excluded to avoid false positives in hybrid projects):

- `package.json` (Node): `express`, `fastify`, `@fastify/`, `koa`, `@koa/`, `@nestjs/core`, `hono`, `polka`, `@hapi/hapi`, `restify`
- `pyproject.toml` / `requirements.txt` (Python): `fastapi`, `django`, `flask`
- `go.mod` (Go): `gin-gonic/gin`, `labstack/echo`, `gofiber/fiber`, `go-chi/chi`
- `Cargo.toml` (Rust): `axum`, `actix-web`

If ANY hit AND no `domains: [backend]` AND no `--domain backend`, emit stderr warning: `⚠ backend stack detected. Use --domain backend to activate backend teach.` No auto-activation.

### A2. BACKEND-CONTEXT.md write contract — GREEN-CONDITIONAL (condition 2 absorbed)

**Path:** `.planning/domains/backend/BACKEND-CONTEXT.md`

**Schema** (fixed by Phase 44; consumed by Phase 45–47 backend-researcher agents — schema changes require coordinated updates to both sides):

```markdown
# Backend Context

**Source**: SUNCO /sunco:discuss --domain backend (Phase 44/M3.3)
**Generated**: <ISO-8601 date>

## Domain
<answer — e-commerce / SaaS / content / internal / other>

## Traffic profile
- QPS avg: <answer>
- QPS peak: <answer>
- Geographic distribution: <answer>

## Data sensitivity
<answer — PII / payment / health / tier classification>

## SLO
- p95 latency: <answer>
- p99 latency: <answer>
- Availability: <answer — nines>

## Deployment model
<answer — serverless / k8s / bare-VM / bare-metal / edge>

## Tech stack / runtime (optional)
- Language/runtime: <answer>
- Frameworks: <answer>
- Primary datastore: <answer>
- Queue/cache: <answer>
```

**Tech stack / runtime section policy (condition 2 absorbed):** Optional follow-up under Deployment model question — NOT a 6th required teach question (preserves spec §7 5-question lock per plan-verifier). Asked as a follow-up only if user wants to fill it. **If user does not provide answers, the entire `## Tech stack / runtime (optional)` section is omitted from the written file** (not written as empty placeholder). Phase 45–47 backend-researcher agents that need this data can either (a) read it if present or (b) auto-detect from repo (package.json / pyproject.toml / go.mod / Dockerfile).

**Upsert behavior (Phase 39 mirror):**
- Absent: write new BACKEND-CONTEXT.md from answers
- Present: show per-field diff, user confirms overwrite per field (preserve prior by default)

### A3. 5 teach questions (spec §7 verbatim) — GREEN (condition 3 absorbed)

Questions as in spec §7 lines 509–513, with deployment wording expanded per Gate 44 condition 3 (`bare-VM / bare-metal` parenthetical — no new question):

1. **Domain** — e-commerce / SaaS / content / internal / other
2. **Traffic profile** — QPS avg, peak, geographic distribution
3. **Data sensitivity** — PII / payment / health / tier classification
4. **SLO** — p95/p99 latency, availability 9s
5. **Deployment model** — serverless / k8s / bare-VM / bare-metal / edge

No alignment to external vendored doc (backend has no vendored SKILL.md analog; spec is the authority).

### A4. Marker isolation (R3 clean separation) — GREEN

Edit restricted to content BETWEEN `<!-- SUNCO:DOMAIN-BACKEND-START -->` and `<!-- SUNCO:DOMAIN-BACKEND-END -->`. All other bytes in `discuss-phase.md` remain byte-identical, specifically:

- **FRONTEND block** (between `<!-- SUNCO:DOMAIN-FRONTEND-START -->` and `END`): **SHA-256 = `0b723b2b632c9faf40ae30bd44b0cbf3872a5343be1a1fc0ddc94978062036ee`** (3926 bytes, recorded 2026-04-19 pre-Phase-44)
- Marker tag lines themselves (4 lines): untouched
- success_criteria, opening prose, fallback behavior, prior-context loading logic: untouched

Smoke Section 19 asserts FRONTEND block hash match (direct R3 requirement verification; content-grep insufficient because nearby-byte mutation can preserve keywords).

### A5. --skip-teach behavior (2-mode backend matrix) — GREEN (condition 5 absorbed)

| Condition | Behavior |
|-----------|----------|
| `--skip-teach` + existing `BACKEND-CONTEXT.md` | Preserve, skip questions, proceed |
| `--skip-teach` + no `BACKEND-CONTEXT.md` | Stderr warn "no context source available; skipping backend teach". NO empty-file write |

Explicitly rejected: seed-import mode. Spec has no backend seed format (no `.impeccable.md` analog). Forward-compat slot for `BACKEND-SEED.md` **not** reserved — YAGNI per both judges.

### A6. Smoke Section 19 + R3 cross-verification — GREEN-CONDITIONAL (condition 6 absorbed)

Sections 1–18 frozen (274 checks). Section 19 adds ~14 checks:

1. BACKEND block populated (line count > 3 — i.e., not the 2-line inert default)
2. R4 trigger doc strings present: `domains: [backend]` AND `--domain backend`
3. Advisory-warning clause: multi-language backend-keyword grep + warn-only + NO auto-activation
4. All 5 spec-verbatim question section anchors present
5. BACKEND-CONTEXT.md path documented: `.planning/domains/backend/BACKEND-CONTEXT.md`
6. Schema block with 5 required section headers (`## Domain`, `## Traffic profile`, `## Data sensitivity`, `## SLO`, `## Deployment model`)
7. Optional `## Tech stack / runtime (optional)` section documented (condition 2)
8. `--skip-teach` 2-mode matrix present (both rows)
9. **FRONTEND block SHA-256 = `0b723b2b...06ee`** (byte-identical R3 assertion)
10. Backend-detector NOT mentioned in BACKEND block (grep for `detect-backend-smells.mjs` inside BACKEND block → 0)
11. **Router files byte-identical from Phase 37** (wording per condition 6 — router vs stub distinction):
    - `backend-phase.md` SHA-256 = `7044b440539a4b48dc548f9235a6794dec9248f77dee7040cd3a0bc47415a355`
    - `backend-review.md` SHA-256 = `33a2d4b473e60747d7583e67034283ccc75865a07bba2d76e0707807aece1481`
12. **Surface stubs remain stubs** (`backend-phase-{api,data,event,ops}.md` and `backend-review-{api,data,event,ops}.md`):
    - All 8 files exist
    - Each has ≤50 lines (stub threshold — Phase 37 stubs are 28-line scaffolds; real surface population is Phase 45–47)
13. Phase 37 R3 marker tag lines present (4 lines: FRONTEND-START/END + BACKEND-START/END)
14. Phase 44 CONTEXT populated (not scaffold)

Target: 274 + 14 = **288 passing**.

## Escalate triggers (halt + re-relay if any fires)

1. FRONTEND marker block content modified (SHA-256 mismatch vs `0b723b2b...06ee`)
2. backend-phase.md or backend-review.md router file edited (SHA-256 mismatch)
3. Backend surface stub activated (any of the 8 surface stubs exceeds stub-threshold ~50 lines — Phase 45–47 work pulled in)
4. Backend detector (Phase 43) wired into discuss-phase invocation path
5. install.cjs / Phase 37 dispatcher / R3 marker tag lines edited
6. discuss-phase.md sections OUTSIDE the BACKEND marker block edited (fallback behavior, success_criteria, examples, opening prose)
7. Phase 42 backend-excellence reference docs edit beyond spelling/punctuation/md-syntax (Phase 43 Escalate #5 still active)
8. Vendored Impeccable source mutation (R5 hard)
9. M2 frontend surfaces (injector/adapter/ui-phase-web/ui-review-web) edited
10. PIL 999.1 backlog pull-in
11. 6th required teach question added (spec §7 locks 5; schema can grow via optional follow-up only)
12. BACKEND-SEED.md slot or backend seed-import mode added (YAGNI rejected per A5)

## Rollback anchor

Pre-Phase-44 HEAD: `cbd17c7` (Phase 43/M3.2 pushed, 2026-04-19). `rollback/pre-v1.3-decision` tag remains.

## Judge relay summary (Focused Gate 44, 2026-04-19)

Two independent judges (Codex backend-review + plan-verifier) both returned GREEN-CONDITIONAL with 1 true divergence (A1 grep scope) and 1 near-divergence (A2 tech stack field). Both resolved via compromise absorbing the intersection of conservative + necessary concerns — no re-relay or user tiebreak needed.

**Conditions absorbed (6):**

1. **A1 advisory grep**: Web frameworks only (plan-verifier's FP concern respected — DB/queue excluded), multi-language (Codex's non-Node concern respected — Python/Go/Rust framework keywords added). Hybrid resolution.
2. **A2 tech stack**: Optional structured follow-up under Deployment model, NOT 6th required question. Section omitted entirely if user doesn't fill (not empty-placeholder). Hybrid resolution preserving spec §7 5-question lock while giving Phase 45–47 agents the data if available.
3. **A3 deployment wording**: "bare-VM / bare-metal" parenthetical only, no new question (both judges agree).
4. **A4 hash check**: FRONTEND block SHA-256 assertion accepted (plan-verifier positive, Codex positive).
5. **A5 seed mode**: rejected unanimously (both judges), no BACKEND-SEED.md slot.
6. **A6 smoke wording**: Section 19 distinguishes router files (unchanged from Phase 37) from surface stubs (remain stubs) — Codex absorbed, plan-verifier silent.

Focused Gate 44 → GREEN (after conditions absorbed). No residual, execution authorized.

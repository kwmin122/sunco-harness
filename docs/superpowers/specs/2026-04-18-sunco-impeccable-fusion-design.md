# SUNCO × Impeccable Fusion — Design Specification

**Date:** 2026-04-18
**Status:** Design-locked, awaiting user approval
**Target repo:** sunco-harness (`~/SUN/sunco-harness/`, remote: `github.com/kwmin122/sunco-harness.git`)
**Install target:** `~/.claude/sunco/`
**Source of decisions:** 4-round cross-model ping-pong (Claude Code + Codex CLI + Judge synthesis)
**Self-review fix-log policy (§16):** Cross-model ping-pong rounds R1–R6 + blind-spot additions BS1–BS5 serve as the authoritative fix-log for this spec's 6-dimension self-review. Each ping-pong round applied pressure to a specific dimension; surfaced issues were merged into the spec before this gate. §16 documents *which round pressured which dimension*, not a retroactive point score.

---

## §1. Executive Summary

### What
Integrate Paul Bakaus's [Impeccable](https://github.com/pbakaus/impeccable) frontend-design skill pack into SUNCO as a web-surface frontend excellence layer, and build a clean-room "Backend Excellence" counterpart mirroring Impeccable's structure. Bind them via cross-domain contracts that SUNCO's verify gate enforces.

### Why
- SUNCO plans phases and executes them, but lacks domain-specific *design quality* enforcement
- Impeccable solves this for web frontends: curated references + anti-pattern vocabulary + deterministic detector
- Backend Excellence is absent from the ecosystem — no equivalent reference pack exists
- Plans without domain design contracts produce phases that execute but ship incoherent frontend-backend pairs

### v1 Scope
- Frontend: Impeccable vendored + wrapper-injected, accessible via `/sunco:ui-phase --surface web` and `/sunco:ui-review --surface web`
- Backend: Clean-room reference pack (8 domains) + 7 deterministic smell detector rules + `/sunco:backend-phase --surface api|data|event|ops`
- Cross-domain: `.planning/domains/contracts/CROSS-DOMAIN.md` with 4 severity-labeled verify gate checks
- No regression for existing `/sunco:ui-phase` CLI users (default surface = cli)

### Timeline
7 weeks single-person / 4 weeks two-person parallel. 17 phases across 5 milestones.

---

## §2. Architecture Principles

1. **SUNCO owns canonical, external formats are adapters** — `.planning/` is source of truth. `.impeccable.md` etc. are optional compatibility surfaces, never required.

2. **Explicit-only triggers (v1)** — No automatic surface detection, no automatic teach-question injection. User declares intent via `--surface <value>` or `domains: [...]` in phase YAML or `--domain <value>`.

3. **Dispatcher pattern** — Umbrella command (public-facing) routes to surface-specific internal workflow files. Preserves command-surface minimalism while separating divergent logic.

4. **Finding-based verification with state lifecycle** — No FAIL/WARN binary. All verify-gate outputs are findings with `severity: HIGH|MEDIUM|LOW` AND `state: open|resolved|dismissed-with-rationale`. Proceed-gate policy blocks based on severity × state matrix.

5. **Impeccable is vendored with upstream pristine; Backend Excellence is clean-room** — No patches applied to vendored Impeccable source. SUNCO wrapper layer injects SUNCO context at runtime. Backend Excellence is original SUNCO authorship, structurally inspired but content-original.

6. **Deterministic detector = high-confidence only** — Findings labeled `deterministic | heuristic | requires-human-confirmation`. Never claim deterministic detection of context-dependent issues (idempotency, authz-after-fetch, etc.).

---

## §3. Milestone Structure

```
M1 Foundation ──┬──> M2 Frontend Fusion ──┐
                │                          ├──> M4 Cross-Domain ──> M5 Rollout
                └──> M3 Backend Excellence ┘
                     (parallel with M2 after M1)
```

| Milestone | Phases | Purpose | Depends on |
|-----------|--------|---------|------------|
| M1 Foundation | 1.1, 1.2, 1.3 | File layout, dispatcher skeletons, attribution scaffolding | — |
| M2 Frontend Fusion | 2.1, 2.2, 2.3, 2.4 | Impeccable vendored, web-surface commands, detector wrapped | M1 |
| M3 Backend Excellence | 3.1–3.6 | 8 references, 7 detector rules, 4 surface commands + reviews | M1 |
| M4 Cross-Domain | 4.1, 4.2 | Contracts schema, verify gate, finding lifecycle | M2 + M3 |
| M5 Rollout | 5.1, 5.2 | Docs, migration guide, dogfood, test coverage | all |

**Total: 17 phases.**

---

## §4. Target File Layout

### SUNCO harness install (`~/.claude/sunco/`)

```
workflows/
├── ui-phase.md                     # NEW router (thin dispatcher + sanity pre-check)
├── ui-phase-cli.md                 # EXISTING logic, renamed from ui-phase.md
├── ui-phase-web.md                 # NEW, Impeccable-aware
├── ui-phase-native.md              # NEW stub ("v1 not supported")
├── ui-review.md                    # MODIFIED, WRAP detector when --surface web
├── discuss-phase.md                # MODIFIED in Phase 1.3: add domain-switch skeleton
│                                   # (frontend/backend teach slots, populated by 2.2 / 3.3)
├── backend-phase.md                # NEW router
├── backend-phase-api.md            # NEW
├── backend-phase-data.md           # NEW
├── backend-phase-event.md          # NEW
├── backend-phase-ops.md            # NEW
├── backend-review.md               # NEW router
├── backend-review-api.md           # NEW
├── backend-review-data.md          # NEW
├── backend-review-event.md         # NEW
├── backend-review-ops.md           # NEW
├── cross-domain-sync.md            # NEW (M4)
├── verify.md                       # MODIFIED, + cross-domain gate layer
└── ... (existing workflows untouched — COEXIST set)

references/
├── impeccable/                     # VENDORED (Apache-2.0)
│   ├── UPSTREAM.md                 # pinned upstream commit SHA
│   ├── LICENSE                     # verbatim from upstream
│   ├── NOTICE.md                   # verbatim from upstream
│   ├── SUNCO-ATTRIBUTION.md        # SUNCO-side attribution explaining no modifications
│   ├── source/skills/              # 18 upstream skills, PRISTINE
│   ├── src/
│   │   └── detect-antipatterns.mjs # upstream detector, PRISTINE
│   └── wrapper/                    # SUNCO-authored adapter layer (NEW)
│       ├── README.md               # explains wrapper strategy
│       ├── context-injector.mjs    # reads DESIGN-CONTEXT.md, injects into Impeccable skills
│       └── detector-adapter.mjs    # wraps detect-antipatterns.mjs, normalizes output to IMPECCABLE-AUDIT.md format
│
└── backend-excellence/             # CLEAN-ROOM (SUNCO authored)
    ├── LICENSE                     # MIT or Apache-2.0 (SUNCO chooses)
    ├── NOTICE.md                   # structural-inspiration attribution
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
        └── detect-backend-smells.mjs   # 7 deterministic rules

agents/
├── sunco-ui-researcher-web.md      # NEW (loads Impeccable refs + DESIGN-CONTEXT)
├── sunco-backend-researcher.md     # NEW (loads surface-specific backend refs)
├── sunco-backend-reviewer.md       # NEW
└── sunco-cross-domain-checker.md   # NEW (emits CROSS-DOMAIN-FINDINGS.md)

schemas/
├── ui-spec.schema.json             # validates SPEC-BLOCK inside UI-SPEC.md (web surface)
├── api-spec.schema.json            # validates SPEC-BLOCK inside API-SPEC.md
├── data-spec.schema.json
├── event-spec.schema.json
├── ops-spec.schema.json
├── cross-domain.schema.json        # CROSS-DOMAIN.md shape
└── finding.schema.json             # severity + state + rationale schema

commands/sunco/
├── ui-phase.md                     # MODIFIED command def (adds --surface help)
├── backend-phase.md                # NEW
└── backend-review.md               # NEW
```

### Project runtime (`<project>/.planning/`)

```
.planning/
├── domains/
│   ├── frontend/
│   │   ├── DESIGN-CONTEXT.md       # canonical, populated by /sunco:discuss --domain frontend
│   │   ├── UI-SPEC.md              # populated by /sunco:ui-phase N --surface web
│   │   ├── DESIGN-SYSTEM.md        # optional, populated by extract equivalent
│   │   └── IMPECCABLE-AUDIT.md     # populated by /sunco:ui-review N --surface web
│   ├── backend/
│   │   ├── BACKEND-CONTEXT.md
│   │   ├── API-SPEC.md
│   │   ├── DATA-SPEC.md
│   │   ├── EVENT-SPEC.md
│   │   ├── OPS-SPEC.md
│   │   └── BACKEND-AUDIT.md
│   └── contracts/
│       ├── CROSS-DOMAIN.md          # auto-generated from UI-SPEC + API-SPEC SPEC-BLOCKs
│       └── CROSS-DOMAIN-FINDINGS.md # verify-gate output with severity + state
└── phases/<NN>/
    └── ...                         # existing structure
```

---

## §5. M1 Foundation — Phase Detail

### Phase 1.1 — File layout & attribution scaffolding

**Deliverables:**
- Create `references/impeccable/` directory (empty placeholders for LICENSE, NOTICE.md, source/, src/, wrapper/)
- Create `references/backend-excellence/` directory (empty placeholders)
- Create `schemas/` directory
- Write `references/impeccable/SUNCO-ATTRIBUTION.md` (boilerplate from §11)
- Write `references/backend-excellence/NOTICE.md` (boilerplate from §11)
- CHANGELOG entry: "v0.X — Impeccable fusion foundation"

**Done when:**
```bash
[ -d ~/.claude/sunco/references/impeccable ] \
  && [ -d ~/.claude/sunco/references/backend-excellence ] \
  && [ -d ~/.claude/sunco/schemas ] \
  && [ -f ~/.claude/sunco/references/impeccable/SUNCO-ATTRIBUTION.md ]
```

### Phase 1.2 — UI dispatcher skeleton

**Deliverables:**
1. Rename existing `workflows/ui-phase.md` → `workflows/ui-phase-cli.md` (content unchanged)
2. Write new `workflows/ui-phase.md` as thin router:
   ```
   Step 1: Parse $ARGUMENTS
     - Extract --surface <value>; default = cli
   Step 2: Sanity pre-check (WARN ONLY, does not change routing)
     - If package.json detected: grep react|vue|svelte|next|astro
       - Found AND surface=cli → stderr: "⚠ Web framework detected. Proceeding with cli per explicit default. Re-run with --surface web for Impeccable flow."
     - If source contains: grep ink|blessed|terminal-kit
       - Found AND surface=web → stderr: "⚠ CLI UI framework detected. Proceeding with web per flag."
   Step 3: Dispatch
     - surface=cli → include workflows/ui-phase-cli.md
     - surface=web → include workflows/ui-phase-web.md
     - surface=native → include workflows/ui-phase-native.md
     - unknown → error with usage
   ```
3. Write `workflows/ui-phase-web.md` as empty stub (filled in Phase 2.3)
4. Write `workflows/ui-phase-native.md` stub:
   ```
   Native surface is not supported in v1.
   Planned for v2. Track at: .planning/ROADMAP.md or upstream issue.
   ```
5. Add `discuss-phase.md` domain-switch skeleton (per R3 judge merge):
   ```markdown
   <!-- ... existing content ... -->
   
   ## Domain Extension Hooks
   
   These sections are populated only when the user invokes with
   --domain frontend or --domain backend, or when phase YAML declares
   domains: [frontend] / [backend].
   
   ### Frontend teach (populated in Phase 2.2)
   <!-- SUNCO:DOMAIN-FRONTEND-START -->
   <!-- SUNCO:DOMAIN-FRONTEND-END -->
   
   ### Backend teach (populated in Phase 3.3)
   <!-- SUNCO:DOMAIN-BACKEND-START -->
   <!-- SUNCO:DOMAIN-BACKEND-END -->
   ```

**Done when:**
- `/sunco:ui-phase` (no flag) produces identical output as before rename
- `/sunco:ui-phase --surface web` outputs stub message
- `/sunco:ui-phase --surface native` outputs "not supported"
- `/sunco:discuss --domain frontend` is parsed (even if no teach logic yet)
- Sanity pre-check warning observed in fixture test (fixture: `package.json` with `"react": "*"`, then call without `--surface web` → warning in stderr)

### Phase 1.3 — Backend dispatcher skeleton

**Deliverables:**
1. Write `workflows/backend-phase.md` router:
   ```
   Step 1: Parse $ARGUMENTS
     - Require --surface <value>; no default (unlike ui-phase which defaults to cli for BC)
   Step 2: Validate
     - Allowed: api, data, event, ops
     - Missing or unknown → error with usage
   Step 3: Dispatch
     - surface=<X> → include workflows/backend-phase-<X>.md
   ```
2. Write `workflows/backend-review.md` router (identical structure)
3. Write 4 stub workflows: `backend-phase-{api,data,event,ops}.md` (filled in 3.4, 3.5)
4. Write 4 stub workflows: `backend-review-{api,data,event,ops}.md` (filled in 3.6)
5. Register commands: `commands/sunco/backend-phase.md`, `commands/sunco/backend-review.md`

**Done when:**
- `/sunco:backend-phase --surface api` outputs stub message
- `/sunco:backend-phase` (no flag) outputs usage error
- `/sunco:backend-phase --surface unknown` outputs usage error with allowed list
- Corresponding `/sunco:backend-review ...` behaviors match

---

## §6. M2 Frontend Fusion — Phase Detail

### Phase 2.1 — Impeccable vendoring + wrapper injection (R5)

**Deliverables:**
1. `git clone --depth 1 https://github.com/pbakaus/impeccable.git tmp/impeccable-upstream`
2. Record upstream commit SHA to `references/impeccable/UPSTREAM.md`:
   ```markdown
   # Upstream Tracking
   
   Source: https://github.com/pbakaus/impeccable
   Pinned commit: <SHA>
   Fetched: 2026-04-18
   Next sync review: quarterly
   ```
3. Copy pristine:
   - `LICENSE` → `references/impeccable/LICENSE`
   - `NOTICE.md` → `references/impeccable/NOTICE.md`
   - `source/skills/` → `references/impeccable/source/skills/`
   - `src/detect-antipatterns.mjs` → `references/impeccable/src/`
4. **No patches applied to vendored source.** Verify: grep the source for `.impeccable.md` references; they remain unchanged. The wrapper layer (step 5) handles path translation.
5. Author `references/impeccable/wrapper/`:
   - `context-injector.mjs`: exports `loadDesignContext(projectRoot)` that reads `.planning/domains/frontend/DESIGN-CONTEXT.md` and returns a structured object matching what Impeccable skills expect in place of `.impeccable.md` content
   - `detector-adapter.mjs`: wraps `detect-antipatterns.mjs` execution:
     - Accepts `<source_path>` and `<output_path>`
     - Invokes vendored detector, captures JSON output
     - Normalizes findings into IMPECCABLE-AUDIT.md format (markdown with severity labels, file:line anchors)
   - `README.md`: explains why vendored source is pristine, how wrapper bridges to SUNCO canonical

**Done when:**
- `node references/impeccable/src/detect-antipatterns.mjs --help` works (pristine detector operational)
- `node references/impeccable/wrapper/context-injector.mjs --test` runs e2e test:
  - Create fixture project with `.planning/domains/frontend/DESIGN-CONTEXT.md`
  - Inject context into a mock Impeccable skill invocation
  - Assert the skill receives context as if from `.impeccable.md`
- `node references/impeccable/wrapper/detector-adapter.mjs <fixture> <output>` produces well-formed IMPECCABLE-AUDIT.md
- `grep -r "applied patch" references/impeccable/` returns nothing (confirms no patches)

### Phase 2.2 — Discuss frontend teach (fills domain-frontend slot)

**Deliverables:**
- Modify `discuss-phase.md` to populate `<!-- SUNCO:DOMAIN-FRONTEND-START -->`/`END` section with teach logic:
  ```
  Trigger (per R4 explicit-only):
    - Phase YAML declares domains: [frontend], OR
    - User invokes with --domain frontend
    - (No automatic detection. Sanity pre-check may warn but does not trigger.)
  
  When triggered:
    Ask 3 teach questions inline:
      1. Target audience (specific persona + skill level)
      2. Primary use cases (top 3)
      3. Brand personality / tone (3-5 adjectives)
    
    Upsert to .planning/domains/frontend/DESIGN-CONTEXT.md:
      - If file exists, preserve prior answers (offer diff; user confirms overwrites)
      - If .impeccable.md exists in project root, import as seed (with --skip-teach flag)
  ```
- Add `--skip-teach` flag to discuss command (for imports / re-runs without re-asking)

**Done when:**
- With phase YAML `domains: [frontend]`, `/sunco:discuss N` asks the 3 questions and writes `DESIGN-CONTEXT.md`
- With `--skip-teach` and existing `.impeccable.md`, contents are imported without prompting
- Without `--domain frontend` flag AND without YAML declaration, no teach questions appear (confirms explicit-only)
- **Does not touch** `<!-- SUNCO:DOMAIN-BACKEND-START -->` region (confirms clean slot separation per R3)

### Phase 2.3 — ui-phase-web implementation

**Deliverables:**
1. Fill `workflows/ui-phase-web.md`:
   ```
   Step 1: Require .planning/domains/frontend/DESIGN-CONTEXT.md
     - Missing → error: "Run /sunco:discuss N --domain frontend first"
   Step 2: Read phase CONTEXT.md, DESIGN-CONTEXT.md
   Step 3: Spawn sunco-ui-researcher-web agent
     - Loads: 7 Impeccable references (typography, color-and-contrast, spatial-design,
       motion-design, interaction-design, responsive-design, ux-writing)
     - Via: context-injector.mjs, not direct .impeccable.md
     - Executes 3-stage research: ref-load → outline → write (per BS2 token budget mitigation)
   Step 4: Write UI-SPEC.md
     - Prose sections: user-visible description
     - Required <!-- SUNCO:SPEC-BLOCK --> fenced YAML block (per R2):
       layout, components, states, interactions, a11y, responsive, motion, copy, 
       anti_pattern_watchlist, design_system_tokens_used, endpoints_consumed, 
       error_states_handled
   Step 5: Validate SPEC-BLOCK against schemas/ui-spec.schema.json
   Step 6: Present summary, confirm, commit
   ```
2. Write `agents/sunco-ui-researcher-web.md` agent definition

**Done when:**
- `/sunco:ui-phase N --surface web` produces UI-SPEC.md
- UI-SPEC.md contains valid SPEC-BLOCK YAML (validates against schema)
- UI-SPEC.md references at least 3 Impeccable anti-patterns in watchlist
- Agent context stays under 30k tokens (log usage, verify ceiling)

### Phase 2.4 — ui-review WRAP (R1 corrected)

**Deliverables:**
- Modify `workflows/ui-review.md` to add explicit `--surface` flag:
  ```
  Flag handling (per R1 — no regression):
    - No flag → existing cli behavior (0 regression, unchanged)
    - --surface cli → explicit existing behavior
    - --surface web → new Impeccable WRAP path (below)
  ```
- Web path logic:
  ```
  Step 1: Read UI-SPEC.md SPEC-BLOCK (fail if missing)
  Step 2: Run existing 6-pillar scoring (keep intact)
  Step 3: Execute vendored detector via wrapper:
    node references/impeccable/wrapper/detector-adapter.mjs <project_src> <out_path>
    On failure: graceful fallback, emit warning, skip detector findings
  Step 4: LLM critique via sunco-ui-reviewer agent extension
    - Loads Impeccable refs for design heuristics
  Step 5: Write two files:
    - .planning/domains/frontend/IMPECCABLE-AUDIT.md (raw detector + critique)
    - <phase>/UI-REVIEW.md (6-pillar scoring + Impeccable summary wrap)
  ```

**Done when:**
- `/sunco:ui-review N` (no flag) matches exact output of previous version (regression test in Phase 5.2 fixtures)
- `/sunco:ui-review N --surface web` produces both IMPECCABLE-AUDIT.md and UI-REVIEW.md
- Detector failure (e.g., Node missing per BS5) produces warning but does not block LLM critique path

---

## §7. M3 Backend Excellence — Phase Detail

### Phase 3.1 — 8 reference documents (clean-room authorship)

**Shared structure per reference file:**
```markdown
# <Reference Name>

## Overview
(Why this domain matters, who this reference is for.)

## Anti-patterns (at least 5)

### <pattern-name-in-kebab-case>
**Smell:** Short description.
**Example (bad):**
```<language>
// ...
```
**Why wrong:** Explanation.
**Fix:**
```<language>
// ...
```

## Principles
(3-7 positive design principles, not just "avoid X".)

## Rubric
(Checklist for review. Each item answerable yes/no.)

## References
(Links to RFCs, canonical books, industry standards.)
```

**Required anti-patterns per file (v1 minimum — all must be documented with code examples):**

| Reference | Must-include anti-patterns |
|-----------|---------------------------|
| `api-design.md` | verb-endpoints, inconsistent-pluralization, leaky-enum, 200-with-error-body, untyped-any-response, no-pagination-on-list, overloaded-parameters |
| `data-modeling.md` | nullable-everything, boolean-flag-pileup, polymorphic-blob-column, timestamp-without-tz, string-id-ambiguity, missing-indexes-on-fk, soft-delete-tombstones |
| `boundaries-and-architecture.md` | god-route-handler, circular-module-deps, data-access-from-controller, domain-logic-in-transport, fat-shared-utils, feature-envy |
| `reliability-and-failure-modes.md` | missing-timeout, no-retry-backoff, sync-call-in-hot-path, silent-catch, cascading-failures, no-bulkhead, no-circuit-breaker-on-3rd-party |
| `security-and-permissions.md` | authz-after-fetch, raw-sql-interpolation, secret-in-log, any-typed-body, open-cors, missing-csrf, role-hardcoded |
| `performance-and-scale.md` | n-plus-one, unbounded-list, no-pagination, sync-loop-with-await, over-fetching, no-cache-layer, serial-io |
| `observability-and-operations.md` | no-request-id, log-without-level, metric-without-dimensions, pii-in-log, no-trace-propagation, error-without-context |
| `migrations-and-compatibility.md` | drop-column-in-same-release, non-reversible-migration, no-expand-contract, breaking-response-shape-no-version, no-backfill-plan |

**Size target:** 1500–3000 words per file. Parallel authorship allowed (2 files per author for 2-person team).

**Done when:**
- All 8 files exist with required anti-patterns + code examples
- Each file has ≥5 anti-patterns, ≥3 principles, ≥1 rubric section
- No content derived from Impeccable (original authorship verified by manual review)

### Phase 3.2 — Deterministic detector (7 high-confidence rules)

**File:** `references/backend-excellence/src/detect-backend-smells.mjs`

**Rules (with detection heuristic):**

| Rule | Detection |
|------|-----------|
| `raw-sql-interpolation` | AST scan for template literals containing SQL keywords (SELECT/INSERT/UPDATE/DELETE/WHERE) with `${...}` expressions |
| `missing-timeout` | AST scan for `fetch(`, `axios.get|post|...`, `http.request(` calls where options arg missing `timeout` key |
| `swallowed-catch` | AST scan for `catch` blocks with empty body, or body containing only `return;` with no expression |
| `any-typed-body` | TypeScript AST scan for handler signatures `(req: any, ...)` OR handler body without validation call (zod/joi/yup/ajv/class-validator) |
| `missing-validation-public-route` | Route registration on non-auth-prefixed paths without validation import/call in handler |
| `non-reversible-migration` | File in `migrations/` or `db/migrations/` without exported `down()` or a comment matching `// expand-contract` or `// reversible:` |
| `logged-secret` | Logger/console call where argument string or object contains keys matching `/authorization|api[_-]?key|password|token|secret|credential/i` |

**Output JSON schema:**
```json
{
  "findings": [
    {
      "rule": "raw-sql-interpolation",
      "severity": "high",
      "kind": "deterministic",
      "file": "src/users/repository.ts",
      "line": 42,
      "column": 15,
      "match": "`SELECT * FROM users WHERE id = ${userId}`",
      "fix_hint": "Use parameterized query via your ORM or prepared statement"
    }
  ],
  "meta": {
    "files_scanned": 123,
    "duration_ms": 340,
    "rules_enabled": ["raw-sql-interpolation", "missing-timeout", ...],
    "detector_version": "1.0.0"
  }
}
```

**Done when:**
- All 7 rules operate on fixture corpus
- Each rule has positive + negative fixture (must-trigger + must-not-trigger)
- `--json` mode outputs valid JSON parseable by `backend-review-*` workflows
- No known false-positive cases in fixture set

### Phase 3.3 — Discuss backend teach (fills domain-backend slot)

**Deliverables:**
- Populate `<!-- SUNCO:DOMAIN-BACKEND-START -->`/`END` section in `discuss-phase.md`:
  ```
  Trigger (explicit-only per R4):
    - Phase YAML declares domains: [backend], OR
    - --domain backend flag
  
  When triggered, ask 5 teach questions inline:
    1. Domain (e-commerce / SaaS / content / internal / other)
    2. Traffic profile (QPS avg, peak, geographic distribution)
    3. Data sensitivity (PII / payment / health / tier classification)
    4. SLO (p95/p99 latency, availability 9s)
    5. Deployment model (serverless / k8s / bare-VM / edge)
  
  Upsert → .planning/domains/backend/BACKEND-CONTEXT.md
  Support --skip-teach for re-runs
  ```

**Done when:**
- With `domains: [backend]`, `/sunco:discuss N` asks 5 questions and writes BACKEND-CONTEXT.md
- **Does not touch** `<!-- SUNCO:DOMAIN-FRONTEND-START -->` region (clean separation per R3)
- Parallel execution with Phase 2.2 does not produce git merge conflicts (empirically verified)

### Phase 3.4 — backend-phase-api + backend-phase-data

**`backend-phase-api.md` logic:**
```
Step 1: Require BACKEND-CONTEXT.md
Step 2: Read phase CONTEXT.md + BACKEND-CONTEXT.md
Step 3: Spawn sunco-backend-researcher agent with surface=api
  Loads: api-design.md + boundaries-and-architecture.md 
       + reliability-and-failure-modes.md + security-and-permissions.md
  3-stage: ref-load → outline → write
Step 4: Write API-SPEC.md
  - Prose sections describing endpoints
  - Required <!-- SUNCO:SPEC-BLOCK --> fenced YAML block:
    endpoints:
      - method: GET
        path: /users/me
        request_schema: (inline TS-like type)
        response_schema: ...
        errors: [{code: AUTH_EXPIRED, http: 401}, ...]
        auth: required | optional | none
        idempotency: idempotent | non-idempotent
    error_envelope: (shared shape)
    versioning_strategy: url-major | header | none
    anti_pattern_watchlist: [<patterns from api-design.md>]
Step 5: Validate SPEC-BLOCK against schemas/api-spec.schema.json
Step 6: Present + confirm + commit
```

**`backend-phase-data.md` logic:** identical structure, loads `data-modeling.md` + `migrations-and-compatibility.md` refs, outputs DATA-SPEC.md with SPEC-BLOCK:
```yaml
entities:
  - name: User
    fields: ...
    indexes: ...
    constraints: ...
    relationships: ...
migration_strategy: expand-contract | in-place
retention_policy: ...
anti_pattern_watchlist: [<patterns from data-modeling.md>]
```

**Done when:**
- Both commands produce valid SPEC.md with schema-validated SPEC-BLOCK
- `sunco-backend-researcher` loads correct reference subset per surface

### Phase 3.5 — backend-phase-event + backend-phase-ops

**`backend-phase-event.md` outputs EVENT-SPEC.md SPEC-BLOCK:**
```yaml
events:
  - name: UserSignedUp
    producer: auth-service
    consumers: [email-service, analytics-service]
    schema: (inline)
    ordering: strict | best-effort | none
    delivery_guarantee: at-least-once | at-most-once | exactly-once
    retention: 7d | forever
dead_letter_strategy: ...
idempotency_keys: ...
anti_pattern_watchlist: [<patterns>]
```

**`backend-phase-ops.md` outputs OPS-SPEC.md SPEC-BLOCK:**
```yaml
deployment_topology: ...
observability:
  logs: {structured, level_policy, retention}
  metrics: {required_dimensions, sli_list}
  traces: {propagation, sampling}
  alerts: [{name, threshold, runbook_ref}]
runbook:
  - alert: HighErrorRate
    action: ...
slo:
  availability: 99.9%
  latency_p95_ms: 200
error_budget_policy: ...
```

**Done when:** both commands operate, SPEC-BLOCK schema validation passes.

### Phase 3.6 — backend-review 4 surfaces

**Shared logic per `backend-review-<surface>.md`:**
```
Step 1: Require corresponding SPEC.md (API/DATA/EVENT/OPS)
Step 2: Run detector subset for this surface:
  - api: raw-sql-interpolation, any-typed-body, missing-validation-public-route, logged-secret
  - data: non-reversible-migration
  - event: (no deterministic rules v1 — pure review)
  - ops: missing-timeout, swallowed-catch, logged-secret
Step 3: Spawn sunco-backend-reviewer agent with surface refs loaded
Step 4: Normalize findings:
  Each finding gets:
    kind: deterministic | heuristic | requires-human-confirmation
    severity: HIGH | MEDIUM | LOW
    state: open (default; lifecycle managed by verify + proceed-gate)
Step 5: Write to .planning/domains/backend/BACKEND-AUDIT.md
  - Surface-sectioned
  - Each finding with full schema per schemas/finding.schema.json
```

**Done when:** all 4 `/sunco:backend-review --surface <X>` produce valid BACKEND-AUDIT.md sections; findings pass schema validation.

---

## §8. M4 Cross-Domain Integration — Phase Detail

### Phase 4.1 — CROSS-DOMAIN.md auto-generation

**Deliverables:**
1. `schemas/cross-domain.schema.json` with fields:
   ```json
   {
     "version": "1",
     "generated_from": [
       {"spec": "UI-SPEC.md", "sha": "<commit>"},
       {"spec": "API-SPEC.md", "sha": "<commit>"}
     ],
     "endpoints_consumed": [
       {"ui_ref": "UserDashboard", "method": "GET", "path": "/users/me"}
     ],
     "endpoints_defined": [
       {"method": "GET", "path": "/users/me", "owner_spec": "API-SPEC.md"}
     ],
     "error_mappings": [
       {"api_code": "AUTH_EXPIRED", "ui_state": "relogin-prompt", "fallback": "generic-error"}
     ],
     "type_contracts": [
       {"field_path": "User.email", "ui_type": "string", "api_type": "string", "match": true}
     ]
   }
   ```
2. `workflows/cross-domain-sync.md`:
   ```
   Step 1: Read UI-SPEC.md SPEC-BLOCK (extract endpoints_consumed, error_states_handled, type contracts)
   Step 2: Read API-SPEC.md SPEC-BLOCK (extract endpoints, error_envelope, type shapes)
   Step 3: Compute cross-reference:
     - endpoints_consumed ∩ endpoints_defined
     - error_states_handled ∩ error_envelope codes
     - type shape matching (by field_path)
   Step 4: Generate .planning/domains/contracts/CROSS-DOMAIN.md:
     - Prose summary
     - <!-- SUNCO:CROSS-DOMAIN-BLOCK --> fenced YAML per schema
   Step 5: Run schema validation
   ```

**Done when:**
- Given fixture UI-SPEC + API-SPEC, `/sunco:cross-domain-sync` produces valid CROSS-DOMAIN.md
- Re-run is idempotent (same input → same output, timestamps aside)
- SPEC.md SHA changes → CROSS-DOMAIN.md marked stale; re-run required

### Phase 4.2 — Verify gate cross-domain layer (R6 finding lifecycle)

**Deliverables:**
1. Modify `workflows/verify.md` to add "Cross-domain gate" layer:
   ```
   Triggered when phase YAML declares domains: [frontend, backend]
   OR when both UI-SPEC.md and API-SPEC.md exist for this phase.
   
   Step 1: Ensure CROSS-DOMAIN.md is fresh (regenerate if stale)
   Step 2: Spawn sunco-cross-domain-checker agent
   Step 3: Emit 4 check types as findings:
     - Missing endpoint: severity=HIGH (UI consumes; API undefined)
     - Type drift: severity=HIGH (shape mismatch between UI and API)
     - Error state mismatch: severity=MEDIUM (API error code not handled in UI state)
     - Orphan endpoint: severity=LOW (API defines; UI never consumes)
   Step 4: Write to .planning/domains/contracts/CROSS-DOMAIN-FINDINGS.md
     Each finding: {rule, severity, state=open, file_ref, fix_hint}
   ```

2. `schemas/finding.schema.json`:
   ```json
   {
     "rule": "missing-endpoint | type-drift | error-state-mismatch | orphan-endpoint | <backend-rule-names>",
     "severity": "HIGH | MEDIUM | LOW",
     "state": "open | resolved | dismissed-with-rationale",
     "dismissed_rationale": "string (required when state=dismissed-with-rationale, min 50 chars)",
     "resolved_commit": "string (required when state=resolved)",
     "kind": "deterministic | heuristic | requires-human-confirmation",
     "file_ref": "path:line",
     "fix_hint": "string"
   }
   ```

3. Proceed-gate policy (per R6):
   - `HIGH` + `open` → **HARD BLOCK** (cannot be dismissed)
   - `MEDIUM` + `open` → **BLOCK** (dismissible with rationale ≥50 chars)
   - `LOW` + `open` → **BLOCK** default; overridable via `--allow-low-open` flag on `/sunco:proceed-gate`
   - All `resolved` / `dismissed-with-rationale` → **PASS**

4. Phase YAML extension:
   ```yaml
   phases:
     - id: 05
       title: User dashboard
       domains: [frontend, backend]
       required_specs:
         - .planning/domains/frontend/UI-SPEC.md
         - .planning/domains/backend/API-SPEC.md
   ```
   Missing required_spec → verify fails with "Spec not produced" finding (HIGH, open).

**Done when:**
- Fixture phase with intentional FE/BE mismatches produces exactly 4 expected findings (one per check type) with correct severity
- Proceed-gate blocks on HIGH-open, passes on all-dismissed with proper rationale
- `--allow-low-open` flag permits LOW-open pass-through
- Existing proceed-gate behavior (for non-cross-domain phases) unchanged

---

## §9. M5 Rollout Hardening — Phase Detail

### Phase 5.1 — Documentation & migration guide

**Deliverables:**
- `~/.claude/sunco/docs/impeccable-integration.md` (usage guide: when to use --surface web, what DESIGN-CONTEXT.md should contain, how findings flow)
- `~/.claude/sunco/docs/backend-excellence.md` (backend reference usage, detector rules explained, surface selection guide)
- `~/.claude/sunco/docs/migration-v0.X.md`:
  ```markdown
  # Migration Guide — Impeccable Fusion (v0.X)
  
  ## No action required for existing CLI users
  /sunco:ui-phase and /sunco:ui-review continue working identically.
  Default surface = cli. All existing workflows preserved.
  
  ## To adopt Impeccable (web frontends)
  1. Invoke /sunco:discuss N --domain frontend
  2. Answer 3 teach questions
  3. Invoke /sunco:ui-phase N --surface web
  
  ## To adopt Backend Excellence
  1. Invoke /sunco:discuss N --domain backend
  2. Answer 5 teach questions
  3. Invoke /sunco:backend-phase N --surface {api|data|event|ops}
  
  ## Existing /sunco:api-design-review, /sunco:database-design-review
  Still work as before (COEXIST). Wrapper conversion scheduled for v1.(X+1).
  ```
- Update main README with new command summaries

**Done when:** all three docs exist and cover the stated sections.

### Phase 5.2 — Dogfood + test coverage

**Deliverables:**
1. **Dogfood** (per BS3 recovery procedure):
   ```
   a. git branch sunco-pre-dogfood  # snapshot
   b. In sunco repo: /sunco:discuss N --domain backend for CLI API phase
   c. /sunco:backend-phase N --surface api
   d. /sunco:backend-review N --surface api
   e. Review findings, process ≥5
   f. On failure: git reset --hard sunco-pre-dogfood; fix M3 Phase 3.4; retry
   g. On success: merge to main
   ```

2. **Test fixtures:**
   - `test/fixtures/frontend-web-sample/`: small web project fixture, invokes detector, asserts ≥7 Impeccable rules fire
   - `test/fixtures/backend-rest-sample/`: node/ts fixture with 7 smells, asserts each detector rule fires positive + negative case
   - `test/fixtures/cross-domain-conflict/`: fixture with intentional FE/BE mismatches, asserts each of 4 cross-domain check types fires with correct severity
   - `test/fixtures/ui-review-regression/`: CLI-surface regression fixture — `/sunco:ui-review N` (no flag) output snapshot; tracks any change to existing behavior

3. **CI integration** (vitest, existing harness):
   - Run all fixtures in CI
   - Gate PR merges on fixtures pass
   - Log detector token usage for sunco-ui-researcher-web / sunco-backend-researcher (BS2 monitoring)

**Done when:**
- CI green on all fixtures
- Dogfood findings ≥5 processed in sunco repo
- Token usage stays under 30k per researcher spawn (per BS2 limit)
- Rollback procedure tested (intentional bad-merge scenario recovers via `git reset --hard`)

---

## §10. Vendored Skill Wrapper Strategy (R5 final)

### Why wrapper, not patching

Patching vendored sources creates upstream-sync fragility: any rename or refactor upstream breaks patches silently. Wrappers keep vendored source pristine; SUNCO owns the adapter layer.

### Architecture

```
Impeccable skill execution path:

  User: /sunco:ui-phase N --surface web
   ↓
  ui-phase-web.md workflow
   ↓
  spawn sunco-ui-researcher-web agent
   ↓
  agent invokes vendored Impeccable skill (source/skills/impeccable/SKILL.md)
   ↓
  BEFORE skill runs: context-injector.mjs reads DESIGN-CONTEXT.md,
                    provides content as if from .impeccable.md
   ↓
  skill runs with injected context (believes .impeccable.md exists)
   ↓
  skill outputs → captured by wrapper → normalized to SUNCO format
   ↓
  written to .planning/domains/frontend/UI-SPEC.md
```

### Upstream sync procedure

```bash
cd ~/.claude/sunco/references/impeccable
git remote add upstream https://github.com/pbakaus/impeccable || true
git fetch upstream
git checkout -b sync-attempt-$(date +%s)
git merge upstream/main
# Vendored source may change; wrapper may need updating
# Run wrapper e2e tests
node wrapper/context-injector.mjs --test
node wrapper/detector-adapter.mjs <fixture> <out>
# If tests pass, merge back; if fail, inspect upstream changes and update wrapper
```

### Invariants

- `source/` and `src/` directories are byte-identical to upstream at pinned SHA
- All SUNCO-side modification lives in `wrapper/`
- Wrapper e2e tests must pass before merging an upstream sync
- UPSTREAM.md always reflects currently-vendored SHA

---

## §11. Attribution Boilerplate

### `references/impeccable/SUNCO-ATTRIBUTION.md`

```markdown
# Impeccable Vendored Distribution — SUNCO Attribution

This directory contains a vendored copy of pbakaus/impeccable,
licensed under Apache License 2.0.

## Upstream
- Repository: https://github.com/pbakaus/impeccable
- Original author: Paul Bakaus (Copyright 2025)
- Pinned commit: see UPSTREAM.md
- License: Apache License 2.0 (see LICENSE)

## Secondary attribution
Impeccable builds on Anthropic's frontend-design skill
(Copyright 2025 Anthropic, PBC). See NOTICE.md for full text.

## SUNCO modifications
**None to vendored source.** SUNCO integrates Impeccable via an
adapter layer (see wrapper/README.md) that injects SUNCO canonical
design context at runtime. The source/ and src/ directories are
byte-identical to upstream at the pinned commit.

## Standalone use
To use Impeccable outside SUNCO, copy source/ and src/ directories
to any Claude Code-compatible harness. The wrapper/ directory is
SUNCO-specific.
```

### `references/backend-excellence/NOTICE.md`

```markdown
# Backend Excellence — Attribution

This reference pack is original SUNCO work (clean-room authorship),
structurally inspired by Paul Bakaus's pbakaus/impeccable (Apache-2.0).

## What is inspired
- 7–8 reference-domain structure
- Deterministic detector + review-agent wrapper pattern
- Anti-pattern vocabulary + code examples as authoritative style

## What is NOT derived
- All content (anti-patterns, principles, code examples) is original
- No text, no code snippets, no figures copied from Impeccable
- Backend-specific domain coverage chosen independently

## License
<MIT or Apache-2.0 — SUNCO selects> (see LICENSE)
```

---

## §12. Schema Definitions

### Schema registry in `schemas/`

All SPEC.md files (UI/API/DATA/EVENT/OPS) contain prose + one required SPEC-BLOCK:

```markdown
<!-- prose sections free-form for humans -->

<!-- SUNCO:SPEC-BLOCK -->
```yaml
# structured, machine-readable; validates against corresponding schema
```
<!-- /SUNCO:SPEC-BLOCK -->

<!-- more prose allowed below/above -->
```

### Schema versioning (per BS1)

```markdown
<!-- spec_version: 1 -->
```
Top of every SPEC.md. Schema migration CLI is v2 scope; v1 documents manual migration in migration-v0.X.md when schema evolves.

### Key schemas (minimum fields)

**`ui-spec.schema.json`** (web surface):
```json
{
  "version": 1,
  "layout": {...},
  "components": [...],
  "states": [...],
  "interactions": [...],
  "a11y": {...},
  "responsive": {...},
  "motion": {...},
  "copy": [...],
  "anti_pattern_watchlist": ["<rule-names>"],
  "design_system_tokens_used": [...],
  "endpoints_consumed": [{"ui_ref": "...", "method": "...", "path": "..."}],
  "error_states_handled": [{"api_code": "...", "ui_state": "..."}]
}
```

**`api-spec.schema.json`**:
```json
{
  "version": 1,
  "endpoints": [{"method": "...", "path": "...", "request_schema": "...", "response_schema": "...", "errors": [...], "auth": "...", "idempotency": "..."}],
  "error_envelope": {...},
  "versioning_strategy": "url-major|header|none",
  "rate_limiting": {...},
  "auth_requirements": {...},
  "anti_pattern_watchlist": [...]
}
```

**`cross-domain.schema.json`** — see §8 Phase 4.1.

**`finding.schema.json`** — see §8 Phase 4.2.

---

## §13. v1 Out-of-Scope & v2 Candidates

### v1 Out-of-Scope (explicit, documented)

- Native/mobile UI surface (stub only)
- `.impeccable.md` export command (YAGNI)
- `--surface auto` detection (explicit-only discipline)
- Backend deterministic detector expansion beyond 7 rules
- Multi-backend phase merge (calling backend-phase twice overwrites, does not merge)
- `backend-phase --surface cache|ml|realtime` (future surfaces reserved in naming only)
- Actual WRAP conversion of `api-design-review` / `database-design-review` skills (COEXIST in v1)
- Multi-harness install paths (per BS4) — v1 targets `~/.claude/sunco/` (Claude Code) only
- Schema migration CLI (`/sunco:migrate-spec`) — v2 scope

### v2 Candidates (document-only)

- `--surface auto` with pre-confirmation prompt
- `--strict-contracts` flag promoting MEDIUM/LOW to HARD BLOCK
- Mobile/native UI surface (ui-phase-native full implementation)
- Multi-backend phase merge
- Cross-repo contract sync (monorepo FE/BE split)
- Codex/Cursor/Antigravity harness porting
- Schema migration tooling

---

## §14. Implementation Order

```
Week 1      M1 (1.1 → 1.2 → 1.3)               Foundation
Week 2-3    M2 (2.1 → 2.2 → 2.3 → 2.4)         Frontend Fusion
Week 3-5    M3 (3.1 parallel 4-way; 3.2-3.6)   Backend Excellence [parallel with M2]
Week 6      M4 (4.1 → 4.2)                     Cross-Domain
Week 7      M5 (5.1 → 5.2)                     Rollout

7 weeks 1-person. 4 weeks 2-person (one on M2, one on M3).
```

**Parallelization notes:**
- M2 Phase 2.2 and M3 Phase 3.3 both touch `discuss-phase.md`. Conflict prevention: Phase 1.3 inserts domain-switch skeleton (per R3). M2/M3 each fill only their assigned slot. Tested via parallel-branch merge drill in Phase 5.2 fixtures.
- M3 Phase 3.1 (8 reference docs) can be 4-way parallel (2 refs per person). References are independent.

---

## §15. Success Criteria (Done for v1 release)

1. `/sunco:ui-phase --surface cli` (no changes): output byte-identical to pre-integration baseline (regression fixture passes)
2. `/sunco:ui-phase N --surface web`: requires DESIGN-CONTEXT.md; produces schema-valid UI-SPEC.md with SPEC-BLOCK
3. `/sunco:ui-review N --surface web`: produces IMPECCABLE-AUDIT.md + UI-REVIEW.md; detector fires ≥7 Impeccable rules on fixture corpus
4. `/sunco:backend-phase --surface {api|data|event|ops}`: all 4 produce corresponding SPEC.md with schema-valid SPEC-BLOCK
5. `/sunco:backend-review --surface *`: all 4 produce BACKEND-AUDIT.md sections; deterministic detector fires all 7 rules on fixtures
6. Phase with `domains: [frontend, backend]`: cross-domain gate fires 4 check types with correct severity (HIGH/HIGH/MED/LOW); proceed-gate enforces severity × state matrix
7. Self-dogfood: sunco-harness repo has `.planning/domains/backend/API-SPEC.md`, ≥5 findings processed
8. Attribution: `find references -name "LICENSE"` returns ≥2 (Impeccable + backend-excellence); `find references -name "NOTICE.md"` returns ≥2
9. 8 COEXIST commands (design-review, cso, etc.): 0 regression (verified by existing tests)
10. Docs: `docs/impeccable-integration.md`, `docs/backend-excellence.md`, `docs/migration-v0.X.md` all present and cover stated sections
11. Upstream sync drill: intentionally merge upstream/main into vendored, run wrapper e2e tests, confirm pass OR identify sync-required change
12. Recovery drill: intentional dogfood failure, `git reset --hard sunco-pre-dogfood`, full recovery to baseline

---

## §16. Risks & Mitigations

| ID | Risk | Impact | Mitigation |
|----|------|--------|-----------|
| R-01 | Impeccable upstream large breaking change | M5 dogfood fails | UPSTREAM.md pinned SHA; quarterly sync review; wrapper e2e test suite blocks sync-merge unless green |
| R-02 | 8 backend reference docs bottleneck in M3 | 3-week slip | Parallel authorship (2 refs × 4 authors); strict 1500-word minimum (not target) to avoid over-scoping |
| R-03 | Cross-domain gate false positive | User friction, distrust | LOW severity + easy dismissal; MEDIUM requires rationale ≥50 chars; verify-gate explicitly surfaces "dismissible" status |
| R-04 | Wrong `--surface` invocation (e.g., web on Ink project) | UI-SPEC garbage output | Sanity pre-check warns; explicit-only means user owns the choice; detector failure is graceful per BS5 |
| R-05 | Upstream sync conflict | Wrapper out of sync | `wrapper/` directory SUNCO-owned; vendored source pristine; any conflict is in SUNCO code, resolvable |
| R-06 (BS2) | Agent context budget overflow | researcher mid-task truncation | 3-stage research (ref-load → outline → write); per-spawn token logging; 30k ceiling |
| R-07 (BS3) | Dogfood failure breaks sunco repo | Workflow interruption | Pre-dogfood git snapshot branch; documented reset procedure; Phase 5.2 tests recovery drill |
| R-08 (BS4) | Users on non-Claude-Code harnesses blocked | Limited reach | Explicit v1 Out-of-Scope; v2 roadmap slot for multi-harness porting |
| R-09 (BS5) | Node.js missing for detector | Detector skip | Graceful fallback; LLM critique still runs; warning logged |
| R-10 | Schema evolution breaks existing SPEC.md | User projects fail validation | v1: manual migration docs in migration-v0.X.md; spec_version field; v2: `/sunco:migrate-spec` CLI |
| R-11 | discuss-phase.md parallel-edit merge conflict | Dev velocity hit | Phase 1.3 pre-inserts skeleton slots (R3); M2/M3 confined to assigned slots; Phase 5.2 tests parallel merge |

---

## §17. 6-Dimension Self-Review (inline gate, with fix-log citation)

Per SUNCO brainstorming hard gate (superpowers convention). Per vendored SKILL.md warning — *"a low score that is written down but not acted on is worse than not scoring"* — this review maps each dimension to the ping-pong round(s) that applied pressure to it, and cites the revision(s) that merged as a result. The 4-round cross-model cycle **is** this spec's fix-log. No dimension reached this gate without being pressured by an independent reviewer first.

### 1. Clarity — are all decisions unambiguous?
**Pass. Pressure applied by:** R4 CC sign-off (demanded concrete §-level ACCEPT/FLAG/REVISE verdicts).
**Fixes merged:** R1 (ui-review explicit `--surface` — removed "default=web for modifications" ambiguity); R2 (SPEC-BLOCK fenced YAML — replaced "LLM extracts from prose" ambiguity with deterministic grep+parse).
**Residual:** backend-reference word count band (1500–3000), CI runner specifics. Both implementation-level.

### 2. Completeness — any gaps requiring design-level executor decisions?
**Pass. Pressure applied by:** R4 CC/Codex Blind Spots sections (7 gaps identified across both).
**Fixes merged:** BS1 (schema versioning + migration policy), BS2 (agent token budget ceiling + 3-stage research), BS3 (dogfood rollback drill), BS4 (multi-harness scope explicit), BS5 (Node.js dependency graceful fallback).
**Residual:** exact agent prompt text for 4 new agents — executor composes per existing SUNCO agent conventions (template: `sunco-ui-researcher.md`). Implementation-level.

### 3. Feasibility — realistic 7-week / 4-week timeline?
**Pressure applied by:** R4 Codex §13 FLAG (M4 cannot start until M2+M3 schemas stable); R4 CC §13 FLAG (discuss-phase.md parallel-edit conflict).
**Fixes merged:** R3 (Phase 1.3 pre-inserts discuss-phase skeleton → M2/M3 parallelize without conflict); §14 explicit dependency graph.
**Residual:** M3 Phase 3.1 (8 references) is still the critical-path risk; R-02 mitigates via 4-way parallel authorship.

### 4. Risk — known risks identified with mitigations?
**Pressure applied by:** Codex R4 Blind Spot #1 (CLI install path divergence); CC R4 Blind Spots #1–5 (schema migration, token budget, dogfood recursion, patchset fragility, downgrade cleanup).
**Fixes merged:** §16 R-01 through R-11 enumerated. R5 (wrapper-not-patch) eliminates CC Blind Spot #4 entirely. BS3/BS4 merged as risks with explicit mitigation.
**Residual:** downgrade cleanup deferred to v2 (documented in §13 Out-of-Scope).

### 5. Scope — v1 boundaries tight?
**Pressure applied by:** R3/R4 Codex (rejected `/sunco:frontend-export --impeccable` as YAGNI); R4 both reviewers questioned whether backend detector should claim deterministic status for context-dependent smells.
**Fixes merged:** R5 wrapper-not-patch defers upstream-tracking cost; §13 Out-of-Scope explicitly lists 9 excluded items + 7 v2 candidates; detector limited to 7 high-confidence rules with remainder labeled `requires-human-confirmation`.
**Residual:** none. Scope is demonstrably narrower than original ambition from round 1.

### 6. Traceability — every decision traced to ping-pong round or judge call?
**Pressure applied by:** Self-review gate requirement itself; R4 forced per-section sign-off preventing invisible consensus.
**Fixes merged:** Appendix B (Ping-Pong Round Trace) maps every M1.x principle and R1–R6 revision to originating round. §11 Attribution traces Impeccable authorship chain (Bakaus → Anthropic frontend-design skill → Apache-2.0 license verification in R4 Codex license check).
**Residual:** none verified by design — every locked decision references the round that locked it.

### Gate verdict: **PASS**

No new fixes surfaced during this self-review beyond what R1–R6 and BS1–BS5 already merged. This is not ceremonial: the fix-log is the 4-round trace, not a post-hoc pass/fail sticker. Spec ready for user review.

---

## §18. Next Steps (post-approval)

1. **User review** — read through §1–§17. Approve or request changes.
2. **On approval:**
   ```bash
   cd ~/SUN/sunco-harness
   /sunco:new --from-preflight docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md
   ```
3. **SUNCO creates:**
   - `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md` seeded from this spec
   - 17 phase directories scaffolded
   - Phase 1.1 ready for `/sunco:discuss 1.1` → `/sunco:plan 1.1` → `/sunco:execute 1.1`
4. **Execution cadence:**
   - Commit per phase completion
   - `/sunco:verify` after each phase
   - `/sunco:proceed-gate` before milestone transitions
   - Dogfood check at M5 Phase 5.2

---

## Appendix A — Disposition Table (§M1.3 authoritative)

| Command | Disposition | Notes |
|---------|-------------|-------|
| `/sunco:ui-review` | WRAP (immediate, web surface only) | Phase 2.4; preserves cli surface unchanged |
| `/sunco:api-design-review` | COEXIST → WRAP (M3+ post-v1) | Not in v1 scope; continues existing behavior |
| `/sunco:database-design-review` | COEXIST → WRAP (M3+ post-v1) | Same |
| `/sunco:design-review` | COEXIST | Product/design critique, different layer |
| `/sunco:cso` | COEXIST | OWASP/STRIDE audit, procedural |
| `/sunco:enterprise-security-audit` | COEXIST | Compliance scope exceeds backend-excellence |
| `/sunco:dependency-audit` | COEXIST | Supply-chain specific |
| `/sunco:design-pingpong` | COEXIST | Cross-model primitive, domain-agnostic |

DEPRECATE count: 0. Philosophy: wrappers can be added without breaking user muscle memory; deletion requires usage data.

---

## Appendix B — Ping-Pong Round Trace

| Round | Key decision | Source |
|-------|--------------|--------|
| R1 | Impeccable vs SUNCO file conflict overblown; real issue is command namespace | CC+Codex converged |
| R2 | Disposition table v1 (DEPRECATE vs WRAP vs COEXIST) | Judge synthesis |
| R2–R3 | Adapter single-canonical (DESIGN-CONTEXT.md) vs dual-file | Judge resolved (single, export deferred) |
| R3 | Surface flag vs new command | Dispatcher pattern (umbrella + internal split) |
| R3 | Backend counterpart structure | Clean-room, 7-8 references, detector high-confidence only |
| R4 | Q4 sanity warning addition | CC condition accepted |
| R4 | Q5 backend command naming (A/B/C) | Both chose B: backend-phase --surface api|data|event|ops |
| R4 | Q6 FAIL/WARN vs finding-severity | CC's finding-based model; Codex's state-lifecycle formalization merged |
| R4 sign-off | 6 revisions + 5 blind-spot additions | This spec reflects all |

---

**End of specification.** Spec-doc ready for `/sunco:new --from-preflight` on user approval.

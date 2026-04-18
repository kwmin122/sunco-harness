# Phase 41 — ui review wrap

- **Spec alias**: v1.4/M2.4
- **Milestone**: M2 Frontend Fusion
- **Source spec**: `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §6 Phase 2.4 (lines 367-394)
- **Requirement**: IF-07 (see `.planning/REQUIREMENTS.md` § v1.4)
- **Status**: Gate 41 closed 2026-04-18 — 6 axes locked, entering execution
- **Dependencies**: Phase 38 (wrapper skeleton) + Phase 40 (behavioral workflow precedent)
- **Gate kind**: Focused Gate (scope-limited). Full-gate not needed — Gate 2 covers
  vendoring/license/pristine; Focused Gate 40 covers wrapper invocation/schema.

## Gate 41 Locked Decisions

### A1 — Surface flag policy (R1 regression boundary)

| Invocation | Path | Regression contract |
|---|---|---|
| `/sunco:ui-review N` (no flag) | Existing CLI behavior | **byte-identical** to pre-Phase-41 output |
| `/sunco:ui-review N --surface cli` | Explicit CLI (same as no flag) | byte-identical |
| `/sunco:ui-review N --surface web` | Impeccable WRAP path (new) | hot — Phase 41 deliverable |
| `/sunco:ui-review N --surface native` | **Explicit error** | per R4 (explicit-only triggers) |
| Any unknown `--surface <value>` | **Explicit error** | per R4 |

### A2 — Agent naming / responsibility split (Option B)

Two agents, clear responsibility split:

- `sunco-ui-auditor` (existing, **intact**) — CLI 6-pillar visual auditor.
  No modification in Phase 41. Preserves R1 regression guarantee.
- `sunco-ui-reviewer` (**new**, Phase 41 scope) — web/Impeccable review summarizer.
  Loads Impeccable reference heuristics, produces Impeccable audit summary
  and critique notes. Used exclusively by `--surface web` path.

Rationale: spec §6 L381 literally says "sunco-ui-reviewer agent extension".
Creating a new agent (not extending auditor) avoids touching the CLI-path agent
and keeps regression boundary clean.

### A3 — Detector execution boundary (target resolution + graceful fallback)

**Target resolution (conservative default):**
- Default target = project root
- Exclusions (hard): `.planning/`, `node_modules/`, `packages/cli/references/impeccable/`
- If phase context declares a UI source path, use that (future optional)
- **Never** scan vendored references or installed runtime (escalate trigger)

**Invocation:**
```
node packages/cli/references/impeccable/wrapper/detector-adapter.mjs <projectRoot> <outPath>
```
Internally the adapter spawns the vendored detector:
```
node packages/cli/references/impeccable/src/detect-antipatterns.mjs <target...> --json
```

**Graceful fallback (G8 + BS5):**

| Scenario | Behavior | IMPECCABLE-AUDIT.md contents |
|---|---|---|
| Node missing | warn + continue LLM critique | `detector_status: unavailable`, `reason: node-not-found` |
| Detector spawn crash | warn + continue | `detector_status: unavailable`, `reason: detector-crash` |
| Exit code ∉ {0, 2} | warn + continue | `detector_status: unavailable`, `reason: detector-abnormal-exit` |
| JSON parse failure | warn + continue | `detector_status: unavailable`, `reason: json-parse-failed` |
| Exit 0 (clean) | success | `detector_status: ok`, `findings: []` |
| Exit 2 (findings) | success | `detector_status: ok`, normalized findings |

All fallback scenarios: **exit code 0**, UI-REVIEW.md **must still be generated**
(LLM critique is not blocked by detector unavailability). No silent success —
`detector_status` + `reason` must appear explicitly in IMPECCABLE-AUDIT.md.

### A4 — Dual output contract + R6 scope boundary

**Outputs:**

| File | Location | Scope |
|---|---|---|
| `IMPECCABLE-AUDIT.md` | `.planning/domains/frontend/` | **project-level** (not per-phase) |
| `UI-REVIEW.md` | `.planning/phases/<NN>-<slug>/` | **per-phase** (existing path) |

- `.planning/domains/frontend/` created automatically if missing.
- `UI-REVIEW.md` preserves existing 6-pillar scoring **intact** + appends
  an Impeccable summary wrap section at the end.
- `IMPECCABLE-AUDIT.md` contains: detector_status + reason, raw normalized
  findings (severity + file:line + message), and LLM critique notes.

**R6 scope boundary (hard):**
- **Phase 41 delivers:** severity (HIGH/MEDIUM/LOW) + file:line anchors + message
- **Phase 41 does NOT deliver:** finding-lifecycle state (open/resolved/dismissed)
  — that is Phase 48/49 M4 scope.

Severity derivation (since the vendored detector has no severity field):
- category `slop` → `HIGH` (AI-tell anti-patterns)
- category `quality` / `typography` / `accessibility` / `color` / `contrast` → `MEDIUM`
- all other categories → `LOW`

**Plan-drift cleanup:** `detector-adapter.mjs` header comments (L8-11 and L31-33)
currently imply "R6 severity × state convergence in Phase 41". This is a drift
with the Gate 41 scope lock above. Phase 41 implementation **must** correct
those comments so that "state lifecycle" is clearly labeled M4/Phase 48.

### A5 — Adapter API extension (Phase 38 skeleton → Phase 41 full)

**Existing exports (Phase 38 skeleton, keep):**
- `normalizeFindings(findings)` — JSON → markdown section
- `DetectorUnavailableError` sentinel (G8 contract)

**New exports (Phase 41):**
- `runDetector(projectRootOrSrc)` — spawn vendored detector, parse JSON, translate
  detector-native shape `{antipattern, category, file, line, snippet, importedBy?}`
  → adapter shape `{severity, rule, message, file, line}`. Throws
  `DetectorUnavailableError` with `reason` cause on any failure path.
- `writeAuditReport(result, outPath)` — takes `{status, reason?, findings}`,
  ensures output directory, writes IMPECCABLE-AUDIT.md with `detector_status`
  + `reason` frontmatter-ish header, normalized findings body.

**Hard constraints (R5 wrapper-not-patch):**
- `packages/cli/references/impeccable/src/detect-antipatterns.mjs` **NEVER modified**.
- All translation / severity derivation / output formatting lives in the wrapper.

**`--test` harness extension:**
- Phase 38 skeleton checks (8) remain passing.
- New cases (≥3): (a) fallback path (Node-missing / crash simulated via spawn
  override or doc-level contract check), (b) category→severity mapping, (c)
  writeAuditReport produces file with detector_status key.

### A6 — Regression / smoke / pristine verification

**Regression guarantee (R1):**
- `/sunco:ui-review N` (no flag) produces byte-identical output vs pre-Phase-41.
- Existing Sections 1-15 = **184 assertions** unchanged.

**Smoke Section 16 additions:**
- `--surface` flag dispatch present in both `commands/sunco/ui-review.md`
  and `workflows/ui-review.md`.
- `IMPECCABLE-AUDIT.md` output path template: `.planning/domains/frontend/`.
- `UI-REVIEW.md` output path template: `.planning/phases/<PADDED>-<slug>/` preserved.
- `sunco-ui-reviewer.md` agent file exists under `packages/cli/agents/`.
- `detector_status` + `reason` keys documented in wrapper + command.
- `--surface native` / unknown value → error contract documented.
- Category→severity mapping documented (slop=HIGH).

**Pristine verification:**
- `git diff packages/cli/references/impeccable/src/` → **zero bytes changed**.
- `context-injector.mjs --test` → 10/10 unchanged.
- `detector-adapter.mjs --test` → Phase 38 (8) + Phase 41 new cases all passing.

## Implementation Note — BS2 debt closure (optional, NOT a gate condition)

Phase 40 BS2 (runtime token logging) debt closure is **optional** in Phase 41
and must not block detector integration. If generated, use deterministic
timing/degrade info only:
- Location: `.planning/phases/41-ui-review-wrap/TOKEN-LOG.md`
- Contents: wrapper spawn time, normalize time, fallback-occurred flag,
  status string — all captured via `performance.now()` / `process.hrtime`.
- Do **not** attempt LLM token accounting unless trivially available.
- If not cheap to capture on first dogfood, defer to next Phase 41 invocation
  or to Phase 48/M4 with explicit scope.

## Escalate Triggers (halt + re-relay if any fires)

1. M4 finding-lifecycle state (open/resolved/dismissed) pulled into Phase 41
2. `~/.claude/sunco` runtime mutation
3. Vendored source (`packages/cli/references/impeccable/src/`) mutation (R5)
4. Install pipeline change (beyond existing G7 policy)
5. Detector target resolution requires scanning vendored references or
   installed runtime

## Out of Scope (hard)

- Phase 48/49 M4 finding-lifecycle
- `sunco-ui-auditor` modifications (existing CLI path must stay byte-identical)
- UI-SPEC.md schema changes (Phase 40 locked output)
- `ui-phase.md` router changes (Phase 36 R1)
- Backend work (Phase 42+ M3)
- `install.cjs` changes (Gate 2 G7 policy unchanged)
- Phase 999.1 PIL backlog

## Done When

- `/sunco:ui-review N` (no flag) byte-identical — pre-Phase-41 fixture diff = 0
- `/sunco:ui-review N --surface web` emits both files at contracted paths
- `/sunco:ui-review N --surface native` errors explicitly (R4)
- Detector unavailable (BS5) → warn + IMPECCABLE-AUDIT.md with detector_status/reason
  + LLM critique still runs
- smoke 184 unchanged + Section 16 additions all passing
- injector --test 10/10 unchanged
- adapter --test Phase 38 (8) + Phase 41 new (≥3) all passing
- vendored detector source byte-identical (git diff = 0)
- Phase 41 ships as single atomic commit

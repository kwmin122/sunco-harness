# Phase 43 — backend detector rules

- **Spec alias**: v1.4/M3.2
- **Milestone**: M3 Backend Excellence
- **Source spec**: `docs/superpowers/specs/2026-04-18-sunco-impeccable-fusion-design.md` §7 Phase 3.2
- **Requirement**: IF-09 (see `.planning/REQUIREMENTS.md`:285)
- **Status**: **Populated 2026-04-19.** Gate 43 (Backend Deterministic Detector) passed GREEN-CONDITIONAL; 8 convergent conditions absorbed (see Judge relay summary).

## Goal

Author a deterministic-only backend smell detector with exactly 7 high-confidence rules (spec-locked), emitting JSON findings validated by fixture corpus. No LLM, no heuristic rules, no auto-wiring. Standalone CLI, consumed by Phase 47/M3.6 backend-review agents later. "거짓말 덜 하는 detector" — scope creep 금지.

## Scope in

- `packages/cli/references/backend-excellence/src/detect-backend-smells.mjs` — detector CLI (single file)
- `packages/cli/references/backend-excellence/fixtures/positive/*` — per-rule must-trigger fixtures
- `packages/cli/references/backend-excellence/fixtures/negative/*` — per-rule must-not-trigger fixtures (incl. the 5 required safe cases from Gate 43 A3)
- `packages/cli/bin/smoke-test.cjs` — add Section 18; remove Section 17j forward-reference check (replaced by Section 18 detector-exists check)
- README.md status-line update (Phase 43 — detector populated) — does not touch reference docs

## Scope out (hard)

- **Rule 8+** — spec §13 lists "Backend deterministic detector expansion beyond 7 rules" as v1 out-of-scope
- **Heuristic rules** (N+1, authz-after-fetch, idempotency, circuit breaker, inconsistent error envelope, architecture smell, over-fetching, soft-delete tombstones, etc.) — Phase 47/M3.6 + beyond
- LLM / agent invocation inside detector (no @anthropic-ai, no openai, no ai SDK imports)
- Wiring into any skill/command/workflow — Phase 47 activates, Phase 43 ships standalone
- `backend-review-*` / `backend-phase-*` workflow modification — Phase 44–47
- **Phase 42 reference doc substantive edits** — BLOCKED in Phase 43 scope; typo discovery → separate mini-commit (`docs(refs): typo fix in <file>`) off the Phase 43 atomic commit
- Frontend Impeccable detector / injector (M2 frozen: 40 injector cases + 22 adapter cases must stay byte-identical)
- Vendored Impeccable source under `references/impeccable/source/` and `references/impeccable/src/` (R5 hard)
- Phase 37 backend dispatcher / R3 marker
- `install.cjs` changes
- PIL 999.1 backlog
- External `finding.schema.json` file — inline §7 schema sufficient for v1 (§8 Phase 4.2/M4 own the file schema)

## Key decisions (Gate 43 outcomes)

### A1. Rule set lock (GREEN)

Exactly 7 rules, spec §7 verbatim, no additions:

| Rule | Severity (default) |
|------|-------------------|
| `raw-sql-interpolation` | HIGH |
| `missing-timeout` | HIGH |
| `swallowed-catch` | HIGH |
| `any-typed-body` | HIGH |
| `missing-validation-public-route` | **MEDIUM** (Gate 43 condition 1) |
| `non-reversible-migration` | HIGH |
| `logged-secret` | HIGH |

Severity lowered from HIGH to MEDIUM for `missing-validation-public-route` because validation can live in middleware/framework plugin/global pipe/OpenAPI layer not visible to the single-file scan.

### A2. Detection strategy (GREEN-CONDITIONAL — 3 conditions absorbed)

**Parser choice:** `@typescript-eslint/typescript-estree` (v8.57.2, already a dev-dep) for all JS/TS file kinds (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`). Rationale: single parser covers TS type annotations (needed for `any-typed-body`) plus vanilla JS, avoids dual-parser complexity. Acorn available as fallback (not used in v1).

**Per-rule strategy:**

1. `raw-sql-interpolation`: walk `TemplateLiteral` nodes; if raw content (joined quasis) contains SQL kw `/\b(SELECT|INSERT|UPDATE|DELETE|WHERE|FROM)\b/i` AND has ≥1 expression, fire.

2. `missing-timeout` (**condition 3 absorbed**): walk `CallExpression` whose callee matches:
   - `fetch(...)`
   - `axios.{get,post,put,delete,patch,request,head,options}(...)`
   - `http.request(...)` / `https.request(...)`
   Inspect the options arg (last ObjectExpression arg). Recognize ANY of these as timeout-present:
   - `timeout: <expr>` property
   - `signal: <expr>` property (AbortSignal)
   - Value whose source text contains `AbortSignal.timeout(` (nested)
   If NONE present → fire.

3. `swallowed-catch`: walk `CatchClause`. Fire if `param?.name` is unused (or the catch body satisfies ALL):
   - `body.body.length === 0` (empty block), OR
   - single `ReturnStatement` with no argument, OR
   - single `ReturnStatement` whose argument is a bare `null`/`undefined` literal

4. `any-typed-body` (**condition 2 absorbed**): walk `FunctionDeclaration` / `FunctionExpression` / `ArrowFunctionExpression`. For each, if first param has `TSTypeAnnotation` with `TSAnyKeyword` AND the function body does NOT contain a `CallExpression` to a known validator (`zod.parse`/`zod.safeParse`, `ajv.validate`, `joi.validate`/`joi.object().validate`, `yup.validateSync`/`yup.validate`, `class-validator.validate`/`plainToInstance`+`validate`), fire with message "untyped or unvalidated request body".

5. `missing-validation-public-route` (**conditions 1 + A3 condition 5 absorbed**): walk `CallExpression` where callee is:
   - `app.{get,post,put,delete,patch,all}` or `router.{get,...}` (Express)
   - `fastify.{get,post,...}` or `server.{get,...}` (Fastify) — Fastify schema option recognized via object arg with `schema` key → treated as validation-present
   - `koa-router` style `router.get(path, handler)` — treated same as Express
   If first string-literal path arg does NOT match auth-prefix (default: `/^\/api\/auth|^\/auth|^\/login|^\/signup/i`) AND the handler body contains NO validator call (same validator set as A2.4) AND (for Fastify) options arg has no `schema` key, fire with message "No local validation evidence found for public route", severity MEDIUM.

6. `non-reversible-migration`: file path matches `/\/migrations?\//i`. For `.js`/`.ts`/`.mjs`/`.cjs`: parse AST; fire unless file exports a `down` function (either `export function down`, `export const down = ...`, `module.exports.down = ...`, `exports.down = ...`). For `.sql` files: read text; fire unless file contains regex `/^--\s*(reversible:|expand-contract\b|down\b)/mi` in first 20 lines OR has a `-- down` divider section.

7. `logged-secret`: walk `CallExpression` where callee is:
   - `console.{log,info,warn,error,debug}`
   - MemberExpression whose property is one of `{log,info,warn,error,debug,trace,fatal}` (matches most logger libs: winston, pino, bunyan)
   For each arg that is an `ObjectExpression`, scan keys; fire if any key (as `Identifier.name` or `Literal.value`) matches `/^(authorization|api[_-]?key|password|token|secret|credential)$/i`. Also fire if arg is a `TemplateLiteral`/`Literal` whose source contains the `authorization|api_key|password` token as a string.

**Parse-failure policy:** if a file fails to parse, skip it (warn in stderr), do NOT fire findings. Conservative over noisy.

### A3. False-positive discipline (GREEN-CONDITIONAL — absorbed)

Per rule: ≥1 positive fixture + ≥1 negative fixture. Zero known FPs on fixture set is the gate. No real-codebase sampling required for v1 (scope control).

**Required negative fixtures (Gate 43 condition 4):**
- `missing-timeout` negative: `fetch(url, { signal: AbortSignal.timeout(5000) })` + `axios.get(url, { signal: controller.signal })`
- `any-typed-body` negative: `(req: any, res) => { const body = schema.parse(req.body); ... }`
- `missing-validation-public-route` negative: Express middleware-validated route + Fastify route with `{ schema: {...} }`
- `raw-sql-interpolation` negative: `db.query('SELECT * FROM users WHERE id = $1', [userId])` parameterized
- `logged-secret` negative: `logger.info({ userId, action, authorization: '[REDACTED]' })` — redaction pattern

**Required positive fixture framework spread (Gate 43 condition 5):**
- `missing-validation-public-route` positive MUST span ≥2 frameworks: Express + Fastify (minimum). Koa not required.

### A4. Output JSON schema + BS2 status (GREEN-CONDITIONAL — condition 6 absorbed)

**Output (spec §7 verbatim, lines 470–491):**
```json
{
  "findings": [
    {
      "rule": "<rule-id>",
      "severity": "HIGH|MEDIUM|LOW",
      "kind": "deterministic",
      "file": "<relative-path>",
      "line": <1-based>,
      "column": <1-based>,
      "match": "<source-excerpt max 200 chars>",
      "fix_hint": "<rule-specific fix guidance>"
    }
  ],
  "meta": {
    "files_scanned": <int>,
    "duration_ms": <int>,
    "rules_enabled": ["<7 rule ids>"],
    "detector_version": "1.0.0"
  }
}
```

`--json` flag emits this; default CLI output is a human-readable table. `duration_ms` captured via `performance.now()` delta.

**BS2 status (condition 6):** N/A for this surface. Phase 43 detector is no-LLM, so token/agent-budget accounting does not apply. `meta.duration_ms` records runtime perf as an **independent concern**, not as a BS2 closure. BS2 remains open for LLM-agent surfaces (first true closure point = first LLM-powered agent dogfood, e.g., backend-researcher @ Phase 45 or ui-researcher-web @ user invocation).

### A5. Clean-room authorship (GREEN)

Zero port/translate from ESLint plugins, SonarQube rules, Semgrep, or other static analyzers. Rule IDs and messages SUNCO-original (name overlap with industry terms like `raw-sql-interpolation` is unavoidable and acceptable — spec §7 chose these names; implementation/fixtures/messages are original). AST visitor pattern is standard estree walk (public CS knowledge, non-copyrightable). NOTICE.md already declares this.

### A6. Explicit-only triggers / R4 discipline (GREEN)

Standalone CLI:
```
node packages/cli/references/backend-excellence/src/detect-backend-smells.mjs <target-dir> [--json]
node packages/cli/references/backend-excellence/src/detect-backend-smells.mjs --test
```

- No `/sunco:*` / `/gsd:*` auto-wiring
- Phase 37 dispatcher untouched
- No workflow/command/skill invocation
- `--test` mode runs fixture corpus and exits 0 (all pass) / 1 (any fail)
- No `--schema-dump` flag in v1 (JSON output itself is the schema surface)

Phase 47/M3.6 future wire-up is the explicit-only trigger point, NOT Phase 43.

### A7. Smoke Section 18 / verification (GREEN-CONDITIONAL — fixture-only absorbed)

**Section 17j removal note:** Phase 42 smoke Section 17j (`Phase 43 boundary: no src/detect-backend-smells.mjs stub created in Phase 42`) served as a forward-reference assertion. Phase 43 delivers the detector, so 17j's assertion inverts. Rather than maintain an inverted check in Section 17, Phase 43 **removes 17j** (narrow edit, contained to the forward-reference line) and moves the "detector exists" positive check into Section 18. Sections 17a–17i remain frozen.

**Section 18 checks (fixture-only, no repo-wide scan — Gate 43 condition 8):**

1. `src/detect-backend-smells.mjs` exists and is executable (`X_OK`)
2. `--test` mode exit code === 0 (all fixtures pass)
3. Each of the 7 rules has ≥1 positive fixture that fires (reported in `--test` output)
4. Each of the 7 rules has ≥1 negative fixture that does NOT fire
5. `missing-validation-public-route` positive fixtures span ≥2 frameworks (Express + Fastify)
6. `--json` run against `fixtures/negative/` directory emits valid JSON parseable by `JSON.parse`
7. `--json` output has all 4 `meta` fields: `files_scanned`, `duration_ms`, `rules_enabled`, `detector_version`
8. `meta.rules_enabled.length === 7` and matches the 7 rule IDs
9. `meta.detector_version === "1.0.0"`
10. Empty-dir scan: `--json` on `fixtures/empty/` → `findings: []`, `meta.files_scanned: 0`
11. Nonexistent target: exit code ≠ 0, structured error emitted
12. Clean-room imports: `detect-backend-smells.mjs` has no `require|import` of `eslint`, `@sonarsource`, `semgrep`, `@anthropic-ai`, `openai`, or `ai` (Vercel AI SDK)

Target: Section 17 current count (35) unchanged; Section 18 adds ~12 checks. Expected total ~260 (248 − 1 for 17j removal + 12 new = 259; + fixture per-rule expansions pushes to ~260).

## Escalate triggers (halt + re-relay if any fires)

1. 8th rule requested / pressure to add ("even trivial")
2. Heuristic rule mixed in (N+1, authz-after-fetch, idempotency, circuit breaker, error envelope, architecture smell, over-fetching, etc.)
3. LLM/agent invocation requested inside detector
4. `backend-review` / `backend-phase` workflow activation requested (Phase 45–47 scope)
5. **Phase 42 reference doc edit beyond spelling/punctuation/markdown-syntax fix** — any wording/semantic change requires stop. Allowed: typo (1–5 char), `**` unmatched fix, broken link target. Disallowed: rewording, principle edits, Detection-label meaning change, anti-pattern reordering. Typo discovery → SEPARATE mini-commit off the Phase 43 atomic commit.
6. Frontend Impeccable detector / injector mutation (M2 frozen: injector 10-pass + adapter 22-pass byte-identical)
7. Vendored Impeccable source mutation (R5 hard)
8. Phase 37 backend dispatcher or R3 marker edit
9. `install.cjs` change
10. PIL 999.1 backlog pull-in
11. External `finding.schema.json` creation (§8 Phase 4.2 M4 scope)
12. Severity lowering for rules other than `missing-validation-public-route` (MEDIUM grant was specific, not a general license)

## Rollback anchor

Pre-Phase-43 HEAD: `5a07155` (Phase 42/M3.1 merged, 2026-04-18). `rollback/pre-v1.3-decision` tag remains.

## Judge relay summary (Gate 43, 2026-04-19)

Two independent judges (Codex backend-review-agent + plan-verifier) converged GREEN-CONDITIONAL. Conditions absorbed (no divergence, no re-relay needed):

1. `missing-validation-public-route` message = "No local validation evidence found for public route" (Codex)
2. `missing-validation-public-route` severity = MEDIUM (Codex)
3. `missing-timeout` recognize `signal`, `AbortSignal.timeout(...)`, wrapper client timeout (Codex)
4. Negative fixtures incl. middleware-validated, `req: any` + zod, fetch+signal, parameterized SQL, redacted logging (Codex)
5. `missing-validation-public-route` positive fixtures ≥2 framework (Express + Fastify) (plan-verifier)
6. BS2 wording = "N/A for no-LLM detector path; duration_ms captures runtime perf (independent concern). BS2 remains open for LLM-agent surfaces." (plan-verifier, Codex both flagged) — **"closed via duration_ms" rejected as inaccurate**
7. Phase 42 reference doc edits = spelling/punctuation/md-syntax only; rewording/semantic changes trigger stop; typos go in separate mini-commit (plan-verifier stricter version chosen over Codex's weaker variant)
8. Smoke Section 18 fixture-only, no repo-wide scan (Codex)

`any-typed-body` message "untyped or unvalidated request body" (Codex) also absorbed under A2.4.

Gate 43 → GREEN (after conditions absorbed). No residual, execution authorized.

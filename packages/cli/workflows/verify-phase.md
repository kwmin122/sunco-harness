# Verify Phase Workflow

7-layer Swiss cheese verification for a completed phase. Each layer catches different failure modes. Layers are designed to have low correlation — a bug that slips through one layer is likely caught by another. Used by `/sunco:verify`.

## Verification-Before-Completion Principle (Superpowers parity)

A phase is not "done" because code was written, the executor exited zero, or the tests compiled. A phase is done when **proof exists** that every requirement it claims to cover is met and the 7-layer cheese actually closes.

Operational rules:

1. **Never mark a phase complete without a fresh verify run.** Old VERIFICATION.md from a prior execution counts as noise, not proof.
2. **`/sunco:execute` completing successfully is not sufficient.** Execution produces code; verification produces proof. The two must be separate artifacts.
3. **Running `/sunco:verify` is the author's responsibility, not the reader's.** Do not hand off a phase to `/sunco:review` or `/sunco:ship` with stale verification output and expect reviewers to re-run it.
4. **Failed layers block downstream commands.** `/sunco:proceed-gate`, `/sunco:ship`, and `/sunco:release` MUST refuse to run when VERIFICATION.md has unresolved findings.
5. **Human eval (Layer 7) is not optional for user-facing features.** Skipping it for subjective quality work silently lowers the proof bar to "it compiles."

If you find yourself tempted to ship without verify, the correct question is not "can we skip it?" but "why did we finish a phase we cannot prove?"

---

## Overview

The 7 layers:

| Layer | Name | Type | Catches |
|-------|------|------|---------|
| 1 | Multi-agent cross-review | AI | Logic errors, quality issues, missing edge cases |
| 2 | Guardrails | Deterministic | Lint, types, test failures, **TDD gate** (see below) |
| 3 | BDD criteria check | Hybrid | Unmet acceptance criteria from PLANs |
| 4 | Permission audit | Deterministic | Scope violations, unauthorized file access, secrets |
| 5 | Adversarial test | AI | Exploitable inputs, race conditions, bypass paths |
| 6 | Cross-model verification | AI (different model) | Same-model blind spots, structural issues |
| 7 | Human eval gate | Human | Final sign-off, subjective quality, UX judgment |

### Layer 2 — TDD gate (Superpowers test-driven-development parity)

For every plan whose frontmatter declares `type: tdd`, Layer 2 now runs a deterministic TDD gate that enforces Red-Green-Refactor discipline:

1. **Test files must be listed.** `files_modified` must include at least one `.test.*` / `.spec.*` or `__tests__/...` path. Missing → `high` severity finding.
2. **Every production file needs a colocated test.** Any non-test file in `files_modified` that has no matching test in the same plan raises a `medium` severity finding.
3. **Test-first commit order.** Where git history exists, the production file's first commit must not be strictly earlier than its test's first commit. Violation → `high` severity finding (blocks verdict).

Plans tagged `type: execute` are unaffected. If a phase has zero `type: tdd` plans the TDD gate is a no-op.

Reference: `packages/cli/references/swiss-cheese.md` for the theoretical basis.

---

## Preparation

Read all phase artifacts:
1. `.planning/phases/[N]-*/[N]-CONTEXT.md` — decisions and acceptance baseline
2. `.planning/phases/[N]-*/*-PLAN.md` — all plans with `done_when` and `files_modified`
3. `.planning/phases/[N]-*/*-SUMMARY.md` — execution results from each plan
4. `.planning/REQUIREMENTS.md` — which requirements this phase covers

Determine which layer(s) to run:
- Default: run all 7 layers
- `--layer N`: run only layer N
- `--skip-adversarial`: skip Layer 5
- `--skip-cross-model`: skip Layer 6
- `--skip-human-eval`: skip Layer 7

---

## Layer 1: Multi-Agent Cross-Review

Spawn 2 independent review agents with fresh context. They review independently — neither sees the other's output until after both finish.

**Agent 1 — Implementation Correctness Review**

```
You are a senior engineer reviewing Phase [N] of [project name].

Read the plan at: [path to PLAN files]
Read the modified files listed in files_modified.
Read the summary at: [path to SUMMARY files]

Review for:
1. Correctness: does the implementation match the plan intent?
2. Code quality: are there obvious issues (naming, structure, duplication)?
3. Missing edge cases: what inputs/states are not handled?
4. API coherence: is the public interface intuitive and consistent?

For each finding: PASS / WARN [detail] / FAIL [detail]
FAIL = would cause incorrect behavior. WARN = suboptimal but not broken.
```

**Agent 2 — Security and Resilience Review**

```
You are a security-focused engineer reviewing Phase [N] of [project name].

Read [same files as Agent 1].

Review for:
1. Input validation: is all external input validated before use?
2. Injection risks: SQL, shell, path traversal, template injection
3. Error handling: are all error paths handled? Can errors leak sensitive info?
4. Resource leaks: file handles, connections, memory that could be left open
5. Privilege boundaries: does the code access only what it declared it would?

For each finding: PASS / WARN [detail] / FAIL [detail]
FAIL = exploitable or data-corrupting. WARN = hardening opportunity.
```

**Layer 1 result:**
- PASS: neither agent returns FAIL
- WARN: one or more WARNs but no FAILs (proceed, document findings)
- FAIL: any FAIL from either agent

---

## Layer 2: Guardrails (Deterministic)

Run deterministic checks in sequence:

### Lint check

```bash
sunco lint
# fallback:
npx eslint packages/ --max-warnings 0
npx tsc --noEmit
```

### Test suite

```bash
npx vitest run --reporter=verbose 2>&1 | tail -40
```

### Health check (informational)

```bash
sunco health
# fallback: node --version, npm list --depth=0
```

**Layer 2 result:**
- PASS: zero lint errors + zero tsc errors + all tests pass
- FAIL: any lint error or tsc error or test failure (health warnings do not block)

---

## Layer 3: BDD Criteria Check

For each plan's `done_when` checklist and each task's `acceptance_criteria`:

1. Read each criterion
2. Classify: is this checkable programmatically or requires inspection?
3. For programmatic criteria: run the check
4. For inspection criteria: verify by reading the relevant code
5. Mark as PASS, FAIL, or PARTIAL (partially met)

**Checkable criterion examples:**
- "File `packages/core/src/x.ts` exists" — check with `ls`
- "Function `parseConfig` is exported" — check with grep
- "Tests in `__tests__/x.test.ts` pass" — run with vitest
- "CLI command `sunco x` outputs 'ok'" — run with node

**Inspection criterion examples:**
- "Config validation rejects missing required fields" — read validation code
- "Error messages are user-friendly" — read error strings

**Layer 3 result:**
- PASS: all `done_when` criteria met for all plans
- PARTIAL: some criteria met, some not (note which)
- FAIL: any criterion provably unmet

---

## Layer 4: Permission Audit

Verify the implementation stayed within its declared boundaries.

### File access audit

```bash
git diff HEAD~[estimated-commits] --name-only
```

Compare against `files_modified` in PLAN.md frontmatter.

- Files in PLAN + modified = expected (OK)
- Files NOT in PLAN + modified = unauthorized scope expansion (WARN)
- Files in PLAN + NOT modified = plan declared but not executed (WARN)

### Network access audit

Scan modified files for network calls:

```bash
grep -rn "fetch\|axios\.\|http\.get\|https\.get\|got(\|ky\." [modified files]
```

If found and plan did not declare `allowNetwork: true` = WARN.

### Git boundary check

```bash
git log --oneline -20 --name-only
```

Check that:
- Commits are scoped to the phase's intended files
- No commits touched `.planning/` other than SUMMARY.md files
- Commit messages follow the `feat([scope]): description` format

### Secrets audit

```bash
git diff HEAD~[N] -- "*.env" "*.key" "*.pem" "*.secret" "secrets*" "*credentials*"
```

**Layer 4 result:**
- PASS: no FAILs (WARNs are noted and do not block)
- FAIL: secrets committed, or major unauthorized scope (>5 files outside plan scope)

---

## Layer 5: Adversarial Test (skip with --skip-adversarial)

Spawn an adversarial agent tasked with breaking the implementation.

**Adversarial agent prompt:**
```
You are a security researcher and chaos engineer. Your job is to break Phase [N].

Modified files: [list from PLAN files_modified]
Read each modified file before starting.

Attempt to find:
1. Inputs that cause crashes or unexpected behavior (null, empty, very large, unicode, special chars)
2. Ways to bypass intended restrictions or validation
3. Race conditions or state corruption under concurrent access
4. Error paths that are not handled (what happens when X fails mid-operation?)
5. Path traversal or injection if any file/command operations exist

For each issue found:
- Attack vector: how to trigger it
- Impact: what breaks or what can be accessed
- Severity: critical / high / medium / low

If you cannot find issues after exhaustive testing: output "PASS — no exploitable issues found"
```

**Layer 5 result:**
- PASS: no critical or high severity issues found
- WARN: medium/low severity findings (document, do not block)
- FAIL: critical or high severity exploitable issue found

---

## Layer 6: Cross-Model Verification (skip with --skip-cross-model)

Eliminates same-model bias. Claude reviews Claude's code — systematic blind spots exist. A different model catches them.

### Strategy

1. **Multiple providers available**: Uses `crossVerify()` to send the verification prompt through a different AI provider than the primary one. True cross-model blind spot detection.
2. **Single provider**: Falls back to the same model with a "skeptical reviewer" system prompt that shifts perspective — not as good as a different model, but catches some same-perspective blind spots.

The cross-model agent receives:
- The code diff
- A summary of findings from Layers 1-5 (to avoid duplicating known issues)
- Instructions to find what previous reviewers MISSED

### Skip behavior

Skip with `--skip-cross-model`:
```
Layer 6 (Cross-model): SKIPPED
Reason: --skip-cross-model flag set.
Note: This does not block overall verification.
```

**Layer 6 result:**
- PASS: No critical or structural issues found by cross-model review
- FAIL: Cross-model review identifies exploitable or structural issue
- SKIPPED: --skip-cross-model flag set (does not block overall result)

---

## Cross-Domain Gate (Phase 49/M4.2 — additive layer)

**Trigger condition:** Phase's `${N}-CONTEXT.md` declares `domains: [frontend, backend]` **OR** `required_specs` explicitly lists both `UI-SPEC.md` and `API-SPEC.md` paths. Single-domain phases and no-SPEC phases skip this gate — spec §8 line 731 non-regression guarantee (Layers 1-7 above retain their existing behavior verbatim).

**Purpose:** Emit 4 deterministic check-type findings from the Phase 48 CROSS-DOMAIN.md projection into `.planning/domains/contracts/CROSS-DOMAIN-FINDINGS.md` for downstream `/sunco:proceed-gate` severity × state policy enforcement.

**Deterministic-only** (charter A6-i): no LLM, no subagent, no HTTP. All 4 checks are set-algebra / boolean / string-empty operations on the CROSS-DOMAIN.md projection output. No `sunco-cross-domain-*` agent is spawned (Phase 49 deferred spec §8 L685 literal per architecture.md Deterministic-First principle; future heuristic extension slot documented in `.planning/phases/49-verify-gate-cross-domain/49-CONTEXT.md`).

### Step C1: Decide whether to fire the gate

```bash
CONTEXT_MD="$PHASE_DIR/${PADDED}-CONTEXT.md"
FIRE=$(node --input-type=module -e "
  import { readFileSync } from 'node:fs';
  import { shouldTriggerCrossDomainLayer } from './packages/cli/references/cross-domain/src/extract-spec-block.mjs';
  try {
    const md = readFileSync('$CONTEXT_MD', 'utf8');
    console.log(shouldTriggerCrossDomainLayer(md) ? '1' : '0');
  } catch { console.log('0'); }
")

if [ "$FIRE" != "1" ]; then
  echo "Cross-domain gate: SKIPPED (phase does not declare frontend+backend domains or both UI+API specs)"
  # Existing VERIFICATION.md-only flow continues unchanged.
fi
```

### Step C2: Ensure CROSS-DOMAIN.md is fresh

If CROSS-DOMAIN.md is absent or its tracked `generated_from[].sha` has drifted from the current UI-SPEC/API-SPEC byte SHAs, regenerate via `workflows/cross-domain-sync.md` Phase 48 pipeline. The deterministic generator is idempotent — same inputs → same output.

```bash
UI_SPEC=".planning/domains/frontend/UI-SPEC.md"
API_SPEC=".planning/domains/backend/API-SPEC.md"
CROSS_DOMAIN=".planning/domains/contracts/CROSS-DOMAIN.md"

STALE=$(node --input-type=module -e "
  import { isCrossDomainStale } from './packages/cli/references/cross-domain/src/extract-spec-block.mjs';
  console.log(isCrossDomainStale('$CROSS_DOMAIN', ['$UI_SPEC', '$API_SPEC']) ? '1' : '0');
")

if [ "$STALE" = "1" ]; then
  # Invoke Phase 48 cross-domain-sync.md pipeline to regenerate CROSS-DOMAIN.md.
  # See workflows/cross-domain-sync.md for the 7-step generator pipeline.
  echo "CROSS-DOMAIN.md stale — regenerating via cross-domain-sync pipeline."
fi
```

### Step C3: Emit 4 deterministic findings

Delegates to `generateCrossDomainFindings` in `packages/cli/references/cross-domain/src/extract-spec-block.mjs`:

- `missing-endpoint` — severity=HIGH (UI consumes; API undefined)
- `type-drift` — severity=HIGH (`type_contracts[].match === false`)
- `error-state-mismatch` — severity=MEDIUM (`error_mappings[].ui_state === ''`)
- `orphan-endpoint` — severity=LOW (API defines; UI never consumes)

Deterministic ordering: rule asc, file asc, line asc, match asc. All findings carry `state: open`, `kind: deterministic`, `source: cross-domain`. `file` = UI-SPEC.md (for consumer-side checks: missing-endpoint/type-drift/error-state-mismatch) or API-SPEC.md (for definer-side: orphan-endpoint). `line: 0` (SPEC-level, not line-local).

```bash
node --input-type=module -e "
  import { readFileSync, writeFileSync, existsSync } from 'node:fs';
  import {
    extractSpecBlock, generateCrossDomain, generateCrossDomainFindings,
    renderFindingsMarkdown,
  } from './packages/cli/references/cross-domain/src/extract-spec-block.mjs';
  const ui = await extractSpecBlock('$UI_SPEC', 'ui');
  const api = await extractSpecBlock('$API_SPEC', 'api');
  const { crossDomainBlock } = generateCrossDomain({ ui, api });
  const { findings } = generateCrossDomainFindings({ crossDomainBlock });
  const OUT = '.planning/domains/contracts/CROSS-DOMAIN-FINDINGS.md';
  const prior = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null;
  // overrides=undefined preserves existing human-edited lifecycle region byte-for-byte
  const { content } = renderFindingsMarkdown({ findings }, prior);
  writeFileSync(OUT, content);
  console.log('✎ wrote ' + OUT + ' (' + findings.length + ' findings)');
"
```

### Step C4: Record in VERIFICATION.md + route to proceed-gate

Cross-domain layer findings do NOT directly pass/fail the verify output. Instead, `/sunco:proceed-gate` consumes `CROSS-DOMAIN-FINDINGS.md` downstream and applies the severity × state policy (HIGH+open → HARD BLOCK; MED+open → dismissible; LOW+open → `--allow-low-open` override). VERIFICATION.md records a summary line per finding count (HIGH/MEDIUM/LOW × open/resolved/dismissed) but the verdict lives in proceed-gate.

**Cross-Domain Gate result:** PASS (always, at verify layer — blocking decisions belong to proceed-gate). The layer's purpose is to produce CROSS-DOMAIN-FINDINGS.md for the next stage.

---

## Layer 7: Human Eval Gate (skip with --skip-human-eval or --auto)

Final human sign-off. Presents a summary of all 6 automated layers' results and asks the user for approval.

### User options

- **Approve**: Verification passes. Proceed to ship.
- **Block**: Verification fails. User provides reason. Must fix and re-verify.
- **Skip**: Human eval is skipped. Automated verdict stands.

### Auto behavior

When `--auto` or `--skip-human-eval` is set, Layer 7 automatically passes without prompting. This is intended for CI/CD pipelines and fully automated workflows.

**Layer 7 result:**
- PASS: User approves or layer is auto-skipped
- FAIL: User blocks with reason (finding added at critical severity)
- SKIPPED: --auto or --skip-human-eval flag set

---

## Write VERIFICATION.md

Write to `.planning/phases/[N]-[phase-name]/[N]-VERIFICATION.md`.

Use the following VERIFICATION.md structure (defined inline below):

```markdown
# Phase [N] Verification Results

Generated: [date]

## Summary

| Layer | Name | Result | Notes |
|-------|------|--------|-------|
| 1 | Multi-agent review | PASS/WARN/FAIL | [summary] |
| 2 | Guardrails | PASS/FAIL | [summary] |
| 3 | BDD criteria | PASS/PARTIAL/FAIL | [N]/[total] met |
| 4 | Permission audit | PASS/WARN/FAIL | [summary] |
| 5 | Adversarial | PASS/WARN/FAIL/SKIPPED | [summary] |
| 6 | Cross-model | PASS/FAIL/SKIPPED | [summary] |
| 7 | Human eval | PASS/FAIL/SKIPPED | [summary] |

## Overall: PASS / NEEDS FIXES

[If PASS]: All 7 layers passed. Ready to ship.
[If NEEDS FIXES]: Fix the issues listed below, then re-run /sunco:verify [N].

## Layer Details

### Layer 1 — Multi-agent Review
**Agent 1 (correctness):** [findings]
**Agent 2 (security):** [findings]

### Layer 2 — Guardrails
[lint/tsc/test output summary]

### Layer 3 — BDD Criteria
| Criterion | Status | Evidence |
|-----------|--------|----------|
| [criterion] | PASS | [check run] |

### Layer 4 — Permission Audit
[file access, network, git, secrets findings]

### Layer 5 — Adversarial
[attack vectors attempted, findings]

### Layer 6 — Cross-model
[cross-model findings or SKIPPED reason]

### Layer 7 — Human Eval
[approval status, block reason if any, or SKIPPED]

## Issues to Fix
- [ ] [issue 1 — layer N]
- [ ] [issue 2 — layer N]
```

---

## Route

If **OVERALL PASS**: "All layers passed. Run `/sunco:ship [N]` to create the PR."

If **NEEDS FIXES**: "Fix the issues listed above, then re-run `/sunco:verify [N]`."

If **PARTIAL** (some layers skipped): "Proceed with awareness that [Layer N] was skipped."

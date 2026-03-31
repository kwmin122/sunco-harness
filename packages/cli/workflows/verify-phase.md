# Verify Phase Workflow

6-layer Swiss cheese verification for a completed phase. Each layer catches different failure modes. Layers are designed to have low correlation — a bug that slips through one layer is likely caught by another. Used by `/sunco:verify`.

---

## Overview

The 6 layers:

| Layer | Name | Type | Catches |
|-------|------|------|---------|
| 1 | Multi-agent cross-review | AI | Logic errors, quality issues, missing edge cases |
| 2 | Guardrails | Deterministic | Lint errors, type errors, test failures |
| 3 | BDD criteria check | Hybrid | Unmet acceptance criteria from PLANs |
| 4 | Permission audit | Deterministic | Scope violations, unauthorized file access, secrets |
| 5 | Adversarial test | AI | Exploitable inputs, race conditions, bypass paths |
| 6 | Cross-model verification | AI (different model) | Same-model blind spots, structural issues |

Reference: `packages/cli/references/swiss-cheese.md` for the theoretical basis.

---

## Preparation

Read all phase artifacts:
1. `.planning/phases/[N]-*/[N]-CONTEXT.md` — decisions and acceptance baseline
2. `.planning/phases/[N]-*/*-PLAN.md` — all plans with `done_when` and `files_modified`
3. `.planning/phases/[N]-*/*-SUMMARY.md` — execution results from each plan
4. `.planning/REQUIREMENTS.md` — which requirements this phase covers

Determine which layer(s) to run:
- Default: run all 6 layers
- `--layer N`: run only layer N
- `--skip-adversarial`: skip Layer 5
- `--skip-codex`: skip Layer 6

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

## Layer 6: Cross-Model Verification (skip with --skip-codex)

Eliminates same-model bias. Claude reviews Claude's code — systematic blind spots exist. A different model catches them.

### Detection

```bash
ls ~/.claude/commands/codex/ 2>/dev/null
```

### If Codex plugin installed

```
/codex:adversarial-review [N]
```

The Codex plugin runs independent review through OpenAI's model. Results include:
- Structural issues Claude consistently misses
- Alternative implementation approaches that may be more robust
- Cross-language pattern violations (Node.js idioms vs general)

### If Codex NOT installed

Skip gracefully:
```
Layer 6 (Cross-model): SKIPPED
Reason: Codex plugin not installed.
Install: /plugin marketplace add openai/codex-plugin-cc
Note: This does not block overall verification.
```

**Layer 6 result:**
- PASS: Codex finds no critical or structural issues
- FAIL: Codex identifies exploitable or structural issue
- SKIPPED: plugin not installed (does not block overall result)

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
| 6 | Cross-model (Codex) | PASS/FAIL/SKIPPED | [summary] |

## Overall: PASS / NEEDS FIXES

[If PASS]: All 6 layers passed. Ready to ship.
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
[Codex findings or SKIPPED reason]

## Issues to Fix
- [ ] [issue 1 — layer N]
- [ ] [issue 2 — layer N]
```

---

## Route

If **OVERALL PASS**: "All layers passed. Run `/sunco:ship [N]` to create the PR."

If **NEEDS FIXES**: "Fix the issues listed above, then re-run `/sunco:verify [N]`."

If **PARTIAL** (some layers skipped): "Proceed with awareness that [Layer N] was skipped."

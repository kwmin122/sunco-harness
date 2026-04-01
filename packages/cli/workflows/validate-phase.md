# Validate Phase Workflow

Nyquist-style test coverage validation for a completed phase. Reads acceptance criteria from PLAN.md files, checks existing test coverage, generates missing tests to hit the coverage threshold, verifies they pass, and writes VALIDATION.md. Spawns a sunco-nyquist-auditor agent to independently audit coverage quality.

Used by `/sunco:validate`.

---

## Core Principle

Nyquist sampling theorem applied to tests: you need at least 2× the observation rate to faithfully reconstruct the signal. Here: each meaningful behavior in the acceptance criteria must have at least one passing test. Coverage is measured against acceptance criteria, not raw line count — a 95% line coverage score means nothing if the acceptance criteria are untested.

Responsibility chain:

```
parse_args → load_phase → read_acceptance_criteria
→ inventory_existing_tests → measure_coverage_gap
→ spawn_nyquist_auditor → generate_missing_tests
→ run_tests → verify_threshold → write_validation
→ commit_validation → display_summary
```

---

## Step 1: parse_args

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First positional | `PHASE_ARG` | — (required) |
| `--threshold N` | `THRESHOLD` | `80` (percent) |
| `--generate` | `GENERATE` | true |
| `--no-generate` | `NO_GENERATE` | false |
| `--strict` | `STRICT` | false |
| `--no-commit` | `NO_COMMIT` | false |

Rules:
- `--threshold N` — minimum criteria coverage percent (0–100)
- `--no-generate` — audit only, do not generate new tests
- `--strict` — threshold is 100%, fail if any criterion is untested
- `--strict` overrides `--threshold`

---

## Step 2: load_phase

Load phase context:

```bash
PHASE_STATE=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" init phase-op "${PHASE_ARG}")
```

Parse: `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `plans`.

Load all plans:

```bash
PLANS=($(ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null | sort))
SUMMARIES=($(ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null | sort))
```

Check phase execution state:
- If no SUMMARY.md files exist → warn: "Phase ${PHASE_NUM} has no summaries. Run `/sunco:execute ${PHASE_NUM}` first."
- If plan count != summary count → warn: "Phase ${PHASE_NUM} has incomplete execution ({incomplete} plans without summaries)."

Warn but continue — validation can still run on partial phases.

---

## Step 3: read_acceptance_criteria

For each PLAN.md, extract the `## Acceptance Criteria` section:

```bash
for PLAN in "${PLANS[@]}"; do
  CRITERIA=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" plan extract-criteria "${PLAN}")
  echo "$CRITERIA"
done
```

Parse into a structured list of criteria items. Each criterion has:
- `id`: auto-generated (plan_slug-N)
- `text`: the criterion text
- `plan`: source plan filename
- `type`: inferred from text (`unit` | `integration` | `e2e` | `visual` | `perf`)

**Type inference rules:**
- "returns X when Y" → `unit`
- "given Z, when W, then V" (BDD pattern) → `unit` or `integration`
- "user can navigate to / click / see" → `e2e`
- "renders correctly" → `visual`
- "completes within N ms" → `perf`
- Ambiguous → `unit` (default)

Display:

```
Phase {N}: {name}
Acceptance criteria: {total_count} across {plan_count} plans
  unit: {N}
  integration: {N}
  e2e: {N}
  visual: {N}
  perf: {N}
```

---

## Step 4: inventory_existing_tests

Find all test files related to this phase:

```bash
# Find test files by package convention
TEST_FILES=$(find packages/ -name "*.test.ts" -newer "${PHASE_DIR}" 2>/dev/null)
# Also check __tests__/ directories
TEST_FILES+=$(find packages/ -path "*/__tests__/*.ts" -newer "${PHASE_DIR}" 2>/dev/null)
```

For each criterion, attempt to match it to an existing test:

Match strategy (in order):
1. **Exact text match**: test description contains the criterion text (normalized)
2. **Semantic match**: test description semantically covers the criterion behavior
3. **File pattern match**: test file name matches the plan slug

For each criterion, mark: `covered` | `partial` | `uncovered`.

Calculate coverage:

```
COVERED_COUNT = criteria with status "covered"
TOTAL_COUNT = all criteria
COVERAGE_PERCENT = COVERED_COUNT / TOTAL_COUNT * 100
```

Display coverage gap:

```
Coverage report:
  Criteria covered  : {COVERED_COUNT}/{TOTAL_COUNT} ({COVERAGE_PERCENT}%)
  Threshold         : {THRESHOLD}%
  Gap               : {UNCOVERED_COUNT} uncovered criteria
  Status            : {PASSING|FAILING}
```

---

## Step 5: spawn_nyquist_auditor

Spawn a sunco-nyquist-auditor subagent to independently evaluate coverage quality. This agent is adversarial — it challenges whether existing tests actually verify the criteria, not just mention them.

Auditor prompt:

```
You are sunco-nyquist-auditor. Your job is to evaluate whether tests faithfully cover acceptance criteria — not just whether test descriptions match, but whether the assertions actually verify the behavior.

Phase: {phase_name}
Criteria count: {total_count}

For each covered criterion, evaluate:
1. Does the test assertion actually verify the criterion's postcondition?
2. Are edge cases covered (null inputs, error paths, boundary values)?
3. Is the test deterministic (no time-based or order-dependent assertions)?

Return JSON:
{
  "challenged_criteria": [
    {
      "id": "...",
      "issue": "Test mentions criterion but asserts wrong postcondition",
      "severity": "HIGH|MEDIUM|LOW"
    }
  ],
  "quality_score": 0-100,
  "recommendations": ["..."]
}
```

Parse the auditor response. Criteria challenged by the auditor are downgraded from `covered` to `partial`.

Recalculate coverage with auditor challenges applied.

---

## Step 6: generate_missing_tests

If `NO_GENERATE=true` → skip to step 7.

For each uncovered or partial criterion, generate a test:

For each criterion:

**6a. Determine test location:**
```bash
node "$(npm root -g)/sunco/bin/sunco-tools.cjs" plan locate-test-target "${CRITERION_ID}" "${PHASE_DIR}"
```

This returns: `package`, `file_path`, `test_file_path`, `test_strategy`.

**6b. Generate the test:**

Use BDD-style structure (Given/When/Then or describe/it):

```typescript
describe('{component or function name}', () => {
  it('{criterion text converted to it() description}', () => {
    // Given: {setup}
    // When: {action}
    // Then: {assertion matching criterion}
  })
})
```

Write to the test file. Append to existing test file if it exists. Create new file if not.

**6c. Run the generated test:**

```bash
vitest run --reporter=verbose "${TEST_FILE}" 2>&1
```

If test fails because implementation is incomplete: mark as `pending` with a `test.todo()` comment and a `TODO(validation):` note.

If test fails because test is wrong: fix the test assertion. Maximum 1 retry.

Display per criterion:
```
[{status}] {criterion_id}: {text_preview}
  Generated: {test_file}:{line}
  Assertion: {passing|failing|pending}
```

---

## Step 7: run_tests

Run the full test suite for affected packages:

```bash
vitest run --reporter=verbose --coverage packages/{affected_packages}/
```

Parse results:
- `PASSING_TESTS`: tests that pass
- `FAILING_TESTS`: tests that fail
- `LINE_COVERAGE`: raw line coverage percent

If any generated tests are failing:

```
{N} generated test(s) are failing:
  {list test name + error}

These may indicate incomplete implementations. Mark as pending or fix implementation.
```

---

## Step 8: verify_threshold

Calculate final coverage after test generation:

```
FINAL_COVERED = all criteria with passing tests
FINAL_COVERAGE = FINAL_COVERED / TOTAL_COUNT * 100
THRESHOLD_MET = FINAL_COVERAGE >= THRESHOLD
```

Display threshold check:

```
Coverage threshold: {THRESHOLD}%
Achieved coverage : {FINAL_COVERAGE}% ({FINAL_COVERED}/{TOTAL_COUNT} criteria)
Result            : {PASSED|FAILED}
```

If threshold not met AND `--generate` was enabled:
List the remaining uncovered criteria. These are genuine gaps, not addressable by test generation alone (likely missing implementation).

---

## Step 9: write_validation

Write VALIDATION.md in the phase directory:

```bash
cat > "${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md" << 'EOF'
# Phase {N}: {name} — Validation Report

**Generated**: {date}
**Threshold**: {THRESHOLD}%
**Status**: {passed | failed}

## Coverage Summary

| Metric | Value |
|--------|-------|
| Total criteria | {N} |
| Covered | {N} |
| Partial (auditor-challenged) | {N} |
| Uncovered | {N} |
| Coverage percent | {N}% |
| Threshold met | {yes | no} |
| Line coverage | {N}% (informational) |

## Nyquist Auditor Report

Quality score: {quality_score}/100

{if challenged_criteria}
Challenged criteria:
{list challenged criteria with issue and severity}
{/if}

Recommendations:
{list auditor recommendations}

## Criteria Status

{for each criterion}
### {id} — {text}
Plan: {plan_filename}
Type: {unit|integration|e2e|visual|perf}
Status: {covered | partial | uncovered | pending}
Test file: {path or "none"}
Notes: {if challenged, note the challenge}

## Generated Tests

{list of test files created or modified}

## Failing Tests

{list of any tests that are still failing}

## Recommendations

{synthesized list of actions to close remaining gaps}
EOF
```

---

## Step 10: commit_validation

If `NO_COMMIT=false`:

```bash
git add "${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md"
# Add any generated test files
git add packages/*/src/**/*.test.ts 2>/dev/null || true
git add packages/*/__tests__/*.ts 2>/dev/null || true

git commit -m "test(phase-${PHASE_NUM}): validation report + generated tests

Phase ${PHASE_NUM}: ${PHASE_NAME}
  Criteria: ${COVERED}/${TOTAL} covered (${COVERAGE_PERCENT}%)
  Threshold: ${THRESHOLD}% — ${THRESHOLD_MET}
  Generated: ${GENERATED_COUNT} new tests
  Quality score: ${QUALITY_SCORE}/100"
```

---

## Step 11: display_summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 VALIDATE COMPLETE — Phase {N}: {name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Coverage  : {COVERAGE_PERCENT}% ({COVERED}/{TOTAL} criteria)
 Threshold : {THRESHOLD}% — {PASSED|FAILED}
 Generated : {N} new tests
 Quality   : {quality_score}/100 (nyquist audit)
 Written   : {VALIDATION_FILE}

{if threshold failed}
 GAPS REMAINING ({N}):
 {list uncovered criterion IDs}
 These likely indicate incomplete implementation.
{/if}

 Next:
   {if passed}  /sunco:ship {PHASE_NUM}        — create PR
   {if failed}  /sunco:execute {PHASE_NUM}     — close implementation gaps
```

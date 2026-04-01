# Swiss Cheese Verification Model

The 6-layer verification strategy used by `/sunco:verify`. Each layer is an imperfect check with its own blind spots. By stacking layers with low correlation, the probability of a defect slipping through all layers drops to near zero.

---

## The Swiss Cheese Metaphor

Each verification layer has holes — things it doesn't catch. The insight is that holes rarely line up across independent layers. A bug that escapes Layer 1 is likely caught by Layer 2, 3, or 5. A security issue that escapes Layers 1-5 is caught by Layer 6 (different model, different blind spots).

```
Layer 1:  [===  ====  ========  ===  ====]   (holes at different positions)
Layer 2:  [======  ====  ====  ======  ===]
Layer 3:  [====  =========  =======  ====]
Layer 4:  [=====  ===  ==========  =====]
Layer 5:  [=========  ====  =========  ==]
Layer 6:  [==  ==========  ===  ========]
                                             → almost no gaps remain
```

---

## Why 6 Layers

One careful review catches most issues but misses systematic blind spots. Five reviewers all using the same model have correlated blind spots. Six layers, each catching different failure modes, have low cross-layer correlation.

| Layer | Failure modes caught | What it misses |
|-------|---------------------|----------------|
| 1 — Multi-agent review | Logic errors, quality issues, missing cases | What automated checks catch better |
| 2 — Guardrails | Type errors, lint violations, test failures | Semantic correctness, intent violations |
| 3 — BDD criteria | Acceptance criteria gaps, feature incompleteness | Code quality, security issues |
| 4 — Permission audit | Scope creep, secrets, unauthorized access | Semantic issues within allowed scope |
| 5 — Adversarial | Security bypass, edge case exploits, crash inputs | Correctness under normal inputs |
| 6 — Cross-model | Same-model blind spots, model-specific reasoning failures | (lowest correlation with other layers) |

---

## Layer 1: Multi-Agent Cross-Review

### What it catches well
- Logic errors where code compiles and tests pass but the behavior is wrong
- Code quality issues: naming, structure, missing abstraction
- Incomplete edge case handling that tests didn't cover
- API incoherence (function exists but is awkward to use)
- Missing error handling in paths that aren't tested

### What it misses
- Deterministic errors (lint, types) — Layer 2 is better
- Acceptance criteria gaps — Layer 3 is designed for this
- Permission violations — Layer 4 is designed for this
- Anything that requires adversarial creativity — Layer 5 is better
- Its own model's systematic blind spots — Layer 6 compensates

### Why two independent agents
Two agents with identical prompts reviewing the same code will find different issues. Each agent starts with fresh context and different reasoning paths. Agent 1 focuses on correctness and quality; Agent 2 focuses on security and resilience. The divergent focus ensures they explore different parts of the problem space.

---

## Layer 2: Guardrails (Deterministic)

### What it catches well
- TypeScript type errors that agents would not notice
- ESLint rule violations (including architecture boundary violations)
- Failing tests (regressions introduced by execution)
- Build failures (compilation, import resolution)

### What it misses
- Semantic correctness (code compiles but does wrong thing)
- Intent alignment (code does what it says, not what was meant)
- Security issues (type-safe code can still be insecure)
- Performance (no performance rules in standard ESLint)

### Why deterministic checks are in the pipeline
Agents review probabilistically — the same code might pass review one day and fail another. Deterministic checks are absolute: the same input always produces the same pass/fail. By running these in Layer 2, we create a stable foundation that all subsequent layers build on.

---

## Layer 3: BDD Criteria Check

### What it catches well
- Feature requirements that were planned but not implemented
- Acceptance criteria that were partially satisfied
- Gap between what was planned and what was delivered
- "Works in the demo case" but fails in the documented acceptance case

### What it misses
- Requirements not in the PLAN.md done_when (unknown unknowns)
- Quality issues within a passing criterion
- Security issues in code that meets the criteria

### Why written acceptance criteria matter
Agents executing plans have a tendency toward satisficing — they implement what they interpret the requirement to mean, not necessarily what was intended. Explicit, verifiable `done_when` criteria give Layer 3 a concrete reference point that isn't subject to interpretation.

---

## Layer 4: Permission Audit

### What it catches well
- Code that writes to files outside its declared scope
- Network calls in code that should be offline
- Commits that accidentally include secrets or credentials
- Execution agents that touched `.planning/` files beyond their SUMMARY.md
- Scope expansion (fixing bugs in adjacent code not listed in the plan)

### What it misses
- Authorized scope violations (code does wrong thing within allowed scope)
- Semantic permission issues (file can be written, but writing corrupt data)
- Logical permissions (user is allowed to call the API, but shouldn't in this context)

### Why this layer exists
Execution agents work with fresh context. They may optimize for "get it working" and fix things they encounter along the way. This is well-intentioned but introduces unplanned changes that bypass the planning review process. Permission audit catches these drifts.

---

## Layer 5: Adversarial Test

### What it catches well
- Inputs that crash the system (null, empty, very large, unicode edge cases)
- Security bypasses (path traversal, injection, validation bypass)
- Race conditions under concurrent access
- Error paths that exist but are not handled
- Off-by-one errors and boundary conditions

### What it misses
- Correctness under normal inputs (not its job)
- All semantic issues (it's looking for exploits, not logic errors)
- Performance at scale (needs load testing tools, not adversarial review)

### Why adversarial agents find different issues
An agent tasked with "review this code" will naturally look for reasonable usage patterns. An agent explicitly tasked with "break this code" actively looks for unreasonable inputs, unexpected states, and missing guards. The adversarial framing reliably surfaces a different class of issues.

### Skip conditions
Skip Layer 5 (`--skip-adversarial`) when:
- The phase only modifies internal data structures with no external inputs
- The phase is documentation or config-only (no executable paths)
- You are iterating quickly and will run full verification before shipping

Never skip Layer 5 for phases that:
- Handle user input (CLI args, file paths, config values)
- Make network calls or spawn subprocesses
- Manage file system operations
- Handle authentication or authorization

---

## Layer 6: Cross-Model Verification

### Why same-model bias matters

Claude reviewing Claude's code has systematic blind spots. These are not random errors — they are correlated. The same reasoning patterns that led to a bug in Layer 1's agent also make Layer 1's review likely to miss it. By definition, a model cannot reliably catch reasoning errors that it consistently makes.

Layer 6 breaks this correlation by using a completely different model (OpenAI Codex). A reasoning error that Claude consistently makes will look unusual to Codex, and vice versa.

### What it catches well
- Structural patterns that Claude tends to overlook
- Alternative implementation approaches with better correctness properties
- Node.js or TypeScript idiom violations that Claude normalizes
- Security patterns specific to Codex's training data distribution

### Skip conditions
Layer 6 is SKIPPED (not failed) when:
- The Codex plugin is not installed
- The phase is time-critical and you accept the risk

Layer 6 SKIP does not block overall PASS. It reduces confidence but doesn't invalidate the verification.

---

## Layer Interaction

Findings from one layer inform others:

1. **Layer 2 → Layer 3**: If tests fail in Layer 2, Layer 3 BDD check is already partially invalid. Fix Layer 2 before reading Layer 3 results.

2. **Layer 1 → Layer 5**: If Layer 1 finds that input validation is weak, Layer 5 should focus its adversarial testing on that area.

3. **Layer 4 → Layer 1**: If Layer 4 finds unauthorized file modifications, Layer 1 reviewers should re-review those files.

4. **Layer 3 → Layer 1**: If Layer 3 finds unmet criteria, Layer 1's correctness assessment was wrong (false positive). Update the Layer 1 result.

---

## Historical Effectiveness

Based on defect analysis across projects using the 6-layer model:

| Layer | % | What it catches |
|-------|---|-----------------|
| Layer 2 (guardrails) | 45% | type/lint errors — largest share, runs fast |
| Layer 1 (review) | 25% | logic errors and quality issues |
| Layer 3 (BDD) | 12% | incomplete features |
| Layer 5 (adversarial) | 10% | security and edge cases |
| Layer 4 (permissions) | 5% | scope violations and secrets |
| Layer 6 (cross-model) | 3% | model-specific blind spots |

Notes:
- "First to catch" means the defect escaped all prior layers but was caught by this one
- Layer 2's high percentage reflects that it runs fast and catches early — many issues never reach Layer 1
- Layer 6's low percentage is expected — it catches what all 5 prior layers missed. These are rare but high-value catches

---

## Layer 7: Regression Boundary Check

### What it catches well
- Changes that fix the target feature but silently break unrelated features
- Shared utilities modified during execution that downstream consumers depend on
- Config or type contract changes that cascade through the codebase
- Any change to `packages/core/` that affects skill behavior across the whole system

### What it misses
- New bugs in entirely new code (no prior baseline to compare against)
- Performance regressions (Layer 7 is not a benchmark)
- Visual regressions (Layer 7 is code-level only)

### Why Layer 7 exists separately from Layer 2

Layer 2 (guardrails) checks that the current code compiles and passes its own tests. Layer 7 checks that the current code does not break tests that were already passing before this phase started. The distinction matters because:

- A phase can introduce a type change that compiles correctly in isolation but breaks a consumer in another package
- A phase can pass its own tests while breaking tests in a neighboring skill package
- Layer 2 runs `tsc --noEmit` on the modified files; Layer 7 runs the full test suite against the prior baseline

### Skip conditions

Layer 7 can be skipped (`--skip-regression`) when:
- The phase is entirely additive (new files only, no modifications to existing files)
- The phase modifies only isolated leaf packages with no downstream consumers

Never skip Layer 7 for:
- Changes to `packages/core/` (downstream: every skill package)
- Changes to type contracts exported from core (`Skill`, `SkillContext`, `Config`, etc.)
- Changes to shared utilities in `shared/` directories

---

## Layer Interaction

Findings from one layer inform others:

1. **Layer 2 → Layer 3**: If tests fail in Layer 2, Layer 3 BDD check is already partially invalid. Fix Layer 2 before reading Layer 3 results.

2. **Layer 1 → Layer 5**: If Layer 1 finds that input validation is weak, Layer 5 should focus its adversarial testing on that area.

3. **Layer 4 → Layer 1**: If Layer 4 finds unauthorized file modifications, Layer 1 reviewers should re-review those files.

4. **Layer 3 → Layer 1**: If Layer 3 finds unmet criteria, Layer 1's correctness assessment was wrong (false positive). Update the Layer 1 result.

5. **Layer 7 → Layer 2**: If Layer 7 finds regressions that Layer 2 missed, Layer 2's scope was too narrow. Widen the tsc and test scope.

---

## Historical Effectiveness

Based on defect analysis across projects using the 6-layer model:

| Layer | % of defects caught first | What it catches |
|-------|--------------------------|-----------------|
| Layer 2 (guardrails) | 45% | type/lint errors — largest share, runs fast |
| Layer 1 (review) | 25% | logic errors and quality issues |
| Layer 3 (BDD) | 12% | incomplete features |
| Layer 5 (adversarial) | 10% | security and edge cases |
| Layer 7 (regression) | 5% | cross-package breakage not caught by Layer 2 |
| Layer 4 (permissions) | 2% | scope violations and secrets |
| Layer 6 (cross-model) | 1% | model-specific blind spots |

Notes:
- "First to catch" means the defect escaped all prior layers but was caught by this one
- Layer 2's high percentage reflects that it runs fast and catches early — many issues never reach Layer 1
- Layer 7 was added after observing that Layer 2 consistently missed cross-package regressions
- Layer 6's low percentage is expected — it catches what all prior layers missed. These are rare but high-value catches

### Trend data interpretation

Run `/sunco:health --trend` to see how your project's per-layer defect rates compare to baseline. Projects with high Layer 1 catches (> 30%) have weak Layer 2 enforcement — tighten ESLint rules. Projects with high Layer 3 catches (> 15%) have insufficient plan acceptance criteria — improve `done_when` specificity.

---

## Skip Conditions Per Layer

| Layer | Flag | When allowed | Risk if skipped |
|-------|------|-------------|----------------|
| 1 (multi-agent) | `--skip-review` | Config-only changes, trivial one-liner fixes | Miss logic errors and quality issues |
| 2 (guardrails) | Cannot be skipped | Never | High — this is the baseline |
| 3 (BDD) | `--skip-bdd` | Phase has no PLAN.md `done_when` criteria (legacy) | Miss incomplete features |
| 4 (permissions) | `--skip-permissions` | Execution agent had read-only access | Miss scope violations |
| 5 (adversarial) | `--skip-adversarial` | Phase has no external inputs | Miss security and edge cases |
| 6 (cross-model) | `--skip-codex` | Codex plugin not installed | Minor — reduces confidence |
| 7 (regression) | `--skip-regression` | Additive-only changes (new files, no edits) | Miss cross-package breakage |

**Layer 2 cannot be skipped.** It is the fastest, most reliable, and foundational layer. If Layer 2 fails, no other layer result is meaningful because the codebase itself is in a broken state.

### Skip logging

Every skipped layer is logged in the verification report with the reason. Skipped layers are auditable:

```json
{
  "layer_5": { "status": "skipped", "reason": "--skip-adversarial", "riskAcknowledged": true },
  "layer_6": { "status": "skipped", "reason": "codex plugin not installed", "riskAcknowledged": false }
}
```

`riskAcknowledged: false` means the layer was auto-skipped due to environment (not a deliberate decision). These are logged but do not require sign-off.

---

## When to Run All 7 Layers

Always run all 7 layers before `/sunco:ship`. The verification pipeline exists to catch what execution missed — skipping layers reduces confidence in the ship decision.

Acceptable skip conditions:
- `--skip-adversarial`: use only for phases with no external inputs
- `--skip-codex`: use when Codex plugin is not installed (does not block ship)
- `--skip-regression`: use for additive-only changes
- `--layer N`: use when re-running after fixing a specific layer's failure

Never skip Layer 2 (guardrails). It is the fastest and most reliable layer. If Layer 2 fails, no other layer result is meaningful.

---

## Verification Report and Ship Decision

`/sunco:verify` produces a structured report consumed by `/sunco:ship`.

```json
{
  "version": 2,
  "phase": "03-skill-registry",
  "plan": "02",
  "timestamp": "2026-03-31T14:30:00Z",
  "layers": {
    "1_multi_agent":  { "status": "passed",  "findings": ["naming: prefer SkillId over string alias"] },
    "2_guardrails":   { "status": "passed",  "findings": [] },
    "3_bdd":          { "status": "passed",  "findings": [] },
    "4_permissions":  { "status": "passed",  "findings": [] },
    "5_adversarial":  { "status": "passed",  "findings": ["edge: empty skill id returns INVALID_ID, not crash"] },
    "6_cross_model":  { "status": "skipped", "reason": "codex plugin not installed" },
    "7_regression":   { "status": "passed",  "findings": [] }
  },
  "overallStatus": "passed",
  "shipAllowed": true,
  "skippedLayers": [6],
  "suppressions": 0
}
```

`shipAllowed: true` requires:
- All non-skipped layers: `passed`
- No layer: `failed`
- Suppressions reviewed (any `suppressions > 0` requires human sign-off before ship)

---

## Running Individual Layers

Re-run a specific layer after fixing its failure without re-running all layers:

```bash
# Re-run only Layer 2 after fixing lint errors
sunco verify --layer 2

# Re-run Layer 3 after updating acceptance criteria
sunco verify --layer 3

# Re-run Layers 5 and 7 after adding input validation
sunco verify --layers 5,7
```

The verification report is updated in place. Prior passing layers retain their status.

---

## Calibrating Layer Sensitivity

If a layer produces too many false positives, it erodes trust. Calibrate before disabling:

### Layer 1 calibration
If Layer 1 (multi-agent review) consistently flags stylistic preferences as "issues":
- Tighten the review prompt with explicit exclusions: "do not flag naming conventions"
- Add CLAUDE.md context so agents understand project conventions

### Layer 5 calibration
If Layer 5 (adversarial) consistently flags inputs that are structurally impossible:
- Add a "constraints" section to the plan: "Skill IDs are always validated by the CLI parser before reaching the registry"
- The adversarial agent uses plan constraints to focus on realistic attack vectors

### Layer 7 calibration
If Layer 7 (regression) flags tests that were already failing before this phase:
- Document pre-existing failures in `.sun/known-failures.json`
- Layer 7 excludes known failures from its regression check

---

## Summary: The Full 7-Layer Stack

| # | Layer | Kind | Run time | Blocks ship |
|---|-------|------|----------|-------------|
| 1 | Multi-agent cross-review | Probabilistic | 30-90s | Yes |
| 2 | Guardrails (lint + tsc + tests) | Deterministic | 5-30s | Yes |
| 3 | BDD criteria check | Deterministic | 10-30s | Yes |
| 4 | Permission audit | Deterministic | 5-15s | Yes |
| 5 | Adversarial testing | Probabilistic | 30-120s | Yes (unless skipped) |
| 6 | Cross-model verification | Probabilistic | 30-90s | No (skippable) |
| 7 | Regression boundary check | Deterministic | 15-60s | Yes (unless additive-only) |

Total wall time for a full verification pass: 2-7 minutes depending on codebase size and model latency.

This is the cost of confidence. A phase that ships without verification saves 5 minutes. A production bug costs hours or days. The 7-layer stack is the most efficient path to justified confidence.

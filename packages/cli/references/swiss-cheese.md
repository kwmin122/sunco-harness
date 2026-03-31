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

## When to Run All 6 Layers

Always run all 6 layers before `/sunco:ship`. The verification pipeline exists to catch what execution missed — skipping layers reduces confidence in the ship decision.

Acceptable skip conditions:
- `--skip-adversarial`: use only for phases with no external inputs
- `--skip-codex`: use when Codex plugin is not installed (does not block)
- `--layer N`: use when re-running after fixing a specific layer's failure

Never skip Layer 2 (guardrails). It is the fastest and most reliable layer. If Layer 2 fails, no other layer result is meaningful.

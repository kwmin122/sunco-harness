# Verification Patterns

How to verify that built features are real implementations, not stubs, and that they work as intended. Applied by `/sunco:verify`, `/sunco:validate`, and pre-ship checks.

---

## Core Principle: Existence ≠ Implementation

A file existing does not mean the feature works. Verification must check four things:

1. **Exists** — File is present at expected path
2. **Substantive** — Content is real implementation, not placeholder or stub
3. **Wired** — Connected to the rest of the system (imported, registered, mounted)
4. **Functional** — Actually works when invoked

Levels 1-3 are checkable programmatically via grep and AST analysis. Level 4 often requires test execution or human verification.

---

## The 7 Verification Patterns

### Pattern 1: Existence Check

**What it verifies:** The artifact is present where it's expected.

**When to use:** First check in any verification sequence. If this fails, skip remaining patterns.

```bash
# File exists
[ -f "packages/core/src/registry/skill-registry.ts" ] && echo "EXISTS" || echo "MISSING"

# Directory structure
[ -d "packages/skills-harness/src" ] && echo "EXISTS"

# Export present
grep -E "export (default |const |function |class )" packages/core/src/registry/skill-registry.ts

# Named export
grep "export.*SkillRegistry" packages/core/src/registry/skill-registry.ts
```

**Common false positive:** File exists from a prior failed attempt and contains empty or stub content. Always follow with Pattern 2.

---

### Pattern 2: Stub Detection

**What it verifies:** Content is real implementation, not placeholder code.

**When to use:** After existence check, before running tests.

**Universal stub signals:**
```bash
# Comment stubs
grep -iE "(TODO|FIXME|XXX|HACK|PLACEHOLDER|implement|add later|coming soon)" "$file"
grep -E "// \.\.\.|/\* \.\.\. \*/|// stub|// placeholder" "$file"

# Empty function bodies
grep -E "^\s*\}\s*$" "$file" -c  # Count closing braces
# Compare to opening braces — equal count doesn't mean non-empty

# Trivial returns
grep -E "return (null|undefined|\{\}|\[\]|''|\"\")" "$file"
grep -E "return Promise\.resolve\(\)|async.*\{.*\}" "$file"  # Empty async

# Log-only functions
grep -E "console\.(log|warn|error).*only|^[^{]*\{[^}]*console\.[a-z]+[^}]*\}" "$file"
```

**TypeScript-specific stub patterns:**
```typescript
// RED FLAGS — These are stubs:
function processSkill(skill: Skill): void {
  // TODO: implement
}

async function loadConfig(): Promise<Config> {
  return {} as Config  // Cast to silence TypeScript
}

class SkillRegistry {
  register(skill: Skill): void {}  // Empty body
}

// Also stubs — throws not-implemented:
throw new Error('Not implemented')
throw new Error('TODO')
```

**Non-stub markers (positive signals):**
```bash
# Real implementations have these
grep -E "import.*from|require\(" "$file"  # Has dependencies
grep -E "(return|throw|await|yield)" "$file"  # Has real logic
grep -E "(if|switch|for|while|try)" "$file"  # Has control flow
```

---

### Pattern 3: Wiring Check

**What it verifies:** The implementation is connected to the rest of the system.

**When to use:** After stub detection passes. A perfect implementation that nothing imports has zero impact.

```bash
# Something imports this module
grep -rE "from ['\"].*skill-registry" packages/ --include="*.ts"

# Skill is registered in the registry
grep -rE "register\(.*SkillRegistry|registry\.add\|loader\.register" packages/ --include="*.ts"

# CLI command is mounted
grep -rE "program\.command\|registerSkill\|defineSkill" packages/cli/src/ --include="*.ts"

# Config schema is referenced
grep -rE "SkillRegistrySchema|z\.object.*registry" packages/ --include="*.ts"
```

**Wiring failure example:**

A `skill-registry.ts` file with a complete `SkillRegistry` implementation that is never imported by `skill-loader.ts` means no skills can be loaded. Tests for `SkillRegistry` in isolation may all pass while the feature is completely broken in context.

**Fix:** Trace the dependency chain from the entry point backward. If the chain has a gap, the feature is not wired.

---

### Pattern 4: Test Coverage Check

**What it verifies:** The feature has tests that would catch regression.

**When to use:** Before shipping. Tests are evidence that the implementation was validated, not just written.

```bash
# Test file exists
find packages/ -name "*.test.ts" | xargs grep -l "SkillRegistry"

# Test file has more than import statements
TEST_FILE="packages/core/src/__tests__/skill-registry.test.ts"
grep -c "it\|test\|describe" "$TEST_FILE"  # Count test cases

# Tests actually run and pass
npm test --filter=@sunco/core -- --run 2>&1 | tail -5
```

**Coverage thresholds (SUNCO defaults):**

| Layer | Minimum coverage | Rationale |
|-------|-----------------|-----------|
| Domain (pure functions) | 90% | Business logic, no I/O, easy to test |
| Services | 75% | Some integration complexity |
| Infra adapters | 60% | I/O-heavy, integration tests preferred |
| CLI entry points | 40% | Hard to unit test, manual verification covers |

**Common false positive:** High line coverage from trivial tests that only check that functions don't throw. Coverage without assertions is misleading.

---

### Pattern 5: Functional Verification

**What it verifies:** The feature works when invoked in its actual runtime context.

**When to use:** After tests pass. Tests can be wrong; functional verification runs the real binary.

```bash
# CLI command runs without error
sunco --help | grep "skill-name"
sunco skill-name --dry-run 2>&1; echo "Exit: $?"

# Output has expected shape
sunco status --json | jq '.phase' 2>&1

# State changes persist
sunco note "test note"
sunco query --filter notes | grep "test note"

# Error cases return correct exit code
sunco lint nonexistent-path 2>&1; echo "Exit: $?" | grep "Exit: 1"
```

**Functional verification is not optional before ship.** Tests verify isolated behavior. Functional verification verifies integrated behavior. Both are needed.

---

### Pattern 6: Regression Check

**What it verifies:** The new implementation did not break existing functionality.

**When to use:** After any change to shared infrastructure (registry, loader, config, state).

```bash
# Full test suite still passes
npm test --workspaces 2>&1 | tail -10

# Existing skills still register
sunco health | grep "skills loaded"

# Previously working commands still work
sunco status
sunco lint --check

# No new TypeScript errors
npx tsc --noEmit 2>&1 | wc -l  # Should be 0
```

**Regression false positives:** Flaky tests that fail intermittently. When a regression check finds a failure:
1. Run it twice to confirm it's not flaky
2. Check git blame on the failing test — was it already failing before your change?
3. If pre-existing: log as known issue, do not block ship

---

### Pattern 7: Nyquist Validation

**What it verifies:** Verification sampling rate is high enough that gaps cannot slip through.

Named for the Nyquist sampling theorem: to reliably detect a signal, you must sample at least twice its frequency. Applied to verification: to reliably catch bugs of a given size, you need checks at half that granularity.

**When to use:** When designing the verification strategy for a phase, not during execution.

**The Nyquist principle for software:**
- If bugs can hide in individual functions → test individual functions (unit tests)
- If bugs can hide at integration seams → test integration points (integration tests)
- If bugs can hide in timing/ordering → test under concurrency (race condition tests)
- If bugs can hide under adversarial inputs → test with crafted bad inputs (adversarial Layer 5)

**Anti-pattern:** Only having end-to-end tests. They verify that *some* path works but may miss bugs in branches not exercised by the happy path. E2E test coverage is necessarily sparse — it samples at too low a frequency for the Nyquist criterion.

**SUNCO verification sampling requirements:**
```
For a skill with N branches:
  - Unit tests: cover each branch individually (1/branch)
  - Integration test: cover at least 1 end-to-end path
  - Adversarial: cover at least N/2 error branches

For a refactor:
  - All existing tests must still pass (regression)
  - New tests for any behavior that changed
```

---

## False Positive Handling

False positives — verification failures that don't represent real bugs — waste time and erode trust in the pipeline. Handle them explicitly.

### Categories of false positives

| Category | Example | How to handle |
|----------|---------|---------------|
| Flaky test | Network timeout in unit test | Mock the network, mark test as flaky pending fix |
| Environment mismatch | Test requires macOS, CI runs Linux | Add platform guard: `test.skipIf(process.platform !== 'darwin')` |
| Pre-existing failure | Test was already failing before this change | Document in blockers, do not block ship for pre-existing |
| Over-strict stub detection | `return null` in a function that correctly returns null | Add comment: `// intentional: null signals missing config` |
| Coverage gap on generated code | Auto-generated serializer has low coverage | Add to `.nycrc` exclude list with justification comment |

### Suppressing false positives

When suppressing a verification signal, always document why:

```typescript
// sunco-verify-ignore: stub-detection — intentional empty default implementation
// The registry's no-op default is overridden in production by RegistryLoader
export function defaultHandler(): void {}
```

```bash
# sunco-verify-ignore: coverage — integration test in __tests__/integration covers this path
# Lines 45-67 are covered by e2e test, not unit test
```

Suppression comments are logged in the verification report. Too many suppressions is a signal that verification rules need recalibration.

---

## Verification Report Format

`/sunco:verify` produces a structured report consumed by `/sunco:ship`.

```json
{
  "version": 1,
  "phase": "03-skill-registry",
  "plan": "02",
  "timestamp": "2026-03-31T14:30:00Z",
  "layers": {
    "1_multi_agent": { "status": "passed", "findings": [] },
    "2_guardrails": { "status": "passed", "findings": [] },
    "3_bdd": { "status": "passed", "findings": [] },
    "4_permissions": { "status": "passed", "findings": [] },
    "5_adversarial": { "status": "passed", "findings": ["edge: empty skill id returns INVALID_ID, not crash"] },
    "6_cross_model": { "status": "skipped", "reason": "codex plugin not installed" },
    "7_patterns": { "status": "passed", "patternsRun": ["existence", "stub", "wiring", "functional"] }
  },
  "overallStatus": "passed",
  "shipAllowed": true,
  "suppressions": 0,
  "falsePositives": 0
}
```

`shipAllowed: true` requires:
- All layers: `passed` or `skipped`
- No layers: `failed`
- `suppressions` reviewed (non-zero requires human sign-off)

---

## Quick Reference: When to Use Each Pattern

| Scenario | Patterns to run |
|----------|----------------|
| New skill file created | 1 (exists), 2 (stub), 3 (wired), 4 (tested) |
| Refactor of existing feature | 2 (stub), 4 (tests), 6 (regression) |
| Config schema change | 3 (wired), 5 (functional), 6 (regression) |
| New CLI command added | 1, 2, 3, 5 |
| Pre-ship validation | All 7 patterns |
| Wave checkpoint | 2, 4, 5 (fast subset) |
| Post-crash resume | 2, 6 (confirm nothing broken) |

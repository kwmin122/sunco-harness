# Benchmark — Performance Baseline & Regression Detection

Measure build time, bundle size, test execution speed, and custom benchmarks. Compare against baselines to detect regressions. Track trends over time.

---

## Arguments

Parse `$ARGUMENTS`:
- `--baseline` → capture baseline measurements
- `--compare` → compare against saved baseline
- `--trend` → show historical trends
- (no flags) → full benchmark with comparison if baseline exists

---

## Step 1: Detect Project

```bash
# Detect build tools
[ -f turbo.json ] && echo "BUILD:turbo"
[ -f tsup.config.ts ] || [ -f tsup.config.js ] && echo "BUILD:tsup"
[ -f vite.config.ts ] && echo "BUILD:vite"
[ -f webpack.config.js ] && echo "BUILD:webpack"

# Detect test runner
[ -f vitest.config.ts ] || [ -f vitest.config.js ] && echo "TEST:vitest"
[ -f jest.config.ts ] || [ -f jest.config.js ] && echo "TEST:jest"

# Detect bench files
find . -name '*.bench.ts' -o -name '*.bench.js' 2>/dev/null | grep -v node_modules | head -5

# Detect package structure
ls packages/*/package.json 2>/dev/null | head -10 || ls package.json 2>/dev/null
```

---

## Step 2: Measure Build Performance

```bash
# Clean build (cold)
rm -rf dist/ packages/*/dist/ .turbo/ 2>/dev/null
time npx turbo build 2>&1 || time npx tsup 2>&1
```

Capture:
- **Cold build time** (after clean)
- **Warm build time** (immediate re-run, if applicable)
- Exit code (build success/failure)

---

## Step 3: Measure Bundle Size

```bash
# Per-package bundle sizes
for dir in packages/*/dist; do
  [ -d "$dir" ] && echo "$dir: $(du -sh "$dir" 2>/dev/null | cut -f1)"
done

# Total dist size
du -sh packages/*/dist 2>/dev/null
du -sh dist 2>/dev/null

# Individual file sizes for largest bundles
find packages/*/dist -name '*.js' -o -name '*.cjs' -o -name '*.mjs' 2>/dev/null | xargs ls -lhS 2>/dev/null | head -15
```

---

## Step 4: Measure Test Performance

```bash
# Vitest with timing
time npx vitest run --reporter=verbose 2>&1 | tail -20
```

Capture:
- Total test count
- Pass/fail count
- Total execution time
- Slowest test files (if vitest reports)

---

## Step 5: Run Vitest Bench (if bench files exist)

```bash
# Only if .bench.ts files were found in Step 1
npx vitest bench 2>&1 | tail -30
```

Capture benchmark results: ops/sec, mean time, min/max.

---

## Step 6: Baseline Mode (--baseline)

Save all measurements to `.sun/benchmarks/baseline.json`:

```json
{
  "timestamp": "<ISO>",
  "branch": "<current branch>",
  "commit": "<short hash>",
  "build": {
    "cold_ms": 5200,
    "warm_ms": 1800
  },
  "bundle": {
    "total_bytes": 125000,
    "packages": {
      "core": 45000,
      "cli": 80000
    }
  },
  "tests": {
    "total": 883,
    "passed": 883,
    "failed": 0,
    "duration_ms": 4500
  },
  "bench": {}
}
```

Tell user: "Baseline saved. Make your changes, then run `/sunco:benchmark --compare`."

---

## Step 7: Comparison

If baseline exists (or `--compare` mode), compare:

```
PERFORMANCE REPORT
══════════════════
Branch: [current] vs baseline ([baseline branch])
Commit: [current sha] vs [baseline sha]

Metric              Baseline    Current     Delta    Status
────────            ────────    ───────     ─────    ──────
Cold Build          5.2s        6.8s        +1.6s    WARNING
Warm Build          1.8s        2.0s        +0.2s    OK
Total Bundle        122KB       185KB       +63KB    REGRESSION
  core/             45KB        45KB        +0KB     OK
  cli/              77KB        140KB       +63KB    REGRESSION
Test Count          883         910         +27      OK
Test Duration       4.5s        5.2s        +0.7s    OK
Test Pass Rate      100%        100%        0%       OK
```

**Regression thresholds:**
| Metric | WARNING | REGRESSION |
|--------|---------|------------|
| Build time | >15% increase | >25% increase |
| Bundle size | >5% increase | >10% increase |
| Test duration | >25% increase | >50% increase |
| Test pass rate | <100% | <95% |

---

## Step 8: Trend Analysis (--trend)

```bash
ls -t .sun/benchmarks/*.json 2>/dev/null
```

Load historical data and show trends:

```
PERFORMANCE TRENDS (last 5 benchmarks)
══════════════════════════════════════
Date        Build   Bundle    Tests   Pass Rate
2026-03-20  5.0s    110KB     850     100%
2026-03-25  5.2s    122KB     883     100%
2026-03-30  5.5s    135KB     900     100%
2026-04-01  6.8s    185KB     910     100%

TREND: Bundle size growing ~25KB/week. Investigate.
       Build time increasing. Check for new dependencies.
```

---

## Step 9: Save Report

```bash
mkdir -p .sun/benchmarks
```

Save to `.sun/benchmarks/{date}-benchmark.json`.

---

## Step 10: Summary

```
BENCHMARK SUMMARY
═════════════════
Build:    [OK / WARNING / REGRESSION]
Bundle:   [OK / WARNING / REGRESSION]
Tests:    [OK / WARNING / REGRESSION]
Bench:    [OK / WARNING / REGRESSION / N/A]

VERDICT: [ALL CLEAR / N REGRESSIONS DETECTED]
```

If regressions detected, list each with the specific metric and recommendation.

---

## Important Rules

- **Measure, don't guess.** Use actual timing data, not estimates.
- **Baseline is essential.** Without a baseline, report absolute numbers but can't detect regressions.
- **Relative thresholds, not absolute.** 6s build time is fine for a large monorepo, terrible for a single package.
- **Bundle size is the leading indicator.** Build time varies with system load. Bundle size is deterministic.
- **Read-only by default.** Produce the report. Don't modify code unless explicitly asked.

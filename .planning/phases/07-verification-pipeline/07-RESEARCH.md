# Phase 7: Verification Pipeline - Research

**Researched:** 2026-03-28
**Domain:** Multi-layer verification, test coverage auditing, test generation, review pipeline routing
**Confidence:** HIGH

## Summary

Phase 7 implements the 5-layer Swiss cheese verification model (`sunco verify`), a deterministic test coverage audit skill (`sunco validate`), an agent-powered test generation skill (`sunco test-gen`), and the 6-stage review pipeline routing rules. This phase builds on top of every prior phase: it reuses the AgentRouter's `crossVerify()` and `run()` for multi-agent dispatch (Phase 1), `ctx.run('harness.lint')` and `ctx.run('harness.guard')` for deterministic layers (Phase 2), `loadTribalPatterns()` for tribal knowledge (Phase 2), `parsePlanMd()` for acceptance criteria extraction (Phase 5/6), `resolvePhaseDir()` for artifact discovery (Phase 5), and the recommendation engine's `RECOMMENDATION_RULES[]` array for pipeline routing (Phase 1).

The codebase has 39 completed plans across 6 phases. The established patterns are clear: `defineSkill()` with typed `SkillContext`, `vi.mock()` + `createMockContext()` for testing, prompt builders as pure functions in `prompts/`, shared utilities in `shared/`, and structured `SkillResult` returns. All three new skills follow these patterns exactly. The verify skill is the most complex (kind: 'prompt', directExec routing, 5 sequential layers with parallel expert dispatch in Layer 1), validate is the simplest (kind: 'deterministic', Vitest JSON coverage parsing), and test-gen is a standard agent skill (kind: 'prompt').

**Primary recommendation:** Build verify as a single skill file with layer functions factored into a `shared/verify-layers.ts` module. Create 7 prompt builder files for expert agents. Add 10-15 recommender rules to the existing `rules.ts`. Use Vitest's `--coverage.reporter=json-summary` for validate's coverage parsing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Sequential 5-layer execution: Layer 1 (multi-agent generation) -> Layer 2 (deterministic guardrails) -> Layer 3 (BDD acceptance criteria) -> Layer 4 (permission scoping check) -> Layer 5 (adversarial verification). Each layer produces findings. A layer failure doesn't stop subsequent layers -- all execute for comprehensive reporting.
- D-02: Layer 1 -- Multi-Agent Generation (VRF-01): 4 expert agents (Security, Performance, Architecture, Correctness) dispatched in parallel via Promise.allSettled(). A 5th coordinator agent synthesizes findings. Each expert uses role: 'verification' with read + test permissions.
- D-03: Layer 2 -- Deterministic Guardrails (VRF-02): Calls `sunco lint` and `sunco guard` internally via ctx.run(). No agent dispatch needed -- pure deterministic. Results from lint violations and guard anti-patterns feed into the report.
- D-04: Layer 3 -- BDD Acceptance Criteria (VRF-03): Reads PLAN.md must_haves and acceptance_criteria. For each criterion, runs a verification check (grep, file existence, test command). Reports pass/fail per criterion.
- D-05: Layer 4 -- Permission Scoping (VRF-04): Verifies that execution agents operated within their permitted paths. Compares git diff file paths against plan's files_modified list. Flags any file modifications outside the declared scope.
- D-06: Layer 5 -- Adversarial Verification (VRF-05): A separate verification agent (different from execution agents) receives the diff and original intent (CONTEXT.md). Tasked with finding ways the implementation fails to meet the intent. Uses role: 'verification'.
- D-07: Intent Reconstruction (VRF-07): Compares results against original intent from CONTEXT.md and PLAN.md must_haves, not just the diff. "Did we build what we intended?" rather than "Does the diff look clean?"
- D-08: Scenario Holdout (VRF-08): Reads .sun/scenarios/ (BDD Given/When/Then files created by discuss skill). These scenarios are invisible to coding agents but automatically loaded and checked by verification. If a scenario fails, it's a signal that the implementation drifted from intent.
- D-09: Nyquist Principle (VRF-09): Per-task verification -- each task commit triggers a focused micro-verification (tests pass, acceptance criteria met) before proceeding. This is built into the execute skill's per-task loop, but verify provides the aggregate view.
- D-10: 4 expert agents with focused prompts: Security (OWASP, injection, auth), Performance (complexity, memory, N+1), Architecture (coupling, layer violations, patterns), Correctness (logic, edge cases, data flow). Each returns structured findings with severity.
- D-11: Coordinator agent receives all expert findings + the diff and produces a unified verdict: PASS (no critical/high), WARN (only medium/low), FAIL (critical or high findings).
- D-12: Expert prompts in `packages/skills-workflow/src/prompts/verify-*.ts` (verify-security.ts, verify-performance.ts, verify-architecture.ts, verify-correctness.ts, verify-coordinator.ts, verify-adversarial.ts, verify-intent.ts).
- D-13: Deterministic skill (kind: 'deterministic'). Runs test suite, parses coverage output, produces a structured report: lines covered, branches covered, uncovered files, overall percentage.
- D-14: Uses Vitest's coverage reporting (c8/istanbul). Parses JSON coverage output for structured analysis.
- D-15: Report includes: overall score, per-file coverage, uncovered critical paths, comparison with previous snapshot (if exists in .sun/ state).
- D-16: Agent-powered skill (kind: 'prompt'). Generates unit and E2E tests for specified files or entire phase output.
- D-17: `--mock-external` flag activates Digital Twin mode (REV-04): generates mock servers that mimic external APIs based on API documentation. Uses agent to analyze API docs and produce Express/Fastify mock server code.
- D-18: Generated tests written to `__tests__/` directories following project conventions. Mock servers written to `.sun/mocks/` directory.
- D-19: 6-stage pipeline is a routing table, not a new skill. Each stage maps to existing skills: (1) Idea -> discuss, (2) Spec -> plan, (3) Plan -> review, (4) Execute -> execute, (5) Verify -> verify, (6) Deploy -> ship. The recommender engine (Phase 1) already handles this routing via rules.
- D-20: Add 10-15 new recommender rules for the verification pipeline routing. Rules connect: execute complete -> verify, verify pass -> ship, verify fail -> debug, plan complete -> review.
- D-21: Tribal Knowledge (REV-02): verify loads .sun/tribal/ patterns (already implemented in Phase 2 guard skill's tribal-loader). Tribal violations appear as warnings in the verify report.
- D-22: Human Gates (REV-03): verify includes a `humanRequired` flag in findings. Tribal knowledge matches and regulatory-flagged items require human approval. Other findings are auto-processed.

### Claude's Discretion
- Expert agent prompt details and finding severity thresholds
- Coverage parsing format specifics
- Digital Twin mock server generation approach
- Adversarial verification prompting strategy
- Scenario holdout matching algorithm

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VRF-01 | `sunco verify` Layer 1: Multi-Agent Generation | AgentRouter.crossVerify() for parallel 4-expert dispatch + coordinator synthesis -- pattern from review.skill.ts |
| VRF-02 | `sunco verify` Layer 2: Deterministic Guardrails | ctx.run('harness.lint') + ctx.run('harness.guard') -- inter-skill call pattern from context.ts |
| VRF-03 | `sunco verify` Layer 3: BDD Acceptance Criteria | parsePlanMd().tasks[].done + grep/file-exists checks -- plan-parser.ts provides structure |
| VRF-04 | `sunco verify` Layer 4: Permission Scoping | simple-git diff --name-only vs. plan.frontmatter.files_modified comparison |
| VRF-05 | `sunco verify` Layer 5: Adversarial Verification | Separate agent dispatch via ctx.agent.run() with adversarial prompt |
| VRF-06 | Expert agents: Security, Performance, Architecture, Correctness + Coordinator | 7 prompt builder files in prompts/verify-*.ts following review.ts pattern |
| VRF-07 | Intent Reconstruction | Read CONTEXT.md + PLAN.md must_haves via readPhaseArtifact(), pass to intent prompt |
| VRF-08 | Scenario Holdout | Load .sun/scenarios/ via fileStore.list('scenarios') + fileStore.read(), match against implementation |
| VRF-09 | Nyquist per-task verification | Aggregate view in verify skill; per-task hooks in execute skill (future enhancement or already implicit) |
| VRF-10 | `sunco validate` test coverage audit | Vitest --coverage.reporter=json-summary, parse coverage/coverage-summary.json |
| VRF-11 | `sunco test-gen` test generation + Digital Twin | Agent-powered skill, --mock-external flag for mock server generation |
| REV-01 | 6-stage review pipeline routing | 10-15 new rules in recommend/rules.ts mapping stage transitions |
| REV-02 | Tribal Knowledge Store | Reuse loadTribalPatterns() from guard/tribal-loader.ts |
| REV-03 | Human Gates | humanRequired flag on findings; ui.ask() checkpoint for tribal/regulatory matches |
| REV-04 | Digital Twin mock server generation | test-gen --mock-external; agent generates Express mock server code to .sun/mocks/ |
</phase_requirements>

## Standard Stack

### Core (already installed in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | 3.1.2 | Test runner + coverage provider | Already in devDependencies. Provides `--coverage.reporter=json-summary` for structured JSON output |
| @vitest/coverage-v8 | 3.1.2 | V8 native coverage collection | Peer of vitest. Generates Istanbul-format coverage-summary.json |
| simple-git | 3.33.0 | Git diff for permission scoping (Layer 4) | Already in skills-workflow dependencies |
| smol-toml | 1.6.1 | TOML parsing if needed for config | Already in skills-workflow dependencies |

### Supporting (no new dependencies needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| glob | 13.0.6 | File pattern matching for Layer 3 checks | Already in skills-workflow. For file existence verification in acceptance criteria |
| picomatch | (via @sunco/core) | Glob matching for permission scope comparison | Already available through core's permission module |

### New Dependencies
| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| @vitest/coverage-v8 | 3.1.2 | Coverage provider for validate skill | Required to generate coverage JSON. Must match vitest version exactly. Install as devDependency in skills-workflow. |

**Note:** The validate skill needs to spawn `npx vitest run --coverage.enabled --coverage.reporter=json-summary` as a child process (via `execa` or `node:child_process`). Since the monorepo already has vitest installed, no global install is needed. The skill reads the generated `coverage/coverage-summary.json` file.

**Installation:**
```bash
cd packages/skills-workflow && npm install --save-dev @vitest/coverage-v8@3.1.2
```

## Architecture Patterns

### Recommended File Structure
```
packages/skills-workflow/src/
  verify.skill.ts          # Main verify skill (VRF-01 through VRF-09)
  validate.skill.ts        # Coverage audit skill (VRF-10)
  test-gen.skill.ts        # Test generation skill (VRF-11)
  shared/
    verify-layers.ts       # Layer execution functions
    verify-types.ts        # VerifyFinding, VerifyReport, LayerResult types
    coverage-parser.ts     # Parse coverage-summary.json into structured report
  prompts/
    verify-security.ts     # Security expert prompt (D-12)
    verify-performance.ts  # Performance expert prompt (D-12)
    verify-architecture.ts # Architecture expert prompt (D-12)
    verify-correctness.ts  # Correctness expert prompt (D-12)
    verify-coordinator.ts  # Coordinator synthesis prompt (D-12)
    verify-adversarial.ts  # Adversarial verification prompt (D-12)
    verify-intent.ts       # Intent reconstruction prompt (D-12)
    test-gen.ts            # Test generation prompt
    test-gen-mock.ts       # Digital Twin mock generation prompt
packages/core/src/recommend/
    rules.ts               # ADD 10-15 new verification pipeline rules (REV-01)
```

### Pattern 1: Verify Skill -- Sequential Layers with Parallel Agents
**What:** 5 layers execute sequentially. Layer 1 internally dispatches 4 agents in parallel via `Promise.allSettled()`. Each layer returns a `LayerResult` with findings. All layers run regardless of individual failures (Swiss cheese model).
**When to use:** This is the core verify pattern.
**Example:**
```typescript
// verify.skill.ts -- core execution flow
interface LayerResult {
  layer: number;
  name: string;
  findings: VerifyFinding[];
  passed: boolean;
  durationMs: number;
}

interface VerifyFinding {
  layer: number;
  source: string;          // 'security' | 'performance' | ... | 'lint' | 'guard' | 'acceptance' | 'scope' | 'adversarial' | 'intent' | 'scenario'
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  file?: string;
  line?: number;
  suggestion?: string;
  humanRequired?: boolean; // REV-03: tribal/regulatory flags
}

type VerifyVerdict = 'PASS' | 'WARN' | 'FAIL';

interface VerifyReport {
  verdict: VerifyVerdict;
  layers: LayerResult[];
  findings: VerifyFinding[];
  humanGateRequired: boolean;
  timestamp: string;
}

// Layer execution (all 5 run regardless of failures)
const layer1 = await runLayer1MultiAgent(ctx, diff, phaseDir);
const layer2 = await runLayer2Deterministic(ctx);
const layer3 = await runLayer3Acceptance(ctx, plans, phaseDir);
const layer4 = await runLayer4PermissionScope(ctx, diff, plans);
const layer5 = await runLayer5Adversarial(ctx, diff, phaseDir);

const allFindings = [
  ...layer1.findings,
  ...layer2.findings,
  ...layer3.findings,
  ...layer4.findings,
  ...layer5.findings,
];

const verdict: VerifyVerdict =
  allFindings.some(f => f.severity === 'critical' || f.severity === 'high') ? 'FAIL' :
  allFindings.some(f => f.severity === 'medium' || f.severity === 'low') ? 'WARN' :
  'PASS';
```

### Pattern 2: Layer 1 -- Parallel Expert Agents via crossVerify
**What:** Dispatch 4 expert agents in parallel. Each gets a specialized prompt. A 5th coordinator agent synthesizes their findings into a verdict.
**When to use:** Layer 1 of verify.
**Example:**
```typescript
// Layer 1: Multi-Agent Generation
async function runLayer1MultiAgent(
  ctx: SkillContext, diff: string, phaseDir: string
): Promise<LayerResult> {
  const start = Date.now();

  // 4 expert prompts
  const experts = [
    { name: 'security', prompt: buildVerifySecurityPrompt(diff) },
    { name: 'performance', prompt: buildVerifyPerformancePrompt(diff) },
    { name: 'architecture', prompt: buildVerifyArchitecturePrompt(diff) },
    { name: 'correctness', prompt: buildVerifyCorrectnessPrompt(diff) },
  ];

  // Dispatch all 4 in parallel via Promise.allSettled
  const results = await Promise.allSettled(
    experts.map(expert =>
      ctx.agent.run({
        role: 'verification',
        prompt: expert.prompt,
        permissions: VERIFICATION_PERMISSIONS,
        timeout: 120_000,
      })
    )
  );

  // Collect findings from successful experts
  const expertFindings: VerifyFinding[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      const parsed = parseExpertFindings(result.value.outputText, experts[i].name);
      expertFindings.push(...parsed);
    }
  }

  // Coordinator synthesizes
  const coordinatorResult = await ctx.agent.run({
    role: 'verification',
    prompt: buildVerifyCoordinatorPrompt(expertFindings, diff),
    permissions: VERIFICATION_PERMISSIONS,
    timeout: 60_000,
  });

  // ... parse coordinator verdict

  return {
    layer: 1,
    name: 'Multi-Agent Generation',
    findings: expertFindings,
    passed: !expertFindings.some(f => f.severity === 'critical' || f.severity === 'high'),
    durationMs: Date.now() - start,
  };
}
```

### Pattern 3: Layer 2 -- Inter-Skill Calls for Deterministic Checks
**What:** Call existing lint and guard skills via `ctx.run()`. Extract findings from their results.
**When to use:** Layer 2 of verify.
**Example:**
```typescript
async function runLayer2Deterministic(ctx: SkillContext): Promise<LayerResult> {
  const start = Date.now();
  const findings: VerifyFinding[] = [];

  // Call lint skill
  const lintResult = await ctx.run('harness.lint', { json: true });
  if (!lintResult.success && lintResult.data) {
    const data = lintResult.data as { violations: Array<{ file: string; line: number; violation: string; severity: string }> };
    for (const v of data.violations ?? []) {
      findings.push({
        layer: 2,
        source: 'lint',
        severity: v.severity === 'error' ? 'high' : 'medium',
        description: v.violation,
        file: v.file,
        line: v.line,
      });
    }
  }

  // Call guard skill
  const guardResult = await ctx.run('harness.guard', { json: true });
  if (guardResult.data) {
    const data = guardResult.data as { tribalWarnings: Array<{ file: string; line: number; message: string }> };
    for (const w of data.tribalWarnings ?? []) {
      findings.push({
        layer: 2,
        source: 'tribal',
        severity: 'low',
        description: w.message,
        file: w.file,
        line: w.line,
        humanRequired: true, // Tribal matches require human review (REV-03)
      });
    }
  }

  return {
    layer: 2,
    name: 'Deterministic Guardrails',
    findings,
    passed: findings.every(f => f.severity !== 'critical' && f.severity !== 'high'),
    durationMs: Date.now() - start,
  };
}
```

### Pattern 4: Layer 4 -- Permission Scope Comparison
**What:** Compare git diff file paths against plan's declared files_modified. Flag out-of-scope modifications.
**When to use:** Layer 4 of verify.
**Example:**
```typescript
async function runLayer4PermissionScope(
  ctx: SkillContext, diff: string, plans: ParsedPlan[]
): Promise<LayerResult> {
  const start = Date.now();
  const git = simpleGit(ctx.cwd);
  const diffFiles = await git.diff(['--name-only', 'HEAD~1']);
  const modifiedFiles = diffFiles.split('\n').filter(Boolean);

  // Collect all declared files_modified from all plans
  const declaredFiles = new Set<string>();
  for (const plan of plans) {
    for (const file of plan.frontmatter.files_modified) {
      declaredFiles.add(file);
    }
  }

  // Use picomatch for glob matching
  const isAllowed = picomatch([...declaredFiles], { dot: true });

  const findings: VerifyFinding[] = [];
  for (const file of modifiedFiles) {
    if (!isAllowed(file) && !declaredFiles.has(file)) {
      findings.push({
        layer: 4,
        source: 'scope',
        severity: 'medium',
        description: `File modified outside declared scope: ${file}`,
        file,
      });
    }
  }

  return {
    layer: 4,
    name: 'Permission Scoping',
    findings,
    passed: findings.length === 0,
    durationMs: Date.now() - start,
  };
}
```

### Pattern 5: Coverage Parser for validate
**What:** Run vitest with coverage, parse the JSON summary output.
**When to use:** validate skill.
**Example:**
```typescript
// coverage-parser.ts
interface CoverageMetric {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

interface FileCoverage {
  path: string;
  lines: CoverageMetric;
  statements: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
}

interface CoverageReport {
  overall: {
    lines: CoverageMetric;
    statements: CoverageMetric;
    branches: CoverageMetric;
    functions: CoverageMetric;
  };
  files: FileCoverage[];
  uncoveredFiles: string[];
  previousSnapshot?: CoverageReport['overall'];
  delta?: {
    lines: number;
    statements: number;
    branches: number;
    functions: number;
  };
}

// Parse coverage-summary.json (Istanbul format from @vitest/coverage-v8)
function parseCoverageSummary(jsonContent: string): CoverageReport {
  const data = JSON.parse(jsonContent);
  const overall = data.total;
  const files: FileCoverage[] = [];

  for (const [path, metrics] of Object.entries(data)) {
    if (path === 'total') continue;
    files.push({ path, ...(metrics as Record<string, CoverageMetric>) });
  }

  const uncoveredFiles = files
    .filter(f => f.lines.pct === 0)
    .map(f => f.path);

  return { overall, files, uncoveredFiles };
}
```

### Pattern 6: Recommender Rules for Pipeline Routing
**What:** Add rules to the existing RECOMMENDATION_RULES array.
**When to use:** REV-01 implementation.
**Example:**
```typescript
// New rules for verification pipeline routing
const verificationPipelineRules: RecommendationRule[] = [
  // After validate success -> test-gen (fill coverage gaps)
  rule(
    'after-validate-low-coverage',
    'After coverage audit with low coverage, generate tests',
    (s) => lastWas(s, 'workflow.validate') && lastSucceeded(s) &&
           (s.lastResult?.data as any)?.overall?.lines?.pct < 80,
    () => [
      rec('workflow.test-gen', 'Generate tests', 'Coverage below 80% -- generate tests', 'high'),
    ],
  ),

  // After test-gen success -> validate (check coverage improved)
  rule(
    'after-test-gen-success',
    'After test generation, re-validate coverage',
    (s) => lastWas(s, 'workflow.test-gen') && lastSucceeded(s),
    () => [
      rec('workflow.validate', 'Re-validate coverage', 'Tests generated -- check coverage improvement', 'high'),
    ],
  ),

  // After review success -> execute
  rule(
    'after-review-success',
    'After review approval, execute the plan',
    (s) => lastWas(s, 'workflow.review') && lastSucceeded(s),
    () => [
      rec('workflow.execute', 'Execute plan', 'Review passed -- proceed to execution', 'high'),
    ],
  ),
];
```

### Anti-Patterns to Avoid
- **Stopping on layer failure:** The Swiss cheese model requires ALL 5 layers to run regardless of individual failures. Never short-circuit.
- **Sharing findings between layers during execution:** Each layer is independent. Don't pass Layer 1's findings into Layer 3's prompt -- they check different things.
- **Making tribal warnings into errors:** D-21 is clear: tribal knowledge is soft (warnings), not hard (errors). The `humanRequired` flag handles escalation.
- **Parsing coverage output from terminal text:** Always use `json-summary` reporter and parse structured JSON. Never regex-parse terminal coverage output.
- **Using crossVerify for Layer 1 experts:** crossVerify dispatches the same prompt to multiple providers. Layer 1 needs DIFFERENT prompts per expert. Use `Promise.allSettled()` with individual `ctx.agent.run()` calls.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Coverage collection | Custom V8 profiler integration | @vitest/coverage-v8 + json-summary reporter | Coverage collection is deceptively complex; V8 profiler API changes between Node versions |
| Tribal pattern loading | New tribal file reader | `loadTribalPatterns()` from guard/tribal-loader.ts | Already handles parsing, regex compilation, and error tolerance |
| Git diff analysis | Raw git CLI spawning | `simple-git` (already installed) | Cross-platform, promise-based, handles edge cases |
| Permission scope matching | String comparison | picomatch glob matching (via core) | Glob patterns in files_modified need proper wildcard support |
| Plan parsing | New PLAN.md parser | `parsePlanMd()` from shared/plan-parser.ts | Handles frontmatter, tasks, acceptance criteria extraction |
| Phase directory resolution | Manual path construction | `resolvePhaseDir()` from shared/phase-reader.ts | Handles zero-padded phase number lookup |
| Agent dispatch | Manual fetch/SDK calls | AgentRouter via ctx.agent.run() / ctx.agent.crossVerify() | Handles provider selection, permissions, timeouts, usage tracking |
| Recommendation routing | Custom routing engine | Existing RecommenderEngine + new rules in rules.ts | Engine already handles dedup, priority sort, isDefault |

## Common Pitfalls

### Pitfall 1: Layer 1 Expert Agent Timeout
**What goes wrong:** 4 parallel agents + 1 coordinator = 5 agent calls in Layer 1 alone. If the SDK provider is slow or rate-limited, Layer 1 can exceed its timeout.
**Why it happens:** Agent calls are ~30-120s each. Running 4 in parallel is fine, but the sequential coordinator call adds another 30-60s.
**How to avoid:** Set per-expert timeout to 120s (2 min). Set coordinator timeout to 60s. Layer 1 total budget: ~180s (parallel experts complete within 120s, then coordinator within 60s). Use AbortSignal.timeout() per call.
**Warning signs:** Layer 1 taking >3 minutes in test runs.

### Pitfall 2: ctx.run() Circular Invocation
**What goes wrong:** verify calls lint, lint might eventually call verify (if guard integration changes).
**Why it happens:** ctx.run() has circular invocation detection via call stack tracking (context.ts line 139-141). It will throw CircularSkillInvocationError.
**How to avoid:** Keep Layer 2's inter-skill calls simple: only call harness.lint and harness.guard. Never add verify -> verify or verify -> execute calls. The circular detection is already built in as a safety net.
**Warning signs:** CircularSkillInvocationError in tests.

### Pitfall 3: Coverage JSON File Not Found
**What goes wrong:** validate skill runs vitest but the coverage-summary.json doesn't exist at the expected path.
**Why it happens:** Different Vitest configs may output coverage to different directories. The `reportsDirectory` defaults to `./coverage` but can be customized in vitest.config.ts.
**How to avoid:** Parse the target project's vitest.config.ts for `coverage.reportsDirectory` first. Fall back to `./coverage`. Check file existence before parsing. Report clear error if missing.
**Warning signs:** "coverage-summary.json not found" error after test run completes successfully.

### Pitfall 4: Scenario Files Not Created Yet
**What goes wrong:** verify tries to load .sun/scenarios/ for holdout checks (VRF-08) but the discuss skill was run before scenario generation was implemented, or the user skipped discuss.
**Why it happens:** Scenarios are generated by discuss.skill.ts Step 6. If discuss wasn't run for this phase, or if it failed at scenario generation, the directory will be empty.
**How to avoid:** Treat missing/empty scenarios as a soft warning, not a failure. Log "No holdout scenarios found -- Layer 3 scenario check skipped" and continue. The Swiss cheese model means other layers still catch issues.
**Warning signs:** Empty .sun/scenarios/ directory.

### Pitfall 5: Plan files_modified Globs vs Exact Paths
**What goes wrong:** Layer 4 permission scope check fails because plan.frontmatter.files_modified contains glob patterns like `src/verify/**` but git diff returns exact paths like `src/verify/layers.ts`.
**Why it happens:** PLAN.md files_modified field can contain either exact paths or glob patterns. Git diff returns exact paths.
**How to avoid:** Use picomatch to match git diff paths against files_modified globs, not strict string equality. This is the same approach used in permission.ts.
**Warning signs:** False positive "out of scope" findings for files that ARE in declared scope.

### Pitfall 6: validate Skill Needs Child Process for Coverage
**What goes wrong:** Trying to run Vitest programmatically in-process causes module loading conflicts.
**Why it happens:** validate is a deterministic skill that needs to run the test suite of the target project. Running Vitest programmatically within the same process has module resolution issues.
**How to avoid:** Spawn vitest as a child process via `node:child_process` exec/spawn. Use `npx vitest run --coverage.enabled --coverage.reporter=json-summary --coverage.reportsDirectory=.sun/coverage`. Read the JSON output file after process completes.
**Warning signs:** Module resolution errors, Vitest config conflicts.

### Pitfall 7: Expert Agent Output Parsing Failures
**What goes wrong:** Expert agents return markdown or natural language instead of structured JSON despite the prompt requesting JSON.
**Why it happens:** LLMs don't always follow output format instructions perfectly. Claude Code CLI in particular returns output wrapped in markdown.
**How to avoid:** Use the same pattern as review.skill.ts and execute.skill.ts: look for the last ```json block in the output, parse that. Have a fallback that creates a single "unparsed" finding if JSON extraction fails.
**Warning signs:** Empty findings arrays despite agent output containing useful analysis.

### Pitfall 8: Human Gate Blocking in Non-Interactive Mode
**What goes wrong:** verify encounters a `humanRequired` finding and calls `ctx.ui.ask()` which blocks indefinitely in non-interactive/CI contexts.
**Why it happens:** SilentUiAdapter returns default responses. If the default for a human gate is "proceed", it bypasses the gate silently.
**How to avoid:** Collect all `humanRequired` findings. At the end of verification, display them as a summary. Use a `--auto` flag to skip human gates (for CI), or a `--strict` flag to fail on any humanRequired finding. Default behavior: show findings and ask once.
**Warning signs:** CI pipeline hanging on ui.ask() calls.

## Code Examples

### Expert Prompt Builder Pattern
```typescript
// prompts/verify-security.ts
export function buildVerifySecurityPrompt(diff: string): string {
  const truncatedDiff = diff.length > 50_000 ? diff.slice(0, 50_000) + '\n[... truncated]' : diff;

  return `You are a security-focused code review expert. Analyze the following diff for security vulnerabilities.

## Focus Areas
1. **Injection vulnerabilities**: SQL injection, command injection, XSS, template injection
2. **Authentication/Authorization**: Missing auth checks, privilege escalation, token handling
3. **Data exposure**: Secrets in code, PII logging, error message information leakage
4. **Input validation**: Missing sanitization, type confusion, buffer issues
5. **Dependency risks**: Known vulnerable patterns, unsafe deserialization

## Git Diff
\`\`\`diff
${truncatedDiff}
\`\`\`

## Output Format
Return a JSON object:
\`\`\`json
{
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "description": "description of the issue",
      "file": "path/to/file.ts",
      "line": 42,
      "suggestion": "how to fix"
    }
  ]
}
\`\`\`

If no security issues found, return: \`{ "findings": [] }\`
Only output the JSON. No explanation before or after.`;
}
```

### Coordinator Synthesis Prompt Pattern
```typescript
// prompts/verify-coordinator.ts
export function buildVerifyCoordinatorPrompt(
  expertFindings: VerifyFinding[],
  diff: string,
): string {
  const findingsSummary = expertFindings.map(f =>
    `[${f.source}/${f.severity}] ${f.description}${f.file ? ` (${f.file}:${f.line ?? '?'})` : ''}`
  ).join('\n');

  const truncatedDiff = diff.length > 20_000 ? diff.slice(0, 20_000) + '\n[... truncated]' : diff;

  return `You are a verification coordinator. Four expert agents have reviewed a code diff independently. Synthesize their findings into a unified verdict.

## Expert Findings
${findingsSummary || '(no findings from any expert)'}

## Diff Summary
\`\`\`diff
${truncatedDiff}
\`\`\`

## Verdict Rules
- **PASS**: No critical or high severity findings
- **WARN**: Only medium and low severity findings
- **FAIL**: At least one critical or high severity finding

## Output Format
\`\`\`json
{
  "verdict": "PASS|WARN|FAIL",
  "summary": "brief overall assessment",
  "deduplicatedFindings": [
    // Remove duplicates where multiple experts flagged the same issue
    // Keep the highest severity when merging duplicates
  ]
}
\`\`\`

Only output the JSON. No explanation before or after.`;
}
```

### Validate Skill -- Coverage Runner
```typescript
// validate.skill.ts -- core coverage execution
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

async function runCoverageAndParse(cwd: string): Promise<CoverageReport> {
  const coverageDir = join(cwd, '.sun', 'coverage');

  // Run vitest with json-summary reporter
  await execFileAsync('npx', [
    'vitest', 'run',
    '--coverage.enabled',
    '--coverage.provider=v8',
    '--coverage.reporter=json-summary',
    `--coverage.reportsDirectory=${coverageDir}`,
  ], {
    cwd,
    timeout: 120_000,  // 2 minute timeout for test suite
  });

  // Parse the output
  const summaryPath = join(coverageDir, 'coverage-summary.json');
  const content = await readFile(summaryPath, 'utf-8');
  return parseCoverageSummary(content);
}
```

### Scenario Holdout Loading Pattern
```typescript
// shared/verify-layers.ts -- scenario loading for VRF-08
async function loadHoldoutScenarios(fileStore: FileStoreApi): Promise<string[]> {
  const scenarioFiles = await fileStore.list('scenarios');
  const scenarios: string[] = [];

  for (const filename of scenarioFiles) {
    const content = await fileStore.read('scenarios', filename);
    if (content) scenarios.push(content);
  }

  return scenarios;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single reviewer agent | Multi-agent parallel expert review | Phase 6 (review.skill.ts) | Pattern already established; verify extends with specialized experts |
| Terminal text coverage parsing | JSON-summary structured output | Vitest 1.x+ | Reliable, machine-parseable coverage data |
| Manual test writing | Agent-powered test generation | Emerging 2025-2026 | verify/test-gen uses this for coverage gap filling |
| Single-pass verification | 5-layer Swiss cheese model | SUN architecture decision | Independent layers catch what others miss |

## Open Questions

1. **Coverage threshold defaults**
   - What we know: D-15 mentions comparison with previous snapshot
   - What's unclear: What default thresholds should trigger warnings vs failures? 80% lines is common, but project-specific.
   - Recommendation: Default to 80% overall warning, 60% overall failure. Make configurable via .sun/config.toml `[verify.coverage]` section.

2. **Nyquist per-task micro-verification integration**
   - What we know: VRF-09 says "built into the execute skill's per-task loop, but verify provides the aggregate view"
   - What's unclear: Does execute need modification to call verify per-task, or does verify only provide the post-execution aggregate?
   - Recommendation: Verify only provides aggregate view. Execute's per-task verification (running tests after each commit) is already implicit in the execute prompt. No execute modification needed in Phase 7.

3. **Digital Twin mock server runtime**
   - What we know: D-17 says "Express/Fastify mock server code"
   - What's unclear: Which framework? Express is simpler and more universally known.
   - Recommendation: Use Express (zero-config, widely understood by agents). Generate self-contained mock server files that can be started with `node .sun/mocks/mock-server.js`.

4. **Scenario matching algorithm for VRF-08**
   - What we know: Scenarios are Given/When/Then BDD format. Verification agent checks if implementation satisfies them.
   - What's unclear: Is this pure agent analysis (pass scenario + diff to agent) or does it involve automated checks?
   - Recommendation: Pass scenarios + diff + file tree to a verification agent. The agent determines pass/fail for each scenario. This is more reliable than regex matching for BDD scenarios.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All skills | Yes | 22.16.0 | -- |
| npm | Package management | Yes | 10.9.2 | -- |
| Vitest | validate skill | Yes | 3.1.2 | -- |
| @vitest/coverage-v8 | validate skill | No (not yet installed) | -- | Install as devDep; required for validate |
| simple-git | Layer 4 scope check | Yes | 3.33.0 | -- |
| git | diff/log operations | Yes | (system) | -- |

**Missing dependencies with no fallback:**
- @vitest/coverage-v8: Must be installed as devDependency in skills-workflow for validate to function

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.2 |
| Config file | packages/skills-workflow/vitest.config.ts |
| Quick run command | `cd packages/skills-workflow && npx vitest run` |
| Full suite command | `cd /Users/min-kyungwook/SUN && npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VRF-01 | Layer 1 dispatches 4 experts in parallel, returns findings | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/verify.test.ts -x` | Wave 0 |
| VRF-02 | Layer 2 calls ctx.run('harness.lint') and ctx.run('harness.guard') | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/verify.test.ts -x` | Wave 0 |
| VRF-03 | Layer 3 checks acceptance criteria from PLAN.md | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/verify.test.ts -x` | Wave 0 |
| VRF-04 | Layer 4 compares git diff paths against declared scope | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/verify.test.ts -x` | Wave 0 |
| VRF-05 | Layer 5 dispatches adversarial agent with diff + intent | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/verify.test.ts -x` | Wave 0 |
| VRF-06 | Expert prompts include focused analysis areas | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/verify-prompts.test.ts -x` | Wave 0 |
| VRF-07 | Intent reconstruction reads CONTEXT.md and compares to diff | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/verify.test.ts -x` | Wave 0 |
| VRF-08 | Scenario holdout loads .sun/scenarios/ and verifies | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/verify.test.ts -x` | Wave 0 |
| VRF-09 | Nyquist aggregate view (verify provides summary) | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/verify.test.ts -x` | Wave 0 |
| VRF-10 | validate runs vitest coverage and parses JSON output | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/validate.test.ts -x` | Wave 0 |
| VRF-11 | test-gen generates tests and mock servers | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/test-gen.test.ts -x` | Wave 0 |
| REV-01 | New recommender rules fire for verification transitions | unit | `cd packages/core && npx vitest run src/recommend/__tests__/rules.test.ts -x` | Existing (extend) |
| REV-02 | verify loads tribal patterns via loadTribalPatterns() | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/verify.test.ts -x` | Wave 0 |
| REV-03 | humanRequired flag set on tribal/regulatory findings | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/verify.test.ts -x` | Wave 0 |
| REV-04 | test-gen --mock-external generates mock server code | unit | `cd packages/skills-workflow && npx vitest run src/__tests__/test-gen.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/skills-workflow && npx vitest run`
- **Per wave merge:** `cd /Users/min-kyungwook/SUN && npm test`
- **Phase gate:** Full suite green before verify-work

### Wave 0 Gaps
- [ ] `packages/skills-workflow/src/__tests__/verify.test.ts` -- covers VRF-01 through VRF-09, REV-02, REV-03
- [ ] `packages/skills-workflow/src/__tests__/verify-prompts.test.ts` -- covers VRF-06 prompt builders
- [ ] `packages/skills-workflow/src/__tests__/validate.test.ts` -- covers VRF-10
- [ ] `packages/skills-workflow/src/__tests__/test-gen.test.ts` -- covers VRF-11, REV-04
- [ ] `packages/core/src/recommend/__tests__/rules.test.ts` -- extend existing file for REV-01 rules
- [ ] `@vitest/coverage-v8` installation: `cd packages/skills-workflow && npm install --save-dev @vitest/coverage-v8@3.1.2`

## Sources

### Primary (HIGH confidence)
- Codebase analysis: review.skill.ts, router.ts, permission.ts, types.ts, plan-parser.ts, tribal-loader.ts -- all read directly
- Codebase analysis: rules.ts, engine.ts -- recommendation engine patterns
- Codebase analysis: discuss.skill.ts, discuss-scenario.ts -- scenario holdout generation
- Codebase analysis: execute.skill.ts -- execution pattern, plan parsing, worktree management
- [Vitest Coverage Config](https://vitest.dev/config/coverage) -- coverage.reporter, coverage.reportsDirectory options

### Secondary (MEDIUM confidence)
- [Istanbul JSON Summary Format](https://github.com/gotwarlost/istanbul/blob/master/coverage.json.md) -- coverage-summary.json schema (total/covered/skipped/pct per metric)
- [Vitest Coverage Guide](https://vitest.dev/guide/coverage) -- v8 vs istanbul provider, reporter configuration

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified in codebase. Only @vitest/coverage-v8 is new.
- Architecture: HIGH -- patterns directly extrapolated from review.skill.ts, execute.skill.ts, and guard.skill.ts which follow identical structure.
- Pitfalls: HIGH -- derived from reading actual codebase code paths, not hypothetical.
- Prompt engineering: MEDIUM -- expert prompt details are Claude's discretion, example patterns provided but agent behavior is inherently variable.
- Coverage parsing: HIGH -- Istanbul JSON summary format is well-documented and stable.

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable libraries, project-internal patterns)

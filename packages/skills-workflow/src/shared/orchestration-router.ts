/**
 * Orchestration router — deterministic task-to-role mapping.
 *
 * Inspired by OmO (cexll/myclaude)'s Sisyphus orchestrator and gstack's
 * role-based sprint discipline. NO CODE was copied from either source:
 * OmO is AGPL-3.0, gstack is role-scoped prompts. Only the *principles*
 * are reimplemented here clean-room:
 *
 *   - no fixed pipeline — route by task signals
 *   - location-unknown bugs need an explorer pass first
 *   - external APIs pull in a librarian
 *   - risky architecture consults an oracle read-only
 *   - UI work routes to a frontend specialist
 *   - docs-only work routes to a document writer
 *   - the orchestrator NEVER writes code itself
 *
 * All classification is keyword/regex-based so it can run under SUNCO's
 * Deterministic-First rule (zero LLM cost). The chosen roles are then
 * delegated via the regular SUNCO skill chain (ctx.run) or the
 * sunco-* subagent taxonomy — never as a raw prompt.
 */

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

/** Roles SUNCO's orchestrator can route to. */
export type OrchestrationRole =
  | 'explorer'
  | 'librarian'
  | 'oracle'
  | 'developer'
  | 'frontend'
  | 'docs'
  | 'verifier'
  | 'debugger';

/** Signals extracted from a natural-language task description. */
export interface TaskSignal {
  kind:
    | 'unknown-location'
    | 'external-api'
    | 'risky-change'
    | 'ui-surface'
    | 'docs-only'
    | 'test-failure'
    | 'explicit-verify'
    | 'exact-file'
    | 'default';
  evidence: string;
}

/** A single routed step. Order inside a plan matters. */
export interface RoutedStep {
  role: OrchestrationRole;
  reason: string;
  /** SUNCO skill/subagent to delegate to. */
  delegate: string;
  /** Whether this step is read-only (true for explorer/librarian/oracle). */
  readOnly: boolean;
}

/** Context pack passed between roles. Keeps original intent + prior outputs. */
export interface ContextPack {
  /** Original user-facing task. Never mutated. */
  originalRequest: string;
  /** Files the user explicitly named (exact paths). */
  explicitFiles: string[];
  /** Accumulated outputs from prior steps, newest last. */
  priorOutputs: Array<{
    role: OrchestrationRole;
    summary: string;
  }>;
}

// ---------------------------------------------------------------------------
// Signal detection
// ---------------------------------------------------------------------------

const LOC_PATTERNS = [
  /\bwhere\s+is\b/i,
  /\bfind\s+(?:the|a|where)\b/i,
  /\blocate\b/i,
  /어디/,
  /찾아/,
  /\btrace\s+how\b/i,
];

const API_PATTERNS = [
  /\bapi\s+(?:for|doc|docs|reference)\b/i,
  /\bsdk\b/i,
  /\blibrary\s+(?:doc|docs|usage)\b/i,
  /\bhow\s+does\s+\w+\s+(?:work|handle|return)\b/i,
  /공식\s*문서/,
];

const RISK_PATTERNS = [
  /\brefactor\b/i,
  /\bmigrat(?:e|ion)\b/i,
  /\bbreaking\s+change\b/i,
  /\bpublic\s+api\b/i,
  /\bschema\s+change\b/i,
  /\b(?:cross|multi)-file\b/i,
  /구조\s*변경/,
  /대규모/,
];

const TEST_FAIL_PATTERNS_BASE = [
  /\btests?\b[\w\s]{0,30}?\b(?:fail(?:s|ing|ed)?|broken|red)\b/i,
  /\bfailing\s+tests?\b/i,
  /\bflaky\s+tests?\b/i,
  /테스트[^\n]{0,15}(?:실패|깨졌|빨간)/,
];

const UI_PATTERNS = [
  /\b(?:ui|ux|style|styling|css|scss|component)\b/i,
  /\b(?:button|modal|form|page|route|view)\b/i,
  /\.(?:tsx|jsx|svelte|vue)\b/,
  /\bfigma\b/i,
  /디자인/,
  /화면/,
];

const DOCS_PATTERNS = [
  /\b(?:readme|changelog|docs|documentation)\b/i,
  /^(?:update|write|fix)\s+(?:the\s+)?(?:doc|docs|readme)\b/i,
  /문서\s*(?:수정|작성|업데이트)/,
];

const TEST_FAIL_PATTERNS = TEST_FAIL_PATTERNS_BASE;

const VERIFY_PATTERNS = [
  /\bverify\b/i,
  /\bverification\b/i,
  /\b7-layer\b/i,
  /검증/,
];

const EXACT_FILE_PATTERN = /[\w./-]+\.(?:ts|tsx|js|jsx|py|rs|go|java|rb|md|toml|json)(?::\d+)?/;

/** Detect all signals present in a task description. Multiple signals allowed. */
export function detectSignals(task: string): TaskSignal[] {
  const signals: TaskSignal[] = [];

  for (const re of LOC_PATTERNS) {
    const m = task.match(re);
    if (m) {
      signals.push({ kind: 'unknown-location', evidence: m[0] });
      break;
    }
  }
  for (const re of API_PATTERNS) {
    const m = task.match(re);
    if (m) {
      signals.push({ kind: 'external-api', evidence: m[0] });
      break;
    }
  }
  for (const re of RISK_PATTERNS) {
    const m = task.match(re);
    if (m) {
      signals.push({ kind: 'risky-change', evidence: m[0] });
      break;
    }
  }
  for (const re of UI_PATTERNS) {
    const m = task.match(re);
    if (m) {
      signals.push({ kind: 'ui-surface', evidence: m[0] });
      break;
    }
  }
  for (const re of DOCS_PATTERNS) {
    const m = task.match(re);
    if (m) {
      signals.push({ kind: 'docs-only', evidence: m[0] });
      break;
    }
  }
  for (const re of TEST_FAIL_PATTERNS) {
    const m = task.match(re);
    if (m) {
      signals.push({ kind: 'test-failure', evidence: m[0] });
      break;
    }
  }
  for (const re of VERIFY_PATTERNS) {
    const m = task.match(re);
    if (m) {
      signals.push({ kind: 'explicit-verify', evidence: m[0] });
      break;
    }
  }

  const file = task.match(EXACT_FILE_PATTERN);
  if (file) {
    signals.push({ kind: 'exact-file', evidence: file[0] });
  }

  if (signals.length === 0) {
    signals.push({ kind: 'default', evidence: 'no specific signal detected' });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Role delegation map — signals → SUNCO skills or sunco-* subagents
// ---------------------------------------------------------------------------

const DELEGATE_FOR: Record<OrchestrationRole, { skill: string; readOnly: boolean }> = {
  explorer:  { skill: 'workflow.scan',   readOnly: true  },
  librarian: { skill: 'workflow.research', readOnly: true },
  oracle:    { skill: 'agent.sunco-reviewer', readOnly: true },
  developer: { skill: 'workflow.quick',  readOnly: false },
  frontend:  { skill: 'workflow.quick',  readOnly: false },
  docs:      { skill: 'workflow.doc',    readOnly: false },
  verifier:  { skill: 'workflow.verify', readOnly: true  },
  debugger:  { skill: 'workflow.debug',  readOnly: false },
};

// ---------------------------------------------------------------------------
// Plan builder
// ---------------------------------------------------------------------------

export interface OrchestrationPlan {
  signals: TaskSignal[];
  steps: RoutedStep[];
  /** One-line explanation of why this plan, not others. */
  rationale: string;
}

/**
 * Build a routing plan from a task description.
 *
 * Rules (enforced here, documented in workflows/orchestrate.md):
 *
 *   - NO fixed pipeline. The step list is signal-derived, not template-derived.
 *   - Read-only roles (explorer/librarian/oracle) always precede write roles.
 *   - Oracle only runs on risky-change or external-api combined with risky-change.
 *   - Test-failure and explicit-verify add a debugger/verifier step respectively.
 *   - docs-only skips every non-docs role.
 *   - ui-surface routes to frontend instead of developer.
 *   - exact-file WITHOUT other signals goes straight to developer (no explore step).
 *   - default (no signals detected) delegates to explorer → developer.
 */
export function buildPlan(task: string): OrchestrationPlan {
  const signals = detectSignals(task);
  const kinds = new Set(signals.map((s) => s.kind));
  const steps: RoutedStep[] = [];

  // Short-circuit: docs-only work.
  if (kinds.has('docs-only')) {
    steps.push({
      role: 'docs',
      reason: 'docs-only signal — no implementation, no architecture review',
      delegate: DELEGATE_FOR.docs.skill,
      readOnly: DELEGATE_FOR.docs.readOnly,
    });
    return {
      signals,
      steps,
      rationale: 'Docs-only change. Routing to document writer.',
    };
  }

  // Test-failure: debugger first (Iron Law), then verifier to close the loop.
  if (kinds.has('test-failure')) {
    steps.push({
      role: 'debugger',
      reason: 'test-failure signal — reproduce → root cause → fix → verify',
      delegate: DELEGATE_FOR.debugger.skill,
      readOnly: false,
    });
    steps.push({
      role: 'verifier',
      reason: 'close the Iron Law loop after debug fix',
      delegate: DELEGATE_FOR.verifier.skill,
      readOnly: true,
    });
    return {
      signals,
      steps,
      rationale: 'Test failure. Debugger owns the fix; verifier closes the loop.',
    };
  }

  // Explicit verify-only request.
  if (kinds.has('explicit-verify') && !kinds.has('risky-change') && !kinds.has('unknown-location')) {
    steps.push({
      role: 'verifier',
      reason: 'user explicitly requested verification',
      delegate: DELEGATE_FOR.verifier.skill,
      readOnly: true,
    });
    return {
      signals,
      steps,
      rationale: 'Verification-only request. Routing to verifier directly.',
    };
  }

  // Exploration first if location is unknown and the user didn't name a file.
  if (kinds.has('unknown-location') && !kinds.has('exact-file')) {
    steps.push({
      role: 'explorer',
      reason: 'unknown-location signal, no exact file provided',
      delegate: DELEGATE_FOR.explorer.skill,
      readOnly: true,
    });
  }

  // External API → librarian. Parallelizable with exploration, but listed
  // after it so the explorer can narrow the code area before the librarian
  // spends research time on the wrong module.
  if (kinds.has('external-api')) {
    steps.push({
      role: 'librarian',
      reason: 'external API / SDK / docs needed',
      delegate: DELEGATE_FOR.librarian.skill,
      readOnly: true,
    });
  }

  // Oracle: risky changes get a read-only architecture review BEFORE
  // the developer step. Skipped when the task is exact-file + low-risk.
  if (kinds.has('risky-change')) {
    steps.push({
      role: 'oracle',
      reason: 'risky-change signal — architecture review required before code',
      delegate: DELEGATE_FOR.oracle.skill,
      readOnly: true,
    });
  }

  // The write step: frontend if UI, otherwise developer.
  if (kinds.has('ui-surface')) {
    steps.push({
      role: 'frontend',
      reason: 'ui-surface signal — frontend specialist',
      delegate: DELEGATE_FOR.frontend.skill,
      readOnly: false,
    });
  } else {
    steps.push({
      role: 'developer',
      reason:
        kinds.has('exact-file') && steps.length === 0
          ? 'exact-file with no risk signals — direct implementation'
          : 'backend/logic implementation',
      delegate: DELEGATE_FOR.developer.skill,
      readOnly: false,
    });
  }

  // Risky changes get an oracle review pass AFTER the developer as well,
  // mirroring OmO's "optional oracle review" for cross-cutting refactors.
  if (kinds.has('risky-change')) {
    steps.push({
      role: 'oracle',
      reason: 'risky-change — post-implementation architecture review',
      delegate: DELEGATE_FOR.oracle.skill,
      readOnly: true,
    });
  }

  // Final verifier for every non-trivial write. Exact-file single-shot
  // edits skip this to match the "low-risk developer-only" recipe.
  if (
    !(kinds.has('exact-file') && steps.length === 1) &&
    !steps.some((s) => s.role === 'verifier')
  ) {
    steps.push({
      role: 'verifier',
      reason: 'close the write step with a verify pass',
      delegate: DELEGATE_FOR.verifier.skill,
      readOnly: true,
    });
  }

  const rationale = summarizeRationale(kinds, steps);
  return { signals, steps, rationale };
}

function summarizeRationale(kinds: Set<string>, steps: RoutedStep[]): string {
  if (kinds.has('risky-change')) {
    return 'Risky change detected. Oracle gates the developer on both sides.';
  }
  if (kinds.has('unknown-location')) {
    return 'Location unknown — explorer narrows the code area before writes.';
  }
  if (kinds.has('external-api')) {
    return 'External API involved — librarian supplies official reference.';
  }
  if (kinds.has('ui-surface')) {
    return 'UI surface detected — frontend specialist instead of generic developer.';
  }
  if (kinds.has('exact-file') && steps.length <= 1) {
    return 'Exact file, low risk — direct developer write, no read-only prelude.';
  }
  return 'Default route — explorer or developer depending on signal clarity.';
}

// ---------------------------------------------------------------------------
// Context Pack helpers
// ---------------------------------------------------------------------------

export function buildContextPack(task: string): ContextPack {
  const explicitFiles: string[] = [];
  const re = new RegExp(EXACT_FILE_PATTERN.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(task)) !== null) {
    explicitFiles.push(m[0]);
  }
  return {
    originalRequest: task,
    explicitFiles,
    priorOutputs: [],
  };
}

export function extendContextPack(
  pack: ContextPack,
  role: OrchestrationRole,
  summary: string,
): ContextPack {
  return {
    ...pack,
    priorOutputs: [...pack.priorOutputs, { role, summary }],
  };
}

/** Render the context pack as a plaintext block for downstream skills. */
export function renderContextPack(pack: ContextPack): string {
  const lines: string[] = [
    '## Context Pack',
    `Original request: ${pack.originalRequest}`,
  ];
  if (pack.explicitFiles.length > 0) {
    lines.push(`Explicit files: ${pack.explicitFiles.join(', ')}`);
  }
  if (pack.priorOutputs.length > 0) {
    lines.push('Prior steps:');
    for (const p of pack.priorOutputs) {
      lines.push(`  - [${p.role}] ${p.summary}`);
    }
  }
  return lines.join('\n');
}

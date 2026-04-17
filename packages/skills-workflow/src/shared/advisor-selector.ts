/**
 * Advisor behavior selector — runtime-aware.
 *
 * v0.11.1 rewrite: the picker is runtime-first, not provider-first.
 * Provider detection only augments the "Advanced" section. The
 * deterministic classifier + policy always runs regardless of what the
 * user picks here; the picker only decides whether a runtime-native
 * "voice" is layered on top.
 *
 * Pure functions — no I/O. Callers inject env + whichCliExists so
 * unit tests can stub.
 *
 * Priority order (per user instruction):
 *   1. Runtime family (Claude Code → Claude, Codex → GPT, etc.)
 *   2. User config override
 *   3. Available local CLI / provider
 *   4. Deterministic fallback
 */

import {
  DEFAULT_ADVISOR_CONFIG,
  DEFAULT_ADVISOR_MODEL_OPTIONS,
  RUNTIME_ADVISOR_DEFAULTS,
  type AdvisorConfig,
  type AdvisorEngine,
  type AdvisorFamily,
  type AdvisorModelOption,
  type AdvisorRuntime,
  type ReasoningEffort,
  type ThinkingTier,
} from './advisor-types.js';

// ---------------------------------------------------------------------------
// Runtime detection
// ---------------------------------------------------------------------------

/**
 * Detect which runtime this SUNCO process is running inside. Heuristics:
 *   - env.CLAUDE_CODE=1 or CLAUDECODE=1 → claude
 *   - env.CODEX_CLI=1                   → codex
 *   - env.CURSOR_AGENT=1                → cursor
 *   - env.ANTIGRAVITY=1                 → antigravity
 *   - executable path hint in argv[1]   → match by segment
 *   - else 'unknown' (deterministic fallback)
 *
 * `argvPath` is the absolute path of the currently running script,
 * passed by the caller (test-swappable).
 */
export function detectRuntime(
  env: Record<string, string | undefined>,
  argvPath: string = '',
): AdvisorRuntime {
  if (env.CLAUDE_CODE === '1' || env.CLAUDECODE === '1') return 'claude';
  if (env.CODEX_CLI === '1') return 'codex';
  if (env.CURSOR_AGENT === '1') return 'cursor';
  if (env.ANTIGRAVITY === '1') return 'antigravity';

  const p = argvPath.toLowerCase();
  if (p.includes('/.claude/')) return 'claude';
  if (p.includes('/.codex/')) return 'codex';
  if (p.includes('/.cursor/')) return 'cursor';
  if (p.includes('/.antigravity/')) return 'antigravity';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Provider detection (Advanced only)
// ---------------------------------------------------------------------------

/**
 * Provider detection is now ONLY used to decide whether to surface the
 * "Advanced" section of the picker. The core advisor works without any
 * of these — it runs deterministically and (for runtime-native engines)
 * uses the runtime's own authentication.
 */
export interface ProviderEnvironment {
  /** `ANTHROPIC_API_KEY` set. */
  anthropicApi: boolean;
  /** `claude` CLI on PATH. */
  claudeCli: boolean;
  /** `codex` CLI on PATH. */
  codexCli: boolean;
  /** `OPENAI_API_KEY` set. */
  openai: boolean;
  /** `GOOGLE_API_KEY` or `GEMINI_API_KEY` set. */
  google: boolean;
}

export function detectProviders(
  env: Record<string, string | undefined>,
  whichCliExists: (name: string) => boolean,
): ProviderEnvironment {
  return {
    anthropicApi: Boolean(env.ANTHROPIC_API_KEY),
    claudeCli: whichCliExists('claude'),
    codexCli: whichCliExists('codex'),
    openai: Boolean(env.OPENAI_API_KEY),
    google: Boolean(env.GOOGLE_API_KEY) || Boolean(env.GEMINI_API_KEY),
  };
}

// ---------------------------------------------------------------------------
// Picker options
// ---------------------------------------------------------------------------

/**
 * Build the runtime-aware picker option list. Order:
 *
 *   1. runtime-native rows for the active runtime (most relevant first)
 *   2. always-available rows (deterministic, custom)
 *   3. advanced rows — only those whose provider is detected
 *
 * If runtime is 'unknown', step 1 is skipped and the user lands on
 * deterministic with custom as the escape hatch.
 */
export function buildRuntimeAdvisorOptions(
  runtime: AdvisorRuntime,
  providers: ProviderEnvironment,
  options: readonly AdvisorModelOption[] = DEFAULT_ADVISOR_MODEL_OPTIONS,
): AdvisorModelOption[] {
  const out: AdvisorModelOption[] = [];

  // 1. runtime-native rows for the active runtime
  if (runtime !== 'unknown') {
    for (const opt of options) {
      if (opt.scope === 'runtime-native' && opt.runtime === runtime) {
        out.push(opt);
      }
    }
  }

  // 2. always rows
  for (const opt of options) {
    if (opt.scope === 'always') out.push(opt);
  }

  // 3. advanced rows — only those whose provider is detected
  for (const opt of options) {
    if (opt.scope !== 'advanced') continue;
    const providerOk =
      (opt.requiresProvider === 'anthropic' && providers.anthropicApi) ||
      (opt.requiresProvider === 'codex-cli' && providers.codexCli) ||
      (opt.requiresProvider === 'openai' && providers.openai) ||
      (opt.requiresProvider === 'google' && providers.google);
    if (providerOk) out.push(opt);
  }

  return out;
}

/**
 * Diagnostic text for the "Advanced providers" section of --reconfigure.
 * Intended to be shown UNDER the recommended behavior options, not above
 * them. Always includes the "optional" disclaimer.
 */
export function renderProviderDiagnostics(providers: ProviderEnvironment): string[] {
  const lines: string[] = [
    'Advanced external providers:',
    `  - Anthropic API key : ${providers.anthropicApi ? 'set' : 'not set'}`,
    `  - Claude CLI        : ${providers.claudeCli ? 'available' : 'not installed'}`,
    `  - Codex CLI         : ${providers.codexCli ? 'available' : 'not installed'}`,
    `  - OpenAI API key    : ${providers.openai ? 'set' : 'not set'}`,
    `  - Google API key    : ${providers.google ? 'set' : 'not set'}`,
    '',
    'These are optional. SUNCO works through the current runtime by default. API keys are optional.',
  ];
  return lines;
}

// ---------------------------------------------------------------------------
// Option → config
// ---------------------------------------------------------------------------

const THINKING_TIERS: readonly ThinkingTier[] = ['off', 'low', 'medium', 'high', 'max'];
const REASONING_EFFORTS: readonly ReasoningEffort[] = ['low', 'medium', 'high', 'xhigh'];

/**
 * Parse an option id into model + tier/effort suffix.
 * 'claude-opus-4-7@high' → { model: 'claude-opus-4-7', tier: 'high' }
 * 'gpt-5.4@xhigh' → { model: 'gpt-5.4', tier: 'xhigh' }
 * 'deterministic' → { model: 'deterministic', tier: null }
 */
export function parsePickerId(id: string): {
  model: string;
  thinking: ThinkingTier | null;
  reasoningEffort: ReasoningEffort | null;
} {
  const at = id.lastIndexOf('@');
  if (at === -1) {
    return { model: id, thinking: null, reasoningEffort: null };
  }
  const model = id.slice(0, at);
  const tier = id.slice(at + 1);
  if (THINKING_TIERS.includes(tier as ThinkingTier)) {
    return { model, thinking: tier as ThinkingTier, reasoningEffort: null };
  }
  if (REASONING_EFFORTS.includes(tier as ReasoningEffort)) {
    return { model, thinking: null, reasoningEffort: tier as ReasoningEffort };
  }
  return { model, thinking: null, reasoningEffort: null };
}

/**
 * Apply a picker option to a base config. Preserves all knobs the picker
 * doesn't touch (profile, blocking, cost cap, noise budget, etc).
 */
export function applyPickerChoice(
  base: AdvisorConfig,
  optionId: string,
  options: readonly AdvisorModelOption[] = DEFAULT_ADVISOR_MODEL_OPTIONS,
): AdvisorConfig {
  const opt = options.find((o) => o.id === optionId);
  if (!opt) {
    return { ...base, engine: 'deterministic', model: 'deterministic', family: 'local' };
  }
  const { model, thinking, reasoningEffort } = parsePickerId(opt.id);
  const next: AdvisorConfig = {
    ...base,
    engine: opt.engine,
    family: opt.family,
    model: opt.engine === 'deterministic' ? 'deterministic' : model || opt.id,
    thinking: thinking ?? opt.thinking ?? 'off',
  };
  const effort = reasoningEffort ?? opt.reasoningEffort;
  if (effort) next.reasoningEffort = effort;
  else delete next.reasoningEffort;
  return next;
}

// ---------------------------------------------------------------------------
// First-run decision
// ---------------------------------------------------------------------------

/**
 * Whether the picker should be shown on this invocation.
 *
 *   - no saved config                 → yes
 *   - enabled=false                   → no (user opted out)
 *   - engine='deterministic' + custom → no (user is self-driving)
 *   - model is set                    → no
 *   - otherwise                       → yes
 */
export function shouldShowPicker(config?: Partial<AdvisorConfig> | null): boolean {
  if (!config) return true;
  if (config.enabled === false) return false;
  if (config.family === 'custom') return false;
  if (config.model && config.model !== 'deterministic') return false;
  if (config.engine === 'deterministic' && config.family !== 'custom') return true;
  return !config.model;
}

/**
 * Build a default config for the given runtime. Merges
 * DEFAULT_ADVISOR_CONFIG with RUNTIME_ADVISOR_DEFAULTS[runtime], so the
 * result always honors autoExecuteSkills=false and other invariants.
 */
export function resolveInitialConfig(
  runtime: AdvisorRuntime,
  providers: ProviderEnvironment,
): AdvisorConfig {
  if (runtime === 'unknown') {
    // Unknown runtime → pick deterministic, with codexCli hint as fallback
    // if present (so Codex users who launched SUNCO from a non-standard
    // entry point still get a reasonable default).
    return {
      ...DEFAULT_ADVISOR_CONFIG,
      runtime: 'unknown',
      engine: 'deterministic',
      family: 'local',
      model: 'deterministic',
    };
  }
  const runtimeDefaults = RUNTIME_ADVISOR_DEFAULTS[runtime];
  // Cursor without a native model falls back to deterministic.
  if (runtime === 'cursor' && !providers.anthropicApi && !providers.codexCli) {
    return {
      ...DEFAULT_ADVISOR_CONFIG,
      ...runtimeDefaults,
      engine: 'deterministic',
      model: 'deterministic',
      family: 'local',
    };
  }
  return { ...DEFAULT_ADVISOR_CONFIG, ...runtimeDefaults, autoExecuteSkills: false };
}

// ---------------------------------------------------------------------------
// Type re-exports (selector is the canonical import surface)
// ---------------------------------------------------------------------------

export type { AdvisorEngine, AdvisorFamily, AdvisorRuntime };

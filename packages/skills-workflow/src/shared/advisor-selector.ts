/**
 * Advisor model selector — first-run picker + provider detection.
 *
 * Pure functions here. The interactive prompt itself lives in
 * advisor.skill.ts (Phase 4). This module only decides WHICH rows
 * the picker should offer given what providers are detected.
 */

import {
  DEFAULT_ADVISOR_CONFIG,
  DEFAULT_ADVISOR_MODEL_OPTIONS,
  type AdvisorConfig,
  type AdvisorModelOption,
  type ThinkingTier,
} from './advisor-types.js';

// ---------------------------------------------------------------------------
// Provider detection
// ---------------------------------------------------------------------------

export interface ProviderEnvironment {
  /** process.env.ANTHROPIC_API_KEY or claude CLI present. */
  anthropic: boolean;
  /** codex CLI binary on PATH. */
  codexCli: boolean;
  /** process.env.OPENAI_API_KEY. */
  openai: boolean;
  /** process.env.GOOGLE_API_KEY / GEMINI_API_KEY. */
  google: boolean;
}

/**
 * Detect providers from the given environment + a caller-supplied
 * whichCliExists probe (so tests can swap it out). Node filesystem
 * calls are avoided here to keep the module pure.
 */
export function detectProviders(
  env: Record<string, string | undefined>,
  whichCliExists: (name: string) => boolean,
): ProviderEnvironment {
  return {
    anthropic:
      Boolean(env.ANTHROPIC_API_KEY) || whichCliExists('claude'),
    codexCli: whichCliExists('codex'),
    openai: Boolean(env.OPENAI_API_KEY),
    google: Boolean(env.GOOGLE_API_KEY) || Boolean(env.GEMINI_API_KEY),
  };
}

// ---------------------------------------------------------------------------
// Picker option filtering
// ---------------------------------------------------------------------------

/**
 * Filter the static DEFAULT_ADVISOR_MODEL_OPTIONS list by:
 *   - defaultVisible rows stay, unless requiresProvider is set and the
 *     provider isn't detected (then we drop them).
 *   - hidden rows (defaultVisible=false) appear only if their provider
 *     is detected.
 *   - `custom` is always kept.
 */
export function buildPickerOptions(
  env: ProviderEnvironment,
  options: readonly AdvisorModelOption[] = DEFAULT_ADVISOR_MODEL_OPTIONS,
): AdvisorModelOption[] {
  const out: AdvisorModelOption[] = [];
  for (const opt of options) {
    if (opt.id === 'custom') {
      out.push(opt);
      continue;
    }
    const providerOk =
      opt.requiresProvider === null ||
      (opt.requiresProvider === 'anthropic' && env.anthropic) ||
      (opt.requiresProvider === 'codex-cli' && env.codexCli) ||
      (opt.requiresProvider === 'openai' && env.openai) ||
      (opt.requiresProvider === 'google' && env.google);

    if (opt.defaultVisible) {
      if (providerOk) out.push(opt);
      // else: defaultVisible but provider missing → drop
    } else {
      if (providerOk) out.push(opt);
      // else: detected-only and not detected → drop
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Option → config
// ---------------------------------------------------------------------------

/**
 * Parse a picker id like `claude-opus-4-7@high` into its model + thinking.
 * Returns `{ model: 'custom' }` for unknown ids so callers can fallback.
 */
export function parsePickerId(
  id: string,
): { model: string; thinking: ThinkingTier | null } {
  const at = id.lastIndexOf('@');
  if (at === -1) {
    return { model: id, thinking: null };
  }
  const model = id.slice(0, at);
  const thinking = id.slice(at + 1) as ThinkingTier;
  const validTiers: ThinkingTier[] = ['off', 'low', 'medium', 'high', 'max'];
  return {
    model,
    thinking: validTiers.includes(thinking) ? thinking : null,
  };
}

/**
 * Apply a picker option to a base config. Keeps profile/blocking and
 * other knobs untouched unless the option declares a thinking tier.
 */
export function applyPickerChoice(
  base: AdvisorConfig,
  optionId: string,
): AdvisorConfig {
  const { model, thinking } = parsePickerId(optionId);
  return {
    ...base,
    model,
    thinking: thinking ?? base.thinking,
  };
}

// ---------------------------------------------------------------------------
// First-run decision
// ---------------------------------------------------------------------------

/**
 * Given an existing config (possibly empty/partial), decide whether the
 * picker should be shown on the next advisor invocation.
 *
 *   - no config at all      → show picker (first run)
 *   - config.enabled=false  → skip (user opted out)
 *   - config.model='custom' → never re-show picker (user is self-driving)
 *   - otherwise             → skip
 */
export function shouldShowPicker(config?: Partial<AdvisorConfig> | null): boolean {
  if (!config) return true;
  if (config.enabled === false) return false;
  if (config.model === 'custom') return false;
  if (!config.model) return true;
  return false;
}

/**
 * Resolve a config for a fresh install: start from DEFAULT_ADVISOR_CONFIG
 * but downgrade the model if no anthropic provider is detected.
 */
export function resolveInitialConfig(env: ProviderEnvironment): AdvisorConfig {
  if (env.anthropic) return { ...DEFAULT_ADVISOR_CONFIG };
  if (env.codexCli) {
    return { ...DEFAULT_ADVISOR_CONFIG, model: 'codex-cli', thinking: 'off' };
  }
  return {
    ...DEFAULT_ADVISOR_CONFIG,
    enabled: false, // disable until a provider is configured
    model: 'custom',
  };
}

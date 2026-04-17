/**
 * Advisor contract types — single source of truth.
 *
 * Phase 0 of the advisor rollout: no logic here, only the types that
 * every advisor-consuming piece of the codebase agrees on. Implementation
 * modules (risk-classifier, advisor-policy, advisor-message, advisor-selector,
 * hooks, skill) import from this file and never redefine any of these types.
 *
 * Referenced by: packages/cli/references/advisor-contract.md
 */

// ---------------------------------------------------------------------------
// Intervention levels
// ---------------------------------------------------------------------------

/**
 * How visible the advisor becomes to the user.
 *
 *   silent   — logged only, never shown, never injected
 *   notice   — short XML block injected into the user's next prompt
 *   guarded  — notice + the agent is required to honor preGates/postGates
 *   blocker  — guarded + the agent must ask for user confirmation before proceeding
 *
 * Ordering matters: blocker > guarded > notice > silent. The ambient hook
 * always picks the highest-level decision when multiple fire.
 */
export type InterventionLevel = 'silent' | 'notice' | 'guarded' | 'blocker';

/** Confidence in the classification that produced the decision. */
export type AdvisorConfidence = 'low' | 'medium' | 'high';

/** Why confirmation is required (null when it isn't). */
export type ConfirmationReason =
  | 'destructive'
  | 'deployment'
  | 'external_cost'
  | 'schema_migration'
  | 'security_sensitive'
  | null;

/** Canonical routes the advisor may recommend. */
export type RecommendedRoute =
  | 'fast'
  | 'quick'
  | 'debug'
  | 'plan-execute-verify'
  | 'review'
  | 'ship'
  | 'none';

// ---------------------------------------------------------------------------
// Gate references
// ---------------------------------------------------------------------------

/** A named gate requirement. `scope` narrows what the gate runs against. */
export interface GateRef {
  gate: 'spec-approval' | 'plan' | 'test' | 'lint' | 'verify' | 'review' | 'proceed';
  scope?: 'targeted' | 'changed' | 'full' | 'security';
}

// ---------------------------------------------------------------------------
// Advisor decision
// ---------------------------------------------------------------------------

/**
 * The structured output of the advisor engine. Every hook, skill, or
 * downstream consumer reads from this shape. Never serialize extra fields
 * outside the schema without updating the contract doc.
 */
export interface AdvisorDecision {
  /** Intervention level — drives how (and whether) this surfaces to the user. */
  level: InterventionLevel;
  /** Confidence in the underlying classification. */
  confidence: AdvisorConfidence;
  /**
   * Machine-readable reason codes — e.g. ['touchesAuth', 'missingTests'].
   * These map 1:1 with risk-classifier signal names.
   */
  reasonCodes: string[];
  /**
   * Short message intended for the user (<=300 chars). Only surfaced when
   * level >= 'notice'. Should follow the Risk/Suggestion/Skip template when
   * possible.
   */
  userVisibleMessage?: string;
  /**
   * XML block to inject into the next agent prompt. Only used when level
   * >= 'notice' and promptInjection is enabled.
   */
  systemInjection?: string;
  /** Which SUNCO route the advisor recommends for this task, if any. */
  recommendedRoute?: RecommendedRoute;
  /** Gates that MUST be satisfied before the agent starts the write step. */
  preGates: GateRef[];
  /** Gates that MUST be satisfied after the agent's write step. */
  postGates: GateRef[];
  /** Reason if the agent must pause for user confirmation; null otherwise. */
  confirmationReason: ConfirmationReason;
  /**
   * Stable key for deduplication/suppression. Same key within the
   * suppression window collapses silently.
   */
  suppressionKey: string;
  /** ISO timestamp when this decision stops being relevant. */
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Advisor config (persisted to .sun/config.toml)
// ---------------------------------------------------------------------------

/**
 * Tier knobs for extended thinking. Concrete budget tokens are resolved by
 * the provider adapter; the user-visible label is what we store.
 *
 *   off     — no extended thinking
 *   low     — minimal budget (fast, cheap)
 *   medium  — balanced (default)
 *   high    — deep analysis
 *   max     — largest budget the model supports
 */
export type ThinkingTier = 'off' | 'low' | 'medium' | 'high' | 'max';

/** Profile label. `inherit` means follow the global /sunco:profile setting. */
export type AdvisorProfile =
  | 'quality'
  | 'balanced'
  | 'budget'
  | 'inherit'
  | 'custom';

/** Runtime the advisor is running inside. */
export type AdvisorRuntime = 'claude' | 'codex' | 'cursor' | 'antigravity' | 'unknown';

/**
 * How the advisor arrives at its *voice*. The deterministic classifier
 * (risk → policy → message) ALWAYS runs regardless of engine — `engine`
 * controls whether an additional optional "voice" is layered on top.
 *
 *   deterministic  — no model call. Template Risk/Suggestion only. Safest,
 *                    fastest, the product default for uncertain runtimes.
 *   runtime-native — delegate the voice to the runtime's native model
 *                    (Claude Code uses Claude, Codex uses GPT-5.4, etc.).
 *                    NO SUNCO-managed API key required.
 *   external-cli   — call a local CLI binary (claude / codex) that the
 *                    user has authenticated separately.
 *   external-api   — hit an HTTPS API endpoint using SUNCO-managed
 *                    credentials. Reserved for future use — NOT shipped
 *                    in v0.11.x; picker does not surface this.
 */
export type AdvisorEngine =
  | 'deterministic'
  | 'runtime-native'
  | 'external-cli'
  | 'external-api';

/** Model family lineage. Used for display + routing decisions. */
export type AdvisorFamily =
  | 'claude'
  | 'codex'
  | 'cursor'
  | 'antigravity'
  | 'local'
  | 'custom';

/** Reasoning effort for Codex/GPT-style reasoning models. */
export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

export interface AdvisorConfig {
  /** Master on/off. When false, the advisor never surfaces. */
  enabled: boolean;
  /**
   * Runtime the advisor believes it is running inside. Detected at
   * reconfigure time; used to default the model/engine sensibly.
   */
  runtime: AdvisorRuntime;
  /** How the voice is produced (see AdvisorEngine). Classifier is always deterministic. */
  engine: AdvisorEngine;
  /** Model family lineage. */
  family: AdvisorFamily;
  /**
   * Model id in the active family's dialect, or a sentinel:
   *   - 'deterministic'      — no model voice, template only
   *   - 'claude-opus-4-7'    — Claude family
   *   - 'claude-sonnet-4-6'
   *   - 'claude-haiku-4-5'
   *   - 'gpt-5.4'            — Codex/OpenAI family
   *   - 'gpt-5.4-mini'
   *   - 'cursor-native'      — Cursor runtime passthrough
   *   - 'custom'             — user maintains the row manually
   */
  model: string;
  /** Extended thinking tier (Claude-family). Ignored by other families. */
  thinking: ThinkingTier;
  /** Reasoning effort (Codex/GPT-family). Ignored by other families. */
  reasoningEffort?: ReasoningEffort;
  /** Profile preset. */
  profile: AdvisorProfile;
  /** Soft cap per session in USD. Warn, never block. */
  costCapPerSessionUSD: number;
  /** Model id to fall back to when `model` is unreachable. */
  fallback: string;
  /** Inject advisor XML into user prompts (Claude Code only). */
  promptInjection: boolean;
  /** Enqueue post-edit notices (Claude Code only). */
  postActionQueue: boolean;
  /**
   * PERMANENT FALSE. The advisor never auto-executes skills. This flag
   * exists so the contract-lint and unit tests can assert it is never
   * flipped. Attempts to set true are treated as false by the runtime.
   */
  autoExecuteSkills: false;
  /** When true, 'blocker' level pauses the agent for confirmation. Default false. */
  blocking: boolean;
  /** Max visible advisor surfaces per session. */
  maxVisiblePerSession: number;
  /** Dedupe window per suppressionKey, in minutes. */
  suppressSameKeyMinutes: number;
}

/**
 * Default config for a fresh install. NOTE: `runtime` starts as
 * 'unknown' — advisor-selector overrides it during install/reconfigure.
 * `engine` defaults to 'deterministic' so zero-config installs never
 * call a model.
 */
export const DEFAULT_ADVISOR_CONFIG: AdvisorConfig = {
  enabled: true,
  runtime: 'unknown',
  engine: 'deterministic',
  family: 'local',
  model: 'deterministic',
  thinking: 'off',
  profile: 'inherit',
  costCapPerSessionUSD: 5.0,
  fallback: 'deterministic',
  promptInjection: true,
  postActionQueue: true,
  autoExecuteSkills: false,
  blocking: false,
  maxVisiblePerSession: 5,
  suppressSameKeyMinutes: 30,
};

// ---------------------------------------------------------------------------
// Runtime-aware defaults (v0.11.1)
// ---------------------------------------------------------------------------

/**
 * Default advisor config by runtime. Selector picks from this table
 * first, provider detection only augments/overrides. Zero provider
 * detection is acceptable — the runtime-native engine relies on the
 * runtime's own authentication, not a SUNCO-managed API key.
 */
export const RUNTIME_ADVISOR_DEFAULTS: Record<
  Exclude<AdvisorRuntime, 'unknown'>,
  Partial<AdvisorConfig>
> = {
  claude: {
    runtime: 'claude',
    engine: 'runtime-native',
    family: 'claude',
    model: 'claude-opus-4-7',
    thinking: 'high',
    fallback: 'claude-sonnet-4-6',
  },
  codex: {
    runtime: 'codex',
    engine: 'runtime-native',
    family: 'codex',
    model: 'gpt-5.4',
    thinking: 'off',
    reasoningEffort: 'high',
    fallback: 'gpt-5.4-mini',
  },
  cursor: {
    runtime: 'cursor',
    engine: 'runtime-native',
    family: 'cursor',
    model: 'cursor-native',
    thinking: 'off',
    fallback: 'deterministic',
  },
  antigravity: {
    runtime: 'antigravity',
    engine: 'deterministic',
    family: 'antigravity',
    model: 'deterministic',
    thinking: 'off',
    fallback: 'deterministic',
  },
};

// ---------------------------------------------------------------------------
// Advisor behavior picker (v0.11.1 — runtime-aware)
// ---------------------------------------------------------------------------

/**
 * One row in the advisor-selector picker.
 *
 * v0.11.1 rewrite — these are NOT "model providers". They are advisor
 * behavior presets that the user picks once per runtime. The classifier
 * (risk + policy) always runs deterministically regardless of pick; the
 * row only decides whether to layer a runtime-native "voice" on top.
 *
 * Picker filtering:
 *   - `scope`: 'always' rows are shown in every runtime. 'runtime-native'
 *     rows only show when `runtime` matches the active runtime. 'advanced'
 *     rows only show when the matching provider is detected (we keep them
 *     so power users who DO have external API keys can pick them).
 *   - `requiresProvider`: only meaningful for 'advanced' scope.
 *
 * Per-runtime ordering is handled by advisor-selector.ts, not the
 * row definition itself.
 */
export interface AdvisorModelOption {
  /** Stable id written to config.toml */
  id: string;
  /** Short one-line label shown in the picker */
  label: string;
  /** Secondary caption */
  caption: string;
  /** Engine this option implies. */
  engine: AdvisorEngine;
  /** Family of the advisor voice (or 'local' for deterministic). */
  family: AdvisorFamily;
  /** Thinking tier baked into this option (Claude-family). */
  thinking: ThinkingTier | null;
  /** Reasoning effort baked into this option (Codex/GPT-family). */
  reasoningEffort?: ReasoningEffort;
  /** When should this row be offered. */
  scope: 'always' | 'runtime-native' | 'advanced';
  /** For scope='runtime-native', which runtime owns it. */
  runtime?: Exclude<AdvisorRuntime, 'unknown'>;
  /** For scope='advanced', which external provider must be present. */
  requiresProvider?:
    | 'anthropic'
    | 'codex-cli'
    | 'openai'
    | 'google';
}

/**
 * The full picker row registry. advisor-selector.ts filters + orders
 * this based on the detected runtime and providers.
 *
 * Ordering intent:
 *   1. Runtime-native rows for the active runtime (most relevant)
 *   2. Deterministic row (always-safe fallback)
 *   3. Custom (escape hatch)
 *   4. Advanced rows when providers are detected (power-user territory)
 */
export const DEFAULT_ADVISOR_MODEL_OPTIONS: readonly AdvisorModelOption[] = [
  // Claude runtime-native
  { id: 'claude-opus-4-7@high',    label: 'Claude Opus 4.7 — thinking: high (Recommended)', caption: 'best judgment, slower',         engine: 'runtime-native', family: 'claude', thinking: 'high',   scope: 'runtime-native', runtime: 'claude' },
  { id: 'claude-opus-4-7@max',     label: 'Claude Opus 4.7 — thinking: max',                caption: 'deepest analysis, expensive',   engine: 'runtime-native', family: 'claude', thinking: 'max',    scope: 'runtime-native', runtime: 'claude' },
  { id: 'claude-sonnet-4-6@high',  label: 'Claude Sonnet 4.6 — thinking: high',             caption: 'fast, strong default',          engine: 'runtime-native', family: 'claude', thinking: 'high',   scope: 'runtime-native', runtime: 'claude' },
  { id: 'claude-haiku-4-5@off',    label: 'Claude Haiku 4.5 — thinking: off',               caption: 'fastest, cheapest',             engine: 'runtime-native', family: 'claude', thinking: 'off',    scope: 'runtime-native', runtime: 'claude' },

  // Codex runtime-native
  { id: 'gpt-5.4@high',            label: 'GPT-5.4 — reasoning: high (Recommended)',        caption: 'Codex default, strong reasoning', engine: 'runtime-native', family: 'codex', thinking: 'off', reasoningEffort: 'high', scope: 'runtime-native', runtime: 'codex' },
  { id: 'gpt-5.4@xhigh',           label: 'GPT-5.4 — reasoning: xhigh',                     caption: 'deepest reasoning, slower',     engine: 'runtime-native', family: 'codex', thinking: 'off', reasoningEffort: 'xhigh', scope: 'runtime-native', runtime: 'codex' },
  { id: 'gpt-5.4-mini@high',       label: 'GPT-5.4 mini — reasoning: high',                 caption: 'faster, cheaper Codex voice',   engine: 'runtime-native', family: 'codex', thinking: 'off', reasoningEffort: 'high', scope: 'runtime-native', runtime: 'codex' },
  { id: 'gpt-5.2-codex@high',      label: 'GPT-5.2 Codex — reasoning: high',                caption: 'code-focused variant',          engine: 'runtime-native', family: 'codex', thinking: 'off', reasoningEffort: 'high', scope: 'runtime-native', runtime: 'codex' },

  // Cursor runtime-native
  { id: 'cursor-native@inherit',   label: 'Cursor native',                                  caption: "uses Cursor's active model",    engine: 'runtime-native', family: 'cursor', thinking: 'off', scope: 'runtime-native', runtime: 'cursor' },

  // Antigravity: only deterministic available for now
  // (no runtime-native row until upstream support lands)

  // Deterministic + Custom — always offered
  { id: 'deterministic',           label: 'Deterministic only',                             caption: 'classifier + policy, no model voice', engine: 'deterministic', family: 'local',  thinking: 'off', scope: 'always' },
  { id: 'custom',                  label: 'Custom — edit .sun/config.toml',                 caption: 'write your own',                engine: 'deterministic', family: 'custom', thinking: 'off', scope: 'always' },

  // Advanced / external (only shown when provider is detected)
  { id: 'anthropic-api@high',      label: 'Claude via Anthropic API (advanced)',            caption: 'external, requires ANTHROPIC_API_KEY', engine: 'external-api', family: 'claude', thinking: 'high', scope: 'advanced', requiresProvider: 'anthropic' },
  { id: 'codex-cli-bin',           label: 'Codex CLI binary (advanced)',                    caption: 'invokes local `codex` CLI',     engine: 'external-cli', family: 'codex',  thinking: 'off', reasoningEffort: 'high', scope: 'advanced', requiresProvider: 'codex-cli' },
  { id: 'openai-api@gpt-5',        label: 'OpenAI GPT-5 (advanced)',                        caption: 'external, requires OPENAI_API_KEY', engine: 'external-api', family: 'codex', thinking: 'off', reasoningEffort: 'high', scope: 'advanced', requiresProvider: 'openai' },
  { id: 'google-api@gemini-2.5',   label: 'Gemini 2.5 Pro (advanced)',                      caption: 'external, requires GOOGLE_API_KEY', engine: 'external-api', family: 'local', thinking: 'off', scope: 'advanced', requiresProvider: 'google' },
] as const;

// ---------------------------------------------------------------------------
// Suppression / Noise budget
// ---------------------------------------------------------------------------

export interface SuppressionPolicy {
  /** Same key silenced for this many minutes after surfacing. */
  sameKeyMinutes: number;
  /** Hard cap on visible advisor surfaces per session. */
  maxVisiblePerSession: number;
  /** Max advisor blocks injected into a single user prompt. */
  maxPerPrompt: number;
  /** Confidence below this is never shown — logged only. */
  minVisibleConfidence: AdvisorConfidence;
}

export const DEFAULT_SUPPRESSION_POLICY: SuppressionPolicy = {
  sameKeyMinutes: 30,
  maxVisiblePerSession: 5,
  maxPerPrompt: 1,
  minVisibleConfidence: 'medium',
};

// ---------------------------------------------------------------------------
// Queue (post-action)
// ---------------------------------------------------------------------------

export type QueueItemStatus =
  | 'pending'
  | 'surfaced'
  | 'acknowledged'
  | 'resolved'
  | 'expired';

export interface AdvisorQueueItem {
  /** Stable hash of (files + signals). */
  id: string;
  /** ISO timestamp. */
  createdAt: string;
  /** Where it was enqueued from (hook name). */
  source: 'PostToolUse' | 'UserPromptSubmit' | 'skill' | 'other';
  files: string[];
  signals: string[];
  requiredGates: GateRef[];
  status: QueueItemStatus;
  suppressionKey: string;
  /** Human-readable surfaced message, when surfaced. */
  lastMessage?: string;
  /** ISO timestamp when item becomes eligible for expiry. */
  expiresAt: string;
}

export interface AdvisorQueue {
  version: 1;
  items: AdvisorQueueItem[];
}

export const EMPTY_QUEUE: AdvisorQueue = { version: 1, items: [] };

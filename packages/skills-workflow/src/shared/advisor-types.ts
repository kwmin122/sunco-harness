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

export interface AdvisorConfig {
  /** Master on/off. When false, the advisor never surfaces. */
  enabled: boolean;
  /**
   * Model id. One of:
   *   - 'claude-opus-4-7' | 'claude-sonnet-4-6' | 'claude-haiku-4-5'
   *   - 'codex-cli'  (external cross-family)
   *   - 'gpt-5.x' | 'gemini-2.5-pro'  (if provider detected)
   *   - 'custom' (user edits .sun/config.toml manually)
   */
  model: string;
  /** Extended thinking tier. Ignored when the model doesn't support it. */
  thinking: ThinkingTier;
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

/** Default config shipped with a fresh install. */
export const DEFAULT_ADVISOR_CONFIG: AdvisorConfig = {
  enabled: true,
  model: 'claude-opus-4-7',
  thinking: 'high',
  profile: 'inherit',
  costCapPerSessionUSD: 5.0,
  fallback: 'claude-sonnet-4-6',
  promptInjection: true,
  postActionQueue: true,
  autoExecuteSkills: false,
  blocking: false,
  maxVisiblePerSession: 5,
  suppressSameKeyMinutes: 30,
};

// ---------------------------------------------------------------------------
// Model options (first-run picker contract)
// ---------------------------------------------------------------------------

/**
 * One row in the advisor-selector picker. The implementation in Phase 1
 * must honor this shape; it MUST NOT add fields without updating this
 * contract and the advisor-contract.md document.
 */
export interface AdvisorModelOption {
  /** Stable id written to config.toml */
  id: string;
  /** Short one-line label shown in the picker */
  label: string;
  /** Secondary caption, e.g. "quality, slow, expensive" */
  caption: string;
  /** Thinking tier baked into this option. null for custom/passthrough. */
  thinking: ThinkingTier | null;
  /** Is this option visible by default (without provider detection)? */
  defaultVisible: boolean;
  /**
   * Which provider must be detected for this option to show up in picker.
   * null for always-available ids (custom, edit config).
   */
  requiresProvider:
    | 'anthropic'
    | 'codex-cli'
    | 'openai'
    | 'google'
    | null;
}

/**
 * The default picker list. first-run UI shows rows in this order. Rows
 * whose `requiresProvider` is not detected are filtered out (unless
 * `defaultVisible` is true). Implementation in Phase 1 imports this
 * constant and must not reorder or mutate it in place.
 */
export const DEFAULT_ADVISOR_MODEL_OPTIONS: readonly AdvisorModelOption[] = [
  { id: 'claude-opus-4-7@max',    label: 'Opus 4.7 — thinking: max',    caption: 'quality, slow, expensive', thinking: 'max',    defaultVisible: true,  requiresProvider: 'anthropic' },
  { id: 'claude-opus-4-7@high',   label: 'Opus 4.7 — thinking: high',   caption: 'quality, slower',          thinking: 'high',   defaultVisible: true,  requiresProvider: 'anthropic' },
  { id: 'claude-opus-4-7@medium', label: 'Opus 4.7 — thinking: medium', caption: 'balanced default',         thinking: 'medium', defaultVisible: true,  requiresProvider: 'anthropic' },
  { id: 'claude-sonnet-4-6@max',  label: 'Sonnet 4.6 — thinking: max',  caption: 'fast, strong',             thinking: 'max',    defaultVisible: true,  requiresProvider: 'anthropic' },
  { id: 'claude-sonnet-4-6@high', label: 'Sonnet 4.6 — thinking: high', caption: 'fast, balanced',           thinking: 'high',   defaultVisible: true,  requiresProvider: 'anthropic' },
  { id: 'claude-haiku-4-5@off',   label: 'Haiku 4.5 — thinking: off',   caption: 'fastest, cheapest',        thinking: 'off',    defaultVisible: true,  requiresProvider: 'anthropic' },
  { id: 'codex-cli',              label: 'Codex CLI — cross-family',    caption: 'external, different perspective', thinking: null, defaultVisible: true, requiresProvider: 'codex-cli' },
  { id: 'custom',                 label: 'Custom — edit .sun/config.toml', caption: 'write your own',        thinking: null,     defaultVisible: true,  requiresProvider: null },
  // Detected-only advanced options (hidden unless provider exists)
  { id: 'gpt-5',        label: 'GPT-5 (advanced, detected)',      caption: 'cross-family if OPENAI_API_KEY set', thinking: null, defaultVisible: false, requiresProvider: 'openai' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (advanced, detected)', caption: 'cross-family if GOOGLE_API_KEY set', thinking: null, defaultVisible: false, requiresProvider: 'google' },
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

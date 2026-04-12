/**
 * @sunco/core - Agent System
 *
 * Public API for the Agent Router, providers, permissions, and tracking.
 * Skills interact through AgentRouterApi (ctx.agent), not providers directly.
 */

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export { createAgentRouter } from './router.js';
export type { AgentRouterConfig } from './router.js';

// ---------------------------------------------------------------------------
// Permission Harness
// ---------------------------------------------------------------------------
export { ROLE_PERMISSIONS, enforcePermissions } from './permission.js';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------
export { ClaudeCliProvider } from './providers/claude-cli.js';
export { ClaudeSdkProvider } from './providers/claude-sdk.js';
export { CodexCliProvider } from './providers/codex-cli.js';

// ---------------------------------------------------------------------------
// Result Normalizer
// ---------------------------------------------------------------------------
export { normalizeResult } from './result.js';
export type { RawProviderResult } from './result.js';

// ---------------------------------------------------------------------------
// Usage Tracker
// ---------------------------------------------------------------------------
export { UsageTracker } from './tracker.js';

// ---------------------------------------------------------------------------
// Types (re-export from types.ts for convenience)
// ---------------------------------------------------------------------------
export type {
  AgentProvider,
  AgentResult,
  AgentRequest,
  AgentExecutionContext,
  AgentRouterApi,
  AgentFamily,
  AgentTransport,
  AgentRole,
  PermissionSet,
  Artifact,
  AgentUsage,
} from './types.js';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
export {
  AgentError,
  ProviderUnavailableError,
  PermissionDeniedError,
  ExecutionTimeoutError,
  ProviderExecutionError,
} from './errors.js';

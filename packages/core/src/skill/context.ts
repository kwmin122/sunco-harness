/**
 * @sunco/core - Skill Context Factory
 *
 * Creates SkillContext objects for skill execution.
 * Deterministic skills get a blocked agent proxy that throws on any access.
 * ctx.run() enables inter-skill calls with circular invocation protection.
 *
 * Decisions: D-33 (skills access everything through context),
 * D-12 (deterministic = no agent access)
 */

import type { SkillContext, SkillResult, SkillLogger } from './types.js';
import type { SunConfig } from '../config/types.js';
import type { StateApi, FileStoreApi } from '../state/types.js';
import type { AgentRouterApi } from '../agent/types.js';
import type { RecommenderApi } from '../recommend/types.js';
import type { SkillUi } from '../ui/adapters/SkillUi.js';
import type { SkillRegistry } from './registry.js';
import { CircularSkillInvocationError } from '../errors/index.js';

// ---------------------------------------------------------------------------
// Context Factory Parameters
// ---------------------------------------------------------------------------

/** Parameters for creating a SkillContext */
export interface CreateSkillContextParams {
  /** ID of the skill this context is for */
  skillId: string;
  /** Merged TOML config */
  config: Readonly<SunConfig>;
  /** State engine API */
  state: StateApi;
  /** File store API */
  fileStore: FileStoreApi;
  /** Agent router (will be proxied for deterministic skills) */
  agentRouter: AgentRouterApi;
  /** Recommendation engine */
  recommender: RecommenderApi;
  /** UI interaction API */
  ui: SkillUi;
  /** Skill registry (for inter-skill calls) */
  registry: SkillRegistry;
  /** Current working directory */
  cwd: string;
  /** Parsed CLI arguments */
  args?: Record<string, unknown>;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Call stack for circular invocation detection (internal) */
  callStack?: readonly string[];
}

// ---------------------------------------------------------------------------
// Blocked Agent Proxy
// ---------------------------------------------------------------------------

/**
 * Create a Proxy that throws on any property access.
 * Used for deterministic skills that must not use the agent router.
 *
 * @param skillId - The skill ID (for error messages)
 * @returns AgentRouterApi-shaped proxy that throws on any operation
 */
export function createBlockedAgentProxy(skillId: string): AgentRouterApi {
  return new Proxy({} as AgentRouterApi, {
    get(_target, prop) {
      throw new Error(
        `Agent access blocked for deterministic skill '${skillId}'. ` +
        `Property '${String(prop)}' cannot be accessed. ` +
        `Change skill kind to 'prompt' or 'hybrid' to enable agent access.`,
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Default Logger
// ---------------------------------------------------------------------------

function createDefaultLogger(skillId: string): SkillLogger {
  const prefix = `[${skillId}]`;
  return {
    /* eslint-disable no-console */
    debug: (msg, data) => console.debug(prefix, msg, data ?? ''),
    info: (msg, data) => console.info(prefix, msg, data ?? ''),
    warn: (msg, data) => console.warn(prefix, msg, data ?? ''),
    error: (msg, data) => console.error(prefix, msg, data ?? ''),
    /* eslint-enable no-console */
  };
}

// ---------------------------------------------------------------------------
// Context Factory
// ---------------------------------------------------------------------------

/**
 * Create a SkillContext for skill execution.
 *
 * - Deterministic skills get a blocked agent proxy (throws on access)
 * - Prompt/hybrid skills get the real agent router
 * - ctx.run() tracks call stack and detects circular invocations
 *
 * @param params - Context creation parameters
 * @returns Fully configured SkillContext
 */
export function createSkillContext(params: CreateSkillContextParams): SkillContext {
  const {
    skillId,
    config,
    state,
    fileStore,
    agentRouter,
    recommender,
    ui,
    registry,
    cwd,
    args = {},
    signal = new AbortController().signal,
    callStack = [],
  } = params;

  // Determine agent access based on skill kind
  const skill = registry.get(skillId);
  const kind = skill?.kind ?? 'deterministic';
  const agent: AgentRouterApi =
    kind === 'deterministic'
      ? createBlockedAgentProxy(skillId)
      : agentRouter;

  // Build ctx.run() with circular invocation detection
  const run = async (
    targetId: string,
    runArgs?: Record<string, unknown>,
  ): Promise<SkillResult> => {
    // Current call stack includes this skill
    const currentStack = [...callStack, skillId];

    // Check for circular invocation
    if (currentStack.includes(targetId)) {
      throw new CircularSkillInvocationError([...currentStack, targetId]);
    }

    // Create child context with extended call stack
    const childContext = createSkillContext({
      ...params,
      skillId: targetId,
      args: runArgs ?? {},
      callStack: currentStack,
    });

    return registry.execute(targetId, childContext);
  };

  const context: SkillContext = {
    config,
    state,
    fileStore,
    agent,
    recommend: recommender,
    ui,
    log: createDefaultLogger(skillId),
    run,
    cwd,
    args,
    signal,
  };

  return context;
}

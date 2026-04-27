/**
 * @sunco/core - CLI Lifecycle Management
 *
 * Full boot -> execute -> teardown sequence for the sunco CLI.
 * Wires all subsystems together: config, state, skills, agent router,
 * UI adapter, and recommender.
 *
 * Requirements: CLI-01 (binary), CLI-02 (skill discovery), SKL-05 (agent dispatch)
 *
 * The recommender engine (Plan 09) is loaded via dynamic import with a noop
 * fallback so the CLI works regardless of which plan executes first.
 */

import { join } from 'node:path';
import { loadConfig } from '../config/loader.js';
import { createStateEngine } from '../state/api.js';
import { ensureSunDir } from '../state/directory.js';
import { scanSkillFiles } from '../skill/scanner.js';
import { resolveActiveSkills } from '../skill/resolver.js';
import { SkillRegistry } from '../skill/registry.js';
import { createSkillContext } from '../skill/context.js';
import { createAgentRouter } from '../agent/router.js';
import { createUiAdapter, createSkillUi } from '../ui/adapters/index.js';
import type { SunConfig } from '../config/types.js';
import type { StateEngine } from '../state/types.js';
import type { AgentRouterApi } from '../agent/types.js';
import type { UiAdapter } from '../ui/adapters/UiAdapter.js';
import type { SkillUi } from '../ui/adapters/SkillUi.js';
import type { RecommenderApi, RecommendationState } from '../recommend/types.js';
import type { SkillExecuteHook } from './skill-router.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** All services initialized during the boot phase */
export interface LifecycleServices {
  config: Readonly<SunConfig>;
  stateEngine: StateEngine;
  registry: SkillRegistry;
  agentRouter: AgentRouterApi;
  uiAdapter: UiAdapter;
  skillUi: SkillUi;
  recommender: RecommenderApi;
  cwd: string;
  sunDir: string;
}

/** Options for the lifecycle boot phase */
export interface BootOptions {
  /** Pre-loaded skill definitions (e.g., directly imported for bundling) */
  preloadedSkills?: import('../skill/types.js').SkillDefinition[];
}

/** Lifecycle API returned by createLifecycle() */
export interface Lifecycle {
  /** Boot all subsystems and return initialized services */
  boot(cwd: string, options?: BootOptions): Promise<LifecycleServices>;
  /** Create the execute hook for Commander.js skill actions */
  createExecuteHook(services: LifecycleServices): SkillExecuteHook;
  /** Tear down services (close DB connections, etc.) */
  teardown(services: LifecycleServices): Promise<void>;
}

// ---------------------------------------------------------------------------
// Noop Recommender (fallback when engine not yet built)
// ---------------------------------------------------------------------------

/**
 * Create a no-op recommender that always returns empty recommendations.
 * Used as fallback when the recommendation engine is not available.
 */
export function createNoopRecommender(): RecommenderApi {
  return {
    getRecommendations(): [] {
      return [];
    },
    getTopRecommendation() {
      return undefined;
    },
  };
}

// ---------------------------------------------------------------------------
// Lifecycle Factory
// ---------------------------------------------------------------------------

/**
 * Create the CLI lifecycle manager.
 *
 * Boot sequence:
 * 1. loadConfig(cwd) -- merged TOML config
 * 2. ensureSunDir(cwd) -- create .sun/ if needed
 * 3. createStateEngine() + initialize -- SQLite + file store
 * 4. scanSkillFiles() -- discover *.skill.{ts,js,mjs} files
 * 5. resolveActiveSkills() -- apply policy (preset/add/remove)
 * 6. Create SkillRegistry, register active skills
 * 7. createAgentRouter() -- init with available providers
 * 8. createUiAdapter() -- select UI renderer
 * 9. Load recommender engine (dynamic import, noop fallback)
 *
 * Execute hook (per skill invocation):
 * 1. Create SkillContext
 * 2. Execute skill via registry
 * 3. Get recommendations (optional)
 * 4. Display recommendations (optional)
 *
 * Teardown:
 * 1. Close state engine
 */
export function createLifecycle(): Lifecycle {
  return {
    async boot(cwd: string, options?: BootOptions): Promise<LifecycleServices> {
      // Step 1: Load config
      const config = await loadConfig(cwd);

      // Step 2: Ensure .sun/ directory
      const sunDir = await ensureSunDir(cwd);

      // Step 3: Create and initialize state engine
      const stateEngine = createStateEngine();
      await stateEngine.initialize(cwd);

      // Step 4a: Register pre-loaded skills (direct imports for bundling)
      // These take priority over scanner-discovered skills (D-14 dedup)
      const registry = new SkillRegistry();
      const preloaded = options?.preloadedSkills ?? [];
      for (const skill of preloaded) {
        registry.register(skill);
      }

      // Step 4b: Scan for skill files (development mode extensibility)
      // Convention: packages/skills-*/src/ contains *.skill.{ts,js,mjs} files
      const skillBasePaths = [
        join(cwd, 'packages', 'skills-harness', 'src'),
        join(cwd, 'packages', 'skills-workflow', 'src'),
        join(cwd, 'packages', 'skills-core', 'src'),
      ];
      const discovered = await scanSkillFiles(skillBasePaths);

      // Step 5: Resolve active skills via policy
      // Include both preloaded and discovered for resolution
      const allSkills = [...preloaded, ...discovered];
      const activeIds = resolveActiveSkills(allSkills, config.skills);

      // Step 6: Register scanner-discovered active skills (skip already-registered per D-14)
      for (const skill of discovered) {
        if (activeIds.has(skill.id) && !registry.has(skill.id)) {
          registry.register(skill);
        }
      }

      // Step 7: Discover available providers and create agent router
      // D-15: dual path (CLI + SDK as parallel providers)
      // D-23: role-based defaults (router selects per role internally)
      // Dynamic imports to avoid pulling execa/cross-spawn into the ESM bundle eagerly
      const [{ ClaudeCliProvider }, { ClaudeSdkProvider }, { CodexCliProvider }] = await Promise.all([
        import('../agent/providers/claude-cli.js'),
        import('../agent/providers/claude-sdk.js'),
        import('../agent/providers/codex-cli.js'),
      ]);
      const cliProvider = new ClaudeCliProvider();
      const sdkProvider = new ClaudeSdkProvider();
      const codexProvider = new CodexCliProvider();
      const [cliAvailable, sdkAvailable, codexAvailable] = await Promise.all([
        cliProvider.isAvailable(),
        sdkProvider.isAvailable(),
        codexProvider.isAvailable(),
      ]);
      const providers: import('../agent/types.js').AgentProvider[] = [];
      if (cliAvailable) providers.push(cliProvider);
      if (sdkAvailable) providers.push(sdkProvider);
      if (codexAvailable) providers.push(codexProvider);

      const agentRouter = createAgentRouter({
        providers,
        cwd,
      });

      // Step 8: Create UI adapter
      const uiAdapter = createUiAdapter({
        silent: config.ui.silent,
        json: config.ui.json,
      });
      const skillUi = createSkillUi(uiAdapter);

      // Step 9: Load recommender (graceful fallback)
      let recommender: RecommenderApi;
      try {
        const mod = await import('../recommend/engine.js');
        recommender = mod.createRecommender();
      } catch {
        recommender = createNoopRecommender();
      }

      return {
        config,
        stateEngine,
        registry,
        agentRouter,
        uiAdapter,
        skillUi,
        recommender,
        cwd,
        sunDir,
      };
    },

    createExecuteHook(services: LifecycleServices): SkillExecuteHook {
      const {
        config,
        stateEngine,
        registry,
        agentRouter,
        skillUi,
        recommender,
        cwd,
      } = services;

      return async (skillId: string, options: Record<string, unknown>): Promise<void> => {
        // Step 1: Create skill context
        const context = createSkillContext({
          skillId,
          config,
          state: stateEngine.state,
          fileStore: stateEngine.fileStore,
          agentRouter,
          recommender,
          ui: skillUi,
          registry,
          cwd,
          args: options,
        });

        // Step 2: Execute skill
        const result = await registry.execute(skillId, context);

        // Step 3: Get recommendations (if recommender is available and skill succeeded)
        if (result.success) {
          try {
            const recState: RecommendationState = {
              lastSkillId: skillId,
              lastResult: result,
              projectState: {},
              activeSkills: new Set(registry.getAll().map((s) => s.id)),
            };
            const recommendations = recommender.getRecommendations(recState);

            // Step 4: Display recommendations if any
            if (recommendations.length > 0) {
              await skillUi.result({
                success: true,
                title: 'Next Steps',
                summary: result.summary ?? 'Done',
                recommendations,
              });
            }
          } catch {
            // Recommendation failures are non-fatal
          }
        }

        // Step 5: Persist usage to state (best-effort)
        try {
          await stateEngine.state.set(
            `usage:${skillId}:lastRun`,
            new Date().toISOString(),
          );
        } catch {
          // State persistence failures are non-fatal
        }
      };
    },

    async teardown(services: LifecycleServices): Promise<void> {
      await services.stateEngine.close();
    },
  };
}

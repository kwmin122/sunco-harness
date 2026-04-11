/**
 * @sunco/core - Skill Registry
 *
 * In-memory registry of validated skill definitions.
 * Maps skill IDs and commands to SkillDefinition objects.
 * Enforces uniqueness of both IDs and commands (D-14: fail-fast).
 *
 * Phase 32: Alias resolution via aliasByCommand / aliasById maps.
 * Use resolveCommand() / resolveId() for alias-aware lookup.
 * get() / getByCommand() still return ONLY main skills (contract stable).
 *
 * Decisions: D-14 (conflict policy: fail-fast on duplicates)
 */

import type { SkillDefinition, SkillContext, SkillResult, SkillTier } from './types.js';
import { DuplicateSkillError, SkillNotFoundError } from '../errors/index.js';

// ---------------------------------------------------------------------------
// SkillRegistry
// ---------------------------------------------------------------------------

/**
 * Registry holding all registered skills.
 * Ensures unique IDs and unique commands.
 */
export class SkillRegistry {
  /** Map of skill ID -> SkillDefinition */
  private readonly byId = new Map<string, SkillDefinition>();

  /** Map of command name -> SkillDefinition (for CLI dispatch) */
  private readonly byCommand = new Map<string, SkillDefinition>();

  /** Map of alias command -> { main skill id, default args } (Phase 32) */
  private readonly aliasByCommand = new Map<string, { mainId: string; defaultArgs: Record<string, unknown> }>();

  /** Map of alias id -> { main skill id, default args } (Phase 32) */
  private readonly aliasById = new Map<string, { mainId: string; defaultArgs: Record<string, unknown> }>();

  /**
   * Register a skill definition.
   * Throws DuplicateSkillError if ID or command already registered (D-14).
   * Phase 32: also registers aliases from skill.aliases into alias maps.
   */
  register(skill: SkillDefinition): void {
    if (this.byId.has(skill.id)) {
      // Warn and skip — duplicate IDs from scanner + preloaded are expected
      // eslint-disable-next-line no-console
      console.warn(`[sun:registry] Skipping duplicate skill id: '${skill.id}'`);
      return;
    }
    if (this.byCommand.has(skill.command)) {
      // eslint-disable-next-line no-console
      console.warn(`[sun:registry] Skipping duplicate skill command: '${skill.command}'`);
      return;
    }

    this.byId.set(skill.id, skill);
    this.byCommand.set(skill.command, skill);

    // Phase 32: register alias commands and ids
    if (skill.aliases) {
      for (const alias of skill.aliases) {
        if (this.byCommand.has(alias.command) || this.aliasByCommand.has(alias.command)) {
          // eslint-disable-next-line no-console
          console.warn(`[sun:registry] Skipping duplicate alias command: '${alias.command}'`);
          continue;
        }
        this.aliasByCommand.set(alias.command, {
          mainId: skill.id,
          defaultArgs: alias.defaultArgs ? { ...alias.defaultArgs } : {},
        });
        if (alias.id) {
          if (this.byId.has(alias.id) || this.aliasById.has(alias.id)) {
            // eslint-disable-next-line no-console
            console.warn(`[sun:registry] Skipping duplicate alias id: '${alias.id}'`);
            continue;
          }
          this.aliasById.set(alias.id, {
            mainId: skill.id,
            defaultArgs: alias.defaultArgs ? { ...alias.defaultArgs } : {},
          });
        }
      }
    }
  }

  /**
   * Get a skill by its unique ID.
   * Returns undefined if not found.
   */
  get(id: string): SkillDefinition | undefined {
    return this.byId.get(id);
  }

  /**
   * Get a skill by its CLI command name.
   * Returns undefined if not found.
   */
  getByCommand(command: string): SkillDefinition | undefined {
    return this.byCommand.get(command);
  }

  /**
   * Get all registered skills.
   */
  getAll(): SkillDefinition[] {
    return Array.from(this.byId.values());
  }

  /**
   * Get all skills with the specified visibility tier.
   * Used by harness.help to render tier-grouped output (Phase 25: D-01).
   */
  getByTier(tier: SkillTier): SkillDefinition[] {
    return Array.from(this.byId.values()).filter((s) => s.tier === tier);
  }

  /**
   * Check if a skill with the given ID is registered.
   */
  has(id: string): boolean {
    return this.byId.has(id);
  }

  /**
   * Resolve a CLI command to its skill + any default args (alias case).
   * Returns `isAlias: false` for main commands, `isAlias: true` for aliases.
   * Returns undefined if neither a main command nor an alias.
   *
   * Phase 32: alias-aware lookup for skill-router dispatch.
   */
  resolveCommand(cmd: string): { skill: SkillDefinition; defaultArgs: Record<string, unknown>; isAlias: boolean } | undefined {
    const main = this.byCommand.get(cmd);
    if (main) return { skill: main, defaultArgs: {}, isAlias: false };
    const alias = this.aliasByCommand.get(cmd);
    if (!alias) return undefined;
    const skill = this.byId.get(alias.mainId);
    if (!skill) return undefined;
    return { skill, defaultArgs: alias.defaultArgs, isAlias: true };
  }

  /**
   * Resolve a skill id (including legacy alias ids) to skill + default args.
   * Used by ctx.run() to keep backward compat after deleting alias skill files.
   *
   * Phase 32: resolves 'workflow.fast' -> quick skill with defaultArgs.
   */
  resolveId(id: string): { skill: SkillDefinition; defaultArgs: Record<string, unknown>; isAlias: boolean } | undefined {
    const main = this.byId.get(id);
    if (main) return { skill: main, defaultArgs: {}, isAlias: false };
    const alias = this.aliasById.get(id);
    if (!alias) return undefined;
    const skill = this.byId.get(alias.mainId);
    if (!skill) return undefined;
    return { skill, defaultArgs: alias.defaultArgs, isAlias: true };
  }

  /**
   * Execute a skill by ID with the given context.
   * Phase 32: resolves alias ids transparently via resolveId().
   * Merges defaultArgs under user args (user args win on conflict).
   * Throws SkillNotFoundError if neither main id nor alias id found.
   */
  async execute(
    id: string,
    context: SkillContext,
  ): Promise<SkillResult> {
    const resolution = this.resolveId(id);
    if (!resolution) {
      throw new SkillNotFoundError(id);
    }
    const mergedArgs = { ...resolution.defaultArgs, ...(context.args ?? {}) };
    const ctxWithMergedArgs = { ...context, args: mergedArgs };
    return resolution.skill.execute(ctxWithMergedArgs);
  }

  /**
   * Number of registered skills.
   */
  get size(): number {
    return this.byId.size;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new empty SkillRegistry.
 */
export function createRegistry(): SkillRegistry {
  return new SkillRegistry();
}

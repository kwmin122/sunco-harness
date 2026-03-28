/**
 * @sunco/core - Skill Registry
 *
 * In-memory registry of validated skill definitions.
 * Maps skill IDs and commands to SkillDefinition objects.
 * Enforces uniqueness of both IDs and commands (D-14: fail-fast).
 *
 * Decisions: D-14 (conflict policy: fail-fast on duplicates)
 */

import type { SkillDefinition, SkillContext, SkillResult } from './types.js';
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

  /**
   * Register a skill definition.
   * Throws DuplicateSkillError if ID or command already registered (D-14).
   */
  register(skill: SkillDefinition): void {
    if (this.byId.has(skill.id)) {
      throw new DuplicateSkillError(skill.id, 'id');
    }
    if (this.byCommand.has(skill.command)) {
      throw new DuplicateSkillError(skill.command, 'command');
    }

    this.byId.set(skill.id, skill);
    this.byCommand.set(skill.command, skill);
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
   * Check if a skill with the given ID is registered.
   */
  has(id: string): boolean {
    return this.byId.has(id);
  }

  /**
   * Execute a skill by ID with the given context.
   * Throws SkillNotFoundError if not registered.
   */
  async execute(
    id: string,
    context: SkillContext,
  ): Promise<SkillResult> {
    const skill = this.byId.get(id);
    if (!skill) {
      throw new SkillNotFoundError(id);
    }
    return skill.execute(context);
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

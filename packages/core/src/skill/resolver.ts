/**
 * @sunco/core - Skill Resolution Pipeline (D-13)
 *
 * Resolves which skills are active based on:
 *   1. Scan discovered skills (validate metadata)
 *   2. Expand preset
 *   3. Union with policy.add
 *   4. Subtract policy.remove
 *   5. Filter to discovered set
 *   6. Stage filter (internal excluded unless explicitly added)
 *   7. Duplicate check (D-14: fail-fast)
 *
 * Returns Set<SkillId> of active skill IDs.
 *
 * Decisions: D-13 (resolution pipeline), D-14 (conflict policy)
 */

import type { SkillDefinition } from './types.js';
import type { SkillPolicyConfig } from '../config/types.js';
import { DuplicateSkillError } from '../errors/index.js';
import { expandPreset } from './preset.js';

// ---------------------------------------------------------------------------
// Resolution Pipeline
// ---------------------------------------------------------------------------

/**
 * Resolve the set of active skill IDs from discovered skills and config policy.
 *
 * @param discovered - All skill definitions found by scanner
 * @param policy - Skill activation policy from config
 * @returns Set of active skill IDs
 * @throws DuplicateSkillError if duplicate IDs or commands found in discovered
 */
export function resolveActiveSkills(
  discovered: SkillDefinition[],
  policy: SkillPolicyConfig,
): Set<string> {
  // Step 1: Validate discovered -- check for duplicate IDs and commands (D-14)
  const seenIds = new Set<string>();
  const seenCommands = new Set<string>();

  for (const skill of discovered) {
    if (seenIds.has(skill.id)) {
      throw new DuplicateSkillError(skill.id, 'id');
    }
    seenIds.add(skill.id);

    if (seenCommands.has(skill.command)) {
      throw new DuplicateSkillError(skill.command, 'command');
    }
    seenCommands.add(skill.command);
  }

  // Build lookup for quick access
  const discoveredById = new Map<string, SkillDefinition>();
  for (const skill of discovered) {
    discoveredById.set(skill.id, skill);
  }

  // Step 2: Expand preset to get base skill IDs
  const presetIds = expandPreset(policy.preset);
  const active = new Set<string>(presetIds);

  // Step 3: Union with policy.add
  for (const id of policy.add) {
    active.add(id);
  }

  // Step 4: Subtract policy.remove
  for (const id of policy.remove) {
    active.delete(id);
  }

  // Step 5: Filter to only skills present in discovered set
  const filtered = new Set<string>();
  for (const id of active) {
    if (discoveredById.has(id)) {
      filtered.add(id);
    }
  }

  // Step 6: Stage filter -- internal skills excluded unless explicitly added
  const explicitlyAdded = new Set(policy.add);
  const result = new Set<string>();
  for (const id of filtered) {
    const skill = discoveredById.get(id)!;
    if (skill.stage === 'internal' && !explicitlyAdded.has(id)) {
      continue; // skip internal unless explicitly added
    }
    result.add(id);
  }

  return result;
}

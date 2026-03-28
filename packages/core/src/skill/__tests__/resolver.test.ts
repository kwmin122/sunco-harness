/**
 * @sunco/core - Skill Resolver tests
 *
 * Tests the D-13 resolution pipeline:
 * scan -> validate -> preset expand -> add -> remove -> filter -> Set<SkillId>
 */

import { describe, it, expect } from 'vitest';
import { resolveActiveSkills } from '../resolver.js';
import { defineSkill } from '../define.js';
import { DuplicateSkillError } from '../../errors/index.js';
import type { SkillDefinition } from '../types.js';
import type { SkillPolicyConfig } from '../../config/types.js';

/** Helper to make a minimal valid SkillDefinition */
function makeSkill(overrides: Partial<SkillDefinition> & { id: string; command: string }): SkillDefinition {
  return defineSkill({
    kind: 'deterministic',
    stage: 'stable',
    category: 'harness',
    routing: 'directExec',
    description: `Test skill ${overrides.id}`,
    execute: async () => ({ success: true }),
    ...overrides,
  });
}

const defaultPolicy: SkillPolicyConfig = {
  preset: 'none',
  add: [],
  remove: [],
};

describe('resolveActiveSkills', () => {
  it('returns empty Set with preset=none and no add/remove', () => {
    const discovered = [
      makeSkill({ id: 'harness.init', command: 'init' }),
    ];
    const result = resolveActiveSkills(discovered, defaultPolicy);
    expect(result.size).toBe(0);
  });

  it('expands preset and filters by discovered skills', () => {
    const discovered = [
      makeSkill({ id: 'harness.init', command: 'init' }),
      makeSkill({ id: 'harness.lint', command: 'lint' }),
      makeSkill({ id: 'harness.health', command: 'health' }),
    ];

    const result = resolveActiveSkills(discovered, {
      preset: 'harness',
      add: [],
      remove: [],
    });

    // harness preset has 5 skills but only 3 are discovered
    expect(result.size).toBe(3);
    expect(result.has('harness.init')).toBe(true);
    expect(result.has('harness.lint')).toBe(true);
    expect(result.has('harness.health')).toBe(true);
    // Not discovered, so not in result
    expect(result.has('harness.agents')).toBe(false);
    expect(result.has('harness.guard')).toBe(false);
  });

  it('adds skills via policy.add', () => {
    const discovered = [
      makeSkill({ id: 'workflow.status', command: 'status' }),
    ];

    const result = resolveActiveSkills(discovered, {
      preset: 'none',
      add: ['workflow.status'],
      remove: [],
    });

    expect(result.has('workflow.status')).toBe(true);
  });

  it('removes skills via policy.remove', () => {
    const discovered = [
      makeSkill({ id: 'harness.init', command: 'init' }),
      makeSkill({ id: 'harness.lint', command: 'lint' }),
      makeSkill({ id: 'harness.health', command: 'health' }),
      makeSkill({ id: 'harness.agents', command: 'agents' }),
      makeSkill({ id: 'harness.guard', command: 'guard' }),
    ];

    const result = resolveActiveSkills(discovered, {
      preset: 'harness',
      add: [],
      remove: ['harness.agents'],
    });

    expect(result.has('harness.agents')).toBe(false);
    expect(result.has('harness.init')).toBe(true);
  });

  it('throws DuplicateSkillError for duplicate IDs in discovered', () => {
    const discovered = [
      makeSkill({ id: 'harness.init', command: 'init' }),
      makeSkill({ id: 'harness.init', command: 'init2' }),
    ];

    expect(() =>
      resolveActiveSkills(discovered, defaultPolicy),
    ).toThrow(DuplicateSkillError);
  });

  it('throws DuplicateSkillError for duplicate commands in discovered', () => {
    const discovered = [
      makeSkill({ id: 'a.init', command: 'init' }),
      makeSkill({ id: 'b.init', command: 'init' }),
    ];

    expect(() =>
      resolveActiveSkills(discovered, defaultPolicy),
    ).toThrow(DuplicateSkillError);
  });

  it('filters out internal skills unless explicitly added', () => {
    const discovered = [
      makeSkill({ id: 'core.debug', command: 'debug', stage: 'internal' }),
      makeSkill({ id: 'harness.init', command: 'init' }),
    ];

    // Preset includes both but internal should be filtered
    const result = resolveActiveSkills(discovered, {
      preset: 'none',
      add: ['core.debug', 'harness.init'],
      remove: [],
    });

    // core.debug is explicitly added, so it should be included
    expect(result.has('core.debug')).toBe(true);
    expect(result.has('harness.init')).toBe(true);
  });

  it('excludes internal skills from preset expansion', () => {
    const discovered = [
      makeSkill({ id: 'harness.init', command: 'init', stage: 'internal' }),
      makeSkill({ id: 'harness.lint', command: 'lint' }),
    ];

    const result = resolveActiveSkills(discovered, {
      preset: 'harness',
      add: [],
      remove: [],
    });

    // harness.init is internal and not explicitly added
    expect(result.has('harness.init')).toBe(false);
    expect(result.has('harness.lint')).toBe(true);
  });

  it('handles empty discovered array', () => {
    const result = resolveActiveSkills([], {
      preset: 'harness',
      add: ['custom.skill'],
      remove: [],
    });

    // Nothing discovered, so nothing active (even if preset expands)
    expect(result.size).toBe(0);
  });

  it('handles unknown preset gracefully (returns empty expansion)', () => {
    const discovered = [
      makeSkill({ id: 'harness.init', command: 'init' }),
    ];

    const result = resolveActiveSkills(discovered, {
      preset: 'unknown-preset',
      add: [],
      remove: [],
    });

    // Unknown preset expands to empty, no add, so nothing active
    expect(result.size).toBe(0);
  });

  it('add and remove interact correctly', () => {
    const discovered = [
      makeSkill({ id: 'harness.init', command: 'init' }),
      makeSkill({ id: 'harness.lint', command: 'lint' }),
    ];

    const result = resolveActiveSkills(discovered, {
      preset: 'none',
      add: ['harness.init', 'harness.lint'],
      remove: ['harness.init'],
    });

    expect(result.has('harness.init')).toBe(false);
    expect(result.has('harness.lint')).toBe(true);
  });
});

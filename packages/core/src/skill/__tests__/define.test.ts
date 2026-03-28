/**
 * @sunco/core - defineSkill() tests
 *
 * Tests Zod validation, frozen output, and edge cases.
 */

import { describe, it, expect } from 'vitest';
import { defineSkill } from '../define.js';
import type { SkillDefinitionInput } from '../types.js';

/** Valid minimal input for convenience */
const validInput: SkillDefinitionInput = {
  id: 'harness.init',
  command: 'init',
  kind: 'deterministic',
  stage: 'stable',
  category: 'harness',
  routing: 'directExec',
  description: 'Initialize project harness',
  execute: async () => ({ success: true }),
};

describe('defineSkill', () => {
  it('returns a validated SkillDefinition from valid input', () => {
    const skill = defineSkill(validInput);

    expect(skill.id).toBe('harness.init');
    expect(skill.command).toBe('init');
    expect(skill.kind).toBe('deterministic');
    expect(skill.stage).toBe('stable');
    expect(skill.category).toBe('harness');
    expect(skill.routing).toBe('directExec');
    expect(skill.description).toBe('Initialize project harness');
    expect(typeof skill.execute).toBe('function');
  });

  it('returns a frozen object', () => {
    const skill = defineSkill(validInput);
    expect(Object.isFrozen(skill)).toBe(true);
  });

  it('throws ZodError when given empty object', () => {
    expect(() => defineSkill({} as SkillDefinitionInput)).toThrow();
  });

  it('throws when id is empty string', () => {
    expect(() =>
      defineSkill({ ...validInput, id: '' }),
    ).toThrow();
  });

  it('throws when command is empty string', () => {
    expect(() =>
      defineSkill({ ...validInput, command: '' }),
    ).toThrow();
  });

  it('throws when description is empty string', () => {
    expect(() =>
      defineSkill({ ...validInput, description: '' }),
    ).toThrow();
  });

  it('throws when kind is invalid', () => {
    expect(() =>
      defineSkill({ ...validInput, kind: 'invalid' as 'deterministic' }),
    ).toThrow();
  });

  it('throws when stage is invalid', () => {
    expect(() =>
      defineSkill({ ...validInput, stage: 'invalid' as 'stable' }),
    ).toThrow();
  });

  it('throws when routing is invalid', () => {
    expect(() =>
      defineSkill({ ...validInput, routing: 'invalid' as 'routable' }),
    ).toThrow();
  });

  it('includes optional options array in result', () => {
    const skill = defineSkill({
      ...validInput,
      options: [
        { flags: '--verbose', description: 'Enable verbose output' },
        { flags: '-f, --force', description: 'Force operation', defaultValue: false },
      ],
    });

    expect(skill.options).toHaveLength(2);
    expect(skill.options![0].flags).toBe('--verbose');
    expect(skill.options![1].defaultValue).toBe(false);
  });

  it('freezes options array entries', () => {
    const skill = defineSkill({
      ...validInput,
      options: [{ flags: '--verbose', description: 'Verbose' }],
    });

    expect(Object.isFrozen(skill.options![0])).toBe(true);
  });

  it('returns undefined options when not provided', () => {
    const skill = defineSkill(validInput);
    expect(skill.options).toBeUndefined();
  });

  it('execute function is callable and returns SkillResult', async () => {
    const skill = defineSkill(validInput);
    const result = await skill.execute({} as Parameters<typeof skill.execute>[0]);
    expect(result).toEqual({ success: true });
  });

  it('throws when execute is not a function', () => {
    expect(() =>
      defineSkill({ ...validInput, execute: 'not-a-function' as unknown as SkillDefinitionInput['execute'] }),
    ).toThrow();
  });
});

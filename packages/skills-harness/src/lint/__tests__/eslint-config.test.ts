import { describe, it, expect } from 'vitest';
import { ESLINT_IGNORES, buildFlatConfig } from '../eslint-config.js';
import type { BoundariesConfig } from '../types.js';

describe('eslint-config', () => {
  describe('ESLINT_IGNORES', () => {
    it('contains **/dist/**', () => {
      expect(ESLINT_IGNORES).toContain('**/dist/**');
    });

    it('contains **/node_modules/**', () => {
      expect(ESLINT_IGNORES).toContain('**/node_modules/**');
    });

    it('contains **/coverage/**', () => {
      expect(ESLINT_IGNORES).toContain('**/coverage/**');
    });

    it('contains **/.sun/**', () => {
      expect(ESLINT_IGNORES).toContain('**/.sun/**');
    });
  });

  describe('buildFlatConfig', () => {
    const emptyConfig: BoundariesConfig = {
      elements: [],
      dependencyRules: [],
    };

    const nonEmptyConfig: BoundariesConfig = {
      elements: [{ type: 'core', pattern: 'src/core', mode: 'folder' }],
      dependencyRules: [{ from: { type: 'core' }, allow: { to: { type: 'core' } } }],
    };

    it('returns array with ignores object at index 0 containing **/dist/**', () => {
      const config = buildFlatConfig({ boundariesConfig: emptyConfig });
      expect(Array.isArray(config)).toBe(true);
      expect(config.length).toBeGreaterThanOrEqual(2);
      const ignoresObj = config[0] as { ignores: string[] };
      expect(ignoresObj.ignores).toContain('**/dist/**');
    });

    it('with empty elements omits plugins key from file config', () => {
      const config = buildFlatConfig({ boundariesConfig: emptyConfig });
      const fileConfig = config[1] as Record<string, unknown>;
      expect(fileConfig).not.toHaveProperty('plugins');
      expect(fileConfig).not.toHaveProperty('rules');
    });

    it('with non-empty elements includes boundaries/dependencies rule', () => {
      const config = buildFlatConfig({ boundariesConfig: nonEmptyConfig });
      const fileConfig = config[1] as Record<string, unknown>;
      expect(fileConfig).toHaveProperty('plugins');
      const rules = fileConfig.rules as Record<string, unknown>;
      expect(rules).toHaveProperty('boundaries/dependencies');
    });

    it('appends extraIgnores to the standard set', () => {
      const config = buildFlatConfig({
        boundariesConfig: emptyConfig,
        extraIgnores: ['**/fixtures/**'],
      });
      const ignoresObj = config[0] as { ignores: string[] };
      expect(ignoresObj.ignores).toContain('**/fixtures/**');
      // Standard ignores still present
      expect(ignoresObj.ignores).toContain('**/dist/**');
    });
  });
});

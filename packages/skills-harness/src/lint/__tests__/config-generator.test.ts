/**
 * Tests for lint config generator.
 * Verifies DetectedLayer[] -> eslint-plugin-boundaries flat config conversion.
 */
import { describe, it, expect } from 'vitest';
import type { DetectedLayer } from '../../init/types.js';
import { generateBoundariesConfig, generateEslintFlatConfig } from '../config-generator.js';

/** Fixture: common layer patterns matching COMMON_LAYER_PATTERNS from init/types.ts */
const FIXTURE_LAYERS: DetectedLayer[] = [
  {
    name: 'types',
    pattern: 'src/types/**',
    dirPatterns: ['types', 'typings', 'interfaces'],
    canImportFrom: [],
  },
  {
    name: 'config',
    pattern: 'src/config/**',
    dirPatterns: ['config', 'configuration', 'settings'],
    canImportFrom: ['types'],
  },
  {
    name: 'utils',
    pattern: 'src/utils/**',
    dirPatterns: ['utils', 'utilities', 'helpers', 'lib', 'shared'],
    canImportFrom: ['types', 'config'],
  },
  {
    name: 'domain',
    pattern: 'src/domain/**',
    dirPatterns: ['domain', 'models', 'entities', 'services', 'core'],
    canImportFrom: ['types', 'config', 'utils'],
  },
  {
    name: 'handler',
    pattern: 'src/handlers/**',
    dirPatterns: ['handlers', 'controllers', 'routes', 'api', 'endpoints'],
    canImportFrom: ['types', 'config', 'utils', 'domain'],
  },
  {
    name: 'ui',
    pattern: 'src/ui/**',
    dirPatterns: ['ui', 'views', 'pages', 'components', 'screens'],
    canImportFrom: ['types', 'config', 'utils', 'domain'],
  },
  {
    name: 'infra',
    pattern: 'src/infra/**',
    dirPatterns: ['infra', 'infrastructure', 'db', 'database', 'adapters', 'external'],
    canImportFrom: ['types', 'config', 'utils', 'domain'],
  },
];

describe('config-generator', () => {
  describe('generateBoundariesConfig', () => {
    it('returns config with empty elements array for empty layers', () => {
      const config = generateBoundariesConfig([]);

      expect(config.elements).toEqual([]);
      expect(config.dependencyRules).toEqual([]);
    });

    it('produces correct element types and dependency rules for 2 layers', () => {
      const twoLayers: DetectedLayer[] = [
        {
          name: 'domain',
          pattern: 'src/domain/**',
          dirPatterns: ['domain'],
          canImportFrom: ['types'],
        },
        {
          name: 'types',
          pattern: 'src/types/**',
          dirPatterns: ['types'],
          canImportFrom: [],
        },
      ];

      const config = generateBoundariesConfig(twoLayers);

      // Elements
      expect(config.elements).toHaveLength(2);
      expect(config.elements).toContainEqual({ type: 'domain', pattern: 'src/domain/**' });
      expect(config.elements).toContainEqual({ type: 'types', pattern: 'src/types/**' });

      // Dependency rules
      expect(config.dependencyRules).toHaveLength(2);

      const domainRule = config.dependencyRules.find(
        (r) => r.from[0]!.type === 'domain',
      );
      expect(domainRule).toBeDefined();
      expect(domainRule!.allow).toEqual([{ type: 'types' }]);

      const typesRule = config.dependencyRules.find(
        (r) => r.from[0]!.type === 'types',
      );
      expect(typesRule).toBeDefined();
      expect(typesRule!.allow).toEqual([]);
    });

    it('types layer produces no allowed imports (types imports nothing)', () => {
      const config = generateBoundariesConfig(FIXTURE_LAYERS);

      const typesRule = config.dependencyRules.find(
        (r) => r.from[0]!.type === 'types',
      );
      expect(typesRule).toBeDefined();
      expect(typesRule!.allow).toEqual([]);
    });

    it('handler layer allows importing from types, config, utils, domain', () => {
      const config = generateBoundariesConfig(FIXTURE_LAYERS);

      const handlerRule = config.dependencyRules.find(
        (r) => r.from[0]!.type === 'handler',
      );
      expect(handlerRule).toBeDefined();
      expect(handlerRule!.allow).toEqual([
        { type: 'types' },
        { type: 'config' },
        { type: 'utils' },
        { type: 'domain' },
      ]);
    });

    it('ui layer disallows importing from handler and infra', () => {
      const config = generateBoundariesConfig(FIXTURE_LAYERS);

      const uiRule = config.dependencyRules.find(
        (r) => r.from[0]!.type === 'ui',
      );
      expect(uiRule).toBeDefined();

      // UI can import: types, config, utils, domain
      const allowedTypes = uiRule!.allow.map((a) => a.type);
      expect(allowedTypes).not.toContain('handler');
      expect(allowedTypes).not.toContain('infra');
      expect(allowedTypes).toContain('types');
      expect(allowedTypes).toContain('domain');
    });
  });

  describe('generateEslintFlatConfig', () => {
    it('produces flat config array with boundaries plugin, settings, and rules', () => {
      const config = generateBoundariesConfig(FIXTURE_LAYERS);
      const flatConfig = generateEslintFlatConfig(config);

      expect(Array.isArray(flatConfig)).toBe(true);
      expect(flatConfig).toHaveLength(1);

      const entry = flatConfig[0] as Record<string, unknown>;

      // Has plugins with boundaries
      expect(entry['plugins']).toBeDefined();
      const plugins = entry['plugins'] as Record<string, unknown>;
      expect(plugins['boundaries']).toBeDefined();

      // Has settings with boundaries/elements
      expect(entry['settings']).toBeDefined();
      const settings = entry['settings'] as Record<string, unknown>;
      expect(settings['boundaries/elements']).toEqual(config.elements);

      // Has rules with boundaries/dependencies using 'disallow' default
      expect(entry['rules']).toBeDefined();
      const rules = entry['rules'] as Record<string, unknown>;
      const depsRule = rules['boundaries/dependencies'] as unknown[];
      expect(depsRule[0]).toBe(2);
      const depsConfig = depsRule[1] as Record<string, unknown>;
      expect(depsConfig['default']).toBe('disallow');
      expect(depsConfig['rules']).toEqual(config.dependencyRules);
    });
  });
});

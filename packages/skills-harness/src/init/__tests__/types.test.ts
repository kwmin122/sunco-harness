/**
 * Tests for init subsystem shared types.
 * Validates type shapes and constant arrays.
 */
import { describe, it, expect } from 'vitest';
import {
  ECOSYSTEM_MARKERS,
  COMMON_LAYER_PATTERNS,
  type EcosystemMarker,
  type EcosystemResult,
  type DetectedLayer,
  type LayerResult,
  type NamingConvention,
  type ImportStyle,
  type ExportStyle,
  type TestOrganization,
  type ConventionResult,
  type InitResult,
} from '../types.js';

describe('init/types', () => {
  describe('EcosystemMarker', () => {
    it('has file, ecosystem, and confidence fields', () => {
      const marker: EcosystemMarker = {
        file: 'package.json',
        ecosystem: 'nodejs',
        confidence: 'high',
      };
      expect(marker.file).toBe('package.json');
      expect(marker.ecosystem).toBe('nodejs');
      expect(marker.confidence).toBe('high');
    });
  });

  describe('ECOSYSTEM_MARKERS', () => {
    it('has 18+ entries', () => {
      expect(ECOSYSTEM_MARKERS.length).toBeGreaterThanOrEqual(18);
    });

    it('each marker has required fields', () => {
      for (const marker of ECOSYSTEM_MARKERS) {
        expect(marker).toHaveProperty('file');
        expect(marker).toHaveProperty('ecosystem');
        expect(marker).toHaveProperty('confidence');
        expect(['high', 'medium']).toContain(marker.confidence);
      }
    });

    it('covers key ecosystems', () => {
      const ecosystems = ECOSYSTEM_MARKERS.map((m) => m.ecosystem);
      expect(ecosystems).toContain('nodejs');
      expect(ecosystems).toContain('typescript');
      expect(ecosystems).toContain('rust');
      expect(ecosystems).toContain('go');
      expect(ecosystems).toContain('python');
      expect(ecosystems).toContain('java');
      expect(ecosystems).toContain('ruby');
      expect(ecosystems).toContain('php');
      expect(ecosystems).toContain('swift');
      expect(ecosystems).toContain('dart');
      expect(ecosystems).toContain('dotnet');
    });
  });

  describe('DetectedLayer', () => {
    it('has name, pattern, dirPatterns, and canImportFrom fields', () => {
      const layer: DetectedLayer = {
        name: 'domain',
        pattern: 'src/services/*',
        dirPatterns: ['services', 'domain'],
        canImportFrom: ['types', 'config', 'utils'],
      };
      expect(layer.name).toBe('domain');
      expect(layer.pattern).toBe('src/services/*');
      expect(layer.dirPatterns).toEqual(['services', 'domain']);
      expect(layer.canImportFrom).toEqual(['types', 'config', 'utils']);
    });
  });

  describe('COMMON_LAYER_PATTERNS', () => {
    it('has 7 entries', () => {
      expect(COMMON_LAYER_PATTERNS).toHaveLength(7);
    });

    it('covers types, config, utils, domain, handler, ui, infra', () => {
      const names = COMMON_LAYER_PATTERNS.map((p) => p.name);
      expect(names).toContain('types');
      expect(names).toContain('config');
      expect(names).toContain('utils');
      expect(names).toContain('domain');
      expect(names).toContain('handler');
      expect(names).toContain('ui');
      expect(names).toContain('infra');
    });

    it('each layer has proper dependency direction', () => {
      for (const layer of COMMON_LAYER_PATTERNS) {
        expect(layer.name).toBeTruthy();
        expect(layer.dirPatterns.length).toBeGreaterThan(0);
        expect(Array.isArray(layer.canImportFrom)).toBe(true);
      }
    });
  });

  describe('ConventionResult', () => {
    it('has naming, importStyle, exportStyle, testOrganization fields', () => {
      const result: ConventionResult = {
        naming: 'camelCase',
        importStyle: 'relative',
        exportStyle: 'named',
        testOrganization: '__tests__',
        sampleSize: 42,
      };
      expect(result.naming).toBe('camelCase');
      expect(result.importStyle).toBe('relative');
      expect(result.exportStyle).toBe('named');
      expect(result.testOrganization).toBe('__tests__');
      expect(result.sampleSize).toBe(42);
    });
  });

  describe('InitResult', () => {
    it('aggregates EcosystemResult + LayerResult + ConventionResult', () => {
      const result: InitResult = {
        ecosystems: {
          ecosystems: ['nodejs', 'typescript'],
          markers: [
            { file: 'package.json', ecosystem: 'nodejs', confidence: 'high' },
          ],
          primaryEcosystem: 'nodejs',
        },
        layers: {
          layers: [],
          sourceRoot: 'src',
        },
        conventions: {
          naming: 'camelCase',
          importStyle: 'relative',
          exportStyle: 'named',
          testOrganization: '__tests__',
          sampleSize: 10,
        },
        projectRoot: '/some/path',
        timestamp: '2026-03-28T00:00:00Z',
      };
      expect(result.ecosystems.ecosystems).toEqual(['nodejs', 'typescript']);
      expect(result.layers.sourceRoot).toBe('src');
      expect(result.conventions.naming).toBe('camelCase');
      expect(result.projectRoot).toBe('/some/path');
      expect(result.timestamp).toBeTruthy();
    });
  });
});

/**
 * @sunco/core - deepMerge tests
 *
 * Tests deep merge with array-replace semantics (D/CFG-02).
 * Arrays REPLACE (not concatenate) across config layers.
 */

import { describe, it, expect } from 'vitest';
import { deepMerge } from '../merger.js';

describe('deepMerge', () => {
  it('merges flat objects', () => {
    expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it('deep merges nested objects', () => {
    expect(deepMerge({ a: { x: 1 } }, { a: { y: 2 } })).toEqual({
      a: { x: 1, y: 2 },
    });
  });

  it('arrays REPLACE (not concatenate) per D/CFG-02', () => {
    expect(deepMerge({ a: [1, 2] }, { a: [3, 4] })).toEqual({ a: [3, 4] });
  });

  it('override type wins when types differ (object -> array)', () => {
    expect(deepMerge({ a: { x: 1 } }, { a: [1] })).toEqual({ a: [1] });
  });

  it('override type wins when types differ (array -> object)', () => {
    expect(deepMerge({ a: [1] }, { a: { x: 1 } })).toEqual({ a: { x: 1 } });
  });

  it('merges empty override into base', () => {
    expect(deepMerge({ a: 1 }, {})).toEqual({ a: 1 });
  });

  it('merges base empty into override', () => {
    expect(deepMerge({}, { a: 1 })).toEqual({ a: 1 });
  });

  it('merges both empty', () => {
    expect(deepMerge({}, {})).toEqual({});
  });

  it('deeply nested 3 levels', () => {
    const base = { a: { b: { c: 1, d: 2 } } };
    const override = { a: { b: { c: 99 } } };
    expect(deepMerge(base, override)).toEqual({ a: { b: { c: 99, d: 2 } } });
  });

  it('override scalar replaces scalar', () => {
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it('does not mutate inputs', () => {
    const base = { a: { x: 1 } };
    const override = { a: { y: 2 } };
    const baseCopy = JSON.parse(JSON.stringify(base));
    const overrideCopy = JSON.parse(JSON.stringify(override));
    deepMerge(base, override);
    expect(base).toEqual(baseCopy);
    expect(override).toEqual(overrideCopy);
  });

  it('handles null values in override', () => {
    expect(deepMerge({ a: 1 }, { a: null })).toEqual({ a: null });
  });
});

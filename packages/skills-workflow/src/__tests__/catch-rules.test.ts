/**
 * Tests for catch-rules.ts — markdown-based pre-commit validation rules.
 * Requirements: LH-15
 */

import { describe, it, expect } from 'vitest';
import { parseCatchRules, applyCatchRules } from '../shared/catch-rules.js';
import type { CatchRule } from '../shared/catch-rules.js';

// ---------------------------------------------------------------------------
// parseCatchRules
// ---------------------------------------------------------------------------

describe('parseCatchRules', () => {
  it('parses a single catch rule from markdown', () => {
    const md = `
## No console.log
- pattern: \`console\\.log\`
- severity: error
- message: Use structured logging instead of console.log
`;

    const rules = parseCatchRules(md);
    expect(rules).toHaveLength(1);
    expect(rules[0].name).toBe('No console.log');
    expect(rules[0].severity).toBe('error');
    expect(rules[0].message).toBe('Use structured logging instead of console.log');
    expect(rules[0].pattern).toBeInstanceOf(RegExp);
  });

  it('parses multiple rules', () => {
    const md = `
## No console.log
- pattern: \`console\\.log\`
- severity: error
- message: Use structured logging

## No TODO comments
- pattern: \`TODO\`
- severity: warning
- message: Resolve TODO comments before committing
`;

    const rules = parseCatchRules(md);
    expect(rules).toHaveLength(2);
    expect(rules[0].name).toBe('No console.log');
    expect(rules[1].name).toBe('No TODO comments');
    expect(rules[1].severity).toBe('warning');
  });

  it('skips incomplete rule blocks (missing pattern)', () => {
    const md = `
## Missing Pattern
- severity: error
- message: This has no pattern
`;

    const rules = parseCatchRules(md);
    expect(rules).toHaveLength(0);
  });

  it('skips incomplete rule blocks (missing severity)', () => {
    const md = `
## Missing Severity
- pattern: \`foo\`
- message: This has no severity
`;

    const rules = parseCatchRules(md);
    expect(rules).toHaveLength(0);
  });

  it('skips incomplete rule blocks (missing message)', () => {
    const md = `
## Missing Message
- pattern: \`foo\`
- severity: error
`;

    const rules = parseCatchRules(md);
    expect(rules).toHaveLength(0);
  });

  it('handles invalid regex patterns gracefully', () => {
    const md = `
## Bad Regex
- pattern: \`([unclosed\`
- severity: error
- message: This regex is broken
`;

    const rules = parseCatchRules(md);
    expect(rules).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(parseCatchRules('')).toEqual([]);
  });

  it('ignores non-rule markdown content', () => {
    const md = `
# Top level heading

Some paragraph text.

## Actual Rule
- pattern: \`debugger\`
- severity: error
- message: Remove debugger statements

Random text between rules.

- unrelated list item
`;

    const rules = parseCatchRules(md);
    expect(rules).toHaveLength(1);
    expect(rules[0].name).toBe('Actual Rule');
  });
});

// ---------------------------------------------------------------------------
// applyCatchRules
// ---------------------------------------------------------------------------

describe('applyCatchRules', () => {
  const sampleRules: CatchRule[] = [
    {
      name: 'No console.log',
      pattern: /console\.log/g,
      severity: 'error',
      message: 'Use structured logging',
    },
    {
      name: 'No TODO',
      pattern: /TODO/g,
      severity: 'warning',
      message: 'Resolve TODOs',
    },
  ];

  it('finds matches for applicable rules', () => {
    const content = `
      console.log('debug');
      // TODO: fix this
    `;

    const results = applyCatchRules(content, sampleRules);
    expect(results).toHaveLength(2);
    expect(results[0].rule.name).toBe('No console.log');
    expect(results[0].matches).toEqual(['console.log']);
    expect(results[1].rule.name).toBe('No TODO');
    expect(results[1].matches).toEqual(['TODO']);
  });

  it('returns empty array when no rules match', () => {
    const content = 'const x = 42;';
    const results = applyCatchRules(content, sampleRules);
    expect(results).toEqual([]);
  });

  it('collects multiple matches per rule', () => {
    const content = `
      console.log('a');
      console.log('b');
      console.log('c');
    `;

    const results = applyCatchRules(content, [sampleRules[0]]);
    expect(results).toHaveLength(1);
    expect(results[0].matches).toHaveLength(3);
  });

  it('handles empty content', () => {
    const results = applyCatchRules('', sampleRules);
    expect(results).toEqual([]);
  });

  it('handles empty rules array', () => {
    const results = applyCatchRules('console.log("hi")', []);
    expect(results).toEqual([]);
  });

  it('resets regex state between invocations', () => {
    const rules: CatchRule[] = [
      { name: 'test', pattern: /abc/g, severity: 'error', message: 'msg' },
    ];

    // First call
    const r1 = applyCatchRules('abc abc', rules);
    expect(r1).toHaveLength(1);
    expect(r1[0].matches).toHaveLength(2);

    // Second call — should work identically (regex lastIndex reset)
    const r2 = applyCatchRules('abc abc', rules);
    expect(r2).toHaveLength(1);
    expect(r2[0].matches).toHaveLength(2);
  });
});

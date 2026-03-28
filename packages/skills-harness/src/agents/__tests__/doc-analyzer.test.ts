/**
 * Tests for agent doc analyzer.
 * Verifies line counting, section detection, instruction density,
 * convention/constraint/architecture detection, contradiction detection,
 * and the 60-line warning threshold.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { analyzeAgentDoc } from '../doc-analyzer.js';

describe('analyzeAgentDoc', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sunco-agents-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns totalLines matching actual line count', async () => {
    const content = [
      '# CLAUDE.md',
      '',
      '## Project',
      '',
      'This is a project.',
      '',
      '## Constraints',
      '',
      '- Use TypeScript',
      '- No jQuery',
    ].join('\n');
    const filePath = join(tempDir, 'CLAUDE.md');
    await writeFile(filePath, content);

    const metrics = await analyzeAgentDoc(filePath);

    expect(metrics.totalLines).toBe(10);
    expect(metrics.filePath).toBe(filePath);
  });

  it('detects ## sections correctly (sectionCount)', async () => {
    const content = [
      '# Main Title',
      '',
      '## Section One',
      'Some content',
      '',
      '## Section Two',
      'More content',
      '',
      '### Subsection',
      'Details here',
    ].join('\n');
    const filePath = join(tempDir, 'agents.md');
    await writeFile(filePath, content);

    const metrics = await analyzeAgentDoc(filePath);

    // # Main Title, ## Section One, ## Section Two, ### Subsection = 4
    expect(metrics.sectionCount).toBe(4);
    expect(metrics.sections).toHaveLength(4);
  });

  it('computes instructionDensity (instructions per section)', async () => {
    const content = [
      '## Rules',
      '',
      '- Always use strict mode',
      '- Never use any type',
      '- Must write tests',
      '',
      '## Notes',
      '',
      'Just some descriptive text.',
      'Another descriptive line.',
    ].join('\n');
    const filePath = join(tempDir, 'CLAUDE.md');
    await writeFile(filePath, content);

    const metrics = await analyzeAgentDoc(filePath);

    // Rules section: 3 instruction lines, Notes section: 0 instruction lines
    // Total instructions: 3, sections: 2, density = 3/2 = 1.5
    expect(metrics.instructionDensity).toBe(1.5);
  });

  it('detects hasConventions when "Convention" section exists', async () => {
    const content = [
      '## Conventions',
      '',
      '- camelCase for variables',
      '- PascalCase for types',
    ].join('\n');
    const filePath = join(tempDir, 'CLAUDE.md');
    await writeFile(filePath, content);

    const metrics = await analyzeAgentDoc(filePath);

    expect(metrics.hasConventions).toBe(true);
  });

  it('detects contradictions (e.g., "always use X" + "never use X")', async () => {
    const content = [
      '## Rules',
      '',
      '- Always use semicolons',
      '- Format code with prettier',
      '',
      '## Exceptions',
      '',
      '- Never use semicolons',
      '- Avoid prettier in tests',
    ].join('\n');
    const filePath = join(tempDir, 'CLAUDE.md');
    await writeFile(filePath, content);

    const metrics = await analyzeAgentDoc(filePath);

    expect(metrics.contradictions.length).toBeGreaterThanOrEqual(1);
    const semiContradiction = metrics.contradictions.find(
      (c) => c.textA.includes('semicolons') && c.textB.includes('semicolons'),
    );
    expect(semiContradiction).toBeDefined();
    expect(semiContradiction!.lineA).toBe(3);
    expect(semiContradiction!.lineB).toBe(8);
  });

  it('flags totalLines > 60 as lineCountWarning', async () => {
    const lines = Array.from({ length: 65 }, (_, i) => `Line ${i + 1}: instruction content`);
    lines.unshift('## Long Document');
    const filePath = join(tempDir, 'CLAUDE.md');
    await writeFile(filePath, lines.join('\n'));

    const metrics = await analyzeAgentDoc(filePath);

    expect(metrics.totalLines).toBe(66);
    expect(metrics.lineCountWarning).toBe(true);
  });

  it('does NOT flag lineCountWarning for short docs', async () => {
    const content = [
      '## Short Doc',
      '',
      '- Use TypeScript',
      '- Use Vitest',
    ].join('\n');
    const filePath = join(tempDir, 'CLAUDE.md');
    await writeFile(filePath, content);

    const metrics = await analyzeAgentDoc(filePath);

    expect(metrics.lineCountWarning).toBe(false);
  });

  it('detects hasConstraints when constraints section exists', async () => {
    const content = [
      '## Constraints',
      '',
      '- No external HTTP calls',
      '- Must support Node 24',
    ].join('\n');
    const filePath = join(tempDir, 'CLAUDE.md');
    await writeFile(filePath, content);

    const metrics = await analyzeAgentDoc(filePath);

    expect(metrics.hasConstraints).toBe(true);
  });

  it('detects hasArchitecture when architecture section exists', async () => {
    const content = [
      '## Architecture',
      '',
      '- Three-layer design: domain, service, infra',
      '- Use dependency injection',
    ].join('\n');
    const filePath = join(tempDir, 'CLAUDE.md');
    await writeFile(filePath, content);

    const metrics = await analyzeAgentDoc(filePath);

    expect(metrics.hasArchitecture).toBe(true);
  });
});

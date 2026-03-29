/**
 * Tests for debug.skill.ts parseDebugOutput helper.
 *
 * Verifies JSON extraction from agent output:
 * - JSON code block extraction
 * - Raw JSON parsing fallback
 * - Graceful degradation on invalid output
 */

import { describe, it, expect } from 'vitest';
import { parseDebugOutput } from '../debug.skill.js';

describe('parseDebugOutput', () => {
  it('extracts DebugAnalysis from a JSON code block', () => {
    const agentOutput = `Here is my analysis:

\`\`\`json
{
  "failure_type": "direction_error",
  "root_cause": "Wrong import path used for utility module",
  "affected_files": [
    { "file": "src/index.ts", "line": 12, "reason": "Import references old path" }
  ],
  "fix_suggestions": [
    { "action": "Update import to new path", "file": "src/index.ts", "priority": "high" }
  ],
  "confidence": 90
}
\`\`\`

That should fix the issue.`;

    const result = parseDebugOutput(agentOutput);

    expect(result).not.toBeNull();
    expect(result!.failure_type).toBe('direction_error');
    expect(result!.root_cause).toBe('Wrong import path used for utility module');
    expect(result!.affected_files).toHaveLength(1);
    expect(result!.affected_files[0]!.file).toBe('src/index.ts');
    expect(result!.affected_files[0]!.line).toBe(12);
    expect(result!.fix_suggestions).toHaveLength(1);
    expect(result!.fix_suggestions[0]!.priority).toBe('high');
    expect(result!.confidence).toBe(90);
  });

  it('extracts from the last JSON code block when multiple exist', () => {
    const agentOutput = `First attempt:

\`\`\`json
{ "failure_type": "context_shortage", "root_cause": "wrong", "affected_files": [], "fix_suggestions": [], "confidence": 10 }
\`\`\`

Wait, let me reconsider:

\`\`\`json
{
  "failure_type": "structural_conflict",
  "root_cause": "Circular dependency between modules",
  "affected_files": [],
  "fix_suggestions": [
    { "action": "Break circular dep via interface", "priority": "high" }
  ],
  "confidence": 75
}
\`\`\``;

    const result = parseDebugOutput(agentOutput);

    expect(result).not.toBeNull();
    expect(result!.failure_type).toBe('structural_conflict');
    expect(result!.root_cause).toBe('Circular dependency between modules');
    expect(result!.confidence).toBe(75);
  });

  it('parses raw JSON without code block', () => {
    const rawJson = JSON.stringify({
      failure_type: 'context_shortage',
      root_cause: 'Agent ran out of context window',
      affected_files: [],
      fix_suggestions: [
        { action: 'Reduce context size', priority: 'medium' },
      ],
      confidence: 60,
    });

    const result = parseDebugOutput(rawJson);

    expect(result).not.toBeNull();
    expect(result!.failure_type).toBe('context_shortage');
    expect(result!.root_cause).toBe('Agent ran out of context window');
    expect(result!.fix_suggestions).toHaveLength(1);
    expect(result!.confidence).toBe(60);
  });

  it('returns null for non-JSON output', () => {
    const result = parseDebugOutput('This is just plain text analysis without any JSON.');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseDebugOutput('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseDebugOutput('   \n  \t  ')).toBeNull();
  });

  it('returns null for malformed JSON in code block', () => {
    const agentOutput = `\`\`\`json
{ "failure_type": "direction_error", "root_cause": broken json here
\`\`\``;

    const result = parseDebugOutput(agentOutput);
    expect(result).toBeNull();
  });
});

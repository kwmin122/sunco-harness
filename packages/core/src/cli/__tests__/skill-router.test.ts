/**
 * @sunco/core - Skill Router Tests
 *
 * Tests for:
 * - Commander.js program creation and configuration
 * - Skill-to-subcommand registration
 * - Unknown command suggestion via Levenshtein distance
 * - Levenshtein distance calculation
 */

import { describe, it, expect, vi } from 'vitest';
import { createProgram, levenshtein, findClosestCommand, isRootHelpRequest } from '../program.js';
import { registerSkills } from '../skill-router.js';
import { SkillRegistry } from '../../skill/registry.js';
import { defineSkill } from '../../skill/define.js';
import type { SkillContext, SkillResult } from '../../skill/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockSkill(id: string, command: string, description: string) {
  return defineSkill({
    id,
    command,
    description,
    kind: 'deterministic',
    stage: 'stable',
    category: 'core',
    routing: 'directExec',
    execute: async (_ctx: SkillContext): Promise<SkillResult> => ({
      success: true,
      summary: `${command} executed`,
    }),
  });
}

// ---------------------------------------------------------------------------
// Levenshtein Distance
// ---------------------------------------------------------------------------

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('init', 'init')).toBe(0);
  });

  it('returns string length for empty comparison', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('returns 0 for both empty', () => {
    expect(levenshtein('', '')).toBe(0);
  });

  it('calculates single-character difference', () => {
    expect(levenshtein('lint', 'lnt')).toBe(1);
    expect(levenshtein('lint', 'list')).toBe(1);
  });

  it('calculates multi-character difference', () => {
    expect(levenshtein('init', 'health')).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// findClosestCommand
// ---------------------------------------------------------------------------

describe('findClosestCommand', () => {
  const commands = ['init', 'lint', 'health', 'guard', 'plan'];

  it('returns exact match with distance 0', () => {
    expect(findClosestCommand('init', commands)).toBe('init');
  });

  it('suggests closest command for typo', () => {
    expect(findClosestCommand('intt', commands)).toBe('init');
    expect(findClosestCommand('lnt', commands)).toBe('lint');
  });

  it('returns undefined for no commands', () => {
    expect(findClosestCommand('init', [])).toBeUndefined();
  });

  it('returns undefined when no reasonable match', () => {
    expect(findClosestCommand('zzzzzzzzzzz', commands)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// createProgram
// ---------------------------------------------------------------------------

describe('createProgram', () => {
  it('creates a program named sunco', () => {
    const program = createProgram();
    expect(program.name()).toBe('sunco');
  });

  it('has version set', () => {
    const program = createProgram();
    expect(program.version()).toBe('0.0.1');
  });

  it('has description set', () => {
    const program = createProgram();
    expect(program.description()).toContain('Agent Workspace OS');
  });
});

// ---------------------------------------------------------------------------
// registerSkills
// ---------------------------------------------------------------------------

describe('registerSkills', () => {
  it('registers skills as subcommands', () => {
    const program = createProgram();
    const registry = new SkillRegistry();

    registry.register(mockSkill('core.init', 'init', 'Initialize project'));
    registry.register(mockSkill('harness.lint', 'lint', 'Run architecture linter'));
    registry.register(mockSkill('harness.health', 'health', 'Check project health'));

    const executeHook = vi.fn();
    registerSkills(program, registry, executeHook);

    // Verify subcommands were created
    const commandNames = program.commands.map((cmd) => cmd.name());
    expect(commandNames).toContain('init');
    expect(commandNames).toContain('lint');
    expect(commandNames).toContain('health');
    expect(commandNames).toHaveLength(3);
  });

  it('sets descriptions on subcommands', () => {
    const program = createProgram();
    const registry = new SkillRegistry();

    registry.register(mockSkill('core.init', 'init', 'Initialize project'));

    const executeHook = vi.fn();
    registerSkills(program, registry, executeHook);

    const initCmd = program.commands.find((c) => c.name() === 'init');
    expect(initCmd?.description()).toBe('Initialize project');
  });

  it('registers skill options as subcommand options', () => {
    const program = createProgram();
    const registry = new SkillRegistry();

    const skill = defineSkill({
      id: 'harness.lint',
      command: 'lint',
      description: 'Lint project',
      kind: 'deterministic',
      stage: 'stable',
      category: 'harness',
      routing: 'directExec',
      options: [
        { flags: '-f, --fix', description: 'Auto-fix violations' },
        { flags: '--verbose', description: 'Verbose output', defaultValue: false },
      ],
      execute: async () => ({ success: true }),
    });
    registry.register(skill);

    const executeHook = vi.fn();
    registerSkills(program, registry, executeHook);

    const lintCmd = program.commands.find((c) => c.name() === 'lint');
    const optionNames = lintCmd?.options.map((o) => o.long);
    expect(optionNames).toContain('--fix');
    expect(optionNames).toContain('--verbose');
  });

  it('calls execute hook with skill ID and options when command is invoked', async () => {
    const program = createProgram();
    const registry = new SkillRegistry();

    registry.register(mockSkill('core.init', 'init', 'Initialize project'));

    const executeHook = vi.fn().mockResolvedValue(undefined);
    registerSkills(program, registry, executeHook);

    // Suppress output and exit
    program.exitOverride();
    program.configureOutput({
      writeOut: () => {},
      writeErr: () => {},
    });

    await program.parseAsync(['node', 'sunco', 'init']);

    expect(executeHook).toHaveBeenCalledWith('core.init', expect.any(Object));
  });

  it('subcommand --help renders normal Commander help (not root redirect)', () => {
    const program = createProgram();
    const registry = new SkillRegistry();

    registry.register(mockSkill('core.init', 'init', 'Initialize project'));

    const executeHook = vi.fn();
    registerSkills(program, registry, executeHook);

    // Capture help output for subcommand
    program.exitOverride();
    let helpOutput = '';
    program.configureOutput({
      writeOut: (str: string) => { helpOutput += str; },
      writeErr: () => {},
    });

    // Invoke subcommand --help — should show init-specific help
    try {
      program.parse(['node', 'sunco', 'init', '--help'], { from: 'user' });
    } catch {
      // Commander throws on exitOverride after --help, expected
    }

    // Subcommand help should show the command description
    expect(helpOutput).toContain('Initialize project');
  });

  it('triggers unknown command handler for non-existent commands', () => {
    const program = createProgram();
    const registry = new SkillRegistry();

    registry.register(mockSkill('core.init', 'init', 'Initialize project'));
    registry.register(mockSkill('harness.lint', 'lint', 'Lint project'));

    const executeHook = vi.fn();
    registerSkills(program, registry, executeHook);

    // Override exit to capture errors
    program.exitOverride();
    let errorMessage = '';
    program.configureOutput({
      writeOut: () => {},
      writeErr: (str: string) => {
        errorMessage += str;
      },
    });

    // Parse with unknown command
    expect(() => {
      program.parse(['node', 'sunco', 'intt'], { from: 'user' });
    }).toThrow();

    expect(errorMessage).toContain('Unknown command');
    expect(errorMessage).toContain('sunco help'); // redirect to help
  });
});

// ---------------------------------------------------------------------------
// isRootHelpRequest (D-06)
// ---------------------------------------------------------------------------

describe('isRootHelpRequest', () => {
  it('returns true for bare --help', () => {
    expect(isRootHelpRequest(['node', 'sunco', '--help'])).toBe(true);
  });

  it('returns true for bare -h', () => {
    expect(isRootHelpRequest(['node', 'sunco', '-h'])).toBe(true);
  });

  it('returns false for subcommand --help', () => {
    expect(isRootHelpRequest(['node', 'sunco', 'init', '--help'])).toBe(false);
  });

  it('returns false for subcommand -h', () => {
    expect(isRootHelpRequest(['node', 'sunco', 'status', '-h'])).toBe(false);
  });

  it('returns false for no args', () => {
    expect(isRootHelpRequest(['node', 'sunco'])).toBe(false);
  });

  it('returns false when no --help flag present', () => {
    expect(isRootHelpRequest(['node', 'sunco', 'init'])).toBe(false);
  });

  it('returns true for npx argv with --help', () => {
    // npx adds extra entries but the pattern is the same after slice(2)
    expect(isRootHelpRequest(['node', '/path/to/npx', '--help'])).toBe(true);
  });
});

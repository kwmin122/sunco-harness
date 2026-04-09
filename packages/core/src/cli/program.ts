/**
 * @sunco/core - Commander.js Program Setup
 *
 * Creates the root Commander.js program for the `sunco` CLI.
 * Configures version, description, sorted help, and unknown-command
 * suggestions using Levenshtein distance.
 *
 * Requirements: CLI-01 (sunco binary), CLI-03 (--help), CLI-04 (error messages)
 */

import { Command } from 'commander';
import { VERSION } from '../index.js';

// ---------------------------------------------------------------------------
// Levenshtein Distance
// ---------------------------------------------------------------------------

/**
 * Compute the Levenshtein edit distance between two strings.
 * Used to suggest closest matching command on typos.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Fast paths
  if (m === 0) return n;
  if (n === 0) return m;

  // Single-row DP
  const row = Array.from({ length: n + 1 }, (_, i) => i);

  for (let i = 1; i <= m; i++) {
    let prev = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const val = Math.min(
        row[j] + 1,       // deletion
        prev + 1,          // insertion
        row[j - 1] + cost, // substitution
      );
      row[j - 1] = prev;
      prev = val;
    }
    row[n] = prev;
  }

  return row[n];
}

/**
 * Find the closest matching command name from a list.
 * Returns undefined if no match is within a reasonable threshold.
 */
export function findClosestCommand(
  input: string,
  commands: string[],
): string | undefined {
  if (commands.length === 0) return undefined;

  let best: string | undefined;
  let bestDist = Infinity;

  for (const cmd of commands) {
    const dist = levenshtein(input, cmd);
    if (dist < bestDist) {
      bestDist = dist;
      best = cmd;
    }
  }

  // Only suggest if the edit distance is reasonable (at most half the length + 2)
  const threshold = Math.max(Math.floor(input.length / 2) + 1, 3);
  return bestDist <= threshold ? best : undefined;
}

// ---------------------------------------------------------------------------
// Program Factory
// ---------------------------------------------------------------------------

/**
 * Create the root Commander.js program for sunco.
 *
 * @returns Configured Command instance
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('sunco')
    .version(VERSION)
    .description('Agent Workspace OS -- \uC5D0\uC774\uC804\uD2B8\uAC00 \uC2E4\uC218\uB97C \uB35C \uD558\uAC8C \uD310\uC744 \uAE54\uC544\uC8FC\uB294 OS')
    .configureHelp({ sortSubcommands: true })
    .showHelpAfterError(true);

  // Unknown command handler (CLI-04)
  program.on('command:*', (operands: string[]) => {
    const unknown = operands[0];
    const registered = program.commands.map((cmd) => cmd.name());
    const suggestion = findClosestCommand(unknown, registered);

    let message = `Unknown command: '${unknown}'.`;
    if (suggestion) {
      message += ` Did you mean 'sunco ${suggestion}'?`;
    }
    message += `\n\nRun 'sunco help' for available commands and tasks.\nRun 'sunco help --all' for the full command list.`;

    // Use Commander's error output
    program.error(message);
  });

  return program;
}

/**
 * Check if argv represents a root-level --help request (D-06).
 * Returns true for `sunco --help` / `sunco -h`, false for `sunco init --help`.
 *
 * Commander 14.x configureHelp cannot distinguish root vs subcommand help
 * (formatHelp always receives the root program as cmd). So we intercept
 * root-only --help BEFORE parseAsync, outputting a minimal redirect.
 */
export function isRootHelpRequest(argv: string[]): boolean {
  // argv: ['node', 'sunco', ...args]
  const args = argv.slice(2);
  if (args.length === 0) return false;

  // Check if --help or -h is present
  const hasHelp = args.includes('--help') || args.includes('-h');
  if (!hasHelp) return false;

  // Check if there's a non-flag argument before --help (= subcommand)
  const helpIdx = Math.min(
    args.includes('--help') ? args.indexOf('--help') : Infinity,
    args.includes('-h') ? args.indexOf('-h') : Infinity,
  );
  const hasSubcommandBefore = args.slice(0, helpIdx).some((a) => !a.startsWith('-'));
  return !hasSubcommandBefore;
}

/** The minimal redirect message for root --help (D-06). */
export const ROOT_HELP_MESSAGE = `
  Run 'sunco help' for available commands and tasks.
  Run 'sunco help --all' for the full command list.
`;

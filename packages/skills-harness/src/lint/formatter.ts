/**
 * @sunco/skills-harness - Lint Formatter
 *
 * Transforms ESLint messages into agent-readable SunLintViolation objects
 * with actionable fix_instruction fields. This is the core of SUN's
 * "linter teaches while blocking" philosophy (D-08, D-19).
 *
 * Three output formats:
 * - formatViolations: ESLint messages -> SunLintViolation[]
 * - formatForTerminal: colored human-readable output with file:line:col
 * - formatForJson: JSON array for agent consumption (--json flag)
 *
 * Decisions: D-08 (structured errors), D-19 (specific, actionable suggestions)
 */

import chalk from 'chalk';
import type { SunLintViolation } from './types.js';
import type { DetectedLayer } from '../init/types.js';

// ---------------------------------------------------------------------------
// ESLint Message Type (matches ESLint's Linter.LintMessage)
// ---------------------------------------------------------------------------

/** ESLint message structure (subset of fields we use) */
export interface ESLintMessage {
  /** ESLint rule ID or null for parse errors */
  readonly ruleId: string | null;
  /** Line number (1-based) */
  readonly line: number;
  /** Column number (1-based) */
  readonly column: number;
  /** Human-readable error message */
  readonly message: string;
  /** 1 = warning, 2 = error */
  readonly severity: 1 | 2;
  /** Auto-fix information (present if fixable) */
  readonly fix?: { range: [number, number]; text: string };
}

// ---------------------------------------------------------------------------
// fix_instruction generators
// ---------------------------------------------------------------------------

/**
 * Generate a layer-aware fix instruction for boundaries/dependencies violations.
 *
 * Parses the ESLint message to extract source/target layer types, then
 * provides actionable guidance about which layers the source layer can import from.
 *
 * @param filePath - Absolute file path where the violation occurred
 * @param message - ESLint error message
 * @param layers - Detected project layers (for allowed-import lookup)
 * @returns Actionable fix instruction with layer names and allowed imports
 */
function generateBoundariesFixInstruction(
  filePath: string,
  message: string,
  layers: DetectedLayer[],
): string {
  // Parse ESLint boundaries message format:
  // "Importing files of type "X" is not allowed from files of type "Y". Disallowed in rule N"
  const importMatch = message.match(
    /Importing files of type "(\w+)" is not allowed from files of type "(\w+)"/,
  );

  if (!importMatch) {
    // Fallback for unexpected message format
    return `Boundary violation: ${message}. Check your import paths and ensure they follow the dependency direction rules.`;
  }

  const targetLayer = importMatch[1]!;
  const fromLayer = importMatch[2]!;

  // Find what the source layer is allowed to import from
  const sourceLayerDef = layers.find((l) => l.name === fromLayer);
  const allowedImports = sourceLayerDef?.canImportFrom ?? [];

  const allowedList =
    allowedImports.length > 0 ? allowedImports.join(', ') : 'nothing (leaf layer)';

  return (
    `File '${filePath}' is in layer '${fromLayer}'. ` +
    `It imports from layer '${targetLayer}', which violates the dependency direction rule. ` +
    `'${fromLayer}' can only import from: [${allowedList}]. ` +
    `Move this import to a layer that is allowed to depend on '${targetLayer}', ` +
    `or restructure to remove this dependency.`
  );
}

/**
 * Generate a generic fix instruction for non-boundaries rules.
 *
 * Provides the ESLint message as context with guidance to fix the issue.
 *
 * @param ruleId - ESLint rule identifier
 * @param message - ESLint error message
 * @returns Generic but helpful fix instruction
 */
function generateGenericFixInstruction(ruleId: string, message: string): string {
  return `Rule '${ruleId}': ${message}. Review and fix this violation to comply with the project's lint rules.`;
}

/**
 * Generate a fix instruction for parse errors (null ruleId).
 *
 * @param line - Line number
 * @param column - Column number
 * @param message - Error message
 * @returns Fix instruction for syntax errors
 */
function generateParseErrorFixInstruction(line: number, column: number, message: string): string {
  return `Syntax error at line ${line}, column ${column}: ${message}. Fix the syntax error to allow linting to proceed.`;
}

// ---------------------------------------------------------------------------
// formatViolations
// ---------------------------------------------------------------------------

/**
 * Transform ESLint messages to SunLintViolation[] with fix_instruction.
 *
 * This is the core transformation function that makes SUN's linting unique:
 * every violation includes an actionable fix_instruction that explains WHY
 * the violation is wrong and HOW to fix it, in a format both humans and
 * agents can parse.
 *
 * @param filePath - Absolute file path the messages belong to
 * @param messages - ESLint messages for this file
 * @param layers - Optional detected layers for boundary-aware fix instructions
 * @returns Array of SunLintViolation with fix_instruction for every violation
 */
export function formatViolations(
  filePath: string,
  messages: ESLintMessage[],
  layers?: DetectedLayer[],
): SunLintViolation[] {
  if (messages.length === 0) {
    return [];
  }

  return messages.map((msg) => {
    const severity: 'error' | 'warning' = msg.severity === 2 ? 'error' : 'warning';
    const ruleId = msg.ruleId ?? 'parse-error';

    let fixInstruction: string;

    if (msg.ruleId === null) {
      // Parse error -- no rule ID
      fixInstruction = generateParseErrorFixInstruction(msg.line, msg.column, msg.message);
    } else if (msg.ruleId === 'boundaries/dependencies' && layers) {
      // Boundaries violation -- layer-aware instruction
      fixInstruction = generateBoundariesFixInstruction(filePath, msg.message, layers);
    } else {
      // All other rules -- generic but actionable instruction
      fixInstruction = generateGenericFixInstruction(msg.ruleId, msg.message);
    }

    return {
      rule: ruleId,
      file: filePath,
      line: msg.line,
      column: msg.column,
      violation: msg.message,
      fix_instruction: fixInstruction,
      severity,
    };
  });
}

// ---------------------------------------------------------------------------
// formatForTerminal
// ---------------------------------------------------------------------------

/** Severity icons for terminal display */
const SEVERITY_ICON = {
  error: chalk.red('\u2716'), // heavy X
  warning: chalk.yellow('\u26A0'), // warning sign
} as const;

/**
 * Format violations as colored terminal output with file:line:col format.
 *
 * Each violation produces two lines:
 *   {icon} {file}:{line}:{column} {violation}
 *     Fix: {fix_instruction}
 *
 * Errors are red, warnings are yellow. Fix instructions are dimmed.
 *
 * @param violations - Violations to format
 * @returns Array of formatted lines (may contain ANSI color codes)
 */
export function formatForTerminal(violations: SunLintViolation[]): string[] {
  if (violations.length === 0) {
    return [];
  }

  const lines: string[] = [];

  for (const v of violations) {
    const icon = SEVERITY_ICON[v.severity];
    const locationColor = v.severity === 'error' ? chalk.red : chalk.yellow;
    const location = locationColor(`${v.file}:${v.line}:${v.column}`);

    lines.push(`${icon} ${location} ${v.violation}`);
    lines.push(chalk.dim(`  Fix: ${v.fix_instruction}`));
  }

  return lines;
}

// ---------------------------------------------------------------------------
// formatForJson
// ---------------------------------------------------------------------------

/**
 * Format violations as a JSON string for agent consumption.
 *
 * Returns a pretty-printed JSON array matching SunLintViolation[].
 * Per D-08: --json output for programmatic consumption.
 *
 * @param violations - Violations to serialize
 * @returns Pretty-printed JSON string
 */
export function formatForJson(violations: SunLintViolation[]): string {
  return JSON.stringify(violations, null, 2);
}

/**
 * @sunco/skills-workflow - Forensics Analyzer (shared module)
 *
 * Extracted from forensics.skill.ts (Phase 33 Wave 3 absorption).
 * Provides agent-powered post-mortem analysis: reconstructs timeline,
 * identifies divergence point, and produces ForensicsReport.
 *
 * Requirements: DBG-03
 * Decisions: D-09 (forensics scope), D-10 (ForensicsReport structure),
 *   D-11 (kind: prompt), D-12 (session selection)
 */

import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { buildForensicsPostmortemPrompt } from '../prompts/forensics-postmortem.js';
import { resolvePhaseDir } from './phase-reader.js';
import type { ForensicsReport } from './debug-types.js';
import type { AgentRequest, AgentResult, PermissionSet } from '@sunco/core';

// ---------------------------------------------------------------------------
// Permissions (purely read-only)
// ---------------------------------------------------------------------------

const FORENSICS_PERMISSIONS: PermissionSet = {
  role: 'verification',
  readPaths: ['**'],
  writePaths: [],
  allowTests: false,
  allowNetwork: false,
  allowGitWrite: false,
  allowCommands: [],
};

// ---------------------------------------------------------------------------
// Options / Result interfaces
// ---------------------------------------------------------------------------

export interface ForensicsOptions {
  cwd: string;
  phaseNumber: number;
  sessionId?: string;
  agentRun: (request: AgentRequest) => Promise<AgentResult>;
  log: { info: (message: string, data?: Record<string, unknown>) => void; warn: (message: string, data?: Record<string, unknown>) => void };
}

export interface ForensicsResult {
  success: boolean;
  summary: string;
  report: ForensicsReport | null;
  reportPath?: string;
  raw?: string;
}

// ---------------------------------------------------------------------------
// JSON parser helper
// ---------------------------------------------------------------------------

/**
 * Parse agent output into ForensicsReport.
 *
 * Tries extracting from the last JSON code block first.
 * Falls back to parsing the entire output as JSON.
 * Returns null if parsing fails.
 */
export function parseForensicsOutput(output: string): ForensicsReport | null {
  if (!output || !output.trim()) return null;

  // Try extracting JSON from the last code block
  const codeBlockMatches = [...output.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/g)];
  if (codeBlockMatches.length > 0) {
    const lastMatch = codeBlockMatches[codeBlockMatches.length - 1]!;
    try {
      return JSON.parse(lastMatch[1]!) as ForensicsReport;
    } catch {
      // Fall through to raw parse
    }
  }

  // Try parsing the entire output as JSON
  try {
    return JSON.parse(output.trim()) as ForensicsReport;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read all files matching a suffix from a directory, concatenated with headers.
 */
export async function readFilesWithSuffix(dir: string, suffix: string): Promise<string> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return '';
  }

  const matched = entries.filter((e) => e.endsWith(suffix)).sort();
  if (matched.length === 0) return '';

  const parts: string[] = [];
  for (const filename of matched) {
    try {
      const content = await readFile(join(dir, filename), 'utf-8');
      parts.push(`--- ${filename} ---\n${content}`);
    } catch {
      parts.push(`--- ${filename} --- [read error]`);
    }
  }

  return parts.join('\n\n');
}

/**
 * Format a ForensicsReport as markdown for file output.
 */
export function formatForensicsReport(report: ForensicsReport, phase: number): string {
  const lines: string[] = [];

  lines.push(`# Forensics Report: Phase ${phase}`);
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push('');

  // Timeline
  lines.push('## Timeline');
  lines.push('');
  if (report.timeline.length > 0) {
    lines.push('| Timestamp | Event | Source |');
    lines.push('|-----------|-------|--------|');
    for (const entry of report.timeline) {
      lines.push(`| ${entry.timestamp} | ${entry.event} | ${entry.source} |`);
    }
  } else {
    lines.push('No timeline events reconstructed.');
  }
  lines.push('');

  // Divergence
  lines.push('## Divergence Point');
  lines.push('');
  lines.push(report.divergence_point);
  lines.push('');

  // Root Cause
  lines.push('## Root Cause Hypothesis');
  lines.push('');
  lines.push(report.root_cause_hypothesis);
  lines.push('');

  // Affected Plans
  lines.push('## Affected Plans');
  lines.push('');
  if (report.affected_plans.length > 0) {
    for (const plan of report.affected_plans) {
      lines.push(`- ${plan}`);
    }
  } else {
    lines.push('No specific plans identified.');
  }
  lines.push('');

  // Prevention
  lines.push('## Prevention Recommendations');
  lines.push('');
  if (report.prevention_recommendations.length > 0) {
    for (const rec of report.prevention_recommendations) {
      lines.push(`- ${rec}`);
    }
  } else {
    lines.push('No recommendations generated.');
  }
  lines.push('');

  lines.push('---');
  lines.push(`*Generated by sunco forensics at ${new Date().toISOString()}*`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Run forensics post-mortem analysis for a given phase.
 *
 * Gathers git history, plan files, summary files, verification reports,
 * and state history, then dispatches to an agent for analysis.
 * Does not depend on SkillContext.
 */
export async function runForensicsAnalysis(opts: ForensicsOptions): Promise<ForensicsResult> {
  const { cwd, phaseNumber, sessionId, agentRun, log } = opts;

  const phaseDir = await resolvePhaseDir(cwd, phaseNumber);
  if (!phaseDir) {
    return {
      success: false,
      summary: `Phase ${phaseNumber} directory not found`,
      report: null,
    };
  }

  // --- Step 1: Gather git history ---
  let gitHistory = '';
  try {
    const git = simpleGit(cwd);
    const gitLog = await git.log({ maxCount: 100 });
    gitHistory = [...gitLog.all]
      .reverse()
      .map((c: { hash: string; date: string; message: string }) => `${c.hash.slice(0, 7)} ${c.date} ${c.message}`)
      .join('\n');
  } catch {
    gitHistory = '[git history unavailable]';
  }

  // --- Step 2: Gather plan files ---
  const planFiles = await readFilesWithSuffix(phaseDir, '-PLAN.md');

  // --- Step 3: Gather summary files ---
  const summaryFiles = await readFilesWithSuffix(phaseDir, '-SUMMARY.md');

  // --- Step 4: Gather verification reports ---
  const verificationReports = await readFilesWithSuffix(phaseDir, '-VERIFICATION.md');
  let singleVerification = '';
  try {
    singleVerification = await readFile(join(phaseDir, 'VERIFICATION.md'), 'utf-8');
  } catch {
    // No single verification file
  }
  const allVerificationReports = [verificationReports, singleVerification]
    .filter(Boolean)
    .join('\n\n');

  // --- Step 5: Gather state history ---
  let stateHistory = '';
  try {
    stateHistory = await readFile(join(cwd, '.planning', 'STATE.md'), 'utf-8');
  } catch {
    stateHistory = '[STATE.md not found]';
  }

  // If sessionId provided, note it in the state context
  if (sessionId) {
    stateHistory += `\n\n--- Requested session: ${sessionId} ---`;
  }

  // --- Build prompt ---
  const prompt = buildForensicsPostmortemPrompt({
    gitHistory,
    planFiles,
    summaryFiles,
    verificationReports: allVerificationReports,
    stateHistory,
  });

  // --- Dispatch agent (longer timeout for deep analysis) ---
  const result = await agentRun({
    role: 'verification',
    prompt,
    permissions: FORENSICS_PERMISSIONS,
    timeout: 180_000,
  });

  // --- Parse result ---
  const report = parseForensicsOutput(result.outputText);

  if (!report) {
    // Graceful degradation
    return {
      success: true,
      summary: `Forensics analysis completed (unstructured): ${result.outputText.slice(0, 300)}`,
      report: null,
      raw: result.outputText,
    };
  }

  // --- Write report to .sun/forensics/ ---
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const padded = String(phaseNumber).padStart(2, '0');
  const forensicsDir = join(cwd, '.sun', 'forensics');
  const reportFilename = `phase-${padded}-${timestamp}.md`;
  const reportPath = join(forensicsDir, reportFilename);

  let writtenPath: string | undefined;
  try {
    await mkdir(forensicsDir, { recursive: true });
    const reportMd = formatForensicsReport(report, phaseNumber);
    await writeFile(reportPath, reportMd, 'utf-8');
    log.info('Forensics report written', { path: reportPath });
    writtenPath = reportPath;
  } catch (err) {
    log.warn('Failed to write forensics report', { error: String(err) });
  }

  const summary = `Phase ${phaseNumber}: ${report.timeline.length} events, divergence at "${report.divergence_point.slice(0, 100)}"`;

  return {
    success: true,
    summary,
    report,
    reportPath: writtenPath,
  };
}

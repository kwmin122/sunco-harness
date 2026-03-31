#!/usr/bin/env node
'use strict';

/**
 * sunco-statusline.cjs
 * Outputs a one-line status string for Claude Code's status bar.
 * Reads .planning/STATE.md + context usage + mode state.
 *
 * Output examples:
 *   SUNCO | Phase 3: Execution | 60%
 *   ⚡ SUNCO | Phase 3: Execution | 60% | ctx 45%
 *   SUNCO | No project
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const FALLBACK = 'SUNCO | No project';

function readStateMd() {
  try {
    const statePath = path.join(process.cwd(), '.planning', 'STATE.md');
    return fs.readFileSync(statePath, 'utf8');
  } catch {
    return null;
  }
}

function parseState(content) {
  if (!content) return null;

  let phaseNum  = null;
  let phaseName = null;
  let progress  = null;

  const phaseHeading = content.match(/##\s+Phase[:\s]+(\d+)[^#\n]*?[—\-–]\s*([^\n]+)/i);
  if (phaseHeading) {
    phaseNum  = phaseHeading[1];
    phaseName = phaseHeading[2].trim();
  }

  if (!phaseNum) {
    const phaseInline = content.match(/\*?\*?[Pp]hase\*?\*?[:\s]+(\d+)/);
    if (phaseInline) phaseNum = phaseInline[1];
  }

  if (!phaseName) {
    const nameMatch = content.match(/[Cc]urrent\s+[Pp]hase[:\s]+([^\n]+)/);
    if (nameMatch) phaseName = nameMatch[1].replace(/\*\*/g, '').trim();
  }

  if (!phaseName) {
    const yamlName = content.match(/^name[:\s]+(.+)$/im);
    if (yamlName) phaseName = yamlName[1].trim();
  }

  const progMatch = content.match(/[Pp]rogress[:\s*]+(\d{1,3})\s*%/);
  if (progMatch) progress = progMatch[1];

  if (!phaseNum && !phaseName && !progress) return null;
  return { phaseNum, phaseName, progress };
}

// ---------------------------------------------------------------------------
// Mode detection
// ---------------------------------------------------------------------------
function isModeActive() {
  try {
    return fs.existsSync(path.join(os.homedir(), '.sunco', 'mode-active'));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Context usage from env (PostToolUse hook provides these)
// ---------------------------------------------------------------------------
function getContextUsage() {
  const used  = parseInt(process.env.CLAUDE_CONTEXT_TOKENS_USED  || '', 10);
  const total = parseInt(process.env.CLAUDE_CONTEXT_WINDOW_SIZE  || '', 10);
  if (!used || !total || total === 0) return null;
  return Math.round((used / total) * 100);
}

// ---------------------------------------------------------------------------
// Build status line
// ---------------------------------------------------------------------------
function buildStatusLine(state) {
  const mode = isModeActive();
  const prefix = mode ? '\u26A1 SUNCO' : 'SUNCO';
  const parts = [prefix];

  if (state) {
    if (state.phaseNum || state.phaseName) {
      let phaseStr = 'Phase';
      if (state.phaseNum) phaseStr += ` ${state.phaseNum}`;
      if (state.phaseName) phaseStr += `: ${state.phaseName}`;
      parts.push(phaseStr);
    }
    if (state.progress !== null && state.progress !== undefined) {
      parts.push(`${state.progress}%`);
    }
  } else {
    parts.push('No project');
  }

  // Context usage
  const ctxPct = getContextUsage();
  if (ctxPct !== null) {
    // Build mini bar: ████░░░░ 45%
    const filled = Math.round(ctxPct / 10);
    const empty  = 10 - filled;
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
    parts.push(`ctx ${bar} ${ctxPct}%`);
  }

  return parts.join(' | ');
}

function main() {
  try {
    const content = readStateMd();
    const state   = parseState(content);
    console.log(buildStatusLine(state));
  } catch {
    console.log(FALLBACK);
  }
}

main();

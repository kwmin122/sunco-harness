#!/usr/bin/env node
'use strict';

/**
 * sunco-statusline.js
 * Outputs a one-line status string for Claude Code's status bar.
 * Reads .planning/STATE.md from the current working directory.
 */

const fs   = require('fs');
const path = require('path');

const FALLBACK = 'SUNCO | No project';

function readStateMd() {
  try {
    const statePath = path.join(process.cwd(), '.planning', 'STATE.md');
    return fs.readFileSync(statePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Extracts phase number, phase name, and progress percentage from STATE.md.
 *
 * Expected STATE.md format (GSD-style):
 *   ## Phase: 3 — Execution
 *   **Progress:** 60%
 *
 * Also handles:
 *   phase: 3
 *   name: Execution
 *   progress: 60
 */
function parseState(content) {
  if (!content) return null;

  let phaseNum  = null;
  let phaseName = null;
  let progress  = null;

  // Try "## Phase: N — Name" or "## Phase N: Name"
  const phaseHeading = content.match(/##\s+Phase[:\s]+(\d+)[^#\n]*?[—\-–]\s*([^\n]+)/i);
  if (phaseHeading) {
    phaseNum  = phaseHeading[1];
    phaseName = phaseHeading[2].trim();
  }

  // Try "**Phase:** N — Name" or "Phase: N"
  if (!phaseNum) {
    const phaseInline = content.match(/\*?\*?[Pp]hase\*?\*?[:\s]+(\d+)/);
    if (phaseInline) phaseNum = phaseInline[1];
  }

  // Try "**Current Phase:** Name"
  if (!phaseName) {
    const nameMatch = content.match(/[Cc]urrent\s+[Pp]hase[:\s]+([^\n]+)/);
    if (nameMatch) phaseName = nameMatch[1].replace(/\*\*/g, '').trim();
  }

  // Try "name: ..." YAML-style
  if (!phaseName) {
    const yamlName = content.match(/^name[:\s]+(.+)$/im);
    if (yamlName) phaseName = yamlName[1].trim();
  }

  // Try progress percentage
  const progMatch = content.match(/[Pp]rogress[:\s*]+(\d{1,3})\s*%/);
  if (progMatch) progress = progMatch[1];

  if (!phaseNum && !phaseName && !progress) return null;

  return { phaseNum, phaseName, progress };
}

function buildStatusLine(state) {
  if (!state) return FALLBACK;

  const parts = ['SUNCO'];

  if (state.phaseNum || state.phaseName) {
    let phaseStr = 'Phase';
    if (state.phaseNum) phaseStr += ` ${state.phaseNum}`;
    if (state.phaseName) phaseStr += `: ${state.phaseName}`;
    parts.push(phaseStr);
  }

  if (state.progress !== null && state.progress !== undefined) {
    parts.push(`${state.progress}%`);
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

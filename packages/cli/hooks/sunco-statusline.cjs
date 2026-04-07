#!/usr/bin/env node
'use strict';

/**
 * sunco-statusline.cjs
 * Claude Code statusLine command — reads JSON from stdin, outputs ANSI-colored status.
 *
 * Output (2 lines):
 *   Line 1: SUNCO | Phase 3: Execution | 60%
 *   Line 2: [████████░░] 65% | tokens 45.2K | $0.12
 *
 * When /sunco:mode active:
 *   Line 1 prefix turns yellow: ⚡ SUNCO
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ---------------------------------------------------------------------------
// ANSI colors
// ---------------------------------------------------------------------------
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const GOLD   = '\x1b[38;5;220m';  // Bright gold (Super Saiyan)
const GOLD_BG = '\x1b[48;5;220m\x1b[30m'; // Gold background with black text
const RED    = '\x1b[31m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';
const RESET  = '\x1b[0m';

// ---------------------------------------------------------------------------
// Read stdin (Claude Code pipes JSON here)
// ---------------------------------------------------------------------------
function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function parseStdinJson(raw) {
  if (!raw || !raw.trim()) return null;
  try {
    return JSON.parse(raw.trim());
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// STATE.md parsing (project phase info)
// ---------------------------------------------------------------------------
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
    return fs.existsSync(path.join(os.homedir(), '.sun', 'mode-active'));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------
function formatTokens(n) {
  if (n == null || isNaN(n)) return null;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function formatCost(usd) {
  if (usd == null || isNaN(usd)) return null;
  if (usd < 0.01) return '$' + usd.toFixed(3);
  return '$' + usd.toFixed(2);
}

function barColor(pct) {
  if (pct >= 85) return RED;
  if (pct >= 70) return YELLOW;
  return GREEN;
}

/**
 * Read context zone from .sun/context-zone.json (written by context-monitor hook).
 */
function readContextZone() {
  try {
    const zonePath = path.join(process.cwd(), '.sun', 'context-zone.json');
    const raw = fs.readFileSync(zonePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Get zone emoji indicator.
 */
function zoneEmoji(zone) {
  switch (zone) {
    case 'red':    return '\uD83D\uDD34'; // 🔴
    case 'orange': return '\uD83D\uDFE0'; // 🟠
    case 'yellow': return '\uD83D\uDFE1'; // 🟡
    case 'green':  return '\uD83D\uDFE2'; // 🟢
    default:       return '';
  }
}

function buildBar(pct) {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round(clamped / 10);
  const empty  = 10 - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}

// ---------------------------------------------------------------------------
// Build status lines
// ---------------------------------------------------------------------------
function buildOutput(state, stdinData) {
  const mode   = isModeActive();
  const lines  = [];

  // Color scheme: Super Saiyan gold when mode active
  const mc = mode ? GOLD : '';       // mode color
  const mb = mode ? BOLD : '';       // mode bold
  const mr = mode ? RESET : '';      // mode reset
  const sep = mode ? `${GOLD}|${RESET}` : '|';

  // --- Line 1: SUNCO MODE | Phase info ---
  const prefix = mode
    ? `${GOLD}${BOLD}\u26A1 SUNCO MODE${RESET}`
    : `${BOLD}SUNCO${RESET}`;

  const line1Parts = [prefix];

  if (state) {
    if (state.phaseNum || state.phaseName) {
      let phaseStr = `${mc}${mb}Phase${mr}`;
      if (state.phaseNum) phaseStr += ` ${mc}${state.phaseNum}${mr}`;
      if (state.phaseName) phaseStr += `${mc}: ${state.phaseName}${mr}`;
      line1Parts.push(phaseStr);
    }
    if (state.progress != null) {
      line1Parts.push(`${mc}${state.progress}%${mr}`);
    }
  } else {
    line1Parts.push(`${mc}Ready${mr}`);
  }

  // Add model name if available
  if (stdinData && stdinData.model && stdinData.model.display_name) {
    const modelColor = mode ? GOLD : DIM;
    line1Parts.push(`${modelColor}${stdinData.model.display_name}${RESET}`);
  }

  lines.push(line1Parts.join(` ${sep} `));

  // --- Line 2: Context gauge + tokens + cost ---
  if (stdinData && stdinData.context_window) {
    const cw = stdinData.context_window;
    const pct = cw.used_percentage;
    const line2Parts = [];

    if (pct != null && !isNaN(pct)) {
      // In mode: gold bar. Otherwise: zone-based color
      const color = mode ? GOLD : barColor(pct);
      const bar = buildBar(pct);
      const zone = pct >= 85 ? 'red' : pct >= 70 ? 'orange' : pct >= 50 ? 'yellow' : 'green';
      const emoji = zoneEmoji(zone);
      // Show context window size + usage
      const cwSize = cw.max_tokens ? formatTokens(cw.max_tokens) : null;
      const cwUsed = cw.used_tokens ? formatTokens(cw.used_tokens) : null;
      const dimC = mode ? GOLD : DIM;
      const cwLabel = cwSize ? ` ${dimC}ctx${RESET} ${mc}${cwUsed || '?'}/${cwSize}${mr}` : '';
      line2Parts.push(`${color}${bar}${RESET} ${mc}${pct}%${mr} ${emoji}${cwLabel}`);
    }

    // Total tokens (input + output)
    const totalIn  = cw.total_input_tokens;
    const totalOut = cw.total_output_tokens;
    if (totalIn != null || totalOut != null) {
      const total = (totalIn || 0) + (totalOut || 0);
      const formatted = formatTokens(total);
      if (formatted) {
        const dimC = mode ? GOLD : DIM;
        line2Parts.push(`${dimC}tokens${RESET} ${mc}${formatted}${mr}`);
      }
    }

    // Cost
    if (stdinData.cost && stdinData.cost.total_cost_usd != null) {
      const costStr = formatCost(stdinData.cost.total_cost_usd);
      if (costStr) {
        line2Parts.push(`${mc}${costStr}${mr}`);
      }
    }

    if (line2Parts.length > 0) {
      lines.push(line2Parts.join(` ${sep} `));
    }
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  try {
    const rawStdin  = readStdin();
    const stdinData = parseStdinJson(rawStdin);
    const content   = readStateMd();
    const state     = parseState(content);

    const lines = buildOutput(state, stdinData);
    for (const line of lines) {
      console.log(line);
    }
  } catch {
    console.log('SUNCO');
  }
}

main();

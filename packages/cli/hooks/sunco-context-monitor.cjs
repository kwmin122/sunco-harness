#!/usr/bin/env node
'use strict';

/**
 * sunco-context-monitor.cjs
 * PostToolUse hook. Tracks context window usage and warns at thresholds.
 * Exits silently on any error — must never block the agent.
 */

const YELLOW  = '\x1b[33m';
const RED     = '\x1b[31m';
const EMERALD = '\x1b[38;2;0;128;70m';
const BOLD    = '\x1b[1m';
const RESET   = '\x1b[0m';

// Warning thresholds (inclusive lower bound)
const THRESHOLDS = [
  { pct: 95, label: 'CRITICAL', color: RED,    suggest: true  },
  { pct: 85, label: 'HIGH',     color: RED,    suggest: false },
  { pct: 70, label: 'MODERATE', color: YELLOW, suggest: false },
];

/**
 * Parse context usage from the environment variables Claude Code exposes
 * to PostToolUse hooks.
 *
 * Claude Code sets:
 *   CLAUDE_CONTEXT_TOKENS_USED   — tokens consumed so far
 *   CLAUDE_CONTEXT_WINDOW_SIZE   — total context window capacity
 *
 * Falls back to reading stdin if the hook receives a JSON payload.
 */
function readUsage() {
  // Try environment variables first (primary path)
  const used  = parseInt(process.env.CLAUDE_CONTEXT_TOKENS_USED  || '', 10);
  const total = parseInt(process.env.CLAUDE_CONTEXT_WINDOW_SIZE  || '', 10);

  if (!isNaN(used) && !isNaN(total) && total > 0) {
    return { used, total };
  }

  // Try stdin JSON payload (Claude Code may pass tool result as JSON)
  try {
    const stdinPath = '/dev/stdin';
    const { execSync } = require('child_process');
    // Read stdin non-blocking — timeout 200ms
    const raw = execSync('cat /dev/stdin', { timeout: 200, encoding: 'utf8', stdio: ['inherit', 'pipe', 'ignore'] });
    if (raw && raw.trim()) {
      const payload = JSON.parse(raw.trim());
      // Look for usage in various known payload shapes
      const u = payload.usage || payload.context_usage || payload.token_usage || {};
      const payloadUsed  = u.input_tokens  || u.tokens_used   || u.used  || payload.tokens_used;
      const payloadTotal = u.context_limit || u.window_size   || u.total || payload.context_limit;
      if (payloadUsed && payloadTotal && payloadTotal > 0) {
        return { used: Number(payloadUsed), total: Number(payloadTotal) };
      }
    }
  } catch {
    // Stdin not available or not JSON — ignore
  }

  return null;
}

function getThreshold(pct) {
  for (const t of THRESHOLDS) {
    if (pct >= t.pct) return t;
  }
  return null;
}

function formatNumber(n) {
  return n.toLocaleString('en-US');
}

function main() {
  try {
    const usage = readUsage();
    if (!usage) return; // No data available — exit silently

    const { used, total } = usage;
    const pct = Math.round((used / total) * 100);
    const threshold = getThreshold(pct);

    if (!threshold) return; // Below 70% — no warning needed

    const bar = buildBar(pct);

    process.stderr.write(
      `\n${EMERALD}[SUNCO]${RESET} ${threshold.color}${BOLD}Context ${threshold.label}${RESET} ` +
      `${bar} ${threshold.color}${pct}%${RESET} ` +
      `${formatNumber(used)}/${formatNumber(total)} tokens\n`
    );

    if (threshold.suggest) {
      process.stderr.write(
        `${EMERALD}[SUNCO]${RESET} ${YELLOW}Run ${BOLD}/sunco:pause${RESET}${YELLOW} to save state before context limit.${RESET}\n\n`
      );
    } else {
      process.stderr.write('\n');
    }
  } catch {
    // Never throw — PostToolUse hook must exit cleanly
  }
}

function buildBar(pct) {
  const width = 20;
  const filled = Math.round((pct / 100) * width);
  const empty  = width - filled;
  const color  = pct >= 95 ? RED : pct >= 85 ? RED : YELLOW;
  return `${color}[${'█'.repeat(filled)}${'░'.repeat(empty)}]${RESET}`;
}

main();

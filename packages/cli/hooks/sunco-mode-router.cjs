#!/usr/bin/env node
'use strict';

/**
 * sunco-mode-router.cjs
 * UserPromptSubmit hook. When SUNCO Mode is active (~/.sun/mode-active exists),
 * intercepts non-slash user input and signals direct-to-router routing via
 * /sunco:router --intent <text> (G3a direct-to-router per Phase 53 L3 / L9).
 *
 * This makes SUNCO Mode a REAL system-level auto-router, not just a prompt hint.
 *
 * How it works:
 * 1. Check if ~/.sun/mode-active exists
 * 2. If yes, read the user's prompt from stdin
 * 3. If the prompt does NOT start with "/" (i.e., it's natural language, not a command),
 *    output a message instructing the agent to route DIRECTLY to /sunco:router --intent.
 *    No /sunco:do intermediate dispatch — single routing surface invariant, no 2-level
 *    nested routing (Gate 53 L3).
 * 4. If the prompt starts with "/", let it through unchanged (user explicitly chose a command)
 *
 * Exits silently on any error — must never block user input.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const EMERALD = '\x1b[38;2;0;128;70m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function isModeActive() {
  try {
    return fs.existsSync(path.join(os.homedir(), '.sun', 'mode-active'));
  } catch {
    return false;
  }
}

function main() {
  try {
    if (!isModeActive()) return;

    // Read user prompt from environment or stdin
    const userPrompt = process.env.CLAUDE_USER_PROMPT || '';
    if (!userPrompt) return;

    // If already a slash command, don't intercept
    if (userPrompt.trim().startsWith('/')) return;

    // If it's just a short greeting or confirmation, don't intercept
    const trimmed = userPrompt.trim().toLowerCase();
    if (trimmed.length < 3) return;
    if (['yes', 'no', 'y', 'n', 'ok', 'ㅇ', 'ㄴ'].includes(trimmed)) return;

    // Output routing directive — this gets injected into the conversation.
    // Direct-to-router (G3a): /sunco:router --intent "<text>". No /sunco:do layer.
    console.log(`${EMERALD}* SUNCO Mode${RESET} ${DIM}auto-routing via /sunco:router --intent${RESET}`);

  } catch {
    // Silent exit — never block user input
  }
}

main();

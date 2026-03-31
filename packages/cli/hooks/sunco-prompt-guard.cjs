#!/usr/bin/env node
'use strict';

/**
 * sunco-prompt-guard.cjs
 * PreToolUse hook on Write/Edit tools.
 * Scans content being written to .planning/ files for prompt injection patterns.
 * Advisory only — never blocks the tool. Exits silently on any error.
 */

const YELLOW  = '\x1b[33m';
const RED     = '\x1b[31m';
const EMERALD = '\x1b[38;2;0;128;70m';
const BOLD    = '\x1b[1m';
const DIM     = '\x1b[2m';
const RESET   = '\x1b[0m';

/**
 * Prompt injection patterns to detect.
 * Each entry: { pattern: RegExp, label: string }
 */
const INJECTION_PATTERNS = [
  {
    pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+instructions?/gi,
    label: 'instruction override',
  },
  {
    pattern: /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+instructions?/gi,
    label: 'instruction override',
  },
  {
    pattern: /forget\s+(all\s+)?(previous|prior|above|earlier)\s+instructions?/gi,
    label: 'instruction override',
  },
  {
    pattern: /you\s+are\s+now\s+(?:a|an)\s+/gi,
    label: 'role reassignment',
  },
  {
    pattern: /you\s+are\s+no\s+longer\s+/gi,
    label: 'role reassignment',
  },
  {
    pattern: /act\s+as\s+(?:a|an)\s+(?!agent|assistant)\w+/gi,
    label: 'role reassignment',
  },
  {
    pattern: /pretend\s+(you\s+are|to\s+be)\s+/gi,
    label: 'role reassignment',
  },
  {
    pattern: /\bsystem\s*:/gi,
    label: 'system prompt injection',
  },
  {
    pattern: /<\s*system\s*>/gi,
    label: 'system prompt injection',
  },
  {
    pattern: /\[INST\]/gi,
    label: 'model instruction tag',
  },
  {
    pattern: /<<\s*SYS\s*>>/gi,
    label: 'llama system tag',
  },
  {
    pattern: /new\s+instruction[s]?\s*:/gi,
    label: 'instruction injection',
  },
  {
    pattern: /override\s+(?:all\s+)?(?:system|safety|previous)\s+(?:instructions?|prompt)/gi,
    label: 'safety override',
  },
  {
    pattern: /your\s+(?:true|real|actual|hidden)\s+(?:purpose|goal|mission|directive)/gi,
    label: 'hidden purpose claim',
  },
  {
    pattern: /jailbreak/gi,
    label: 'jailbreak attempt',
  },
  {
    pattern: /DAN\s+mode/gi,
    label: 'jailbreak mode',
  },
];

/**
 * Read the tool invocation payload from stdin.
 * Claude Code passes the tool call JSON to PreToolUse hooks via stdin.
 */
function readPayload() {
  try {
    // Read stdin synchronously
    const stdinFd = require('fs').openSync('/dev/stdin', 'rs');
    const chunks  = [];
    const buf     = Buffer.alloc(65536);
    let   bytesRead;
    while ((bytesRead = require('fs').readSync(stdinFd, buf, 0, buf.length)) > 0) {
      chunks.push(buf.slice(0, bytesRead));
    }
    require('fs').closeSync(stdinFd);
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Extract the file path and content string from the tool payload.
 * Claude Code tool payloads vary by tool:
 *   Write: { tool: 'Write', input: { file_path, content } }
 *   Edit:  { tool: 'Edit',  input: { file_path, new_string, old_string } }
 */
function extractTarget(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const input = payload.input || payload.parameters || payload;
  if (!input || typeof input !== 'object') return null;

  const filePath = input.file_path || input.path || input.filename || '';
  const content  =
    input.content    ||
    input.new_string ||
    input.new_content||
    '';

  return { filePath: String(filePath), content: String(content) };
}

/**
 * Check if the file path targets a .planning/ directory.
 */
function isPlanningFile(filePath) {
  if (!filePath) return false;
  // Normalize separators
  const normalized = filePath.replace(/\\/g, '/');
  return (
    normalized.includes('/.planning/') ||
    normalized.startsWith('.planning/') ||
    normalized === '.planning'
  );
}

/**
 * Scan content for injection patterns.
 * Returns array of { label, match } for each hit.
 */
function scanContent(content) {
  const hits = [];
  if (!content) return hits;

  for (const { pattern, label } of INJECTION_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    const match = pattern.exec(content);
    if (match) {
      hits.push({ label, match: match[0] });
    }
  }

  return hits;
}

/**
 * Truncate a string for display.
 */
function truncate(s, max) {
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}

function main() {
  try {
    const payload = readPayload();
    if (!payload) return; // No stdin payload — not a Write/Edit call or not applicable

    const target = extractTarget(payload);
    if (!target) return;

    // Only scan .planning/ files
    if (!isPlanningFile(target.filePath)) return;

    const hits = scanContent(target.content);
    if (hits.length === 0) return; // Clean — exit silently

    // Advisory warning to stderr (non-blocking)
    process.stderr.write(
      `\n${EMERALD}[SUNCO]${RESET} ${YELLOW}${BOLD}Prompt Guard Advisory${RESET}\n`
    );
    process.stderr.write(
      `${DIM}File: ${target.filePath}${RESET}\n`
    );
    process.stderr.write(
      `${YELLOW}Detected ${hits.length} suspicious pattern${hits.length > 1 ? 's' : ''} in planning file:${RESET}\n`
    );

    for (const hit of hits) {
      process.stderr.write(
        `  ${RED}⚠${RESET}  ${BOLD}${hit.label}${RESET} ${DIM}— "${truncate(hit.match, 60)}"${RESET}\n`
      );
    }

    process.stderr.write(
      `\n${DIM}This is advisory only. Review the content before proceeding.${RESET}\n\n`
    );

    // Exit 0 — advisory, not blocking
  } catch {
    // Never throw — PreToolUse hook must not block any tool call
  }
}

main();

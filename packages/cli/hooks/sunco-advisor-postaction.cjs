#!/usr/bin/env node
'use strict';

/**
 * sunco-advisor-postaction.cjs
 *
 * PostToolUse hook (Claude Code only). Fires after every Write/Edit
 * tool call. Runs a fast classifier on the touched file path, and when
 * a notice/guarded/blocker signal fires, enqueues an advisor item to
 * ~/.sun/advisor-queue.json in `pending` state.
 *
 * The ambient UserPromptSubmit hook (sunco-advisor-ambient.cjs)
 * promotes pending items to `surfaced` when it injects them into the
 * next user prompt. This hook does NOT surface anything directly — it
 * only enqueues. That keeps the "zero output during edits" invariant
 * so Claude Code's tool call stream stays clean.
 *
 * Queue state machine (matches Phase 0 contract):
 *   pending → surfaced → acknowledged → resolved
 *   pending → expired (2h TTL, scavenged opportunistically)
 *
 * Crash-safe: every error path exits 0 with no queue write.
 * Never produces output (stdout/stderr are silent by design).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const SUN_DIR = path.join(os.homedir(), '.sun');
const QUEUE_PATH = path.join(SUN_DIR, 'advisor-queue.json');
const CONFIG_PATH = path.join(SUN_DIR, 'config.toml');
const QUEUE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_QUEUE_ITEMS = 50; // hard cap so the file never grows unbounded

// ---------------------------------------------------------------------------
// Config (reuse the TOML-lite reader shape)
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = {
  enabled: true,
  post_action_queue: true,
};

function readAdvisorConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return { ...DEFAULT_CONFIG };
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const out = { ...DEFAULT_CONFIG };
    let inAdvisor = false;
    for (const rawLine of raw.split('\n')) {
      const line = rawLine.trim();
      if (line.startsWith('[')) {
        inAdvisor = line.toLowerCase() === '[advisor]';
        continue;
      }
      if (!inAdvisor || !line || line.startsWith('#')) continue;
      const m = line.match(/^([a-z_]+)\s*=\s*(.+?)\s*$/i);
      if (!m) continue;
      const k = m[1];
      let v = m[2];
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      else if (v === 'true') v = true;
      else if (v === 'false') v = false;
      if (k in out) out[k] = v;
    }
    return out;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

// ---------------------------------------------------------------------------
// File-path classifier (lean mirror of risk-classifier)
// ---------------------------------------------------------------------------

const FILE_PATTERNS = {
  touchesAuth: [/(^|\/)auth(?:\/|\.|$)/i, /session/i, /login/i, /oauth/i, /jwt/i],
  touchesPayments: [/payment/i, /stripe/i, /billing/i, /checkout/i],
  touchesSchema: [/prisma\/schema\.prisma$/i, /drizzle\/schema/i, /models?\/.+\.(ts|js|py|rb|go|java)$/i],
  touchesMigration: [/migrations?\//i, /(^|\/)db\/migrate\//i, /alembic\//i, /flyway\//i],
  touchesSecrets: [/\.env(?!\.example)/i, /credentials/i, /secret/i, /key\.pem$/i],
  touchesCI: [/\.github\/workflows\//i, /\.circleci\//i, /\.gitlab-ci/i],
  touchesPackageManager: [/(^|\/)package\.json$/i, /requirements\.txt$/i, /cargo\.toml$/i],
  touchesLockfile: [/package-lock\.json$/i, /yarn\.lock$/i, /pnpm-lock\.yaml$/i, /cargo\.lock$/i],
};

const TEST_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|rs)$|(^|\/)__tests__\//i;
const DOCS_PATTERN = /\.md$|(^|\/)docs\//i;
const GENERATED_PATTERN = /(^|\/)dist\/|(^|\/)build\/|(^|\/)node_modules\//i;

const BLOCKER_SIGNALS = new Set(['touchesSecrets']);
const GUARDED_SIGNALS = new Set([
  'touchesAuth',
  'touchesPayments',
  'touchesSchema',
  'touchesMigration',
  'touchesCI',
  'touchesPackageManager',
  'touchesLockfile',
]);

function classifyFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return null;
  if (GENERATED_PATTERN.test(filePath)) return null; // skip generated
  if (DOCS_PATTERN.test(filePath) || TEST_PATTERN.test(filePath)) return null; // downgrade

  const signals = [];
  for (const [code, regexes] of Object.entries(FILE_PATTERNS)) {
    if (regexes.some((r) => r.test(filePath))) signals.push(code);
  }
  if (signals.length === 0) return null;

  let bucket = 'notice';
  if (signals.some((s) => BLOCKER_SIGNALS.has(s))) bucket = 'blocker';
  else if (signals.some((s) => GUARDED_SIGNALS.has(s))) bucket = 'guarded';

  return { bucket, signals, file: filePath };
}

// ---------------------------------------------------------------------------
// Queue I/O
// ---------------------------------------------------------------------------

function readQueue() {
  try {
    if (!fs.existsSync(QUEUE_PATH)) return { version: 1, items: [] };
    const parsed = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.items)) {
      return { version: 1, items: [] };
    }
    return parsed;
  } catch {
    return { version: 1, items: [] };
  }
}

function writeQueue(queue) {
  try {
    if (!fs.existsSync(SUN_DIR)) fs.mkdirSync(SUN_DIR, { recursive: true });
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');
  } catch {
    /* best-effort */
  }
}

// ---------------------------------------------------------------------------
// State machine helpers
// ---------------------------------------------------------------------------

function scavengeExpired(queue, now) {
  const cutoff = now - QUEUE_TTL_MS;
  for (const item of queue.items) {
    if (item.status === 'resolved') continue;
    if (item.status === 'expired') continue;
    const createdAt = Date.parse(item.createdAt);
    if (Number.isFinite(createdAt) && createdAt < cutoff) {
      item.status = 'expired';
    }
  }
}

function enforceCap(queue) {
  if (queue.items.length > MAX_QUEUE_ITEMS) {
    // Drop oldest non-pending first, then oldest pending.
    queue.items.sort((a, b) => {
      const sa = a.status === 'pending' ? 1 : 0;
      const sb = b.status === 'pending' ? 1 : 0;
      if (sa !== sb) return sa - sb;
      return Date.parse(a.createdAt) - Date.parse(b.createdAt);
    });
    queue.items = queue.items.slice(-MAX_QUEUE_ITEMS);
  }
}

function itemId(bucket, file, signals) {
  return crypto
    .createHash('sha1')
    .update(`${bucket}|${file}|${[...signals].sort().join(',')}`)
    .digest('hex')
    .slice(0, 12);
}

function suppressionKey(bucket, signals) {
  return `${bucket}:${[...signals].sort().join('+')}`;
}

function gatesFor(bucket) {
  if (bucket === 'blocker') {
    return [
      { gate: 'verify', scope: 'full' },
      { gate: 'review', scope: 'security' },
      { gate: 'proceed' },
    ];
  }
  if (bucket === 'guarded') {
    return [
      { gate: 'lint', scope: 'changed' },
      { gate: 'test', scope: 'targeted' },
    ];
  }
  return [{ gate: 'lint', scope: 'changed' }];
}

function enqueue(queue, classification, now) {
  const { bucket, file, signals } = classification;
  const id = itemId(bucket, file, signals);
  const key = suppressionKey(bucket, signals);

  // Dedupe by id while the prior item is still active.
  const existing = queue.items.find(
    (i) => i.id === id && (i.status === 'pending' || i.status === 'surfaced'),
  );
  if (existing) return false;

  queue.items.push({
    id,
    createdAt: new Date(now).toISOString(),
    source: 'PostToolUse',
    files: [file],
    signals,
    requiredGates: gatesFor(bucket),
    status: 'pending',
    suppressionKey: key,
    expiresAt: new Date(now + QUEUE_TTL_MS).toISOString(),
  });
  return true;
}

// ---------------------------------------------------------------------------
// Hook entry
// ---------------------------------------------------------------------------

function main() {
  try {
    const cfg = readAdvisorConfig();
    if (!cfg.enabled || !cfg.post_action_queue) return;

    // Claude Code passes tool call context via env. We accept two shapes:
    //   CLAUDE_TOOL_FILE_PATH — single path (Write/Edit)
    //   CLAUDE_TOOL_FILE_PATHS — comma-separated (MultiEdit)
    const raw =
      process.env.CLAUDE_TOOL_FILE_PATH ||
      process.env.CLAUDE_TOOL_FILE_PATHS ||
      '';
    if (!raw) return;

    const paths = raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (paths.length === 0) return;

    const queue = readQueue();
    const now = Date.now();
    scavengeExpired(queue, now);

    let added = false;
    for (const p of paths) {
      const cls = classifyFile(p);
      if (!cls) continue;
      if (enqueue(queue, cls, now)) added = true;
    }

    if (added) {
      enforceCap(queue);
      writeQueue(queue);
    }
  } catch {
    // silent
  }
}

main();

module.exports = {
  __test__: {
    classifyFile,
    itemId,
    suppressionKey,
    gatesFor,
    enqueue,
    scavengeExpired,
    enforceCap,
    readQueue,
    writeQueue,
  },
};

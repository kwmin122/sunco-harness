#!/usr/bin/env node
'use strict';

/**
 * sunco-advisor-ambient.cjs
 *
 * UserPromptSubmit hook (Claude Code only). Runs the deterministic
 * advisor classifier on the incoming user prompt and, when risk signals
 * fire, injects a <sunco_advisor> XML block so the agent can honor the
 * guidance without the user typing any slash command.
 *
 * This is a REDUCED mirror of the full engine in
 *   packages/skills-workflow/src/shared/{risk-classifier,advisor-policy,
 *   advisor-message,advisor-noise-budget}.ts
 *
 * The full engine — including diff stats, per-file deep inspection, and
 * queue state — is reserved for /sunco:advisor (Phase 4). This hook
 * must stay small, synchronous, and crash-safe. It NEVER blocks user
 * input: any error path exits 0 without output.
 *
 * Controls (read from ~/.sun/config.toml [advisor] block — best-effort
 * TOML-lite parser, falls back to defaults if unreadable):
 *   enabled            — master on/off  (default true)
 *   prompt_injection   — this hook only injects when true (default true)
 *   max_visible_per_session         (default 5)
 *   suppress_same_key_minutes       (default 30)
 *   blocking                        (default false; if true, blocker
 *                                   adds confirmation="required" in XML)
 *
 * Budget state is persisted to ~/.sun/advisor-budget.json so the
 * suppression / session cap survives process restart.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const SUN_DIR = path.join(os.homedir(), '.sun');
const CONFIG_PATH = path.join(SUN_DIR, 'config.toml');
const BUDGET_PATH = path.join(SUN_DIR, 'advisor-budget.json');
const LOG_PATH = path.join(SUN_DIR, 'advisor.log');
const QUEUE_PATH = path.join(SUN_DIR, 'advisor-queue.json');

// ---------------------------------------------------------------------------
// Minimal TOML-lite reader for [advisor] block
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = {
  enabled: true,
  prompt_injection: true,
  blocking: false,
  max_visible_per_session: 5,
  suppress_same_key_minutes: 30,
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
      const key = m[1];
      let val = m[2];
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      else if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (/^-?\d+(\.\d+)?$/.test(val)) val = Number(val);
      if (key in out) out[key] = val;
    }
    return out;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

// ---------------------------------------------------------------------------
// Inline signal detection (reduced mirror of risk-classifier.ts)
// ---------------------------------------------------------------------------

const PATTERNS = {
  destructiveIntent: [/\brm\s+-rf\b/i, /\bdrop\s+table\b/i, /\bforce[-\s]?push\b/i, /싹\s*지워/],
  deploymentIntent: [/\bdeploy\b/i, /\bpublish\b/i, /\brelease\b/i, /\bpush\s+to\s+prod/i, /배포/],
  moneyMovementIntent: [/\brefund\b/i, /\bcharge\s+the\s+card\b/i, /\bpayout\b/i],
  migrationIntent: [/\bmigrate\s+(prod|production|staging)\b/i, /\bapply\s+migration\b/i, /마이그레이션.*적용/],
  touchesAuth: [/\bauth\b/i, /\bsession\b/i, /\blogin\b/i, /\blogout\b/i, /\boauth\b/i, /인증/],
  touchesPayments: [/payment/i, /stripe/i, /billing/i, /결제/],
  touchesSchema: [/\bschema\b/i, /\bprisma\b/i, /db\s+schema/i],
  touchesSecrets: [/\bsecrets?\b/i, /\bapi\s*key\b/i, /\.env\b/],
  touchesCI: [/\bci\/cd\b/i, /\.github\/workflows/i, /\bpipeline\b/i],
  touchesPublicApi: [/\bpublic\s+api\b/i, /\b\/api\//, /\broutes?\b/i],
};

const BUCKETS = {
  blocker: ['destructiveIntent', 'deploymentIntent', 'moneyMovementIntent', 'touchesSecrets', 'migrationIntent'],
  guarded: ['touchesAuth', 'touchesPayments', 'touchesSchema', 'touchesPublicApi', 'touchesCI'],
};

function classifyPrompt(prompt) {
  const signals = [];
  for (const [code, regexes] of Object.entries(PATTERNS)) {
    if (regexes.some((r) => r.test(prompt))) signals.push(code);
  }
  if (signals.length === 0) return { bucket: 'silent', signals };
  if (signals.some((s) => BUCKETS.blocker.includes(s))) return { bucket: 'blocker', signals };
  if (signals.some((s) => BUCKETS.guarded.includes(s))) return { bucket: 'guarded', signals };
  return { bucket: 'silent', signals };
}

// ---------------------------------------------------------------------------
// Budget state
// ---------------------------------------------------------------------------

function readBudget() {
  try {
    if (!fs.existsSync(BUDGET_PATH)) return { lastSurfaced: {}, sessionStart: Date.now(), visibleCount: 0 };
    const parsed = JSON.parse(fs.readFileSync(BUDGET_PATH, 'utf8'));
    if (typeof parsed !== 'object' || !parsed) throw new Error('bad');
    return {
      lastSurfaced: parsed.lastSurfaced || {},
      sessionStart: parsed.sessionStart || Date.now(),
      visibleCount: parsed.visibleCount || 0,
    };
  } catch {
    return { lastSurfaced: {}, sessionStart: Date.now(), visibleCount: 0 };
  }
}

function writeBudget(state) {
  try {
    if (!fs.existsSync(SUN_DIR)) fs.mkdirSync(SUN_DIR, { recursive: true });
    fs.writeFileSync(BUDGET_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
  } catch {
    // best-effort; never block
  }
}

function appendLog(entry) {
  try {
    if (!fs.existsSync(SUN_DIR)) fs.mkdirSync(SUN_DIR, { recursive: true });
    fs.appendFileSync(
      LOG_PATH,
      JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n',
      'utf8',
    );
  } catch {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// Suppression / budget check
// ---------------------------------------------------------------------------

function shouldSurface(config, budget, suppressionKey) {
  if (budget.visibleCount >= (config.max_visible_per_session || 5)) {
    return { show: false, reason: 'session-cap-reached' };
  }
  const last = budget.lastSurfaced[suppressionKey];
  if (last) {
    const elapsedMin = (Date.now() - last) / 60000;
    if (elapsedMin < (config.suppress_same_key_minutes || 30)) {
      return { show: false, reason: 'recently-surfaced' };
    }
  }
  return { show: true };
}

// ---------------------------------------------------------------------------
// Message rendering
// ---------------------------------------------------------------------------

const REASON_SUMMARIES = {
  destructiveIntent: 'destructive op requested',
  deploymentIntent: 'deploy/publish requested',
  moneyMovementIntent: 'money movement requested',
  touchesSecrets: 'secrets/credentials referenced',
  migrationIntent: 'migration apply requested',
  touchesAuth: 'auth/session mentioned',
  touchesPayments: 'payments mentioned',
  touchesSchema: 'database schema mentioned',
  touchesCI: 'CI/release config mentioned',
  touchesPublicApi: 'public API surface mentioned',
};

const SUGGESTIONS = {
  blocker: 'write a plan (`/sunco:plan`) and get verify/review green before touching code.',
  guarded: "use `/sunco:quick` + targeted tests; run `/sunco:verify` when you're done.",
};

function buildMessage(bucket, signals) {
  const primary = signals[0] || 'risk';
  const risk = REASON_SUMMARIES[primary] || primary;
  const suggestion = SUGGESTIONS[bucket] || 'think before acting.';
  return `Risk: ${risk}.\nSuggestion: ${suggestion}`;
}

function buildInjection(bucket, signals, config) {
  const level = bucket === 'blocker' && !config.blocking ? 'guarded' : bucket;
  const msg = buildMessage(bucket, signals);
  const attrs = [
    'visibility="internal"',
    `level="${level}"`,
    `confidence="medium"`,
  ];
  if (bucket === 'blocker' && config.blocking) attrs.push('confirmation="required"');
  return `<sunco_advisor ${attrs.join(' ')}>\n${msg}\n</sunco_advisor>`;
}

// ---------------------------------------------------------------------------
// Main
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

function promoteOldestPending(queue) {
  const pending = queue.items.find((i) => i.status === 'pending');
  if (!pending) return null;
  pending.status = 'surfaced';
  pending.lastMessage = buildMessage(
    pending.signals && pending.signals[0] && pending.signals.includes('touchesSecrets') ? 'blocker' : 'guarded',
    pending.signals || [],
  );
  writeQueue(queue);
  return pending;
}

function renderQueueInjection(item) {
  const bucket = item.signals && item.signals.includes('touchesSecrets') ? 'blocker' : 'guarded';
  const gateList = (item.requiredGates || [])
    .map((g) => (g.scope ? `${g.gate}(${g.scope})` : g.gate))
    .join(', ');
  const files = (item.files || []).slice(0, 3).join(', ');
  const lines = [
    `Risk: unresolved edit queue — ${files}.`,
    `Suggestion: run ${gateList || 'lint/test'} before new work.`,
  ];
  const attrs = [
    'visibility="internal"',
    `level="${bucket === 'blocker' ? 'guarded' : bucket}"`,
    `confidence="high"`,
    `source="post-action-queue"`,
  ];
  return `<sunco_advisor ${attrs.join(' ')}>\n${lines.join('\n')}\n</sunco_advisor>`;
}

function main() {
  try {
    const config = readAdvisorConfig();
    if (!config.enabled || !config.prompt_injection) return;

    const prompt = process.env.CLAUDE_USER_PROMPT || '';
    if (!prompt) return;
    if (prompt.trim().startsWith('/')) return; // slash commands bypass
    if (prompt.trim().length < 4) return; // noise guard

    // 1. Promote a pending queue item if any. At most one per prompt
    //    (maxPerPrompt=1 by policy).
    const queue = readQueue();
    const surfaced = promoteOldestPending(queue);

    if (surfaced) {
      const budget = readBudget();
      if (budget.visibleCount < (config.max_visible_per_session || 5)) {
        budget.visibleCount += 1;
        writeBudget(budget);
        appendLog({ event: 'queue-surfaced', id: surfaced.id });
        process.stdout.write(renderQueueInjection(surfaced) + '\n');
        return;
      }
    }

    // 2. Fall through to prompt-based classification.
    const { bucket, signals } = classifyPrompt(prompt);
    if (bucket === 'silent') return;

    const suppressionKey = `${bucket}:${[...signals].sort().join('+')}`;
    const budget = readBudget();
    const decision = shouldSurface(config, budget, suppressionKey);

    if (!decision.show) {
      appendLog({ event: 'suppressed', bucket, signals, reason: decision.reason });
      return;
    }

    budget.lastSurfaced[suppressionKey] = Date.now();
    budget.visibleCount += 1;
    writeBudget(budget);

    appendLog({ event: 'surfaced', bucket, signals, suppressionKey });
    process.stdout.write(buildInjection(bucket, signals, config) + '\n');
  } catch (err) {
    try { appendLog({ event: 'error', error: String(err && err.message || err) }); } catch { /* ignore */ }
    // never throw; never block user input
  }
}

main();

// Exports for unit testing (require() this file and call the inner fns).
module.exports = {
  __test__: {
    readAdvisorConfig,
    classifyPrompt,
    shouldSurface,
    buildMessage,
    buildInjection,
    readQueue,
    writeQueue,
    promoteOldestPending,
    renderQueueInjection,
  },
};

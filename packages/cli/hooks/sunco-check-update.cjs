#!/usr/bin/env node
'use strict';

/**
 * sunco-check-update.cjs
 * Runs on SessionStart. Checks if a newer version of popcoru is available.
 *
 * Features (GSD-parity):
 * - Cache: 60min TTL for up-to-date, 12h TTL for upgrade-available (avoids spam)
 * - Snooze: escalating silence (24h → 48h → 7d) per version
 * - Just-upgraded: shows welcome message after npx popcoru upgrade
 *
 * Exits cleanly on any error so it never blocks session start.
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync } = require('child_process');

const EMERALD = '\x1b[38;2;0;128;70m';
const YELLOW  = '\x1b[33m';
const GREEN   = '\x1b[32m';
const DIM     = '\x1b[2m';
const BOLD    = '\x1b[1m';
const RESET   = '\x1b[0m';
const TIMEOUT_MS = 4000;

// State directory
const STATE_DIR = path.join(os.homedir(), '.sunco');
const CACHE_FILE = path.join(STATE_DIR, 'last-update-check');
const SNOOZE_FILE = path.join(STATE_DIR, 'update-snoozed');
const UPGRADED_MARKER = path.join(STATE_DIR, 'just-upgraded-from');

function ensureStateDir() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

function readInstalledVersion() {
  try {
    const versionFile = path.join(os.homedir(), '.claude', 'sunco', 'VERSION');
    return fs.readFileSync(versionFile, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

function fetchLatestVersion() {
  try {
    const result = execSync('npm view popcoru version --json 2>/dev/null', {
      timeout: TIMEOUT_MS,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(result.trim());
  } catch {
    return null;
  }
}

function parseVersion(v) {
  if (!v || typeof v !== 'string') return [0, 0, 0];
  return v.split('.').map((n) => parseInt(n, 10) || 0);
}

function isNewer(installed, latest) {
  const a = parseVersion(installed);
  const b = parseVersion(latest);
  for (let i = 0; i < 3; i++) {
    if (b[i] > a[i]) return true;
    if (b[i] < a[i]) return false;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Cache: avoid hitting npm on every session
// ---------------------------------------------------------------------------
function readCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = fs.readFileSync(CACHE_FILE, 'utf8').trim();
    const data = JSON.parse(raw);
    const ageMs = Date.now() - (data.ts || 0);
    // TTL: 60min for up-to-date, 12h for upgrade-available
    const ttlMs = data.status === 'UP_TO_DATE' ? 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
    if (ageMs > ttlMs) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(status, installed, latest) {
  try {
    ensureStateDir();
    fs.writeFileSync(CACHE_FILE, JSON.stringify({
      status, installed, latest, ts: Date.now()
    }), 'utf8');
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Snooze: escalating silence (24h → 48h → 7d)
// ---------------------------------------------------------------------------
function isSnoozed(latestVersion) {
  try {
    if (!fs.existsSync(SNOOZE_FILE)) return false;
    const data = JSON.parse(fs.readFileSync(SNOOZE_FILE, 'utf8'));
    if (data.version !== latestVersion) return false; // new version resets snooze
    const durations = [0, 24*3600*1000, 48*3600*1000, 7*24*3600*1000];
    const level = Math.min(data.level || 1, 3);
    return (Date.now() - (data.ts || 0)) < (durations[level] || durations[3]);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Just-upgraded marker (set by installer)
// ---------------------------------------------------------------------------
function checkJustUpgraded(currentVersion) {
  try {
    if (!fs.existsSync(UPGRADED_MARKER)) return null;
    const oldVersion = fs.readFileSync(UPGRADED_MARKER, 'utf8').trim();
    fs.unlinkSync(UPGRADED_MARKER);
    try { fs.unlinkSync(SNOOZE_FILE); } catch { /* ok */ }
    try { fs.unlinkSync(CACHE_FILE); } catch { /* ok */ }
    return oldVersion;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  try {
    const installed = readInstalledVersion();
    if (!installed) return;

    // Check just-upgraded marker
    const upgradedFrom = checkJustUpgraded(installed);
    if (upgradedFrom && upgradedFrom !== installed) {
      console.error(
        `${GREEN}[SUNCO]${RESET} ${BOLD}Updated!${RESET} ${DIM}${upgradedFrom}${RESET} → ${GREEN}${installed}${RESET}`
      );
      return;
    }

    // Check cache first (fast path)
    const cached = readCache();
    if (cached) {
      if (cached.status === 'UP_TO_DATE') return;
      if (cached.status === 'UPGRADE_AVAILABLE' && cached.latest) {
        if (!isSnoozed(cached.latest)) {
          console.error(
            `${EMERALD}[SUNCO]${RESET} ${YELLOW}Update available:${RESET} ${installed} → ${cached.latest}. ` +
            `Run ${EMERALD}npx popcoru${RESET} to upgrade.`
          );
        }
        return;
      }
    }

    // Slow path: fetch from npm registry
    const latest = fetchLatestVersion();
    if (!latest) return;

    if (isNewer(installed, latest)) {
      writeCache('UPGRADE_AVAILABLE', installed, latest);
      if (!isSnoozed(latest)) {
        console.error(
          `${EMERALD}[SUNCO]${RESET} ${YELLOW}Update available:${RESET} ${installed} → ${latest}. ` +
          `Run ${EMERALD}npx popcoru${RESET} to upgrade.`
        );
      }
    } else {
      writeCache('UP_TO_DATE', installed, latest);
    }
  } catch {
    // Never throw — session start must not block
  }
}

main();

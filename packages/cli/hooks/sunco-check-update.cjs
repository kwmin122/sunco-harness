#!/usr/bin/env node
'use strict';

/**
 * sunco-check-update.js
 * Runs on SessionStart. Checks if a newer version of popcoru is available.
 * Exits cleanly on any error so it never blocks session start.
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync } = require('child_process');

const EMERALD = '\x1b[38;2;0;128;70m';
const YELLOW  = '\x1b[33m';
const RESET   = '\x1b[0m';
const TIMEOUT_MS = 4000;

function readInstalledVersion() {
  try {
    const versionFile = path.join(os.homedir(), '.claude', 'sunco', 'VERSION');
    const raw = fs.readFileSync(versionFile, 'utf8').trim();
    return raw || null;
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
    // npm view returns a JSON string like "\"0.2.1\""
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

function main() {
  try {
    const installed = readInstalledVersion();
    if (!installed) return; // SUNCO not installed, nothing to check

    const latest = fetchLatestVersion();
    if (!latest) return; // Network unavailable or npm error, skip silently

    if (isNewer(installed, latest)) {
      console.log(
        `${EMERALD}[SUNCO]${RESET} ` +
        `${YELLOW}Update available:${RESET} ${installed} → ${latest}. ` +
        `Run ${EMERALD}npx popcoru${RESET} to upgrade.`
      );
    }
  } catch {
    // Never throw — this runs at session start and must not block anything
  }
}

main();

#!/usr/bin/env node
'use strict';

/**
 * SUNCO Runtime Registry — Single Source of Truth
 *
 * All runtime metadata lives here. installer, updater, smoke test,
 * and contract lint import from this file instead of hardcoding.
 *
 * To add a new runtime:
 *   1. Add an entry to RUNTIMES below
 *   2. Run smoke-test and contract-lint to verify
 *   3. No other files need runtime lists updated
 */

const RUNTIMES = {
  claude: {
    id: 'claude',
    name: 'Claude Code',
    nameKo: 'Claude Code',
    dir: '.claude',
    support: 'full',
    hasSettings: true,
  },
  codex: {
    id: 'codex',
    name: 'Codex CLI',
    nameKo: 'Codex CLI',
    dir: '.codex',
    support: 'full',
    hasSettings: false,
  },
  cursor: {
    id: 'cursor',
    name: 'Cursor',
    nameKo: 'Cursor',
    dir: '.cursor',
    support: 'full',
    hasSettings: false,
  },
  antigravity: {
    id: 'antigravity',
    name: 'Antigravity',
    nameKo: 'Antigravity',
    dir: '.antigravity',
    support: 'partial',
    hasSettings: false,
  },
};

/** All runtime IDs */
const RUNTIME_IDS = Object.keys(RUNTIMES);

/** Runtime IDs with full or partial support (excludes 'none') */
const SUPPORTED_RUNTIME_IDS = RUNTIME_IDS.filter(id => RUNTIMES[id].support !== 'none');

/** Map of id → home directory (e.g. { claude: '.claude', codex: '.codex' }) */
const RUNTIME_DIRS = Object.fromEntries(RUNTIME_IDS.map(id => [id, RUNTIMES[id].dir]));

/**
 * Find the first installed runtime's VERSION file.
 * Returns { version, runtimeId, dir } or null.
 */
function findInstalledVersion(homeDir) {
  const fs = require('fs');
  const path = require('path');
  for (const id of SUPPORTED_RUNTIME_IDS) {
    const versionPath = path.join(homeDir, RUNTIMES[id].dir, 'sunco', 'VERSION');
    try {
      const version = fs.readFileSync(versionPath, 'utf8').trim();
      return { version, runtimeId: id, dir: RUNTIMES[id].dir };
    } catch {
      // not installed here
    }
  }
  return null;
}

/**
 * Find all installed runtimes with their versions.
 * Returns array of { runtimeId, dir, version, binDir }.
 */
function findAllInstalled(homeDir) {
  const fs = require('fs');
  const path = require('path');
  const results = [];
  for (const id of SUPPORTED_RUNTIME_IDS) {
    const suncoDir = path.join(homeDir, RUNTIMES[id].dir, 'sunco');
    const versionPath = path.join(suncoDir, 'VERSION');
    try {
      const version = fs.readFileSync(versionPath, 'utf8').trim();
      results.push({
        runtimeId: id,
        dir: RUNTIMES[id].dir,
        version,
        binDir: path.join(suncoDir, 'bin'),
      });
    } catch {
      // not installed
    }
  }
  return results;
}

module.exports = {
  RUNTIMES,
  RUNTIME_IDS,
  SUPPORTED_RUNTIME_IDS,
  RUNTIME_DIRS,
  findInstalledVersion,
  findAllInstalled,
};

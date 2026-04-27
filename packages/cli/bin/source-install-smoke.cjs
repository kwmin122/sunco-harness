#!/usr/bin/env node
'use strict';

/**
 * Hermetic source-tree install smoke.
 *
 * `smoke-test.cjs` intentionally verifies an already-installed runtime tree.
 * This wrapper is for package-level tests: it installs the current source tree
 * into a temporary HOME first, then runs the installed-runtime smoke there.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { RUNTIME_DIRS } = require('./runtime-registry.cjs');

const DEFAULT_RUNTIMES = ['claude'];
const ALL_RUNTIMES = ['claude', 'codex', 'cursor', 'antigravity'];

function parseArgs(argv) {
  const args = argv.slice(2);
  const runtimes = [];
  let keepTemp = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--runtime' && args[i + 1]) {
      runtimes.push(...expandRuntimeArg(args[++i]));
    } else if (arg.startsWith('--runtime=')) {
      runtimes.push(...expandRuntimeArg(arg.slice('--runtime='.length)));
    } else if (arg === '--keep-temp') {
      keepTemp = true;
    }
  }

  return {
    runtimes: runtimes.length > 0 ? [...new Set(runtimes)] : DEFAULT_RUNTIMES,
    keepTemp,
  };
}

function expandRuntimeArg(value) {
  if (value === 'all') return ALL_RUNTIMES;
  return value.split(',').map((part) => part.trim()).filter(Boolean);
}

function runNode(scriptPath, args, opts = {}) {
  execFileSync(process.execPath, [scriptPath, ...args], {
    cwd: opts.cwd,
    env: opts.env,
    stdio: 'inherit',
    timeout: opts.timeout ?? 120000,
  });
}

function main() {
  const { runtimes, keepTemp } = parseArgs(process.argv);
  const unknown = runtimes.filter((runtime) => !RUNTIME_DIRS[runtime]);
  if (unknown.length > 0) {
    throw new Error(`Unknown runtime(s): ${unknown.join(', ')}`);
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sunco-source-smoke-'));
  const home = path.join(root, 'home');
  fs.mkdirSync(home, { recursive: true });

  const installScript = path.join(__dirname, 'install.cjs');
  const smokeScript = path.join(__dirname, 'smoke-test.cjs');
  const env = { ...process.env, HOME: home };

  console.log(`SUNCO source install smoke: ${root}`);

  try {
    for (const runtime of runtimes) {
      runNode(installScript, ['--runtime', runtime, '--lang', 'en'], {
        cwd: root,
        env,
      });
      runNode(smokeScript, ['--runtime', runtime, '--home', home], {
        cwd: root,
        env,
      });
    }
  } finally {
    if (!keepTemp) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
}

try {
  main();
} catch (err) {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
}

#!/usr/bin/env node
'use strict';

/**
 * Release artifact smoke gate.
 *
 * Validates the product path rather than the source tree path:
 *   npm pack -> temp npm prefix install -> temp HOME runtime install
 *   -> installed sunco-runtime do/status/verify/ship.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { RUNTIME_DIRS } = require('./runtime-registry.cjs');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const pkgRoot = path.join(__dirname, '..');
const DEFAULT_RUNTIMES = ['claude', 'codex', 'cursor', 'antigravity'];

let passed = 0;
let failed = 0;

function parseArgs(argv) {
  const args = argv.slice(2);
  const runtimes = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--runtime' && args[i + 1]) {
      const value = args[++i];
      if (value === 'all') runtimes.push(...DEFAULT_RUNTIMES);
      else runtimes.push(...value.split(',').map((part) => part.trim()).filter(Boolean));
    }
  }
  return {
    runtimes: runtimes.length > 0 ? [...new Set(runtimes)] : DEFAULT_RUNTIMES,
  };
}

function check(name, condition, detail) {
  if (condition) {
    console.log(`  ${GREEN}PASS${RESET} ${name}`);
    passed += 1;
  } else {
    console.log(`  ${RED}FAIL${RESET} ${name}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

function run(command, args, opts = {}) {
  return execFileSync(command, args, {
    cwd: opts.cwd ?? pkgRoot,
    env: opts.env ?? process.env,
    encoding: 'utf8',
    timeout: opts.timeout ?? 120000,
    stdio: opts.stdio ?? ['ignore', 'pipe', 'pipe'],
  });
}

function runNode(scriptPath, args, opts = {}) {
  return run(process.execPath, [scriptPath, ...args], opts);
}

function createSmokeRepo(root, runtime) {
  const repoDir = path.join(root, `repo-${runtime}`);
  fs.mkdirSync(repoDir, { recursive: true });
  const env = gitEnv();

  run('git', ['init', '-q'], { cwd: repoDir, env });
  fs.writeFileSync(
    path.join(repoDir, 'package.json'),
    JSON.stringify({
      name: `sunco-artifact-smoke-${runtime}`,
      private: true,
      scripts: {
        test: 'node -e "process.exit(0)"',
      },
    }, null, 2) + '\n',
    'utf8',
  );
  fs.writeFileSync(path.join(repoDir, 'tracked.txt'), 'before\n', 'utf8');
  run('git', ['add', 'package.json', 'tracked.txt'], { cwd: repoDir, env });
  run('git', ['commit', '-q', '-m', 'seed'], { cwd: repoDir, env });
  fs.writeFileSync(path.join(repoDir, 'tracked.txt'), `after ${runtime}\n`, 'utf8');

  return repoDir;
}

function runRuntimeWorkflow(runtimeCliPath, repoDir, runtime) {
  const env = gitEnv();
  const taskId = `artifact-${runtime}`;
  const doResult = JSON.parse(runNode(runtimeCliPath, [
    'do',
    'artifact',
    runtime,
    'smoke',
    '--task',
    taskId,
    '--json',
  ], { cwd: repoDir, env }));
  const statusResult = JSON.parse(runNode(runtimeCliPath, [
    'status',
    taskId,
    '--json',
  ], { cwd: repoDir, env }));
  const verifyResult = JSON.parse(runNode(runtimeCliPath, [
    'verify',
    taskId,
    '--json',
  ], { cwd: repoDir, env }));
  const shipResult = JSON.parse(runNode(runtimeCliPath, [
    'ship',
    taskId,
    '--json',
  ], { cwd: repoDir, env }));

  return { doResult, statusResult, verifyResult, shipResult };
}

function gitEnv(extra = {}) {
  return {
    ...process.env,
    ...extra,
    GIT_AUTHOR_NAME: 'SUNCO Artifact Smoke',
    GIT_AUTHOR_EMAIL: 'sunco-artifact-smoke@example.com',
    GIT_COMMITTER_NAME: 'SUNCO Artifact Smoke',
    GIT_COMMITTER_EMAIL: 'sunco-artifact-smoke@example.com',
  };
}

function findTarball(packDir) {
  const tarballs = fs.readdirSync(packDir).filter((file) => file.endsWith('.tgz')).sort();
  if (tarballs.length === 0) throw new Error(`npm pack did not create a tarball in ${packDir}`);
  return path.join(packDir, tarballs[tarballs.length - 1]);
}

function findInstalledPackageRoot(prefix) {
  const packageRoot = path.join(prefix, 'lib', 'node_modules', 'popcoru');
  if (!fs.existsSync(packageRoot)) throw new Error(`Installed package root missing: ${packageRoot}`);
  return packageRoot;
}

async function main() {
  const { runtimes } = parseArgs(process.argv);
  const unknown = runtimes.filter((runtime) => !RUNTIME_DIRS[runtime]);
  if (unknown.length > 0) {
    throw new Error(`Unknown runtime(s): ${unknown.join(', ')}`);
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sunco-artifact-smoke-'));
  const packDir = path.join(root, 'pack');
  const prefix = path.join(root, 'npm-prefix');
  const home = path.join(root, 'home');
  fs.mkdirSync(packDir, { recursive: true });
  fs.mkdirSync(prefix, { recursive: true });
  fs.mkdirSync(home, { recursive: true });

  console.log(`\n${BOLD}SUNCO Release Artifact Smoke${RESET}`);
  console.log(`  ${DIM}${root}${RESET}\n`);

  run('npm', ['pack', '--pack-destination', packDir], { cwd: pkgRoot, timeout: 180000 });
  const tarball = findTarball(packDir);
  check('npm pack creates release tarball', fs.existsSync(tarball), path.basename(tarball));

  const installEnv = { ...process.env, HOME: home };
  run('npm', ['install', '--global', '--prefix', prefix, tarball], {
    cwd: root,
    env: installEnv,
    timeout: 180000,
  });
  const installedPackageRoot = findInstalledPackageRoot(prefix);
  check('tarball installs into clean npm prefix', fs.existsSync(installedPackageRoot));

  const globalRuntimeBin = path.join(prefix, 'bin', 'sunco-runtime');
  check('package exposes sunco-runtime bin', fs.existsSync(globalRuntimeBin));
  const globalHelp = run(globalRuntimeBin, ['--help'], { cwd: root, env: installEnv });
  check('global sunco-runtime bin runs', globalHelp.includes('SUNCO Runtime'));

  const installScript = path.join(installedPackageRoot, 'bin', 'install.cjs');

  for (const runtime of runtimes) {
    console.log(`\n${BOLD}${runtime}${RESET}`);
    runNode(installScript, ['--runtime', runtime, '--lang', 'en'], {
      cwd: root,
      env: installEnv,
      timeout: 120000,
    });

    const runtimeDir = RUNTIME_DIRS[runtime];
    const installedRuntimeCli = path.join(home, runtimeDir, 'sunco', 'bin', 'sunco-runtime.cjs');
    check(`${runtime}: installed sunco-runtime.cjs present`, fs.existsSync(installedRuntimeCli));
    const help = runNode(installedRuntimeCli, ['--help'], {
      cwd: root,
      env: installEnv,
    });
    check(`${runtime}: installed sunco-runtime --help runs`, help.includes('SUNCO Runtime'));

    const repoDir = createSmokeRepo(root, runtime);
    const workflow = runRuntimeWorkflow(installedRuntimeCli, repoDir, runtime);
    check(`${runtime}: do captures changed-file evidence`,
      workflow.doResult.success === true
      && workflow.doResult.task?.status === 'done'
      && workflow.doResult.changedFiles?.includes('tracked.txt'));
    check(`${runtime}: status reads task evidence`,
      workflow.statusResult.success === true
      && workflow.statusResult.status?.task?.id === `artifact-${runtime}`);
    check(`${runtime}: verify passes Done Gate`,
      workflow.verifyResult.success === true
      && workflow.verifyResult.gate?.status === 'passed');
    check(`${runtime}: ship marks task shipped`,
      workflow.shipResult.success === true
      && workflow.shipResult.task?.status === 'shipped');
  }

  if (process.env.SUNCO_KEEP_ARTIFACT_SMOKE !== '1') {
    fs.rmSync(root, { recursive: true, force: true });
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  ${GREEN}${passed} passed${RESET}, ${failed > 0 ? RED : ''}${failed} failed${RESET}`);
  console.log(`${'─'.repeat(50)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`\n${RED}Artifact smoke failed:${RESET} ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

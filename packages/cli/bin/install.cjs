#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------
const EMERALD = '\x1b[38;2;0;128;70m';
const GREEN   = '\x1b[32m';
const BOLD    = '\x1b[1m';
const DIM     = '\x1b[2m';
const RESET   = '\x1b[0m';

// ---------------------------------------------------------------------------
// ASCII art logo
// ---------------------------------------------------------------------------
const LOGO = `
${EMERALD}   ███████╗██╗   ██╗███╗   ██╗ ██████╗ ██████╗ ${RESET}
${EMERALD}   ██╔════╝██║   ██║████╗  ██║██╔════╝██╔═══██╗${RESET}
${EMERALD}   ███████╗██║   ██║██╔██╗ ██║██║     ██║   ██║${RESET}
${EMERALD}   ╚════██║██║   ██║██║╚██╗██║██║     ██║   ██║${RESET}
${EMERALD}   ███████║╚██████╔╝██║ ╚████║╚██████╗╚██████╔╝${RESET}
${EMERALD}   ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝${RESET}
`;

// ---------------------------------------------------------------------------
// Read version from package.json
// ---------------------------------------------------------------------------
function readVersion() {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return 0;
  ensureDir(dest);
  let count = 0;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  }
  return count;
}

function copyGlob(srcDir, pattern, destDir) {
  if (!fs.existsSync(srcDir)) return 0;
  ensureDir(destDir);
  let count = 0;
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    // Simple suffix match — pattern is e.g. "*.md", "*.js", "*.cjs"
    const ext = pattern.replace('*', '');
    if (!entry.name.endsWith(ext)) continue;
    fs.copyFileSync(
      path.join(srcDir, entry.name),
      path.join(destDir, entry.name)
    );
    count++;
  }
  return count;
}

function removeDirIfExists(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// settings.json patching
// ---------------------------------------------------------------------------
function patchSettings(targetDir) {
  const settingsPath = path.join(targetDir, 'settings.json');
  let settings = {};

  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      // If parse fails, start fresh (don't nuke existing file on error though)
      settings = {};
    }
  }

  // Ensure hooks structure exists
  if (!settings.hooks) settings.hooks = {};
  if (!Array.isArray(settings.hooks.SessionStart)) settings.hooks.SessionStart = [];

  const hookEntry = {
    matcher: '',
    command: 'node $HOME/.claude/hooks/sunco-check-update.cjs'
  };

  // Only add if not already present (check both .js and .cjs variants for idempotency)
  const alreadyPresent = settings.hooks.SessionStart.some(
    (h) =>
      h.command === hookEntry.command ||
      h.command === 'node $HOME/.claude/hooks/sunco-check-update.js'
  );

  if (!alreadyPresent) {
    settings.hooks.SessionStart.push(hookEntry);
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

function unpatchSettings(targetDir) {
  const settingsPath = path.join(targetDir, 'settings.json');
  if (!fs.existsSync(settingsPath)) return;

  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    return;
  }

  if (!settings.hooks || !settings.hooks.SessionStart) return;

  settings.hooks.SessionStart = settings.hooks.SessionStart.filter(
    (h) =>
      h.command !== 'node $HOME/.claude/hooks/sunco-check-update.cjs' &&
      h.command !== 'node $HOME/.claude/hooks/sunco-check-update.js'
  );

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Count skills (*.md files) in commands/sunco
// ---------------------------------------------------------------------------
function countSkills(srcDir) {
  if (!fs.existsSync(srcDir)) return 0;
  try {
    return fs.readdirSync(srcDir).filter((f) => f.endsWith('.md')).length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------
function install(targetDir) {
  const pkgRoot = path.join(__dirname, '..');

  // Source paths (relative to the npm package root)
  const srcCommands = path.join(pkgRoot, 'commands', 'sunco');
  const srcEngine   = path.join(pkgRoot, 'dist');          // built CLI artifacts
  const srcHooks    = path.join(pkgRoot, 'hooks');

  // Destination paths
  const destCommands = path.join(targetDir, 'commands', 'sunco');
  const destEngine   = path.join(targetDir, 'sunco', 'bin');
  const destHooks    = path.join(targetDir, 'hooks');

  const skillCount = countSkills(srcCommands);

  // Copy commands
  const cmdCopied = copyDirRecursive(srcCommands, destCommands);

  // Copy engine (dist/ -> {target}/sunco/bin/)
  const engCopied = copyDirRecursive(srcEngine, destEngine);

  // Write VERSION file alongside engine
  const version = readVersion();
  ensureDir(path.join(targetDir, 'sunco'));
  fs.writeFileSync(path.join(targetDir, 'sunco', 'VERSION'), version + '\n', 'utf8');

  // Copy hooks (.cjs files — CJS format required to run standalone outside ESM package)
  const hooksCopied = copyGlob(srcHooks, '*.cjs', destHooks);

  // Patch settings.json
  patchSettings(targetDir);

  return { cmdCopied, engCopied, hooksCopied, skillCount, version };
}

// ---------------------------------------------------------------------------
// Uninstall
// ---------------------------------------------------------------------------
function uninstall(targetDir) {
  const removed = [];

  const toRemove = [
    path.join(targetDir, 'commands', 'sunco'),
    path.join(targetDir, 'sunco'),
  ];

  for (const p of toRemove) {
    if (removeDirIfExists(p)) removed.push(p);
  }

  // Remove SUNCO hooks
  const hooksDir = path.join(targetDir, 'hooks');
  if (fs.existsSync(hooksDir)) {
    for (const f of fs.readdirSync(hooksDir)) {
      if (f.startsWith('sunco-')) {
        fs.rmSync(path.join(hooksDir, f), { force: true });
        removed.push(path.join(hooksDir, f));
      }
    }
  }

  unpatchSettings(targetDir);

  return removed;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = {
    global:    false,
    local:     false,
    uninstall: false,
    help:      false,
  };

  for (const a of args) {
    if (a === '--global'    || a === '-g') flags.global    = true;
    if (a === '--local'     || a === '-l') flags.local     = true;
    if (a === '--uninstall' || a === '-u') flags.uninstall = true;
    if (a === '--help'      || a === '-h') flags.help      = true;
  }

  // Default to global when no location flag provided
  if (!flags.global && !flags.local) flags.global = true;

  return flags;
}

function showHelp(version) {
  console.log(LOGO);
  console.log(`  ${BOLD}SUNCO v${version}${RESET}`);
  console.log(`  ${DIM}Agent Workspace OS — harness engineering for AI agents${RESET}\n`);
  console.log(`  ${BOLD}Usage:${RESET}`);
  console.log(`    npx popcoru [options]\n`);
  console.log(`  ${BOLD}Options:${RESET}`);
  console.log(`    ${EMERALD}--global${RESET}, -g     Install to ~/.claude/  ${DIM}(default)${RESET}`);
  console.log(`    ${EMERALD}--local${RESET},  -l     Install to ./.claude/`);
  console.log(`    ${EMERALD}--uninstall${RESET}, -u  Remove SUNCO files`);
  console.log(`    ${EMERALD}--help${RESET},    -h    Show this help\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const version = readVersion();
  const flags   = parseArgs(process.argv);

  if (flags.help) {
    showHelp(version);
    process.exit(0);
  }

  console.log(LOGO);
  console.log(`  ${BOLD}SUNCO v${version}${RESET}`);
  console.log(`  ${DIM}Agent Workspace OS — harness engineering for AI agents${RESET}\n`);

  if (flags.uninstall) {
    // ---- UNINSTALL --------------------------------------------------------
    const targetDir = flags.local
      ? path.join(process.cwd(), '.claude')
      : path.join(os.homedir(), '.claude');

    console.log(`  Uninstalling from ${DIM}${targetDir}${RESET} ...\n`);

    try {
      const removed = uninstall(targetDir);
      if (removed.length === 0) {
        console.log(`  ${DIM}Nothing to uninstall.${RESET}\n`);
      } else {
        for (const p of removed) {
          console.log(`  ${GREEN}✓${RESET} Removed ${DIM}${path.relative(targetDir, p)}${RESET}`);
        }
        console.log(`\n  Done! SUNCO has been uninstalled.\n`);
      }
    } catch (err) {
      console.error(`\n  Error during uninstall: ${err.message}\n`);
      process.exit(1);
    }
    return;
  }

  // ---- INSTALL ------------------------------------------------------------
  const targetDir = flags.local
    ? path.join(process.cwd(), '.claude')
    : path.join(os.homedir(), '.claude');

  const scope = flags.local ? 'local (.claude/)' : 'global (~/.claude/)';
  console.log(`  Installing ${BOLD}${scope}${RESET} ...\n`);

  try {
    const { cmdCopied, engCopied, hooksCopied, skillCount, version: v } = install(targetDir);

    const skillLabel = skillCount > 0 ? `(${skillCount} skills)` : `(${cmdCopied} files)`;
    console.log(`  ${GREEN}✓${RESET} Installed ${BOLD}commands/sunco${RESET} ${DIM}${skillLabel}${RESET}`);
    console.log(`  ${GREEN}✓${RESET} Installed ${BOLD}sunco engine${RESET}  ${DIM}(${engCopied} files)${RESET}`);
    console.log(`  ${GREEN}✓${RESET} Installed ${BOLD}hooks${RESET}          ${DIM}(${hooksCopied} files)${RESET}`);
    console.log(`\n  ${GREEN}Done!${RESET} Run ${EMERALD}/sunco:help${RESET} to get started.\n`);
  } catch (err) {
    console.error(`\n  ${BOLD}Error during install:${RESET} ${err.message}\n`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  }
}

main();

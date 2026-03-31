#!/usr/bin/env node

/**
 * SUNCO Tools — CJS utility script for SUNCO workflow automation
 *
 * Equivalent to GSD's gsd-tools.cjs. Centralizes atomic operations used
 * across SUNCO skill scripts: commits, config init, state reads/writes,
 * project detection, and phase transitions.
 *
 * Usage: node sunco-tools.cjs <command> [args]
 *
 * Commands:
 *   commit <message> [--files f1 f2] [--all]
 *       Stages specified files (or all if --all) and commits.
 *       Returns JSON: { committed: true, hash: "abc123" }
 *
 *   config-new-project '<json>'
 *       Creates .planning/config.json with defaults merged with provided JSON.
 *       Returns JSON: { created: true, path: ".planning/config.json" }
 *
 *   init <workflow>
 *       Returns project detection context for the given workflow.
 *       Returns JSON: { project_exists, has_codebase_map, planning_exists,
 *                       has_existing_code, has_package_file, has_git, project_root }
 *
 *   state-update [--phase N] [--status S] [--next S] [--timestamp S]
 *       Updates .planning/STATE.md with given fields.
 *       Returns JSON: { updated: true, path: ".planning/STATE.md" }
 *
 *   transition --from N --to N [--message S]
 *       Updates STATE.md for phase transition and commits it.
 *       Returns JSON: { transitioned: true, from: N, to: N, hash: "abc123" }
 *
 * All output is JSON to stdout. Never throws — returns { error: "message" } on failure.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Output helpers ───────────────────────────────────────────────────────────

function out(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function fail(message) {
  out({ error: message });
  process.exit(0); // never throw — always emit JSON
}

// ─── Filesystem helpers ───────────────────────────────────────────────────────

/**
 * Recursively create directories (mkdir -p equivalent).
 */
function mkdirp(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Write content to a file, creating parent directories as needed.
 */
function writeFile(filePath, content) {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Read a file as a string, returning null if it doesn't exist.
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

// ─── Project root detection ───────────────────────────────────────────────────

/**
 * Walk upward from cwd to find the nearest directory containing .planning/,
 * package.json, or .git. Falls back to cwd if nothing is found.
 */
function findProjectRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (
      fs.existsSync(path.join(dir, '.planning')) ||
      fs.existsSync(path.join(dir, 'package.json')) ||
      fs.existsSync(path.join(dir, '.git'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

// ─── Arg parsing helpers ──────────────────────────────────────────────────────

/**
 * Extract named --flag <value> pairs from an args array.
 * Returns an object mapping flag names to their values (null if absent).
 * Flags listed in booleanFlags are treated as boolean (no value consumed).
 */
function parseNamedArgs(args, valueFlags = [], booleanFlags = []) {
  const result = {};
  for (const flag of valueFlags) {
    const idx = args.indexOf(`--${flag}`);
    result[flag] =
      idx !== -1 && args[idx + 1] !== undefined && !args[idx + 1].startsWith('--')
        ? args[idx + 1]
        : null;
  }
  for (const flag of booleanFlags) {
    result[flag] = args.includes(`--${flag}`);
  }
  return result;
}

/**
 * Collect all tokens after --flag until the next --flag or end of args.
 * Returns an empty array if the flag is absent.
 */
function parseListArg(args, flag) {
  const idx = args.indexOf(`--${flag}`);
  if (idx === -1) return [];
  const tokens = [];
  for (let i = idx + 1; i < args.length; i++) {
    if (args[i].startsWith('--')) break;
    tokens.push(args[i]);
  }
  return tokens;
}

// ─── Git helpers ──────────────────────────────────────────────────────────────

/**
 * Run a git command synchronously in the given directory.
 * Returns stdout as a trimmed string, or throws on non-zero exit.
 */
function git(args, cwd) {
  return execSync(`git ${args}`, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

/**
 * Get the short hash of the most recent commit.
 */
function headHash(cwd) {
  return git('rev-parse --short HEAD', cwd);
}

// ─── STATE.md helpers ─────────────────────────────────────────────────────────

const STATE_PATH_RELATIVE = path.join('.planning', 'STATE.md');

/**
 * Parse STATE.md into a key-value map by looking for lines of the form:
 *   - **Key**: value
 *   key: value  (YAML-style)
 * Returns an object; all values are strings.
 */
function parseState(content) {
  const result = {};
  const lines = content.split('\n');
  for (const line of lines) {
    // Markdown bold key pattern: - **Key**: value
    const mdMatch = line.match(/^\s*[-*]?\s*\*\*(.+?)\*\*\s*:\s*(.*)$/);
    if (mdMatch) {
      result[mdMatch[1].trim().toLowerCase().replace(/\s+/g, '_')] = mdMatch[2].trim();
      continue;
    }
    // YAML-style: key: value
    const yamlMatch = line.match(/^(\w[\w_-]*)\s*:\s*(.+)$/);
    if (yamlMatch) {
      result[yamlMatch[1].trim().toLowerCase()] = yamlMatch[2].trim();
    }
  }
  return result;
}

/**
 * Update (or append) a set of key-value pairs in STATE.md content.
 * Handles lines of the form:  - **Key**: old_value
 * For keys not found, appends them at the end.
 */
function patchStateContent(content, updates) {
  let result = content;
  for (const [key, value] of Object.entries(updates)) {
    // Try to replace existing bold-key line
    const regex = new RegExp(
      `(^\\s*[-*]?\\s*\\*\\*${escapeRegex(key)}\\*\\*\\s*:\\s*)(.*)$`,
      'im'
    );
    if (regex.test(result)) {
      result = result.replace(regex, `$1${value}`);
    } else {
      // Append as new field
      result = result.trimEnd() + `\n- **${key}**: ${value}\n`;
    }
  }
  return result;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a fresh STATE.md when none exists.
 */
function buildInitialStateContent(fields) {
  const ts = new Date().toISOString();
  return [
    '# Project State',
    '',
    `- **phase**: ${fields.phase || '1'}`,
    `- **status**: ${fields.status || 'not_started'}`,
    `- **next_action**: ${fields.next || 'Begin phase 1'}`,
    `- **last_updated**: ${fields.timestamp || ts}`,
    '',
  ].join('\n');
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/**
 * commit <message> [--files f1 f2 ...] [--all]
 *
 * Stage specific files or all tracked changes, then commit.
 * Returns: { committed: true, hash: "<short-hash>" }
 */
function cmdCommit(args, cwd) {
  const message = args[1];
  if (!message) return fail('commit requires a message as the first argument');

  const files = parseListArg(args, 'files');
  const { all } = parseNamedArgs(args, [], ['all']);

  try {
    if (all) {
      git('add -A', cwd);
    } else if (files.length > 0) {
      for (const f of files) {
        git(`add -- "${f}"`, cwd);
      }
    } else {
      // Default: stage all tracked modifications (no untracked)
      git('add -u', cwd);
    }

    git(`commit -m ${JSON.stringify(message)}`, cwd);
    const hash = headHash(cwd);
    out({ committed: true, hash });
  } catch (e) {
    fail(`commit failed: ${e.message}`);
  }
}

/**
 * config-new-project '<json>'
 *
 * Creates .planning/config.json with defaults merged with provided JSON.
 * Returns: { created: true, path: ".planning/config.json" }
 */
function cmdConfigNewProject(args, cwd) {
  const rawJson = args[1];

  const defaults = {
    mode: 'guided',
    agent: 'claude-code',
    profile: 'quality',
    planning_dir: '.planning',
    created_at: new Date().toISOString(),
  };

  let provided = {};
  if (rawJson) {
    try {
      provided = JSON.parse(rawJson);
    } catch (e) {
      return fail(`config-new-project: invalid JSON argument — ${e.message}`);
    }
  }

  const merged = Object.assign({}, defaults, provided);
  const configPath = path.join(cwd, '.planning', 'config.json');

  try {
    writeFile(configPath, JSON.stringify(merged, null, 2) + '\n');
    out({ created: true, path: path.join('.planning', 'config.json') });
  } catch (e) {
    fail(`config-new-project: write failed — ${e.message}`);
  }
}

/**
 * init <workflow>
 *
 * Returns project detection context. workflow argument is for future
 * workflow-specific enrichment; current implementation returns the same
 * core detection fields for all workflows.
 *
 * Returns: {
 *   project_exists: bool,
 *   has_codebase_map: bool,
 *   planning_exists: bool,
 *   has_existing_code: bool,
 *   has_package_file: bool,
 *   has_git: bool,
 *   project_root: string
 * }
 */
function cmdInit(args, cwd) {
  // args[1] is the workflow name (e.g. "new-project") — kept for future use
  const projectRoot = findProjectRoot(cwd);

  const planningDir = path.join(projectRoot, '.planning');
  const planningExists = fs.existsSync(planningDir);

  // has_codebase_map: .planning/codebase-map.md or .sun/codebase-map.md
  const hasCodebaseMap =
    fs.existsSync(path.join(planningDir, 'codebase-map.md')) ||
    fs.existsSync(path.join(projectRoot, '.sun', 'codebase-map.md'));

  // has_package_file: package.json, Cargo.toml, pyproject.toml, go.mod, etc.
  const packageIndicators = [
    'package.json',
    'Cargo.toml',
    'pyproject.toml',
    'go.mod',
    'pom.xml',
    'build.gradle',
    'composer.json',
  ];
  const hasPackageFile = packageIndicators.some((f) =>
    fs.existsSync(path.join(projectRoot, f))
  );

  // has_existing_code: any src/ or lib/ directory, or a recognised source file
  const codeIndicators = ['src', 'lib', 'app', 'cmd', 'internal'];
  const hasExistingCode =
    codeIndicators.some((d) => {
      const full = path.join(projectRoot, d);
      return fs.existsSync(full) && fs.statSync(full).isDirectory();
    }) || hasPackageFile;

  const hasGit = fs.existsSync(path.join(projectRoot, '.git'));

  out({
    project_exists: planningExists || hasExistingCode,
    has_codebase_map: hasCodebaseMap,
    planning_exists: planningExists,
    has_existing_code: hasExistingCode,
    has_package_file: hasPackageFile,
    has_git: hasGit,
    project_root: projectRoot,
  });
}

/**
 * state-update [--phase N] [--status S] [--next S] [--timestamp S]
 *
 * Updates (or creates) .planning/STATE.md with the given fields.
 * Returns: { updated: true, path: ".planning/STATE.md" }
 */
function cmdStateUpdate(args, cwd) {
  const flags = parseNamedArgs(args, ['phase', 'status', 'next', 'timestamp']);

  const statePath = path.join(cwd, STATE_PATH_RELATIVE);
  const existing = readFile(statePath);

  const ts = flags.timestamp || new Date().toISOString();

  if (!existing) {
    // Bootstrap a new STATE.md
    const content = buildInitialStateContent({
      phase: flags.phase,
      status: flags.status,
      next: flags.next,
      timestamp: ts,
    });
    try {
      writeFile(statePath, content);
      out({ updated: true, path: STATE_PATH_RELATIVE });
    } catch (e) {
      fail(`state-update: write failed — ${e.message}`);
    }
    return;
  }

  // Patch existing STATE.md
  const updates = {};
  if (flags.phase !== null) updates['phase'] = flags.phase;
  if (flags.status !== null) updates['status'] = flags.status;
  if (flags.next !== null) updates['next_action'] = flags.next;
  updates['last_updated'] = ts;

  try {
    const patched = patchStateContent(existing, updates);
    writeFile(statePath, patched);
    out({ updated: true, path: STATE_PATH_RELATIVE });
  } catch (e) {
    fail(`state-update: write failed — ${e.message}`);
  }
}

/**
 * transition --from N --to N [--message S]
 *
 * Updates STATE.md for a phase transition and commits the change.
 * Returns: { transitioned: true, from: N, to: N, hash: "<short-hash>" }
 */
function cmdTransition(args, cwd) {
  const flags = parseNamedArgs(args, ['from', 'to', 'message']);

  if (!flags.from) return fail('transition requires --from <phase>');
  if (!flags.to) return fail('transition requires --to <phase>');

  const fromPhase = flags.from;
  const toPhase = flags.to;
  const ts = new Date().toISOString();
  const commitMsg =
    flags.message || `chore: transition phase ${fromPhase} → ${toPhase}`;

  // Update STATE.md
  const statePath = path.join(cwd, STATE_PATH_RELATIVE);
  const existing = readFile(statePath);

  if (!existing) {
    // Create a minimal STATE.md for the new phase
    const content = buildInitialStateContent({
      phase: toPhase,
      status: 'in_progress',
      next: `Begin phase ${toPhase}`,
      timestamp: ts,
    });
    try {
      writeFile(statePath, content);
    } catch (e) {
      return fail(`transition: could not write STATE.md — ${e.message}`);
    }
  } else {
    const updates = {
      phase: toPhase,
      status: 'in_progress',
      next_action: `Begin phase ${toPhase}`,
      last_updated: ts,
    };
    try {
      const patched = patchStateContent(existing, updates);
      writeFile(statePath, patched);
    } catch (e) {
      return fail(`transition: could not update STATE.md — ${e.message}`);
    }
  }

  // Commit the STATE.md update
  try {
    git(`add -- "${STATE_PATH_RELATIVE}"`, cwd);
    git(`commit -m ${JSON.stringify(commitMsg)}`, cwd);
    const hash = headHash(cwd);
    out({ transitioned: true, from: fromPhase, to: toPhase, hash });
  } catch (e) {
    // If nothing to commit (e.g. no change), still report success
    if (/nothing to commit/i.test(e.message)) {
      let hash = '';
      try { hash = headHash(cwd); } catch {}
      out({ transitioned: true, from: fromPhase, to: toPhase, hash });
    } else {
      fail(`transition: git commit failed — ${e.message}`);
    }
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // Optional --cwd override
  let cwd = process.cwd();
  const cwdEqArg = args.find((a) => a.startsWith('--cwd='));
  const cwdIdx = args.indexOf('--cwd');
  if (cwdEqArg) {
    const value = cwdEqArg.slice('--cwd='.length).trim();
    if (!value) return fail('Missing value for --cwd');
    args.splice(args.indexOf(cwdEqArg), 1);
    cwd = path.resolve(value);
  } else if (cwdIdx !== -1) {
    const value = args[cwdIdx + 1];
    if (!value || value.startsWith('--')) return fail('Missing value for --cwd');
    args.splice(cwdIdx, 2);
    cwd = path.resolve(value);
  }

  if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
    return fail(`Invalid --cwd: ${cwd}`);
  }

  const command = args[0];

  if (!command) {
    return fail(
      'Usage: node sunco-tools.cjs <command> [args] [--cwd <path>]\n' +
        'Commands: commit, config-new-project, init, state-update, transition'
    );
  }

  switch (command) {
    case 'commit':
      cmdCommit(args, cwd);
      break;
    case 'config-new-project':
      cmdConfigNewProject(args, cwd);
      break;
    case 'init':
      cmdInit(args, cwd);
      break;
    case 'state-update':
      cmdStateUpdate(args, cwd);
      break;
    case 'transition':
      cmdTransition(args, cwd);
      break;
    default:
      fail(`Unknown command: ${command}. Valid commands: commit, config-new-project, init, state-update, transition`);
  }
}

main().catch((e) => {
  // Final safety net — should never reach here since all paths return JSON
  out({ error: `Unhandled error: ${e.message}` });
  process.exit(0);
});

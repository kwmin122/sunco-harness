#!/usr/bin/env node

/**
 * SUNCO Tools — CJS utility script for SUNCO workflow automation
 *
 * Equivalent to GSD's gsd-tools.cjs. Centralizes atomic operations used
 * across SUNCO skill scripts: commits, config init, state reads/writes,
 * project detection, phase transitions, todo management, and model resolution.
 *
 * Usage: node sunco-tools.cjs <command> [args] [--cwd <path>]
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
 *   init phase-op <phase_number>
 *       Returns full context for phase operation workflows.
 *       Returns JSON: { commit_docs, phase_found, phase_dir, phase_number, phase_name,
 *                       phase_slug, padded_phase, has_research, has_context, has_plans,
 *                       has_verification, plan_count, roadmap_exists, planning_exists }
 *
 *   state-update [--phase N] [--status S] [--next S] [--timestamp S]
 *       Updates .planning/STATE.md with given fields.
 *       Returns JSON: { updated: true, path: ".planning/STATE.md" }
 *
 *   transition --from N --to N [--message S]
 *       Updates STATE.md for phase transition and commits it.
 *       Returns JSON: { transitioned: true, from: N, to: N, hash: "abc123" }
 *
 *   config-get <key>
 *       Reads a dot-path key from .planning/config.json.
 *       Returns JSON: { key: "workflow.research", value: true }
 *
 *   config-set <key> <value>
 *       Writes a dot-path key to .planning/config.json.
 *       Returns JSON: { updated: true, key: "...", value: ... }
 *
 *   todo add <text>
 *       Adds a new todo item to .planning/todos/pending/.
 *       Returns JSON: { added: true, id: N, file: "..." }
 *
 *   todo list [--area <area>]
 *       Lists pending todos, optionally filtered by area.
 *       Returns JSON: { count: N, todos: [...] }
 *
 *   todo done <id_or_filename>
 *       Marks a todo as completed (moves to completed/).
 *       Returns JSON: { completed: true, file: "..." }
 *
 *   todo match-phase <phase_number>
 *       Matches pending todos against a phase's context.
 *       Returns JSON: { todo_count: N, matches: [...] }
 *
 *   resolve-model <agent-role>
 *       Resolves the model for an agent role based on config profile.
 *       Returns JSON: { agent: "...", profile: "...", model: "..." }
 *
 *   agent-skills <agent-role>
 *       Returns skill injection text for an agent.
 *       Returns JSON: { agent: "...", skills: "..." }
 *
 *   begin-phase <phase_number>
 *       Marks a phase as started in STATE.md.
 *       Returns JSON: { started: true, phase: N }
 *
 *   complete-phase <phase_number>
 *       Marks a phase as completed in STATE.md.
 *       Returns JSON: { completed: true, phase: N }
 *
 *   checkpoint read <phase>
 *       Reads checkpoint data for a phase.
 *       Returns JSON: { phase: N, wave: N, data: {...} }
 *
 *   checkpoint write <phase> <wave> '<json>'
 *       Writes checkpoint data for a phase.
 *       Returns JSON: { written: true, phase: N, wave: N }
 *
 *   artifact-hash compute
 *       Hash all .planning/ artifacts, store in .planning/.hashes.json.
 *       Returns JSON: { computed: true, count: N, path: ".planning/.hashes.json" }
 *
 *   artifact-hash check
 *       Compare stored hashes against current file hashes.
 *       Returns JSON: { changed: bool, artifacts: [{ file, old_hash, new_hash, status }] }
 *
 *   rollback-point create --label <label>
 *       Creates rollback point: snapshot hashes + git tag + manifest.
 *       Returns JSON: { created: true, label, tag, manifest }
 *
 *   rollback-point list
 *       Lists all rollback points.
 *       Returns JSON: { count: N, points: [...] }
 *
 *   rollback-point restore --label <label>
 *       Restores .planning/ artifacts to a rollback point (code untouched).
 *       Returns JSON: { restored: true, label, tag, restored_files: N }
 *
 *   rollback-point prune --older-than <N>d
 *       Deletes rollback points older than N days.
 *       Returns JSON: { pruned: N, remaining: N }
 *
 *   impact-analysis --changed <file1> [file2 ...]
 *       Computes invalidation cascade for changed planning artifacts.
 *       Returns JSON: { invalidated: [...], maybe_invalidated: [...], warnings: [...] }
 *
 * All output is JSON to stdout. Never throws — returns { error: "message" } on failure.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
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

/**
 * List files in a directory, returning [] if it doesn't exist.
 */
function listDir(dirPath) {
  try {
    return fs.readdirSync(dirPath);
  } catch {
    return [];
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

/**
 * Return the .planning directory path for a project root.
 */
function planningDir(projectRoot) {
  return path.join(projectRoot, '.planning');
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

/**
 * Patch a YAML-style frontmatter field in STATE.md content.
 * Looks for lines like:  fieldname: value
 * If not found, appends before the first --- boundary end.
 */
function patchFrontmatterField(content, field, value) {
  const fieldRegex = new RegExp(`^(${escapeRegex(field)}\\s*:\\s*)(.*)$`, 'm');
  if (fieldRegex.test(content)) {
    return content.replace(fieldRegex, `$1${value}`);
  }
  // Try to append inside frontmatter block (between --- markers)
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const newFm = fmMatch[0].replace(/\n---$/, `\n${field}: ${value}\n---`);
    return content.replace(fmMatch[0], newFm);
  }
  // Fallback: append bold-key style
  return content.trimEnd() + `\n- **${field}**: ${value}\n`;
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

// ─── Config helpers ───────────────────────────────────────────────────────────

/**
 * Load .planning/config.json from the project root.
 * Returns an empty object if the file doesn't exist or is malformed.
 */
function loadConfig(projectRoot) {
  const configPath = path.join(projectRoot, '.planning', 'config.json');
  const raw = readFile(configPath);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Get a nested value from an object using dot-path notation.
 * e.g. getNestedValue({workflow: {research: true}}, 'workflow.research') => true
 */
function getNestedValue(obj, keyPath) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * Set a nested value in an object using dot-path notation.
 * Creates intermediate objects as needed.
 */
function setNestedValue(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (cur[part] === null || cur[part] === undefined || typeof cur[part] !== 'object') {
      cur[part] = {};
    }
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
}

/**
 * Parse a CLI string value to its appropriate type.
 * 'true'/'false' => boolean, numeric strings => number, else string.
 */
function parseConfigValue(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  const n = Number(raw);
  if (!isNaN(n) && raw.trim() !== '') return n;
  return raw;
}

// ─── Phase helpers ────────────────────────────────────────────────────────────

/**
 * Normalize a phase number to zero-padded 2-digit string (e.g. 1 => '01', 13 => '13').
 * Decimal phases like '1.1' => '01.1'.
 */
function padPhase(phaseNum) {
  const str = String(phaseNum);
  if (str.includes('.')) {
    const [int, dec] = str.split('.');
    return String(int).padStart(2, '0') + '.' + dec;
  }
  return str.padStart(2, '0');
}

/**
 * Convert a phase name to a URL-safe slug.
 * e.g. 'Core Platform' => 'core-platform'
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Find the phase directory for a given phase number.
 * Scans .planning/phases/ for a directory starting with the padded phase number.
 * Returns { found, directory, phase_name, phase_slug, phase_number } or null.
 */
function findPhaseDir(projectRoot, phaseNum) {
  const phasesDir = path.join(projectRoot, '.planning', 'phases');
  if (!fs.existsSync(phasesDir)) return null;

  const padded = padPhase(phaseNum);
  let dirs;
  try {
    dirs = fs.readdirSync(phasesDir);
  } catch {
    return null;
  }

  // Match directories starting with the padded phase number
  const match = dirs.find((d) => {
    const stat = fs.statSync(path.join(phasesDir, d));
    if (!stat.isDirectory()) return false;
    return d === padded || d.startsWith(padded + '-') || d.startsWith(padded + '.');
  });

  if (!match) return null;

  const dirPath = path.join('.planning', 'phases', match);
  // Extract phase name from directory name: "01-core-platform" => "Core Platform"
  const namePart = match.replace(/^\d+(\.\d+)?-/, '');
  const phaseName = namePart
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return {
    found: true,
    directory: dirPath,
    phase_number: phaseNum,
    phase_name: phaseName,
    phase_slug: slugify(phaseName),
    padded_phase: padded,
  };
}

/**
 * Inspect a phase directory for artifact presence.
 * Returns flags: has_research, has_context, has_verification, plan_count, etc.
 */
function inspectPhaseDir(projectRoot, phaseDir) {
  const fullDir = path.join(projectRoot, phaseDir);
  const files = listDir(fullDir);

  const planFiles = files.filter((f) => /PLAN\.md$/i.test(f) || /-PLAN\.md$/i.test(f));
  const hasResearch = files.some((f) => /RESEARCH\.md$/i.test(f));
  const hasContext = files.some((f) => /CONTEXT\.md$/i.test(f));
  const hasVerification = files.some((f) => /VERIFICATION\.md$/i.test(f));

  return {
    has_research: hasResearch,
    has_context: hasContext,
    has_verification: hasVerification,
    has_plans: planFiles.length > 0,
    plan_count: planFiles.length,
    files,
  };
}

/**
 * Parse ROADMAP.md to find phase info by number.
 * Returns { found, phase_number, phase_name } or null.
 */
function findPhaseInRoadmap(projectRoot, phaseNum) {
  const roadmapPath = path.join(projectRoot, '.planning', 'ROADMAP.md');
  const content = readFile(roadmapPath);
  if (!content) return null;

  const padded = padPhase(phaseNum);
  // Match lines like: | Phase 01 | Core Platform | ...
  // or: ## Phase 01 — Core Platform
  const patterns = [
    new RegExp(`Phase\\s+${escapeRegex(padded)}\\s*[|\\-—]\\s*([^|\\n]+)`, 'i'),
    new RegExp(`##\\s+Phase\\s+${escapeRegex(padded)}\\s*[—\\-]\\s*([^\\n]+)`, 'i'),
    new RegExp(`\\|\\s*${escapeRegex(padded)}\\s*\\|\\s*([^|]+)\\|`, 'i'),
  ];

  for (const pattern of patterns) {
    const m = content.match(pattern);
    if (m) {
      const phaseName = m[1].trim().replace(/\*+/g, '').trim();
      return {
        found: true,
        phase_number: phaseNum,
        phase_name: phaseName,
        phase_slug: slugify(phaseName),
      };
    }
  }

  return null;
}

// ─── Model profiles ───────────────────────────────────────────────────────────

const MODEL_PROFILES = {
  'sunco-planner':        { quality: 'claude-opus-4-5',   balanced: 'claude-sonnet-4-5', budget: 'claude-haiku-3-5' },
  'sunco-roadmapper':     { quality: 'claude-opus-4-5',   balanced: 'claude-sonnet-4-5', budget: 'claude-sonnet-4-5' },
  'sunco-executor':       { quality: 'claude-opus-4-5',   balanced: 'claude-sonnet-4-5', budget: 'claude-sonnet-4-5' },
  'sunco-researcher':     { quality: 'claude-opus-4-5',   balanced: 'claude-sonnet-4-5', budget: 'claude-haiku-3-5' },
  'sunco-verifier':       { quality: 'claude-sonnet-4-5', balanced: 'claude-sonnet-4-5', budget: 'claude-haiku-3-5' },
  'sunco-plan-checker':   { quality: 'claude-sonnet-4-5', balanced: 'claude-sonnet-4-5', budget: 'claude-haiku-3-5' },
  'sunco-debugger':       { quality: 'claude-opus-4-5',   balanced: 'claude-sonnet-4-5', budget: 'claude-sonnet-4-5' },
  'sunco-mapper':         { quality: 'claude-sonnet-4-5', balanced: 'claude-haiku-3-5',  budget: 'claude-haiku-3-5' },
  'sunco-ui-checker':     { quality: 'claude-sonnet-4-5', balanced: 'claude-sonnet-4-5', budget: 'claude-haiku-3-5' },
  'sunco-synthesizer':    { quality: 'claude-sonnet-4-5', balanced: 'claude-sonnet-4-5', budget: 'claude-haiku-3-5' },
};

// Aliases: map gsd- agent names to sunco- equivalents for cross-compatibility
const AGENT_ALIASES = {
  'gsd-planner':       'sunco-planner',
  'gsd-executor':      'sunco-executor',
  'gsd-verifier':      'sunco-verifier',
  'gsd-debugger':      'sunco-debugger',
  'gsd-roadmapper':    'sunco-roadmapper',
  'gsd-codebase-mapper': 'sunco-mapper',
};

const PROFILE_SHORT_TO_MODEL = {
  opus:   'claude-opus-4-5',
  sonnet: 'claude-sonnet-4-5',
  haiku:  'claude-haiku-3-5',
};

/**
 * Resolve the full model ID for an agent role given a profile.
 */
function resolveModel(agentRole, profile) {
  const normalizedRole = AGENT_ALIASES[agentRole] || agentRole;
  const profileDef = MODEL_PROFILES[normalizedRole];

  if (!profileDef) {
    // Unknown agent: fall back to profile-level defaults
    const defaults = { quality: 'claude-opus-4-5', balanced: 'claude-sonnet-4-5', budget: 'claude-haiku-3-5' };
    return defaults[profile] || defaults.balanced;
  }

  const shortModel = profileDef[profile] || profileDef.balanced;
  return shortModel;
}

// ─── Todo helpers ─────────────────────────────────────────────────────────────

/**
 * Return the pending todos directory path.
 */
function todoPendingDir(projectRoot) {
  return path.join(projectRoot, '.planning', 'todos', 'pending');
}

/**
 * Return the completed todos directory path.
 */
function todoCompletedDir(projectRoot) {
  return path.join(projectRoot, '.planning', 'todos', 'completed');
}

/**
 * Generate the next todo ID by scanning existing pending + completed files.
 */
function nextTodoId(projectRoot) {
  const pendingFiles = listDir(todoPendingDir(projectRoot));
  const completedFiles = listDir(todoCompletedDir(projectRoot));
  const all = [...pendingFiles, ...completedFiles];

  let maxId = 0;
  for (const f of all) {
    const m = f.match(/^(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxId) maxId = n;
    }
  }
  return maxId + 1;
}

/**
 * Parse a todo file's content to extract title, body, area, and creation date.
 */
function parseTodoFile(content, filename) {
  const lines = content.split('\n');
  let title = '';
  let area = 'general';
  let body = '';
  let created = '';

  for (const line of lines) {
    if (!title && line.startsWith('# ')) {
      title = line.slice(2).trim();
      continue;
    }
    const areaMatch = line.match(/^\*\*[Aa]rea\*\*\s*:\s*(.+)$/);
    if (areaMatch) { area = areaMatch[1].trim(); continue; }
    const createdMatch = line.match(/^\*\*[Cc]reated\*\*\s*:\s*(.+)$/);
    if (createdMatch) { created = createdMatch[1].trim(); continue; }
    body += line + '\n';
  }

  // Extract ID from filename
  const idMatch = filename.match(/^(\d+)/);
  const id = idMatch ? parseInt(idMatch[1], 10) : null;

  return { id, title: title || filename, area, body: body.trim(), created };
}

// ─── Checkpoint helpers ───────────────────────────────────────────────────────

/**
 * Return the checkpoint file path for a phase.
 */
function checkpointPath(projectRoot, phase) {
  const padded = padPhase(phase);
  return path.join(projectRoot, '.planning', 'phases', padded, '.checkpoint.json');
}

// ─── Artifact hash helpers ───────────────────────────────────────────────────

const crypto = require('crypto');

/**
 * Tracked planning artifacts — files whose changes trigger impact analysis.
 */
const TRACKED_ARTIFACTS = [
  'PROJECT.md', 'REQUIREMENTS.md', 'ROADMAP.md', 'STATE.md',
];

/**
 * Compute SHA256 hash of a file's content.
 */
function fileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    return null;
  }
}

/**
 * Collect all trackable planning artifacts: top-level + per-phase CONTEXT/PLAN/VERIFICATION.
 * Returns array of { relative, absolute } objects.
 */
function collectArtifacts(projectRoot) {
  const pDir = planningDir(projectRoot);
  const artifacts = [];

  // Top-level planning files
  for (const name of TRACKED_ARTIFACTS) {
    const abs = path.join(pDir, name);
    if (fs.existsSync(abs)) {
      artifacts.push({ relative: path.join('.planning', name), absolute: abs });
    }
  }

  // Per-phase files (CONTEXT.md, PLAN.md, VERIFICATION.md, RESEARCH.md)
  const phasesDir = path.join(pDir, 'phases');
  if (fs.existsSync(phasesDir)) {
    const phases = listDir(phasesDir).filter((d) => {
      try { return fs.statSync(path.join(phasesDir, d)).isDirectory(); } catch { return false; }
    });
    for (const phase of phases) {
      const phaseDir = path.join(phasesDir, phase);
      const files = listDir(phaseDir).filter((f) =>
        /\.(md|json)$/i.test(f) && !f.startsWith('.')
      );
      for (const f of files) {
        const abs = path.join(phaseDir, f);
        artifacts.push({ relative: path.join('.planning', 'phases', phase, f), absolute: abs });
      }
    }
  }

  return artifacts;
}

/**
 * Path to the stored hashes file.
 */
function hashesPath(projectRoot) {
  return path.join(planningDir(projectRoot), '.hashes.json');
}

// ─── Rollback helpers ────────────────────────────────────────────────────────

/**
 * Path to the rollback manifest directory.
 */
function rollbackDir(projectRoot) {
  return path.join(planningDir(projectRoot), '.rollback');
}

// ─── Impact analysis helpers ─────────────────────────────────────────────────

/**
 * Dependency graph: which artifacts are invalidated when a given artifact changes.
 * Keys are basename patterns, values are functions that return affected files.
 */
function computeImpactCascade(projectRoot, changedFiles) {
  const pDir = planningDir(projectRoot);
  const phasesDir = path.join(pDir, 'phases');
  const results = { invalidated: [], maybe_invalidated: [], warnings: [] };

  // Collect all phase directories
  const phaseDirs = [];
  if (fs.existsSync(phasesDir)) {
    const dirs = listDir(phasesDir).filter((d) => {
      try { return fs.statSync(path.join(phasesDir, d)).isDirectory(); } catch { return false; }
    });
    for (const d of dirs) phaseDirs.push(d);
  }

  for (const changed of changedFiles) {
    const basename = path.basename(changed);

    if (basename === 'PROJECT.md') {
      if (fs.existsSync(path.join(pDir, 'REQUIREMENTS.md')))
        results.maybe_invalidated.push({ file: '.planning/REQUIREMENTS.md', reason: 'Project goals may have changed' });
      if (fs.existsSync(path.join(pDir, 'ROADMAP.md')))
        results.maybe_invalidated.push({ file: '.planning/ROADMAP.md', reason: 'Project constraints may have changed' });
      for (const d of phaseDirs) {
        const ctx = path.join(phasesDir, d);
        const ctxFiles = listDir(ctx).filter((f) => /CONTEXT\.md$/i.test(f));
        for (const f of ctxFiles)
          results.maybe_invalidated.push({ file: path.join('.planning', 'phases', d, f), reason: 'May reference changed project decisions' });
      }
    }

    if (basename === 'REQUIREMENTS.md') {
      for (const d of phaseDirs) {
        const phaseFiles = listDir(path.join(phasesDir, d));
        const ctxFiles = phaseFiles.filter((f) => /CONTEXT\.md$/i.test(f));
        const planFiles = phaseFiles.filter((f) => /PLAN\.md$/i.test(f));
        for (const f of ctxFiles)
          results.invalidated.push({ file: path.join('.planning', 'phases', d, f), reason: 'Covered requirements may have changed' });
        for (const f of planFiles)
          results.invalidated.push({ file: path.join('.planning', 'phases', d, f), reason: 'Implemented requirements may have changed' });
      }
      if (fs.existsSync(path.join(pDir, 'ROADMAP.md')))
        results.maybe_invalidated.push({ file: '.planning/ROADMAP.md', reason: 'Phase success criteria may reference changed requirements' });
    }

    if (basename === 'ROADMAP.md') {
      if (fs.existsSync(path.join(pDir, 'STATE.md')))
        results.warnings.push({ file: '.planning/STATE.md', reason: 'Current phase may have changed — update STATE.md' });
      for (const d of phaseDirs) {
        const ctxFiles = listDir(path.join(phasesDir, d)).filter((f) => /CONTEXT\.md$/i.test(f));
        for (const f of ctxFiles)
          results.maybe_invalidated.push({ file: path.join('.planning', 'phases', d, f), reason: 'Phase scope may have changed' });
      }
    }

    // Per-phase CONTEXT.md changed
    const phaseContextMatch = changed.match(/phases\/([^/]+)\/.*CONTEXT\.md$/i);
    if (phaseContextMatch) {
      const phaseD = phaseContextMatch[1];
      const phaseFiles = listDir(path.join(phasesDir, phaseD));
      const planFiles = phaseFiles.filter((f) => /PLAN\.md$/i.test(f));
      for (const f of planFiles)
        results.invalidated.push({ file: path.join('.planning', 'phases', phaseD, f), reason: 'Must re-plan — context has changed' });
      const summaryFiles = phaseFiles.filter((f) => /SUMMARY\.md$/i.test(f));
      for (const f of summaryFiles)
        results.warnings.push({ file: path.join('.planning', 'phases', phaseD, f), reason: 'Already executed — may need revision' });
    }
  }

  // Deduplicate
  const dedup = (arr) => {
    const seen = new Set();
    return arr.filter((item) => {
      const key = item.file + '|' + item.reason;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  results.invalidated = dedup(results.invalidated);
  results.maybe_invalidated = dedup(results.maybe_invalidated);
  results.warnings = dedup(results.warnings);

  return results;
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
  // args[1] is the workflow name (e.g. "new-project" or "phase-op") — dispatched here
  const workflow = args[1];

  // Dispatch sub-workflows
  if (workflow === 'phase-op') {
    return cmdInitPhaseOp(args, cwd);
  }

  const projectRoot = findProjectRoot(cwd);

  const planningDirPath = path.join(projectRoot, '.planning');
  const planningExists = fs.existsSync(planningDirPath);

  // has_codebase_map: .planning/codebase-map.md or .sun/codebase-map.md
  const hasCodebaseMap =
    fs.existsSync(path.join(planningDirPath, 'codebase-map.md')) ||
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
 * init phase-op <phase_number>
 *
 * Returns full context for phase operation workflows.
 * Returns: {
 *   commit_docs, phase_found, phase_dir, phase_number, phase_name, phase_slug,
 *   padded_phase, has_research, has_context, has_plans, has_verification,
 *   plan_count, roadmap_exists, planning_exists
 * }
 */
function cmdInitPhaseOp(args, cwd) {
  const phaseArg = args[2];
  if (!phaseArg) return fail('init phase-op requires a phase number');

  const projectRoot = findProjectRoot(cwd);
  const config = loadConfig(projectRoot);
  const planningDirPath = planningDir(projectRoot);

  // Find phase directory
  let phaseInfo = findPhaseDir(projectRoot, phaseArg);

  // Fallback to ROADMAP.md if no directory found
  if (!phaseInfo) {
    const roadmapPhase = findPhaseInRoadmap(projectRoot, phaseArg);
    if (roadmapPhase) {
      phaseInfo = {
        found: true,
        directory: null,
        phase_number: phaseArg,
        phase_name: roadmapPhase.phase_name,
        phase_slug: roadmapPhase.phase_slug,
        padded_phase: padPhase(phaseArg),
      };
    }
  }

  // Inspect artifacts if we have a directory
  let artifacts = {
    has_research: false,
    has_context: false,
    has_verification: false,
    has_plans: false,
    plan_count: 0,
  };

  if (phaseInfo && phaseInfo.directory) {
    const inspected = inspectPhaseDir(projectRoot, phaseInfo.directory);
    artifacts = {
      has_research: inspected.has_research,
      has_context: inspected.has_context,
      has_verification: inspected.has_verification,
      has_plans: inspected.has_plans,
      plan_count: inspected.plan_count,
    };
  }

  const result = {
    // Config
    commit_docs: config.commit_docs !== undefined ? config.commit_docs : true,
    model_profile: config.model_profile || 'quality',

    // Phase info
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo ? phaseInfo.directory : null,
    phase_number: phaseInfo ? phaseInfo.phase_number : phaseArg,
    phase_name: phaseInfo ? phaseInfo.phase_name : null,
    phase_slug: phaseInfo ? phaseInfo.phase_slug : null,
    padded_phase: padPhase(phaseArg),

    // Artifact flags
    has_research: artifacts.has_research,
    has_context: artifacts.has_context,
    has_plans: artifacts.has_plans,
    has_verification: artifacts.has_verification,
    plan_count: artifacts.plan_count,

    // File existence
    roadmap_exists: fs.existsSync(path.join(planningDirPath, 'ROADMAP.md')),
    planning_exists: fs.existsSync(planningDirPath),

    // Root
    project_root: projectRoot,
  };

  out(result);
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

/**
 * config-get <key>
 *
 * Read a dot-path key from .planning/config.json.
 * Returns: { key: "...", value: ... }
 */
function cmdConfigGet(args, cwd) {
  const key = args[1];
  if (!key) return fail('config-get requires a key argument (e.g. workflow.research)');

  const projectRoot = findProjectRoot(cwd);
  const config = loadConfig(projectRoot);

  const value = getNestedValue(config, key);
  if (value === undefined) {
    out({ key, value: null, found: false });
  } else {
    out({ key, value, found: true });
  }
}

/**
 * config-set <key> <value>
 *
 * Write a dot-path key to .planning/config.json.
 * Returns: { updated: true, key: "...", value: ... }
 */
function cmdConfigSet(args, cwd) {
  const key = args[1];
  const rawValue = args[2];

  if (!key) return fail('config-set requires a key argument');
  if (rawValue === undefined) return fail('config-set requires a value argument');

  const projectRoot = findProjectRoot(cwd);
  const configPath = path.join(projectRoot, '.planning', 'config.json');
  const config = loadConfig(projectRoot);

  const value = parseConfigValue(rawValue);
  setNestedValue(config, key, value);

  try {
    writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
    out({ updated: true, key, value });
  } catch (e) {
    fail(`config-set: write failed — ${e.message}`);
  }
}

/**
 * todo add <text>
 *
 * Adds a new todo item to .planning/todos/pending/.
 * Returns: { added: true, id: N, file: "..." }
 */
function cmdTodoAdd(args, cwd) {
  const text = args[2];
  if (!text) return fail('todo add requires a text argument');

  const projectRoot = findProjectRoot(cwd);
  const id = nextTodoId(projectRoot);
  const ts = new Date().toISOString();
  const paddedId = String(id).padStart(3, '0');
  const slug = slugify(text).slice(0, 40) || 'todo';
  const filename = `${paddedId}-${slug}.md`;
  const pendingPath = path.join(todoPendingDir(projectRoot), filename);

  const content = [
    `# ${text}`,
    '',
    `**Area**: general`,
    `**Created**: ${ts}`,
    '',
  ].join('\n');

  try {
    writeFile(pendingPath, content);
    out({
      added: true,
      id,
      file: path.join('.planning', 'todos', 'pending', filename),
    });
  } catch (e) {
    fail(`todo add: write failed — ${e.message}`);
  }
}

/**
 * todo list [--area <area>]
 *
 * Lists pending todos, optionally filtered by area.
 * Returns: { count: N, todos: [...] }
 */
function cmdTodoList(args, cwd) {
  const flags = parseNamedArgs(args, ['area']);
  const filterArea = flags.area || null;

  const projectRoot = findProjectRoot(cwd);
  const pendingPath = todoPendingDir(projectRoot);
  const files = listDir(pendingPath).filter((f) => f.endsWith('.md')).sort();

  const todos = [];
  for (const filename of files) {
    const filePath = path.join(pendingPath, filename);
    const content = readFile(filePath);
    if (!content) continue;

    const parsed = parseTodoFile(content, filename);
    if (filterArea && parsed.area !== filterArea) continue;

    todos.push({
      id: parsed.id,
      title: parsed.title,
      area: parsed.area,
      created: parsed.created,
      file: path.join('.planning', 'todos', 'pending', filename),
    });
  }

  out({ count: todos.length, todos });
}

/**
 * todo done <id_or_filename>
 *
 * Marks a todo as completed by moving it from pending/ to completed/.
 * Returns: { completed: true, file: "..." }
 */
function cmdTodoDone(args, cwd) {
  const idOrFile = args[2];
  if (!idOrFile) return fail('todo done requires an id or filename argument');

  const projectRoot = findProjectRoot(cwd);
  const pendingPath = todoPendingDir(projectRoot);
  const completedPath = todoCompletedDir(projectRoot);

  const files = listDir(pendingPath).filter((f) => f.endsWith('.md')).sort();

  let targetFile = null;

  // Check if it's a numeric ID
  const numericId = parseInt(idOrFile, 10);
  if (!isNaN(numericId)) {
    const paddedId = String(numericId).padStart(3, '0');
    targetFile = files.find((f) => f.startsWith(paddedId + '-') || f.startsWith(paddedId + '.'));
  }

  // Or match by filename substring
  if (!targetFile) {
    targetFile = files.find((f) => f === idOrFile || f.includes(idOrFile));
  }

  if (!targetFile) {
    return fail(`todo done: no pending todo found matching "${idOrFile}"`);
  }

  const srcPath = path.join(pendingPath, targetFile);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const destFilename = targetFile.replace('.md', `-done-${ts}.md`);
  const destPath = path.join(completedPath, destFilename);

  try {
    mkdirp(completedPath);
    const content = readFile(srcPath) || '';
    writeFile(destPath, content + `\n**Completed**: ${new Date().toISOString()}\n`);
    fs.unlinkSync(srcPath);
    out({
      completed: true,
      file: path.join('.planning', 'todos', 'completed', destFilename),
    });
  } catch (e) {
    fail(`todo done: failed — ${e.message}`);
  }
}

/**
 * todo match-phase <phase_number>
 *
 * Matches pending todos against a phase's goal/name/requirements.
 * Returns: { todo_count: N, matches: [...] }
 */
function cmdTodoMatchPhase(args, cwd) {
  const phaseArg = args[2];
  if (!phaseArg) return fail('todo match-phase requires a phase number');

  const projectRoot = findProjectRoot(cwd);
  const phaseInfo = findPhaseDir(projectRoot, phaseArg);
  const roadmapPhase = findPhaseInRoadmap(projectRoot, phaseArg);

  // Build phase text corpus to match against
  const phaseText = [
    phaseInfo ? phaseInfo.phase_name : '',
    roadmapPhase ? roadmapPhase.phase_name : '',
  ].join(' ').toLowerCase();

  // Extract keywords from phase text (words >= 4 chars)
  const phaseKeywords = new Set(
    phaseText.split(/\W+/).filter((w) => w.length >= 4)
  );

  // Load pending todos
  const pendingPath = todoPendingDir(projectRoot);
  const files = listDir(pendingPath).filter((f) => f.endsWith('.md')).sort();

  const todos = [];
  for (const filename of files) {
    const content = readFile(path.join(pendingPath, filename));
    if (!content) continue;
    todos.push({
      filename,
      ...parseTodoFile(content, filename),
    });
  }

  if (todos.length === 0) {
    out({ phase: phaseArg, matches: [], todo_count: 0 });
    return;
  }

  // Score each todo for relevance
  const matches = [];
  for (const todo of todos) {
    const todoWords = `${todo.title} ${todo.body}`.toLowerCase().split(/\W+/).filter((w) => w.length >= 4);
    const matchedKeywords = todoWords.filter((w) => phaseKeywords.has(w));
    const score = matchedKeywords.length;

    if (score > 0 || phaseKeywords.size === 0) {
      matches.push({
        id: todo.id,
        title: todo.title,
        area: todo.area,
        score,
        matched_keywords: matchedKeywords,
        file: path.join('.planning', 'todos', 'pending', todo.filename),
      });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  out({ phase: phaseArg, matches, todo_count: todos.length });
}

/**
 * resolve-model <agent-role>
 *
 * Resolves the model for an agent role based on the project's model_profile config.
 * Returns: { agent: "...", profile: "...", model: "..." }
 */
function cmdResolveModel(args, cwd) {
  const agentRole = args[1];
  if (!agentRole) return fail('resolve-model requires an agent role argument');

  const projectRoot = findProjectRoot(cwd);
  const config = loadConfig(projectRoot);
  const profile = config.model_profile || 'quality';

  const model = resolveModel(agentRole, profile);

  out({ agent: agentRole, profile, model });
}

/**
 * agent-skills <agent-role>
 *
 * Returns skill injection text for an agent role.
 * Reads from config.agent_skills.<agent-role> if set, otherwise returns defaults.
 * Returns: { agent: "...", skills: "..." }
 */
function cmdAgentSkills(args, cwd) {
  const agentRole = args[1];
  if (!agentRole) return fail('agent-skills requires an agent role argument');

  const projectRoot = findProjectRoot(cwd);
  const config = loadConfig(projectRoot);

  // Check for custom skills in config
  const customSkills = config.agent_skills && config.agent_skills[agentRole];
  if (customSkills) {
    out({ agent: agentRole, skills: customSkills, source: 'config' });
    return;
  }

  // Default skill sets per agent role
  const defaultSkills = {
    'sunco-executor': [
      'Always write tests alongside implementation code.',
      'Prefer deterministic operations over LLM calls where possible.',
      'Use TypeScript strict mode. Never use any type.',
      'Follow ESM import conventions: .js extension in imports for .ts files.',
      'Commit each plan atomically with a descriptive commit message.',
    ].join('\n'),

    'sunco-planner': [
      'Think through requirements carefully before generating plans.',
      'Decompose work into discrete, independently testable units.',
      'Flag ambiguities as assumptions with [ASSUME] prefix.',
      'Prefer 3-5 focused plans over many small plans.',
    ].join('\n'),

    'sunco-verifier': [
      'Check both happy path and error path behaviors.',
      'Verify that all acceptance criteria from the plan are addressed.',
      'Report findings with severity: critical, high, medium, low.',
      'Never mark verification as PASS if critical issues remain.',
    ].join('\n'),

    'sunco-debugger': [
      'Start with reproduction — confirm you can trigger the bug.',
      'Narrow scope before suggesting fixes.',
      'Document root cause, not just symptoms.',
      'Verify fix does not introduce regressions.',
    ].join('\n'),

    'sunco-researcher': [
      'Prioritize official documentation and source code over blog posts.',
      'Note package versions and compatibility constraints explicitly.',
      'Flag if a solution requires paid services or non-standard infrastructure.',
    ].join('\n'),
  };

  // Alias lookup
  const normalizedRole = AGENT_ALIASES[agentRole] || agentRole;
  const skills = defaultSkills[normalizedRole] || defaultSkills[agentRole] || '';

  out({ agent: agentRole, skills, source: skills ? 'default' : 'none' });
}

/**
 * begin-phase <phase_number>
 *
 * Marks a phase as started in STATE.md (sets status to 'executing').
 * Returns: { started: true, phase: N }
 */
function cmdBeginPhase(args, cwd) {
  const phaseArg = args[1];
  if (!phaseArg) return fail('begin-phase requires a phase number');

  const projectRoot = findProjectRoot(cwd);
  const statePath = path.join(projectRoot, STATE_PATH_RELATIVE);
  const ts = new Date().toISOString();
  const existing = readFile(statePath);

  if (!existing) {
    const content = buildInitialStateContent({
      phase: phaseArg,
      status: 'executing',
      next: `Execute phase ${phaseArg}`,
      timestamp: ts,
    });
    try {
      writeFile(statePath, content);
      out({ started: true, phase: phaseArg });
    } catch (e) {
      fail(`begin-phase: write failed — ${e.message}`);
    }
    return;
  }

  // Patch frontmatter status if present, else patch markdown body
  let patched = existing;
  if (/^status\s*:/m.test(existing)) {
    patched = patchFrontmatterField(existing, 'status', 'executing');
    patched = patchFrontmatterField(patched, 'last_updated', `"${ts}"`);
  } else {
    patched = patchStateContent(existing, {
      status: 'executing',
      last_updated: ts,
    });
  }

  try {
    writeFile(statePath, patched);
    out({ started: true, phase: phaseArg });
  } catch (e) {
    fail(`begin-phase: write failed — ${e.message}`);
  }
}

/**
 * complete-phase <phase_number>
 *
 * Marks a phase as completed in STATE.md.
 * Returns: { completed: true, phase: N }
 */
function cmdCompletePhase(args, cwd) {
  const phaseArg = args[1];
  if (!phaseArg) return fail('complete-phase requires a phase number');

  const projectRoot = findProjectRoot(cwd);
  const statePath = path.join(projectRoot, STATE_PATH_RELATIVE);
  const ts = new Date().toISOString();
  const existing = readFile(statePath);

  if (!existing) {
    const content = buildInitialStateContent({
      phase: phaseArg,
      status: 'complete',
      next: `Begin next phase`,
      timestamp: ts,
    });
    try {
      writeFile(statePath, content);
      out({ completed: true, phase: phaseArg });
    } catch (e) {
      fail(`complete-phase: write failed — ${e.message}`);
    }
    return;
  }

  let patched = existing;
  if (/^status\s*:/m.test(existing)) {
    patched = patchFrontmatterField(existing, 'status', 'complete');
    patched = patchFrontmatterField(patched, 'last_updated', `"${ts}"`);
  } else {
    patched = patchStateContent(existing, {
      status: 'complete',
      last_updated: ts,
    });
  }

  try {
    writeFile(statePath, patched);
    out({ completed: true, phase: phaseArg });
  } catch (e) {
    fail(`complete-phase: write failed — ${e.message}`);
  }
}

/**
 * checkpoint read <phase>
 *
 * Reads checkpoint data for a phase from .planning/phases/<phase>/.checkpoint.json.
 * Returns: { phase: N, wave: N, data: {...} }
 */
function cmdCheckpointRead(args, cwd) {
  const phase = args[2];
  if (!phase) return fail('checkpoint read requires a phase number');

  const projectRoot = findProjectRoot(cwd);

  // Try phase directory first
  const phaseInfo = findPhaseDir(projectRoot, phase);
  let cpPath = null;

  if (phaseInfo && phaseInfo.directory) {
    cpPath = path.join(projectRoot, phaseInfo.directory, '.checkpoint.json');
  } else {
    // Fallback: padded phase directory
    const padded = padPhase(phase);
    cpPath = path.join(projectRoot, '.planning', 'phases', padded, '.checkpoint.json');
  }

  const raw = readFile(cpPath);
  if (!raw) {
    out({ phase, wave: 0, data: {}, found: false });
    return;
  }

  try {
    const data = JSON.parse(raw);
    out({ phase, wave: data.wave || 0, data, found: true });
  } catch (e) {
    fail(`checkpoint read: malformed JSON — ${e.message}`);
  }
}

/**
 * checkpoint write <phase> <wave> '<json>'
 *
 * Writes checkpoint data for a phase.
 * Returns: { written: true, phase: N, wave: N }
 */
function cmdCheckpointWrite(args, cwd) {
  const phase = args[2];
  const wave = args[3];
  const rawJson = args[4];

  if (!phase) return fail('checkpoint write requires a phase number');
  if (!wave) return fail('checkpoint write requires a wave number');
  if (!rawJson) return fail('checkpoint write requires a JSON data argument');

  let data;
  try {
    data = JSON.parse(rawJson);
  } catch (e) {
    return fail(`checkpoint write: invalid JSON — ${e.message}`);
  }

  const projectRoot = findProjectRoot(cwd);
  const phaseInfo = findPhaseDir(projectRoot, phase);

  let cpDir;
  if (phaseInfo && phaseInfo.directory) {
    cpDir = path.join(projectRoot, phaseInfo.directory);
  } else {
    const padded = padPhase(phase);
    cpDir = path.join(projectRoot, '.planning', 'phases', padded);
  }

  const cpPath = path.join(cpDir, '.checkpoint.json');

  const payload = {
    phase,
    wave: parseInt(wave, 10) || 0,
    updated_at: new Date().toISOString(),
    ...data,
  };

  try {
    writeFile(cpPath, JSON.stringify(payload, null, 2) + '\n');
    out({ written: true, phase, wave: payload.wave });
  } catch (e) {
    fail(`checkpoint write: write failed — ${e.message}`);
  }
}

// ─── Artifact Hash Commands ──────────────────────────────────────────────────

/**
 * artifact-hash compute
 *
 * Hash all .planning/ artifacts and store in .planning/.hashes.json.
 * Returns: { computed: true, count: N, path: ".planning/.hashes.json" }
 */
function cmdArtifactHashCompute(args, cwd) {
  const projectRoot = findProjectRoot(cwd);
  const artifacts = collectArtifacts(projectRoot);
  const hashes = {};

  for (const a of artifacts) {
    const h = fileHash(a.absolute);
    if (h) hashes[a.relative] = h;
  }

  const hp = hashesPath(projectRoot);
  writeFile(hp, JSON.stringify(hashes, null, 2) + '\n');
  out({ computed: true, count: Object.keys(hashes).length, path: '.planning/.hashes.json' });
}

/**
 * artifact-hash check
 *
 * Compare stored hashes against current file hashes.
 * Returns: { changed: bool, artifacts: [{ file, old_hash, new_hash }] }
 */
function cmdArtifactHashCheck(args, cwd) {
  const projectRoot = findProjectRoot(cwd);
  const hp = hashesPath(projectRoot);
  const storedRaw = readFile(hp);

  if (!storedRaw) {
    // No stored hashes — first run, compute and return no changes
    out({ changed: false, artifacts: [], message: 'No stored hashes found. Run artifact-hash compute first.' });
    return;
  }

  let stored;
  try { stored = JSON.parse(storedRaw); } catch { return fail('Malformed .hashes.json'); }

  const currentArtifacts = collectArtifacts(projectRoot);
  const currentHashes = {};
  for (const a of currentArtifacts) {
    const h = fileHash(a.absolute);
    if (h) currentHashes[a.relative] = h;
  }

  const changes = [];

  // Check for modified or deleted files
  for (const [file, oldHash] of Object.entries(stored)) {
    const newHash = currentHashes[file] || null;
    if (newHash !== oldHash) {
      changes.push({ file, old_hash: oldHash, new_hash: newHash, status: newHash ? 'modified' : 'deleted' });
    }
  }

  // Check for new files
  for (const [file, newHash] of Object.entries(currentHashes)) {
    if (!stored[file]) {
      changes.push({ file, old_hash: null, new_hash: newHash, status: 'added' });
    }
  }

  out({ changed: changes.length > 0, artifacts: changes });
}

// ─── Rollback Point Commands ─────────────────────────────────────────────────

/**
 * rollback-point create --label <label>
 *
 * Creates a rollback point: hashes snapshot + git tag + manifest file.
 * Returns: { created: true, label, tag, manifest }
 */
function cmdRollbackPointCreate(args, cwd) {
  const { label } = parseNamedArgs(args, ['label']);
  if (!label) return fail('rollback-point create requires --label <label>');

  const projectRoot = findProjectRoot(cwd);
  const artifacts = collectArtifacts(projectRoot);
  const hashes = {};
  const artifactPaths = [];

  for (const a of artifacts) {
    const h = fileHash(a.absolute);
    if (h) {
      hashes[a.relative] = h;
      artifactPaths.push(a.relative);
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '-');
  const tagName = `sunco/rollback/${timestamp}-${safeLabel}`;

  // Store manifest
  const manifest = {
    label,
    tag: tagName,
    timestamp: new Date().toISOString(),
    artifacts: artifactPaths,
    hashes,
  };

  const rbDir = rollbackDir(projectRoot);
  const manifestPath = path.join(rbDir, `${timestamp}-${safeLabel}.json`);
  writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  // Also update the main hashes file
  const hp = hashesPath(projectRoot);
  writeFile(hp, JSON.stringify(hashes, null, 2) + '\n');

  // Create git tag (if in a git repo)
  try {
    git(`add .planning/`, cwd);
    try { git(`commit -m "chore(sunco): rollback point — ${label}" --allow-empty`, cwd); } catch { /* no changes is ok */ }
    git(`tag "${tagName}"`, cwd);
  } catch (e) {
    // Git operations are best-effort — manifest is the primary record
    manifest.git_error = e.message;
  }

  out({ created: true, label, tag: tagName, manifest: path.relative(projectRoot, manifestPath) });
}

/**
 * rollback-point list
 *
 * List all rollback points with labels and timestamps.
 * Returns: { count: N, points: [{ label, tag, timestamp, manifest }] }
 */
function cmdRollbackPointList(args, cwd) {
  const projectRoot = findProjectRoot(cwd);
  const rbDir = rollbackDir(projectRoot);
  const files = listDir(rbDir).filter((f) => f.endsWith('.json')).sort();

  const points = [];
  for (const f of files) {
    const raw = readFile(path.join(rbDir, f));
    if (!raw) continue;
    try {
      const m = JSON.parse(raw);
      points.push({
        label: m.label,
        tag: m.tag,
        timestamp: m.timestamp,
        artifact_count: (m.artifacts || []).length,
        manifest: f,
      });
    } catch { /* skip malformed */ }
  }

  out({ count: points.length, points });
}

/**
 * rollback-point restore --label <label>
 *
 * Restore .planning/ artifacts to the state at a rollback point.
 * Does NOT touch code files — only .planning/ artifacts.
 * Returns: { restored: true, label, restored_files: N }
 */
function cmdRollbackPointRestore(args, cwd) {
  const { label } = parseNamedArgs(args, ['label']);
  if (!label) return fail('rollback-point restore requires --label <label>');

  const projectRoot = findProjectRoot(cwd);
  const rbDir = rollbackDir(projectRoot);

  // Find the manifest matching the label
  const files = listDir(rbDir).filter((f) => f.endsWith('.json')).sort().reverse();
  let manifest = null;
  for (const f of files) {
    const raw = readFile(path.join(rbDir, f));
    if (!raw) continue;
    try {
      const m = JSON.parse(raw);
      if (m.label === label) { manifest = m; break; }
    } catch { /* skip */ }
  }

  if (!manifest) return fail(`No rollback point found with label: ${label}`);

  let restoredCount = 0;

  // Try git-based restore first (more reliable)
  if (manifest.tag) {
    try {
      for (const artifact of manifest.artifacts) {
        try {
          git(`checkout "${manifest.tag}" -- "${artifact}"`, cwd);
          restoredCount++;
        } catch {
          // File may not exist in that tag — skip
        }
      }
    } catch {
      return fail(`Git restore failed for tag ${manifest.tag}`);
    }
  }

  // Update STATE.md to reflect rollback
  const statePath = path.join(projectRoot, STATE_PATH_RELATIVE);
  const stateContent = readFile(statePath);
  if (stateContent) {
    const updated = patchStateContent(stateContent, {
      'Last Action': `Rollback to "${label}" at ${new Date().toISOString()}`,
      'last_updated': new Date().toISOString(),
    });
    writeFile(statePath, updated);
  }

  // Re-compute and store hashes after restore
  const artifacts = collectArtifacts(projectRoot);
  const newHashes = {};
  for (const a of artifacts) {
    const h = fileHash(a.absolute);
    if (h) newHashes[a.relative] = h;
  }
  writeFile(hashesPath(projectRoot), JSON.stringify(newHashes, null, 2) + '\n');

  out({ restored: true, label, tag: manifest.tag, restored_files: restoredCount });
}

/**
 * rollback-point prune --older-than <days>d
 *
 * Delete rollback manifests and tags older than N days.
 * Returns: { pruned: N, remaining: N }
 */
function cmdRollbackPointPrune(args, cwd) {
  const { 'older-than': olderThan } = parseNamedArgs(args, ['older-than']);
  if (!olderThan) return fail('rollback-point prune requires --older-than <N>d');

  const daysMatch = olderThan.match(/^(\d+)d$/);
  if (!daysMatch) return fail('--older-than format: <N>d (e.g. 30d)');

  const days = parseInt(daysMatch[1], 10);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const projectRoot = findProjectRoot(cwd);
  const rbDir = rollbackDir(projectRoot);
  const files = listDir(rbDir).filter((f) => f.endsWith('.json'));

  let pruned = 0;
  for (const f of files) {
    const raw = readFile(path.join(rbDir, f));
    if (!raw) continue;
    try {
      const m = JSON.parse(raw);
      const ts = new Date(m.timestamp);
      if (ts < cutoff) {
        // Remove manifest
        fs.unlinkSync(path.join(rbDir, f));
        // Try to remove git tag
        if (m.tag) {
          try { git(`tag -d "${m.tag}"`, cwd); } catch { /* tag may not exist */ }
        }
        pruned++;
      }
    } catch { /* skip malformed */ }
  }

  const remaining = listDir(rbDir).filter((f) => f.endsWith('.json')).length;
  out({ pruned, remaining });
}

// ─── Impact Analysis Command ─────────────────────────────────────────────────

/**
 * impact-analysis --changed <file1> [file2 ...]
 *
 * Compute the invalidation cascade for changed artifacts.
 * Returns: { invalidated: [...], maybe_invalidated: [...], warnings: [...] }
 */
function cmdImpactAnalysis(args, cwd) {
  const changedFiles = parseListArg(args, 'changed');
  if (changedFiles.length === 0) return fail('impact-analysis requires --changed <file> [file2 ...]');

  const projectRoot = findProjectRoot(cwd);
  const results = computeImpactCascade(projectRoot, changedFiles);

  out({
    changed_files: changedFiles,
    ...results,
    total_affected: results.invalidated.length + results.maybe_invalidated.length + results.warnings.length,
  });
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
        'Commands: commit, config-new-project, config-get, config-set, ' +
        'init, init phase-op, state-update, transition, ' +
        'todo add, todo list, todo done, todo match-phase, ' +
        'resolve-model, agent-skills, begin-phase, complete-phase, ' +
        'checkpoint read, checkpoint write, ' +
        'artifact-hash compute, artifact-hash check, ' +
        'rollback-point create, rollback-point list, rollback-point restore, rollback-point prune, ' +
        'impact-analysis'
    );
  }

  switch (command) {
    case 'commit':
      cmdCommit(args, cwd);
      break;

    case 'config-new-project':
      cmdConfigNewProject(args, cwd);
      break;

    case 'config-get':
      cmdConfigGet(args, cwd);
      break;

    case 'config-set':
      cmdConfigSet(args, cwd);
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

    case 'resolve-model':
      cmdResolveModel(args, cwd);
      break;

    case 'agent-skills':
      cmdAgentSkills(args, cwd);
      break;

    case 'begin-phase':
      cmdBeginPhase(args, cwd);
      break;

    case 'complete-phase':
      cmdCompletePhase(args, cwd);
      break;

    case 'todo': {
      const subcommand = args[1];
      switch (subcommand) {
        case 'add':
          cmdTodoAdd(args, cwd);
          break;
        case 'list':
          cmdTodoList(args, cwd);
          break;
        case 'done':
          cmdTodoDone(args, cwd);
          break;
        case 'match-phase':
          cmdTodoMatchPhase(args, cwd);
          break;
        default:
          fail(
            `Unknown todo subcommand: ${subcommand}. ` +
              'Valid subcommands: add, list, done, match-phase'
          );
      }
      break;
    }

    case 'checkpoint': {
      const subcommand = args[1];
      switch (subcommand) {
        case 'read':
          cmdCheckpointRead(args, cwd);
          break;
        case 'write':
          cmdCheckpointWrite(args, cwd);
          break;
        default:
          fail(
            `Unknown checkpoint subcommand: ${subcommand}. ` +
              'Valid subcommands: read, write'
          );
      }
      break;
    }

    case 'artifact-hash': {
      const subcommand = args[1];
      switch (subcommand) {
        case 'compute':
          cmdArtifactHashCompute(args, cwd);
          break;
        case 'check':
          cmdArtifactHashCheck(args, cwd);
          break;
        default:
          fail(
            `Unknown artifact-hash subcommand: ${subcommand}. ` +
              'Valid subcommands: compute, check'
          );
      }
      break;
    }

    case 'rollback-point': {
      const subcommand = args[1];
      switch (subcommand) {
        case 'create':
          cmdRollbackPointCreate(args, cwd);
          break;
        case 'list':
          cmdRollbackPointList(args, cwd);
          break;
        case 'restore':
          cmdRollbackPointRestore(args, cwd);
          break;
        case 'prune':
          cmdRollbackPointPrune(args, cwd);
          break;
        default:
          fail(
            `Unknown rollback-point subcommand: ${subcommand}. ` +
              'Valid subcommands: create, list, restore, prune'
          );
      }
      break;
    }

    case 'impact-analysis':
      cmdImpactAnalysis(args, cwd);
      break;

    case 'runtimes': {
      const registry = require('./runtime-registry.cjs');
      const sub = args[0];
      if (sub === 'installed') {
        const installed = registry.findAllInstalled(os.homedir());
        out({ installed });
      } else if (sub === 'current-version') {
        const found = registry.findInstalledVersion(os.homedir());
        out(found || { version: 'unknown', runtimeId: null, dir: null });
      } else if (sub === 'list') {
        out({ runtimes: registry.RUNTIMES });
      } else {
        // Default: return everything
        const installed = registry.findAllInstalled(os.homedir());
        const found = registry.findInstalledVersion(os.homedir());
        out({
          runtimes: registry.RUNTIMES,
          supported_ids: registry.SUPPORTED_RUNTIME_IDS,
          current: found || { version: 'unknown' },
          installed,
        });
      }
      break;
    }

    default:
      fail(
        `Unknown command: ${command}. Valid commands: ` +
          'commit, config-new-project, config-get, config-set, ' +
          'init, state-update, transition, ' +
          'todo, resolve-model, agent-skills, begin-phase, complete-phase, checkpoint, ' +
          'artifact-hash, rollback-point, impact-analysis, runtimes'
      );
  }
}

main().catch((e) => {
  // Final safety net — should never reach here since all paths return JSON
  out({ error: `Unhandled error: ${e.message}` });
  process.exit(0);
});

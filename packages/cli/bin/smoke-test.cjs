#!/usr/bin/env node
'use strict';

/**
 * SUNCO Install Smoke Test
 *
 * Validates that the installed SUNCO runtime is functional.
 * Run after `npx popcoru` to verify the install worked.
 *
 * Usage: node smoke-test.cjs [--runtime claude|codex|cursor|antigravity] [--home <dir>]
 *
 * Checks:
 *   1. Install tree completeness (cli.js, sunco-tools.cjs, package.json, VERSION)
 *   2. ESM resolution (package.json has type:module)
 *   3. sunco-tools.cjs execution (runs `init --help`)
 *   4. Hook files present
 *   5. Command/skill files present
 *   6. Agent files present
 *   7. Workflow files present
 *   8. Path consistency (no hardcoded wrong paths in installed files)
 *   9. Product contract reference present
 *
 * Exit codes: 0 = all pass, 1 = failures found
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

// Parse args
const args = process.argv.slice(2);
let runtime = 'claude';
let homeDir = os.homedir();
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--runtime' && args[i + 1]) runtime = args[++i];
  if (args[i] === '--home' && args[i + 1]) homeDir = args[++i];
}

const { RUNTIME_DIRS } = require('./runtime-registry.cjs');

const runtimeDir = RUNTIME_DIRS[runtime] || '.claude';
const targetDir = path.join(homeDir, runtimeDir);
const suncoDir = path.join(targetDir, 'sunco');
const binDir = path.join(suncoDir, 'bin');

let passed = 0;
let failed = 0;
let warnings = 0;

function check(name, condition, detail) {
  if (condition) {
    console.log(`  ${GREEN}PASS${RESET} ${name}`);
    passed++;
  } else {
    console.log(`  ${RED}FAIL${RESET} ${name}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

function warn(name, detail) {
  console.log(`  ${YELLOW}WARN${RESET} ${name}${detail ? ` — ${detail}` : ''}`);
  warnings++;
}

console.log(`\n${BOLD}SUNCO Smoke Test${RESET} — runtime: ${runtime} (${DIM}${targetDir}${RESET})\n`);

// 1. Install tree completeness
console.log(`${BOLD}1. Install Tree${RESET}`);
check('sunco/ directory exists', fs.existsSync(suncoDir));
check('bin/cli.js exists', fs.existsSync(path.join(binDir, 'cli.js')));
check('bin/sunco-tools.cjs exists', fs.existsSync(path.join(binDir, 'sunco-tools.cjs')));
check('bin/package.json exists', fs.existsSync(path.join(binDir, 'package.json')));
check('VERSION file exists', fs.existsSync(path.join(suncoDir, 'VERSION')));

// 2. ESM resolution
console.log(`\n${BOLD}2. ESM Resolution${RESET}`);
const pkgJsonPath = path.join(binDir, 'package.json');
if (fs.existsSync(pkgJsonPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    check('package.json has type:module', pkg.type === 'module');
  } catch {
    check('package.json is valid JSON', false, 'parse error');
  }
} else {
  check('package.json exists for ESM', false, 'missing');
}

// 3. sunco-tools.cjs execution
console.log(`\n${BOLD}3. sunco-tools.cjs Execution${RESET}`);
const toolsPath = path.join(binDir, 'sunco-tools.cjs');
if (fs.existsSync(toolsPath)) {
  try {
    const output = execSync(`node "${toolsPath}" --help 2>&1`, {
      encoding: 'utf8',
      timeout: 5000,
    });
    check('sunco-tools.cjs runs without error', output.length > 0);
  } catch (err) {
    // Some error output is OK (--help might exit non-zero)
    check('sunco-tools.cjs is executable', err.stdout && err.stdout.length > 0, err.message);
  }
} else {
  check('sunco-tools.cjs execution', false, 'file missing');
}

// 3b. cli.js ESM execution (actual Node.js import test)
console.log(`\n${BOLD}3b. cli.js ESM Execution${RESET}`);
const cliJsPath = path.join(binDir, 'cli.js');
if (fs.existsSync(cliJsPath)) {
  try {
    // Test that cli.js can be loaded by Node without immediate crash
    // Use --help which should exit quickly, or timeout after 5s
    const output = execSync(`node "${cliJsPath}" --help 2>&1`, {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });
    check('cli.js --help runs without SyntaxError', !output.includes('SyntaxError'));
  } catch (err) {
    const out = (err.stdout || '') + (err.stderr || '');
    const hasSyntaxError = out.includes('SyntaxError') || out.includes('Cannot use import');
    check('cli.js ESM resolution works', !hasSyntaxError, hasSyntaxError ? 'ESM SyntaxError detected' : err.message);
  }
} else {
  check('cli.js exists', false, 'missing');
}

// 4. Hook files
console.log(`\n${BOLD}4. Hook Files${RESET}`);
const hooksDir = path.join(targetDir, 'hooks');
const expectedHooks = [
  'sunco-check-update.cjs',
  'sunco-statusline.cjs',
  'sunco-context-monitor.cjs',
  'sunco-prompt-guard.cjs',
  'sunco-mode-router.cjs',
  'sunco-advisor-ambient.cjs',
  'sunco-advisor-postaction.cjs',
];
for (const hook of expectedHooks) {
  check(`hooks/${hook}`, fs.existsSync(path.join(hooksDir, hook)));
}

// 5. Commands/Skills
console.log(`\n${BOLD}5. Commands${RESET}`);
if (runtime === 'codex') {
  const skillsDir = path.join(targetDir, 'skills');
  const hasSkills = fs.existsSync(skillsDir);
  check('skills/ directory exists (Codex)', hasSkills);
  if (hasSkills) {
    const skillDirs = fs.readdirSync(skillsDir).filter(f => f.startsWith('sunco-'));
    check(`Codex skills count >= 50`, skillDirs.length >= 50, `found ${skillDirs.length}`);
    if (skillDirs.length > 0) {
      const sampleSkill = path.join(skillsDir, skillDirs[0], 'SKILL.md');
      check(`Sample SKILL.md exists`, fs.existsSync(sampleSkill));
    }
  }
} else if (runtime === 'cursor') {
  const skillsDir = path.join(targetDir, 'skills-cursor');
  const hasSkills = fs.existsSync(skillsDir);
  check('skills-cursor/ has SUNCO skills (Cursor)', hasSkills);
  if (hasSkills) {
    const skillDirs = fs.readdirSync(skillsDir).filter(f => f.startsWith('sunco-'));
    check(`Cursor skills count >= 50`, skillDirs.length >= 50, `found ${skillDirs.length}`);
    if (skillDirs.length > 0) {
      const sampleSkill = path.join(skillsDir, skillDirs[0], 'SKILL.md');
      check(`Sample SKILL.md exists`, fs.existsSync(sampleSkill));
      // Verify no double-quote issue
      if (fs.existsSync(sampleSkill)) {
        const content = fs.readFileSync(sampleSkill, 'utf8');
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (fmMatch) {
          check('SKILL.md frontmatter has no double-quotes', !fmMatch[1].includes('""'));
        }
      }
    }
  }
} else {
  const cmdsDir = path.join(targetDir, 'commands', 'sunco');
  const hasCmds = fs.existsSync(cmdsDir);
  check('commands/sunco/ directory exists', hasCmds);
  if (hasCmds) {
    const cmdFiles = fs.readdirSync(cmdsDir).filter(f => f.endsWith('.md'));
    check(`Command count >= 70`, cmdFiles.length >= 70, `found ${cmdFiles.length}`);
  }
}

// 6. Agent files
console.log(`\n${BOLD}6. Agent Files${RESET}`);
const agentsDir = path.join(suncoDir, 'agents');
check('sunco/agents/ directory exists', fs.existsSync(agentsDir));
if (fs.existsSync(agentsDir)) {
  const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
  check(`Agent files >= 5`, agentFiles.length >= 5, `found ${agentFiles.length}`);
}

// 7. Workflow files
console.log(`\n${BOLD}7. Workflow Files${RESET}`);
const wfDir = path.join(suncoDir, 'workflows');
check('sunco/workflows/ directory exists', fs.existsSync(wfDir));
if (fs.existsSync(wfDir)) {
  const wfFiles = fs.readdirSync(wfDir).filter(f => f.endsWith('.md'));
  check(`Workflow count >= 20`, wfFiles.length >= 20, `found ${wfFiles.length}`);
}

// 8. Path consistency
console.log(`\n${BOLD}8. Path Consistency${RESET}`);
// Full path consistency check (ALL workflows, commands, agents — not a sample)
const allDirsToCheck = [
  { dir: wfDir, label: 'workflows' },
  { dir: path.join(targetDir, 'commands', 'sunco'), label: 'commands' },
  { dir: path.join(suncoDir, 'agents'), label: 'agents' },
];
let totalWrongPaths = 0;
let totalFilesChecked = 0;
for (const { dir: checkDir, label } of allDirsToCheck) {
  if (!fs.existsSync(checkDir)) continue;
  const files = fs.readdirSync(checkDir).filter(f => f.endsWith('.md'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(checkDir, f), 'utf8');
    totalFilesChecked++;
    if (runtime !== 'claude' && content.includes('.claude/')) totalWrongPaths++;
    if (content.includes('$(npm root -g)/sunco/')) totalWrongPaths++;
    if (content.includes('$HOME/.sunco/bin/')) totalWrongPaths++;
  }
}
check(`No wrong-runtime paths (${totalFilesChecked} files checked)`, totalWrongPaths === 0, `${totalWrongPaths} bad paths`);

// Runtime registration check (Claude: settings.json hooks)
if (runtime === 'claude') {
  const settingsPath = path.join(targetDir, 'settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const hooks = settings.hooks || {};
      const hasSessionStart = (hooks.SessionStart || []).some(h =>
        (h.command && h.command.includes('sunco-')) ||
        (h.hooks && h.hooks.some(inner => inner.command && inner.command.includes('sunco-')))
      );
      check('Claude settings.json has SUNCO SessionStart hook', hasSessionStart);
      check('Claude settings.json has statusLine', !!(settings.statusLine && settings.statusLine.command && settings.statusLine.command.includes('sunco-')));
    } catch { check('settings.json parse', false, 'parse error'); }
  } else {
    warn('settings.json not found (first install may not have it)');
  }
}

// 9. Product contract
console.log(`\n${BOLD}9. Product Contract${RESET}`);
const contractPath = path.join(suncoDir, 'references', 'product-contract.md');
check('product-contract.md present', fs.existsSync(contractPath));

// 10. Project-start chain: office-hours -> brainstorming -> new
console.log(`\n${BOLD}10. Project-Start Chain${RESET}`);
const vendoredSkillPath = path.join(
  suncoDir, 'references', 'superpowers', 'brainstorming', 'SKILL.md'
);
check('vendored Superpowers brainstorming SKILL.md present', fs.existsSync(vendoredSkillPath));
if (fs.existsSync(vendoredSkillPath)) {
  const content = fs.readFileSync(vendoredSkillPath, 'utf8');
  check('vendored SKILL.md preserves HARD-GATE', content.includes('<HARD-GATE>'));
  check('vendored SKILL.md wires SUNCO handoff', content.includes('/sunco:new --from-preflight'));
}
const brainstormingWfPath = path.join(suncoDir, 'workflows', 'brainstorming.md');
check('brainstorming workflow installed', fs.existsSync(brainstormingWfPath));
if (fs.existsSync(brainstormingWfPath)) {
  const wf = fs.readFileSync(brainstormingWfPath, 'utf8');
  // Runtime path replacement should have rewritten .claude/ references for non-Claude runtimes.
  const hasVendorRef = wf.includes(`${runtimeDir}/sunco/references/superpowers/brainstorming/SKILL.md`);
  check(`brainstorming workflow references vendored source for ${runtime}`, hasVendorRef);
}
const officeHoursWfPath = path.join(suncoDir, 'workflows', 'office-hours.md');
check('office-hours workflow installed', fs.existsSync(officeHoursWfPath));
if (fs.existsSync(officeHoursWfPath)) {
  const wf = fs.readFileSync(officeHoursWfPath, 'utf8');
  check('office-hours chains into /sunco:brainstorming', wf.includes('/sunco:brainstorming'));
}

// Command presence differs by runtime surface (commands/ vs skills/ vs skills-cursor/)
let chainCmdPresent = true;
const chainNames = ['office-hours', 'brainstorming', 'new'];
if (runtime === 'codex') {
  for (const n of chainNames) {
    const f = path.join(targetDir, 'skills', `sunco-${n}`, 'SKILL.md');
    if (!fs.existsSync(f)) chainCmdPresent = false;
  }
} else if (runtime === 'cursor') {
  for (const n of chainNames) {
    const f = path.join(targetDir, 'skills-cursor', `sunco-${n}`, 'SKILL.md');
    if (!fs.existsSync(f)) chainCmdPresent = false;
  }
} else {
  for (const n of chainNames) {
    const f = path.join(targetDir, 'commands', 'sunco', `${n}.md`);
    if (!fs.existsSync(f)) chainCmdPresent = false;
  }
}
check(`project-start chain commands installed (${runtime})`, chainCmdPresent);

// 11. UI Phase Router (Phase 36/M1.2) — source-dir validation
console.log(`\n${BOLD}11. UI Phase Router (source)${RESET}`);
// Source-dir (not installed-dir) by design: Phase 36 does not mutate the installed runtime.
// Gate 1 axis #6 — runtime install mutation is explicit, user-driven only.
const sourceWfDir = path.resolve(__dirname, '..', 'workflows');
if (!fs.existsSync(sourceWfDir)) {
  warn('source workflows/ dir not found at ../workflows — skipping router checks');
} else {
  const routerPath = path.join(sourceWfDir, 'ui-phase.md');
  const cliBranchPath = path.join(sourceWfDir, 'ui-phase-cli.md');
  const webStubPath = path.join(sourceWfDir, 'ui-phase-web.md');
  const nativeStubPath = path.join(sourceWfDir, 'ui-phase-native.md');

  check('source ui-phase.md (router) exists', fs.existsSync(routerPath));
  check('source ui-phase-cli.md (cli branch) exists', fs.existsSync(cliBranchPath));
  check('source ui-phase-web.md (stub) exists', fs.existsSync(webStubPath));
  check('source ui-phase-native.md (stub) exists', fs.existsSync(nativeStubPath));

  if (fs.existsSync(routerPath)) {
    const r = fs.readFileSync(routerPath, 'utf8');
    check('router declares Surface Dispatcher', r.includes('Surface Dispatcher'));
    check('router documents --surface cli|web|native', r.includes('cli|web|native'));
    check('router defaults SURFACE to cli', /`cli`|default:\s*`cli`/i.test(r));
    check('router enforces explicit-only (no auto-routing)', /no auto-routing/i.test(r));
    check('router handles invalid --surface with usage error', r.includes('Invalid --surface value'));
    check('router sanity pre-check is warning-only', /warning only|warning-only|non-blocking/i.test(r));
  }

  if (fs.existsSync(cliBranchPath)) {
    const c = fs.readFileSync(cliBranchPath, 'utf8');
    check('cli branch does NOT re-parse --surface (vestigial row removed)',
      !c.includes('| `--surface <name>` | `SURFACE` | auto-detect |'));
    check('cli branch self-identifies as CLI surface branch', /CLI surface branch/i.test(c));
  }

  if (fs.existsSync(webStubPath)) {
    const w = fs.readFileSync(webStubPath, 'utf8');
    check('web stub marks Phase 40/M2.3 pending',
      /Phase 40.*M2\.3/i.test(w) && /pending/i.test(w));
  }

  if (fs.existsSync(nativeStubPath)) {
    const n = fs.readFileSync(nativeStubPath, 'utf8');
    check('native stub marks v1 unsupported', /not supported in v1/i.test(n));
    check('native stub references v2 candidate', /v2 candidate/i.test(n));
  }
}

// Summary
console.log(`\n${'─'.repeat(50)}`);
console.log(`  ${GREEN}${passed} passed${RESET}, ${failed > 0 ? RED : ''}${failed} failed${RESET}, ${warnings > 0 ? YELLOW : ''}${warnings} warnings${RESET}`);
console.log(`${'─'.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);

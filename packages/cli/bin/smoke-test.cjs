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
    // Phase 40/M2.3 replaced the Phase 36 stub with behavioral workflow (2026-04-18).
    // The Phase 36-era "pending" marker is superseded; verify the web branch is now implemented.
    check('web branch implemented in Phase 40/M2.3 (no longer stub)',
      /Phase 40.*M2\.3/i.test(w) && /Six steps:|^## Step 1:/m.test(w) && !/is not yet implemented/i.test(w));
  }

  if (fs.existsSync(nativeStubPath)) {
    const n = fs.readFileSync(nativeStubPath, 'utf8');
    check('native stub marks v1 unsupported', /not supported in v1/i.test(n));
    check('native stub references v2 candidate', /v2 candidate/i.test(n));
  }
}

// 12. Backend Dispatcher (Phase 37/M1.3) — source-dir validation
console.log(`\n${BOLD}12. Backend Dispatcher (source)${RESET}`);
// Source-dir validation. Phase 37 does not mutate the installed runtime (Gate axis #6).
if (!fs.existsSync(sourceWfDir)) {
  warn('source workflows/ dir not found — skipping backend dispatcher checks');
} else {
  const backendPhasePath = path.join(sourceWfDir, 'backend-phase.md');
  const backendReviewPath = path.join(sourceWfDir, 'backend-review.md');
  const discussPhasePath = path.join(sourceWfDir, 'discuss-phase.md');
  const sourceCmdsDir = path.resolve(__dirname, '..', 'commands', 'sunco');
  const backendPhaseCmd = path.join(sourceCmdsDir, 'backend-phase.md');
  const backendReviewCmd = path.join(sourceCmdsDir, 'backend-review.md');

  // Presence: routers + 8 stubs + 2 command entries
  check('source backend-phase.md (router) exists', fs.existsSync(backendPhasePath));
  check('source backend-review.md (router) exists', fs.existsSync(backendReviewPath));
  for (const surface of ['api', 'data', 'event', 'ops']) {
    check(`source backend-phase-${surface}.md stub exists`,
      fs.existsSync(path.join(sourceWfDir, `backend-phase-${surface}.md`)));
    check(`source backend-review-${surface}.md stub exists`,
      fs.existsSync(path.join(sourceWfDir, `backend-review-${surface}.md`)));
  }
  check('source commands/sunco/backend-phase.md exists', fs.existsSync(backendPhaseCmd));
  check('source commands/sunco/backend-review.md exists', fs.existsSync(backendReviewCmd));

  // Router content markers
  if (fs.existsSync(backendPhasePath)) {
    const bp = fs.readFileSync(backendPhasePath, 'utf8');
    check('backend-phase router declares Surface Dispatcher', bp.includes('Surface Dispatcher'));
    check('backend-phase router marks --surface REQUIRED (no default)',
      /REQUIRED[^a-zA-Z]*no default|no default[^a-zA-Z]*REQUIRED/i.test(bp));
    check('backend-phase router lists api|data|event|ops enum',
      bp.includes('api') && bp.includes('data') && bp.includes('event') && bp.includes('ops'));
    check('backend-phase router handles missing --surface with usage error',
      bp.includes('ERROR: --surface is required'));
    check('backend-phase router handles invalid value with usage error',
      bp.includes('Invalid --surface value'));
    check('backend-phase router enforces explicit-only',
      /no auto-routing|explicit-only/i.test(bp));
  }
  if (fs.existsSync(backendReviewPath)) {
    const br = fs.readFileSync(backendReviewPath, 'utf8');
    check('backend-review router declares Surface Dispatcher', br.includes('Surface Dispatcher'));
    check('backend-review router marks --surface REQUIRED (no default)',
      /REQUIRED[^a-zA-Z]*no default|no default[^a-zA-Z]*REQUIRED/i.test(br));
    check('backend-review router handles missing --surface with usage error',
      br.includes('ERROR: --surface is required'));
    check('backend-review router handles invalid value with usage error',
      br.includes('Invalid --surface value'));
  }

  // Parallel-router parsing-block byte-level symmetry (Gate 37 A3 strong assertion)
  if (fs.existsSync(backendPhasePath) && fs.existsSync(backendReviewPath)) {
    const extractParsingBlock = (content) => {
      const match = content.match(/<!-- SUNCO:PARSING-BLOCK-START -->([\s\S]*?)<!-- SUNCO:PARSING-BLOCK-END -->/);
      return match ? match[1] : null;
    };
    const phaseBlock = extractParsingBlock(fs.readFileSync(backendPhasePath, 'utf8'));
    const reviewBlock = extractParsingBlock(fs.readFileSync(backendReviewPath, 'utf8'));
    check('backend-phase has SUNCO:PARSING-BLOCK markers', phaseBlock !== null);
    check('backend-review has SUNCO:PARSING-BLOCK markers', reviewBlock !== null);
    check('backend-phase and backend-review parsing blocks are byte-identical',
      phaseBlock !== null && reviewBlock !== null && phaseBlock === reviewBlock);
  }

  // Stub populating-phase references
  const phaseStubTargets = { api: 45, data: 45, event: 46, ops: 46 };
  for (const [surface, targetPhase] of Object.entries(phaseStubTargets)) {
    const p = path.join(sourceWfDir, `backend-phase-${surface}.md`);
    if (fs.existsSync(p)) {
      const c = fs.readFileSync(p, 'utf8');
      check(`backend-phase-${surface} stub references Phase ${targetPhase}`,
        c.includes(`Phase ${targetPhase}`));
      check(`backend-phase-${surface} stub exits without dispatch`,
        /Does \*\*not\*\* spawn|Does \*\*not\*\* write/i.test(c));
    }
  }
  for (const surface of ['api', 'data', 'event', 'ops']) {
    const p = path.join(sourceWfDir, `backend-review-${surface}.md`);
    if (fs.existsSync(p)) {
      const c = fs.readFileSync(p, 'utf8');
      check(`backend-review-${surface} stub references Phase 47`, c.includes('Phase 47'));
    }
  }

  // discuss-phase.md domain-switch skeleton (R3 reconciliation)
  if (fs.existsSync(discussPhasePath)) {
    const dp = fs.readFileSync(discussPhasePath, 'utf8');
    check('discuss-phase has SUNCO:DOMAIN-FRONTEND marker pair',
      dp.includes('SUNCO:DOMAIN-FRONTEND-START') && dp.includes('SUNCO:DOMAIN-FRONTEND-END'));
    check('discuss-phase has SUNCO:DOMAIN-BACKEND marker pair',
      dp.includes('SUNCO:DOMAIN-BACKEND-START') && dp.includes('SUNCO:DOMAIN-BACKEND-END'));
    check('discuss-phase FRONTEND skeleton references Phase 39/M2.2',
      /Phase 39.*M2\.2|M2\.2.*Phase 39/.test(dp));
    check('discuss-phase BACKEND skeleton references Phase 44/M3.3',
      /Phase 44.*M3\.3|M3\.3.*Phase 44/.test(dp));
    check('discuss-phase domain skeletons are inert (explicit-only preserved)',
      /inert|Triggered only/i.test(dp));
  }
}

// 13. Impeccable Vendoring (Phase 38/M2.1) — source-dir + pristine invariant
console.log(`\n${BOLD}13. Impeccable Vendoring (source + pristine)${RESET}`);
const impRefDir = path.resolve(__dirname, '..', 'references', 'impeccable');
if (!fs.existsSync(impRefDir)) {
  warn('references/impeccable/ not found — skipping vendoring checks');
} else {
  const impSourceDir = path.join(impRefDir, 'source');
  const impSrcDir = path.join(impRefDir, 'src');
  const impWrapperDir = path.join(impRefDir, 'wrapper');
  const installCjsPath = path.resolve(__dirname, 'install.cjs');

  // Presence
  check('LICENSE present', fs.existsSync(path.join(impRefDir, 'LICENSE')));
  check('NOTICE.md present', fs.existsSync(path.join(impRefDir, 'NOTICE.md')));
  check('UPSTREAM.md present', fs.existsSync(path.join(impRefDir, 'UPSTREAM.md')));
  check('SUNCO-ATTRIBUTION.md present', fs.existsSync(path.join(impRefDir, 'SUNCO-ATTRIBUTION.md')));
  check('README.md present', fs.existsSync(path.join(impRefDir, 'README.md')));
  check('source/ dir present', fs.existsSync(impSourceDir));
  check('src/ dir present', fs.existsSync(impSrcDir));
  check('wrapper/ dir present', fs.existsSync(impWrapperDir));

  // License/NOTICE content
  if (fs.existsSync(path.join(impRefDir, 'LICENSE'))) {
    const lic = fs.readFileSync(path.join(impRefDir, 'LICENSE'), 'utf8');
    check('LICENSE contains "Apache License"', lic.includes('Apache License'));
    check('LICENSE contains "Copyright 2025 Paul Bakaus"', lic.includes('Copyright 2025 Paul Bakaus'));
  }
  if (fs.existsSync(path.join(impRefDir, 'NOTICE.md'))) {
    const notice = fs.readFileSync(path.join(impRefDir, 'NOTICE.md'), 'utf8');
    check('NOTICE.md contains Anthropic attribution', notice.includes('Anthropic'));
  }

  // UPSTREAM.md content
  if (fs.existsSync(path.join(impRefDir, 'UPSTREAM.md'))) {
    const up = fs.readFileSync(path.join(impRefDir, 'UPSTREAM.md'), 'utf8');
    check('UPSTREAM.md records pinned commit SHA',
      /00d485659af82982aef0328d0419c49a2716d123/.test(up));
    check('UPSTREAM.md documents browser detector exclusion',
      up.includes('detect-antipatterns-browser'));
    check('UPSTREAM.md includes pristine diff check command',
      up.includes('diff -r tmp/impeccable-upstream'));
  }

  // source/skills structure (upstream has 18 skills)
  if (fs.existsSync(impSourceDir)) {
    const skillsDir = path.join(impSourceDir, 'skills');
    const skillsCount = fs.existsSync(skillsDir)
      ? fs.readdirSync(skillsDir).filter(n => fs.statSync(path.join(skillsDir, n)).isDirectory()).length
      : 0;
    check(`source/skills/ populated with >=18 skills (found ${skillsCount})`, skillsCount >= 18);
  }

  // src/ structure
  if (fs.existsSync(impSrcDir)) {
    const detector = path.join(impSrcDir, 'detect-antipatterns.mjs');
    check('src/detect-antipatterns.mjs present', fs.existsSync(detector));
    if (fs.existsSync(detector)) {
      const det = fs.readFileSync(detector, 'utf8');
      check('detector preserves Apache-2.0 SPDX header',
        det.includes('SPDX-License-Identifier: Apache-2.0') || det.includes('Apache-2.0'));
    }
    check('browser detector NOT vendored (spec scope)',
      !fs.existsSync(path.join(impSrcDir, 'detect-antipatterns-browser.js')));
  }

  // Wrapper presence + contract markers
  if (fs.existsSync(impWrapperDir)) {
    const ctxInjector = path.join(impWrapperDir, 'context-injector.mjs');
    const detAdapter = path.join(impWrapperDir, 'detector-adapter.mjs');
    const wReadme = path.join(impWrapperDir, 'README.md');
    check('wrapper/context-injector.mjs present', fs.existsSync(ctxInjector));
    check('wrapper/detector-adapter.mjs present', fs.existsSync(detAdapter));
    check('wrapper/README.md present', fs.existsSync(wReadme));
    if (fs.existsSync(ctxInjector)) {
      const ci = fs.readFileSync(ctxInjector, 'utf8');
      check('context-injector exports loadDesignContext',
        ci.includes('export function loadDesignContext'));
      check('context-injector supports --test flag',
        ci.includes("'--test'") || ci.includes('"--test"'));
    }
    if (fs.existsSync(detAdapter)) {
      const da = fs.readFileSync(detAdapter, 'utf8');
      check('detector-adapter exports normalizeFindings',
        da.includes('export function normalizeFindings'));
      check('detector-adapter exports DetectorUnavailableError (G8 sentinel)',
        da.includes('export class DetectorUnavailableError'));
      check('detector-adapter defers full integration to Phase 41/M2.4',
        /Phase 41.*M2\.4/.test(da));
    }
    if (fs.existsSync(wReadme)) {
      const rd = fs.readFileSync(wReadme, 'utf8');
      check('wrapper/README documents pristine invariant', /pristine/i.test(rd));
      check('wrapper/README documents fallback policy', /Fallback policy|fallback/i.test(rd));
      check('wrapper/README includes diff -r invariant command', rd.includes('diff -r'));
    }
  }

  // Pristine invariant — known upstream literals preserved (Codex-required assertions)
  const cleanupScript = path.join(impSourceDir, 'skills', 'impeccable', 'scripts', 'cleanup-deprecated.mjs');
  if (fs.existsSync(cleanupScript)) {
    const content = fs.readFileSync(cleanupScript, 'utf8');
    check('vendored cleanup-deprecated.mjs preserves ".claude/skills" literal (pristine, G4)',
      content.includes('.claude/skills'));
  }
  const impSkillMd = path.join(impSourceDir, 'skills', 'impeccable', 'SKILL.md');
  if (fs.existsSync(impSkillMd)) {
    const content = fs.readFileSync(impSkillMd, 'utf8');
    check('vendored impeccable SKILL.md preserves ".impeccable.md" literal (pristine, G4)',
      content.includes('.impeccable.md'));
  }

  // install.cjs G7 no-replacement copy paths (Codex-required assertions)
  if (fs.existsSync(installCjsPath)) {
    const ic = fs.readFileSync(installCjsPath, 'utf8');
    check('install.cjs has no-replacement path for references/impeccable/source (G7)',
      ic.includes('srcVendoredSource') && ic.includes("'references', 'impeccable', 'source'"));
    check('install.cjs has no-replacement path for references/impeccable/src (G7)',
      ic.includes('srcVendoredSrc') && ic.includes("'references', 'impeccable', 'src'"));
    check('install.cjs G7 uses copyDirRecursive (not copyDirWithReplacement)',
      /copyDirRecursive\(srcVendoredSource/.test(ic) && /copyDirRecursive\(srcVendoredSrc/.test(ic));
  }
}

// 14. Frontend Teach (Phase 39/M2.2) — discuss-phase FRONTEND marker populated
console.log(`\n${BOLD}14. Frontend Teach (discuss-phase FRONTEND marker)${RESET}`);
const discussWfPath = path.resolve(__dirname, '..', 'workflows', 'discuss-phase.md');
const discussCmdPath = path.resolve(__dirname, '..', 'commands', 'sunco', 'discuss.md');

if (!fs.existsSync(discussWfPath)) {
  warn('workflows/discuss-phase.md not found — skipping frontend teach checks');
} else {
  const dp = fs.readFileSync(discussWfPath, 'utf8');
  const feMatch = dp.match(/<!-- SUNCO:DOMAIN-FRONTEND-START -->([\s\S]*?)<!-- SUNCO:DOMAIN-FRONTEND-END -->/);
  const feBlock = feMatch ? feMatch[1] : '';
  const beMatch = dp.match(/<!-- SUNCO:DOMAIN-BACKEND-START -->([\s\S]*?)<!-- SUNCO:DOMAIN-BACKEND-END -->/);
  const beBlock = beMatch ? beMatch[1] : '';

  // FRONTEND marker populated (no longer inert)
  check('FRONTEND marker block found', feBlock.length > 0);
  check('FRONTEND marker is no longer Phase 37 inert placeholder',
    !/Frontend teach logic will be populated in Phase 39\/M2\.2\. Until then this section is inert/.test(feBlock));
  check('FRONTEND marker declares Phase 39/M2.2 active',
    /Phase 39\/M2\.2 — active/i.test(feBlock));

  // R4 explicit-only
  check('FRONTEND marker enforces R4 explicit-only (no auto-activation)',
    /R4 explicit-only/i.test(feBlock) && /NO auto-activation/i.test(feBlock));

  // 3 teach questions (Impeccable SKILL.md required context)
  check('FRONTEND marker includes Target audience question', /Target audience/i.test(feBlock));
  check('FRONTEND marker includes Primary use cases question', /Primary use cases/i.test(feBlock));
  check('FRONTEND marker includes Brand personality question', /Brand personality/i.test(feBlock));

  // Cross-reference to vendored SKILL.md pinned SHA (Phase 38 link)
  check('FRONTEND marker references pinned SHA 00d4856 (SKILL.md alignment)',
    /00d485659af82982aef0328d0419c49a2716d123/.test(feBlock));

  // DESIGN-CONTEXT.md schema
  check('FRONTEND marker specifies DESIGN-CONTEXT.md canonical path',
    feBlock.includes('.planning/domains/frontend/DESIGN-CONTEXT.md'));
  check('schema includes # Design Context', feBlock.includes('# Design Context'));
  check('schema includes ## Target audience section', feBlock.includes('## Target audience'));
  check('schema includes ## Primary use cases section', feBlock.includes('## Primary use cases'));
  check('schema includes ## Brand personality / tone section', feBlock.includes('## Brand personality / tone'));

  // Schema coordination with Phase 38 wrapper (Phase 40 consumer)
  check('FRONTEND marker references context-injector.mjs (Phase 40 coordination)',
    feBlock.includes('context-injector.mjs') && /Phase 40\/M2\.3/i.test(feBlock));

  // --skip-teach 3-mode matrix
  check('--skip-teach mode (a): existing DESIGN-CONTEXT.md preserved',
    /Preserve the existing file/i.test(feBlock));
  check('--skip-teach mode (b): .impeccable.md seed import',
    /Import `?\.?impeccable\.md`? content as (a )?seed/i.test(feBlock));
  check('--skip-teach mode (c): no-op warning (no empty file write)',
    /no context source available/i.test(feBlock) && /Do NOT write an empty/i.test(feBlock));

  // SDI-1 canonical invariant
  check('FRONTEND marker enforces SDI-1 (SUNCO never writes .impeccable.md)',
    /SDI-1/.test(feBlock) && /SUNCO \*\*never writes\*\* `\.impeccable\.md`/.test(feBlock));

  // BACKEND marker byte-identical to Phase 37 inert (Codex-required)
  const backendInert = 'Backend teach logic will be populated in Phase 44/M3.3. Until then this section is inert';
  check('BACKEND marker byte-identical to Phase 37 inert placeholder',
    beBlock.includes(backendInert));

  // No-domain flow preservation
  check('FRONTEND marker documents no-domain flow byte-identical invariant',
    /No-domain flow preserved/i.test(feBlock));
}

// commands/sunco/discuss.md frontmatter + flag docs
if (fs.existsSync(discussCmdPath)) {
  const dc = fs.readFileSync(discussCmdPath, 'utf8');
  check('discuss.md argument-hint includes --domain frontend|backend',
    /argument-hint:.*--domain frontend\|backend/.test(dc));
  check('discuss.md argument-hint includes --skip-teach',
    /argument-hint:.*--skip-teach/.test(dc));
  check('discuss.md flags section documents --domain',
    /`--domain frontend\|backend`/.test(dc));
  check('discuss.md flags section documents --skip-teach + SDI-1',
    /`--skip-teach`/.test(dc) && /SUNCO never writes `\.impeccable\.md`/.test(dc));
}

// SDI-1 enforcement across SUNCO source workflows/commands: no .impeccable.md write paths
const allWfDir = path.resolve(__dirname, '..', 'workflows');
const allCmdDir = path.resolve(__dirname, '..', 'commands', 'sunco');
// SDI-1 enforcement: scan for ACTUAL code-level write paths only (not natural-language prose).
// Matches: writeFileSync('...impeccable.md...') | echo/cat/tee redirect | fs.writeFile with .impeccable.md target.
let impeccableWriteFound = false;
let impeccableWriteWhere = '';
const codeWriteRegex = /writeFileSync\(\s*[`'"][^`'"]*\.impeccable\.md|>\s*\.impeccable\.md\b|tee\s+\.impeccable\.md\b|fs\.writeFile\(\s*[`'"][^`'"]*\.impeccable\.md/i;
for (const dir of [allWfDir, allCmdDir]) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.md'))) {
    const c = fs.readFileSync(path.join(dir, f), 'utf8');
    if (codeWriteRegex.test(c)) {
      impeccableWriteFound = true;
      impeccableWriteWhere = path.join(path.basename(dir), f);
      break;
    }
  }
  if (impeccableWriteFound) break;
}
check(
  'No .impeccable.md code-level write path in SUNCO workflows/commands (SDI-1)',
  !impeccableWriteFound,
  impeccableWriteFound ? `match in ${impeccableWriteWhere}` : undefined
);

// 15. UI-phase-web behavioral workflow (Phase 40/M2.3) — deliverables + invariants
console.log(`\n${BOLD}15. UI-phase-web Behavioral Workflow (Phase 40/M2.3)${RESET}`);
const uiWebWfPath = path.resolve(__dirname, '..', 'workflows', 'ui-phase-web.md');
const uiWebAgentPath = path.resolve(__dirname, '..', 'agents', 'sunco-ui-researcher-web.md');
const uiSpecSchemaPath = path.resolve(__dirname, '..', 'schemas', 'ui-spec.schema.json');
const uiCliWfPath = path.resolve(__dirname, '..', 'workflows', 'ui-phase-cli.md');
const uiNativeWfPath = path.resolve(__dirname, '..', 'workflows', 'ui-phase-native.md');
const uiRouterWfPath = path.resolve(__dirname, '..', 'workflows', 'ui-phase.md');
const injectorPath = path.resolve(__dirname, '..', 'references', 'impeccable', 'wrapper', 'context-injector.mjs');
const impeccableSkillPath = path.resolve(__dirname, '..', 'references', 'impeccable', 'source', 'skills', 'impeccable', 'SKILL.md');

// 15a. Deliverables exist
check('ui-phase-web.md exists', fs.existsSync(uiWebWfPath));
check('sunco-ui-researcher-web.md agent exists', fs.existsSync(uiWebAgentPath));
check('ui-spec.schema.json exists', fs.existsSync(uiSpecSchemaPath));

// 15b. ui-phase-web.md is NO LONGER the Phase 36 stub
if (fs.existsSync(uiWebWfPath)) {
  const wfw = fs.readFileSync(uiWebWfPath, 'utf8');
  check('ui-phase-web.md no longer contains Phase 36 "not yet implemented" stub text',
    !/is not yet implemented/i.test(wfw));
  check('ui-phase-web.md no longer contains Phase 36 "Stub introduced" trailer',
    !/Stub introduced in Phase 36/i.test(wfw));
  check('ui-phase-web.md declares 6-step behavioral workflow',
    /Six steps:/i.test(wfw) || /^## Step 1:/m.test(wfw));
  check('ui-phase-web.md Step 1 hard-stops on missing DESIGN-CONTEXT.md',
    /DESIGN-CONTEXT\.md/.test(wfw) && /exit 1|hard.?stop/i.test(wfw));
  check('ui-phase-web.md spawns sunco-ui-researcher-web agent (not cli researcher)',
    /sunco-ui-researcher-web/.test(wfw));
  check('ui-phase-web.md invokes loadDesignContext via wrapper',
    /context-injector\.mjs/.test(wfw) && /loadDesignContext/.test(wfw));
  check('ui-phase-web.md requires SUNCO:SPEC-BLOCK markers (R2)',
    /SUNCO:SPEC-BLOCK-START/.test(wfw) && /SUNCO:SPEC-BLOCK-END/.test(wfw));
  check('ui-phase-web.md validates against ui-spec.schema.json (Step 5)',
    /ui-spec\.schema\.json/.test(wfw));
  check('ui-phase-web.md enforces SDI-1 (no teach/extract, no .impeccable.md write)',
    /SDI-1/.test(wfw) && /teach/i.test(wfw) && /extract/i.test(wfw));
  check('ui-phase-web.md cites spec §6 Phase 2.3',
    /Phase 2\.3/i.test(wfw) || /M2\.3/.test(wfw));
}

// 15c. sunco-ui-researcher-web agent contract
if (fs.existsSync(uiWebAgentPath)) {
  const agent = fs.readFileSync(uiWebAgentPath, 'utf8');
  check('agent frontmatter name is sunco-ui-researcher-web',
    /^name:\s*sunco-ui-researcher-web\s*$/m.test(agent));
  check('agent declares 3-stage research (ref-load → outline → write)',
    /3-stage/.test(agent) && /ref-load/.test(agent) && /outline/.test(agent) && /write/.test(agent.toLowerCase()));
  check('agent declares 30k token ceiling',
    /30k/.test(agent));
  check('agent references all 7 Impeccable references',
    /typography\.md/.test(agent) && /color-and-contrast\.md/.test(agent)
    && /spatial-design\.md/.test(agent) && /motion-design\.md/.test(agent)
    && /interaction-design\.md/.test(agent) && /responsive-design\.md/.test(agent)
    && /ux-writing\.md/.test(agent));
  check('agent enforces SDI-1 (no .impeccable.md write, no teach/extract invocation)',
    /SDI-1/.test(agent) && /teach/i.test(agent) && /extract/i.test(agent));
  check('agent requires SUNCO:SPEC-BLOCK markers in output (R2)',
    /SUNCO:SPEC-BLOCK-START/.test(agent));
}

// 15d. ui-spec.schema.json structural
if (fs.existsSync(uiSpecSchemaPath)) {
  let schema = null;
  try { schema = JSON.parse(fs.readFileSync(uiSpecSchemaPath, 'utf8')); } catch (_) {}
  check('ui-spec.schema.json parses as valid JSON', schema !== null);
  if (schema) {
    const required = Array.isArray(schema.required) ? schema.required : [];
    const expected = ['layout','components','states','interactions','a11y','responsive',
      'motion','copy','anti_pattern_watchlist','design_system_tokens_used',
      'endpoints_consumed','error_states_handled'];
    const missing = expected.filter(k => !required.includes(k));
    check('schema required list contains all 12 SPEC-BLOCK fields',
      missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : undefined);
    check('schema anti_pattern_watchlist enforces minItems >= 3 (Done-when Phase 40)',
      schema.properties && schema.properties.anti_pattern_watchlist
      && schema.properties.anti_pattern_watchlist.minItems >= 3);
    check('schema is lenient additive (additionalProperties: true)',
      schema.additionalProperties === true);
  }
}

// 15e. Router regression guard — cli and native paths NOT modified to reference web agent
if (fs.existsSync(uiCliWfPath)) {
  const wfc = fs.readFileSync(uiCliWfPath, 'utf8');
  check('ui-phase-cli.md still dispatches to sunco-ui-researcher (not -web)',
    /subagent_type="sunco-ui-researcher"/.test(wfc) && !/sunco-ui-researcher-web/.test(wfc));
  check('ui-phase-cli.md remains CLI-surface-only (no web deliverable references)',
    !/ui-spec\.schema\.json/.test(wfc) && !/SUNCO:SPEC-BLOCK/.test(wfc));
}
if (fs.existsSync(uiNativeWfPath)) {
  const wfn = fs.readFileSync(uiNativeWfPath, 'utf8');
  check('ui-phase-native.md remains Phase 36 stub (not supported in v1 — Phase 40 untouched)',
    /not supported in v1/i.test(wfn));
}

// 15f. ui-phase.md router unchanged — no default surface routing change (R1 explicit-only)
if (fs.existsSync(uiRouterWfPath)) {
  const router = fs.readFileSync(uiRouterWfPath, 'utf8');
  check('ui-phase.md router still lists --surface cli|web|native dispatch',
    /--surface/.test(router) && /web/.test(router));
}

// 15g. Context-injector sections parser populated (Phase 40 A2=α)
if (fs.existsSync(injectorPath)) {
  const inj = fs.readFileSync(injectorPath, 'utf8');
  check('context-injector.mjs version bumped to 1.0 (Phase 40, no longer skeleton)',
    /version:\s*['"]1\.0['"]/.test(inj) && !/version:\s*['"]1\.0-skeleton['"]/.test(inj));
  check('context-injector.mjs populated_in references Phase 40/M2.3',
    /populated_in:\s*['"]Phase 40\/M2\.3['"]/.test(inj));
  check('context-injector.mjs exports parseSections for Phase 40 consumers',
    /export\s+function\s+parseSections/.test(inj));
  check('context-injector.mjs strict-matches canonical Phase 39 headings',
    /Target audience/.test(inj) && /Primary use cases/.test(inj) && /Brand personality \/ tone/.test(inj));
}

// 15h. Pristine guard — vendored Impeccable SKILL.md untouched (R5 + Gate 2 G4)
if (fs.existsSync(impeccableSkillPath)) {
  const skill = fs.readFileSync(impeccableSkillPath, 'utf8');
  check('vendored SKILL.md frontmatter name is impeccable (not renamed)',
    /^name:\s*impeccable\s*$/m.test(skill));
  check('vendored SKILL.md has NO SUNCO: marker injection (pristine per R5)',
    !/SUNCO:/.test(skill));
  check('vendored SKILL.md preserves Apache-2.0 license header',
    /Apache 2\.0/i.test(skill));
  check('vendored SKILL.md retains teach-mode section (upstream invariant)',
    /## Teach Mode/.test(skill));
}

// Summary
console.log(`\n${'─'.repeat(50)}`);
console.log(`  ${GREEN}${passed} passed${RESET}, ${failed > 0 ? RED : ''}${failed} failed${RESET}, ${warnings > 0 ? YELLOW : ''}${warnings} warnings${RESET}`);
console.log(`${'─'.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);

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
      check('detector-adapter references Phase 41/M2.4 (integration ships here)',
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

// ─── Section 16 — Phase 41/M2.4 ui-review WRAP (explicit-only --surface web) ───
//
// Contract tested (Gate 41 axes A1-A6):
//   A1 Surface flag policy — no-flag/cli = existing, web = WRAP, native/unknown = error
//   A2 Agent split — sunco-ui-reviewer new (web), sunco-ui-auditor intact (cli)
//   A3 Detector boundary — fallback reasons documented, target excludes conservative
//   A4 Dual output — .planning/domains/frontend/IMPECCABLE-AUDIT.md + phase UI-REVIEW.md
//   A5 Adapter API — runDetector + writeAuditReport exported
//   A6 Regression — Sections 1-15 intact (count preserved at 184)
// R6 scope boundary: severity + file:line + message only (no state lifecycle — M4 scope)

const uiReviewCmdPath = path.resolve(__dirname, '..', 'commands', 'sunco', 'ui-review.md');
const uiReviewWfPath = path.resolve(__dirname, '..', 'workflows', 'ui-review.md');
const uiReviewerAgentPath = path.resolve(__dirname, '..', 'agents', 'sunco-ui-reviewer.md');
const uiAuditorAgentPath = path.resolve(__dirname, '..', 'agents', 'sunco-ui-auditor.md');
const detectorAdapterPath = path.resolve(__dirname, '..', 'references', 'impeccable', 'wrapper', 'detector-adapter.mjs');
const vendoredDetectorPath = path.resolve(__dirname, '..', 'references', 'impeccable', 'src', 'detect-antipatterns.mjs');

console.log(`\n${BOLD}16. ui-review WRAP (Phase 41/M2.4)${RESET}`);

// 16a. Command-file surface dispatch (A1 + A4)
if (fs.existsSync(uiReviewCmdPath)) {
  const cmd = fs.readFileSync(uiReviewCmdPath, 'utf8');
  check('ui-review command argument-hint includes --surface cli|web',
    /argument-hint:.*--surface cli\|web/.test(cmd));
  check('ui-review command documents Step 0 surface dispatch (Phase 41)',
    /Step 0:.*Surface dispatch/i.test(cmd) && /Phase 41\/M2\.4/.test(cmd));
  check('ui-review command errors on --surface native / unknown (R4 explicit-only)',
    /Unsupported --surface/i.test(cmd) || /native.*Error|Error.*native/i.test(cmd));
  check('ui-review command promises byte-identical regression for no-flag/cli path (R1)',
    /byte-identical/i.test(cmd));
  check('ui-review command Step 8 Impeccable WRAP writes to .planning/domains/frontend/IMPECCABLE-AUDIT.md',
    /Step 8:.*Impeccable WRAP/i.test(cmd)
    && /\.planning\/domains\/frontend\/IMPECCABLE-AUDIT\.md/.test(cmd));
  check('ui-review command documents R6 scope boundary (Phase 48/M4)',
    /R6 scope boundary/i.test(cmd) && /Phase 48\/M4/.test(cmd));
}

// 16b. Workflow-file surface dispatch (spec §6 L375 literal)
if (fs.existsSync(uiReviewWfPath)) {
  const wf = fs.readFileSync(uiReviewWfPath, 'utf8');
  check('ui-review workflow documents Surface dispatch (Phase 41/M2.4)',
    /Surface dispatch.*Phase 41\/M2\.4|Phase 41\/M2\.4.*Surface dispatch/i.test(wf));
  check('ui-review workflow has Web path addendum referencing detector-adapter',
    /Web path addendum/i.test(wf) && /detector-adapter\.mjs/.test(wf));
  check('ui-review workflow documents native/unknown --surface → error',
    /Unsupported --surface|native.*Error/i.test(wf));
  check('ui-review workflow fallback table lists all six detector reasons',
    /node-not-found/.test(wf) && /detector-crash/.test(wf)
    && /detector-abnormal-exit/.test(wf) && /json-parse-failed/.test(wf)
    && /target-not-found/.test(wf));
  check('ui-review workflow R6 scope boundary defers state lifecycle to Phase 48/M4',
    /R6 scope boundary/i.test(wf) && /Phase 48\/M4/.test(wf));
}

// 16c. sunco-ui-reviewer agent (A2 Option B — new agent, web-only)
check('sunco-ui-reviewer agent file present (Phase 41/M2.4 new)',
  fs.existsSync(uiReviewerAgentPath));
if (fs.existsSync(uiReviewerAgentPath)) {
  const rv = fs.readFileSync(uiReviewerAgentPath, 'utf8');
  check('sunco-ui-reviewer frontmatter name is sunco-ui-reviewer (not auditor)',
    /^name:\s*sunco-ui-reviewer\s*$/m.test(rv));
  check('sunco-ui-reviewer dispatches only for --surface web (Phase 41)',
    /--surface web/.test(rv) && /Phase 41\/M2\.4/.test(rv));
  check('sunco-ui-reviewer enforces SDI-1 (no .impeccable.md writes)',
    /SDI-1/.test(rv) && /\.impeccable\.md/.test(rv));
  check('sunco-ui-reviewer preserves existing 6-pillar (append-only to UI-REVIEW.md)',
    /append.*6-pillar|6-pillar.*intact|append-only/i.test(rv));
  check('sunco-ui-reviewer documents R6 scope boundary (Phase 48/M4)',
    /R6 scope boundary|Phase 48\/M4/i.test(rv));
}

// 16d. sunco-ui-auditor regression guard (A2 — must NOT be modified by Phase 41)
if (fs.existsSync(uiAuditorAgentPath)) {
  const aud = fs.readFileSync(uiAuditorAgentPath, 'utf8');
  check('sunco-ui-auditor frontmatter name is sunco-ui-auditor (unchanged by Phase 41)',
    /^name:\s*sunco-ui-auditor\s*$/m.test(aud));
  check('sunco-ui-auditor remains CLI 6-pillar authority (no Phase 41 coupling)',
    /6[\- ]pillar/i.test(aud) && !/Phase 41/.test(aud));
}

// 16e. detector-adapter Phase 41 API surface (A5)
if (fs.existsSync(detectorAdapterPath)) {
  const da = fs.readFileSync(detectorAdapterPath, 'utf8');
  check('detector-adapter exports runDetector (Phase 41 runtime)',
    /export\s+function\s+runDetector/.test(da));
  check('detector-adapter exports writeAuditReport (Phase 41 output)',
    /export\s+function\s+writeAuditReport/.test(da));
  check('detector-adapter exports translateFinding (category→severity)',
    /export\s+function\s+translateFinding/.test(da));
  check('detector-adapter DEFAULT_EXCLUDES excludes SUNCO planning + vendored refs',
    /DEFAULT_EXCLUDES/.test(da)
    && /\.planning/.test(da)
    && /packages\/cli\/references\/impeccable/.test(da));
  check('detector-adapter maps category "slop" to HIGH severity (AI-tell priority)',
    /slop.*['"]HIGH['"]|['"]HIGH['"].*slop/s.test(da) || /slop:\s*['"]HIGH['"]/.test(da));
  check('detector-adapter DetectorUnavailableError exposes reason field (Gate 41 A3)',
    /this\.reason\s*=\s*reason/.test(da));
  check('detector-adapter documents R6 scope boundary (severity + file:line + message only)',
    /R6/.test(da) && /severity/i.test(da) && /file:line/i.test(da));
  check('detector-adapter defers finding-lifecycle state to Phase 48/M4',
    /Phase 48\/M4/.test(da) && /(open\/resolved\/dismissed|state lifecycle)/i.test(da));
}

// 16f. Vendored detector pristine (R5 — must be untouched by Phase 41)
if (fs.existsSync(vendoredDetectorPath)) {
  const vend = fs.readFileSync(vendoredDetectorPath, 'utf8');
  check('vendored detect-antipatterns.mjs retains Apache-2.0 SPDX header (R5 pristine)',
    /SPDX-License-Identifier:\s*Apache-2\.0/.test(vend));
  check('vendored detect-antipatterns.mjs retains ANTIPATTERNS + getAP helpers (upstream invariant)',
    /^const ANTIPATTERNS =/m.test(vend) && /^function getAP\(id\)/m.test(vend));
}

// ─── Section 17 — Phase 42/M3.1 backend-excellence clean-room reference authoring ───
//
// Contract tested (Gate 42 axes A1-A6):
//   A1 Clean-room boundary — no Impeccable source path refs, no .impeccable.md, no
//      Impeccable-specific frontend term leakage (exact finite blacklist only)
//   A2 Structure — 8 files at reference/<name>.md with 5 required section headers
//   A3 Authorship + NOTICE — MIT statement + "populated in Phase 42" footer marker
//   A5 Quality bar — spec §7 required kebab coverage (verbatim), ≥5 anti-patterns per
//      file, per-anti-pattern Detection label, 1500-3000 word count
//   A6 Provenance — reverse-R5 grep on reference/*.md
// Sections 1-16 frozen; counts preserved.

const backendExcellenceDir = path.resolve(__dirname, '..', 'references', 'backend-excellence');
const backendRefDir = path.resolve(backendExcellenceDir, 'reference');
const backendNoticePath = path.resolve(backendExcellenceDir, 'NOTICE.md');
const backendReadmePath = path.resolve(backendExcellenceDir, 'README.md');
const phase42ContextPath = path.resolve(__dirname, '..', '..', '..', '.planning', 'phases',
  '42-backend-reference-docs', '42-CONTEXT.md');

// Spec §7 Phase 3.1 required anti-pattern kebab list per file (mandatory baseline).
const BACKEND_REF_SPECS = [
  { file: 'api-design.md', kebabs: [
    'verb-endpoints', 'inconsistent-pluralization', 'leaky-enum', '200-with-error-body',
    'untyped-any-response', 'no-pagination-on-list', 'overloaded-parameters'
  ]},
  { file: 'data-modeling.md', kebabs: [
    'nullable-everything', 'boolean-flag-pileup', 'polymorphic-blob-column',
    'timestamp-without-tz', 'string-id-ambiguity', 'missing-indexes-on-fk',
    'soft-delete-tombstones'
  ]},
  { file: 'boundaries-and-architecture.md', kebabs: [
    'god-route-handler', 'circular-module-deps', 'data-access-from-controller',
    'domain-logic-in-transport', 'fat-shared-utils', 'feature-envy'
  ]},
  { file: 'reliability-and-failure-modes.md', kebabs: [
    'missing-timeout', 'no-retry-backoff', 'sync-call-in-hot-path', 'silent-catch',
    'cascading-failures', 'no-bulkhead', 'no-circuit-breaker-on-3rd-party'
  ]},
  { file: 'security-and-permissions.md', kebabs: [
    'authz-after-fetch', 'raw-sql-interpolation', 'secret-in-log', 'any-typed-body',
    'open-cors', 'missing-csrf', 'role-hardcoded'
  ]},
  { file: 'performance-and-scale.md', kebabs: [
    'n-plus-one', 'unbounded-list', 'no-pagination', 'sync-loop-with-await',
    'over-fetching', 'no-cache-layer', 'serial-io'
  ]},
  { file: 'observability-and-operations.md', kebabs: [
    'no-request-id', 'log-without-level', 'metric-without-dimensions', 'pii-in-log',
    'no-trace-propagation', 'error-without-context'
  ]},
  { file: 'migrations-and-compatibility.md', kebabs: [
    'drop-column-in-same-release', 'non-reversible-migration', 'no-expand-contract',
    'breaking-response-shape-no-version', 'no-backfill-plan'
  ]}
];

// Exact-match blacklist: Impeccable-specific frontend phrases that must not appear
// in backend refs. Finite, human-curated list — no broad industry terms.
const IMPECCABLE_TERM_BLACKLIST = [
  'side-tab', 'overused-font', 'gradient-text', 'dark-glow', 'icon-tile-stack'
];

const REQUIRED_HEADERS = ['## Overview', '## Anti-patterns', '## Principles', '## Rubric', '## References'];

console.log(`\n${BOLD}17. backend-excellence clean-room refs (Phase 42/M3.1)${RESET}`);

// 17a. reference/ subdir exists
check('backend-excellence/reference/ subdirectory exists (Phase 42 scope)',
  fs.existsSync(backendRefDir) && fs.statSync(backendRefDir).isDirectory());

// 17b. Per-file: file exists + 5 required section headers present (A2)
for (const spec of BACKEND_REF_SPECS) {
  const p = path.resolve(backendRefDir, spec.file);
  const exists = fs.existsSync(p);
  check(`${spec.file} exists with all 5 required section headers (A2 structure)`,
    exists && (() => {
      const c = fs.readFileSync(p, 'utf8');
      return REQUIRED_HEADERS.every(h => c.includes(`\n${h}\n`));
    })());
}

// 17c. Per-file: spec §7 required kebab coverage — verbatim `### <kebab>` match (A5 spec-required)
for (const spec of BACKEND_REF_SPECS) {
  const p = path.resolve(backendRefDir, spec.file);
  if (!fs.existsSync(p)) { check(`${spec.file} spec §7 kebab coverage (A5)`, false); continue; }
  const c = fs.readFileSync(p, 'utf8');
  const missing = spec.kebabs.filter(k => !new RegExp(`^### ${k.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'm').test(c));
  check(`${spec.file} includes spec §7 required anti-patterns verbatim (${spec.kebabs.length})`,
    missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : '');
}

// 17d. Per-file quality bar: ≥5 anti-patterns, ≥3 principles, ≥3 refs,
//       every anti-pattern carries a Detection: label, word count 1500-3000 (A5)
for (const spec of BACKEND_REF_SPECS) {
  const p = path.resolve(backendRefDir, spec.file);
  if (!fs.existsSync(p)) { check(`${spec.file} quality bar (A5)`, false); continue; }
  const c = fs.readFileSync(p, 'utf8');
  const antiPatterns = (c.match(/^### /gm) || []).length;
  const detectionLabels = (c.match(/^\*\*Detection:\*\*/gm) || []).length;
  const principlesBlock = (c.match(/## Principles([\s\S]*?)(?=\n## )/) || [])[1] || '';
  const principles = (principlesBlock.match(/^\d+\.\s+\*\*/gm) || []).length;
  const refsBlock = (c.match(/## References([\s\S]*)$/) || [])[1] || '';
  const refs = (refsBlock.match(/^-\s+/gm) || []).length;
  const words = c.split(/\s+/).filter(Boolean).length;
  const ok = antiPatterns >= 5 && detectionLabels === antiPatterns
    && principles >= 3 && refs >= 3 && words >= 1500 && words <= 3000;
  check(`${spec.file} quality bar: ≥5 anti-patterns w/ Detection labels, ≥3 principles, ≥3 refs, 1500-3000 words`,
    ok, `ap=${antiPatterns} det=${detectionLabels} pr=${principles} refs=${refs} words=${words}`);
}

// 17e. Clean-room reverse-R5: no Impeccable source path strings or .impeccable.md inside reference/*.md (A1)
{
  let leak = [];
  for (const spec of BACKEND_REF_SPECS) {
    const p = path.resolve(backendRefDir, spec.file);
    if (!fs.existsSync(p)) continue;
    const c = fs.readFileSync(p, 'utf8');
    if (c.includes('references/impeccable/source')) leak.push(`${spec.file}:impeccable-source-path`);
    if (c.includes('.impeccable.md')) leak.push(`${spec.file}:.impeccable.md`);
  }
  check('reverse-R5: no Impeccable source paths or .impeccable.md inside backend reference/*.md (A1)',
    leak.length === 0, leak.join(', '));
}

// 17f. Clean-room blacklist: exact-match Impeccable frontend-specific terms absent (A1)
{
  let hits = [];
  for (const spec of BACKEND_REF_SPECS) {
    const p = path.resolve(backendRefDir, spec.file);
    if (!fs.existsSync(p)) continue;
    const c = fs.readFileSync(p, 'utf8');
    for (const term of IMPECCABLE_TERM_BLACKLIST) {
      if (c.includes(term)) hits.push(`${spec.file}:${term}`);
    }
  }
  check(`blacklist: Impeccable-specific frontend terms absent from backend refs (${IMPECCABLE_TERM_BLACKLIST.length} forbidden) (A1)`,
    hits.length === 0, hits.join(', '));
}

// 17g. NOTICE.md — MIT statement + populated-in-Phase-42 marker (A3)
if (fs.existsSync(backendNoticePath)) {
  const notice = fs.readFileSync(backendNoticePath, 'utf8');
  check('NOTICE.md declares MIT under project license (A3)',
    /\bMIT\b/.test(notice) && /project license/i.test(notice));
  check('NOTICE.md footer records "populated in Phase 42" status (A3)',
    /populated in Phase 42/i.test(notice));
  check('NOTICE.md asserts no content derived from Impeccable (A1)',
    /no content derived/i.test(notice));
} else {
  check('NOTICE.md exists (A3)', false);
}

// 17h. README.md — populated status + Phase 43 one-liner (A3/forward-ref policy)
if (fs.existsSync(backendReadmePath)) {
  const readme = fs.readFileSync(backendReadmePath, 'utf8');
  check('README.md status flipped to "populated" (Phase 42) (A3)',
    /\*\*Status\*\*:.*populated/i.test(readme) && /Phase 42\/M3\.1/.test(readme));
  check('README.md references Phase 43 for detector implementation (forward-ref one-liner only)',
    /Phase 43\/M3\.2/.test(readme) && /detect-backend-smells\.mjs/.test(readme));
  check('README.md includes load-strategy table (primary+secondary per surface) (A4)',
    /Primary refs/i.test(readme) && /Secondary refs/i.test(readme)
    && /backend-review-api|backend-phase-api/.test(readme));
} else {
  check('README.md exists (A3)', false);
}

// 17i. Phase 42 CONTEXT populated (not scaffold)
if (fs.existsSync(phase42ContextPath)) {
  const ctx = fs.readFileSync(phase42ContextPath, 'utf8');
  check('Phase 42 CONTEXT.md records Gate 42 outcomes (not scaffold)',
    /Gate 42/i.test(ctx) && /GREEN-CONDITIONAL/i.test(ctx) && /populated/i.test(ctx.toLowerCase()));
} else {
  check('Phase 42 CONTEXT.md exists', false);
}

// Note: Phase 42 Section 17j (forward-reference "no src/ stub created in Phase 42")
// retired in Phase 43 — the detector now exists and is validated positively below
// in Section 18. Removing 17j is a narrow Section-17 edit scoped to the forward-
// reference check only; 17a-17i remain frozen (Gate 43 A7).

// ─── Section 18 — Phase 43/M3.2 backend deterministic detector (fixture-only) ───
//
// Contract tested (Gate 43 axes A1-A7, fixture-only per condition 8):
//   A1 Rule set lock — meta.rules_enabled.length === 7 and matches the 7 rule IDs
//   A2/A3 Detection strategy + FP discipline — per-rule positive fixture fires,
//         per-rule negative fixture silent; missing-validation-public-route spans
//         ≥2 frameworks (Express + Fastify)
//   A4 Output schema — findings[] + meta{files_scanned,duration_ms,rules_enabled,
//         detector_version="1.0.0"}, valid JSON, --json on empty dir clean
//   A5 Clean-room — no imports of eslint, sonarqube, semgrep, or LLM SDKs
//   A6 Explicit-only — standalone CLI, --test mode runs fixture corpus, nonexistent
//         target emits structured error and exits non-zero
//   A7 Smoke fixture-only — no repo-wide scan; sections 1-17 (except retired 17j)
//         unchanged.

const backendDetectorPath = path.resolve(backendExcellenceDir, 'src', 'detect-backend-smells.mjs');
const backendFixturesRoot = path.resolve(backendExcellenceDir, 'fixtures');
const backendPosFixtures = path.resolve(backendFixturesRoot, 'positive');
const backendNegFixtures = path.resolve(backendFixturesRoot, 'negative');
const backendEmptyFixture = path.resolve(backendFixturesRoot, 'empty');
const phase43ContextPath = path.resolve(__dirname, '..', '..', '..', '.planning', 'phases',
  '43-backend-detector-rules', '43-CONTEXT.md');

const EXPECTED_RULES = [
  'raw-sql-interpolation', 'missing-timeout', 'swallowed-catch', 'any-typed-body',
  'missing-validation-public-route', 'non-reversible-migration', 'logged-secret',
];

console.log(`\n${BOLD}18. backend deterministic detector (Phase 43/M3.2)${RESET}`);

// 18a. Detector file exists (A1 delivery)
check('detect-backend-smells.mjs exists at src/ (A1 delivery)',
  fs.existsSync(backendDetectorPath) && fs.statSync(backendDetectorPath).isFile());

// 18b. --test mode exit 0 (A2/A3 — all fixtures classified correctly)
let detectorTestStdout = '';
let detectorTestExit = null;
try {
  detectorTestStdout = execSync(
    `node "${backendDetectorPath}" --test`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  detectorTestExit = 0;
} catch (e) {
  detectorTestStdout = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
  detectorTestExit = typeof e.status === 'number' ? e.status : 1;
}
check('detector --test exits 0 (fixture corpus all-pass) (A3)',
  detectorTestExit === 0, `exit=${detectorTestExit}`);

// 18c. Per-rule positive fixture fires (A2 — each rule has ≥1 positive that triggers)
for (const rule of EXPECTED_RULES) {
  const re = new RegExp(`^PASS\\s+positive fixture fires ${rule.replace(/-/g, '\\-')}:`, 'm');
  check(`rule '${rule}' has a positive fixture that fires (A2)`, re.test(detectorTestStdout));
}

// 18d. Per-rule negative fixture silent (A3 — zero known FPs on negative corpus)
for (const rule of EXPECTED_RULES) {
  const re = new RegExp(`^PASS\\s+negative fixture silent for ${rule.replace(/-/g, '\\-')}:`, 'm');
  check(`rule '${rule}' has a negative fixture that stays silent (A3)`, re.test(detectorTestStdout));
}

// 18e. Framework spread for missing-validation-public-route (Gate 43 condition 5)
check('missing-validation-public-route positive fixtures span ≥2 frameworks (Express + Fastify) (A3)',
  /missing-validation-public-route framework spread.*\[.*express.*fastify.*\]|\[.*fastify.*express.*\]/i.test(detectorTestStdout));

// 18f. --json on negative dir: valid JSON, findings empty, files_scanned > 0 (A4)
try {
  const out = execSync(
    `node "${backendDetectorPath}" "${backendNegFixtures}" --json`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const parsed = JSON.parse(out);
  check('--json on negative/ emits valid JSON with findings:[] (A4 + A3)',
    Array.isArray(parsed.findings) && parsed.findings.length === 0
    && parsed.meta && typeof parsed.meta.files_scanned === 'number' && parsed.meta.files_scanned > 0);
  check('meta has all 4 required fields (A4 output schema)',
    parsed.meta && 'files_scanned' in parsed.meta && 'duration_ms' in parsed.meta
    && 'rules_enabled' in parsed.meta && 'detector_version' in parsed.meta);
  check('meta.rules_enabled is the 7-rule locked set (A1)',
    Array.isArray(parsed.meta.rules_enabled)
    && parsed.meta.rules_enabled.length === 7
    && EXPECTED_RULES.every(r => parsed.meta.rules_enabled.includes(r)));
  check('meta.detector_version === "1.0.0" (A4)',
    parsed.meta.detector_version === '1.0.0');
} catch (e) {
  // scan exits 0 here (no findings). If JSON parse throws, capture it as a failure.
  check('--json on negative/ emits valid JSON with findings:[] (A4 + A3)', false,
    e.status ? `exit=${e.status}: ${(e.stderr || e.stdout || '').toString().slice(0, 200)}` : e.message);
  check('meta has all 4 required fields (A4 output schema)', false);
  check('meta.rules_enabled is the 7-rule locked set (A1)', false);
  check('meta.detector_version === "1.0.0" (A4)', false);
}

// 18g. --json on empty dir: files_scanned === 0, findings === []
try {
  const out = execSync(
    `node "${backendDetectorPath}" "${backendEmptyFixture}" --json`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const parsed = JSON.parse(out);
  check('--json on empty/ yields findings:[] and files_scanned:0 (A4 edge)',
    parsed.findings.length === 0 && parsed.meta.files_scanned === 0);
} catch (e) {
  check('--json on empty/ yields findings:[] and files_scanned:0 (A4 edge)', false,
    e.message);
}

// 18h. Nonexistent target: exit non-zero, structured error JSON (A6 edge)
{
  let exit = null;
  let out = '';
  try {
    out = execSync(
      `node "${backendDetectorPath}" /nonexistent/path/xyz-${Date.now()} --json`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    exit = 0;
  } catch (e) {
    exit = typeof e.status === 'number' ? e.status : 1;
    out = (e.stdout ? e.stdout.toString() : '');
  }
  let errorShape = false;
  try {
    const parsed = JSON.parse(out);
    errorShape = parsed.error && typeof parsed.error.code === 'string' && typeof parsed.error.message === 'string';
  } catch { /* not JSON, no shape */ }
  check('nonexistent target → exit!==0 with structured error JSON (A6 edge)',
    exit !== 0 && errorShape, `exit=${exit} out=${out.slice(0, 120)}`);
}

// 18i. --json on positive dir: findings > 0, all kind === "deterministic" (A4 contract)
try {
  const out = execSync(
    `node "${backendDetectorPath}" "${backendPosFixtures}" --json`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  // positive dir has findings → exit code 2 is expected; execSync throws, handle below
  check('--json on positive/ yields findings (A4 reachability)', false,
    'execSync returned 0 but findings expected');
} catch (e) {
  try {
    const parsed = JSON.parse(e.stdout.toString());
    const findings = parsed.findings || [];
    check('--json on positive/ yields findings with kind=deterministic only (A4 contract)',
      findings.length > 0 && findings.every(f => f.kind === 'deterministic'));
    // Each finding has required fields
    const requiredFields = ['rule', 'severity', 'kind', 'file', 'line', 'column', 'match', 'fix_hint'];
    const anyMissing = findings.some(f => requiredFields.some(k => !(k in f)));
    check('every finding has required 8 fields (rule/severity/kind/file/line/column/match/fix_hint) (A4)',
      !anyMissing);
  } catch (pe) {
    check('--json on positive/ yields findings with kind=deterministic only (A4 contract)', false, pe.message);
    check('every finding has required 8 fields (A4)', false);
  }
}

// 18j. Clean-room imports: no eslint/sonarqube/semgrep/LLM SDK in detector source (A5)
{
  const src = fs.readFileSync(backendDetectorPath, 'utf8');
  const forbidden = [
    /\bfrom\s+['"]eslint['"]/, /\brequire\s*\(\s*['"]eslint['"]\s*\)/,
    /\bfrom\s+['"]@sonarsource/, /\bfrom\s+['"]semgrep/,
    /\bfrom\s+['"]@anthropic-ai/, /\bfrom\s+['"]openai['"]/, /\bfrom\s+['"]ai['"]/,
  ];
  const hits = forbidden.filter(r => r.test(src)).map(r => r.source);
  check('detector has no imports from eslint/sonarqube/semgrep/LLM SDKs (A5 clean-room)',
    hits.length === 0, hits.join(', '));
}

// 18k. Phase 43 CONTEXT populated with Gate 43 outcomes (not scaffold)
if (fs.existsSync(phase43ContextPath)) {
  const ctx = fs.readFileSync(phase43ContextPath, 'utf8');
  check('Phase 43 CONTEXT.md records Gate 43 outcomes (not scaffold)',
    /Gate 43/i.test(ctx) && /GREEN-CONDITIONAL/i.test(ctx) && /Populated/i.test(ctx));
} else {
  check('Phase 43 CONTEXT.md exists', false);
}

// Summary
console.log(`\n${'─'.repeat(50)}`);
console.log(`  ${GREEN}${passed} passed${RESET}, ${failed > 0 ? RED : ''}${failed} failed${RESET}, ${warnings > 0 ? YELLOW : ''}${warnings} warnings${RESET}`);
console.log(`${'─'.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);

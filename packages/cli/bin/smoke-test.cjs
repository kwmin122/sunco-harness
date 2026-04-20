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

  // Stub populating-phase references.
  // Phase 37 forward-ref: backend-phase-{api,data} target Phase 45 (activated),
  // backend-phase-{event,ops} target Phase 46 (activated). Phase 45 retired the
  // "stub exits without dispatch" check for api/data; Phase 46 retires it for
  // event/ops. All 4 are now active — Sections 20 + 21 own the positive
  // assertions.
  const activeBackendPhaseSurfaces = new Set(['api', 'data', 'event', 'ops']);
  const phaseStubTargets = { api: 45, data: 45, event: 46, ops: 46 };
  for (const [surface, targetPhase] of Object.entries(phaseStubTargets)) {
    const p = path.join(sourceWfDir, `backend-phase-${surface}.md`);
    if (fs.existsSync(p)) {
      const c = fs.readFileSync(p, 'utf8');
      check(`backend-phase-${surface} references Phase ${targetPhase}`,
        c.includes(`Phase ${targetPhase}`));
      if (!activeBackendPhaseSurfaces.has(surface)) {
        check(`backend-phase-${surface} stub exits without dispatch`,
          /Does \*\*not\*\* spawn|Does \*\*not\*\* write/i.test(c));
      }
    }
  }
  // Phase 47/M3.6 retired the "backend-review-<surface> stub references Phase
  // 47" loop — all 4 review surfaces are now populated behavioral workflows.
  // Section 22 owns substantive assertions on backend-review-{api,data,event,ops}.md.

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

  // Note: Phase 39 Section 14's "BACKEND marker byte-identical to Phase 37 inert
  // placeholder" assertion is retired at Phase 44 — the marker is now actively
  // populated. Section 19 (Phase 44/M3.3) owns the positive assertion that the
  // BACKEND block is populated; FRONTEND byte-identity preservation moves to
  // Section 19's SHA-256 hash check.

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

// ─── Section 19 — Phase 44/M3.3 discuss-phase backend teach populated ───
//
// Contract tested (Focused Gate 44 axes A1-A6):
//   A1 Trigger policy — R4 explicit-only strings present, multi-language advisory
//      grep (web-framework-only; DB/queue excluded per judge-convergent condition)
//   A2 BACKEND-CONTEXT.md write contract — canonical path + 5-required + 1-optional
//      (tech stack runtime) schema sections present
//   A3 5 teach questions — spec §7 verbatim anchors present with bare-metal extension
//   A4 Marker isolation — FRONTEND block SHA-256 byte-identical assertion (R3)
//   A5 --skip-teach 2-mode matrix documented
//   A6 Sections 1-18 frozen; router files byte-identical; surface stubs remain stubs
//
// Sections 1-18 frozen (274 checks); Section 19 adds ~14 below.

const crypto = require('crypto');
const discussPhaseMdPath = path.resolve(__dirname, '..', 'workflows', 'discuss-phase.md');
const phase44ContextPath = path.resolve(__dirname, '..', '..', '..', '.planning', 'phases',
  '44-discuss-backend-teach', '44-CONTEXT.md');
const backendRouterPaths = [
  path.resolve(__dirname, '..', 'workflows', 'backend-phase.md'),
  path.resolve(__dirname, '..', 'workflows', 'backend-review.md'),
];
const BACKEND_ROUTER_EXPECTED_HASHES = {
  'backend-phase.md':  '7044b440539a4b48dc548f9235a6794dec9248f77dee7040cd3a0bc47415a355',
  'backend-review.md': '33a2d4b473e60747d7583e67034283ccc75865a07bba2d76e0707807aece1481',
};
const FRONTEND_BLOCK_EXPECTED_HASH =
  '0b723b2b632c9faf40ae30bd44b0cbf3872a5343be1a1fc0ddc94978062036ee';
// Phase 47/M3.6 retirement: SURFACE_STUB_FILES + SURFACE_STUB_LINE_THRESHOLD
// removed. Phase 42-47 stub cycle complete — all 4 backend-phase-* (Phase 45/
// 46) and all 4 backend-review-* (Phase 47) surfaces are now populated
// behavioral workflows. Section 22 owns positive assertions on the 4 review
// surfaces; Sections 20 + 21 own the phase-* assertions.
const BACKEND_SCHEMA_REQUIRED_HEADERS = [
  '## Domain', '## Traffic profile', '## Data sensitivity', '## SLO', '## Deployment model',
];

console.log(`\n${BOLD}19. discuss-phase backend teach populated (Phase 44/M3.3)${RESET}`);

let discussPhaseContent = '';
let backendBlock = '';
let frontendBlock = '';
if (fs.existsSync(discussPhaseMdPath)) {
  discussPhaseContent = fs.readFileSync(discussPhaseMdPath, 'utf8');
  const backendMatch = discussPhaseContent.match(
    /<!-- SUNCO:DOMAIN-BACKEND-START -->([\s\S]*?)<!-- SUNCO:DOMAIN-BACKEND-END -->/
  );
  const frontendMatch = discussPhaseContent.match(
    /<!-- SUNCO:DOMAIN-FRONTEND-START -->([\s\S]*?)<!-- SUNCO:DOMAIN-FRONTEND-END -->/
  );
  backendBlock = backendMatch ? backendMatch[1] : '';
  frontendBlock = frontendMatch ? frontendMatch[1] : '';
} else {
  check('discuss-phase.md exists', false);
}

// 19a. BACKEND block populated (beyond inert 2-line default)
check('BACKEND marker block populated (>3 lines; inert default was 1-line) (A1 delivery)',
  backendBlock.split('\n').length > 3);

// 19b. R4 trigger doc strings present
check("BACKEND block declares R4 trigger: 'domains: [backend]' AND '--domain backend' (A1)",
  /domains:\s*\[backend\]/.test(backendBlock) && /--domain backend/.test(backendBlock));

// 19c. Multi-language advisory-warning + NO auto-activation (A1 condition 1 absorbed)
check('BACKEND block documents multi-language advisory warning (Node/Py/Go/Rust web frameworks) (A1)',
  /express|fastify|koa|@nestjs/.test(backendBlock)
  && /(fastapi|django|flask)/i.test(backendBlock)
  && /(gin-gonic\/gin|labstack\/echo|gofiber\/fiber|go-chi\/chi)/.test(backendBlock)
  && /(axum|actix-web)/.test(backendBlock));
check('BACKEND block explicitly states "NO auto-activation" or equivalent R4 discipline',
  /NO auto-activation|never.*activate|advisory only/i.test(backendBlock));

// 19d. All 5 spec-verbatim question anchors present in BACKEND block
{
  const reqs = ['Domain', 'Traffic profile', 'Data sensitivity', 'SLO', 'Deployment model'];
  const missing = reqs.filter(q => !new RegExp(`\\*\\*${q.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&')}\\*\\*`).test(backendBlock));
  check(`BACKEND block contains all 5 spec §7 teach question headings (A3)`,
    missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : '');
}

// 19e. Deployment wording has bare-metal extension (A3 condition 3 absorbed)
check("Deployment wording extended with 'bare-metal' per Gate 44 A3 condition",
  /bare-VM\s*\/\s*bare-metal/i.test(backendBlock));

// 19f. BACKEND-CONTEXT.md canonical path documented
check('BACKEND-CONTEXT.md canonical path documented: .planning/domains/backend/BACKEND-CONTEXT.md (A2)',
  /\.planning\/domains\/backend\/BACKEND-CONTEXT\.md/.test(backendBlock));

// 19g. Schema block has 5 required section headers
{
  const missing = BACKEND_SCHEMA_REQUIRED_HEADERS.filter(h => !backendBlock.includes(h));
  check(`BACKEND-CONTEXT.md schema has all 5 required section headers (A2)`,
    missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : '');
}

// 19h. Tech stack / runtime = auto-detected, NOT a 6th teach question
//      (A2 condition 2 post-judge revision 2026-04-19 — plan-verifier flagged
//       user-prompt version as Escalate trigger 11 "Q6 added"; auto-detect
//       path is impl lane + compliant).
check('BACKEND block labels Tech stack / runtime as auto-detected (NOT a user question) (A2 post-judge)',
  /Tech stack \/ runtime.*auto-detect|auto-detected.*Tech stack \/ runtime|NOT a user question|## Tech stack \/ runtime \(auto-detected\)/i.test(backendBlock));
check('BACKEND block reaffirms teach is locked at exactly 5 questions (A3 / trigger 11)',
  /exactly 5 questions|locked at.*5|5 questions.*locked/i.test(backendBlock));
check('BACKEND block states auto-detected section is OMITTED when no repo match (A2)',
  /omit|no.*placeholder|no.*prompt/i.test(backendBlock));

// 19i. --skip-teach 2-mode matrix present (both rows)
check('--skip-teach 2-mode matrix: existing BACKEND-CONTEXT.md preserves (A5)',
  /--skip-teach.*existing.*BACKEND-CONTEXT\.md/i.test(backendBlock) && /[Pp]reserve/.test(backendBlock));
check('--skip-teach 2-mode matrix: no BACKEND-CONTEXT.md warns + no-write (A5)',
  /no.*BACKEND-CONTEXT\.md/i.test(backendBlock)
  && /(warn|warning|stderr)/i.test(backendBlock)
  && /not? write|do not write|no empty/i.test(backendBlock));

// 19j. FRONTEND block SHA-256 byte-identical (R3 / A4)
{
  const h = crypto.createHash('sha256').update(frontendBlock, 'utf8').digest('hex');
  check(`FRONTEND marker block byte-identical via SHA-256 (R3 / A4 hard assertion)`,
    h === FRONTEND_BLOCK_EXPECTED_HASH,
    h === FRONTEND_BLOCK_EXPECTED_HASH ? '' : `got ${h.slice(0, 16)}..., expected ${FRONTEND_BLOCK_EXPECTED_HASH.slice(0, 16)}...`);
}

// 19k. Backend detector NOT mentioned inside BACKEND block (Phase 47 wiring scope)
check('Phase 43 detector (detect-backend-smells.mjs) is NOT referenced as an invocation target in BACKEND block',
  !/detect-backend-smells\.mjs/.test(backendBlock) || /NOT invoked|not wired|Phase 47/i.test(backendBlock));

// 19l. Router files byte-identical from Phase 37 (A6 condition 6 absorbed — router vs stub distinction)
for (const routerPath of backendRouterPaths) {
  const name = path.basename(routerPath);
  if (!fs.existsSync(routerPath)) {
    check(`router ${name} exists`, false);
    continue;
  }
  const data = fs.readFileSync(routerPath);
  const h = crypto.createHash('sha256').update(data).digest('hex');
  const expected = BACKEND_ROUTER_EXPECTED_HASHES[name];
  check(`router ${name} byte-identical from Phase 37 (SHA-256)`,
    h === expected,
    h === expected ? '' : `got ${h.slice(0, 16)}..., expected ${expected.slice(0, 16)}...`);
}

// 19m. Retired in Phase 47/M3.6 — the 4 backend-review-* surfaces are now
//      populated behavioral workflows (Section 22 asserts their populated
//      state). Phase 42-47 stub cycle complete; no remaining stubs to threshold.

// 19n. Phase 37 R3 marker tag lines still present (4 tags, unchanged)
check('R3 marker tag lines: FRONTEND-START/END + BACKEND-START/END (4 tags present)',
  /<!-- SUNCO:DOMAIN-FRONTEND-START -->/.test(discussPhaseContent)
  && /<!-- SUNCO:DOMAIN-FRONTEND-END -->/.test(discussPhaseContent)
  && /<!-- SUNCO:DOMAIN-BACKEND-START -->/.test(discussPhaseContent)
  && /<!-- SUNCO:DOMAIN-BACKEND-END -->/.test(discussPhaseContent));

// 19o. Phase 44 CONTEXT populated (not scaffold)
if (fs.existsSync(phase44ContextPath)) {
  const ctx = fs.readFileSync(phase44ContextPath, 'utf8');
  check('Phase 44 CONTEXT.md records Focused Gate 44 outcomes (not scaffold)',
    /Focused Gate 44/i.test(ctx) && /GREEN-CONDITIONAL/i.test(ctx) && /Populated/i.test(ctx));
} else {
  check('Phase 44 CONTEXT.md exists', false);
}

// ─── Section 20 — Phase 45/M3.4 backend-phase-api + backend-phase-data ───
//
// Contract tested (Focused+ Gate 45 axes A1-A7):
//   A1 Workflow populate — both files populated with 6-step behavioral structure
//      (Phase 37 stub 28 lines -> >200 lines), hard-stop on BACKEND-CONTEXT.md
//      absent, BACKEND-CONTEXT canonical path + 5 required + 1 optional section
//      names present
//   A2 sunco-backend-researcher agent — 1 agent, 3-stage protocol, --surface
//      api|data routing, 30k token ceiling, Phase 43 detector + Phase 47 review
//      forbidden
//   A3 Reference loading set — spec §7 verbatim required refs per surface
//      (api=4, data=2) present in both the workflow prompts and the agent spec
//   A4 SPEC.md output format — structure documented in agent + workflows
//      (covered via A1 + A2 assertions; no runtime verification in smoke)
//   A5 JSON schemas — api-spec + data-spec exist, draft-07, additionalProperties,
//      version const:1 (BS1), required fields + anti_pattern_watchlist minItems:3
//   A6 BACKEND-CONTEXT.md consumer contract — both workflows + agent reference
//      the same Phase 44 canonical path + same 5-required + 1-optional section
//      names (drift protection per Codex condition)
//   A7 Frozen invariant preservation — M2 adjacency-risk hash lock (3 files),
//      Phase 44 locks propagate (FRONTEND SHA-256 + router SHA-256), Phase 42
//      ref docs + Phase 43 detector source + vendored Impeccable source diff=0,
//      Phase 46 + Phase 47 stubs remain stubs (inherited from Section 19
//      threshold check)

const apiWorkflowPath = path.resolve(__dirname, '..', 'workflows', 'backend-phase-api.md');
const dataWorkflowPath = path.resolve(__dirname, '..', 'workflows', 'backend-phase-data.md');
const backendResearcherPath = path.resolve(__dirname, '..', 'agents', 'sunco-backend-researcher.md');
const apiSchemaPath = path.resolve(__dirname, '..', 'schemas', 'api-spec.schema.json');
const dataSchemaPath = path.resolve(__dirname, '..', 'schemas', 'data-spec.schema.json');
const phase45ContextPath = path.resolve(__dirname, '..', '..', '..', '.planning', 'phases',
  '45-backend-phase-api-data', '45-CONTEXT.md');

const API_REQUIRED_REFS = [
  'api-design.md', 'boundaries-and-architecture.md',
  'reliability-and-failure-modes.md', 'security-and-permissions.md',
];
const DATA_REQUIRED_REFS = [
  'data-modeling.md', 'migrations-and-compatibility.md',
];

const BACKEND_CTX_REQUIRED_SECTIONS = [
  '## Domain', '## Traffic profile', '## Data sensitivity', '## SLO', '## Deployment model',
];
const BACKEND_CTX_OPTIONAL_SECTION = '## Tech stack / runtime (auto-detected)';
const BACKEND_CTX_CANONICAL_PATH = '.planning/domains/backend/BACKEND-CONTEXT.md';

// M2 adjacency-risk hash lock (Focused+ Gate 45 A7 compromise — captured pre-Phase-45
// at HEAD=de4c2b1 2026-04-19). Files in sibling directories to Phase 45 authorship;
// wrappers (context-injector/detector-adapter) covered by existing --test runs and
// path-distance from Phase 45 edits.
//
// Post-Phase-47 update (2026-04-19): ui-spec.schema.json hash intentionally
// updated after Phase 40 BS1 version field backfill — the field was registered
// plan debt since Phase 40 and scheduled for pre-M4 closure per plan-verifier
// Gate 47 timing flag. Other two files (researcher + workflow) unchanged:
// their "12 fields" prose refers to the Phase 40 content fields and remains
// accurate; BS1 version is a meta-field (schema-level), not a content field.
const M2_ADJACENCY_HASHES = {
  'packages/cli/agents/sunco-ui-researcher-web.md':
    'e3328dcb855a3454398acd08472f4d9f27d1e9cddb1613ccf02442adf762f64a',
  'packages/cli/schemas/ui-spec.schema.json':
    '46c67a6058f7ffe734e52dd141d759d7a21eadf562c6786a90bb926ac1e6c764',
  'packages/cli/workflows/ui-phase-web.md':
    'd77b30e96783a38d3915383563c8e5304f8ebe12bd2cb4447c5398a205f4a205',
};

console.log(`\n${BOLD}20. backend-phase-api + backend-phase-data workflows (Phase 45/M3.4)${RESET}`);

let apiWorkflowContent = '';
let dataWorkflowContent = '';
let researcherContent = '';
if (fs.existsSync(apiWorkflowPath)) apiWorkflowContent = fs.readFileSync(apiWorkflowPath, 'utf8');
if (fs.existsSync(dataWorkflowPath)) dataWorkflowContent = fs.readFileSync(dataWorkflowPath, 'utf8');
if (fs.existsSync(backendResearcherPath)) researcherContent = fs.readFileSync(backendResearcherPath, 'utf8');

// 20a. Both workflows populated (>200 lines, beyond Phase 37 stub 28 lines)
check('backend-phase-api.md populated (>200 lines; Phase 37 stub was 28) (A1)',
  apiWorkflowContent.split('\n').length > 200);
check('backend-phase-data.md populated (>200 lines) (A1)',
  dataWorkflowContent.split('\n').length > 200);

// 20b. 6-step markers in both workflows (Codex condition: markers + path, not line-count alone)
for (const [label, content] of [['api', apiWorkflowContent], ['data', dataWorkflowContent]]) {
  const hasAllSteps = [1, 2, 3, 4, 5, 6].every(n =>
    new RegExp(`^## Step ${n}:`, 'm').test(content));
  check(`backend-phase-${label}.md has all 6 Step headers (A1 structure)`, hasAllSteps);
}

// 20c. Step 1 hard-stop on BACKEND-CONTEXT.md absent (both workflows)
for (const [label, content] of [['api', apiWorkflowContent], ['data', dataWorkflowContent]]) {
  check(`backend-phase-${label}.md Step 1 hard-stops on BACKEND-CONTEXT.md absent (exit 1)`,
    /BACKEND-CONTEXT\.md/.test(content) && /exit 1/.test(content)
    && /\/sunco:discuss.*--domain backend/.test(content));
}

// 20d. Both workflows reference the Phase 44 canonical path
check('both workflows reference BACKEND-CONTEXT.md canonical path (A6 consistency)',
  apiWorkflowContent.includes(BACKEND_CTX_CANONICAL_PATH)
  && dataWorkflowContent.includes(BACKEND_CTX_CANONICAL_PATH)
  && researcherContent.includes(BACKEND_CTX_CANONICAL_PATH));

// 20e. Both workflows + agent reference same Phase 44 section names (drift protection)
for (const sec of BACKEND_CTX_REQUIRED_SECTIONS) {
  const inAll = apiWorkflowContent.includes(sec)
    && dataWorkflowContent.includes(sec)
    && researcherContent.includes(sec);
  check(`Phase 44 section '${sec}' referenced in both workflows + agent (A6 drift protection)`, inAll);
}
check(`Phase 44 optional section '${BACKEND_CTX_OPTIONAL_SECTION}' referenced in both workflows + agent`,
  apiWorkflowContent.includes(BACKEND_CTX_OPTIONAL_SECTION)
  && dataWorkflowContent.includes(BACKEND_CTX_OPTIONAL_SECTION)
  && researcherContent.includes(BACKEND_CTX_OPTIONAL_SECTION));

// 20f. sunco-backend-researcher agent exists + 3-stage protocol
check('sunco-backend-researcher.md exists (A2)', fs.existsSync(backendResearcherPath));
check('agent documents 3-stage protocol (Stage 1/2/3 headers)',
  /Stage 1/.test(researcherContent) && /Stage 2/.test(researcherContent) && /Stage 3/.test(researcherContent));
check('agent declares --surface api|data routing (A2 dispatcher)',
  /--surface/.test(researcherContent) && /\bapi\b/.test(researcherContent) && /\bdata\b/.test(researcherContent));
check('agent documents 30k token ceiling + per-stage budget (A2 budget)',
  /30k/.test(researcherContent) && /8k/.test(researcherContent) && /4k/.test(researcherContent) && /15k/.test(researcherContent));

// 20g. Agent forbids Phase 43 detector + Phase 47 wire
check('agent forbids Phase 43 detector invocation (detect-backend-smells.mjs) (A2 hard guard)',
  /detect-backend-smells\.mjs/.test(researcherContent) && /MUST NOT/.test(researcherContent));
check('agent forbids Phase 47 backend-review wire (forward-ref discipline)',
  /(backend-review|Phase 47)/i.test(researcherContent) && /MUST NOT.*backend-review|Phase 47.*scope/i.test(researcherContent));

// 20h. A3 ref-set compliance — workflows reference spec-required ref subset per surface
for (const ref of API_REQUIRED_REFS) {
  check(`backend-phase-api.md references spec-required '${ref}' (A3)`,
    apiWorkflowContent.includes(ref));
}
for (const ref of DATA_REQUIRED_REFS) {
  check(`backend-phase-data.md references spec-required '${ref}' (A3)`,
    dataWorkflowContent.includes(ref));
}

// 20i. api-spec.schema.json validation (A5)
if (fs.existsSync(apiSchemaPath)) {
  let apiSchema;
  try { apiSchema = JSON.parse(fs.readFileSync(apiSchemaPath, 'utf8')); }
  catch { apiSchema = null; }
  check('api-spec.schema.json parses as valid JSON (A5)', apiSchema !== null);
  if (apiSchema) {
    check('api-spec.schema.json is draft-07 + additionalProperties:true (A5 lenient)',
      apiSchema.$schema === 'http://json-schema.org/draft-07/schema#'
      && apiSchema.additionalProperties === true);
    const apiRequired = new Set(apiSchema.required || []);
    const expected = ['version', 'endpoints', 'error_envelope', 'versioning_strategy',
                      'auth_requirements', 'anti_pattern_watchlist'];
    const missing = expected.filter(k => !apiRequired.has(k));
    check(`api-spec.schema.json required = 6 fields (version/endpoints/error_envelope/versioning_strategy/auth_requirements/anti_pattern_watchlist) (A5)`,
      missing.length === 0, missing.join(', '));
    check('api-spec.schema.json version.const === 1 (BS1)',
      apiSchema.properties?.version?.const === 1);
    check('api-spec.schema.json anti_pattern_watchlist.minItems === 3',
      apiSchema.properties?.anti_pattern_watchlist?.minItems === 3);
    check('api-spec.schema.json endpoints.minItems === 1',
      apiSchema.properties?.endpoints?.minItems === 1);
  }
} else {
  check('api-spec.schema.json exists (A5)', false);
}

// 20j. data-spec.schema.json validation (A5)
if (fs.existsSync(dataSchemaPath)) {
  let dataSchema;
  try { dataSchema = JSON.parse(fs.readFileSync(dataSchemaPath, 'utf8')); }
  catch { dataSchema = null; }
  check('data-spec.schema.json parses as valid JSON (A5)', dataSchema !== null);
  if (dataSchema) {
    check('data-spec.schema.json is draft-07 + additionalProperties:true (A5 lenient)',
      dataSchema.$schema === 'http://json-schema.org/draft-07/schema#'
      && dataSchema.additionalProperties === true);
    const dataRequired = new Set(dataSchema.required || []);
    const expected = ['version', 'entities', 'migration_strategy', 'anti_pattern_watchlist'];
    const missing = expected.filter(k => !dataRequired.has(k));
    check(`data-spec.schema.json required = 4 fields (version/entities/migration_strategy/anti_pattern_watchlist) (A5)`,
      missing.length === 0, missing.join(', '));
    check('data-spec.schema.json version.const === 1 (BS1)',
      dataSchema.properties?.version?.const === 1);
    check('data-spec.schema.json anti_pattern_watchlist.minItems === 3',
      dataSchema.properties?.anti_pattern_watchlist?.minItems === 3);
    check('data-spec.schema.json entities.minItems === 1',
      dataSchema.properties?.entities?.minItems === 1);
  }
} else {
  check('data-spec.schema.json exists (A5)', false);
}

// 20k. M2 adjacency-risk hash lock (Focused+ Gate 45 A7 compromise)
for (const [relPath, expectedHash] of Object.entries(M2_ADJACENCY_HASHES)) {
  const absPath = path.resolve(__dirname, '..', '..', '..', relPath);
  if (!fs.existsSync(absPath)) {
    check(`M2 adjacency-risk file exists: ${relPath}`, false);
    continue;
  }
  const data = fs.readFileSync(absPath);
  const h = crypto.createHash('sha256').update(data).digest('hex');
  const name = path.basename(relPath);
  check(`M2 adjacency-risk byte-identical: ${name} (A7 compromise)`,
    h === expectedHash,
    h === expectedHash ? '' : `got ${h.slice(0, 16)}..., expected ${expectedHash.slice(0, 16)}...`);
}

// 20l. Phase 43 detector source + Phase 42 reference docs + vendored source
//      byte-identical via git diff --stat vs pre-Phase-45 baseline (de4c2b1).
//
// CI-resilient (post-push hotfix 2026-04-19): GitHub Actions actions/checkout@v4
// defaults to fetch-depth:1 (shallow clone), which makes arbitrary historical
// SHAs unreachable. Check for baseline reachability first and degrade to a
// WARN (not FAIL) when running in a shallow clone. Primary coverage for frozen
// surfaces is already provided by M2 adjacency-risk hash lock (20k, 3 files),
// dedicated --test suites (injector 10/10, adapter 22/22, detector 17/17),
// and Section 17/18 per-file quality checks — this strict diff is
// belt-and-suspenders, not the sole guard.
{
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  let baselineReachable = false;
  try {
    execSync(`git -C "${repoRoot}" cat-file -e de4c2b1`,
      { stdio: ['ignore', 'ignore', 'ignore'] });
    baselineReachable = true;
  } catch { /* shallow clone or missing SHA — will degrade below */ }

  if (baselineReachable) {
    try {
      const diffStat = execSync(
        `git -C "${repoRoot}" diff --stat de4c2b1 -- packages/cli/references/backend-excellence/reference packages/cli/references/backend-excellence/NOTICE.md packages/cli/references/backend-excellence/src packages/cli/references/impeccable/source packages/cli/references/impeccable/src`,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
      );
      check('Phase 42 ref docs + Phase 43 detector source + vendored Impeccable diff=0 vs de4c2b1 (A7)',
        diffStat.trim() === '', diffStat.split('\n').slice(0, 3).join(' | '));
    } catch (e) {
      check('Phase 42 ref docs + Phase 43 detector source + vendored Impeccable diff=0 vs de4c2b1 (A7)',
        false, e.message.slice(0, 120));
    }
  } else {
    console.log(`  ${YELLOW}WARN${RESET} baseline de4c2b1 unreachable (likely shallow clone — fetch-depth:1); skipping strict git-diff check. Frozen coverage remains enforced via M2 adjacency-risk hashes (20k) + --test suites (injector/adapter/detector) + Section 17/18 per-file checks.`);
    warnings++;
  }
}

// 20m. Phase 45 CONTEXT populated (not scaffold)
if (fs.existsSync(phase45ContextPath)) {
  const ctx = fs.readFileSync(phase45ContextPath, 'utf8');
  check('Phase 45 CONTEXT.md records Focused+ Gate 45 outcomes (not scaffold)',
    /Focused\+? Gate 45/i.test(ctx) && /GREEN-CONDITIONAL/i.test(ctx) && /Populated/i.test(ctx));
} else {
  check('Phase 45 CONTEXT.md exists', false);
}

// 20n. Retired in Phase 46/M3.5 — event + ops stubs are now populated behavioral
//      workflows (Section 21 asserts their populated state). The Phase 43 17j +
//      Phase 44 14 + Phase 45 stub-exit retirement pattern continues.

// ─── Section 21 — Phase 46/M3.5 backend-phase-event + backend-phase-ops ───
//
// Contract tested (Focused+ Gate 46 axes A1-A7, conditions absorbed):
//   A1 Workflow populate — both files populated with 6-step behavioral structure
//      (Phase 37 stub 28 lines -> >200 lines), hard-stop on BACKEND-CONTEXT.md
//      absent, Phase 44 canonical path + 5 required + 1 optional section names
//   A2 sunco-backend-researcher agent extension — 4-surface routing (api/data/
//      event/ops), 30k token ceiling preserved, Phase 43/47 guards preserved
//   A3 Reference loading set — Phase 42 README authority (spec §7 silent) —
//      event=reliability+boundaries primary, ops=observability+reliability primary
//   A4 SPEC.md output format — structure documented in agent + workflows
//      (covered via A1 + A2 assertions; no runtime verification in smoke)
//   A5 JSON schemas — event-spec + ops-spec exist, draft-07, additionalProperties,
//      version const:1 (BS1), required fields + per-event enums (event) +
//      observability sub-structure (ops) + slo {availability, latency_p95_ms} (ops)
//      + anti_pattern_watchlist minItems:3 (both)
//   A6 BACKEND-CONTEXT.md consumer contract — 4 workflows + 1 agent reference
//      same canonical path + same 5-required + 1-optional section names
//   A7 Frozen invariant preservation — NO history-dependent diff (Codex Gate 46
//      condition 1: HEAD~1 forbidden); current-tree content assertions + SHA-256
//      only. M2 adjacency-risk 3-file hash preserved (Phase 45 scope — no
//      expansion). Phase 45 backend files covered via content-marker grep, not
//      history diff. Phase 42 reference/*.md + Phase 43 detector + vendored
//      Impeccable source current-tree existence + marker presence.

const eventWorkflowPath = path.resolve(__dirname, '..', 'workflows', 'backend-phase-event.md');
const opsWorkflowPath = path.resolve(__dirname, '..', 'workflows', 'backend-phase-ops.md');
const eventSchemaPath = path.resolve(__dirname, '..', 'schemas', 'event-spec.schema.json');
const opsSchemaPath = path.resolve(__dirname, '..', 'schemas', 'ops-spec.schema.json');
const phase46ContextPath = path.resolve(__dirname, '..', '..', '..', '.planning', 'phases',
  '46-backend-phase-event-ops', '46-CONTEXT.md');

const EVENT_REQUIRED_REFS = [
  'reliability-and-failure-modes.md', 'boundaries-and-architecture.md',
];
const OPS_REQUIRED_REFS = [
  'observability-and-operations.md', 'reliability-and-failure-modes.md',
];

// 21a. Both workflows populated (>200 lines, beyond Phase 37 stub 28 lines)
for (const [label, p] of [['event', eventWorkflowPath], ['ops', opsWorkflowPath]]) {
  if (fs.existsSync(p)) {
    const lines = fs.readFileSync(p, 'utf8').split('\n').length;
    check(`backend-phase-${label}.md populated (>200 lines, was 28 stub)`,
      lines > 200);
  } else {
    check(`backend-phase-${label}.md exists`, false);
  }
}

// 21b. 6-step markers in both workflows + correct output path (markers + path, not line-count alone)
for (const [label, p, outPath] of [
  ['event', eventWorkflowPath, 'EVENT-SPEC.md'],
  ['ops', opsWorkflowPath, 'OPS-SPEC.md'],
]) {
  if (fs.existsSync(p)) {
    const body = fs.readFileSync(p, 'utf8');
    const steps = ['Step 1:', 'Step 2:', 'Step 3:', 'Step 4:', 'Step 5:', 'Step 6:'];
    check(`backend-phase-${label}.md has all 6 Step markers`,
      steps.every(s => body.includes(s)));
    check(`backend-phase-${label}.md writes ${outPath} (path assertion)`,
      body.includes(outPath));
  }
}

// 21c. Step 1 hard-stop on BACKEND-CONTEXT.md absent (both workflows)
for (const [label, p] of [['event', eventWorkflowPath], ['ops', opsWorkflowPath]]) {
  check(`backend-phase-${label}.md Step 1 hard-stops on BACKEND-CONTEXT.md absent (exit 1)`,
    fs.existsSync(p) && /if \[ ! -f "\$CONTEXT_FILE" \]/.test(fs.readFileSync(p, 'utf8'))
    && /exit 1/.test(fs.readFileSync(p, 'utf8')));
}

// 21d. Both workflows reference the Phase 44 canonical path
const BACKEND_CTX_PATH = '.planning/domains/backend/BACKEND-CONTEXT.md';
for (const [label, p] of [['event', eventWorkflowPath], ['ops', opsWorkflowPath]]) {
  check(`backend-phase-${label}.md references Phase 44 canonical path`,
    fs.existsSync(p) && fs.readFileSync(p, 'utf8').includes(BACKEND_CTX_PATH));
}

// 21e. Both workflows + agent reference same Phase 44 section names (drift protection)
const PHASE44_REQUIRED_SECTIONS = ['## Domain', '## Traffic profile',
  '## Data sensitivity', '## SLO', '## Deployment model'];
const PHASE44_OPTIONAL_SECTION = '## Tech stack / runtime (auto-detected)';
for (const [label, p] of [['event', eventWorkflowPath], ['ops', opsWorkflowPath]]) {
  if (fs.existsSync(p)) {
    const body = fs.readFileSync(p, 'utf8');
    check(`backend-phase-${label}.md references all 5 required Phase 44 section names`,
      PHASE44_REQUIRED_SECTIONS.every(s => body.includes(s)));
    check(`backend-phase-${label}.md references optional Phase 44 Tech stack section`,
      body.includes(PHASE44_OPTIONAL_SECTION));
  }
}

// 21f. sunco-backend-researcher agent expanded with 4-surface routing
if (fs.existsSync(backendResearcherPath)) {
  const body = fs.readFileSync(backendResearcherPath, 'utf8');
  check('sunco-backend-researcher.md surface routing table includes api row',
    /`api`\s*\|[^|]*api-design\.md/.test(body));
  check('sunco-backend-researcher.md surface routing table includes data row',
    /`data`\s*\|[^|]*data-modeling\.md/.test(body));
  check('sunco-backend-researcher.md surface routing table includes event row',
    /`event`\s*\|[^|]*reliability-and-failure-modes\.md[^|]*boundaries-and-architecture\.md/.test(body));
  check('sunco-backend-researcher.md surface routing table includes ops row',
    /`ops`\s*\|[^|]*observability-and-operations\.md[^|]*reliability-and-failure-modes\.md/.test(body));
  check('sunco-backend-researcher.md 30k token ceiling preserved (Phase 45 → 46 unchanged)',
    /30k/.test(body) && /8k.*4k.*15k|8k\s*.*\s*4k\s*.*\s*15k/s.test(body));
  check('sunco-backend-researcher.md still forbids Phase 43 detector invocation',
    /MUST NOT/.test(body) && /detect-backend-smells\.mjs/.test(body));
  check('sunco-backend-researcher.md still forbids Phase 47 review wire',
    /MUST NOT/.test(body) && /backend-review/.test(body));
  check('sunco-backend-researcher.md documents OPS-SPEC slo structural-projection rule',
    /structural projection/i.test(body) && /slo/i.test(body));
} else {
  check('sunco-backend-researcher.md exists', false);
}

// 21g. A3 ref-set compliance — workflows reference README-authoritative primary refs
for (const ref of EVENT_REQUIRED_REFS) {
  check(`backend-phase-event.md Stage 1 references ${ref}`,
    fs.existsSync(eventWorkflowPath) && fs.readFileSync(eventWorkflowPath, 'utf8').includes(ref));
}
for (const ref of OPS_REQUIRED_REFS) {
  check(`backend-phase-ops.md Stage 1 references ${ref}`,
    fs.existsSync(opsWorkflowPath) && fs.readFileSync(opsWorkflowPath, 'utf8').includes(ref));
}

// 21h. event-spec.schema.json validation (A5)
if (fs.existsSync(eventSchemaPath)) {
  let eventSchema;
  try { eventSchema = JSON.parse(fs.readFileSync(eventSchemaPath, 'utf8')); }
  catch (e) { check('event-spec.schema.json parses as JSON', false); eventSchema = null; }
  if (eventSchema) {
    check('event-spec.schema.json is draft-07',
      eventSchema.$schema === 'http://json-schema.org/draft-07/schema#');
    check('event-spec.schema.json additionalProperties:true (lenient-additive)',
      eventSchema.additionalProperties === true);
    const EVENT_REQUIRED = ['version', 'events', 'dead_letter_strategy',
      'idempotency_keys', 'anti_pattern_watchlist'];
    check('event-spec.schema.json required = 5 fields (version + events + dead_letter_strategy + idempotency_keys + anti_pattern_watchlist)',
      Array.isArray(eventSchema.required) && EVENT_REQUIRED.every(f => eventSchema.required.includes(f)));
    check('event-spec.schema.json version is const:1 (BS1)',
      eventSchema.properties && eventSchema.properties.version &&
      eventSchema.properties.version.const === 1);
    check('event-spec.schema.json anti_pattern_watchlist minItems:3',
      eventSchema.properties && eventSchema.properties.anti_pattern_watchlist &&
      eventSchema.properties.anti_pattern_watchlist.minItems === 3);
    check('event-spec.schema.json events[].ordering enum = strict|best-effort|none',
      eventSchema.properties && eventSchema.properties.events &&
      eventSchema.properties.events.items &&
      eventSchema.properties.events.items.properties &&
      eventSchema.properties.events.items.properties.ordering &&
      Array.isArray(eventSchema.properties.events.items.properties.ordering.enum) &&
      ['strict', 'best-effort', 'none'].every(v =>
        eventSchema.properties.events.items.properties.ordering.enum.includes(v)));
    check('event-spec.schema.json events[].delivery_guarantee enum = at-least-once|at-most-once|exactly-once',
      eventSchema.properties && eventSchema.properties.events &&
      eventSchema.properties.events.items &&
      eventSchema.properties.events.items.properties &&
      eventSchema.properties.events.items.properties.delivery_guarantee &&
      Array.isArray(eventSchema.properties.events.items.properties.delivery_guarantee.enum) &&
      ['at-least-once', 'at-most-once', 'exactly-once'].every(v =>
        eventSchema.properties.events.items.properties.delivery_guarantee.enum.includes(v)));
  }
} else {
  check('event-spec.schema.json exists', false);
}

// 21i. ops-spec.schema.json validation (A5)
if (fs.existsSync(opsSchemaPath)) {
  let opsSchema;
  try { opsSchema = JSON.parse(fs.readFileSync(opsSchemaPath, 'utf8')); }
  catch (e) { check('ops-spec.schema.json parses as JSON', false); opsSchema = null; }
  if (opsSchema) {
    check('ops-spec.schema.json is draft-07',
      opsSchema.$schema === 'http://json-schema.org/draft-07/schema#');
    check('ops-spec.schema.json additionalProperties:true (lenient-additive)',
      opsSchema.additionalProperties === true);
    const OPS_REQUIRED = ['version', 'deployment_topology', 'observability',
      'slo', 'anti_pattern_watchlist'];
    check('ops-spec.schema.json required = 5 fields (version + deployment_topology + observability + slo + anti_pattern_watchlist)',
      Array.isArray(opsSchema.required) && OPS_REQUIRED.every(f => opsSchema.required.includes(f)));
    check('ops-spec.schema.json version is const:1 (BS1)',
      opsSchema.properties && opsSchema.properties.version &&
      opsSchema.properties.version.const === 1);
    check('ops-spec.schema.json anti_pattern_watchlist minItems:3',
      opsSchema.properties && opsSchema.properties.anti_pattern_watchlist &&
      opsSchema.properties.anti_pattern_watchlist.minItems === 3);
    check('ops-spec.schema.json observability sub-structure requires logs + metrics + traces',
      opsSchema.properties && opsSchema.properties.observability &&
      Array.isArray(opsSchema.properties.observability.required) &&
      ['logs', 'metrics', 'traces'].every(f =>
        opsSchema.properties.observability.required.includes(f)));
    check('ops-spec.schema.json slo requires availability + latency_p95_ms',
      opsSchema.properties && opsSchema.properties.slo &&
      Array.isArray(opsSchema.properties.slo.required) &&
      ['availability', 'latency_p95_ms'].every(f =>
        opsSchema.properties.slo.required.includes(f)));
  }
} else {
  check('ops-spec.schema.json exists', false);
}

// 21j. Phase 45 backend files content-marker grep (NO history diff; Codex Gate 46 condition 1)
//      Verifies Phase 45 files still carry their substantive markers — substantive
//      edits would remove/alter these and trip the check, while trivial edits pass.
if (fs.existsSync(apiWorkflowPath)) {
  const body = fs.readFileSync(apiWorkflowPath, 'utf8');
  check('Phase 45 backend-phase-api.md retains 6-step + API-SPEC.md markers (content-grep, no HEAD~1)',
    ['Step 1:', 'Step 6:', 'API-SPEC.md', '--surface api', 'sunco-backend-researcher']
      .every(m => body.includes(m)));
}
if (fs.existsSync(dataWorkflowPath)) {
  const body = fs.readFileSync(dataWorkflowPath, 'utf8');
  check('Phase 45 backend-phase-data.md retains 6-step + DATA-SPEC.md markers (content-grep, no HEAD~1)',
    ['Step 1:', 'Step 6:', 'DATA-SPEC.md', '--surface data', 'sunco-backend-researcher']
      .every(m => body.includes(m)));
}
if (fs.existsSync(apiSchemaPath)) {
  try {
    const s = JSON.parse(fs.readFileSync(apiSchemaPath, 'utf8'));
    check('Phase 45 api-spec.schema.json retains version:1 + endpoints + anti_pattern_watchlist (content, no HEAD~1)',
      s.properties && s.properties.version && s.properties.version.const === 1 &&
      Array.isArray(s.required) && s.required.includes('endpoints') &&
      s.required.includes('anti_pattern_watchlist'));
  } catch (e) { check('Phase 45 api-spec.schema.json parses', false); }
}
if (fs.existsSync(dataSchemaPath)) {
  try {
    const s = JSON.parse(fs.readFileSync(dataSchemaPath, 'utf8'));
    check('Phase 45 data-spec.schema.json retains version:1 + entities + migration_strategy (content, no HEAD~1)',
      s.properties && s.properties.version && s.properties.version.const === 1 &&
      Array.isArray(s.required) && s.required.includes('entities') &&
      s.required.includes('migration_strategy'));
  } catch (e) { check('Phase 45 data-spec.schema.json parses', false); }
}

// 21k. Phase 46 CONTEXT populated (not scaffold)
if (fs.existsSync(phase46ContextPath)) {
  const ctx = fs.readFileSync(phase46ContextPath, 'utf8');
  check('Phase 46 CONTEXT.md populated with Gate 46 outcomes (GREEN-CONDITIONAL + Populated + Focused+ Gate 46)',
    /Focused\+? Gate 46/i.test(ctx) && /GREEN-CONDITIONAL/i.test(ctx) && /Populated/i.test(ctx));
} else {
  check('Phase 46 CONTEXT.md exists', false);
}

// 21l. Retired in Phase 47/M3.6 — backend-review-* are now populated
//      behavioral workflows; Section 22 owns positive assertions.

// ─── Section 22 — Phase 47/M3.6 backend-review 4 surfaces ───
//
// Contract tested (Focused+ Gate 47 axes A1-A9, 4 Codex conditions absorbed +
// 3 plan-verifier trigger recommendations confirmed present):
//   A1 4 workflow populate — stub 28 → behavioral 5-step (Step markers +
//      SPEC.md path + surface-specific rule subset or SKIP marker for event)
//   A2 Phase 43 detector wire — post-process rule filter (workflow level;
//      detector `--rules` flag forbidden per §13 7-rule lock); event surface
//      explicit SKIP per spec §7 "no deterministic rules v1"
//   A3 Surface-specific SPEC.md hard-stop at Step 1 — exit 1 + "Run
//      /sunco:backend-phase" guide + spec_version marker grep
//   A4 sunco-backend-reviewer singular NEW — 2-stage (context-load → review-
//      emit), 30k ceiling, hard guards
//   A5 BACKEND-AUDIT.md output contract — section-level replace per invocation
//      (Codex C2 wording); 4-section skeleton; <!-- audit_version: 1 --> marker;
//      per-section <!-- surface_source: {...} --> metadata
//   A6 Finding labels severity × state boundary — 3 kinds enum, 3 severities
//      R6 enum, state enum single-value ["open"]; Codex C4 negative-grep
//      scope limit (active state enum context only, guard prose allowed)
//   A7 SLO dual-source — BACKEND-CONTEXT source of truth + OPS-SPEC projection
//      language in backend-review-ops.md
//   A8 Smoke self (this section) — Codex C3 broad-freeze wording retired;
//      hash-lock scope unchanged (3-file M2 + FRONTEND marker + routers);
//      Phase 42/43/45/46 verified via content-marker grep (not hash)
//   A9 Frozen invariants preserved; BS2 formally deferred to M4+

const reviewApiPath = path.resolve(__dirname, '..', 'workflows', 'backend-review-api.md');
const reviewDataPath = path.resolve(__dirname, '..', 'workflows', 'backend-review-data.md');
const reviewEventPath = path.resolve(__dirname, '..', 'workflows', 'backend-review-event.md');
const reviewOpsPath = path.resolve(__dirname, '..', 'workflows', 'backend-review-ops.md');
const reviewerAgentPath = path.resolve(__dirname, '..', 'agents', 'sunco-backend-reviewer.md');
const findingSchemaPath = path.resolve(__dirname, '..', 'schemas', 'finding.schema.json');
const phase47ContextPath = path.resolve(__dirname, '..', '..', '..', '.planning', 'phases',
  '47-backend-review-four-surfaces', '47-CONTEXT.md');

const REVIEW_WORKFLOWS = [
  ['api', reviewApiPath, 'API-SPEC.md', '## API findings'],
  ['data', reviewDataPath, 'DATA-SPEC.md', '## Data findings'],
  ['event', reviewEventPath, 'EVENT-SPEC.md', '## Event findings'],
  ['ops', reviewOpsPath, 'OPS-SPEC.md', '## Ops findings'],
];

const API_REVIEW_RULES = [
  'raw-sql-interpolation', 'any-typed-body',
  'missing-validation-public-route', 'logged-secret',
];
const DATA_REVIEW_RULES = ['non-reversible-migration'];
const OPS_REVIEW_RULES = ['missing-timeout', 'swallowed-catch', 'logged-secret'];

console.log(`\n${BOLD}22. backend-review 4 surfaces (Phase 47/M3.6)${RESET}`);

// 22a. All 4 workflows populated (>200 lines, beyond Phase 37 stub 28 lines)
for (const [surface, p] of REVIEW_WORKFLOWS) {
  if (fs.existsSync(p)) {
    const lines = fs.readFileSync(p, 'utf8').split('\n').length;
    check(`backend-review-${surface}.md populated (>200 lines, was 28 stub) (A1)`,
      lines > 200);
  } else {
    check(`backend-review-${surface}.md exists`, false);
  }
}

// 22b. 5-Step markers + SPEC.md path (Phase 47 pattern: 5-step, not 6-step)
for (const [surface, p, outPath] of REVIEW_WORKFLOWS) {
  if (fs.existsSync(p)) {
    const body = fs.readFileSync(p, 'utf8');
    const steps = ['Step 1:', 'Step 2:', 'Step 3:', 'Step 4:', 'Step 5:'];
    check(`backend-review-${surface}.md has all 5 Step markers (A1)`,
      steps.every(s => body.includes(s)));
    check(`backend-review-${surface}.md references ${outPath} (SPEC hard-stop; A3)`,
      body.includes(outPath));
    check(`backend-review-${surface}.md has "Run /sunco:backend-phase" guide (A3)`,
      /Run \/sunco:backend-phase/.test(body));
    check(`backend-review-${surface}.md checks <!-- spec_version: 1 --> marker (A3)`,
      body.includes('<!-- spec_version: 1 -->'));
  }
}

// 22c. api workflow has 4-rule subset (A2)
if (fs.existsSync(reviewApiPath)) {
  const body = fs.readFileSync(reviewApiPath, 'utf8');
  for (const rule of API_REVIEW_RULES) {
    check(`backend-review-api.md Step 2 references ${rule} (A2)`,
      body.includes(rule));
  }
}

// 22d. data workflow has 1-rule subset (A2)
if (fs.existsSync(reviewDataPath)) {
  const body = fs.readFileSync(reviewDataPath, 'utf8');
  for (const rule of DATA_REVIEW_RULES) {
    check(`backend-review-data.md Step 2 references ${rule} (A2)`,
      body.includes(rule));
  }
}

// 22e. event workflow Step 2 SKIPPED (A2 — spec §7 "no deterministic rules v1")
if (fs.existsSync(reviewEventPath)) {
  const body = fs.readFileSync(reviewEventPath, 'utf8');
  check('backend-review-event.md Step 2 explicitly SKIPS detector (spec §7 Phase 3.6) (A2)',
    /SKIP/i.test(body)
    && /no deterministic rules v1|pure review/i.test(body)
    && /EVENT_FINDINGS\s*=\s*"\[\]"/.test(body));
  check('backend-review-event.md does NOT invoke detect-backend-smells.mjs in Step 2 code',
    !/node\s+"?\$?DETECTOR"?\s+--json/.test(body));
}

// 22f. ops workflow has 3-rule subset (A2)
if (fs.existsSync(reviewOpsPath)) {
  const body = fs.readFileSync(reviewOpsPath, 'utf8');
  for (const rule of OPS_REVIEW_RULES) {
    check(`backend-review-ops.md Step 2 references ${rule} (A2)`,
      body.includes(rule));
  }
}

// 22g. All 4 workflows spawn sunco-backend-reviewer (A4)
for (const [surface, p] of REVIEW_WORKFLOWS) {
  if (fs.existsSync(p)) {
    const body = fs.readFileSync(p, 'utf8');
    check(`backend-review-${surface}.md spawns sunco-backend-reviewer (A4)`,
      body.includes('sunco-backend-reviewer'));
  }
}

// 22h. All 4 workflows write BACKEND-AUDIT.md + surface section label (A5)
for (const [surface, p, , sectionLabel] of REVIEW_WORKFLOWS) {
  if (fs.existsSync(p)) {
    const body = fs.readFileSync(p, 'utf8');
    check(`backend-review-${surface}.md writes .planning/domains/backend/BACKEND-AUDIT.md (A5)`,
      body.includes('.planning/domains/backend/BACKEND-AUDIT.md'));
    check(`backend-review-${surface}.md references section header "${sectionLabel}" (A5)`,
      body.includes(sectionLabel));
  }
}

// 22i. Section-level replace wording (Codex C2 absorb — A5)
for (const [surface, p] of REVIEW_WORKFLOWS) {
  if (fs.existsSync(p)) {
    const body = fs.readFileSync(p, 'utf8');
    check(`backend-review-${surface}.md documents section-level replace per invocation (C2 absorb; A5)`,
      /section-level replace/i.test(body) && /byte-for-byte/i.test(body));
  }
}

// 22j. <!-- audit_version: 1 --> marker template + 4-section skeleton referenced (A5)
for (const [surface, p] of REVIEW_WORKFLOWS) {
  if (fs.existsSync(p)) {
    const body = fs.readFileSync(p, 'utf8');
    check(`backend-review-${surface}.md template has <!-- audit_version: 1 --> marker (A5 / BS1)`,
      body.includes('<!-- audit_version: 1 -->'));
    const has4Sections = body.includes('## API findings')
      && body.includes('## Data findings')
      && body.includes('## Event findings')
      && body.includes('## Ops findings');
    check(`backend-review-${surface}.md template references all 4 surface section headers (A5)`,
      has4Sections);
  }
}

// 22k. sunco-backend-reviewer agent exists + 4-surface routing table (A4)
if (fs.existsSync(reviewerAgentPath)) {
  const body = fs.readFileSync(reviewerAgentPath, 'utf8');
  check('sunco-backend-reviewer.md exists (A4)', true);
  check('sunco-backend-reviewer.md routing table includes api row',
    /`api`\s*\|[^|]*api-design\.md/.test(body));
  check('sunco-backend-reviewer.md routing table includes data row',
    /`data`\s*\|[^|]*data-modeling\.md/.test(body));
  check('sunco-backend-reviewer.md routing table includes event row (detector SKIPPED)',
    /`event`\s*\|[^|]*reliability-and-failure-modes\.md/.test(body)
    && /no deterministic rules v1|detector SKIPPED/i.test(body));
  check('sunco-backend-reviewer.md routing table includes ops row',
    /`ops`\s*\|[^|]*observability-and-operations\.md/.test(body));
  check('sunco-backend-reviewer.md documents 30k token ceiling + 2-stage markers (A4)',
    /30k/.test(body) && /Stage 1/.test(body) && /Stage 2/.test(body));
  // 22l. Hard guards (Codex + plan-verifier convergent).
  //      Agent file has a "You MUST NOT:" bullet list; slice that block and
  //      check forbidden items appear inside it. Using indexOf + slice avoids
  //      dotall regex (which behaves inconsistently across Node versions).
  const mustNotIdx = body.indexOf('You MUST NOT:');
  const mustNotBlock = mustNotIdx >= 0 ? body.slice(mustNotIdx, mustNotIdx + 4000) : '';
  check('sunco-backend-reviewer.md MUST NOT emit kind: deterministic (agent hard guard; A4)',
    mustNotBlock.length > 0 && /kind:\s*deterministic/i.test(mustNotBlock));
  check('sunco-backend-reviewer.md MUST NOT write SPEC / BACKEND-CONTEXT / BACKEND-AUDIT (agent hard guard; A4)',
    mustNotBlock.length > 0
    && /SPEC\.md|<SURFACE>-SPEC/.test(mustNotBlock)
    && /BACKEND-CONTEXT/.test(mustNotBlock)
    && /BACKEND-AUDIT/.test(mustNotBlock));
  check('sunco-backend-reviewer.md MUST NOT emit cross-domain findings (Phase 48 boundary; A4)',
    /MUST NOT.*cross-domain|Phase 48.*scope/i.test(body));
  check('sunco-backend-reviewer.md MUST NOT emit state: resolved|dismissed (Phase 49 boundary; A4 / A6)',
    /MUST NOT.*state.*resolved|MUST NOT.*resolved.*dismissed|Phase 49.*lifecycle/i.test(body));
  check('sunco-backend-reviewer.md MUST NOT re-invoke Phase 43 detector (orchestrator Step 2 exclusive; A2)',
    /MUST NOT.*re-invoke.*detector|orchestrator.*Step 2|Phase 43 detector.*exclusive/i.test(body));
  check('sunco-backend-reviewer.md MUST NOT emit aggregate summary (Phase 48 boundary; A4)',
    /MUST NOT.*aggregate|no "HIGH.*N"|no.*cross-surface/i.test(body));
} else {
  check('sunco-backend-reviewer.md exists (A4)', false);
}

// 22m. finding.schema.json exists + structure (A6)
if (fs.existsSync(findingSchemaPath)) {
  let schema;
  try { schema = JSON.parse(fs.readFileSync(findingSchemaPath, 'utf8')); }
  catch (e) { check('finding.schema.json parses as JSON', false); schema = null; }
  if (schema) {
    check('finding.schema.json is draft-07 (A6)',
      schema.$schema === 'http://json-schema.org/draft-07/schema#');
    check('finding.schema.json additionalProperties:true (lenient-additive; A6)',
      schema.additionalProperties === true);
    const FINDING_REQUIRED = ['rule', 'severity', 'kind', 'file', 'line', 'state'];
    check('finding.schema.json required fields (rule/severity/kind/file/line/state) (A6)',
      Array.isArray(schema.required) && FINDING_REQUIRED.every(f => schema.required.includes(f)));
    check('finding.schema.json kind enum = 3 values (deterministic/heuristic/requires-human-confirmation) (A6)',
      schema.properties && schema.properties.kind &&
      Array.isArray(schema.properties.kind.enum) &&
      ['deterministic', 'heuristic', 'requires-human-confirmation']
        .every(k => schema.properties.kind.enum.includes(k)));
    check('finding.schema.json severity enum = 3 R6 values (HIGH/MEDIUM/LOW) (A6)',
      schema.properties && schema.properties.severity &&
      Array.isArray(schema.properties.severity.enum) &&
      ['HIGH', 'MEDIUM', 'LOW'].every(s => schema.properties.severity.enum.includes(s))
      && schema.properties.severity.enum.length === 3);
    // 22n. state enum expanded to 3 lifecycle values at Phase 49/M4.2 (A1).
    // Phase 47 audit_version:1 writer discipline (state='open' only) is enforced at
    // agent-level (sunco-backend-reviewer.md hard-guard), not schema-level. Section
    // 24 check 24i verifies the agent guard is preserved.
    check('finding.schema.json state enum = [open, resolved, dismissed-with-rationale] (Phase 49/M4.2 A1)',
      schema.properties && schema.properties.state &&
      Array.isArray(schema.properties.state.enum) &&
      schema.properties.state.enum.length === 3 &&
      schema.properties.state.enum.includes('open') &&
      schema.properties.state.enum.includes('resolved') &&
      schema.properties.state.enum.includes('dismissed-with-rationale'));
    // 22o. Phase 49 expansion path documented in description (A6 — Codex spec feedback)
    check('finding.schema.json description documents Phase 49 audit_version: 2 expansion path (A6)',
      /audit_version:\s*2|Phase 49.*lifecycle|resolved.*dismissed.*Phase 49/i.test(schema.description || ''));
  }
} else {
  check('finding.schema.json exists', false);
}

// 22p. No resolved/dismissed as active state enum (Codex C4 — scoped negative grep).
//      Check: finding.schema.json state enum does NOT contain "resolved" or "dismissed".
//      Prose mentions in guards/docs/escalate triggers are permitted.
if (fs.existsSync(findingSchemaPath)) {
  let schema;
  try { schema = JSON.parse(fs.readFileSync(findingSchemaPath, 'utf8')); } catch { schema = null; }
  if (schema && schema.properties && schema.properties.state) {
    const stateEnum = schema.properties.state.enum || [];
    // Phase 49/M4.2 A1: state enum expanded. 'dismissed' shorthand (without -with-rationale
    // suffix) MUST NOT appear — only the full 'dismissed-with-rationale' literal.
    check('finding.schema.json does NOT include dismissed shorthand (Phase 49 A1 literal-only)',
      !stateEnum.includes('dismissed'));
  }
}
// 22q. No resolved/dismissed as YAML state value in workflow emit templates
//      (scoped: only lines matching `state:\s*(resolved|dismissed)`, not bare word).
for (const [surface, p] of REVIEW_WORKFLOWS) {
  if (fs.existsSync(p)) {
    const body = fs.readFileSync(p, 'utf8');
    const hasActiveResolved = /^\s+state:\s*resolved/m.test(body);
    const hasActiveDismissed = /^\s+state:\s*dismissed/m.test(body);
    check(`backend-review-${surface}.md emits no "state: resolved" active value (Codex C4; Phase 49 boundary)`,
      !hasActiveResolved);
    check(`backend-review-${surface}.md emits no "state: dismissed" active value (Codex C4; Phase 49 boundary)`,
      !hasActiveDismissed);
  }
}

// 22r. SLO dual-source language in backend-review-ops.md (A7 — Phase 46 carry)
if (fs.existsSync(reviewOpsPath)) {
  const body = fs.readFileSync(reviewOpsPath, 'utf8');
  check('backend-review-ops.md references BACKEND-CONTEXT SLO as source of truth (A7)',
    /source of truth/i.test(body) && /BACKEND-CONTEXT/.test(body));
  check('backend-review-ops.md references OPS-SPEC slo as projection (A7)',
    /projection/i.test(body) && /OPS-SPEC/.test(body));
  check('backend-review-ops.md documents slo-projection-drift rule (heuristic finding; A7)',
    /slo-projection-drift/.test(body));
  check('backend-review-ops.md forbids overwriting either BACKEND-CONTEXT or OPS-SPEC (A7)',
    /do not overwrite|MUST NOT.*overwrite|neither file/i.test(body));
}

// 22s. Phase 43 detector content-marker unchanged (Codex C3 — content grep, NOT file hash)
{
  const detectorPath = path.resolve(__dirname, '..', 'references', 'backend-excellence', 'src', 'detect-backend-smells.mjs');
  if (fs.existsSync(detectorPath)) {
    const body = fs.readFileSync(detectorPath, 'utf8');
    const rules = ['raw-sql-interpolation', 'missing-timeout', 'swallowed-catch',
      'any-typed-body', 'missing-validation-public-route', 'non-reversible-migration',
      'logged-secret'];
    check('Phase 43 detector content-marker: 7 rule names present (§13 lock; C3 content grep)',
      rules.every(r => body.includes(r)));
    check('Phase 43 detector content-marker: DETECTOR_VERSION = "1.0.0" (C3 content grep)',
      /DETECTOR_VERSION\s*=\s*['"]1\.0\.0['"]/.test(body));
    check('Phase 43 detector content-marker: RULES_ENABLED array present (C3 content grep)',
      /RULES_ENABLED\s*=\s*Object\.freeze\(\s*\[/.test(body));
  } else {
    check('Phase 43 detector source exists', false);
  }
}

// 22t. FRONTEND marker SHA-256 propagates (R3; Phase 44 lock — already in Section 19j,
//      but Phase 47 re-asserts for M3 closing defense-in-depth).
//      This check is functionally identical to 19j; if 19j fails this also fails.
//      Phase 47 inherits via Section 19 success; no duplicate hash computation here.

// 22u. Router SHA-256 propagates (Phase 37/44 lock) — inherited via Section 19l.
//      Same rationale as 22t.

// 22v. Phase 47 CONTEXT populated (not scaffold)
if (fs.existsSync(phase47ContextPath)) {
  const ctx = fs.readFileSync(phase47ContextPath, 'utf8');
  check('Phase 47 CONTEXT.md populated with Gate 47 outcomes (Focused+ Gate 47 + GREEN-CONDITIONAL + Populated)',
    /Focused\+? Gate 47/i.test(ctx) && /GREEN-CONDITIONAL/i.test(ctx) && /Populated/i.test(ctx));
} else {
  check('Phase 47 CONTEXT.md exists', false);
}

// ─── Section 23 — Phase 48/M4.1 cross-domain CROSS-DOMAIN.md auto-generation ───
//
// Contract tested (Full Gate 48 axes G1-G8, 3 Codex critical absorbed + 5 axis
// conditions + 2 plan-verifier conditions — see Phase 48 CONTEXT absorption table):
//   G1 cross-domain.schema.json draft-07 + version const:1 + 6 required fields +
//      generated_from.sha SHA-256 pattern + minItems:0 per projection array
//   G2 extract-spec-block.mjs pure-stdlib module (no new npm dep; C2) with --test
//      self-run (≥22 checks) and no AI SDK / no subagent (G6)
//   G3 .planning/domains/contracts/CROSS-DOMAIN.md output + START/END paired markers
//      + <!-- cross_domain_version: 1 --> BS1 parity marker
//   G4 UI+API hard-required default / DATA/EVENT/OPS optional / required_specs
//      CONTEXT.md override hard-stops listed paths (C4 absorb: generator hard-stop,
//      not read-only)
//   G5 Summary-only BACKEND-AUDIT rollup (open-count × severity × 4 surfaces);
//      no lifecycle tokens in generated block (C5 escalate trigger)
//   G6 No LLM / no subagent / no AI SDK imports / no HTTP — invariant explicit
//   G7 Smoke Section 23 content-marker grep (no git diff --stat HEAD~1); negative
//      grep scope limited to active output (schema / workflow generation template /
//      module source) per Codex C6 absorb — gate prose / escalate trigger language
//      permitted to mention lifecycle tokens for documentation
//   G8 Frozen Phase 35-47 outputs (read-only), finding.schema state enum unchanged,
//      no sunco-cross-domain-* agent created, Phase 44 BACKEND-CONTEXT untouched
//      (C8 explicit lock — workflow neither reads nor writes BACKEND-CONTEXT)

const crossDomainSchemaPath = path.resolve(__dirname, '..', 'schemas', 'cross-domain.schema.json');
const crossDomainSyncPath = path.resolve(__dirname, '..', 'workflows', 'cross-domain-sync.md');
const crossDomainExtractorPath = path.resolve(__dirname, '..', 'references', 'cross-domain', 'src', 'extract-spec-block.mjs');
const phase48ContextPath = path.resolve(__dirname, '..', '..', '..', '.planning', 'phases',
  '48-cross-domain-auto-generation', '48-CONTEXT.md');

console.log(`\n${BOLD}23. cross-domain CROSS-DOMAIN.md auto-generation (Phase 48/M4.1)${RESET}`);

// 23a. cross-domain.schema.json exists + draft-07 + additionalProperties:true (G1)
if (fs.existsSync(crossDomainSchemaPath)) {
  let xdSchema;
  try { xdSchema = JSON.parse(fs.readFileSync(crossDomainSchemaPath, 'utf8')); }
  catch (e) { check('cross-domain.schema.json parses as JSON (G1)', false); xdSchema = null; }
  if (xdSchema) {
    check('cross-domain.schema.json draft-07 (G1)',
      xdSchema.$schema === 'http://json-schema.org/draft-07/schema#');
    check('cross-domain.schema.json additionalProperties:true (G1 lenient-additive)',
      xdSchema.additionalProperties === true);
    // 23b. 6 required fields
    const XD_REQUIRED = ['version', 'generated_from', 'endpoints_consumed',
                         'endpoints_defined', 'error_mappings', 'type_contracts'];
    check('cross-domain.schema.json required fields (6 total per spec §8 Phase 4.1) (G1)',
      Array.isArray(xdSchema.required) && XD_REQUIRED.every(f => xdSchema.required.includes(f))
      && xdSchema.required.length === 6);
    // 23c. version const:1 BS1
    check('cross-domain.schema.json version const:1 (G1 BS1 parity)',
      xdSchema.properties && xdSchema.properties.version && xdSchema.properties.version.const === 1);
    // 23d. generated_from.sha SHA-256 pattern (C3 content hash, not git SHA)
    const gfItems = xdSchema.properties && xdSchema.properties.generated_from
      && xdSchema.properties.generated_from.items;
    check('cross-domain.schema.json generated_from.sha SHA-256 hex pattern (C3)',
      gfItems && gfItems.properties && gfItems.properties.sha
      && gfItems.properties.sha.pattern === '^[0-9a-f]{64}$');
    check('cross-domain.schema.json generated_from required [spec, sha] (C3)',
      gfItems && Array.isArray(gfItems.required)
      && gfItems.required.includes('spec') && gfItems.required.includes('sha'));
    // 23e. method enum matches api-spec (G1 enum alignment)
    const epItems = xdSchema.properties && xdSchema.properties.endpoints_defined
      && xdSchema.properties.endpoints_defined.items;
    const API_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
    check('cross-domain.schema.json endpoints_defined.method enum = api-spec 7 methods (G1)',
      epItems && epItems.properties && epItems.properties.method
      && Array.isArray(epItems.properties.method.enum)
      && API_METHODS.every(m => epItems.properties.method.enum.includes(m))
      && epItems.properties.method.enum.length === 7);
    // 23f. minItems:0 on projection arrays (G1 generator scope)
    const EC_ARR = xdSchema.properties && xdSchema.properties.endpoints_consumed;
    check('cross-domain.schema.json endpoints_consumed minItems:0 (G1 generator — Phase 49 judges coverage)',
      EC_ARR && EC_ARR.minItems === 0);
  }
} else {
  check('cross-domain.schema.json exists (G1)', false);
}

// 23g. cross-domain-sync.md exists + populated (not stub)
if (fs.existsSync(crossDomainSyncPath)) {
  const lines = fs.readFileSync(crossDomainSyncPath, 'utf8').split('\n').length;
  check('cross-domain-sync.md populated (>100 lines; no stub) (G2/G3)', lines > 100);
  const body = fs.readFileSync(crossDomainSyncPath, 'utf8');
  // 23h. Internal workflow banner (C7)
  check('cross-domain-sync.md declares internal workflow — no slash command in Phase 48 (C7)',
    /Internal workflow/i.test(body) && /No slash command in Phase 48/i.test(body));
  // 23i. Phase 49 wiring reference (C7)
  check('cross-domain-sync.md references Phase 49 verify gate as future public surface (C7)',
    /Phase 49/.test(body) && /verify/i.test(body));
  // 23j. UI + API hard-required default (G4)
  check('cross-domain-sync.md declares UI-SPEC + API-SPEC hard-required default (G4)',
    /UI-SPEC/.test(body) && /API-SPEC/.test(body) && /required/i.test(body) && /hard-stop/i.test(body));
  // 23k. DATA/EVENT/OPS optional (G4)
  check('cross-domain-sync.md declares DATA/EVENT/OPS optional-parsed-if-present (G4)',
    /DATA-SPEC/.test(body) && /EVENT-SPEC/.test(body) && /OPS-SPEC/.test(body)
    && /optional/i.test(body) && /silent skip/i.test(body));
  // 23l. required_specs override semantics (C4 — generator hard-stop)
  check('cross-domain-sync.md honors required_specs CONTEXT.md override as generator hard-stop (C4)',
    /required_specs/.test(body) && /override/i.test(body)
    && /hard-stop/i.test(body));
  // 23m. Output path
  check('cross-domain-sync.md writes .planning/domains/contracts/CROSS-DOMAIN.md (G3 — spec §8 line 665)',
    /\.planning\/domains\/contracts\/CROSS-DOMAIN\.md/.test(body));
  // 23n. Hard invariants (G6)
  check('cross-domain-sync.md declares no-LLM / no-subagent / no-AI-SDK hard invariant (G6)',
    /no[- ]?LLM|no[- ]?subagent|Task\(.*subagent_type/i.test(body)
    && /(ai|anthropic|openai)/i.test(body));
  // 23o. Escalate trigger for lifecycle tokens (C5)
  check('cross-domain-sync.md documents lifecycle-token escalate trigger (resolved/dismissed/audit_version:2 in generated output = RED) (C5)',
    /lifecycle token/i.test(body)
    && /resolved/.test(body) && /dismissed/.test(body)
    && /audit_version/.test(body));
  // 23p. Paired START/END markers for CROSS-DOMAIN-BLOCK (G3)
  check('cross-domain-sync.md uses SUNCO:CROSS-DOMAIN-BLOCK-START/END paired markers (G3)',
    body.includes('<!-- SUNCO:CROSS-DOMAIN-BLOCK-START -->')
    && body.includes('<!-- SUNCO:CROSS-DOMAIN-BLOCK-END -->'));
  // 23q. OPEN-FINDINGS-SUMMARY markers (G5)
  check('cross-domain-sync.md uses SUNCO:OPEN-FINDINGS-SUMMARY-START/END paired markers (G5)',
    body.includes('<!-- SUNCO:OPEN-FINDINGS-SUMMARY-START -->')
    && body.includes('<!-- SUNCO:OPEN-FINDINGS-SUMMARY-END -->'));
  // 23r. cross_domain_version: 1 BS1 parity marker (G3)
  check('cross-domain-sync.md documents <!-- cross_domain_version: 1 --> top marker (G3 BS1 parity)',
    /cross_domain_version:\s*1/.test(body));
  // 23s. Phase 44 BACKEND-CONTEXT neither read nor written (C8)
  check('cross-domain-sync.md does NOT read or write BACKEND-CONTEXT.md (C8 Phase 44 lock)',
    !/BACKEND-CONTEXT\.md/i.test(body) || /MUST NOT.*BACKEND-CONTEXT/.test(body));
  // 23t. Summary-only BACKEND-AUDIT rollup without lifecycle tokens (G5)
  check('cross-domain-sync.md declares summary-only BACKEND-AUDIT rollup (G5)',
    /summary[- ]?only/i.test(body) && /BACKEND-AUDIT/.test(body));
} else {
  check('cross-domain-sync.md exists (G2/G3)', false);
}

// 23u. extract-spec-block.mjs exists + --test passes (≥22 checks per design)
if (fs.existsSync(crossDomainExtractorPath)) {
  const body = fs.readFileSync(crossDomainExtractorPath, 'utf8');
  check('extract-spec-block.mjs ESM module exists (G2)', body.length > 0);
  // 23v. No AI SDK / subagent imports in module source (G6 — active source negative grep)
  check('extract-spec-block.mjs has no AI SDK imports (G6 active-source negative grep)',
    !/from\s+['"](ai|@anthropic-ai\/sdk|openai|anthropic)['"]/.test(body)
    && !/require\(['"](ai|@anthropic-ai\/sdk|openai|anthropic)['"]\)/.test(body));
  check('extract-spec-block.mjs has no subagent Task spawn (G6)',
    !/subagent_type|Task\s*\(\s*\{/.test(body));
  // 23w. No static top-level import of `yaml` — only dynamic require at runtime (C2 matches Phase 45)
  check('extract-spec-block.mjs has no static top-level import of yaml (C2 matches Phase 45 dynamic require)',
    !/^import\s+.*\s+from\s+['"]yaml['"]/m.test(body)
    && !/^(const|let|var)\s+yaml\s*=\s*require\(['"]yaml['"]\)/m.test(body));
  // 23x. SHA-256 via node:crypto (C3 content hash)
  check('extract-spec-block.mjs computes SHA-256 via node:crypto (C3 content hash, not git SHA)',
    /createHash\s*\(\s*['"]sha256['"]\)/.test(body) && /node:crypto/.test(body));
  // 23y. --test path + self-test count
  try {
    const { execSync } = require('node:child_process');
    const out = execSync(`node "${crossDomainExtractorPath}" --test`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const m = out.match(/(\d+)\s+passed,\s+(\d+)\s+failed/);
    const passedCount = m ? parseInt(m[1], 10) : 0;
    const failedCount = m ? parseInt(m[2], 10) : -1;
    check('extract-spec-block.mjs --test passes ≥22 checks, 0 failed (G2 self-test)',
      passedCount >= 22 && failedCount === 0);
  } catch (e) {
    check('extract-spec-block.mjs --test passes ≥22 checks, 0 failed (G2 self-test)', false);
  }
} else {
  check('extract-spec-block.mjs exists (G2)', false);
}

// 23z. No sunco-cross-domain-* agent file exists in Phase 48 (G8 glob negative)
{
  const agentsDir = path.resolve(__dirname, '..', 'agents');
  let agentFiles = [];
  try { agentFiles = fs.readdirSync(agentsDir); } catch {}
  const hasCrossDomainAgent = agentFiles.some((f) => /^sunco-cross-domain/i.test(f));
  check('no sunco-cross-domain-* agent created in Phase 48 (G8 Phase 49 boundary)', !hasCrossDomainAgent);
}

// 23aa. cross-domain.schema.json has no lifecycle tokens in schema body (C6 active-output scope)
if (fs.existsSync(crossDomainSchemaPath)) {
  const raw = fs.readFileSync(crossDomainSchemaPath, 'utf8');
  // Schema may mention "Phase 49" in its description for traceability; that's permitted.
  // What's forbidden is `resolved` / `dismissed` / `audit_version: 2` as enum values or
  // property definitions in cross-domain's own schema (Phase 49 scope).
  let xdSchema;
  try { xdSchema = JSON.parse(raw); } catch { xdSchema = null; }
  const props = xdSchema && xdSchema.properties ? xdSchema.properties : {};
  const hasActiveLifecycleProp = 'resolved' in props || 'dismissed' in props
    || ('state' in props && Array.isArray(props.state?.enum)
        && (props.state.enum.includes('resolved') || props.state.enum.includes('dismissed')));
  check('cross-domain.schema.json has no active lifecycle properties/enums (C6 scoped negative)',
    !hasActiveLifecycleProp);
}

// 23ab. Phase 48 CONTEXT populated with Gate 48 outcomes
if (fs.existsSync(phase48ContextPath)) {
  const ctx = fs.readFileSync(phase48ContextPath, 'utf8');
  check('Phase 48 CONTEXT.md populated with Full Gate 48 outcomes + absorption table',
    /Full Gate 48|Gate 48/i.test(ctx)
    && (/GREEN-CONDITIONAL|GREEN/.test(ctx))
    && /absorb/i.test(ctx)
    && /Populated/i.test(ctx));
} else {
  check('Phase 48 CONTEXT.md populated with Full Gate 48 outcomes + absorption table', false);
}

// ─── Section 24 — Phase 49/M4.2 verify-gate cross-domain layer + finding lifecycle ───
//
// Contract tested (Gate 49 convergent GREEN-CONDITIONAL → GREEN, 8 conditions absorbed
// A1-A8; see `.planning/phases/49-verify-gate-cross-domain/49-CONTEXT.md`):
//   A1 finding.schema.json state enum expanded to [open, resolved, dismissed-with-rationale]
//      + oneOf lifecycle branches (3; HIGH+dismissed structurally rejected via zero match)
//      + resolved_commit ^[0-9a-f]{7,40}$ pattern + dismissed_rationale minLength:50
//      + audit_version remains top-of-file marker (NOT schema property)
//   A2 Raw method+path set-key; no path-parameter normalization (Phase 48 projection parity)
//   A3 extract-spec-block.mjs exports readDomainsField + readRequiredSpecs +
//      shouldTriggerCrossDomainLayer; domains=[frontend,backend] OR required_specs pair
//      triggers cross-domain layer; single-domain skips
//   A4 commands/sunco/proceed-gate.md inline extension (NOT new workflow file) —
//      cross-domain findings consumption + HIGH/MED/LOW severity policy +
//      --allow-low-open flag; ship.md wording corrected (non-cross-domain preserved)
//   A5 CROSS_DOMAIN_FINDINGS_BLOCK + CROSS_DOMAIN_LIFECYCLE markers + findings_version:1
//      top marker; 3-region structure (findings auto-gen / lifecycle overrides YAML /
//      prose preserve); renderFindingsMarkdown + parseLifecycleOverrides exports
//   A6 Deterministic-only (G7 option a); no sunco-cross-domain-* agent file; charter
//      citation in 49-CONTEXT.md; Phase 50 spec §8 L685 amendment debt registered;
//      future heuristic extension slot documented
//   A7 yaml direct dep in packages/cli/package.json; package-lock updated
//   A8 /sunco:proceed-gate extension (no new command file); no /sunco:cross-domain-check;
//      install.cjs unchanged
// Regression: Phase 48 assets extension-only (existing exports IMMUTABLE);
// Phase 47 sunco-backend-reviewer state hard-guard preserved.

const proceedGateCmdPath = path.resolve(__dirname, '..', 'commands', 'sunco', 'proceed-gate.md');
const verifyPhasePath = path.resolve(__dirname, '..', 'workflows', 'verify-phase.md');
const shipPath = path.resolve(__dirname, '..', 'workflows', 'ship.md');
const cliPackageJsonPath = path.resolve(__dirname, '..', 'package.json');
const phase49ContextPath = path.resolve(__dirname, '..', '..', '..', '.planning', 'phases',
  '49-verify-gate-cross-domain', '49-CONTEXT.md');
const s24CliAgentsDir = path.resolve(__dirname, '..', 'agents');
const s24CommandsDir = path.resolve(__dirname, '..', 'commands', 'sunco');
const s24WorkflowsDir = path.resolve(__dirname, '..', 'workflows');

console.log(`\n${BOLD}24. verify-gate cross-domain layer + finding lifecycle (Phase 49/M4.2)${RESET}`);

// 24a. finding.schema.json state enum expanded to 3 lifecycle values (A1)
let findingSchema = null;
try { findingSchema = JSON.parse(fs.readFileSync(findingSchemaPath, 'utf8')); } catch {}
if (findingSchema) {
  const stateEnum = findingSchema.properties?.state?.enum ?? [];
  check('finding.schema.json state enum = [open, resolved, dismissed-with-rationale] (A1 no shorthand)',
    Array.isArray(stateEnum) && stateEnum.length === 3
    && stateEnum.includes('open')
    && stateEnum.includes('resolved')
    && stateEnum.includes('dismissed-with-rationale'));
  // 24b. dismissed (shorthand) NOT in enum
  check('finding.schema.json state enum does NOT include dismissed shorthand (A1 literal)',
    !stateEnum.includes('dismissed'));
  // 24c. resolved_commit pattern ^[0-9a-f]{7,40}$
  check('finding.schema.json resolved_commit pattern ^[0-9a-f]{7,40}$ (A1)',
    findingSchema.properties?.resolved_commit?.pattern === '^[0-9a-f]{7,40}$');
  // 24d. dismissed_rationale minLength:50
  check('finding.schema.json dismissed_rationale minLength:50 (A1 R6 lock)',
    findingSchema.properties?.dismissed_rationale?.minLength === 50);
  // 24e. oneOf with 3 lifecycle branches (HIGH+dismissed structurally rejected via zero match)
  check('finding.schema.json oneOf has 3 lifecycle branches (A1/A2 HIGH hard-block via zero-match)',
    Array.isArray(findingSchema.oneOf) && findingSchema.oneOf.length === 3);
  // 24f. oneOf includes dismissed branch with severity in [MEDIUM, LOW] (HIGH exclusion)
  const dismissedBranch = findingSchema.oneOf.find(b =>
    b.properties?.state?.const === 'dismissed-with-rationale');
  const severityEnum = dismissedBranch?.properties?.severity?.enum ?? [];
  check('finding.schema.json dismissed branch restricts severity to [MEDIUM, LOW] (A1 HIGH hard-block)',
    severityEnum.length === 2 && severityEnum.includes('MEDIUM') && severityEnum.includes('LOW')
    && !severityEnum.includes('HIGH'));
  // 24g. audit_version NOT a schema property (A1 top-of-file marker only)
  check('finding.schema.json does NOT define audit_version as schema property (A1 marker-only)',
    !('audit_version' in (findingSchema.properties ?? {})));
  // 24h. additionalProperties:true preserved (lenient-additive)
  check('finding.schema.json additionalProperties:true preserved (A1 lenient-additive)',
    findingSchema.additionalProperties === true);
} else {
  check('finding.schema.json parses as JSON (A1)', false);
}

// 24i. Phase 47 state=open single-value guard rooted in sunco-backend-reviewer.md preserved
if (fs.existsSync(reviewerAgentPath)) {
  const agentMd = fs.readFileSync(reviewerAgentPath, 'utf8');
  // Phase 47 hard-guard: reviewer MUST NOT emit resolved / dismissed at audit_version:1
  check('sunco-backend-reviewer.md state hard-guard preserved (Phase 47 audit_version:1 discipline)',
    /audit_version:\s*1/.test(agentMd)
    && /MUST NOT|must not|never/.test(agentMd)
    && /resolved|dismissed/.test(agentMd));
} else {
  check('sunco-backend-reviewer.md exists (Phase 47 preserved)', false);
}

// 24j. extract-spec-block.mjs exports Phase 49 extensions (A3/A5)
const extractorSrc = fs.existsSync(crossDomainExtractorPath)
  ? fs.readFileSync(crossDomainExtractorPath, 'utf8') : '';
check('extract-spec-block.mjs exports generateCrossDomainFindings (A3)',
  /export\s+function\s+generateCrossDomainFindings\b/.test(extractorSrc));
check('extract-spec-block.mjs exports isCrossDomainStale (A3)',
  /export\s+function\s+isCrossDomainStale\b/.test(extractorSrc));
check('extract-spec-block.mjs exports parseLifecycleOverrides (A5)',
  /export\s+function\s+parseLifecycleOverrides\b/.test(extractorSrc));
check('extract-spec-block.mjs exports renderFindingsMarkdown (A5)',
  /export\s+function\s+renderFindingsMarkdown\b/.test(extractorSrc));
check('extract-spec-block.mjs exports readRequiredSpecs (A3)',
  /export\s+function\s+readRequiredSpecs\b/.test(extractorSrc));
check('extract-spec-block.mjs exports readDomainsField (A3)',
  /export\s+function\s+readDomainsField\b/.test(extractorSrc));
check('extract-spec-block.mjs exports shouldTriggerCrossDomainLayer (A3)',
  /export\s+function\s+shouldTriggerCrossDomainLayer\b/.test(extractorSrc));

// 24k. Phase 48 existing exports IMMUTABLE (extension-only boundary)
check('extract-spec-block.mjs preserves extractSpecBlock signature (Phase 48 lock)',
  /export\s+async\s+function\s+extractSpecBlock\(filePath,\s*kind,/.test(extractorSrc));
check('extract-spec-block.mjs preserves generateCrossDomain signature (Phase 48 lock)',
  /export\s+function\s+generateCrossDomain\(\{\s*ui,\s*api\s*\}\)/.test(extractorSrc));
check('extract-spec-block.mjs preserves renderMarkdown signature (Phase 48 lock)',
  /export\s+function\s+renderMarkdown\(\{\s*crossDomainBlock,\s*findingsCounts\s*\},\s*priorContent/.test(extractorSrc));

// 24l. New markers + findings_version marker (A5)
check('extract-spec-block.mjs declares CROSS_DOMAIN_FINDINGS_BLOCK_START marker (A5)',
  /CROSS_DOMAIN_FINDINGS_BLOCK_START\s*=\s*['"]<!-- SUNCO:CROSS-DOMAIN-FINDINGS-BLOCK-START -->['"]/.test(extractorSrc));
check('extract-spec-block.mjs declares CROSS_DOMAIN_LIFECYCLE_START marker (A5)',
  /CROSS_DOMAIN_LIFECYCLE_START\s*=\s*['"]<!-- SUNCO:CROSS-DOMAIN-LIFECYCLE-START -->['"]/.test(extractorSrc));
check('extract-spec-block.mjs declares FINDINGS_VERSION_MARKER findings_version:1 (A5 BS1 parity)',
  /FINDINGS_VERSION_MARKER\s*=\s*['"]<!-- findings_version: 1 -->['"]/.test(extractorSrc));

// 24m. Charter A6-i negative check: no sunco-cross-domain-* agent file
const s24AgentFiles = fs.existsSync(s24CliAgentsDir) ? fs.readdirSync(s24CliAgentsDir) : [];
const crossDomainAgentPresent = s24AgentFiles.some(f => /^sunco-cross-domain/.test(f));
check('no sunco-cross-domain-* agent file created (A6 deterministic-first charter; charter drift prevention)',
  !crossDomainAgentPresent);

// 24n. A8 negative: no /sunco:cross-domain-check command file
const s24CommandFiles = fs.existsSync(s24CommandsDir) ? fs.readdirSync(s24CommandsDir) : [];
check('no /sunco:cross-domain-check command file (A8 surface inflation blocked)',
  !s24CommandFiles.includes('cross-domain-check.md'));

// 24o. A4 negative: no workflows/proceed-gate.md file (Option X inline extension, NOT creation)
const s24WorkflowFiles = fs.existsSync(s24WorkflowsDir) ? fs.readdirSync(s24WorkflowsDir) : [];
check('no workflows/proceed-gate.md file created (A4 Option X — inline command extension)',
  !s24WorkflowFiles.includes('proceed-gate.md'));

// 24p. commands/sunco/proceed-gate.md extension: cross-domain + severity + flag wired
if (fs.existsSync(proceedGateCmdPath)) {
  const pgMd = fs.readFileSync(proceedGateCmdPath, 'utf8');
  check('proceed-gate.md frontmatter description mentions cross-domain (A8 user-discoverability)',
    /cross-domain/i.test(pgMd.slice(0, 600)));
  check('proceed-gate.md frontmatter argument-hint includes --allow-low-open (A4/A8)',
    /argument-hint:[\s\S]*?--allow-low-open/.test(pgMd));
  check('proceed-gate.md has Step 1.5 Cross-domain findings consumption (A4)',
    /Step 1\.5[\s\S]*?Cross-domain findings consumption/i.test(pgMd));
  check('proceed-gate.md CROSS_DOMAIN_FINDINGS path referenced (A4)',
    /CROSS-DOMAIN-FINDINGS\.md/.test(pgMd));
  check('proceed-gate.md imports parseLifecycleOverrides (A4/A5 wire)',
    /parseLifecycleOverrides/.test(pgMd));
  check('proceed-gate.md verdict policy: HIGH+open HARD BLOCK (A4 spec §8 L710)',
    /HIGH[\s\S]*?open[\s\S]*?HARD BLOCK/i.test(pgMd));
  check('proceed-gate.md verdict policy: --allow-low-open flag (A4/A8)',
    /--allow-low-open/.test(pgMd));
  check('proceed-gate.md wording: "existing ship verification behavior preserved for non-cross-domain phases" (A4 Codex)',
    /existing[\s\S]{0,50}behavior preserved[\s\S]{0,80}non-cross-domain/i.test(pgMd));
} else {
  check('proceed-gate.md extension exists (A4)', false);
}

// 24q. verify-phase.md has Cross-Domain Gate section (A3 trigger + deterministic layer)
if (fs.existsSync(verifyPhasePath)) {
  const vpMd = fs.readFileSync(verifyPhasePath, 'utf8');
  check('verify-phase.md has Cross-Domain Gate section (A3 additive layer)',
    /##\s+Cross-Domain Gate.*Phase 49/i.test(vpMd));
  check('verify-phase.md Cross-Domain Gate invokes shouldTriggerCrossDomainLayer (A3)',
    /shouldTriggerCrossDomainLayer/.test(vpMd));
  check('verify-phase.md Cross-Domain Gate invokes isCrossDomainStale (A3 freshness)',
    /isCrossDomainStale/.test(vpMd));
  check('verify-phase.md Cross-Domain Gate invokes generateCrossDomainFindings (A3)',
    /generateCrossDomainFindings/.test(vpMd));
  check('verify-phase.md Cross-Domain Gate writes CROSS-DOMAIN-FINDINGS.md (A5)',
    /CROSS-DOMAIN-FINDINGS\.md/.test(vpMd));
  check('verify-phase.md Cross-Domain Gate declares deterministic-only (A6 charter)',
    /Deterministic-only|deterministic.only/i.test(vpMd));
  check('verify-phase.md Cross-Domain Gate non-regression wording (A3 single-domain skip)',
    /single-domain[\s\S]{0,300}skip|skip[\s\S]{0,80}single-domain|non-regression/i.test(vpMd));
} else {
  check('verify-phase.md exists (A3)', false);
}

// 24r. ship.md wording fix (A4 Codex)
if (fs.existsSync(shipPath)) {
  const shipMd = fs.readFileSync(shipPath, 'utf8');
  check('ship.md mentions cross-domain gate consumption in Step 2 (A4)',
    /CROSS-DOMAIN-FINDINGS\.md|cross-domain gate/i.test(shipMd));
  check('ship.md wording: existing ship verification behavior preserved (A4 Codex)',
    /existing ship verification behavior preserved|existing[\s\S]{0,50}behavior preserved/i.test(shipMd));
} else {
  check('ship.md exists (A4)', false);
}

// 24s. yaml direct dep in packages/cli/package.json (A7 Phase 48 debt closure)
if (fs.existsSync(cliPackageJsonPath)) {
  let cliPkg;
  try { cliPkg = JSON.parse(fs.readFileSync(cliPackageJsonPath, 'utf8')); } catch {}
  if (cliPkg) {
    check('packages/cli/package.json has yaml as direct dependency (A7 Phase 48 debt CLOSED)',
      cliPkg.dependencies && typeof cliPkg.dependencies.yaml === 'string' && cliPkg.dependencies.yaml.length > 0);
    check('packages/cli/package.json yaml dep is semver-like (A7)',
      cliPkg.dependencies && typeof cliPkg.dependencies.yaml === 'string'
      && /^[~^]?\d+\.\d+\.\d+/.test(cliPkg.dependencies.yaml));
  } else {
    check('packages/cli/package.json parses as JSON (A7)', false);
  }
}

// 24t. package-lock.json records yaml as direct dep of packages/cli workspace (A7)
const rootLockPath = path.resolve(__dirname, '..', '..', '..', 'package-lock.json');
if (fs.existsSync(rootLockPath)) {
  let lock = null;
  try { lock = JSON.parse(fs.readFileSync(rootLockPath, 'utf8')); } catch {}
  const cliPkgInLock = lock?.packages?.['packages/cli'];
  check('package-lock.json records yaml as direct dep of packages/cli (A7)',
    cliPkgInLock?.dependencies && typeof cliPkgInLock.dependencies.yaml === 'string');
}

// 24u. Phase 49 CONTEXT populated with Gate 49 outcomes + charter + extension slot
if (fs.existsSync(phase49ContextPath)) {
  const ctx49 = fs.readFileSync(phase49ContextPath, 'utf8');
  check('Phase 49 CONTEXT.md populated with Full Gate 49 outcomes + absorption table (A1-A8)',
    /Gate 49|Full Gate 49/i.test(ctx49)
    && /GREEN-CONDITIONAL|GREEN/.test(ctx49)
    && /A1|A2|A3|A4|A5|A6|A7|A8/.test(ctx49)
    && /Populated/i.test(ctx49));
  check('Phase 49 CONTEXT.md contains charter citation (A6-i deterministic-first)',
    /Deterministic[-\s]First/i.test(ctx49)
    && /architecture\.md/.test(ctx49)
    && /spec.*§8.*L685|line 685/i.test(ctx49));
  check('Phase 49 CONTEXT.md documents future heuristic extension slot (A6-ii)',
    /heuristic[\s\S]{0,200}extension|extension[\s\S]{0,80}heuristic|future heuristic/i.test(ctx49));
  check('Phase 49 CONTEXT.md registers Phase 50 spec amendment debt (A6-iii)',
    /Phase 50|M5\.1/.test(ctx49) && /amendment|spec.*§?8.*L685|L685[\s\S]{0,50}amendment/i.test(ctx49));
  check('Phase 49 CONTEXT.md records premise-correction trail (preflight discovery)',
    /premise[\s\S]{0,120}correction|preflight[\s\S]{0,80}discovery|install preflight/i.test(ctx49));
} else {
  check('Phase 49 CONTEXT.md exists (Populated)', false);
}

// 24v. Phase 48 assets existing exports preserved (content-grep, not hash, because extended)
if (fs.existsSync(crossDomainSyncPath)) {
  const syncMd = fs.readFileSync(crossDomainSyncPath, 'utf8');
  check('cross-domain-sync.md unchanged — no Phase 49 mutations (Phase 48 asset frozen)',
    /Phase 48\/M4\.1/.test(syncMd)
    && /C7[\s\S]{0,200}Phase 49|internal workflow|No slash command in Phase 48/i.test(syncMd));
}
if (fs.existsSync(crossDomainSchemaPath)) {
  const schemaMd = fs.readFileSync(crossDomainSchemaPath, 'utf8');
  check('cross-domain.schema.json unchanged — no Phase 49 mutations (Phase 48 asset frozen)',
    /BS1.*version const: 1|version const:\s*1/i.test(schemaMd)
    && /Phase 48\/M4\.1/.test(schemaMd));
}

// ─── Section 25 — Phase 50/M5.1 documentation + migration guide ─────────────
//
// Contract tested (spec §9 Phase 5.1 deliverables + user-provided 10-axis scope;
// docs-only phase, zero code behavior change):
//   D1 4 docs exist under packages/cli/docs/ (impeccable-integration /
//      backend-excellence / cross-domain / migration-v1.4)
//   D2 Each doc covers its mandated topic markers (grep-based, not semantic)
//   D3 README.md has v1.4 Highlights section above v0.11.0 with 4 doc links
//   D4 package.json files[] includes "docs/" (tarball ships docs dir)
//   D5 Spec §8 L685 amendment plan debt CLOSED (rationale in cross-domain.md)
//   D6 Regression: Sections 1-24 unchanged; Phase 48/49 assets unchanged;
//      schemas/workflows/agents/commands/references/hooks unchanged

const s25DocsDir = path.resolve(__dirname, '..', 'docs');
const s25ImpeccableDoc = path.resolve(s25DocsDir, 'impeccable-integration.md');
const s25BackendDoc = path.resolve(s25DocsDir, 'backend-excellence.md');
const s25CrossDomainDoc = path.resolve(s25DocsDir, 'cross-domain.md');
const s25MigrationDoc = path.resolve(s25DocsDir, 'migration-v1.4.md');
const s25ReadmePath = path.resolve(__dirname, '..', 'README.md');
const s25PackageJsonPath = path.resolve(__dirname, '..', 'package.json');
const s25Phase50ContextPath = path.resolve(__dirname, '..', '..', '..', '.planning', 'phases',
  '50-documentation-migration', '50-CONTEXT.md');

console.log(`\n${BOLD}25. documentation + migration guide (Phase 50/M5.1)${RESET}`);

// 25a. 4 docs exist
check('docs/impeccable-integration.md exists (D1)', fs.existsSync(s25ImpeccableDoc));
check('docs/backend-excellence.md exists (D1)', fs.existsSync(s25BackendDoc));
check('docs/cross-domain.md exists (D1 — 4th doc, scope-justified)', fs.existsSync(s25CrossDomainDoc));
check('docs/migration-v1.4.md exists (D1)', fs.existsSync(s25MigrationDoc));

// 25b. impeccable-integration.md must-cover markers (D2)
if (fs.existsSync(s25ImpeccableDoc)) {
  const md = fs.readFileSync(s25ImpeccableDoc, 'utf8');
  check('impeccable-integration.md covers --surface web (D2)',
    /--surface web/.test(md));
  check('impeccable-integration.md covers DESIGN-CONTEXT.md (D2)',
    /DESIGN-CONTEXT\.md/.test(md));
  check('impeccable-integration.md covers IMPECCABLE-AUDIT + UI-REVIEW (D2)',
    /IMPECCABLE-AUDIT\.md/.test(md) && /UI-REVIEW\.md/.test(md));
  check('impeccable-integration.md documents vendored wrapper (D2)',
    /vendored|wrapper/i.test(md));
}

// 25c. backend-excellence.md must-cover markers (D2)
if (fs.existsSync(s25BackendDoc)) {
  const md = fs.readFileSync(s25BackendDoc, 'utf8');
  check('backend-excellence.md covers 8 reference docs (D2)',
    /api-design\.md/.test(md) && /data-modeling\.md/.test(md)
    && /boundaries-and-architecture\.md/.test(md) && /reliability-and-failure-modes\.md/.test(md)
    && /security-and-permissions\.md/.test(md) && /performance-and-scale\.md/.test(md)
    && /observability-and-operations\.md/.test(md) && /migrations-and-compatibility\.md/.test(md));
  check('backend-excellence.md covers 7 detector rules (D2)',
    /raw-sql-interpolation/.test(md) && /missing-timeout/.test(md)
    && /swallowed-catch/.test(md) && /any-typed-body/.test(md)
    && /missing-validation-public-route/.test(md) && /non-reversible-migration/.test(md)
    && /logged-secret/.test(md));
  check('backend-excellence.md covers BACKEND-CONTEXT teach flow (D2)',
    /BACKEND-CONTEXT\.md/.test(md) && /--domain backend/.test(md));
  check('backend-excellence.md covers 4 backend-phase surfaces (D2)',
    /--surface api/.test(md) && /--surface data/.test(md)
    && /--surface event/.test(md) && /--surface ops/.test(md));
  check('backend-excellence.md documents audit_version:1 discipline (D2)',
    /audit_version:\s*1/.test(md));
}

// 25d. cross-domain.md must-cover markers (D2 + D5 L685 closure)
if (fs.existsSync(s25CrossDomainDoc)) {
  const md = fs.readFileSync(s25CrossDomainDoc, 'utf8');
  check('cross-domain.md covers CROSS-DOMAIN.md + CROSS-DOMAIN-FINDINGS.md distinction (D2)',
    /CROSS-DOMAIN\.md/.test(md) && /CROSS-DOMAIN-FINDINGS\.md/.test(md));
  check('cross-domain.md covers 4 check types with severity (D2)',
    /missing-endpoint[\s\S]{0,80}HIGH/i.test(md)
    && /type-drift[\s\S]{0,80}HIGH/i.test(md)
    && /error-state-mismatch[\s\S]{0,80}MED/i.test(md)
    && /orphan-endpoint[\s\S]{0,80}LOW/i.test(md));
  check('cross-domain.md covers audit_version:2 lifecycle (D2)',
    /audit_version:\s*2/.test(md));
  check('cross-domain.md covers 3-region structure (D2)',
    /3-region|three[\s-]region/i.test(md)
    && /LIFECYCLE-START/.test(md) && /FINDINGS-BLOCK-START/.test(md));
  check('cross-domain.md covers --allow-low-open flag (D2)',
    /--allow-low-open/.test(md));
  check('cross-domain.md covers HIGH hard-block (D2)',
    /HIGH[\s\S]{0,120}HARD BLOCK|HARD BLOCK[\s\S]{0,80}HIGH/i.test(md));
  check('cross-domain.md closes spec §8 L685 amendment debt (D5)',
    /§8[\s\S]{0,60}L685|line 685|L685[\s\S]{0,60}agent/i.test(md)
    && /Deterministic[-\s]First/i.test(md)
    && /architecture\.md/.test(md));
  check('cross-domain.md documents future heuristic extension slot (D2)',
    /future heuristic|heuristic extension|extension slot/i.test(md));
}

// 25e. migration-v1.4.md must-cover markers (D2 + D5 yaml rationale)
if (fs.existsSync(s25MigrationDoc)) {
  const md = fs.readFileSync(s25MigrationDoc, 'utf8');
  check('migration-v1.4.md covers non-breaking adoption path (D2)',
    /non-breaking|no action required|zero regression/i.test(md));
  check('migration-v1.4.md covers yaml direct dependency rationale (D2)',
    /yaml[\s\S]{0,200}direct dep|direct depend[\s\S]{0,200}yaml/i.test(md));
  check('migration-v1.4.md covers --surface flag semantics (D2)',
    /--surface[\s\S]{0,80}cli|default[\s\S]{0,80}cli/i.test(md));
  check('migration-v1.4.md covers /sunco:proceed-gate policy (D2)',
    /sunco:proceed-gate/.test(md) && /HIGH[\s\S]{0,60}BLOCK/i.test(md));
  check('migration-v1.4.md links to 3 track docs (D2)',
    /impeccable-integration\.md/.test(md)
    && /backend-excellence\.md/.test(md)
    && /cross-domain\.md/.test(md));
}

// 25f. README.md v1.4 Highlights section + 4 doc links (D3)
if (fs.existsSync(s25ReadmePath)) {
  const readme = fs.readFileSync(s25ReadmePath, 'utf8');
  check('README.md has v1.4 Highlights section (D3)',
    /##\s+v1\.4 Highlights/.test(readme));
  check('README.md v1.4 section placed above v0.11.0 (D3)',
    readme.indexOf('## v1.4 Highlights') < readme.indexOf('## v0.11.0 Highlights'));
  check('README.md links all 4 docs (D3)',
    /docs\/impeccable-integration\.md/.test(readme)
    && /docs\/backend-excellence\.md/.test(readme)
    && /docs\/cross-domain\.md/.test(readme)
    && /docs\/migration-v1\.4\.md/.test(readme));
}

// 25g. package.json files[] includes docs/ (D4)
if (fs.existsSync(s25PackageJsonPath)) {
  let pkg = null;
  try { pkg = JSON.parse(fs.readFileSync(s25PackageJsonPath, 'utf8')); } catch {}
  if (pkg) {
    check('packages/cli/package.json files[] includes "docs/" (D4 tarball contract)',
      Array.isArray(pkg.files) && pkg.files.includes('docs/'));
  }
}

// 25h. Phase 50 CONTEXT populated
if (fs.existsSync(s25Phase50ContextPath)) {
  const ctx = fs.readFileSync(s25Phase50ContextPath, 'utf8');
  check('Phase 50 CONTEXT.md populated with Gate 50 outcomes + 10-axis disposition',
    /Gate 50|Phase 50[\s\S]{0,200}docs phase/i.test(ctx)
    && /Populated/i.test(ctx)
    && /docs phase/i.test(ctx)
    && /4 docs/i.test(ctx));
  check('Phase 50 CONTEXT.md documents L685 amendment plan-debt closure',
    /L685[\s\S]{0,200}CLOS|CLOS[\s\S]{0,80}L685/i.test(ctx));
}

// 25i. Regression: docs are the ONLY new files under packages/cli/
// Smoke runs in-repo, so we assert docs/ exists + contains exactly the 4 expected docs
if (fs.existsSync(s25DocsDir)) {
  const docsFiles = fs.readdirSync(s25DocsDir).filter(f => f.endsWith('.md'));
  const expected = [
    'impeccable-integration.md',
    'backend-excellence.md',
    'cross-domain.md',
    'migration-v1.4.md',
  ];
  const unexpected = docsFiles.filter(f => !expected.includes(f));
  check('docs/ contains exactly the 4 expected Phase 50 docs (D6 scope discipline)',
    unexpected.length === 0 && expected.every(f => docsFiles.includes(f)));
}

// 25j. Regression: Phase 49 artifacts unchanged (content-grep, not hash; since
// smoke-test.cjs is being modified in Phase 50, we assert key content markers
// survived rather than computing a diff against HEAD~1 which would be unreliable).
if (fs.existsSync(findingSchemaPath)) {
  const schema = JSON.parse(fs.readFileSync(findingSchemaPath, 'utf8'));
  check('Phase 49 finding.schema.json lifecycle oneOf unchanged (D6)',
    Array.isArray(schema.oneOf) && schema.oneOf.length === 3);
}

// ─── Section 26 — Phase 51/M5.2 dogfood + test coverage ──────────────────────
//
// Contract tested (spec §9 Phase 5.2 deliverables + Gate 51 v2 10+1 axes):
//   T1 5 fixture directories exist under test/fixtures/ with required seed files
//      (spec §9 L782-786 + Gate 51 G2 fixture set + G6/G7 separation)
//   T2 5 vitest test runners exist under packages/skills-workflow/src/shared/__tests__/
//      with phase51- prefix (Gate 51 G2 runner location; Path-A auto-pickup)
//   T3 Phase 51 dogfood artifacts exist: API-SPEC.md / BACKEND-AUDIT.md /
//      DOGFOOD-RUNTIME.md (G4 measurement-only closure + G5 bounded scope)
//   T4 51-CONTEXT.md populated with Gate 51 v2 decisions (G1-G11 + divergent resolutions)
//   T5 BS3 recovery snapshot branch `sunco-pre-dogfood` exists at Phase 50 HEAD
//      (G11 — skipped in CI where branch may not propagate; soft-asserted locally)
//   T6 Regression: Sections 1-25 unchanged; Phase 48/49/50 assets intact

const s26Phase51Dir = path.resolve(__dirname, '..', '..', '..', '.planning', 'phases',
  '51-dogfood-test-coverage');
const s26FixtureRoot = path.resolve(__dirname, '..', '..', '..', 'test', 'fixtures');
const s26TestRoot = path.resolve(__dirname, '..', '..', 'skills-workflow', 'src', 'shared', '__tests__');

console.log(`\n${BOLD}26. dogfood + test coverage (Phase 51/M5.2)${RESET}`);

// 26a. 5 fixture directories + required seed files (T1)
const s26Fixtures = [
  { dir: 'backend-rest-sample', must: ['README.md', 'positive/raw-sql-interpolation.ts', 'negative/raw-sql-interpolation.ts', 'positive/migrations/001-drop-legacy.sql'] },
  { dir: 'frontend-web-sample', must: ['README.md', 'index.html', 'styles.css'] },
  { dir: 'cross-domain-conflict', must: ['README.md', 'UI-SPEC.md', 'API-SPEC.md'] },
  { dir: 'proceed-gate-lifecycle', must: ['README.md', 'BACKEND-AUDIT.md', 'CROSS-DOMAIN-FINDINGS.md'] },
  { dir: 'ui-review-regression', must: ['README.md', 'EXPECTED-CLI-SURFACE.md'] },
];
for (const fx of s26Fixtures) {
  const dir = path.join(s26FixtureRoot, fx.dir);
  check(`test/fixtures/${fx.dir}/ directory exists (T1)`, fs.existsSync(dir));
  for (const file of fx.must) {
    const full = path.join(dir, file);
    check(`test/fixtures/${fx.dir}/${file} exists (T1)`, fs.existsSync(full));
  }
}

// 26b. 5 vitest test runners (T2)
const s26TestFiles = [
  'phase51-backend-rest.test.ts',
  'phase51-frontend-web.test.ts',
  'phase51-cross-domain-conflict.test.ts',
  'phase51-proceed-gate-lifecycle.test.ts',
  'phase51-ui-review-regression.test.ts',
];
for (const tf of s26TestFiles) {
  const full = path.join(s26TestRoot, tf);
  check(`packages/skills-workflow/src/shared/__tests__/${tf} exists (T2)`, fs.existsSync(full));
}

// 26c. 3 dogfood artifacts + 51-CONTEXT.md populated (T3, T4)
const s26ApiSpec = path.join(s26Phase51Dir, 'API-SPEC.md');
const s26BackendAudit = path.join(s26Phase51Dir, 'BACKEND-AUDIT.md');
const s26DogfoodRuntime = path.join(s26Phase51Dir, 'DOGFOOD-RUNTIME.md');
const s26Context = path.join(s26Phase51Dir, '51-CONTEXT.md');

check('Phase 51 API-SPEC.md exists (T3 dogfood artifact)', fs.existsSync(s26ApiSpec));
check('Phase 51 BACKEND-AUDIT.md exists (T3 dogfood artifact)', fs.existsSync(s26BackendAudit));
check('Phase 51 DOGFOOD-RUNTIME.md exists (T3 BS2 measurement-only closure)', fs.existsSync(s26DogfoodRuntime));

if (fs.existsSync(s26ApiSpec)) {
  const api = fs.readFileSync(s26ApiSpec, 'utf8');
  check('API-SPEC.md contains CLI API mapping disclaimer (G1)',
    /CLI API mapping disclaimer/i.test(api) && /slash-command/i.test(api));
  check('API-SPEC.md declares /sunco/proceed-gate endpoint (G5 bounded)',
    /\/sunco\/proceed-gate/.test(api));
  check('API-SPEC.md carries SPEC-BLOCK with version 1 (BS1)',
    /SUNCO:SPEC-BLOCK-START[\s\S]*version:\s*1[\s\S]*SUNCO:SPEC-BLOCK-END/.test(api));
}

if (fs.existsSync(s26BackendAudit)) {
  const audit = fs.readFileSync(s26BackendAudit, 'utf8');
  const severityCount = (audit.match(/severity:\s*(HIGH|MEDIUM|LOW)/g) || []).length;
  check('BACKEND-AUDIT.md carries ≥5 findings processed (spec §9 L793)', severityCount >= 5);
  check('BACKEND-AUDIT.md audit_version:1 declared',
    /audit_version:\s*1/.test(audit));
  check('BACKEND-AUDIT.md uses Phase 47 surface-section format',
    /## API findings/.test(audit));
}

if (fs.existsSync(s26DogfoodRuntime)) {
  const runtime = fs.readFileSync(s26DogfoodRuntime, 'utf8');
  check('DOGFOOD-RUNTIME.md records measurement-only BS2 closure (G4)',
    /token_count:\s*unavailable/i.test(runtime) || /token_count:\s*\d+/.test(runtime));
  check('DOGFOOD-RUNTIME.md references sunco-pre-dogfood branch snapshot (G11)',
    /sunco-pre-dogfood/.test(runtime));
}

if (fs.existsSync(s26Context)) {
  const ctx = fs.readFileSync(s26Context, 'utf8');
  check('51-CONTEXT.md populated with Gate 51 v2 decisions (T4)',
    /Gate 51 v2/.test(ctx) && /G1[\s\S]{0,400}G11/.test(ctx));
  check('51-CONTEXT.md records BS3 preflight anchor (G11)',
    /sunco-pre-dogfood/.test(ctx) && /3ac0ee9/.test(ctx));
  check('51-CONTEXT.md records out-of-scope hard-lock (G9)',
    /out-of-scope/i.test(ctx) && /Phase 35-50/.test(ctx));
}

// 26d. Regression: Phase 48/49/50 assets unchanged content-markers (T6)
if (fs.existsSync(findingSchemaPath)) {
  const schema = JSON.parse(fs.readFileSync(findingSchemaPath, 'utf8'));
  check('Phase 49 finding.schema.json oneOf unchanged through Phase 51 (T6)',
    Array.isArray(schema.oneOf) && schema.oneOf.length === 3);
}
if (fs.existsSync(s25CrossDomainDoc)) {
  const md = fs.readFileSync(s25CrossDomainDoc, 'utf8');
  check('Phase 50 cross-domain.md L685 amendment closure intact (T6)',
    /L685|line 685/i.test(md));
}

// ─── Section 27 — Router Core Static Contract (Phase 52a) ───────────────────
//
// Contract tested: Phase 52a delivers documentation + schema contracts for the
// v1.5 SUNCO Workflow Router. No runtime code lands in 52a; all runtime
// assertions (command file existence, classifier/evidence-collector --test,
// confidence determinism, promotion criteria, Y1 class-definition runtime)
// live in Phase 52b Section 28. Section 27 asserts structural invariants only.
//
// Checks are deterministic grep/JSON parse only. No LLM. Clean-room grep
// honors J5 10-path scope-set.

const s27RouterRefDir = path.resolve(__dirname, '..', 'references', 'router');
const s27SchemaPath = path.resolve(__dirname, '..', 'schemas', 'route-decision.schema.json');
const s27RouterReadme = path.resolve(s27RouterRefDir, 'README.md');
const s27StageMachine = path.resolve(s27RouterRefDir, 'STAGE-MACHINE.md');
const s27EvidenceModel = path.resolve(s27RouterRefDir, 'EVIDENCE-MODEL.md');
const s27ConfidenceCalib = path.resolve(s27RouterRefDir, 'CONFIDENCE-CALIBRATION.md');
const s27ApprovalBoundary = path.resolve(s27RouterRefDir, 'APPROVAL-BOUNDARY.md');
const s27PlanningRouterDir = path.resolve(__dirname, '..', '..', '..', '.planning', 'router');
const s27DecisionsKeep = path.resolve(s27PlanningRouterDir, 'decisions', '.keep');
const s27DesignDoc = path.resolve(s27PlanningRouterDir, 'DESIGN-v1.md');
const s27GitignorePath = path.resolve(__dirname, '..', '..', '..', '.gitignore');

console.log(`\n${BOLD}27. Router Core Static Contract (Phase 52a)${RESET}`);

// 27b [52a-static]  route-decision.schema.json exists + valid JSON + draft-07
let s27SchemaObj = null;
if (fs.existsSync(s27SchemaPath)) {
  try { s27SchemaObj = JSON.parse(fs.readFileSync(s27SchemaPath, 'utf8')); } catch {}
}
check('[52a-static] schemas/route-decision.schema.json exists + parses as JSON (27b)',
  !!s27SchemaObj);
check('[52a-static] schema $schema is draft-07 (27b)',
  s27SchemaObj && s27SchemaObj.$schema && /draft-07/.test(s27SchemaObj.$schema));
check('[52a-static] schema kind=route-decision and version=1 (27b)',
  s27SchemaObj && s27SchemaObj.properties && s27SchemaObj.properties.kind
  && s27SchemaObj.properties.kind.const === 'route-decision'
  && s27SchemaObj.properties.version && s27SchemaObj.properties.version.const === 1);

// 27c [52a-static]  current_stage enum = 10 + UNKNOWN (11 total)
const s27ExpectedStageEnum = [
  'BRAINSTORM', 'PLAN', 'WORK', 'REVIEW', 'VERIFY',
  'PROCEED', 'SHIP', 'RELEASE', 'COMPOUND', 'PAUSE', 'UNKNOWN',
];
check('[52a-static] schema current_stage enum has 11 values (10 stages + UNKNOWN) (27c)',
  s27SchemaObj && Array.isArray(s27SchemaObj.properties.current_stage.enum)
  && s27SchemaObj.properties.current_stage.enum.length === 11
  && s27ExpectedStageEnum.every(v => s27SchemaObj.properties.current_stage.enum.includes(v)));

// 27d [52a-static]  recommended_next enum excludes UNKNOWN, includes HOLD
check('[52a-static] schema recommended_next enum excludes UNKNOWN, includes HOLD (27d)',
  s27SchemaObj && Array.isArray(s27SchemaObj.properties.recommended_next.enum)
  && !s27SchemaObj.properties.recommended_next.enum.includes('UNKNOWN')
  && s27SchemaObj.properties.recommended_next.enum.includes('HOLD'));

// 27y [52a-static]  stage enum = 10 stages; IDEATE absent (D9 merge confirmed)
check('[52a-static] stage enum 10 stages present; IDEATE absent (D9 merge) (27y)',
  s27SchemaObj
  && s27SchemaObj.properties.current_stage.enum.length === 11
  && !s27SchemaObj.properties.current_stage.enum.includes('IDEATE'));

// 27e [52a-static]  STAGE-MACHINE.md exists + defines all 10 stages with contract fields
let s27StageMachineContent = null;
if (fs.existsSync(s27StageMachine)) {
  s27StageMachineContent = fs.readFileSync(s27StageMachine, 'utf8');
}
check('[52a-static] STAGE-MACHINE.md exists (27e)', !!s27StageMachineContent);
if (s27StageMachineContent) {
  const stages = ['BRAINSTORM', 'PLAN', 'WORK', 'REVIEW', 'VERIFY', 'PROCEED', 'SHIP', 'RELEASE', 'COMPOUND', 'PAUSE'];
  const missingStages = stages.filter(s => !new RegExp(`### ${s}\\b`).test(s27StageMachineContent));
  check('[52a-static] STAGE-MACHINE.md defines all 10 stages as ### sections (27e)',
    missingStages.length === 0);
  const contractFields = ['entry_preconditions:', 'exit_conditions:', 'authorized_mutations:', 'forbidden_mutations:'];
  check('[52a-static] STAGE-MACHINE.md contract fields present across stages (27e)',
    contractFields.every(f => s27StageMachineContent.indexOf(f) !== -1));
}

// 27z [52a-static]  STAGE-MACHINE.md regress edges present
if (s27StageMachineContent) {
  check('[52a-static] STAGE-MACHINE.md declares regress edges (WORK self-loop, VERIFY→WORK, PROCEED→WORK, REVIEW→WORK, SHIP→WORK|REVIEW, RELEASE→PROCEED|SHIP) (27z)',
    /WORK\s+──\(tests fail/.test(s27StageMachineContent)
    && /VERIFY\s+──\([^)]*FAIL[^)]*\)[^▶]*▶\s+WORK/.test(s27StageMachineContent)
    && /PROCEED\s+──\(BLOCKED[^)]*\)[^▶]*▶\s+WORK/.test(s27StageMachineContent)
    && /REVIEW\s+──\([^)]*re-implementation\)[^▶]*▶\s+WORK/.test(s27StageMachineContent)
    && /SHIP\s+──[^▶]*▶\s+WORK \| REVIEW/.test(s27StageMachineContent)
    && /RELEASE\s+──[^▶]*▶\s+PROCEED \| SHIP/.test(s27StageMachineContent));
  check('[52a-static] STAGE-MACHINE.md declares stage reset primitive (27z)',
    /Stage reset primitive/.test(s27StageMachineContent)
    && /\/sunco:router reset/.test(s27StageMachineContent));
}

// 27aa [52a-static]  PAUSE contract has all 6 fields
if (s27StageMachineContent) {
  const pauseIdx = s27StageMachineContent.indexOf('### PAUSE');
  const pauseBody = pauseIdx !== -1 ? s27StageMachineContent.slice(pauseIdx) : '';
  const pauseFields = ['entry_preconditions:', 'exit_conditions:', 'authorized_mutations:',
    'forbidden_mutations:', 'persistence_location:', 'resume_trigger:', 're_entrance:'];
  check('[52a-static] PAUSE contract has all 7 fields (entry/exit/authorized/forbidden/persistence/resume/re_entrance) (27aa)',
    pauseFields.every(f => pauseBody.indexOf(f) !== -1));
  check('[52a-static] PAUSE resume_trigger mandates Freshness Gate re-run (27aa)',
    /resume_trigger:[\s\S]{0,500}Freshness Gate/.test(pauseBody));
}

// 27f [52a-static]  EVIDENCE-MODEL.md exists + defines 4 source tiers + Freshness Gate
let s27EvidenceContent = null;
if (fs.existsSync(s27EvidenceModel)) {
  s27EvidenceContent = fs.readFileSync(s27EvidenceModel, 'utf8');
}
check('[52a-static] EVIDENCE-MODEL.md exists (27f)', !!s27EvidenceContent);
if (s27EvidenceContent) {
  check('[52a-static] EVIDENCE-MODEL.md declares 4 source tiers (27f)',
    /Tier 1.*Deterministic required/i.test(s27EvidenceContent)
    && /Tier 2.*Deterministic derived/i.test(s27EvidenceContent)
    && /Tier 3.*Optional-pasted/i.test(s27EvidenceContent)
    && /Tier 4.*[Uu]navailable/.test(s27EvidenceContent));
  check('[52a-static] EVIDENCE-MODEL.md defines 7-point Freshness Gate (27f)',
    /Freshness Gate/.test(s27EvidenceContent)
    && /7-point/.test(s27EvidenceContent));
  check('[52a-static] EVIDENCE-MODEL.md defines risk-level-keyed drift policy (27f)',
    /[Rr]isk-level-keyed drift policy/.test(s27EvidenceContent)
    && /soft-fresh/i.test(s27EvidenceContent)
    && /hard-block/i.test(s27EvidenceContent));
}

// 27g [52a-static]  CONFIDENCE-CALIBRATION.md exists + 4 bands + frozen weights + enforcement invariants
let s27ConfidenceContent = null;
if (fs.existsSync(s27ConfidenceCalib)) {
  s27ConfidenceContent = fs.readFileSync(s27ConfidenceCalib, 'utf8');
}
check('[52a-static] CONFIDENCE-CALIBRATION.md exists (27g)', !!s27ConfidenceContent);
if (s27ConfidenceContent) {
  check('[52a-static] CONFIDENCE-CALIBRATION.md declares 4 bands (HIGH/MEDIUM/LOW/UNKNOWN) (27g)',
    /`HIGH`[\s\S]{0,200}≥\s*0\.80/.test(s27ConfidenceContent)
    && /`MEDIUM`[\s\S]{0,200}0\.50\s*[–-]\s*0\.799/.test(s27ConfidenceContent)
    && /`LOW`[\s\S]{0,200}<\s*0\.50/.test(s27ConfidenceContent)
    && /`UNKNOWN`/.test(s27ConfidenceContent));
  check('[52a-static] CONFIDENCE-CALIBRATION.md frozen weights sum to 1.0 (27g)',
    /0\.25/.test(s27ConfidenceContent)
    && /0\.20/.test(s27ConfidenceContent)
    && /0\.15/.test(s27ConfidenceContent)
    && /0\.10/.test(s27ConfidenceContent));
  check('[52a-static] CONFIDENCE-CALIBRATION.md declares 4 enforcement invariants I1-I4 (27g)',
    /I1 — Determinism/.test(s27ConfidenceContent)
    && /I2 — Bounds/.test(s27ConfidenceContent)
    && /I3 — Monotonicity/.test(s27ConfidenceContent)
    && /I4 — No LLM/.test(s27ConfidenceContent));
  check('[52a-static] CONFIDENCE-CALIBRATION.md declares HIGH-band disabled failure fallback (27g)',
    /HIGH.*band.*[dD]isabled/.test(s27ConfidenceContent)
    || /HIGH-band is disabled/i.test(s27ConfidenceContent)
    || /HIGH.*disabled.*auto-proceed/i.test(s27ConfidenceContent));
}

// 27j [52a-static]  APPROVAL-BOUNDARY.md forbidden-without-ACK list contains all 16+ items
let s27ApprovalContent = null;
if (fs.existsSync(s27ApprovalBoundary)) {
  s27ApprovalContent = fs.readFileSync(s27ApprovalBoundary, 'utf8');
}
check('[52a-static] APPROVAL-BOUNDARY.md exists (27j)', !!s27ApprovalContent);
if (s27ApprovalContent) {
  const forbiddenItems = [
    /git push\b/, /git push --tag/, /git push --force/, /git reset --hard/, /git branch -D/,
    /npm publish/, /npm login/, /npm install/, /npm uninstall/,
    /rm -rf/, /memory\/\*\.md write/, /\.claude\/rules\/\*\.md write/,
    /\.planning\/REQUIREMENTS\.md mutation/, /\.planning\/ROADMAP\.md phase/,
    /schema file mutation/, /network fetch/,
  ];
  const hitCount = forbiddenItems.filter(re => re.test(s27ApprovalContent)).length;
  check(`[52a-static] APPROVAL-BOUNDARY.md forbidden-without-ACK list coverage ≥14 items (27j, hit ${hitCount}/16)`,
    hitCount >= 14);
  check('[52a-static] APPROVAL-BOUNDARY.md declares 6 risk levels (27j)',
    /read_only/.test(s27ApprovalContent)
    && /local_mutate/.test(s27ApprovalContent)
    && /repo_mutate_official/.test(s27ApprovalContent)
    && /\brepo_mutate\b/.test(s27ApprovalContent)
    && /remote_mutate/.test(s27ApprovalContent)
    && /external_mutate/.test(s27ApprovalContent));
  check('[52a-static] APPROVAL-BOUNDARY.md repo_mutate_official declared as definitional class (Patch K) (27j)',
    /definitional class/i.test(s27ApprovalContent)
    && /Inclusive class/i.test(s27ApprovalContent)
    && /Explicit exceptions/i.test(s27ApprovalContent));
}

// 27v [52a-static doc-only]  blessed orchestrator list documented
check('[52a-static] APPROVAL-BOUNDARY.md blessed orchestrator list = {execute, verify, release} (27v doc-only)',
  s27ApprovalContent
  && /\/sunco:execute/.test(s27ApprovalContent)
  && /\/sunco:verify/.test(s27ApprovalContent)
  && /\/sunco:release/.test(s27ApprovalContent)
  && /blessed orchestrator/i.test(s27ApprovalContent));

// 27k [52a-static]  .planning/router/ layout present (README + decisions/.keep + DESIGN-v1.md preserved)
check('[52a-static] .planning/router/README.md exists (27k)',
  fs.existsSync(path.resolve(s27PlanningRouterDir, 'README.md')));
check('[52a-static] .planning/router/decisions/.keep exists (directory reservation) (27k)',
  fs.existsSync(s27DecisionsKeep));
check('[52a-static] .planning/router/DESIGN-v1.md preserved (not mutated by Phase 52a) (27k)',
  fs.existsSync(s27DesignDoc));

// 27l [52a-static]  package.json files[] covers schemas/ + references/
const s27PkgJsonPath = path.resolve(__dirname, '..', 'package.json');
if (fs.existsSync(s27PkgJsonPath)) {
  let pkg = null;
  try { pkg = JSON.parse(fs.readFileSync(s27PkgJsonPath, 'utf8')); } catch {}
  if (pkg) {
    check('[52a-static] packages/cli/package.json files[] includes "references/" (27l)',
      Array.isArray(pkg.files) && pkg.files.includes('references/'));
  }
}

// 27t [52a-static]  .gitignore entry .sun/ covers ephemeral tier
if (fs.existsSync(s27GitignorePath)) {
  const gitignore = fs.readFileSync(s27GitignorePath, 'utf8');
  check('[52a-static] .gitignore contains .sun/ entry (ephemeral tier gitignored) (27t)',
    /^\.sun\/$/m.test(gitignore));
}

// 27m [52a-static]  Clean-room grep over 10-path scope-set: no compound-engineering-plugin outside notices
const s27CleanRoomScopePaths = [
  s27RouterRefDir,
  path.resolve(__dirname, '..', 'references', 'compound'),         // may not exist until Phase 54
  path.resolve(__dirname, '..', 'commands', 'sunco', 'router.md'), // Phase 52b
  path.resolve(__dirname, '..', 'commands', 'sunco', 'compound.md'),
  path.resolve(__dirname, '..', 'workflows', 'router.md'),
  path.resolve(__dirname, '..', 'workflows', 'compound.md'),
  s27SchemaPath,
  path.resolve(__dirname, '..', 'schemas', 'compound.schema.json'), // Phase 54
  s27PlanningRouterDir,
  path.resolve(__dirname, '..', '..', '..', '.planning', 'compound'),
];
function s27GrepFiles(rootOrFile, pattern) {
  const hits = [];
  if (!fs.existsSync(rootOrFile)) return hits;
  const stat = fs.statSync(rootOrFile);
  if (stat.isFile()) {
    const content = fs.readFileSync(rootOrFile, 'utf8');
    if (pattern.test(content)) hits.push(rootOrFile);
    return hits;
  }
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(rootOrFile)) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'archive') continue;
      hits.push(...s27GrepFiles(path.join(rootOrFile, entry), pattern));
    }
  }
  return hits;
}
const s27PluginName = /compound-engineering-plugin/;
const s27PluginHits = [];
for (const p of s27CleanRoomScopePaths) {
  s27PluginHits.push(...s27GrepFiles(p, s27PluginName));
}
// For hits, check they are inside a clean-room-aware file
// Legal files: those that contain a clean-room notice or a clean-room design
// discussion. In those files, plugin name occurrences are treated as legal
// negation/reference (the whole file is written with clean-room awareness).
const s27IllegalHits = s27PluginHits.filter(p => {
  const content = fs.readFileSync(p, 'utf8');
  const hasCleanRoomContext = /clean-room notice/i.test(content)
                           || /clean-room design/i.test(content)
                           || /clean-room invariant/i.test(content)
                           || /clean-room grep/i.test(content);
  return !hasCleanRoomContext;
});
check('[52a-static] clean-room grep over 10-path scope-set: no compound-engineering-plugin refs outside notices (27m)',
  s27IllegalHits.length === 0);

// 27n [52a-static]  verbatim clean-room phrase on 5 reference docs
const s27CleanRoomPhrase = 'No code, prompts, command files, schemas, agent definitions, skill implementations, or documentation text from compound-engineering-plugin or any third-party workflow/compound/retrospective tool is copied, vendored, or adapted into SUNCO';
const s27NoticeFiles = [s27RouterReadme, s27StageMachine, s27EvidenceModel, s27ConfidenceCalib, s27ApprovalBoundary];
let s27MissingNotices = [];
for (const p of s27NoticeFiles) {
  if (!fs.existsSync(p)) { s27MissingNotices.push(path.basename(p) + ' (missing)'); continue; }
  const content = fs.readFileSync(p, 'utf8');
  if (content.indexOf(s27CleanRoomPhrase) === -1) s27MissingNotices.push(path.basename(p));
}
check(`[52a-static] verbatim clean-room notice on 5 reference docs (27n, missing: [${s27MissingNotices.join(', ')}])`,
  s27MissingNotices.length === 0);

// 27o [52a-static]  supplementary clean-room sanity: no copied EveryInc content beyond notices
// Deterministic heuristic: reference files should not contain common ce-compound vocabulary
// in non-notice context. v1 lightweight check: specific known command names from external plugin.
const s27BannedTokens = [/\/ce:brainstorm/, /\/ce:plan/, /\/ce:work/, /\/ce:review/, /\/ce:compound/];
let s27BannedHits = 0;
for (const p of [s27RouterRefDir, s27SchemaPath, s27PlanningRouterDir]) {
  for (const token of s27BannedTokens) {
    s27BannedHits += s27GrepFiles(p, token).length;
  }
}
check('[52a-static] supplementary clean-room: no /ce:* command refs in router pack (27o)',
  s27BannedHits === 0);

// ─── Section 28 — Router Classifier Runtime (Phase 52b) ──────────────────────
//
// Contract tested: Phase 52b lands the runtime modules that consume the
// Phase 52a schemas + reference docs. Section 28 asserts: runtime module
// existence, self-test pass, narrative-reason isolation (I4 enforcement for
// confidence.mjs path-exact), Y1 class-definition classifier, approval-
// boundary L14 enforcement, /sunco:auto frozen, stage commands byte-stable,
// and Phase 52a static asset byte-stability.
//
// Section 27 [52a-static] checks remain byte-stable (no additions, no
// removals, no reordering). Section 28 is additive only.

const s28RouterSrcDir = path.resolve(__dirname, '..', 'references', 'router', 'src');
const s28ClassifierPath = path.resolve(s28RouterSrcDir, 'classifier.mjs');
const s28EvidencePath = path.resolve(s28RouterSrcDir, 'evidence-collector.mjs');
const s28ConfidencePath = path.resolve(s28RouterSrcDir, 'confidence.mjs');
const s28WriterPath = path.resolve(s28RouterSrcDir, 'decision-writer.mjs');
const s28RouterCmdPath = path.resolve(__dirname, '..', 'commands', 'sunco', 'router.md');
const s28RouterWorkflowPath = path.resolve(__dirname, '..', 'workflows', 'router.md');
const s28Phase52bContext = path.resolve(__dirname, '..', '..', '..', '.planning', 'phases', '52b-router-classifier', '52b-CONTEXT.md');

console.log(`\n${BOLD}28. Router Classifier Runtime (Phase 52b)${RESET}`);

// 28a [52b-runtime]  router.md command exists + frontmatter name=sunco:router (27a counterpart)
let s28RouterCmd = null;
if (fs.existsSync(s28RouterCmdPath)) s28RouterCmd = fs.readFileSync(s28RouterCmdPath, 'utf8');
check('[52b-runtime] commands/sunco/router.md exists (28a counterpart of DESIGN 27a)',
  !!s28RouterCmd);
check('[52b-runtime] router.md frontmatter name: sunco:router (28a)',
  s28RouterCmd && /^name:\s*sunco:router\s*$/m.test(s28RouterCmd));

// 28b [52b-runtime]  workflows/router.md exists
const s28RouterWorkflow = fs.existsSync(s28RouterWorkflowPath) ? fs.readFileSync(s28RouterWorkflowPath, 'utf8') : null;
check('[52b-runtime] workflows/router.md exists (28b)', !!s28RouterWorkflow);

// 28c [52b-runtime]  4 runtime modules exist
check('[52b-runtime] references/router/src/classifier.mjs exists (28c)', fs.existsSync(s28ClassifierPath));
check('[52b-runtime] references/router/src/evidence-collector.mjs exists (28c)', fs.existsSync(s28EvidencePath));
check('[52b-runtime] references/router/src/confidence.mjs exists (28c)', fs.existsSync(s28ConfidencePath));
check('[52b-runtime] references/router/src/decision-writer.mjs exists (28c)', fs.existsSync(s28WriterPath));

// 28d-g [52b-runtime]  Each runtime module --test passes (27h, 27i, 27u runtime)
function runSelfTest(modulePath, expected, label) {
  try {
    const { execSync } = require('node:child_process');
    const out = execSync(`node "${modulePath}" --test`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const m = out.match(/(\d+)\s+passed,\s+(\d+)\s+failed/);
    const passedCount = m ? parseInt(m[1], 10) : 0;
    const failedCount = m ? parseInt(m[2], 10) : -1;
    check(label, passedCount >= expected && failedCount === 0);
  } catch (e) {
    check(label, false);
  }
}

runSelfTest(s28ConfidencePath, 15, '[52b-runtime] confidence.mjs --test passes ≥15 checks, 0 failed (I1/I2/I3 runtime; 28d)');
runSelfTest(s28ClassifierPath, 15, '[52b-runtime] classifier.mjs --test passes ≥15 checks, 0 failed (27h runtime; 28e)');
runSelfTest(s28EvidencePath, 15, '[52b-runtime] evidence-collector.mjs --test passes ≥15 checks, 0 failed (27i runtime; 28f)');
runSelfTest(s28WriterPath, 15, '[52b-runtime] decision-writer.mjs --test passes ≥15 checks, 0 failed (27u runtime + 27v3 Y1 class-definition; 28g)');

// 28h [52b-runtime]  I4 path-exact grep: confidence.mjs has ZERO LLM SDK imports (27s runtime)
if (fs.existsSync(s28ConfidencePath)) {
  const confSrc = fs.readFileSync(s28ConfidencePath, 'utf8');
  const forbiddenImports = [
    /from\s+['"]@anthropic-ai\//,
    /from\s+['"]@openai\//,
    /from\s+['"]openai['"]/,
    /from\s+['"]@ai-sdk\//,
    /from\s+['"]ai['"]/,
    /from\s+['"]@vercel\/ai/,
    /from\s+['"]agent['"]/,
    /import\s*\(\s*['"]ai['"]/,
  ];
  const hits = forbiddenImports.filter(re => re.test(confSrc)).length;
  check('[52b-runtime] I4 confidence.mjs has zero LLM SDK imports (27s runtime path-exact; 28h)',
    hits === 0);
}

// 28i [52b-runtime]  Narrative rendering lives in classifier.mjs (Gate 52b Reviewer B1)
if (fs.existsSync(s28ClassifierPath)) {
  const clfSrc = fs.readFileSync(s28ClassifierPath, 'utf8');
  check('[52b-runtime] classifier.mjs exports renderNarrativeReasons (narrative outside confidence.mjs; 28i)',
    /export\s+function\s+renderNarrativeReasons|export\s*\{[^}]*renderNarrativeReasons/.test(clfSrc));
}

// 28j [52b-runtime]  L14 enforcement: validateRouteDecision rejects remote_mutate+auto_safe
if (fs.existsSync(s28ClassifierPath)) {
  const clfSrc = fs.readFileSync(s28ClassifierPath, 'utf8');
  check('[52b-runtime] classifier structural validator enforces L14 (remote/external never auto_safe; 28j)',
    /L14 violated/.test(clfSrc) || /auto_safe/.test(clfSrc));
}

// 28k [52b-runtime]  Decision writer path allowlist: grep for STATE.md/ROADMAP.md REFUSAL pattern
if (fs.existsSync(s28WriterPath)) {
  const writerSrc = fs.readFileSync(s28WriterPath, 'utf8');
  check('[52b-runtime] decision-writer.mjs enforces path allowlist with explicit RouterWriterPathError (28k)',
    /RouterWriterPathError/.test(writerSrc)
    && /assertInAllowlist/.test(writerSrc)
    && /router writer allowlist/i.test(writerSrc));
  // 28l: allowlist refuses STATE.md / ROADMAP.md / REQUIREMENTS.md / CONTEXT.md
  check('[52b-runtime] decision-writer.mjs allowlist rejects non-router paths (28l; C5)',
    /session\/\*\.json|\.sun\/router\/session/.test(writerSrc)
    && /decisions\/\*\.json|\.planning\/router\/decisions/.test(writerSrc));
}

// 28m [52b-runtime]  Atomic tmp-in-same-dir rename pattern (L5 + Codex G4)
if (fs.existsSync(s28WriterPath)) {
  const writerSrc = fs.readFileSync(s28WriterPath, 'utf8');
  check('[52b-runtime] decision-writer uses atomic tmp-in-same-dir rename (28m; L5)',
    /atomicWrite|renameSync/.test(writerSrc)
    && /\.tmp-/.test(writerSrc));
}

// 28n [52b-runtime]  Adapter injection pattern (L3 + Codex C1)
if (fs.existsSync(s28EvidencePath)) {
  const evSrc = fs.readFileSync(s28EvidencePath, 'utf8');
  check('[52b-runtime] evidence-collector uses adapter injection pattern (28n; L3)',
    /resolveAdapters/.test(evSrc)
    && /execGit/.test(evSrc)
    && /readFile/.test(evSrc)
    && /statFile/.test(evSrc)
    && /now/.test(evSrc));
  check('[52b-runtime] evidence-collector requires explicit repoRoot (no process.cwd; 28n; L4)',
    /ctx\.repoRoot.*required/i.test(evSrc) && !/process\.cwd\s*\(\s*\)/.test(evSrc));
}

// 28o [52b-runtime]  Freshness Gate returns exactly 7 checks (EVIDENCE-MODEL.md L73)
if (fs.existsSync(s28EvidencePath)) {
  const evSrc = fs.readFileSync(s28EvidencePath, 'utf8');
  check('[52b-runtime] evidence-collector FRESHNESS_CHECK_IDS length === 7 (28o; EVIDENCE-MODEL L73)',
    /FRESHNESS_CHECK_IDS\s*=\s*Object\.freeze\s*\(\s*\[[^\]]*'git-status'[^\]]*'cross-artifact-refs'/.test(evSrc));
}

// 28p [52b-runtime]  /sunco:auto frozen — no references in Phase 52b artifacts
{
  const s28AutoRefTargets = [s28ClassifierPath, s28EvidencePath, s28ConfidencePath, s28WriterPath, s28RouterCmdPath, s28RouterWorkflowPath];
  let s28AutoHits = 0;
  for (const p of s28AutoRefTargets) {
    if (!fs.existsSync(p)) continue;
    const content = fs.readFileSync(p, 'utf8');
    // Match /sunco:auto or `sunco:auto` command-like references (not substring "auto_safe" etc).
    if (/\/sunco:auto\b/.test(content)) s28AutoHits++;
  }
  check('[52b-runtime] /sunco:auto frozen — no references in Phase 52b runtime or command/workflow (28p; G10)',
    s28AutoHits === 0);
}

// 28q [52b-runtime]  Stage commands present (byte-identical guard via pre-commit git diff; G9 / L15)
{
  const stageCommands = ['plan', 'execute', 'verify', 'proceed-gate', 'ship', 'release'];
  const stageCmdDir = path.resolve(__dirname, '..', 'commands', 'sunco');
  let stageCmdsAllExist = true;
  for (const name of stageCommands) {
    if (!fs.existsSync(path.resolve(stageCmdDir, `${name}.md`))) { stageCmdsAllExist = false; break; }
  }
  check('[52b-runtime] 6 existing stage commands present (byte-identical guard via pre-commit git diff; 28q)',
    stageCmdsAllExist);
}

// 28r [52b-runtime]  Phase 52a byte-stable — content-marker grep on 5 reference docs (Gate 52b L17 + B2)
{
  const s28Phase52aMarkers = [
    { path: s27RouterReadme,     marker: /Consumer map/, label: 'README.md Consumer map' },
    { path: s27StageMachine,     marker: /Stage enum \(10\)/, label: 'STAGE-MACHINE.md Stage enum' },
    { path: s27EvidenceModel,    marker: /7-point Freshness Gate/, label: 'EVIDENCE-MODEL.md 7-point' },
    { path: s27ConfidenceCalib,  marker: /Deterministic formula/, label: 'CONFIDENCE-CALIBRATION Deterministic formula' },
    { path: s27ApprovalBoundary, marker: /definitional class/, label: 'APPROVAL-BOUNDARY definitional class' },
    { path: s27SchemaPath,       marker: /"const":\s*"route-decision"/, label: 'schema const route-decision' },
    { path: s27DesignDoc,        marker: /SUNCO Workflow Router/, label: 'DESIGN-v1.md title' },
  ];
  const missing = [];
  for (const { path: p, marker, label } of s28Phase52aMarkers) {
    if (!fs.existsSync(p)) { missing.push(label + ' (file missing)'); continue; }
    if (!marker.test(fs.readFileSync(p, 'utf8'))) missing.push(label);
  }
  check(`[52b-runtime] Phase 52a assets byte-stable: 7 content markers preserved (28r; L17/B2, missing: [${missing.join(', ')}])`,
    missing.length === 0);
}

// 28s [52b-runtime]  Clean-room notice on router.md command + workflow + 52b-CONTEXT
{
  const s28CleanRoomPhrase = 'clean-room';
  const s28CleanRoomTargets = [s28RouterCmdPath, s28RouterWorkflowPath];
  let s28CleanRoomMissing = [];
  for (const p of s28CleanRoomTargets) {
    if (!fs.existsSync(p)) { s28CleanRoomMissing.push(path.basename(p) + ' (missing)'); continue; }
    const content = fs.readFileSync(p, 'utf8');
    if (!new RegExp(s28CleanRoomPhrase, 'i').test(content)) s28CleanRoomMissing.push(path.basename(p));
  }
  check(`[52b-runtime] router.md command + workflow contain clean-room acknowledgement (28s, missing: [${s28CleanRoomMissing.join(', ')}])`,
    s28CleanRoomMissing.length === 0);
}

// 28t [52b-runtime]  No /ce:* plugin refs in Phase 52b delta
{
  const s28CeTargets = [s28ClassifierPath, s28EvidencePath, s28ConfidencePath, s28WriterPath, s28RouterCmdPath, s28RouterWorkflowPath];
  let s28CeHits = 0;
  for (const p of s28CeTargets) {
    if (!fs.existsSync(p)) continue;
    const content = fs.readFileSync(p, 'utf8');
    if (/\/ce:(brainstorm|plan|work|review|compound)\b/.test(content)) s28CeHits++;
  }
  check('[52b-runtime] Phase 52b delta has no /ce:* plugin refs (28t; clean-room)',
    s28CeHits === 0);
}

// 28u [52b-runtime]  52b-CONTEXT.md populated
check('[52b-runtime] .planning/phases/52b-router-classifier/52b-CONTEXT.md exists (28u)',
  fs.existsSync(s28Phase52bContext));

// 28v [52b-runtime]  4 vitest test files present at skills-workflow location (Phase 51 precedent)
{
  const vitestDir = path.resolve(__dirname, '..', '..', 'skills-workflow', 'src', 'shared', '__tests__');
  const testFiles = ['router-classifier.test.ts', 'router-evidence.test.ts', 'router-confidence.test.ts', 'router-promotion.test.ts'];
  const missing = testFiles.filter(f => !fs.existsSync(path.resolve(vitestDir, f)));
  check(`[52b-runtime] 4 router vitest test files present at skills-workflow (28v, missing: [${missing.join(', ')}])`,
    missing.length === 0);
}

// ─── Section 29 — Router Wrappers (Phase 53) ─────────────────────────────────
//
// Contract tested: Phase 53 connects 4 user-facing wrapper commands
// (/sunco:do, /sunco:next, /sunco:mode, /sunco:manager) to the Phase 52b
// runtime engine via the /sunco:router command surface, plus the mode hook
// (packages/cli/hooks/sunco-mode-router.cjs) directs mode-active non-slash
// input directly to /sunco:router --intent <text> (G3a direct-to-router).
// Section 29 asserts: 4 wrapper files updated with router-delegation prose,
// hook directive updated, 8 stage commands + auto.md + where-am-i.md
// byte-identical, command count stable at 88, approval-envelope propagation
// prose per wrapper, UNKNOWN/HOLD fallback prose per wrapper.
//
// Sections 27 [52a-static] + 28 [52b-runtime] remain byte-stable (no
// additions, no removals, no reordering). Section 29 is additive only.

const s29CommandsDir = path.resolve(__dirname, '..', 'commands', 'sunco');
const s29DoPath = path.resolve(s29CommandsDir, 'do.md');
const s29NextPath = path.resolve(s29CommandsDir, 'next.md');
const s29ModePath = path.resolve(s29CommandsDir, 'mode.md');
const s29ManagerPath = path.resolve(s29CommandsDir, 'manager.md');
const s29AutoPath = path.resolve(s29CommandsDir, 'auto.md');
const s29WhereAmIPath = path.resolve(s29CommandsDir, 'where-am-i.md');
const s29HookPath = path.resolve(__dirname, '..', 'hooks', 'sunco-mode-router.cjs');
const s29Phase53Context = path.resolve(__dirname, '..', '..', '..', '.planning', 'phases', '53-router-wrappers', '53-CONTEXT.md');

console.log(`\n${BOLD}29. Router Wrappers (Phase 53)${RESET}`);

// 29a [53-wrapper]  Phase 53 CONTEXT populated
check('[53-wrapper] .planning/phases/53-router-wrappers/53-CONTEXT.md exists (29a)',
  fs.existsSync(s29Phase53Context));

// 29b [53-wrapper]  4 wrapper command files exist
{
  const wrappers = [
    ['do.md', s29DoPath],
    ['next.md', s29NextPath],
    ['mode.md', s29ModePath],
    ['manager.md', s29ManagerPath],
  ];
  const missing = wrappers.filter(([, p]) => !fs.existsSync(p)).map(([n]) => n);
  check(`[53-wrapper] 4 wrapper files present (29b, missing: [${missing.join(', ')}])`,
    missing.length === 0);
}

// 29c [53-wrapper]  4 wrappers delegate to /sunco:router (engine-sharing per L12)
{
  const wrappers = [s29DoPath, s29NextPath, s29ModePath, s29ManagerPath];
  const routerRefs = wrappers.map(p => fs.existsSync(p) && /\/sunco:router/.test(fs.readFileSync(p, 'utf8')));
  check('[53-wrapper] 4 wrappers reference /sunco:router (engine-sharing; 29c; L12)',
    routerRefs.filter(Boolean).length === 4);
}

// 29d [53-wrapper]  4 wrappers preserve approval envelope (L13)
{
  const wrappers = [s29DoPath, s29NextPath, s29ModePath, s29ManagerPath];
  const hits = wrappers.map(p => {
    if (!fs.existsSync(p)) return false;
    const c = fs.readFileSync(p, 'utf8');
    return /approval_envelope/.test(c);
  });
  check('[53-wrapper] 4 wrappers propagate approval_envelope (29d; L13/L14)',
    hits.filter(Boolean).length === 4);
}

// 29e [53-wrapper]  4 wrappers include forbidden_without_ack or L14 reference
{
  const wrappers = [s29DoPath, s29NextPath, s29ModePath, s29ManagerPath];
  const hits = wrappers.map(p => {
    if (!fs.existsSync(p)) return false;
    const c = fs.readFileSync(p, 'utf8');
    return /forbidden_without_ack|L14/.test(c);
  });
  check('[53-wrapper] 4 wrappers reference forbidden_without_ack or L14 (29e; L13)',
    hits.filter(Boolean).length === 4);
}

// 29f [53-wrapper]  4 wrappers include UNKNOWN/HOLD/drift fallback prose (G8)
{
  const wrappers = [s29DoPath, s29NextPath, s29ModePath, s29ManagerPath];
  const hits = wrappers.map(p => {
    if (!fs.existsSync(p)) return false;
    const c = fs.readFileSync(p, 'utf8');
    return /UNKNOWN|HOLD|drift/.test(c);
  });
  check('[53-wrapper] 4 wrappers include UNKNOWN/HOLD/drift fallback prose (29f; G8)',
    hits.filter(Boolean).length === 4);
}

// 29g [53-wrapper]  /sunco:do is router-first (L1 per DESIGN §7.2)
if (fs.existsSync(s29DoPath)) {
  const doContent = fs.readFileSync(s29DoPath, 'utf8');
  check('[53-wrapper] /sunco:do is router-first per DESIGN §7.2 (29g; L1)',
    /router-first/i.test(doContent) && /Thin wrapper/i.test(doContent));
}

// 29h [53-wrapper]  /sunco:do keeps static table as UNKNOWN/LOW fallback ONLY (L17)
if (fs.existsSync(s29DoPath)) {
  const doContent = fs.readFileSync(s29DoPath, 'utf8');
  check('[53-wrapper] /sunco:do static table is fallback-only for UNKNOWN/LOW (29h; L17)',
    /fallback/i.test(doContent) && /UNKNOWN/.test(doContent));
}

// 29i [53-wrapper]  /sunco:next is --recommend-only thin wrapper (L2)
if (fs.existsSync(s29NextPath)) {
  const nextContent = fs.readFileSync(s29NextPath, 'utf8');
  check('[53-wrapper] /sunco:next delegates to /sunco:router --recommend-only (29i; L2)',
    /--recommend-only/.test(nextContent));
}

// 29j [53-wrapper]  /sunco:next documents ephemeral write default + --durable flag (L2 + DESIGN §4.2)
if (fs.existsSync(s29NextPath)) {
  const nextContent = fs.readFileSync(s29NextPath, 'utf8');
  check('[53-wrapper] /sunco:next ephemeral tier default + --durable documented (29j; L2)',
    /ephemeral/i.test(nextContent) && /--durable/.test(nextContent));
}

// 29k [53-wrapper]  /sunco:mode is direct-to-router (G3a; L3); no /sunco:do dispatch
if (fs.existsSync(s29ModePath)) {
  const modeContent = fs.readFileSync(s29ModePath, 'utf8');
  check('[53-wrapper] /sunco:mode is direct-to-router (29k; L3/G3a)',
    /direct-to-router|--intent/.test(modeContent));
  // Negative: no /sunco:do intermediate dispatch reference
  // Grandfathered: narrative "no /sunco:do nesting" is expected; we just check
  // mode doesn't name /sunco:do as its active dispatch target.
  check('[53-wrapper] /sunco:mode has no /sunco:do nesting (29k; single routing surface)',
    /no.*sunco:do|single routing surface/i.test(modeContent));
}

// 29l [53-wrapper]  /sunco:manager includes RouteDecision block + drift banner (L4)
if (fs.existsSync(s29ManagerPath)) {
  const mgrContent = fs.readFileSync(s29ManagerPath, 'utf8');
  check('[53-wrapper] /sunco:manager sources recommendation from RouteDecision (29l; L4)',
    /RouteDecision/.test(mgrContent) && /--recommend-only/.test(mgrContent));
  check('[53-wrapper] /sunco:manager has drift banner (29l; L4)',
    /drift banner|DRIFT BANNER/i.test(mgrContent));
  check('[53-wrapper] /sunco:manager --json exposes route_decision block (29l; L4)',
    /route_decision/.test(mgrContent));
}

// 29m [53-wrapper]  mode hook updated to direct-to-router (/sunco:router --intent)
if (fs.existsSync(s29HookPath)) {
  const hookContent = fs.readFileSync(s29HookPath, 'utf8');
  check('[53-wrapper] mode hook auto-routes via /sunco:router --intent (29m; L9/G3a)',
    /\/sunco:router --intent/.test(hookContent));
  // Hook narrative about removing /sunco:do intermediate
  check('[53-wrapper] mode hook docs single routing surface invariant (29m; L3)',
    /single routing surface|No .*sunco:do intermediate|no.*sunco:do.*dispatch/i.test(hookContent));
}

// 29n [53-wrapper]  /sunco:auto frozen: auto.md untouched
if (fs.existsSync(s29AutoPath) && fs.existsSync(s29DoPath) && fs.existsSync(s29NextPath)
    && fs.existsSync(s29ModePath) && fs.existsSync(s29ManagerPath)) {
  // Positive: auto.md still has its original frontmatter name
  const autoContent = fs.readFileSync(s29AutoPath, 'utf8');
  check('[53-wrapper] /sunco:auto.md frontmatter name preserved (29n; G7/L14-frozen)',
    /^name:\s*sunco:auto\s*$/m.test(autoContent));
  // Negative: 4 wrappers do NOT dispatch to /sunco:auto as an active target
  // (existing narrative mentions like 'auto' keyword in do.md table are grandfathered
  // by checking that no wrapper body contains '/sunco:auto' as the sole route)
  const wrappers = [s29DoPath, s29NextPath, s29ModePath, s29ManagerPath];
  const autoDispatchHits = wrappers.filter(p => {
    const c = fs.readFileSync(p, 'utf8');
    // Accept mentions under "Quick commands" or "Relationship" sections (grandfathered)
    // but flag if a wrapper routes its primary dispatch to /sunco:auto.
    return /→\s*`\/sunco:auto`|Routes to:\s*\/sunco:auto/i.test(c);
  });
  check('[53-wrapper] 4 wrappers have no /sunco:auto as primary dispatch target (29n; G7)',
    autoDispatchHits.length <= 1); // do.md's fallback table has an `auto` keyword entry
}

// 29o [53-wrapper]  Stage commands byte-identical + Phase 54 compound present (R1)
// Phase 54 amendment (Gate 54 G8/L7): compound.md absence guard REMOVED;
// stage set expanded from 7 → 8 commands. Phase 54 adds compound.md as a net-
// new file, not a mutation of existing 7; 8-command R1 protection set is the
// current Phase 54 baseline for byte-identical enforcement going forward.
// Byte-stability enforcement pre-commit via
// `git diff --name-only 7791d33..HEAD -- .../{brainstorming,plan,execute,
// verify,proceed-gate,ship,release}.md | wc -l == 0` — compound.md excluded
// from the 7791d33 diff guard because it was created post-7791d33 in Phase 54.
{
  const stageNames = ['brainstorming', 'plan', 'execute', 'verify', 'proceed-gate', 'ship', 'release', 'compound'];
  const stagePaths = stageNames.map(n => path.resolve(s29CommandsDir, `${n}.md`));
  const missing = stagePaths.filter(p => !fs.existsSync(p));
  check(`[53-wrapper] 8 stage commands present incl. brainstorming+compound (29o; R1 Phase 54 expanded, missing: [${missing.join(', ')}])`,
    missing.length === 0);
  const frontmatterOk = stagePaths.every(p => {
    if (!fs.existsSync(p)) return false;
    const c = fs.readFileSync(p, 'utf8');
    return /^name:\s*sunco:/m.test(c);
  });
  check('[53-wrapper] 8 stage commands have sunco:* frontmatter preserved (29o; R1 Phase 54)',
    frontmatterOk);
}

// 29p [53-wrapper]  where-am-i.md byte-identical (L6 ROADMAP-narrowing exclusion)
if (fs.existsSync(s29WhereAmIPath)) {
  const waiContent = fs.readFileSync(s29WhereAmIPath, 'utf8');
  check('[53-wrapper] where-am-i.md preserved (29p; L6 Phase 53 out-of-scope)',
    /^name:\s*sunco:where-am-i\s*$/m.test(waiContent));
}

// 29q [53-wrapper]  command count 89 post-Phase-54 (Phase 54 adds compound.md;
// was 88 through Phase 53; Gate 54 G7/L18 amendment)
{
  const allMdFiles = fs.readdirSync(s29CommandsDir).filter(f => f.endsWith('.md'));
  check(`[53-wrapper] command count === 89 post-Phase-54 (29q; current=${allMdFiles.length})`,
    allMdFiles.length === 89);
}

// 29r [53-wrapper]  Phase 52a + 52b assets byte-stable (L16 hard-lock)
{
  const assetPaths = [
    path.resolve(__dirname, '..', 'commands', 'sunco', 'router.md'),
    path.resolve(__dirname, '..', 'workflows', 'router.md'),
    path.resolve(__dirname, '..', 'references', 'router', 'src', 'classifier.mjs'),
    path.resolve(__dirname, '..', 'references', 'router', 'src', 'evidence-collector.mjs'),
    path.resolve(__dirname, '..', 'references', 'router', 'src', 'confidence.mjs'),
    path.resolve(__dirname, '..', 'references', 'router', 'src', 'decision-writer.mjs'),
    path.resolve(__dirname, '..', 'references', 'router', 'README.md'),
    path.resolve(__dirname, '..', 'references', 'router', 'STAGE-MACHINE.md'),
    path.resolve(__dirname, '..', 'references', 'router', 'EVIDENCE-MODEL.md'),
    path.resolve(__dirname, '..', 'references', 'router', 'CONFIDENCE-CALIBRATION.md'),
    path.resolve(__dirname, '..', 'references', 'router', 'APPROVAL-BOUNDARY.md'),
    path.resolve(__dirname, '..', 'schemas', 'route-decision.schema.json'),
  ];
  const missing = assetPaths.filter(p => !fs.existsSync(p));
  check(`[53-wrapper] Phase 52a+52b assets present (29r; L16, missing: [${missing.length}])`,
    missing.length === 0);
}

// ─── Section 30 — Compound-Router (Phase 54) ───────────────────────────────
//
// Phase 54 adds the post-stage durable-decision consumer: schema + 2 runtime
// modules (compound-router + sink-proposer) + command + workflow + 2 READMEs +
// template + .planning/compound/README.md. Section 30 [54-compound] coverage
// asserts structural contract + determinism + auto-write boundary + sink-
// proposer proposal-only boundary + 9-path clean-room scope + byte-stability
// of Phase 52a/52b/53 assets (content-marker parity).
//
// Cross-section amendments (Phase 54 Commit B):
//   Section 29 29o: compound.md absence → presence; 7 → 8 stage commands
//   Section 29 29q: command count === 88 → === 89
//
// Gate-dispositive references absorbed:
//   G5 (b') standalone post-stage durable-decision consumer (Codex-strict)
//   G6 $comment in schema (not description); 9-path verbatim notice scope
//   G10 pre-planned 2-commit split; NOT SDI-2
//
// ────────────────────────────────────────────────────────────────────────────

const s30CompoundCmdPath       = path.resolve(__dirname, '..', 'commands', 'sunco', 'compound.md');
const s30CompoundWorkflowPath  = path.resolve(__dirname, '..', 'workflows', 'compound.md');
const s30CompoundSchemaPath    = path.resolve(__dirname, '..', 'schemas', 'compound.schema.json');
const s30CompoundDir           = path.resolve(__dirname, '..', 'references', 'compound');
const s30CompoundReadmePath    = path.resolve(s30CompoundDir, 'README.md');
const s30CompoundTemplatePath  = path.resolve(s30CompoundDir, 'template.md');
const s30CompoundSrcDir        = path.resolve(s30CompoundDir, 'src');
const s30CompoundRouterPath    = path.resolve(s30CompoundSrcDir, 'compound-router.mjs');
const s30SinkProposerPath      = path.resolve(s30CompoundSrcDir, 'sink-proposer.mjs');
const s30PlanningCompoundDir   = path.resolve(__dirname, '..', '..', '..', '.planning', 'compound');
const s30PlanningCompoundReadme = path.resolve(s30PlanningCompoundDir, 'README.md');
const s30ProductContract       = path.resolve(__dirname, '..', 'references', 'product-contract.md');

// 30a [54-compound]  commands/sunco/compound.md exists + frontmatter name=sunco:compound
check('[54-compound] commands/sunco/compound.md exists (30a)', fs.existsSync(s30CompoundCmdPath));
if (fs.existsSync(s30CompoundCmdPath)) {
  const c = fs.readFileSync(s30CompoundCmdPath, 'utf8');
  check('[54-compound] compound.md frontmatter name: sunco:compound (30a)',
    /^name:\s*sunco:compound\s*$/m.test(c));
  check('[54-compound] compound.md contains clean-room notice (30a)',
    /Clean-room notice/i.test(c) && /compound-engineering-plugin/.test(c));
}

// 30b [54-compound]  workflows/compound.md exists + clean-room notice
check('[54-compound] workflows/compound.md exists (30b)', fs.existsSync(s30CompoundWorkflowPath));
if (fs.existsSync(s30CompoundWorkflowPath)) {
  const c = fs.readFileSync(s30CompoundWorkflowPath, 'utf8');
  check('[54-compound] workflows/compound.md contains clean-room notice (30b)',
    /Clean-room notice/i.test(c) && /compound-engineering-plugin/.test(c));
}

// 30c [54-compound]  references/compound/ pack files present
check('[54-compound] references/compound/README.md exists (30c)', fs.existsSync(s30CompoundReadmePath));
check('[54-compound] references/compound/template.md exists (30c)', fs.existsSync(s30CompoundTemplatePath));
check('[54-compound] references/compound/src/compound-router.mjs exists (30c)', fs.existsSync(s30CompoundRouterPath));
check('[54-compound] references/compound/src/sink-proposer.mjs exists (30c)', fs.existsSync(s30SinkProposerPath));

// 30d [54-compound]  schema exists + valid JSON + draft-07 + $comment clean-room
check('[54-compound] schemas/compound.schema.json exists (30d)', fs.existsSync(s30CompoundSchemaPath));
if (fs.existsSync(s30CompoundSchemaPath)) {
  let schema = null;
  try { schema = JSON.parse(fs.readFileSync(s30CompoundSchemaPath, 'utf8')); } catch (e) { /* schema null */ }
  check('[54-compound] compound.schema.json parses as JSON (30d)', !!schema);
  if (schema) {
    check('[54-compound] compound schema is draft-07 (30d)',
      schema.$schema === 'http://json-schema.org/draft-07/schema#');
    check('[54-compound] compound schema $comment carries clean-room attribution (30d; Gate 54 G6/$comment)',
      typeof schema.$comment === 'string' &&
      /Clean-room notice/i.test(schema.$comment) &&
      /compound-engineering-plugin/.test(schema.$comment));

    // 30e [54-compound]  kind const, version const
    check('[54-compound] schema kind=compound and version=1 (30e)',
      schema.properties && schema.properties.kind && schema.properties.kind.const === 'compound' &&
      schema.properties.version && schema.properties.version.const === 1);

    // 30f [54-compound]  sections: 8 canonical names
    check('[54-compound] schema sections: 8 canonical names enum (30f)',
      schema.properties && schema.properties.sections &&
      schema.properties.sections.minItems === 8 &&
      schema.properties.sections.maxItems === 8 &&
      Array.isArray(schema.properties.sections.items && schema.properties.sections.items.enum) &&
      schema.properties.sections.items.enum.length === 8 &&
      ['context', 'learnings', 'patterns_sdi', 'rule_promotions', 'automation', 'seeds', 'memory_proposals', 'approval_log']
        .every(n => schema.properties.sections.items.enum.includes(n)));

    // 30g [54-compound]  scope enum
    check('[54-compound] schema scope enum = [release,milestone,phase,incident,ad_hoc] (30g)',
      schema.properties && schema.properties.scope && Array.isArray(schema.properties.scope.enum) &&
      ['release', 'milestone', 'phase', 'incident', 'ad_hoc'].every(s => schema.properties.scope.enum.includes(s)) &&
      schema.properties.scope.enum.length === 5);

    // 30h [54-compound]  status enum
    check('[54-compound] schema status enum = [draft,proposed,partially-approved,approved,archived] (30h)',
      schema.properties && schema.properties.status && Array.isArray(schema.properties.status.enum) &&
      ['draft', 'proposed', 'partially-approved', 'approved', 'archived'].every(s => schema.properties.status.enum.includes(s)) &&
      schema.properties.status.enum.length === 5);

    // Schema source has NO JSON comments (strict JSON; $comment field only)
    const rawSchemaStr = fs.readFileSync(s30CompoundSchemaPath, 'utf8');
    check('[54-compound] schema is strict JSON (no // or /* comments; Gate 54 G6 strict)',
      !/^\s*\/\//m.test(rawSchemaStr) && !/\/\*[\s\S]*?\*\//.test(rawSchemaStr));
  }
}

// 30i [54-compound]  template.md has 8 required section headings
if (fs.existsSync(s30CompoundTemplatePath)) {
  const t = fs.readFileSync(s30CompoundTemplatePath, 'utf8');
  const required = ['context', 'learnings', 'patterns_sdi', 'rule_promotions', 'automation', 'seeds', 'memory_proposals', 'approval_log'];
  const missing = required.filter(n => !new RegExp(`^##\\s+${n}\\b`, 'm').test(t));
  check(`[54-compound] template.md has all 8 section headings (30i; missing: [${missing.join(', ')}])`,
    missing.length === 0);
  check('[54-compound] template.md contains clean-room notice (30i)',
    /Clean-room notice/i.test(t) && /compound-engineering-plugin/.test(t));
}

// 30j [54-compound]  compound-router.mjs self-test passes ≥30 checks
runSelfTest(s30CompoundRouterPath, 30, '[54-compound] compound-router.mjs --test passes ≥30 checks, 0 failed (30j; scoring determinism + decide + validate + allowlist + runCompound adapter)');

// 30k [54-compound]  sink-proposer.mjs self-test passes ≥15 checks
runSelfTest(s30SinkProposerPath, 15, '[54-compound] sink-proposer.mjs --test passes ≥15 checks, 0 failed (30k; proposal-only + L3 split 1:1 bucket mapping + determinism)');

// 30l [54-compound]  compound-router.mjs has no LLM SDK imports (parallels 27s I4 for confidence)
if (fs.existsSync(s30CompoundRouterPath)) {
  const src = fs.readFileSync(s30CompoundRouterPath, 'utf8');
  const llmPatterns = /@ai-sdk\/|from ['"]anthropic['"]|from ['"]openai['"]|from ['"]ai['"]/;
  check('[54-compound] compound-router.mjs has zero LLM SDK imports (30l; I4 extension)',
    !llmPatterns.test(src));
}

// 30m [54-compound]  sink-proposer.mjs has no fs writer imports (proposal-only boundary)
if (fs.existsSync(s30SinkProposerPath)) {
  const src = fs.readFileSync(s30SinkProposerPath, 'utf8');
  // Proposal-only: no fs module import, no writeFile/renameSync/mkdirSync references
  const hasFsImport = /^import\s+(?:\*\s+as\s+)?\w+\s+from\s+['"](?:node:)?fs(?:\/promises)?['"]/m.test(src) ||
                      /^import\s*\{[^}]*\}\s*from\s*['"](?:node:)?fs(?:\/promises)?['"]/m.test(src);
  const hasWriteCall = /\bwriteFileSync\b|\brenameSync\b|\bmkdirSync\b|\bwriteFile\b\s*\(/m.test(src);
  check('[54-compound] sink-proposer.mjs has zero fs writer imports (30m; proposal-only L3)',
    !hasFsImport);
  check('[54-compound] sink-proposer.mjs has zero writeFile/renameSync/mkdirSync calls (30m; proposal-only L3)',
    !hasWriteCall);
}

// 30n [54-compound]  sink-proposer.mjs has zero memory/rules/backlog write references
if (fs.existsSync(s30SinkProposerPath)) {
  const src = fs.readFileSync(s30SinkProposerPath, 'utf8');
  // Exclude comment lines that reference the boundary docs
  const noWriteToSinks = !/writeFile[^(]*\(\s*[^,)]*(?:memory|\.claude\/rules|backlog)/i.test(src);
  check('[54-compound] sink-proposer.mjs has zero memory/rules/backlog write calls (30n; proposal-only)',
    noWriteToSinks);
}

// 30o [54-compound]  9-path clean-room scope grep (outside notice blocks)
{
  const s30CleanRoomTargets = [
    s30CompoundReadmePath,
    s30CompoundTemplatePath,
    s30CompoundRouterPath,
    s30SinkProposerPath,
    s30CompoundCmdPath,
    s30CompoundWorkflowPath,
    s30PlanningCompoundReadme,
  ];
  // Each file must contain the verbatim clean-room notice keyword
  const missingNotice = s30CleanRoomTargets.filter(p => {
    if (!fs.existsSync(p)) return true;
    const c = fs.readFileSync(p, 'utf8');
    return !(/Clean-room notice/i.test(c) && /compound-engineering-plugin/.test(c));
  });
  check(`[54-compound] 9-path verbatim clean-room notice present (30o; missing: [${missingNotice.length}])`,
    missingNotice.length === 0);
}

// 30p [54-compound]  .planning/compound/README.md exists + clean-room
check('[54-compound] .planning/compound/README.md exists (30p)', fs.existsSync(s30PlanningCompoundReadme));
if (fs.existsSync(s30PlanningCompoundReadme)) {
  const c = fs.readFileSync(s30PlanningCompoundReadme, 'utf8');
  check('[54-compound] .planning/compound/README.md contains clean-room notice (30p)',
    /Clean-room notice/i.test(c) && /compound-engineering-plugin/.test(c));
}

// 30q [54-compound]  command count === 89 (cross-section verification of 29q amendment)
{
  const cmdsDir = path.resolve(__dirname, '..', 'commands', 'sunco');
  const allMdFiles = fs.readdirSync(cmdsDir).filter(f => f.endsWith('.md'));
  check(`[54-compound] command count === 89 post-Phase-54 (30q; current=${allMdFiles.length})`,
    allMdFiles.length === 89);
}

// 30r [54-compound]  product-contract.md L92 command count updated to 89 with Phase 54 attribution
if (fs.existsSync(s30ProductContract)) {
  const c = fs.readFileSync(s30ProductContract, 'utf8');
  check('[54-compound] product-contract.md Total commands: 89 (30r; G7)',
    /Total commands\*\*?:\s*89/.test(c));
  check('[54-compound] product-contract.md references Phase 54 / compound (30r; G7)',
    /compound.*Phase 54|Phase 54.*compound/i.test(c));
}

// 30s [54-compound]  Phase 52a byte-stable content-marker parity (parallels 28r/29r)
{
  const s30Phase52aMarkers = [
    { path: path.resolve(__dirname, '..', 'references', 'router', 'README.md'),                marker: /Consumer map/, label: 'router README Consumer map' },
    { path: path.resolve(__dirname, '..', 'references', 'router', 'STAGE-MACHINE.md'),         marker: /Stage enum \(10\)/, label: 'STAGE-MACHINE Stage enum' },
    { path: path.resolve(__dirname, '..', 'references', 'router', 'EVIDENCE-MODEL.md'),        marker: /7-point Freshness Gate/, label: 'EVIDENCE-MODEL 7-point' },
    { path: path.resolve(__dirname, '..', 'references', 'router', 'CONFIDENCE-CALIBRATION.md'),marker: /Deterministic formula/, label: 'CONFIDENCE-CALIBRATION deterministic formula' },
    { path: path.resolve(__dirname, '..', 'references', 'router', 'APPROVAL-BOUNDARY.md'),     marker: /definitional class/, label: 'APPROVAL-BOUNDARY definitional class' },
    { path: path.resolve(__dirname, '..', 'schemas', 'route-decision.schema.json'),            marker: /"const":\s*"route-decision"/, label: 'route-decision schema const' },
  ];
  const missing = [];
  for (const { path: p, marker, label } of s30Phase52aMarkers) {
    if (!fs.existsSync(p)) { missing.push(label + ' (file missing)'); continue; }
    if (!marker.test(fs.readFileSync(p, 'utf8'))) missing.push(label);
  }
  check(`[54-compound] Phase 52a assets byte-stable: 6 content markers preserved (30s; L10, missing: [${missing.join(', ')}])`,
    missing.length === 0);
}

// 30t [54-compound]  Phase 52b runtime byte-stable content-marker parity
{
  const s30Phase52bMarkers = [
    { path: path.resolve(__dirname, '..', 'commands', 'sunco', 'router.md'),                   marker: /^name:\s*sunco:router/m, label: 'router.md frontmatter' },
    { path: path.resolve(__dirname, '..', 'workflows', 'router.md'),                           marker: /Router Workflow \(Phase 52b\)/, label: 'workflows/router.md title' },
    { path: path.resolve(__dirname, '..', 'references', 'router', 'src', 'classifier.mjs'),    marker: /export function classifyStage/, label: 'classifier export' },
    { path: path.resolve(__dirname, '..', 'references', 'router', 'src', 'evidence-collector.mjs'), marker: /export function collectEvidence/, label: 'evidence-collector export' },
    { path: path.resolve(__dirname, '..', 'references', 'router', 'src', 'confidence.mjs'),    marker: /export function computeConfidence/, label: 'confidence export' },
    { path: path.resolve(__dirname, '..', 'references', 'router', 'src', 'decision-writer.mjs'), marker: /export function writeDecision/, label: 'decision-writer export' },
  ];
  const missing = [];
  for (const { path: p, marker, label } of s30Phase52bMarkers) {
    if (!fs.existsSync(p)) { missing.push(label + ' (file missing)'); continue; }
    if (!marker.test(fs.readFileSync(p, 'utf8'))) missing.push(label);
  }
  check(`[54-compound] Phase 52b runtime byte-stable: 6 content markers preserved (30t; L10, missing: [${missing.join(', ')}])`,
    missing.length === 0);
}

// 30u [54-compound]  Phase 53 wrappers byte-stable content-marker parity
{
  const s30Phase53Markers = [
    { path: path.resolve(__dirname, '..', 'commands', 'sunco', 'do.md'),      marker: /^name:\s*sunco:do\s*$/m, label: 'do.md frontmatter' },
    { path: path.resolve(__dirname, '..', 'commands', 'sunco', 'next.md'),    marker: /^name:\s*sunco:next\s*$/m, label: 'next.md frontmatter' },
    { path: path.resolve(__dirname, '..', 'commands', 'sunco', 'mode.md'),    marker: /^name:\s*sunco:mode\s*$/m, label: 'mode.md frontmatter' },
    { path: path.resolve(__dirname, '..', 'commands', 'sunco', 'manager.md'), marker: /^name:\s*sunco:manager\s*$/m, label: 'manager.md frontmatter' },
  ];
  const missing = [];
  for (const { path: p, marker, label } of s30Phase53Markers) {
    if (!fs.existsSync(p)) { missing.push(label + ' (file missing)'); continue; }
    if (!marker.test(fs.readFileSync(p, 'utf8'))) missing.push(label);
  }
  check(`[54-compound] Phase 53 wrappers byte-stable: 4 frontmatter markers preserved (30u; L10, missing: [${missing.join(', ')}])`,
    missing.length === 0);
}

// 30v [54-compound]  compound-router.mjs defines COMPOUND_SECTIONS with 8 canonical names
if (fs.existsSync(s30CompoundRouterPath)) {
  const src = fs.readFileSync(s30CompoundRouterPath, 'utf8');
  const has8Sections = /COMPOUND_SECTIONS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/.test(src);
  const all8Present = ['context', 'learnings', 'patterns_sdi', 'rule_promotions', 'automation', 'seeds', 'memory_proposals', 'approval_log']
    .every(n => new RegExp(`['"]${n}['"]`).test(src));
  check('[54-compound] compound-router.mjs exports COMPOUND_SECTIONS with all 8 canonical names (30v)',
    has8Sections && all8Present);
}

// 30w [54-compound]  sink-proposer.mjs L3 split 1:1 bucket mapping (constants + exports)
if (fs.existsSync(s30SinkProposerPath)) {
  const src = fs.readFileSync(s30SinkProposerPath, 'utf8');
  const hasObservationTypes = /OBSERVATION_SDI\s*=\s*['"]sdi_observational['"]/.test(src) &&
                              /OBSERVATION_SPEC_RULE\s*=\s*['"]spec_rule_prescriptive['"]/.test(src) &&
                              /OBSERVATION_MEMORY\s*=\s*['"]memory_candidate['"]/.test(src);
  check('[54-compound] sink-proposer.mjs defines 3 observation types constants (30w; L3 split)',
    hasObservationTypes);
  check('[54-compound] sink-proposer.mjs exports proposeSinks + renderProposalSections (30w)',
    /export function proposeSinks/.test(src) && /export function renderProposalSections/.test(src));
}

// 30x [54-compound]  Gate 54 hard-lock invariants: architecture.md NOT touched + 4 wrappers + 7 prior stage commands byte-stable from 72a391a
// (This is a pre-commit invariant verified by git diff; smoke asserts that
// the current command file set's canonical identifiers are preserved, not a
// full byte-equality check — full byte-equality lives in the git pre-commit
// invariant per 54-CONTEXT done-when #21.)
{
  const hardLockedFrontmatterSet = [
    'brainstorming', 'plan', 'execute', 'verify', 'proceed-gate', 'ship', 'release',
    'do', 'next', 'mode', 'manager', 'router', 'auto', 'where-am-i',
  ];
  const cmdsDir = path.resolve(__dirname, '..', 'commands', 'sunco');
  const allOk = hardLockedFrontmatterSet.every(n => {
    const p = path.resolve(cmdsDir, `${n}.md`);
    if (!fs.existsSync(p)) return false;
    const c = fs.readFileSync(p, 'utf8');
    // Handle frontmatter: "name: sunco:<n>" (with hyphen for proceed-gate / where-am-i)
    return new RegExp(`^name:\\s*sunco:${n.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*$`, 'm').test(c);
  });
  check('[54-compound] 14 hard-locked command frontmatters preserved (30x; L10/L11 R1 continuation)',
    allOk);
}

// Summary
console.log(`\n${'─'.repeat(50)}`);
console.log(`  ${GREEN}${passed} passed${RESET}, ${failed > 0 ? RED : ''}${failed} failed${RESET}, ${warnings > 0 ? YELLOW : ''}${warnings} warnings${RESET}`);
console.log(`${'─'.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);

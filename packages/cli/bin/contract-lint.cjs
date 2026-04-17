#!/usr/bin/env node
'use strict';

/**
 * SUNCO Contract Lint
 *
 * Validates that source files match the product contract.
 * Run as `npm run lint` in packages/cli.
 *
 * Checks:
 *   1. Command count matches contract
 *   2. Verify layer count is 7 everywhere
 *   3. No prohibited paths in workflows
 *   4. Hook files match contract
 *   5. Required files present in package
 *   6. Gate commands exist
 */

const fs = require('fs');
const path = require('path');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const pkgRoot = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    console.log(`  ${GREEN}PASS${RESET} ${name}`);
    passed++;
  } else {
    console.log(`  ${RED}FAIL${RESET} ${name}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

console.log(`\n${BOLD}SUNCO Contract Lint${RESET}\n`);

// 1. Command count
const cmdsDir = path.join(pkgRoot, 'commands', 'sunco');
const cmdFiles = fs.readdirSync(cmdsDir).filter(f => f.endsWith('.md'));
const contractPath = path.join(pkgRoot, 'references', 'product-contract.md');
const contract = fs.readFileSync(contractPath, 'utf8');

// Update contract command count to match reality
const countMatch = contract.match(/Total commands.*?:\s*(\d+)/);
const contractCount = countMatch ? parseInt(countMatch[1], 10) : 0;
check(`Command count: contract says ${contractCount}, actual ${cmdFiles.length}`, cmdFiles.length === contractCount,
  contractCount !== cmdFiles.length ? `Update product-contract.md command count to ${cmdFiles.length}` : '');

// 2. Verify layer count consistency (all critical files)
console.log('');
const repoReadme = path.join(pkgRoot, '..', '..', 'README.md');
const layerFiles = [
  { file: 'commands/sunco/verify.md', label: 'verify command' },
  { file: 'workflows/verify-phase.md', label: 'verify workflow' },
  { file: 'references/product-contract.md', label: 'product contract' },
];
// Also check README if available
if (fs.existsSync(repoReadme)) {
  const readmeContent = fs.readFileSync(repoReadme, 'utf8');
  const readmeHas7 = readmeContent.includes('7-layer') || readmeContent.includes('7 layer') || readmeContent.includes('7-Layer');
  const readmeHas5or6 = /[56]-layer|[56] layer/i.test(readmeContent);
  check('README.md: says 7-layer', readmeHas7);
  check('README.md: no stale 5/6-layer', !readmeHas5or6, readmeHas5or6 ? 'found old layer count' : '');
}
for (const { file, label } of layerFiles) {
  const fp = path.join(pkgRoot, file);
  if (!fs.existsSync(fp)) { check(`${label}: file exists`, false); continue; }
  const content = fs.readFileSync(fp, 'utf8');
  const has7 = content.includes('7-layer') || content.includes('7 layer') || content.includes('Layer count: 7') || content.includes('7-Layer');
  const has5or6 = /[56]-layer|[56] layer/.test(content);
  check(`${label}: says 7-layer`, has7);
  check(`${label}: no stale 5/6-layer`, !has5or6, has5or6 ? 'found old layer count reference' : '');
}

// 3. Prohibited paths in workflows
console.log('');
const wfDir = path.join(pkgRoot, 'workflows');
const wfFiles = fs.readdirSync(wfDir).filter(f => f.endsWith('.md'));
let badPaths = 0;
for (const wf of wfFiles) {
  const content = fs.readFileSync(path.join(wfDir, wf), 'utf8');
  if (content.includes('$(npm root -g)/sunco/bin/sunco-tools')) badPaths++;
  if (content.includes('$HOME/.sunco/bin/sunco-tools')) badPaths++;
}
check('No prohibited paths in workflows', badPaths === 0, `${badPaths} files with bad paths`);

// 4. Hook files
console.log('');
const expectedHooks = ['sunco-check-update.cjs', 'sunco-statusline.cjs', 'sunco-context-monitor.cjs', 'sunco-prompt-guard.cjs', 'sunco-mode-router.cjs'];
const hooksDir = path.join(pkgRoot, 'hooks');
for (const hook of expectedHooks) {
  check(`Hook: ${hook}`, fs.existsSync(path.join(hooksDir, hook)));
}

// 5. Required package files
console.log('');
const requiredFiles = ['bin/install.cjs', 'bin/sunco-tools.cjs', 'bin/smoke-test.cjs'];
for (const f of requiredFiles) {
  check(`Package file: ${f}`, fs.existsSync(path.join(pkgRoot, f)));
}

// 6. Gate commands
console.log('');
const gateFiles = ['plan-gate.md', 'artifact-gate.md', 'proceed-gate.md', 'dogfood-gate.md'];
for (const g of gateFiles) {
  check(`Gate: ${g}`, fs.existsSync(path.join(cmdsDir, g)));
}

// 6b. Project-start chain: office-hours -> brainstorming -> new
console.log('');
const chainCommands = ['office-hours.md', 'brainstorming.md', 'new.md'];
for (const c of chainCommands) {
  check(`Project-start command: ${c}`, fs.existsSync(path.join(cmdsDir, c)));
}
const chainWorkflows = ['office-hours.md', 'brainstorming.md', 'new-project.md'];
for (const w of chainWorkflows) {
  check(`Project-start workflow: ${w}`, fs.existsSync(path.join(pkgRoot, 'workflows', w)));
}
const vendoredSkill = path.join(pkgRoot, 'references', 'superpowers', 'brainstorming', 'SKILL.md');
check('Vendored Superpowers brainstorming SKILL.md exists', fs.existsSync(vendoredSkill));
if (fs.existsSync(vendoredSkill)) {
  const vendored = fs.readFileSync(vendoredSkill, 'utf8');
  check('Vendored SKILL.md preserves Superpowers HARD-GATE', vendored.includes('<HARD-GATE>'));
  check('Vendored SKILL.md wires SUNCO handoff', vendored.includes('/sunco:new --from-preflight'));
  check('Vendored SKILL.md forbids /sunco:execute during brainstorming', vendored.includes('/sunco:execute'));
  check('Vendored SKILL.md forbids /sunco:ship during brainstorming', vendored.includes('/sunco:ship'));
}
const brainstormingWf = path.join(pkgRoot, 'workflows', 'brainstorming.md');
if (fs.existsSync(brainstormingWf)) {
  const wf = fs.readFileSync(brainstormingWf, 'utf8');
  check('brainstorming workflow references vendored source', wf.includes('references/superpowers/brainstorming/SKILL.md'));
  check('brainstorming workflow hands off to /sunco:new --from-preflight', wf.includes('/sunco:new --from-preflight'));
  check('brainstorming workflow shows full lifecycle map', wf.includes('Full Lifecycle Map'));
  check('brainstorming workflow maps Superpowers 14 skills', wf.includes('Superpowers skill') && wf.includes('writing-plans') && wf.includes('test-driven-development'));
}
const officeHoursWf = path.join(pkgRoot, 'workflows', 'office-hours.md');
if (fs.existsSync(officeHoursWf)) {
  const wf = fs.readFileSync(officeHoursWf, 'utf8');
  check('office-hours workflow chains into brainstorming by default', wf.includes('/sunco:brainstorming'));
}
const helpWf = path.join(pkgRoot, 'workflows', 'help.md');
if (fs.existsSync(helpWf)) {
  const wf = fs.readFileSync(helpWf, 'utf8');
  check('help workflow shows full feature lifecycle', wf.includes('/sunco:office-hours') && wf.includes('/sunco:brainstorming') && wf.includes('/sunco:verify') && wf.includes('/sunco:review'));
  check('help workflow exposes Superpowers ↔ SUNCO skill map', wf.includes('Superpowers') && wf.includes('SUNCO equivalent'));
}
const planWf = path.join(pkgRoot, 'workflows', 'plan-phase.md');
if (fs.existsSync(planWf)) {
  const wf = fs.readFileSync(planWf, 'utf8');
  check('plan-phase enforces zero-context-executor discipline', wf.includes('zero prior context') || wf.includes('zero codebase context'));
}
const reviewWf = path.join(pkgRoot, 'workflows', 'review.md');
if (fs.existsSync(reviewWf)) {
  const wf = fs.readFileSync(reviewWf, 'utf8');
  check('review workflow documents receive-review loop', wf.includes('Receiving Review Feedback') || wf.includes('receiving-code-review'));
  check('review workflow mandates re-verify after fix', wf.includes('/sunco:verify'));
}
const verifyWf = path.join(pkgRoot, 'workflows', 'verify-phase.md');
if (fs.existsSync(verifyWf)) {
  const wf = fs.readFileSync(verifyWf, 'utf8');
  check('verify-phase states verification-before-completion principle', wf.includes('Verification-Before-Completion') || wf.includes('proof exists'));
}
const addPhaseWf = path.join(pkgRoot, 'workflows', 'add-phase.md');
if (fs.existsSync(addPhaseWf)) {
  const wf = fs.readFileSync(addPhaseWf, 'utf8');
  check('add-phase routes new capabilities to brainstorming', wf.includes('/sunco:brainstorming'));
}
const insertPhaseWf = path.join(pkgRoot, 'workflows', 'insert-phase.md');
if (fs.existsSync(insertPhaseWf)) {
  const wf = fs.readFileSync(insertPhaseWf, 'utf8');
  check('insert-phase routes new capabilities to brainstorming', wf.includes('/sunco:brainstorming'));
}

// 7. README contract alignment
console.log('');
if (fs.existsSync(repoReadme)) {
  const readmeContent = fs.readFileSync(repoReadme, 'utf8');
  // Command count in README should match actual
  const readmeCmdMatch = readmeContent.match(/(\d+)\s*slash commands/);
  if (readmeCmdMatch) {
    const readmeCmdCount = parseInt(readmeCmdMatch[1], 10);
    check(`README command count matches actual (README: ${readmeCmdCount}, actual: ${cmdFiles.length})`, readmeCmdCount === cmdFiles.length);
  }
  // No "Claude Code 전용" if Codex is full support
  check('README: no outdated "Claude Code only" claim', !readmeContent.includes('현재는 Claude Code 전용'));
  // Cursor support must match between README and product contract
  const readmeHasCursorFull = readmeContent.includes('Cursor') && readmeContent.includes('Full support');
  const contractContent = fs.readFileSync(contractPath, 'utf8');
  const contractHasCursorFull = contractContent.includes('Cursor') && contractContent.includes('Full support');
  check('README ↔ contract: Cursor support level matches', readmeHasCursorFull === contractHasCursorFull,
    readmeHasCursorFull !== contractHasCursorFull ? `README: ${readmeHasCursorFull}, contract: ${contractHasCursorFull}` : '');
}

// 8. Gate enforcement in ship/release (stop-the-line check)
console.log('');
const shipSkillPath = path.join(pkgRoot, '..', 'skills-workflow', 'src', 'ship.skill.ts');
const releaseSkillPath = path.join(pkgRoot, '..', 'skills-workflow', 'src', 'release.skill.ts');
if (fs.existsSync(shipSkillPath)) {
  const shipSrc = fs.readFileSync(shipSkillPath, 'utf8');
  check('ship.skill.ts: no --skip-verify option', !shipSrc.includes("'--skip-verify'"));
  check('ship.skill.ts: uses shared proceedGate', shipSrc.includes('proceedGate'));
}
if (fs.existsSync(releaseSkillPath)) {
  const releaseSrc = fs.readFileSync(releaseSkillPath, 'utf8');
  check('release.skill.ts: uses shared artifactGate', releaseSrc.includes('artifactGate'));
  check('release.skill.ts: has fresh re-verify', releaseSrc.includes('workflow.verify'));
  check('release.skill.ts: no Non-fatal bypass', !releaseSrc.includes('Non-fatal'));
}
const planSkillPath = path.join(pkgRoot, '..', 'skills-workflow', 'src', 'plan.skill.ts');
if (fs.existsSync(planSkillPath)) {
  const planSrc = fs.readFileSync(planSkillPath, 'utf8');
  check('plan.skill.ts: uses shared planGate', planSrc.includes('planGate'));
}
// Verify shared gates module exists
const gatesPath = path.join(pkgRoot, '..', 'skills-workflow', 'src', 'shared', 'gates.ts');
check('shared/gates.ts exists', fs.existsSync(gatesPath));

// 8. Dogfood checks (SUNCO applies own principles)
console.log('');
const repoRoot = path.join(pkgRoot, '..', '..');
const claudeMdPath = path.join(repoRoot, 'CLAUDE.md');
if (fs.existsSync(claudeMdPath)) {
  const claudeMdLines = fs.readFileSync(claudeMdPath, 'utf8').split('\n').length;
  check(`Dogfood: CLAUDE.md ≤ 60 lines (actual: ${claudeMdLines})`, claudeMdLines <= 60);
} else {
  check('Dogfood: CLAUDE.md exists', false);
}
const claudeRulesDir = path.join(repoRoot, '.claude', 'rules');
const hasRulesDir = fs.existsSync(claudeRulesDir);
check('Dogfood: .claude/rules/ directory exists', hasRulesDir);
if (hasRulesDir) {
  const ruleFiles = fs.readdirSync(claudeRulesDir).filter(f => f.endsWith('.md'));
  check(`Dogfood: .claude/rules/ has rule files (${ruleFiles.length})`, ruleFiles.length >= 3);
}

// Summary
console.log(`\n${'─'.repeat(50)}`);
console.log(`  ${GREEN}${passed} passed${RESET}, ${failed > 0 ? RED : ''}${failed} failed${RESET}`);
console.log(`${'─'.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);

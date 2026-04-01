#!/usr/bin/env node

/**
 * SUNCO vs GSD — Codex A/B Benchmark Runner
 *
 * Runs identical project bootstrapping tasks through both SUNCO and GSD
 * pipelines on the same Codex model, then compares outputs across 6 dimensions.
 *
 * Usage:
 *   node codex-benchmark.cjs run --project <path-to-prd> [--model gpt-5.4] [--rounds 3]
 *   node codex-benchmark.cjs score --run-dir <path>
 *   node codex-benchmark.cjs report --run-dir <path>
 *
 * Prerequisites:
 *   - Codex CLI installed and authenticated (`codex auth login`)
 *   - GSD skill pack installed (`get-shit-done-cc`)
 *   - SUNCO skill pack installed (`popcoru`)
 *   - Both must be available in the Codex environment
 *
 * Output:
 *   .benchmark/
 *     {timestamp}/
 *       config.json          — Run configuration
 *       sunco/               — SUNCO pipeline outputs
 *         project.md
 *         requirements.md
 *         roadmap.md
 *         context-phase-1.md
 *         plan-phase-1.md
 *         timing.json
 *       gsd/                 — GSD pipeline outputs
 *         project.md
 *         requirements.md
 *         roadmap.md
 *         context-phase-1.md
 *         plan-phase-1.md
 *         timing.json
 *       scores.json          — Dimension scores
 *       report.md            — Human-readable comparison report
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

// ─── Output helpers ──────────────────────────────────────────────────────────

function out(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function fail(message) {
  out({ error: message });
  process.exit(0);
}

function log(msg) {
  process.stderr.write(`[benchmark] ${msg}\n`);
}

// ─── Benchmark dimensions ────────────────────────────────────────────────────

/**
 * 6 evaluation dimensions for A/B comparison.
 * Each dimension is scored 1-10 by the evaluator model.
 */
const DIMENSIONS = [
  {
    id: 'completeness',
    name: 'Artifact Completeness',
    description: 'Were all expected artifacts produced? Are all sections filled in (not stubs)?',
    weight: 1.5,
  },
  {
    id: 'specificity',
    name: 'Project Specificity',
    description: 'Are outputs specific to the given project, or generic boilerplate that could apply to anything?',
    weight: 2.0,
  },
  {
    id: 'actionability',
    name: 'Actionability',
    description: 'Could a developer immediately start executing the plans? Are tasks concrete with clear done-when criteria?',
    weight: 2.0,
  },
  {
    id: 'consistency',
    name: 'Cross-Artifact Consistency',
    description: 'Do requirements, roadmap, context, and plans reference each other correctly? Are there contradictions?',
    weight: 1.5,
  },
  {
    id: 'quality',
    name: 'Writing Quality',
    description: 'Clarity, conciseness, proper markdown structure, no repetition, good use of tables vs prose.',
    weight: 1.0,
  },
  {
    id: 'innovation',
    name: 'Decision Quality',
    description: 'Are design decisions well-reasoned? Do context files surface real tradeoffs, not obvious ones?',
    weight: 1.5,
  },
];

// ─── Pipeline definitions ────────────────────────────────────────────────────

/**
 * The pipeline stages to run for each harness.
 * Each stage is a command template with {project_path} and {phase} placeholders.
 */
const SUNCO_PIPELINE = [
  { stage: 'new-project', command: '/sunco:new --auto --prd {project_path}', artifact: 'PROJECT.md' },
  { stage: 'discuss', command: '/sunco:discuss 1 --auto', artifact: 'CONTEXT.md' },
  { stage: 'plan', command: '/sunco:plan 1 --skip-verify --auto', artifact: 'PLAN.md' },
];

const GSD_PIPELINE = [
  { stage: 'new-project', command: '/gsd:new-project --auto --prd {project_path}', artifact: 'PROJECT.md' },
  { stage: 'discuss', command: '/gsd:discuss-phase 1 --auto', artifact: 'CONTEXT.md' },
  { stage: 'plan', command: '/gsd:plan-phase 1 --skip-verify --auto', artifact: 'PLAN.md' },
];

// ─── Commands ────────────────────────────────────────────────────────────────

function cmdRun(args) {
  const prdIdx = args.indexOf('--project');
  if (prdIdx === -1 || !args[prdIdx + 1]) return fail('--project <path-to-prd> is required');
  const prdPath = path.resolve(args[prdIdx + 1]);
  if (!fs.existsSync(prdPath)) return fail(`PRD not found: ${prdPath}`);

  const modelIdx = args.indexOf('--model');
  const model = modelIdx !== -1 && args[modelIdx + 1] ? args[modelIdx + 1] : 'gpt-5.4';

  const roundsIdx = args.indexOf('--rounds');
  const rounds = roundsIdx !== -1 && args[roundsIdx + 1] ? parseInt(args[roundsIdx + 1], 10) : 1;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const runDir = path.resolve('.benchmark', timestamp);
  fs.mkdirSync(path.join(runDir, 'sunco'), { recursive: true });
  fs.mkdirSync(path.join(runDir, 'gsd'), { recursive: true });

  // Save config
  const config = {
    prd: prdPath,
    prd_content: fs.readFileSync(prdPath, 'utf8').slice(0, 500) + '...',
    model,
    rounds,
    timestamp: new Date().toISOString(),
    sunco_version: getSuncoVersion(),
    gsd_version: getGsdVersion(),
  };
  fs.writeFileSync(path.join(runDir, 'config.json'), JSON.stringify(config, null, 2) + '\n');

  log(`Benchmark run: ${timestamp}`);
  log(`PRD: ${prdPath}`);
  log(`Model: ${model}`);
  log(`Rounds: ${rounds}`);
  log(`Output: ${runDir}`);
  log('');

  for (let round = 1; round <= rounds; round++) {
    if (rounds > 1) log(`═══ Round ${round}/${rounds} ═══`);

    // Run SUNCO pipeline
    log('Running SUNCO pipeline...');
    const suncoResult = runPipeline('sunco', SUNCO_PIPELINE, prdPath, model, runDir, round);

    // Run GSD pipeline
    log('Running GSD pipeline...');
    const gsdResult = runPipeline('gsd', GSD_PIPELINE, prdPath, model, runDir, round);

    log(`Round ${round} complete. SUNCO: ${suncoResult.stages_completed}/${SUNCO_PIPELINE.length} stages. GSD: ${gsdResult.stages_completed}/${GSD_PIPELINE.length} stages.`);
  }

  out({
    completed: true,
    run_dir: runDir,
    next_step: `node codex-benchmark.cjs score --run-dir "${runDir}"`,
  });
}

function runPipeline(harness, pipeline, prdPath, model, runDir, round) {
  const harnessDir = path.join(runDir, harness, round > 1 ? `round-${round}` : '');
  fs.mkdirSync(harnessDir, { recursive: true });

  const timing = { stages: [], total_ms: 0 };
  let stagesCompleted = 0;

  // Create isolated workspace for this pipeline run
  const workDir = path.join(harnessDir, 'workspace');
  fs.mkdirSync(workDir, { recursive: true });

  // Copy PRD to workspace
  fs.copyFileSync(prdPath, path.join(workDir, 'PRD.md'));

  // Initialize git in workspace
  try {
    execSync('git init', { cwd: workDir, stdio: 'pipe' });
    execSync('git add -A && git commit -m "init" --allow-empty', { cwd: workDir, stdio: 'pipe' });
  } catch { /* ok */ }

  for (const stage of pipeline) {
    const command = stage.command.replace('{project_path}', path.join(workDir, 'PRD.md'));
    log(`  [${harness}] Stage: ${stage.stage}`);

    const start = Date.now();
    try {
      // Use codex exec to run the command
      const codexCmd = `codex exec --model ${model} --approval-mode full-auto "${command}"`;
      const result = spawnSync('bash', ['-c', codexCmd], {
        cwd: workDir,
        timeout: 300000, // 5 min per stage
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const elapsed = Date.now() - start;
      timing.stages.push({
        stage: stage.stage,
        elapsed_ms: elapsed,
        exit_code: result.status,
        success: result.status === 0,
      });
      timing.total_ms += elapsed;

      if (result.status === 0) {
        stagesCompleted++;
        log(`  [${harness}] ✓ ${stage.stage} (${(elapsed / 1000).toFixed(1)}s)`);
      } else {
        log(`  [${harness}] ✗ ${stage.stage} (exit ${result.status}, ${(elapsed / 1000).toFixed(1)}s)`);
        // Save error output
        fs.writeFileSync(
          path.join(harnessDir, `${stage.stage}-error.txt`),
          `STDOUT:\n${result.stdout || ''}\n\nSTDERR:\n${result.stderr || ''}\n`
        );
      }
    } catch (e) {
      const elapsed = Date.now() - start;
      timing.stages.push({ stage: stage.stage, elapsed_ms: elapsed, error: e.message });
      timing.total_ms += elapsed;
      log(`  [${harness}] ✗ ${stage.stage} (error: ${e.message})`);
    }
  }

  // Copy planning artifacts to the run directory
  copyArtifacts(workDir, harnessDir);

  // Save timing
  fs.writeFileSync(path.join(harnessDir, 'timing.json'), JSON.stringify(timing, null, 2) + '\n');

  return { stages_completed: stagesCompleted, timing };
}

function copyArtifacts(workDir, destDir) {
  const planningDir = path.join(workDir, '.planning');
  if (!fs.existsSync(planningDir)) return;

  const filesToCopy = [
    'PROJECT.md', 'REQUIREMENTS.md', 'ROADMAP.md', 'STATE.md',
  ];

  for (const f of filesToCopy) {
    const src = path.join(planningDir, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(destDir, f.toLowerCase().replace('.md', '') + '.md'));
    }
  }

  // Copy phase artifacts
  const phasesDir = path.join(planningDir, 'phases');
  if (fs.existsSync(phasesDir)) {
    const phases = fs.readdirSync(phasesDir);
    for (const phase of phases) {
      const phaseDir = path.join(phasesDir, phase);
      try {
        if (!fs.statSync(phaseDir).isDirectory()) continue;
      } catch { continue; }

      const files = fs.readdirSync(phaseDir);
      for (const f of files) {
        if (f.endsWith('.md')) {
          const target = f.toLowerCase().includes('context') ? 'context-phase-1.md' :
                         f.toLowerCase().includes('plan') ? 'plan-phase-1.md' :
                         f.toLowerCase().includes('research') ? 'research-phase-1.md' :
                         f;
          fs.copyFileSync(path.join(phaseDir, f), path.join(destDir, target));
        }
      }
    }
  }
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

function cmdScore(args) {
  const dirIdx = args.indexOf('--run-dir');
  if (dirIdx === -1 || !args[dirIdx + 1]) return fail('--run-dir <path> is required');
  const runDir = path.resolve(args[dirIdx + 1]);
  if (!fs.existsSync(runDir)) return fail(`Run directory not found: ${runDir}`);

  const suncoDir = path.join(runDir, 'sunco');
  const gsdDir = path.join(runDir, 'gsd');

  // Build evaluation prompt
  const suncoArtifacts = readAllArtifacts(suncoDir);
  const gsdArtifacts = readAllArtifacts(gsdDir);

  const evalPrompt = buildEvalPrompt(suncoArtifacts, gsdArtifacts);

  // Save evaluation prompt for manual use or automated scoring
  const evalPath = path.join(runDir, 'eval-prompt.md');
  fs.writeFileSync(evalPath, evalPrompt);

  // Generate scoring template
  const scoringTemplate = {
    dimensions: DIMENSIONS.map(d => ({
      id: d.id,
      name: d.name,
      weight: d.weight,
      sunco_score: null,
      gsd_score: null,
      notes: '',
    })),
    summary: {
      sunco_weighted_total: null,
      gsd_weighted_total: null,
      winner: null,
      margin: null,
    },
  };

  const scoresPath = path.join(runDir, 'scores.json');
  fs.writeFileSync(scoresPath, JSON.stringify(scoringTemplate, null, 2) + '\n');

  out({
    eval_prompt_written: evalPath,
    scores_template_written: scoresPath,
    instructions: [
      `1. Send the eval prompt to an evaluator model (Claude Opus or GPT-5.4):`,
      `   cat "${evalPath}" | pbcopy`,
      `2. Fill in scores in ${scoresPath}`,
      `3. Run: node codex-benchmark.cjs report --run-dir "${runDir}"`,
    ],
  });
}

function readAllArtifacts(dir) {
  const result = {};
  if (!fs.existsSync(dir)) return result;

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  for (const f of files) {
    result[f] = fs.readFileSync(path.join(dir, f), 'utf8');
  }

  // Read timing
  const timingPath = path.join(dir, 'timing.json');
  if (fs.existsSync(timingPath)) {
    result['_timing'] = JSON.parse(fs.readFileSync(timingPath, 'utf8'));
  }

  return result;
}

function buildEvalPrompt(suncoArtifacts, gsdArtifacts) {
  const lines = [
    '# SUNCO vs GSD — Blind A/B Evaluation',
    '',
    'You are evaluating two AI harness systems that were given the same project description.',
    'Both ran their full pipeline (new-project → discuss → plan) on the same model.',
    'Score each on 6 dimensions (1-10). Be specific about why.',
    '',
    '## Evaluation Dimensions',
    '',
  ];

  for (const d of DIMENSIONS) {
    lines.push(`### ${d.id} (weight: ${d.weight}x)`);
    lines.push(d.description);
    lines.push('');
  }

  lines.push('---', '', '## System A Outputs', '');
  for (const [name, content] of Object.entries(suncoArtifacts)) {
    if (name.startsWith('_')) continue;
    lines.push(`### ${name}`, '```markdown', content.slice(0, 3000), '```', '');
  }

  lines.push('---', '', '## System B Outputs', '');
  for (const [name, content] of Object.entries(gsdArtifacts)) {
    if (name.startsWith('_')) continue;
    lines.push(`### ${name}`, '```markdown', content.slice(0, 3000), '```', '');
  }

  lines.push(
    '---', '',
    '## Scoring Instructions', '',
    'For each dimension, score System A and System B independently (1-10).',
    'Then provide a brief justification.',
    '',
    'Output as JSON:',
    '```json',
    '{',
    '  "dimensions": [',
    '    { "id": "completeness", "a_score": N, "b_score": N, "notes": "..." },',
    '    ...',
    '  ],',
    '  "overall_winner": "A" or "B",',
    '  "key_differences": "..."',
    '}',
    '```',
    '',
    'Be honest and specific. If one system is clearly better, say so.',
  );

  return lines.join('\n');
}

// ─── Reporting ───────────────────────────────────────────────────────────────

function cmdReport(args) {
  const dirIdx = args.indexOf('--run-dir');
  if (dirIdx === -1 || !args[dirIdx + 1]) return fail('--run-dir <path> is required');
  const runDir = path.resolve(args[dirIdx + 1]);

  const scoresPath = path.join(runDir, 'scores.json');
  if (!fs.existsSync(scoresPath)) return fail(`No scores.json found in ${runDir}. Run 'score' first.`);

  const scores = JSON.parse(fs.readFileSync(scoresPath, 'utf8'));
  const configPath = path.join(runDir, 'config.json');
  const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};

  // Calculate weighted totals
  let suncoTotal = 0, gsdTotal = 0, totalWeight = 0;
  for (const dim of scores.dimensions) {
    if (dim.sunco_score !== null && dim.gsd_score !== null) {
      suncoTotal += dim.sunco_score * dim.weight;
      gsdTotal += dim.gsd_score * dim.weight;
      totalWeight += dim.weight;
    }
  }

  const suncoWeighted = totalWeight > 0 ? (suncoTotal / totalWeight).toFixed(2) : 'N/A';
  const gsdWeighted = totalWeight > 0 ? (gsdTotal / totalWeight).toFixed(2) : 'N/A';
  const winner = suncoTotal > gsdTotal ? 'SUNCO' : suncoTotal < gsdTotal ? 'GSD' : 'TIE';

  // Read timings
  const suncoTiming = readTiming(path.join(runDir, 'sunco', 'timing.json'));
  const gsdTiming = readTiming(path.join(runDir, 'gsd', 'timing.json'));

  // Generate report
  const report = [
    '# SUNCO vs GSD — Codex A/B Benchmark Report',
    '',
    `**Date:** ${config.timestamp || 'unknown'}`,
    `**Model:** ${config.model || 'unknown'}`,
    `**SUNCO version:** ${config.sunco_version || 'unknown'}`,
    `**GSD version:** ${config.gsd_version || 'unknown'}`,
    '',
    '## Scores',
    '',
    '| Dimension | Weight | SUNCO | GSD | Delta |',
    '|-----------|--------|-------|-----|-------|',
  ];

  for (const dim of scores.dimensions) {
    const s = dim.sunco_score !== null ? dim.sunco_score : '-';
    const g = dim.gsd_score !== null ? dim.gsd_score : '-';
    const delta = (dim.sunco_score !== null && dim.gsd_score !== null)
      ? (dim.sunco_score - dim.gsd_score > 0 ? `+${dim.sunco_score - dim.gsd_score}` : `${dim.sunco_score - dim.gsd_score}`)
      : '-';
    report.push(`| ${dim.name} | ${dim.weight}x | ${s} | ${g} | ${delta} |`);
  }

  report.push(
    '',
    `**Weighted Average:** SUNCO ${suncoWeighted} / GSD ${gsdWeighted}`,
    `**Winner:** ${winner} (margin: ${Math.abs(suncoTotal - gsdTotal).toFixed(1)} weighted points)`,
    '',
    '## Timing',
    '',
    '| Stage | SUNCO (s) | GSD (s) |',
    '|-------|-----------|---------|',
  );

  const stages = ['new-project', 'discuss', 'plan'];
  for (const stage of stages) {
    const s = suncoTiming[stage] ? (suncoTiming[stage] / 1000).toFixed(1) : '-';
    const g = gsdTiming[stage] ? (gsdTiming[stage] / 1000).toFixed(1) : '-';
    report.push(`| ${stage} | ${s} | ${g} |`);
  }

  report.push(
    '',
    `**Total:** SUNCO ${suncoTiming._total ? (suncoTiming._total / 1000).toFixed(1) : '-'}s / GSD ${gsdTiming._total ? (gsdTiming._total / 1000).toFixed(1) : '-'}s`,
    '',
    '## Notes',
    '',
  );

  for (const dim of scores.dimensions) {
    if (dim.notes) {
      report.push(`**${dim.name}:** ${dim.notes}`, '');
    }
  }

  const reportPath = path.join(runDir, 'report.md');
  fs.writeFileSync(reportPath, report.join('\n') + '\n');

  out({
    report_written: reportPath,
    winner,
    sunco_weighted: parseFloat(suncoWeighted),
    gsd_weighted: parseFloat(gsdWeighted),
  });
}

function readTiming(timingPath) {
  if (!fs.existsSync(timingPath)) return {};
  try {
    const timing = JSON.parse(fs.readFileSync(timingPath, 'utf8'));
    const result = { _total: timing.total_ms || 0 };
    for (const s of (timing.stages || [])) {
      result[s.stage] = s.elapsed_ms;
    }
    return result;
  } catch { return {}; }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSuncoVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(
      path.join(__dirname, '..', 'package.json'), 'utf8'
    ));
    return pkg.version || 'unknown';
  } catch { return 'unknown'; }
}

function getGsdVersion() {
  try {
    const result = execSync('npm list get-shit-done-cc --json 2>/dev/null', { encoding: 'utf8' });
    const parsed = JSON.parse(result);
    return parsed.dependencies?.['get-shit-done-cc']?.version || 'unknown';
  } catch { return 'unknown'; }
}

// ─── Router ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  fail(
    'Usage: node codex-benchmark.cjs <command> [args]\n' +
    'Commands:\n' +
    '  run --project <prd.md> [--model gpt-5.4] [--rounds 3]\n' +
    '  score --run-dir <path>\n' +
    '  report --run-dir <path>'
  );
}

switch (command) {
  case 'run': cmdRun(args); break;
  case 'score': cmdScore(args); break;
  case 'report': cmdReport(args); break;
  default: fail(`Unknown command: ${command}. Valid: run, score, report`);
}

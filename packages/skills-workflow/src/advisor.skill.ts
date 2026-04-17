/**
 * @sunco/skills-workflow - Advisor Skill (debug surface)
 *
 * /sunco:advisor is the manual surface for SUNCO's ambient advisor.
 * The real product experience lives in the hooks (Phase 2+3). This
 * skill exists so users can:
 *
 *   1. Configure their advisor (interactive first-run picker or
 *      --reconfigure). Persists to ~/.sun/config.toml under [advisor].
 *   2. Run the classifier by hand on any task text (--verbose,
 *      --json for programmatic use on non-Claude runtimes).
 *   3. Inspect what the advisor decided last (--last).
 *   4. Force a quick model/thinking override for a single call
 *      (--model, --thinking).
 *
 * Per Phase 0 contract, this skill NEVER writes code, NEVER runs
 * skills, and NEVER auto-deploys. The autoExecuteSkills flag in
 * AdvisorConfig is typed as literal `false` — even if a caller
 * mutates the config at runtime, the hooks and this skill ignore it.
 */

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult } from '@sunco/core';

import {
  DEFAULT_ADVISOR_CONFIG,
  DEFAULT_SUPPRESSION_POLICY,
  type AdvisorConfig,
  type ThinkingTier,
} from './shared/advisor-types.js';
import { classifyRisk } from './shared/risk-classifier.js';
import { decideAdvice } from './shared/advisor-policy.js';
import { annotateDecision } from './shared/advisor-message.js';
import {
  applyPickerChoice,
  buildPickerOptions,
  detectProviders,
  parsePickerId,
  resolveInitialConfig,
  shouldShowPicker,
} from './shared/advisor-selector.js';

// ---------------------------------------------------------------------------
// Config file I/O (TOML-lite, matching the hook parser)
// ---------------------------------------------------------------------------

const configPath = (): string => join(homedir(), '.sun', 'config.toml');

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function parseToml(raw: string): Record<string, Partial<Record<string, string | number | boolean>>> {
  const sections: Record<string, Record<string, string | number | boolean>> = {};
  let current = '';
  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('[') && line.endsWith(']')) {
      current = line.slice(1, -1).trim().toLowerCase();
      sections[current] ??= {};
      continue;
    }
    if (!current || !line || line.startsWith('#')) continue;
    const m = line.match(/^([a-z_]+)\s*=\s*(.+?)\s*$/i);
    if (!m) continue;
    const key = m[1]!;
    let val: string | number | boolean = m[2]!;
    if (typeof val === 'string') {
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      else if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (/^-?\d+(\.\d+)?$/.test(val)) val = Number(val);
    }
    sections[current]![key] = val;
  }
  return sections;
}

function serializeAdvisor(cfg: AdvisorConfig): string {
  const lines = [
    '[advisor]',
    `enabled = ${cfg.enabled}`,
    `model = "${cfg.model}"`,
    `thinking = "${cfg.thinking}"`,
    `profile = "${cfg.profile}"`,
    `cost_cap_per_session_usd = ${cfg.costCapPerSessionUSD}`,
    `fallback = "${cfg.fallback}"`,
    `prompt_injection = ${cfg.promptInjection}`,
    `post_action_queue = ${cfg.postActionQueue}`,
    // PERMANENT FALSE — written for transparency, ignored at runtime.
    `auto_execute_skills = false`,
    `blocking = ${cfg.blocking}`,
    `max_visible_per_session = ${cfg.maxVisiblePerSession}`,
    `suppress_same_key_minutes = ${cfg.suppressSameKeyMinutes}`,
  ];
  return lines.join('\n') + '\n';
}

async function readExistingConfig(): Promise<Partial<AdvisorConfig> | null> {
  if (!(await pathExists(configPath()))) return null;
  try {
    const raw = await readFile(configPath(), 'utf-8');
    const sections = parseToml(raw);
    const adv = sections.advisor;
    if (!adv) return null;
    return {
      enabled: typeof adv.enabled === 'boolean' ? adv.enabled : undefined,
      model: typeof adv.model === 'string' ? adv.model : undefined,
      thinking: typeof adv.thinking === 'string' ? (adv.thinking as ThinkingTier) : undefined,
      profile: typeof adv.profile === 'string' ? (adv.profile as AdvisorConfig['profile']) : undefined,
      costCapPerSessionUSD: typeof adv.cost_cap_per_session_usd === 'number' ? adv.cost_cap_per_session_usd : undefined,
      fallback: typeof adv.fallback === 'string' ? adv.fallback : undefined,
      promptInjection: typeof adv.prompt_injection === 'boolean' ? adv.prompt_injection : undefined,
      postActionQueue: typeof adv.post_action_queue === 'boolean' ? adv.post_action_queue : undefined,
      blocking: typeof adv.blocking === 'boolean' ? adv.blocking : undefined,
      maxVisiblePerSession: typeof adv.max_visible_per_session === 'number' ? adv.max_visible_per_session : undefined,
      suppressSameKeyMinutes: typeof adv.suppress_same_key_minutes === 'number' ? adv.suppress_same_key_minutes : undefined,
      // autoExecuteSkills is permanently false regardless of what's on disk.
      autoExecuteSkills: false,
    };
  } catch {
    return null;
  }
}

async function writeConfig(cfg: AdvisorConfig): Promise<void> {
  const existing = (await pathExists(configPath()))
    ? await readFile(configPath(), 'utf-8')
    : '';

  // Replace or append the [advisor] block.
  const advisorSection = serializeAdvisor(cfg);
  let out: string;
  if (existing.includes('[advisor]')) {
    out = existing.replace(
      /\[advisor\][\s\S]*?(?=\n\[|\n*$)/,
      advisorSection.trimEnd(),
    );
  } else {
    out = existing.trimEnd() + (existing.trim() ? '\n\n' : '') + advisorSection;
  }
  await mkdir(join(homedir(), '.sun'), { recursive: true });
  await writeFile(configPath(), out, 'utf-8');
}

// ---------------------------------------------------------------------------
// Provider probe (best-effort)
// ---------------------------------------------------------------------------

async function makeEnvProbe(): Promise<ReturnType<typeof detectProviders>> {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);
  const whichCliExists = async (name: string): Promise<boolean> => {
    try {
      await run('which', [name], { timeout: 1500 });
      return true;
    } catch {
      return false;
    }
  };
  // Sync-friendly wrapper: resolve all probes concurrently.
  const [claude, codex] = await Promise.all([
    whichCliExists('claude'),
    whichCliExists('codex'),
  ]);
  return detectProviders(process.env, (n) =>
    n === 'claude' ? claude : n === 'codex' ? codex : false,
  );
}

// ---------------------------------------------------------------------------
// Skill
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.advisor',
  command: 'advisor',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  complexity: 'standard',
  tier: 'user',
  description:
    'Ambient advisor debug surface — classify tasks, inspect last decision, reconfigure model/thinking',
  options: [
    { flags: '--reconfigure', description: 'Force the first-run picker to rerun and rewrite ~/.sun/config.toml' },
    { flags: '--last', description: 'Show the last decision (from ~/.sun/advisor.log tail)' },
    { flags: '--json', description: 'Print the decision as JSON (for non-Claude runtimes)' },
    { flags: '--verbose', description: 'Include signals, gates, and full XML injection' },
    { flags: '--model <id>', description: 'One-shot model override (e.g. claude-sonnet-4-6)' },
    { flags: '--thinking <tier>', description: 'One-shot thinking tier: off|low|medium|high|max' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    await ctx.ui.entry({
      title: 'Advisor',
      description: 'Debug surface for SUNCO ambient advisor',
    });

    // --- Flow 1: --reconfigure (interactive picker) ---
    if (ctx.args.reconfigure === true) {
      return runReconfigure(ctx);
    }

    // --- Flow 2: --last (show last log entry) ---
    if (ctx.args.last === true) {
      return showLast(ctx);
    }

    // --- Flow 3: classify the task ---
    return classifyTask(ctx);
  },
});

// ---------------------------------------------------------------------------
// Flow implementations
// ---------------------------------------------------------------------------

async function runReconfigure(ctx: SkillContext): Promise<SkillResult> {
  const existing = await readExistingConfig();
  const baseCfg: AdvisorConfig = existing
    ? { ...DEFAULT_ADVISOR_CONFIG, ...existing, autoExecuteSkills: false }
    : resolveInitialConfig(await makeEnvProbe());

  const env = await makeEnvProbe();
  const options = buildPickerOptions(env);

  const answer = await ctx.ui.ask({
    message: 'Pick your advisor — which model should act as your advisor?',
    options: options.map((o) => ({
      id: o.id,
      label: o.label,
      description: o.caption,
    })),
  });

  const chosen = options.find((o) => o.id === answer.selectedId) ?? options[0]!;
  const next = applyPickerChoice(baseCfg, chosen.id);
  await writeConfig(next);

  const summary = `advisor set to ${next.model}${next.thinking ? ` (thinking=${next.thinking})` : ''}`;
  await ctx.ui.result({
    success: true,
    title: 'Advisor',
    summary,
    details: [
      `Wrote ${configPath()}`,
      `enabled=${next.enabled}, blocking=${next.blocking}, prompt_injection=${next.promptInjection}`,
      `auto_execute_skills=false (permanent)`,
    ],
  });
  return { success: true, summary, data: { config: next } };
}

async function showLast(ctx: SkillContext): Promise<SkillResult> {
  const logPath = join(homedir(), '.sun', 'advisor.log');
  if (!(await pathExists(logPath))) {
    const msg = 'No advisor.log yet — no decision on record.';
    await ctx.ui.result({ success: true, title: 'Advisor', summary: msg });
    return { success: true, summary: msg };
  }
  const raw = await readFile(logPath, 'utf-8');
  const lines = raw.trim().split('\n').slice(-10);
  await ctx.ui.result({
    success: true,
    title: 'Advisor — last entries',
    summary: `Last ${lines.length} advisor log entries`,
    details: lines,
  });
  return { success: true, summary: 'last decisions surfaced', data: { entries: lines } };
}

async function classifyTask(ctx: SkillContext): Promise<SkillResult> {
  const positional = (ctx.args._ as string[] | undefined) ?? [];
  const task = positional.join(' ').trim();

  if (!task) {
    const msg = 'Provide a task to classify: /sunco:advisor "<task>"';
    await ctx.ui.result({ success: false, title: 'Advisor', summary: msg });
    return { success: false, summary: msg };
  }

  const existing = await readExistingConfig();
  const cfg: AdvisorConfig = existing
    ? { ...DEFAULT_ADVISOR_CONFIG, ...existing, autoExecuteSkills: false }
    : DEFAULT_ADVISOR_CONFIG;

  // --model / --thinking one-shot overrides
  const modelOverride = ctx.args.model as string | undefined;
  const thinkingOverride = ctx.args.thinking as ThinkingTier | undefined;
  const effective: AdvisorConfig = {
    ...cfg,
    model: modelOverride ?? cfg.model,
    thinking: thinkingOverride ?? cfg.thinking,
  };

  // Risk classification — text-only input, no diff stats available here.
  const risk = classifyRisk({ intent: task, files: [] });
  const decision = annotateDecision(decideAdvice({ risk, config: effective }));

  const json = ctx.args.json === true;
  const verbose = ctx.args.verbose === true;

  if (json) {
    // Print JSON to stdout via ui.result.details so adapters can parse.
    const payload = { decision, config: effective, picker: shouldShowPicker(existing) };
    await ctx.ui.result({
      success: true,
      title: 'Advisor (json)',
      summary: 'decision emitted as JSON',
      details: [JSON.stringify(payload, null, 2)],
    });
    return { success: true, summary: 'decision emitted as JSON', data: payload };
  }

  const details: string[] = [];
  if (decision.userVisibleMessage) details.push(decision.userVisibleMessage);
  if (verbose) {
    details.push('');
    details.push(`level=${decision.level}  confidence=${decision.confidence}`);
    details.push(`reasonCodes: ${decision.reasonCodes.join(', ') || '(none)'}`);
    details.push(
      `preGates: ${decision.preGates.map((g) => (g.scope ? `${g.gate}(${g.scope})` : g.gate)).join(', ') || '(none)'}`,
    );
    details.push(
      `postGates: ${decision.postGates.map((g) => (g.scope ? `${g.gate}(${g.scope})` : g.gate)).join(', ') || '(none)'}`,
    );
    if (decision.confirmationReason) {
      details.push(`confirmationReason: ${decision.confirmationReason}`);
    }
    if (decision.systemInjection) {
      details.push('');
      details.push(decision.systemInjection);
    }
  }

  await ctx.ui.result({
    success: true,
    title: 'Advisor',
    summary: decision.userVisibleMessage ?? `level=${decision.level} (silent: no visible advice)`,
    details,
  });

  return {
    success: true,
    summary: decision.userVisibleMessage ?? 'silent',
    data: { decision, config: effective },
  };
}

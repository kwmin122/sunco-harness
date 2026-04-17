/**
 * @sunco/skills-workflow - Orchestrate Skill
 *
 * Dynamic multi-agent orchestration front-door. Inspired by OmO's
 * Sisyphus (AGPL-3.0, NOT vendored — principles only, clean-room
 * reimplementation) and gstack's role-based sprint discipline.
 *
 * Core contract:
 *   1. The orchestrator NEVER writes code itself.
 *   2. There is NO fixed pipeline. Steps come from signal detection.
 *   3. Read-only roles (explorer/librarian/oracle/verifier) precede
 *      write roles (developer/frontend/docs/debugger).
 *   4. A Context Pack (original request + prior outputs) threads every
 *      step so later roles don't re-ask what earlier roles answered.
 *   5. Each step delegates to a concrete SUNCO skill (workflow.*) or
 *      sunco-* subagent — never raw prompt execution.
 *
 * Flow:
 *   - detect signals from the user's task description
 *   - build a routed plan (ordered list of RoutedStep)
 *   - if --plan, print the plan and exit (dry run)
 *   - otherwise execute each step in order, appending to the context pack
 *   - return a structured summary per step
 */

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult } from '@sunco/core';
import {
  buildPlan,
  buildContextPack,
  extendContextPack,
  renderContextPack,
  type OrchestrationPlan,
  type RoutedStep,
} from './shared/orchestration-router.js';

interface StepOutcome {
  role: RoutedStep['role'];
  delegate: string;
  readOnly: boolean;
  success: boolean;
  summary: string;
}

function renderPlanForUi(plan: OrchestrationPlan): string[] {
  const lines: string[] = [];
  lines.push(`Rationale: ${plan.rationale}`);
  lines.push('');
  lines.push('Signals:');
  for (const s of plan.signals) {
    lines.push(`  - ${s.kind}: ${s.evidence}`);
  }
  lines.push('');
  lines.push('Steps:');
  plan.steps.forEach((s, i) => {
    lines.push(`  ${i + 1}. [${s.role}] (${s.readOnly ? 'read-only' : 'write'}) → ${s.delegate}`);
    lines.push(`       reason: ${s.reason}`);
  });
  return lines;
}

export default defineSkill({
  id: 'workflow.orchestrate',
  command: 'orchestrate',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  complexity: 'complex',
  tier: 'user',
  description:
    'Dynamic multi-agent router — signal-driven role selection (explorer/librarian/oracle/developer/frontend/docs/verifier)',
  options: [
    { flags: '--plan', description: 'Dry run. Print the routed plan and exit without executing.' },
    { flags: '--dry-run', description: 'Alias for --plan.' },
    {
      flags: '--stop-on-fail',
      description: 'Abort the chain on the first failed step instead of continuing with read-only prior outputs.',
    },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    await ctx.ui.entry({
      title: 'Orchestrate',
      description: 'Signal-driven multi-agent routing',
    });

    const positional = (ctx.args._ as string[] | undefined) ?? [];
    let task = positional.join(' ').trim();
    if (!task) {
      const response = await ctx.ui.askText({
        message: 'Describe the task. The orchestrator will route to roles, not prompt you for files.',
        placeholder: 'e.g. "find and fix the auth middleware bug"',
      });
      task = response.text.trim();
    }
    if (!task) {
      const msg = 'No task provided.';
      await ctx.ui.result({ success: false, title: 'Orchestrate', summary: msg });
      return { success: false, summary: msg };
    }

    const plan = buildPlan(task);
    const planLines = renderPlanForUi(plan);

    const dryRun = ctx.args.plan === true || ctx.args['dry-run'] === true || ctx.args.dryRun === true;
    if (dryRun) {
      await ctx.ui.result({
        success: true,
        title: 'Orchestrate (dry run)',
        summary: `Plan: ${plan.steps.length} step(s). ${plan.rationale}`,
        details: planLines,
      });
      return {
        success: true,
        summary: `Routed plan with ${plan.steps.length} step(s) (dry run).`,
        data: { plan, dryRun: true },
      };
    }

    // Execution.
    const pack0 = buildContextPack(task);
    const outcomes: StepOutcome[] = [];
    let pack = pack0;
    const stopOnFail = ctx.args['stop-on-fail'] === true || ctx.args.stopOnFail === true;

    for (const step of plan.steps) {
      const skillId = step.delegate.startsWith('agent.') ? null : step.delegate;
      let outcome: StepOutcome;

      if (!skillId) {
        // Agent-typed delegate. We route via a dedicated agent name; the
        // runtime may or may not honor this — record it either way so the
        // user can see what was intended.
        outcome = {
          role: step.role,
          delegate: step.delegate,
          readOnly: step.readOnly,
          success: true,
          summary: `(advisory) recommended subagent ${step.delegate.slice('agent.'.length)}`,
        };
      } else {
        try {
          const result = await ctx.run(skillId, {
            _: [task],
            context_pack: renderContextPack(pack),
          } as Record<string, unknown>);
          outcome = {
            role: step.role,
            delegate: skillId,
            readOnly: step.readOnly,
            success: result.success,
            summary: result.summary ?? (result.success ? 'ok' : 'failed'),
          };
        } catch (err) {
          outcome = {
            role: step.role,
            delegate: skillId,
            readOnly: step.readOnly,
            success: false,
            summary: err instanceof Error ? err.message : String(err),
          };
        }
      }

      outcomes.push(outcome);
      pack = extendContextPack(pack, step.role, outcome.summary);

      if (!outcome.success && stopOnFail) {
        break;
      }
    }

    const failed = outcomes.filter((o) => !o.success);
    const success = failed.length === 0;
    const summary = success
      ? `Orchestrated ${outcomes.length} step(s) — all green.`
      : `Orchestrated ${outcomes.length} step(s) — ${failed.length} failed.`;

    await ctx.ui.result({
      success,
      title: 'Orchestrate',
      summary,
      details: [
        ...planLines,
        '',
        'Outcomes:',
        ...outcomes.map(
          (o, i) => `  ${i + 1}. [${o.role}] ${o.success ? '✓' : '✗'} ${o.summary}`,
        ),
      ],
    });

    return {
      success,
      summary,
      data: { plan, outcomes },
    };
  },
});

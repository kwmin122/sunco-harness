/**
 * @sunco/skills-workflow - Do Skill (Phase 27 Plan B: deterministic classifier)
 *
 * Natural language front door. Classifies user input into 6 categories
 * using a deterministic keyword matcher (D-12: no LLM) and delegates to
 * the appropriate existing skill. Low confidence -> fallback to deep/next.
 *
 * Requirements: WF-15, WF-18, OMOUX-01
 */

import { defineSkill, appendRoutingMiss } from '@sunco/core';
import type { SkillContext, SkillResult } from '@sunco/core';
import { classifyInput, CATEGORY_SKILL_MAP } from './shared/category-classifier.js';

function isNewProjectBootstrapIntent(input: string): boolean {
  return [
    /\b(?:bootstrap|start|create|new|init|initialize)\b.*\b(?:project|app|product|startup|idea)\b/i,
    /\b(?:project|app|product|startup|idea)\b.*\b(?:bootstrap|start|create|new|init|initialize)\b/i,
    /(?:새\s*프로젝트|프로젝트\s*시작|프로젝트\s*초기화|아이디어.*(?:시작|개발|구체화|디벨롭)|(?:시작|개발|구체화|디벨롭).*아이디어)/i,
    /(?:스킬\s*사용|스킬사용).*(?:아이디어|프로젝트|시작)/i,
  ].some((pattern) => pattern.test(input));
}

function isBrainstormingIntent(input: string): boolean {
  return [
    /\bbrainstorm(?:ing)?\b/i,
    /브레인\s*스토밍/i,
  ].some((pattern) => pattern.test(input));
}

export default defineSkill({
  id: 'workflow.do',
  command: 'do',
  kind: 'deterministic',
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  complexity: 'simple',
  tier: 'user',
  description: 'Route natural language to the right skill',

  options: [],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    await ctx.ui.entry({
      title: 'Do',
      description: 'Routing your request to the right skill...',
    });

    const positionalArgs = ctx.args['_'] as string[] | undefined;
    let userInput: string;

    if (positionalArgs && positionalArgs.length > 0) {
      userInput = positionalArgs.join(' ');
    } else {
      const response = await ctx.ui.askText({
        message: 'What would you like to do?',
        placeholder: 'Describe what you want in natural language...',
      });
      userInput = response.text;
    }

    if (!userInput.trim()) {
      const msg = 'No input provided. Usage: sunco do "your request here"';
      await ctx.ui.result({ success: false, title: 'Do', summary: msg });
      return { success: false, summary: msg };
    }

    if (isNewProjectBootstrapIntent(userInput)) {
      const label = '\u2192 new-project: office-hours -> brainstorming -> new';
      const skillResult = await ctx.run('workflow.new', { _: [userInput] });

      await ctx.ui.result({
        success: skillResult.success,
        title: 'Do',
        summary: `Routed to workflow.new: ${skillResult.summary ?? ''}`,
        details: [label],
      });

      return {
        success: skillResult.success,
        summary: `workflow.new: ${skillResult.summary ?? ''}`,
        data: {
          routed: 'workflow.new',
          category: 'planning',
          confidence: 1,
          signals: [{ kind: 'phrase', value: 'new project bootstrap' }],
        },
      };
    }

    if (isBrainstormingIntent(userInput)) {
      const label = '\u2192 brainstorming: Superpowers brainstorming';
      const skillResult = await ctx.run('workflow.brainstorming', { _: [userInput] });

      await ctx.ui.result({
        success: skillResult.success,
        title: 'Do',
        summary: `Routed to workflow.brainstorming: ${skillResult.summary ?? ''}`,
        details: [label],
      });

      return {
        success: skillResult.success,
        summary: `workflow.brainstorming: ${skillResult.summary ?? ''}`,
        data: {
          routed: 'workflow.brainstorming',
          category: 'planning',
          confidence: 1,
          signals: [{ kind: 'phrase', value: 'brainstorming' }],
        },
      };
    }

    const classification = classifyInput(userInput);
    const targetSkill = CATEGORY_SKILL_MAP[classification.category];
    const label = `\u2192 ${classification.category}: ${classification.matched_signals.map(s => s.value).join(', ') || 'fallback'}`;

    if (classification.fallback_reason) {
      try {
        await appendRoutingMiss(ctx.cwd, {
          at: new Date().toISOString(),
          input: userInput.slice(0, 200),
          classified_as: classification.confidence > 0 ? classification.category : null,
          fallback_reason: classification.fallback_reason,
          user_correction: null,
        });
      } catch {
        // telemetry write failure is non-fatal
      }
    }

    ctx.log.info(label, {
      category: classification.category,
      confidence: classification.confidence,
      targetSkill,
    });

    // eslint-disable-next-line no-console
    console.log(`\n  ${label}\n`);

    const delegateArgs: Record<string, unknown> = { _: [userInput] };
    if (classification.category === 'deep') {
      delegateArgs['full'] = true;
    }
    const skillResult = await ctx.run(targetSkill, delegateArgs);

    await ctx.ui.result({
      success: skillResult.success,
      title: 'Do',
      summary: `Routed to ${targetSkill}: ${skillResult.summary ?? ''}`,
      details: [`${label} (confidence: ${(classification.confidence * 100).toFixed(0)}%)`],
    });

    return {
      success: skillResult.success,
      summary: `${targetSkill}: ${skillResult.summary ?? ''}`,
      data: {
        routed: targetSkill,
        category: classification.category,
        confidence: classification.confidence,
        signals: classification.matched_signals,
      },
    };
  },
});

/**
 * @sunco/skills-workflow - Do Skill
 *
 * Natural language skill router. Accepts natural language input,
 * dispatches a planning agent with the full skill catalog, and
 * invokes the identified skill via ctx.run(). Falls back to
 * workflow.quick when no skill matches.
 *
 * Requirements: WF-15, WF-18
 * Decisions: D-12 (NL intent), D-13 (catalog lookup), D-14 (quick fallback),
 *   D-15 (kind=prompt), D-16 (thin wrapper), D-17 (inter-skill chaining)
 */

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult, PermissionSet } from '@sunco/core';
import { buildDoRoutePrompt, SKILL_CATALOG } from './prompts/do-route.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Read-only permissions for the routing agent (D-14) */
const READ_ONLY_PERMISSIONS: PermissionSet = {
  role: 'planning',
  readPaths: ['**'],
  writePaths: [],
  allowTests: false,
  allowNetwork: false,
  allowGitWrite: false,
  allowCommands: [],
};

/** Agent timeout for routing (should be fast) */
const ROUTING_TIMEOUT = 30_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RouteResponse {
  skills: string[];
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract and parse the last JSON code block from agent output.
 * Uses the same pattern as execute.skill.ts for consistency.
 */
function parseRoutingResponse(outputText: string): RouteResponse | null {
  const jsonBlocks = outputText.match(/```json\s*\n([\s\S]*?)```/g);
  if (!jsonBlocks || jsonBlocks.length === 0) return null;

  const lastBlock = jsonBlocks[jsonBlocks.length - 1]!;
  const jsonStr = lastBlock.replace(/```json\s*\n?/, '').replace(/```$/, '').trim();

  try {
    const parsed = JSON.parse(jsonStr) as RouteResponse;
    if (Array.isArray(parsed.skills) && typeof parsed.reasoning === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Skill Definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.do',
  command: 'do',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  complexity: 'simple',
  tier: 'user',
  description: 'Route natural language to the right skill',

  options: [],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    // --- Entry ---
    await ctx.ui.entry({
      title: 'Do',
      description: 'Routing your request to the right skill...',
    });

    // --- Step 1: Get user input ---
    const positionalArgs = ctx.args['_'] as string[] | undefined;
    let userInput: string;

    if (positionalArgs && positionalArgs.length > 0) {
      userInput = positionalArgs.join(' ');
    } else {
      // Fallback: ask user interactively
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

    // --- Step 2: Check provider availability ---
    const providers = await ctx.agent.listProviders();
    if (providers.length === 0) {
      // No AI provider: fall back directly to quick
      ctx.log.info('No AI provider available, falling back to workflow.quick');
      return ctx.run('workflow.quick', { _: [userInput] });
    }

    // --- Step 3: Build prompt and dispatch routing agent ---
    const routingProgress = ctx.ui.progress({
      title: 'Routing',
      total: 1,
    });

    const prompt = buildDoRoutePrompt({
      userInput,
      skillCatalog: SKILL_CATALOG,
    });

    let routeResult: RouteResponse | null = null;

    try {
      const agentResult = await ctx.agent.run({
        role: 'planning',
        prompt,
        permissions: READ_ONLY_PERMISSIONS,
        timeout: ROUTING_TIMEOUT,
      });

      routeResult = parseRoutingResponse(agentResult.outputText);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.log.warn('Routing agent failed, falling back to quick', { error: msg });
    }

    routingProgress.update({ completed: 1 });
    routingProgress.done({ summary: routeResult ? 'Route identified' : 'Falling back to quick' });

    // --- Step 4: Execute identified skill or fallback ---
    if (!routeResult || routeResult.skills.length === 0) {
      // No match: fallback to workflow.quick (D-14)
      ctx.log.info('No skill match found, routing to workflow.quick');
      const quickResult = await ctx.run('workflow.quick', { _: [userInput] });

      await ctx.ui.result({
        success: quickResult.success,
        title: 'Do',
        summary: `Routed to quick execution: ${quickResult.summary ?? ''}`,
      });

      return {
        success: quickResult.success,
        summary: `Quick: ${quickResult.summary ?? ''}`,
        data: { routed: 'workflow.quick', reasoning: routeResult?.reasoning ?? 'No skill match' },
      };
    }

    // Execute the first matched skill
    const targetSkill = routeResult.skills[0]!;
    ctx.log.info(`Routing to ${targetSkill}: ${routeResult.reasoning}`);

    const skillResult = await ctx.run(targetSkill, {});

    await ctx.ui.result({
      success: skillResult.success,
      title: 'Do',
      summary: `Routed to ${targetSkill}: ${skillResult.summary ?? ''}`,
      details: [`Reasoning: ${routeResult.reasoning}`],
    });

    return {
      success: skillResult.success,
      summary: `${targetSkill}: ${skillResult.summary ?? ''}`,
      data: {
        routed: targetSkill,
        reasoning: routeResult.reasoning,
        allMatches: routeResult.skills,
      },
    };
  },
});

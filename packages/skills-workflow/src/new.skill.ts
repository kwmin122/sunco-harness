/**
 * @sunco/skills-workflow - New Project Skill
 *
 * Agent-powered greenfield project bootstrap.
 * Guides users from idea to roadmap via three-layer development:
 *   1. Office-hours diagnostic: pressure-test the problem and user
 *   2. Superpowers brainstorming: widen candidate approaches before committing
 *   3. SUNCO new: research and synthesize PROJECT.md + REQUIREMENTS.md + ROADMAP.md
 *
 * Requirements: WF-01 (agent-powered project bootstrap)
 * Decisions: D-01 (multi-step), D-02 (parallel research), D-03 (output artifacts),
 *   D-04 (adaptive questions), D-05 (synthesis), D-06 (kind: prompt), D-13 (location), D-16 (progress)
 */

import { defineSkill } from '@sunco/core';
import type { SkillContext, SkillResult } from '@sunco/core';
import type { AskOption } from '@sunco/core';
import { buildResearchPrompt, buildSynthesisPrompt } from './prompts/index.js';
import { writePlanningArtifact } from './shared/planning-writer.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Research topics for parallel agent dispatch (D-02) */
const RESEARCH_TOPICS = [
  'brainstorming',
  'tech-stack',
  'competitors',
  'architecture',
  'challenges',
  'ecosystem',
] as const;

/** Document separator used in synthesis output */
const DOCUMENT_SEPARATOR = '---DOCUMENT_SEPARATOR---';

/** Artifact filenames in order matching synthesis output */
const ARTIFACT_FILES = ['PROJECT.md', 'REQUIREMENTS.md', 'ROADMAP.md'] as const;

// ---------------------------------------------------------------------------
// Question Definitions (D-04: adaptive questions)
// ---------------------------------------------------------------------------

interface ChoiceQuestion {
  type: 'choice';
  key: string;
  message: string;
  options: AskOption[];
  defaultId?: string;
  /** Conditional: only ask if predicate returns true */
  condition?: (answers: Record<string, string>) => boolean;
}

interface TextQuestion {
  type: 'text';
  key: string;
  message: string;
  placeholder?: string;
  /** Conditional: only ask if predicate returns true */
  condition?: (answers: Record<string, string>) => boolean;
}

type Question = ChoiceQuestion | TextQuestion;

const QUESTIONS: Question[] = [
  {
    type: 'choice',
    key: 'goal',
    message: "Before we turn this into a project, what's the goal?",
    options: [
      { id: 'startup', label: 'Startup / product' },
      { id: 'internal', label: 'Internal tool / intrapreneurship' },
      { id: 'demo', label: 'Hackathon / demo' },
      { id: 'oss', label: 'Open source / research' },
      { id: 'learning', label: 'Learning / personal' },
      { id: 'creative', label: 'Creative side project' },
    ],
    defaultId: 'startup',
  },
  {
    type: 'text',
    key: 'demandEvidence',
    message: "Office hours: what's the strongest evidence someone actually wants this?",
    placeholder: 'Specific user behavior, money, pain, workaround, or personal need...',
  },
  {
    type: 'text',
    key: 'statusQuo',
    message: 'Office hours: what do people do today instead, even if it is messy?',
    placeholder: 'Current workflow, competitor, spreadsheet, manual process, nothing...',
  },
  {
    type: 'text',
    key: 'targetUsers',
    message: 'Office hours: who needs this most, specifically?',
    placeholder: 'Role, team, community, or named first user...',
  },
  {
    type: 'text',
    key: 'narrowestWedge',
    message: 'Office hours: what is the smallest version worth building first?',
    placeholder: 'One workflow, one result, one audience...',
  },
  {
    type: 'text',
    key: 'coolestVersion',
    message: 'Brainstorming: what would make this feel meaningfully better than the obvious version?',
    placeholder: 'A surprising interaction, automation, UX, insight, or 10x angle...',
  },
  {
    type: 'text',
    key: 'constraints',
    message: 'Brainstorming: what constraints should shape the solution?',
    placeholder: 'Time, budget, tech stack, privacy, team size, launch date...',
  },
  {
    type: 'choice',
    key: 'projectShape',
    message: 'What kind of deliverable should v1 become?',
    options: [
      { id: 'webapp', label: 'Web app' },
      { id: 'api', label: 'API service' },
      { id: 'cli', label: 'CLI tool' },
      { id: 'library', label: 'Library' },
      { id: 'mobile', label: 'Mobile app' },
      { id: 'docs', label: 'Docs / research artifact' },
      { id: 'other', label: 'Other / decide from context' },
    ],
    defaultId: 'webapp',
  },
];

// ---------------------------------------------------------------------------
// Skill Definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.new',
  command: 'new',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  complexity: 'complex',
  tier: 'user',
  description: 'Bootstrap a new project from an idea',

  async execute(ctx: SkillContext): Promise<SkillResult> {
    await ctx.ui.entry({
      title: 'New Project',
      description: 'Office hours -> Superpowers brainstorming -> project bootstrap',
    });

    // -----------------------------------------------------------------------
    // Step 1: Get idea (D-01 step 1)
    // -----------------------------------------------------------------------
    const positional = (ctx.args._ as string[] | undefined) ?? [];
    let idea = positional.join(' ').trim();

    if (!idea) {
      const response = await ctx.ui.askText({
        message: 'Describe your project idea:',
        placeholder: 'A CLI tool that...',
      });
      idea = response.text;
    }

    if (!idea) {
      await ctx.ui.result({
        success: false,
        title: 'New Project',
        summary: 'No idea provided',
      });
      return { success: false, summary: 'No idea provided' };
    }

    // -----------------------------------------------------------------------
    // Step 1.5: Check provider availability (D-06)
    // -----------------------------------------------------------------------
    const providers = await ctx.agent.listProviders();
    if (providers.length === 0) {
      const msg =
        'No AI provider available. Install Claude Code CLI or set ANTHROPIC_API_KEY to use sunco new.';
      await ctx.ui.result({
        success: false,
        title: 'New Project',
        summary: msg,
      });
      return { success: false, summary: msg };
    }

    // -----------------------------------------------------------------------
    // Step 2: Office-hours diagnostic + brainstorming (D-01 step 2, D-04)
    // -----------------------------------------------------------------------
    const answers: Record<string, string> = {};

    // Determine applicable questions
    const applicableQuestions: Question[] = [];
    for (const q of QUESTIONS) {
      if (!q.condition || q.condition(answers)) {
        applicableQuestions.push(q);
      }
      // Re-evaluate conditions as answers accumulate (after first pass)
    }

    const questionProgress = ctx.ui.progress({
      title: 'Office hours and brainstorming',
      total: applicableQuestions.length,
    });

    let questionsAsked = 0;
    for (const q of QUESTIONS) {
      // Skip conditional questions whose condition is not met
      if (q.condition && !q.condition(answers)) {
        continue;
      }

      if (q.type === 'choice') {
        const result = await ctx.ui.ask({
          message: q.message,
          options: q.options,
          defaultId: q.defaultId,
        });
        answers[q.key] = result.selectedLabel;
      } else {
        const result = await ctx.ui.askText({
          message: q.message,
          placeholder: q.placeholder,
        });
        answers[q.key] = result.text;
      }

      questionsAsked++;
      questionProgress.update({ completed: questionsAsked });
    }

    questionProgress.done({
      summary: `${questionsAsked} preflight questions answered`,
    });

    // -----------------------------------------------------------------------
    // Step 3: Parallel research dispatch (D-01 step 3, D-02)
    // -----------------------------------------------------------------------
    const researchProgress = ctx.ui.progress({
      title: 'Researching',
      total: RESEARCH_TOPICS.length,
    });

    let researchCompleted = 0;
    const researchResults = await Promise.allSettled(
      RESEARCH_TOPICS.map(async (topic) => {
        const result = await ctx.agent.run({
          role: 'research',
          prompt: buildResearchPrompt(topic, idea, answers),
          permissions: {
            role: 'research',
            readPaths: ['**'],
            writePaths: [],
            allowTests: false,
            allowNetwork: false,
            allowGitWrite: false,
            allowCommands: [],
          },
          timeout: 120_000,
        });
        researchCompleted++;
        researchProgress.update({
          completed: researchCompleted,
          message: `Completed: ${topic}`,
        });
        return { topic, result };
      }),
    );

    researchProgress.done({ summary: 'Research complete' });

    // Collect successful results, log warnings for failures (D-02)
    const successfulResearch: Array<{ topic: string; content: string }> = [];
    for (const entry of researchResults) {
      if (
        entry.status === 'fulfilled' &&
        entry.value.result.success
      ) {
        successfulResearch.push({
          topic: entry.value.topic,
          content: entry.value.result.outputText,
        });
      } else if (entry.status === 'rejected') {
        ctx.log.warn('Research agent failed', {
          error: String(entry.reason),
        });
      }
    }

    if (successfulResearch.length === 0) {
      const msg = 'All research agents failed. Cannot proceed with synthesis.';
      await ctx.ui.result({
        success: false,
        title: 'New Project',
        summary: msg,
      });
      return { success: false, summary: msg };
    }

    // -----------------------------------------------------------------------
    // Step 4: Synthesis via planning agent (D-01 step 4, D-05)
    // -----------------------------------------------------------------------
    const synthesisProgress = ctx.ui.progress({
      title: 'Synthesizing research into planning documents',
    });

    const synthesisResult = await ctx.agent.run({
      role: 'planning',
      prompt: buildSynthesisPrompt(idea, answers, successfulResearch),
      permissions: {
        role: 'planning',
        readPaths: ['**'],
        writePaths: ['.planning/**'],
        allowTests: false,
        allowNetwork: false,
        allowGitWrite: false,
        allowCommands: [],
      },
      timeout: 180_000,
    });

    synthesisProgress.done({ summary: 'Synthesis complete' });

    if (!synthesisResult.success) {
      const msg = 'Synthesis agent failed. Check agent logs for details.';
      await ctx.ui.result({
        success: false,
        title: 'New Project',
        summary: msg,
      });
      return { success: false, summary: msg };
    }

    // -----------------------------------------------------------------------
    // Step 5: Write artifacts (D-03)
    // -----------------------------------------------------------------------
    const writeProgress = ctx.ui.progress({
      title: 'Writing planning documents',
      total: ARTIFACT_FILES.length,
    });

    const outputText = synthesisResult.outputText;
    const documents = outputText.split(DOCUMENT_SEPARATOR).map((d) => d.trim());

    const writtenFiles: string[] = [];

    if (documents.length >= 3) {
      // Normal case: 3 separate documents
      for (let i = 0; i < ARTIFACT_FILES.length; i++) {
        const path = await writePlanningArtifact(
          ctx.cwd,
          ARTIFACT_FILES[i],
          documents[i],
        );
        writtenFiles.push(path);
        writeProgress.update({ completed: i + 1 });
      }
    } else {
      // Fallback: separator not found, write entire output as PROJECT.md
      ctx.log.warn(
        'DOCUMENT_SEPARATOR not found in synthesis output. Writing entire output as PROJECT.md.',
      );
      const path = await writePlanningArtifact(
        ctx.cwd,
        'PROJECT.md',
        outputText,
      );
      writtenFiles.push(path);
      writeProgress.update({ completed: 1 });
    }

    writeProgress.done({
      summary: `${writtenFiles.length} documents written`,
    });

    // -----------------------------------------------------------------------
    // Result
    // -----------------------------------------------------------------------
    const summary = `Project bootstrap complete. Created ${writtenFiles.length} planning documents in .planning/`;

    await ctx.ui.result({
      success: true,
      title: 'New Project',
      summary,
      details: writtenFiles.map((f) => `Created: ${f}`),
    });

    return {
      success: true,
      summary,
      data: { writtenFiles, researchTopics: RESEARCH_TOPICS.length },
    };
  },
});

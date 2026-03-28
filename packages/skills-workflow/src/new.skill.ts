/**
 * @sunco/skills-workflow - New Project Skill
 *
 * Agent-powered greenfield project bootstrap.
 * Guides users from idea to roadmap via multi-step orchestration:
 *   1. Accept idea (CLI args or interactive askText)
 *   2. Ask 5-8 adaptive clarifying questions
 *   3. Dispatch parallel research agents (tech-stack, competitors, architecture, challenges, ecosystem)
 *   4. Synthesize research into PROJECT.md + REQUIREMENTS.md + ROADMAP.md
 *   5. Write artifacts to .planning/
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
    key: 'projectType',
    message: 'What type of project is this?',
    options: [
      { id: 'cli', label: 'CLI tool' },
      { id: 'webapp', label: 'Web app' },
      { id: 'api', label: 'API service' },
      { id: 'library', label: 'Library' },
      { id: 'mobile', label: 'Mobile app' },
      { id: 'other', label: 'Other' },
    ],
    defaultId: 'webapp',
  },
  {
    type: 'choice',
    key: 'platform',
    message: 'Target platform?',
    options: [
      { id: 'browser', label: 'Browser' },
      { id: 'node', label: 'Node.js' },
      { id: 'both', label: 'Both (Browser + Node)' },
      { id: 'native', label: 'Native (Desktop/Mobile)' },
    ],
    defaultId: 'node',
  },
  {
    type: 'choice',
    key: 'language',
    message: 'Primary language?',
    options: [
      { id: 'typescript', label: 'TypeScript' },
      { id: 'python', label: 'Python' },
      { id: 'rust', label: 'Rust' },
      { id: 'go', label: 'Go' },
      { id: 'java', label: 'Java' },
      { id: 'other', label: 'Other' },
    ],
    defaultId: 'typescript',
  },
  {
    type: 'text',
    key: 'targetUsers',
    message: 'Describe your target users:',
    placeholder: 'e.g., developers building web apps...',
  },
  {
    type: 'text',
    key: 'coreProblem',
    message: "What's the core problem you're solving?",
    placeholder: 'e.g., existing tools are too slow for...',
  },
  {
    type: 'choice',
    key: 'scale',
    message: 'Scale expectations?',
    options: [
      { id: 'personal', label: 'Personal / side project' },
      { id: 'team', label: 'Small team' },
      { id: 'startup', label: 'Startup' },
      { id: 'enterprise', label: 'Enterprise' },
    ],
    defaultId: 'personal',
  },
  // Conditional: only for web projects
  {
    type: 'choice',
    key: 'frontend',
    message: 'Frontend framework preference?',
    options: [
      { id: 'react', label: 'React' },
      { id: 'vue', label: 'Vue' },
      { id: 'svelte', label: 'Svelte' },
      { id: 'none', label: 'No framework / SSR only' },
    ],
    defaultId: 'react',
    condition: (answers) =>
      answers.projectType === 'webapp' || answers.projectType === 'Web app',
  },
  // Conditional: only for API projects
  {
    type: 'choice',
    key: 'database',
    message: 'Database preference?',
    options: [
      { id: 'postgres', label: 'PostgreSQL' },
      { id: 'sqlite', label: 'SQLite' },
      { id: 'mongodb', label: 'MongoDB' },
      { id: 'none', label: 'No database / TBD' },
    ],
    defaultId: 'postgres',
    condition: (answers) =>
      answers.projectType === 'api' || answers.projectType === 'API service',
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
  description: 'Bootstrap a new project from an idea',

  async execute(ctx: SkillContext): Promise<SkillResult> {
    await ctx.ui.entry({
      title: 'New Project',
      description: 'Agent-powered project bootstrap',
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
    // Step 2: Ask 5-8 clarifying questions (D-01 step 2, D-04)
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
      title: 'Gathering context',
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

    questionProgress.done({ summary: `${questionsAsked} questions answered` });

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

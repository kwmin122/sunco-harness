/**
 * @sunco/skills-workflow - Doc Skill
 *
 * Unified document generation skill.
 * Generates HWPX (Korean standard), Markdown, or template-based documents
 * from project context via an AI agent.
 *
 * Usage:
 *   sunco doc --type readme --md
 *   sunco doc --type 제안서 --hwpx --output proposal.hwpx
 *   sunco doc --type api --md --output docs/API.md
 *   sunco doc --template report-template --output report.md
 *
 * Requirements: DOC-01, DOC-02, DOC-03
 */

import { defineSkill } from '@sunco/core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { HwpxWriter } from './shared/hwpx-writer.js';
import { buildDocPrompt } from './prompts/doc-generate.js';
import type { PermissionSet } from '@sunco/core';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOC_PERMISSIONS: PermissionSet = {
  role: 'research',
  readPaths: ['**'],
  writePaths: [],
  allowTests: false,
  allowNetwork: false,
  allowGitWrite: false,
  allowCommands: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Gather project context from common project files.
 * Reads PROJECT.md, ROADMAP.md, README.md, package.json as available.
 */
async function gatherProjectContext(cwd: string): Promise<string> {
  const candidates = [
    '.planning/PROJECT.md',
    'PROJECT.md',
    'ROADMAP.md',
    'README.md',
    'package.json',
  ];

  const parts: string[] = [];

  for (const file of candidates) {
    try {
      const content = await readFile(join(cwd, file), 'utf-8');
      const trimmed = content.trim();
      if (trimmed.length > 0) {
        parts.push(`### ${file}\n\n${trimmed}`);
      }
    } catch {
      // File not found — skip
    }
  }

  return parts.length > 0
    ? parts.join('\n\n---\n\n')
    : 'No project context files found.';
}

/**
 * Extract {{placeholder}} names from a template string.
 */
function extractPlaceholders(template: string): string[] {
  const matches = template.match(/\{\{([^}]+)\}\}/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(2, -2).trim()))];
}

/**
 * Fill template placeholders with agent-generated values.
 * Agent output is expected as a JSON object: { placeholder_name: "value", ... }
 */
function fillTemplate(template: string, values: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Parse structured section output from agent into HwpxWriter calls.
 *
 * Supported markers:
 *   [TITLE] text
 *   [HEADING1] text
 *   [HEADING2] text
 *   [BODY] text
 *   [TABLE:headers] Col1,Col2
 *   [ROW] val1,val2
 *   [PAGEBREAK]
 */
function parseAgentOutputToHwpx(writer: HwpxWriter, agentOutput: string): void {
  const lines = agentOutput.split('\n');
  let currentTableHeaders: string[] | null = null;
  let currentTableRows: string[][] = [];

  const flushTable = () => {
    if (currentTableHeaders) {
      writer.addTable(currentTableHeaders, currentTableRows);
      currentTableHeaders = null;
      currentTableRows = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith('[TITLE]')) {
      flushTable();
      writer.addParagraph(line.slice(7).trim(), 'title');
    } else if (line.startsWith('[HEADING1]')) {
      flushTable();
      writer.addParagraph(line.slice(10).trim(), 'heading1');
    } else if (line.startsWith('[HEADING2]')) {
      flushTable();
      writer.addParagraph(line.slice(10).trim(), 'heading2');
    } else if (line.startsWith('[BODY]')) {
      flushTable();
      const text = line.slice(6).trim();
      if (text.length > 0) {
        writer.addParagraph(text, 'body');
      }
    } else if (line.startsWith('[TABLE:headers]')) {
      flushTable();
      const headerStr = line.slice(15).trim();
      currentTableHeaders = headerStr.split(',').map((h) => h.trim());
      currentTableRows = [];
    } else if (line.startsWith('[ROW]')) {
      const rowStr = line.slice(5).trim();
      currentTableRows.push(rowStr.split(',').map((c) => c.trim()));
    } else if (line.startsWith('[PAGEBREAK]')) {
      flushTable();
      writer.addPageBreak();
    }
    // Lines not matching any marker are silently skipped
  }

  flushTable();
}

/**
 * Extract JSON object from agent output (last ```json ... ``` block, or raw JSON).
 */
function extractJsonFromOutput(output: string): Record<string, string> | null {
  // Try last ```json block
  const jsonBlocks = [...output.matchAll(/```json\s*([\s\S]*?)```/gi)];
  if (jsonBlocks.length > 0) {
    const last = jsonBlocks[jsonBlocks.length - 1];
    try {
      return JSON.parse(last![1]!.trim()) as Record<string, string>;
    } catch {
      // Fall through
    }
  }

  // Try raw JSON
  const trimmed = output.trim();
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed) as Record<string, string>;
    } catch {
      // Fall through
    }
  }

  return null;
}

/**
 * Determine default output file path based on type and format.
 */
function defaultOutputPath(
  cwd: string,
  type: string,
  format: 'hwpx' | 'md',
): string {
  const safeType = type.replace(/[^a-zA-Z0-9가-힣_-]/g, '-');
  const ext = format === 'hwpx' ? '.hwpx' : '.md';
  return join(cwd, `${safeType}${ext}`);
}

// ---------------------------------------------------------------------------
// Skill definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.doc',
  command: 'doc',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'routable',
  complexity: 'standard',
  description: 'Generate project documents — HWPX, markdown, or from template',
  options: [
    { flags: '--hwpx', description: 'Generate HWPX document (Korean standard)' },
    { flags: '--md', description: 'Generate markdown document' },
    { flags: '--template <name>', description: 'Use template from .sun/templates/' },
    { flags: '--type <type>', description: 'Document type: readme, api, architecture, 제안서, 수행계획서, 보고서' },
    { flags: '--output <path>', description: 'Output file path' },
  ],

  async execute(ctx) {
    const useHwpx = Boolean(ctx.args['hwpx']);
    const useMd = Boolean(ctx.args['md']);
    const templateName = ctx.args['template'] as string | undefined;
    const docType = (ctx.args['type'] as string | undefined) ?? 'readme';
    const outputArg = ctx.args['output'] as string | undefined;

    // --- Entry ---
    await ctx.ui.entry({
      title: 'Doc',
      description: `Generating ${docType} document...`,
    });

    // --- Determine format ---
    let format: 'hwpx' | 'md' | 'template';
    if (templateName) {
      format = 'template';
    } else if (useHwpx) {
      format = 'hwpx';
    } else {
      format = 'md'; // default to markdown
    }

    // --- Check provider availability ---
    const providers = await ctx.agent.listProviders();
    if (providers.length === 0) {
      await ctx.ui.result({
        success: false,
        title: 'Doc',
        summary: 'No AI provider available',
        details: [
          'sunco doc requires an AI provider to generate content.',
          'Install Claude Code CLI: npm install -g @anthropic-ai/claude-code',
          'Or set ANTHROPIC_API_KEY for the SDK provider.',
        ],
      });
      return { success: false, summary: 'No AI provider available' };
    }

    // --- Gather project context ---
    const contextProgress = ctx.ui.progress({ title: 'Reading project context...', total: 2 });
    const projectContext = await gatherProjectContext(ctx.cwd);
    contextProgress.update({ completed: 1, message: 'Context gathered' });

    // --- Template mode: load template and extract placeholders ---
    let templateContent: string | undefined;
    let placeholders: string[] = [];

    if (format === 'template' && templateName) {
      const templatePath = join(ctx.cwd, '.sun', 'templates', `${templateName}.md`);
      try {
        templateContent = await readFile(templatePath, 'utf-8');
        placeholders = extractPlaceholders(templateContent);
      } catch {
        contextProgress.done({ summary: 'Failed to load template' });
        await ctx.ui.result({
          success: false,
          title: 'Doc',
          summary: `Template not found: .sun/templates/${templateName}.md`,
          details: [
            'Create your template file at .sun/templates/<name>.md',
            'Use {{placeholder_name}} syntax for dynamic content.',
          ],
        });
        return {
          success: false,
          summary: `Template not found: .sun/templates/${templateName}.md`,
        };
      }
    }

    contextProgress.update({ completed: 2, message: 'Ready' });
    contextProgress.done({ summary: 'Project context ready' });

    // --- Build prompt ---
    const prompt = buildDocPrompt({
      type: docType,
      format: format === 'template' ? 'template' : format,
      context: projectContext,
      placeholders: placeholders.length > 0 ? placeholders : undefined,
    });

    // --- Dispatch agent ---
    const agentProgress = ctx.ui.progress({ title: 'Generating document content...', total: 1 });

    const agentResult = await ctx.agent.run({
      role: 'research',
      prompt,
      permissions: DOC_PERMISSIONS,
      timeout: 120_000,
    });

    agentProgress.done({ summary: 'Content generated' });

    if (!agentResult.success) {
      await ctx.ui.result({
        success: false,
        title: 'Doc',
        summary: 'Agent failed to generate document content',
        warnings: [agentResult.outputText ?? 'No output from agent'],
      });
      return { success: false, summary: 'Agent generation failed' };
    }

    const agentOutput = agentResult.outputText ?? '';

    // --- Process output ---
    const writeProgress = ctx.ui.progress({ title: 'Writing document...', total: 1 });
    let outputPath: string;
    let warnings: string[] = [];

    try {
      if (format === 'hwpx') {
        outputPath = outputArg
          ? (outputArg.startsWith('/') ? outputArg : join(ctx.cwd, outputArg))
          : defaultOutputPath(ctx.cwd, docType, 'hwpx');

        const writer = new HwpxWriter();
        parseAgentOutputToHwpx(writer, agentOutput);

        // Ensure output directory exists
        const dir = outputPath.replace(/\/[^/]+$/, '');
        await mkdir(dir, { recursive: true });
        await writer.writeTo(outputPath);

      } else if (format === 'md') {
        outputPath = outputArg
          ? (outputArg.startsWith('/') ? outputArg : join(ctx.cwd, outputArg))
          : defaultOutputPath(ctx.cwd, docType, 'md');

        const dir = outputPath.replace(/\/[^/]+$/, '');
        await mkdir(dir, { recursive: true });
        await writeFile(outputPath, agentOutput, 'utf-8');

      } else {
        // template mode
        outputPath = outputArg
          ? (outputArg.startsWith('/') ? outputArg : join(ctx.cwd, outputArg))
          : defaultOutputPath(ctx.cwd, templateName ?? docType, 'md');

        const values = extractJsonFromOutput(agentOutput);
        if (!values) {
          warnings.push('Agent output could not be parsed as JSON — writing raw output');
          const dir = outputPath.replace(/\/[^/]+$/, '');
          await mkdir(dir, { recursive: true });
          await writeFile(outputPath, agentOutput, 'utf-8');
        } else {
          const filled = fillTemplate(templateContent!, values);
          const dir = outputPath.replace(/\/[^/]+$/, '');
          await mkdir(dir, { recursive: true });
          await writeFile(outputPath, filled, 'utf-8');
        }
      }
    } catch (err) {
      writeProgress.done({ summary: 'Write failed' });
      const message = err instanceof Error ? err.message : String(err);
      await ctx.ui.result({
        success: false,
        title: 'Doc',
        summary: `Failed to write document: ${message}`,
      });
      return { success: false, summary: `Write failed: ${message}` };
    }

    writeProgress.done({ summary: 'Document written' });

    // --- State persistence ---
    await ctx.state.set('doc.lastOutput', {
      type: docType,
      format,
      outputPath,
      generatedAt: new Date().toISOString(),
    });

    // --- Result ---
    const summary = `${docType} document generated (${format.toUpperCase()})`;
    await ctx.ui.result({
      success: true,
      title: 'Doc',
      summary,
      details: [
        `Output: ${outputPath}`,
        `Type: ${docType}`,
        `Format: ${format.toUpperCase()}`,
      ],
      warnings: warnings.length > 0 ? warnings : undefined,
    });

    return {
      success: true,
      summary,
      data: {
        outputPath,
        type: docType,
        format,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
});

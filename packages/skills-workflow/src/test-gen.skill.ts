/**
 * @sunco/skills-workflow - Test Generation Skill
 *
 * Agent-powered test generation with Digital Twin mock server support.
 * Reads source files, dispatches agent to generate unit tests, and
 * optionally generates Express mock servers for external API dependencies.
 *
 * Requirements: VRF-10, VRF-11, REV-04
 * Decisions: D-16 (test generation), D-17 (framework detection),
 *   D-18 (Digital Twin mock servers)
 */

import { defineSkill } from '@sunco/core';
import type { PermissionSet } from '@sunco/core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { simpleGit } from 'simple-git';
import { buildTestGenPrompt } from './prompts/test-gen.js';
import { buildTestGenMockPrompt } from './prompts/test-gen-mock.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Timeout for test generation agent (ms) */
const TEST_GEN_TIMEOUT = 180_000;

/** Permissions for test generation agent */
const VERIFICATION_PERMISSIONS: PermissionSet = {
  role: 'verification',
  readPaths: ['**'],
  writePaths: ['**/__tests__/**'],
  allowTests: true,
  allowNetwork: false,
  allowGitWrite: false,
  allowCommands: ['npm test'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract typescript code blocks from agent output.
 * Each block may start with a filename comment: // __tests__/foo.test.ts
 * or // File: path/to/__tests__/foo.test.ts
 */
function extractCodeBlocks(output: string): Array<{ filename: string; code: string }> {
  const blocks: Array<{ filename: string; code: string }> = [];
  const regex = /```typescript\s*\n([\s\S]*?)```/g;

  let match;
  while ((match = regex.exec(output)) !== null) {
    const code = match[1]!.trim();
    // Try to extract filename from first comment line
    let filename = '';
    const firstLine = code.split('\n')[0] ?? '';

    // Match: // __tests__/foo.test.ts  OR  // File: path/to/__tests__/foo.test.ts
    const filenameMatch = firstLine.match(/\/\/\s*(?:File:\s*)?(.+\.(?:test|spec)\.\w+)/);
    if (filenameMatch) {
      filename = filenameMatch[1]!.trim();
    }

    if (code.length > 0) {
      blocks.push({ filename, code });
    }
  }

  return blocks;
}

/**
 * Extract JSON from agent output (for mock server response).
 */
function extractJsonBlock(output: string): unknown | null {
  const regex = /```json\s*\n([\s\S]*?)```/;
  const match = regex.exec(output);
  if (!match) return null;

  try {
    return JSON.parse(match[1]!.trim());
  } catch {
    return null;
  }
}

/**
 * Determine target files for test generation.
 */
async function resolveTargetFiles(
  cwd: string,
  args: Record<string, unknown>,
): Promise<string[]> {
  // Option 1: Explicit --files
  if (args.files) {
    const files = args.files;
    if (Array.isArray(files)) return files as string[];
    if (typeof files === 'string') return [files];
  }

  // Option 2: Git diff for recently modified files
  try {
    const git = simpleGit(cwd);
    const diffOutput = await git.diff(['--name-only']);
    const files = diffOutput
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f.length > 0 && f.endsWith('.ts') && !f.includes('.test.') && !f.includes('.spec.'));
    if (files.length > 0) return files;
  } catch {
    // git not available or no changes
  }

  return [];
}

// ---------------------------------------------------------------------------
// Skill definition
// ---------------------------------------------------------------------------

export default defineSkill({
  id: 'workflow.test-gen',
  command: 'test-gen',
  kind: 'prompt',
  stage: 'stable',
  category: 'workflow',
  routing: 'directExec',
  complexity: 'standard',
  description: 'Generate unit/E2E tests and Digital Twin mock servers',
  options: [
    { flags: '-f, --files <paths...>', description: 'Specific files to generate tests for' },
    { flags: '--mock-external', description: 'Generate Digital Twin mock servers (REV-04)' },
    { flags: '-p, --phase <number>', description: 'Generate tests for phase modified files' },
    { flags: '--framework <name>', description: 'Test framework (default: vitest)' },
  ],

  async execute(ctx) {
    // --- Step 0: Entry + provider check ---
    await ctx.ui.entry({
      title: 'Test Gen',
      description: 'Generating tests with AI agent...',
    });

    const providers = await ctx.agent.listProviders();
    if (providers.length === 0) {
      await ctx.ui.result({
        success: false,
        title: 'Test Gen',
        summary: 'No AI provider available',
        details: [
          'sunco test-gen requires an AI provider for test generation.',
          'Install Claude Code CLI or set ANTHROPIC_API_KEY.',
        ],
      });
      return { success: false, summary: 'No AI provider available' };
    }

    const framework = (ctx.args.framework as string) ?? 'vitest';
    const mockExternal = Boolean(ctx.args.mockExternal || ctx.args['mock-external']);

    // --- Step 1: Resolve target files ---
    const targetFiles = await resolveTargetFiles(ctx.cwd, ctx.args);

    if (targetFiles.length === 0) {
      await ctx.ui.result({
        success: false,
        title: 'Test Gen',
        summary: 'No target files found',
        details: [
          'Specify files with --files or modify files to auto-detect.',
        ],
      });
      return { success: false, summary: 'No target files found' };
    }

    // --- Step 2: Read target files ---
    const progress = ctx.ui.progress({
      title: 'Reading source files...',
      total: targetFiles.length + 1,
    });

    const fileContents: Record<string, string> = {};
    for (const file of targetFiles) {
      try {
        const fullPath = join(ctx.cwd, file);
        const content = await readFile(fullPath, 'utf-8') as string;
        fileContents[file] = content;
      } catch {
        ctx.log.warn('Failed to read file', { file });
      }
    }

    progress.update({ completed: targetFiles.length, message: 'Files read' });

    // --- Step 3: Build prompt and dispatch agent ---
    const prompt = buildTestGenPrompt(targetFiles, fileContents, framework);

    const agentResult = await ctx.agent.run({
      role: 'verification',
      prompt,
      permissions: VERIFICATION_PERMISSIONS,
      timeout: TEST_GEN_TIMEOUT,
    });

    if (!agentResult.success) {
      await ctx.ui.result({
        success: false,
        title: 'Test Gen',
        summary: 'Agent failed to generate tests',
      });
      return { success: false, summary: 'Agent failed to generate tests' };
    }

    // --- Step 4: Parse agent output ---
    const codeBlocks = extractCodeBlocks(agentResult.outputText);

    if (codeBlocks.length === 0) {
      ctx.log.warn('No code blocks found in agent output');
      // Try to write the entire output as a single test file
      const fallbackFilename = `__tests__/${basename(targetFiles[0] ?? 'generated', '.ts')}.test.ts`;
      codeBlocks.push({ filename: fallbackFilename, code: agentResult.outputText });
    }

    // --- Step 5: Write generated test files ---
    const generatedFiles: string[] = [];

    for (let i = 0; i < codeBlocks.length; i++) {
      const block = codeBlocks[i]!;
      let filename = block.filename;

      // Default filename if not extracted
      if (!filename) {
        const sourceBase = basename(targetFiles[i] ?? targetFiles[0] ?? 'generated', '.ts');
        filename = `__tests__/${sourceBase}.test.ts`;
      }

      // Ensure path is under __tests__/
      if (!filename.includes('__tests__')) {
        filename = `__tests__/${filename}`;
      }

      const fullPath = join(ctx.cwd, filename);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, block.code, 'utf-8');
      generatedFiles.push(filename);

      ctx.log.info('Generated test file', { path: fullPath });
    }

    progress.update({ completed: targetFiles.length + 1, message: 'Tests generated' });

    // --- Step 6: Mock server generation (if --mock-external) ---
    let mockFiles: string[] | undefined;

    if (mockExternal) {
      // Extract API patterns from source files
      const allContent = Object.values(fileContents).join('\n');
      const fetchPatterns = allContent.match(/fetch\(['"]([^'"]+)['"]\)/g) ?? [];
      const endpoints = fetchPatterns.map((p) => {
        const url = p.match(/['"]([^'"]+)['"]/)?.[1] ?? '';
        return `GET ${url}`;
      });

      // If no fetch patterns found, use generic endpoints
      if (endpoints.length === 0) {
        endpoints.push('GET /api/data');
      }

      const mockPrompt = buildTestGenMockPrompt(allContent, endpoints);

      const mockResult = await ctx.agent.run({
        role: 'verification',
        prompt: mockPrompt,
        permissions: {
          ...VERIFICATION_PERMISSIONS,
          writePaths: ['.sun/mocks/**'],
        },
        timeout: TEST_GEN_TIMEOUT,
      });

      if (mockResult.success) {
        const mockData = extractJsonBlock(mockResult.outputText);
        const mocksDir = join(ctx.cwd, '.sun', 'mocks');
        await mkdir(mocksDir, { recursive: true });

        let mockContent: string;
        if (mockData && typeof mockData === 'object' && 'mockServer' in (mockData as Record<string, unknown>)) {
          mockContent = (mockData as Record<string, unknown>).mockServer as string;
        } else {
          // Fallback: use raw output
          mockContent = mockResult.outputText;
        }

        const mockPath = join(mocksDir, 'mock-server.ts');
        await writeFile(mockPath, mockContent, 'utf-8');
        mockFiles = ['.sun/mocks/mock-server.ts'];

        ctx.log.info('Generated mock server', { path: mockPath });
      }
    }

    // --- Step 7: Return result ---
    const summary = `Generated ${generatedFiles.length} test file(s)${mockFiles ? ` and ${mockFiles.length} mock server(s)` : ''}`;

    progress.done({ summary });

    await ctx.ui.result({
      success: true,
      title: 'Test Gen',
      summary,
      details: [
        ...generatedFiles.map((f) => `Test: ${f}`),
        ...(mockFiles ?? []).map((f) => `Mock: ${f}`),
      ],
    });

    return {
      success: true,
      summary,
      data: {
        generatedFiles,
        ...(mockFiles ? { mockFiles } : {}),
      },
    };
  },
});

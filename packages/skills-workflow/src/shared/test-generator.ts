/**
 * @sunco/skills-workflow - Test Generator Shared Module
 *
 * Pure functions for test generation logic, extracted from test-gen.skill.ts
 * as part of Phase 33 Wave 2 absorption into verify --generate-tests.
 *
 * No SkillContext dependency — all dependencies injected explicitly.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { simpleGit } from 'simple-git';
import { buildTestGenPrompt } from '../prompts/test-gen.js';
import { buildTestGenMockPrompt } from '../prompts/test-gen-mock.js';
import type { AgentRequest, AgentResult } from '@sunco/core';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Timeout for test generation agent (ms) */
const TEST_GEN_TIMEOUT = 180_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TestGenOptions {
  cwd: string;
  targetFiles?: string[];
  framework?: string;
  mockExternal?: boolean;
  agentRun: (request: AgentRequest) => Promise<AgentResult>;
  log: { info: (message: string, data?: Record<string, unknown>) => void; warn: (message: string, data?: Record<string, unknown>) => void };
}

export interface TestGenResult {
  success: boolean;
  generatedFiles: string[];
  mockFiles?: string[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for testability)
// ---------------------------------------------------------------------------

/**
 * Extract typescript code blocks from agent output.
 * Each block may start with a filename comment: // __tests__/foo.test.ts
 * or // File: path/to/__tests__/foo.test.ts
 */
export function extractCodeBlocks(output: string): Array<{ filename: string; code: string }> {
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
export function extractJsonBlock(output: string): unknown | null {
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
export async function resolveTargetFiles(
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
// Main orchestrator
// ---------------------------------------------------------------------------

const VERIFICATION_PERMISSIONS = {
  role: 'verification' as const,
  readPaths: ['**'],
  writePaths: ['**/__tests__/**'],
  allowTests: true,
  allowNetwork: false,
  allowGitWrite: false,
  allowCommands: ['npm test'],
};

/**
 * Run the full test generation pipeline with explicit dependencies (no SkillContext).
 */
export async function runTestGeneration(opts: TestGenOptions): Promise<TestGenResult> {
  const {
    cwd,
    targetFiles: explicitFiles,
    framework = 'vitest',
    mockExternal = false,
    agentRun,
    log,
  } = opts;

  const targetFiles = explicitFiles && explicitFiles.length > 0
    ? explicitFiles
    : await resolveTargetFiles(cwd, {});

  if (targetFiles.length === 0) {
    return {
      success: false,
      generatedFiles: [],
      summary: 'No target files found. Specify files with --files or modify files to auto-detect.',
    };
  }

  // Read target files
  const fileContents: Record<string, string> = {};
  for (const file of targetFiles) {
    try {
      const fullPath = join(cwd, file);
      const content = await readFile(fullPath, 'utf-8') as string;
      fileContents[file] = content;
    } catch {
      log.warn('Failed to read file', { file });
    }
  }

  // Build prompt and dispatch agent
  const prompt = buildTestGenPrompt(targetFiles, fileContents, framework);

  const agentResult = await agentRun({
    role: 'verification',
    prompt,
    permissions: VERIFICATION_PERMISSIONS,
    timeout: TEST_GEN_TIMEOUT,
  });

  if (!agentResult.success) {
    return {
      success: false,
      generatedFiles: [],
      summary: 'Agent failed to generate tests',
    };
  }

  // Parse agent output
  const codeBlocks = extractCodeBlocks(agentResult.outputText);

  if (codeBlocks.length === 0) {
    log.warn('No code blocks found in agent output');
    const fallbackFilename = `__tests__/${basename(targetFiles[0] ?? 'generated', '.ts')}.test.ts`;
    codeBlocks.push({ filename: fallbackFilename, code: agentResult.outputText });
  }

  // Write generated test files
  const generatedFiles: string[] = [];

  for (let i = 0; i < codeBlocks.length; i++) {
    const block = codeBlocks[i]!;
    let filename = block.filename;

    if (!filename) {
      const sourceBase = basename(targetFiles[i] ?? targetFiles[0] ?? 'generated', '.ts');
      filename = `__tests__/${sourceBase}.test.ts`;
    }

    if (!filename.includes('__tests__')) {
      filename = `__tests__/${filename}`;
    }

    const fullPath = join(cwd, filename);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, block.code, 'utf-8');
    generatedFiles.push(filename);

    log.info('Generated test file', { path: fullPath });
  }

  // Mock server generation (if mockExternal)
  let mockFiles: string[] | undefined;

  if (mockExternal) {
    const allContent = Object.values(fileContents).join('\n');
    const fetchPatterns = allContent.match(/fetch\(['"]([^'"]+)['"]\)/g) ?? [];
    const endpoints = fetchPatterns.map((p) => {
      const url = p.match(/['"]([^'"]+)['"]/)?.[1] ?? '';
      return `GET ${url}`;
    });

    if (endpoints.length === 0) {
      endpoints.push('GET /api/data');
    }

    const mockPrompt = buildTestGenMockPrompt(allContent, endpoints);

    const mockResult = await agentRun({
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
      const mocksDir = join(cwd, '.sun', 'mocks');
      await mkdir(mocksDir, { recursive: true });

      let mockContent: string;
      if (mockData && typeof mockData === 'object' && 'mockServer' in (mockData as Record<string, unknown>)) {
        mockContent = (mockData as Record<string, unknown>).mockServer as string;
      } else {
        mockContent = mockResult.outputText;
      }

      const mockPath = join(mocksDir, 'mock-server.ts');
      await writeFile(mockPath, mockContent, 'utf-8');
      mockFiles = ['.sun/mocks/mock-server.ts'];

      log.info('Generated mock server', { path: mockPath });
    }
  }

  const summary = `Generated ${generatedFiles.length} test file(s)${mockFiles ? ` and ${mockFiles.length} mock server(s)` : ''}`;

  return {
    success: true,
    generatedFiles,
    mockFiles,
    summary,
  };
}

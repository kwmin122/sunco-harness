import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  CheckResultSchema,
  type CheckKind,
  type CheckResult,
  type ProjectSignal,
  type VerificationCheckSpec,
} from '@sunco/core/runtime';
import { EvidenceStore } from '@sunco/evidence';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export type VerifyEngineOptions = {
  cwd: string;
  store?: EvidenceStore;
  now?: () => string;
};

export type VerifyEngineInput = VerifyEngineOptions & {
  taskId: string;
  checks?: VerificationCheckSpec[];
};

export type RunCheckOptions = {
  cwd: string;
  taskId?: string;
  id?: string;
  now?: () => string;
};

const DEFAULT_CHECK_ORDER: CheckKind[] = ['typecheck', 'test', 'lint', 'build'];

function isoNow(): string {
  return new Date().toISOString();
}

function commandForScript(packageManager: PackageManager, script: string): string {
  if (packageManager === 'npm') return `npm run ${script}`;
  return `${packageManager} run ${script}`;
}

async function readPackageJson(cwd: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(join(cwd, 'package.json'), 'utf-8')) as Record<string, unknown>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function detectJsProject(cwd: string): Promise<ProjectSignal> {
  const resolvedCwd = resolve(cwd);
  const files = ['package.json', 'tsconfig.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb', 'package-lock.json']
    .filter((file) => existsSync(join(resolvedCwd, file)));
  const packageJson = await readPackageJson(resolvedCwd);
  const packageManager = detectPackageManager(resolvedCwd, packageJson);
  const languages = [
    files.includes('package.json') ? 'javascript' : undefined,
    files.includes('tsconfig.json') ? 'typescript' : undefined,
  ].filter((language): language is string => Boolean(language));

  return {
    cwd: resolvedCwd,
    packageManager,
    languages,
    files,
    metadata: {
      scripts: typeof packageJson?.scripts === 'object' && packageJson.scripts !== null
        ? Object.keys(packageJson.scripts as Record<string, unknown>).sort()
        : [],
    },
  };
}

export function detectPackageManager(cwd: string, packageJson?: Record<string, unknown> | null): PackageManager | undefined {
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(cwd, 'bun.lock')) || existsSync(join(cwd, 'bun.lockb'))) return 'bun';
  if (existsSync(join(cwd, 'package-lock.json'))) return 'npm';
  if (typeof packageJson?.packageManager === 'string') {
    if (packageJson.packageManager.startsWith('pnpm@')) return 'pnpm';
    if (packageJson.packageManager.startsWith('yarn@')) return 'yarn';
    if (packageJson.packageManager.startsWith('bun@')) return 'bun';
    if (packageJson.packageManager.startsWith('npm@')) return 'npm';
  }
  return packageJson ? 'npm' : undefined;
}

export async function selectJsChecks(cwd: string): Promise<VerificationCheckSpec[]> {
  const resolvedCwd = resolve(cwd);
  const packageJson = await readPackageJson(resolvedCwd);
  if (!packageJson) return [];
  const packageManager = detectPackageManager(resolvedCwd, packageJson) ?? 'npm';
  const scripts = typeof packageJson.scripts === 'object' && packageJson.scripts !== null
    ? packageJson.scripts as Record<string, unknown>
    : {};

  return DEFAULT_CHECK_ORDER
    .filter((kind) => typeof scripts[kind] === 'string')
    .map((kind) => ({
      kind,
      command: commandForScript(packageManager, kind),
      required: true,
      cwd: resolvedCwd,
      metadata: { selectedFrom: 'package.json' },
    }));
}

export async function runCheck(spec: VerificationCheckSpec, options: RunCheckOptions): Promise<CheckResult> {
  const startedAt = options.now?.() ?? isoNow();
  const start = Date.now();
  const cwd = resolve(spec.cwd ?? options.cwd);
  const checkId = options.id ?? `${spec.kind}-${start}`;

  const { stdout, stderr, exitCode, error } = await runShell(spec.command, cwd, spec.env);
  const completedAt = options.now?.() ?? isoNow();
  const status = error ? 'blocked' : exitCode === 0 ? 'pass' : 'fail';
  const output = [stdout, stderr, error?.message].filter(Boolean).join('\n');

  return CheckResultSchema.parse({
    id: checkId,
    taskId: options.taskId,
    kind: spec.kind,
    name: spec.metadata?.name as string | undefined,
    command: spec.command,
    status,
    required: spec.required,
    startedAt,
    completedAt,
    durationMs: Math.max(0, Date.now() - start),
    exitCode,
    summary: summarizeCheck(status, output),
    metadata: {
      ...spec.metadata,
      cwd,
      stdout,
      stderr,
      spawnError: error?.message,
    },
  });
}

export async function runVerifier(input: VerifyEngineInput): Promise<CheckResult[]> {
  const cwd = resolve(input.cwd);
  const store = input.store ?? new EvidenceStore({ cwd });
  const checks = input.checks ?? await selectJsChecks(cwd);
  const results: CheckResult[] = [];

  for (let index = 0; index < checks.length; index += 1) {
    const spec = checks[index];
    const result = await runCheck(spec, {
      cwd,
      taskId: input.taskId,
      id: `${spec.kind}-${index + 1}`,
      now: input.now,
    });
    const logPath = await store.writeCheckLog(input.taskId, result.id, formatCheckLog(result));
    results.push(CheckResultSchema.parse({ ...result, logPath }));
  }

  if (results.length > 0) {
    const updatedAt = input.now?.() ?? isoNow();
    await store.updateEvidence(input.taskId, (record) => ({
      ...record,
      checks: mergeChecks(record.checks, results),
      artifacts: [
        ...record.artifacts.filter((artifact) => artifact.kind !== 'log' || !results.some((result) => result.logPath === artifact.path)),
        ...results
          .filter((result) => result.logPath)
          .map((result) => ({
            kind: 'log' as const,
            path: result.logPath as string,
            description: `${result.kind} verification log`,
            metadata: {},
          })),
      ],
      updatedAt,
    }));
  }

  return results;
}

function mergeChecks(existing: CheckResult[], incoming: CheckResult[]): CheckResult[] {
  const incomingIds = new Set(incoming.map((check) => check.id));
  return [
    ...existing.filter((check) => !incomingIds.has(check.id)),
    ...incoming,
  ];
}

function summarizeCheck(status: CheckResult['status'], output: string): string {
  if (status === 'pass') return 'check passed';
  const firstLine = output.split('\n').find((line) => line.trim().length > 0);
  return firstLine ? firstLine.slice(0, 240) : `check ${status}`;
}

function formatCheckLog(result: CheckResult): string {
  return [
    `command: ${result.command}`,
    `status: ${result.status}`,
    `exitCode: ${result.exitCode ?? ''}`,
    `startedAt: ${result.startedAt}`,
    `completedAt: ${result.completedAt ?? ''}`,
    '',
    'stdout:',
    String(result.metadata.stdout ?? ''),
    '',
    'stderr:',
    String(result.metadata.stderr ?? ''),
    '',
    'error:',
    String(result.metadata.spawnError ?? ''),
    '',
  ].join('\n');
}

function runShell(command: string, cwd: string, env?: Record<string, string>): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error?: Error;
}> {
  return new Promise((resolvePromise) => {
    const child = spawn(command, {
      cwd,
      env: { ...process.env, ...env },
      shell: true,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8');
    });
    child.on('error', (error) => {
      resolvePromise({ stdout, stderr, exitCode: null, error });
    });
    child.on('close', (exitCode) => {
      resolvePromise({ stdout, stderr, exitCode });
    });
  });
}

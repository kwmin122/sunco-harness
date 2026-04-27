import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EvidenceStore } from '@sunco/evidence';
import { detectJsProject, runCheck, runVerifier, selectJsChecks } from '../index.js';

const now = '2026-04-27T00:00:00.000Z';

async function makeProject(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'sunco-verifier-'));
  await writeFile(join(cwd, 'package-lock.json'), '{}\n', 'utf-8');
  await writeFile(join(cwd, 'package.json'), JSON.stringify({
    type: 'module',
    scripts: {
      test: 'node -e "console.log(\'ok\')"',
      lint: 'node -e "console.error(\'lint failed\'); process.exit(2)"',
    },
  }, null, 2) + '\n', 'utf-8');
  return cwd;
}

describe('Verify Engine', () => {
  it('detects package-manager signals and selects package.json checks', async () => {
    const cwd = await makeProject();
    try {
      await expect(detectJsProject(cwd)).resolves.toMatchObject({
        packageManager: 'npm',
        languages: ['javascript'],
      });

      const checks = await selectJsChecks(cwd);
      expect(checks.map((check) => check.kind)).toEqual(['test', 'lint']);
      expect(checks[0].command).toBe('npm run test');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('runs checks and classifies pass/fail by exit code', async () => {
    const cwd = await makeProject();
    try {
      await expect(runCheck({
        kind: 'test',
        command: 'node -e "console.log(\'ok\')"',
        required: true,
      }, { cwd, taskId: 'task-1', now: () => now })).resolves.toMatchObject({
        status: 'pass',
        exitCode: 0,
      });

      await expect(runCheck({
        kind: 'lint',
        command: 'node -e "process.exit(3)"',
        required: true,
      }, { cwd, taskId: 'task-1', now: () => now })).resolves.toMatchObject({
        status: 'fail',
        exitCode: 3,
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it('writes verifier logs back into task evidence', async () => {
    const cwd = await makeProject();
    try {
      const store = new EvidenceStore({ cwd });
      await store.createTask({ id: 'task-1', goal: 'verify project', now });

      const results = await runVerifier({
        cwd,
        taskId: 'task-1',
        store,
        checks: [{
          kind: 'test',
          command: 'node -e "console.log(\'ok\')"',
          required: true,
        }],
        now: () => now,
      });

      expect(results).toHaveLength(1);
      expect(results[0].logPath).toBe('.sunco/tasks/task-1/checks/test-1.log');
      const evidence = await store.readEvidence('task-1');
      expect(evidence?.checks[0].status).toBe('pass');
      await expect(readFile(join(cwd, '.sunco/tasks/task-1/checks/test-1.log'), 'utf-8')).resolves.toContain('command:');
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

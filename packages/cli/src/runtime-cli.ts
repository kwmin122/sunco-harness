import { EvidenceStore } from '@sunco/evidence';
import type { RiskLevel } from '@sunco/core/runtime';
import {
  evaluateDoneGate,
  getRuntimeStatus,
  runRuntimeLoop,
} from '@sunco/runtime';
import {
  runVerifier,
  selectJsChecks,
} from '@sunco/verifier';

const USAGE = `SUNCO Runtime

Usage:
  sunco-runtime do <goal...> [--task <id>] [--risk <risk>] [--json]
  sunco-runtime verify <task-id> [--json]
  sunco-runtime status <task-id> [--json]
  sunco-runtime ship <task-id> [--json]

Proof-first rule: tasks cannot be marked done or shipped without task-scoped
edit evidence, verification evidence, and a passing Done Gate.
`;

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const args = [...argv];
  const command = args.shift();
  const json = takeFlag(args, '--json');
  const taskId = takeOption(args, '--task');
  const risk = takeOption(args, '--risk');

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(USAGE);
    return 0;
  }

  const cwd = process.cwd();
  const store = new EvidenceStore({ cwd });

  if (command === 'do') {
    const goal = args.join(' ').trim();
    if (!goal) return fail('Missing goal. Usage: sunco-runtime do <goal...>', json);
    const result = await runRuntimeLoop({
      cwd,
      goal,
      taskId,
      risk: (risk || 'repo_mutate') as RiskLevel,
      store,
    });
    return printLoop(result, json);
  }

  if (command === 'verify') {
    const id = args[0];
    if (!id) return fail('Missing task id. Usage: sunco-runtime verify <task-id>', json);
    const task = await store.readTask(id);
    if (!task) return fail(`Task not found: ${id}`, json);
    const checks = await selectJsChecks(cwd);
    await runVerifier({ cwd, taskId: id, store, checks });
    const evidence = await store.readEvidence(id);
    const gate = evaluateDoneGate({
      task,
      evidence,
      requiredChecks: unique(checks.filter((check) => check.required).map((check) => check.kind)),
    });
    await store.writeTask({
      ...task,
      status: gate.status === 'passed' ? 'done' : 'blocked',
      updatedAt: new Date().toISOString(),
    });
    return printGate(id, gate, json);
  }

  if (command === 'status') {
    const id = args[0];
    if (!id) return fail('Missing task id. Usage: sunco-runtime status <task-id>', json);
    const status = await getRuntimeStatus({ cwd, taskId: id, store });
    return printStatus(status, json);
  }

  if (command === 'ship') {
    const id = args[0];
    if (!id) return fail('Missing task id. Usage: sunco-runtime ship <task-id>', json);
    const task = await store.readTask(id);
    const evidence = await store.readEvidence(id);
    if (!task) return fail(`Task not found: ${id}`, json);
    const gate = evaluateDoneGate({ task, evidence });
    if (gate.status !== 'passed') return printGate(id, gate, json, 2);
    const shipped = await store.writeTask({
      ...task,
      status: 'shipped',
      updatedAt: new Date().toISOString(),
    });
    return print({ success: true, summary: `SHIPPED ${shipped.id}`, task: shipped }, json);
  }

  return fail(`Unknown command: ${command}\n\n${USAGE}`, json);
}

function takeFlag(args: string[], flag: string): boolean {
  const index = args.indexOf(flag);
  if (index === -1) return false;
  args.splice(index, 1);
  return true;
}

function takeOption(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  args.splice(index, 2);
  return value;
}

function printLoop(
  result: Awaited<ReturnType<typeof runRuntimeLoop>>,
  json: boolean,
): number {
  return print({
    success: result.gate.status === 'passed',
    summary: result.gate.status === 'passed'
      ? `DONE ${result.task.id}`
      : `BLOCKED ${result.task.id}: ${result.gate.reasons.join('; ')}`,
    task: result.task,
    gate: result.gate,
    checks: result.evidence?.checks ?? [],
    changedFiles: result.evidence?.editTransactions.flatMap((edit) => edit.changedFiles.map((file) => file.path)) ?? [],
  }, json, result.gate.status === 'passed' ? 0 : 2);
}

function printGate(
  taskId: string,
  gate: ReturnType<typeof evaluateDoneGate>,
  json: boolean,
  exitCode?: number,
): number {
  return print({
    success: gate.status === 'passed',
    summary: gate.status === 'passed'
      ? `DONE ${taskId}`
      : `BLOCKED ${taskId}: ${gate.reasons.join('; ')}`,
    gate,
  }, json, exitCode ?? (gate.status === 'passed' ? 0 : 2));
}

function printStatus(
  status: Awaited<ReturnType<typeof getRuntimeStatus>>,
  json: boolean,
): number {
  return print({
    success: Boolean(status.task),
    summary: status.task
      ? `${status.task.id} ${status.task.status}: ${status.nextAction}`
      : 'Task not found',
    status,
  }, json, status.task ? 0 : 1);
}

function print(
  payload: {
    success: boolean;
    summary: string;
    gate?: { reasons?: string[]; nextActions?: string[] };
    [key: string]: unknown;
  },
  json: boolean,
  exitCode = payload.success ? 0 : 1,
): number {
  if (json) {
    console.log(JSON.stringify({ ...payload, exitCode }, null, 2));
  } else {
    console.log(payload.summary);
    if (payload.gate?.reasons?.length) {
      console.log('Reasons:');
      for (const reason of payload.gate.reasons) console.log(`- ${reason}`);
    }
    if (payload.gate?.nextActions?.length) {
      console.log('Next:');
      for (const action of payload.gate.nextActions) console.log(`- ${action}`);
    }
  }
  return exitCode;
}

function fail(message: string, json: boolean): number {
  return print({ success: false, summary: message }, json, 1);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

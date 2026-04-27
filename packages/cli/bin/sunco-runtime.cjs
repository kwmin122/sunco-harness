#!/usr/bin/env node
'use strict';

const USAGE = `SUNCO Runtime MVP

Usage:
  sunco-runtime do <goal...> [--task <id>] [--risk <risk>] [--json]
  sunco-runtime verify <task-id> [--json]
  sunco-runtime status <task-id> [--json]
  sunco-runtime ship <task-id> [--json]

This is the M7 proof-first runtime front door. It creates task evidence under
.sunco/tasks/<task-id>/ and blocks done/ship when evidence is missing or failed.
`;

async function main() {
  const args = process.argv.slice(2);
  const command = args.shift();
  const json = takeFlag(args, '--json');
  const taskId = takeOption(args, '--task');
  const risk = takeOption(args, '--risk');

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(USAGE);
    return;
  }

  const [{ EvidenceStore }, runtime, verifier] = await Promise.all([
    import('@sunco/evidence'),
    import('@sunco/runtime'),
    import('@sunco/verifier'),
  ]);

  const cwd = process.cwd();
  const store = new EvidenceStore({ cwd });

  if (command === 'do') {
    const goal = args.join(' ').trim();
    if (!goal) return fail('Missing goal. Usage: sunco-runtime do <goal...>', json);
    const result = await runtime.runRuntimeLoop({
      cwd,
      goal,
      taskId,
      risk: risk || 'repo_mutate',
      store,
    });
    return printLoop(result, json);
  }

  if (command === 'verify') {
    const id = args[0];
    if (!id) return fail('Missing task id. Usage: sunco-runtime verify <task-id>', json);
    const task = await store.readTask(id);
    if (!task) return fail(`Task not found: ${id}`, json);
    const checks = await verifier.selectJsChecks(cwd);
    await verifier.runVerifier({ cwd, taskId: id, store, checks });
    const evidence = await store.readEvidence(id);
    const gate = runtime.evaluateDoneGate({
      task,
      evidence,
      requiredChecks: unique(checks.filter((check) => check.required).map((check) => check.kind)),
    });
    await store.writeTask({ ...task, status: gate.status === 'passed' ? 'done' : 'blocked', updatedAt: new Date().toISOString() });
    return printGate(id, gate, json);
  }

  if (command === 'status') {
    const id = args[0];
    if (!id) return fail('Missing task id. Usage: sunco-runtime status <task-id>', json);
    const status = await runtime.getRuntimeStatus({ cwd, taskId: id, store });
    return printStatus(status, json);
  }

  if (command === 'ship') {
    const id = args[0];
    if (!id) return fail('Missing task id. Usage: sunco-runtime ship <task-id>', json);
    const task = await store.readTask(id);
    const evidence = await store.readEvidence(id);
    if (!task) return fail(`Task not found: ${id}`, json);
    const gate = runtime.evaluateDoneGate({ task, evidence });
    if (gate.status !== 'passed') return printGate(id, gate, json, 2);
    const shipped = await store.writeTask({ ...task, status: 'shipped', updatedAt: new Date().toISOString() });
    return print({ success: true, summary: `SHIPPED ${shipped.id}`, task: shipped }, json);
  }

  return fail(`Unknown command: ${command}\n\n${USAGE}`, json);
}

function takeFlag(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return false;
  args.splice(index, 1);
  return true;
}

function takeOption(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  args.splice(index, 2);
  return value;
}

function printLoop(result, json) {
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

function printGate(taskId, gate, json, exitCode) {
  return print({
    success: gate.status === 'passed',
    summary: gate.status === 'passed'
      ? `DONE ${taskId}`
      : `BLOCKED ${taskId}: ${gate.reasons.join('; ')}`,
    gate,
  }, json, exitCode ?? (gate.status === 'passed' ? 0 : 2));
}

function printStatus(status, json) {
  return print({
    success: Boolean(status.task),
    summary: status.task
      ? `${status.task.id} ${status.task.status}: ${status.nextAction}`
      : 'Task not found',
    status,
  }, json, status.task ? 0 : 1);
}

function print(payload, json, exitCode = payload.success ? 0 : 1) {
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
  process.exitCode = exitCode;
}

function fail(message, json) {
  return print({ success: false, summary: message }, json, 1);
}

function unique(items) {
  return Array.from(new Set(items));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});

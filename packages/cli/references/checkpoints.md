# Checkpoint System

How SUNCO formalizes human-in-the-loop verification and decision points during long-running work. Applied by `/sunco:execute`, `/sunco:auto`, and any multi-wave plan.

---

## Core Principle

Checkpoints are for verification and decisions, not manual work.

**Golden rules:**
1. If SUNCO can run it, SUNCO runs it — never ask the user to execute CLI commands, start servers, or run builds
2. SUNCO sets up the verification environment — start dev servers, seed databases, configure env vars
3. User only does what requires human judgment — visual checks, UX evaluation, "does this feel right?"
4. Secrets come from user, automation comes from SUNCO — ask for API keys, then SUNCO uses them via CLI
5. Auto-mode bypasses verification and decision checkpoints — when `workflow._auto_chain_active` or `workflow.auto_advance` is true in config, human-verify auto-approves and decision auto-selects first option. `human-action` (auth gates) always stops.

---

## The 3 Checkpoint Types

### Type 1: human-verify (90% of checkpoints)

**When:** SUNCO completed automated work. Human confirms it works correctly.

**Use for:**
- Visual UI checks (layout, styling, responsiveness)
- Interactive flows (click through a wizard, test user flows)
- Functional verification (feature works as expected end to end)
- Audio/video output quality
- Animation smoothness
- First-run experience evaluation

**Format:**
```xml
<checkpoint type="human-verify" gate="blocking">
  <what-built>[What SUNCO automated and deployed/built]</what-built>
  <how-to-verify>
    [Exact steps to test — URLs, commands, expected behavior]
  </how-to-verify>
  <resume-signal>[How to continue — "approved", "yes", or describe issues]</resume-signal>
</checkpoint>
```

**Example — CLI feature:**
```xml
<checkpoint type="human-verify" gate="blocking">
  <what-built>Added --json flag to `sunco status`. Output switches to structured JSON when flag is present.</what-built>
  <how-to-verify>
    Run: sunco status --json
    Verify:
    1. Output is valid JSON (pipe to jq: sunco status --json | jq .)
    2. jq exits 0 (no parse errors)
    3. Top-level keys: phase, progress, nextAction, blockers
    4. Without --json flag: output is human-readable text (no JSON)
  </how-to-verify>
  <resume-signal>Type "approved" or describe what's wrong</resume-signal>
</checkpoint>
```

---

### Type 2: decision (9% of checkpoints)

**When:** Human must make a choice that affects implementation direction.

**Use for:**
- Technology selection (which auth provider, which database)
- UX direction (which interaction pattern to pursue)
- Scope decision (include feature X in v1 or defer?)
- Breaking tie between two equally valid approaches

**Format:**
```xml
<checkpoint type="decision" gate="blocking">
  <decision>[What needs to be decided]</decision>
  <options>
    <option id="A">[Option A description] — [tradeoff]</option>
    <option id="B">[Option B description] — [tradeoff] (Recommended)</option>
  </options>
  <default>B</default>
  <resume-signal>Reply "A" or "B" or describe a different approach</resume-signal>
</checkpoint>
```

**Auto-mode behavior:** When `workflow.auto_advance = true`, the `<default>` option is selected automatically and logged. No human pause.

---

### Type 3: human-action (1% of checkpoints)

**When:** Something requires human physical action that cannot be automated.

**Use for:**
- OAuth login flows (browser redirect, no CLI path)
- Hardware setup (plug in device, install certificate on device)
- External system configuration (configure DNS in registrar UI)
- Admin console operations (enable feature flag in SaaS dashboard)

**Format:**
```xml
<checkpoint type="human-action" gate="blocking">
  <action>[What the human must do]</action>
  <why>[Why this cannot be automated]</why>
  <verify>[How SUNCO will confirm it was done]</verify>
  <resume-signal>[What to type when done]</resume-signal>
</checkpoint>
```

**Note:** human-action checkpoints NEVER auto-advance, even in auto-mode. They represent physical gates.

---

## Wave Checkpoints

Long-running phases are split into waves. Each wave ends with a mini-verification checkpoint before the next wave begins.

### Wave structure

```
Wave 1: Foundation (tasks 1-3)
  └─ Wave 1 checkpoint: lint-gate passes, core types compile
Wave 2: Feature implementation (tasks 4-7)
  └─ Wave 2 checkpoint: tests pass, feature works in isolation
Wave 3: Integration (tasks 8-10)
  └─ Wave 3 checkpoint (optional human-verify): integration works end-to-end
```

### Wave checkpoint format

```xml
<wave-checkpoint wave="1" type="deterministic">
  <verify>
    - npm run lint passes (zero errors)
    - npm run typecheck passes
    - npm test --filter=unit passes
  </verify>
  <on-failure>Stop wave execution, report errors, wait for fix instruction</on-failure>
  <on-pass>Proceed to Wave 2 automatically</on-pass>
</wave-checkpoint>
```

**Deterministic wave checkpoints never require human input.** They run programmatically and either advance or block.

### When to use wave checkpoints

- Phase has 5+ tasks: split into 2+ waves
- Tasks in wave 2 depend on correct output from wave 1: add wave checkpoint between them
- Phase touches multiple subsystems: checkpoint between subsystem completions
- Phase crosses a lint-gate boundary (new skill registered, new export added): checkpoint immediately after

---

## Session Checkpoints

Session checkpoints are snapshots taken automatically at the end of each session (and manually via `/sunco:pause`). They are stored in `.sun/session.json` and are the basis for `/sunco:resume`.

### When session checkpoints are written

1. End of every `/sunco:execute` run (success or failure)
2. After every `/sunco:pause` command
3. On SIGINT (Ctrl+C) during execution — partial checkpoint
4. At the end of `/sunco:auto` pipeline

### What a session checkpoint captures

```json
{
  "version": 2,
  "timestamp": "2026-03-31T14:23:00Z",
  "phase": "03-skill-registry",
  "plan": "02",
  "wave": 2,
  "waveStatus": "in_progress",
  "completedTasks": [
    "implement-registry-types",
    "write-unit-tests",
    "implement-registry-class"
  ],
  "pendingTasks": [
    "wire-registry-to-loader",
    "integration-test"
  ],
  "lastCheckpoint": {
    "type": "wave",
    "wave": 1,
    "status": "passed",
    "timestamp": "2026-03-31T14:15:00Z"
  },
  "blockers": [],
  "agentOutput": {
    "summary": "Registry class implemented. Wiring to loader pending.",
    "warnings": [],
    "uncommittedFiles": ["packages/core/src/registry/skill-registry.ts"]
  },
  "gitState": {
    "branch": "main",
    "lastCommit": "abc1234",
    "uncommittedFiles": ["packages/core/src/registry/skill-registry.ts"]
  }
}
```

### Session checkpoint schema (Zod)

```typescript
const SessionCheckpointSchema = z.object({
  version: z.literal(2),
  timestamp: z.string().datetime(),
  phase: z.string(),
  plan: z.string(),
  wave: z.number().int().min(1),
  waveStatus: z.enum(['not_started', 'in_progress', 'completed', 'failed']),
  completedTasks: z.array(z.string()),
  pendingTasks: z.array(z.string()),
  lastCheckpoint: z.object({
    type: z.enum(['wave', 'human-verify', 'decision', 'human-action']),
    wave: z.number().optional(),
    status: z.enum(['passed', 'failed', 'skipped', 'pending']),
    timestamp: z.string().datetime(),
  }).nullable(),
  blockers: z.array(z.string()),
  agentOutput: z.object({
    summary: z.string(),
    warnings: z.array(z.string()),
    uncommittedFiles: z.array(z.string()),
  }),
  gitState: z.object({
    branch: z.string(),
    lastCommit: z.string(),
    uncommittedFiles: z.array(z.string()),
  }),
})
```

---

## Crash Recovery

SUNCO writes partial checkpoints on process interruption. Recovery is designed to be deterministic: restart from the last clean wave boundary, not from the middle of a wave.

### Recovery rules

1. **Clean wave boundary**: If `waveStatus = "completed"`, restart from the next wave. No re-execution needed for completed waves.

2. **Mid-wave crash**: If `waveStatus = "in_progress"`, restart from the beginning of that wave. Wave tasks are idempotent by convention.

3. **Failed lint-gate**: If crash occurred after lint failure, the uncommitted files list tells you what changed. Fix lint, then re-run from the current plan.

4. **Uncommitted files**: Always commit or discard uncommitted files before resuming. SUNCO will warn if uncommitted files exist at resume time.

### Resume protocol

```
/sunco:resume
```

This command reads `.sun/session.json` and:

1. Validates the checkpoint schema
2. Checks git state matches `gitState.lastCommit`
3. Reports `completedTasks` and `pendingTasks`
4. If `waveStatus = "in_progress"`: offers to re-run current wave or continue from next task
5. Prompts for confirmation before resuming execution
6. In auto-mode: resumes immediately from the last clean wave boundary

### Partial checkpoint (SIGINT recovery)

When interrupted mid-task, a partial checkpoint is written:

```json
{
  "partial": true,
  "interruptedTask": "implement-registry-class",
  "interruptReason": "SIGINT",
  "safeToResume": false
}
```

`safeToResume: false` means SUNCO will not auto-resume a partial checkpoint. The user must explicitly confirm: "Resume from wave start" or "Skip interrupted task."

---

## Checkpoint vs. Verification

Checkpoints and verification layers (Swiss cheese) are related but distinct:

| | Checkpoints | Swiss cheese layers |
|---|---|---|
| **When** | During execution (between tasks/waves) | After execution (before ship) |
| **Purpose** | Keep execution on track, gate wave start | Validate completed work is correct |
| **Who acts** | Human (for verify/decision types) | Automated agents + deterministic tools |
| **Blocks** | Next wave from starting | Ship from proceeding |
| **Auto-mode** | Most can be bypassed | Cannot be bypassed for ship |

Use checkpoints to avoid wasted work. Use Swiss cheese layers to validate work before it ships.

---

## Configuring Checkpoint Behavior

```json
{
  "workflow": {
    "auto_advance": false,
    "require_wave_checkpoints": true,
    "checkpoint_on_interrupt": true,
    "resume_from_wave_boundary": true,
    "max_waves_without_checkpoint": 3
  }
}
```

| Field | Default | Effect |
|-------|---------|--------|
| `auto_advance` | `false` | When `true`, human-verify and decision checkpoints auto-advance |
| `require_wave_checkpoints` | `true` | When `false`, wave checkpoints are skipped (faster, less safe) |
| `checkpoint_on_interrupt` | `true` | When `false`, partial checkpoints are not written on SIGINT |
| `resume_from_wave_boundary` | `true` | When `false`, resume attempts to continue from interrupted task |
| `max_waves_without_checkpoint` | `3` | Warn if a phase has more than N waves without a human-verify checkpoint |

---

## Checkpoint Anti-Patterns

### Checkpointing too frequently

A checkpoint every other task slows down execution without improving quality. Checkpoints are valuable at wave boundaries and before critical decisions — not at every task.

**Rule:** If a phase has 10 tasks in 3 waves, expect 2-3 checkpoints: one per wave boundary (deterministic) and one human-verify at the end of the final wave.

### Checkpointing instead of writing better plans

Checkpoints are not a substitute for clear acceptance criteria. If you need a checkpoint to decide whether something is "done enough," the `done_when` criteria in the plan need more precision.

### Human-action checkpoints for things SUNCO can automate

```xml
<!-- Bad: asking user to run a CLI command -->
<checkpoint type="human-action">
  <action>Run `npm install` to install dependencies</action>
</checkpoint>

<!-- Good: SUNCO runs it -->
<task type="auto">
  <action>Run `npm install` and confirm exit 0</action>
</task>
```

### Skipping the wave checkpoint to save time

Wave checkpoints run in < 5 seconds (lint + tsc). Skipping them to save 5 seconds at the cost of discovering a type error 3 waves later (after significant work) is a bad tradeoff.

---

## Checkpoint State Machine

Each checkpoint transitions through states:

```
pending → active → (passed | failed | skipped)
```

| State | Meaning |
|-------|---------|
| `pending` | Not yet reached in execution |
| `active` | Currently awaiting human input or running deterministic checks |
| `passed` | Verification confirmed, execution continues |
| `failed` | Verification failed, execution stops until resolved |
| `skipped` | Bypassed via auto-mode or explicit skip flag |

Failed checkpoints write their state to `.sun/session.json`. When `/sunco:resume` runs, it detects the failed checkpoint and surfaces it before resuming.

### Failed checkpoint recovery

```
/sunco:resume detected a failed checkpoint:
  Wave 2 checkpoint — lint-gate FAILED at 14:15

Options:
  A) Fix the lint errors and re-run from Wave 2 start (recommended)
  B) Skip Wave 2 checkpoint and continue to Wave 3 (dangerous)
  C) Abandon Wave 2 and restart Phase 03

Your choice:
```

Option B is presented for transparency but strongly discouraged. Choosing B requires typing "SKIP CHECKPOINT CONFIRMED" as a safety measure.

---

## Checkpoint Logging

Every checkpoint event is logged to `.sun/checkpoint-log.jsonl` (append-only):

```jsonl
{"ts":"2026-03-31T14:15:00Z","type":"wave","wave":1,"status":"passed","durationMs":4200}
{"ts":"2026-03-31T14:23:00Z","type":"human-verify","status":"passed","user":"approved","durationMs":180000}
{"ts":"2026-03-31T14:35:00Z","type":"decision","option":"B","auto":false,"durationMs":45000}
```

This log is used by:
- `/sunco:forensics` — investigating why a phase took longer than expected
- `/sunco:stats` — calculating average human-verify turnaround time per project
- Future recommender rules — detecting patterns (e.g., user always picks option B, make it the default)

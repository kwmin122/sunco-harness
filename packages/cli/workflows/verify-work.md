# Verify Work Workflow

Conversational UAT (User Acceptance Testing) with persistent session state. Presents one test at a time, records pass/fail in a UAT.md file that survives context resets, and feeds failures into gap-closure planning. Used by `/sunco:audit-uat`.

---

## Philosophy

**Show expected, ask if reality matches.**

Claude presents what SHOULD happen. User confirms or describes what's different.
- `yes` / `y` / `ok` / empty → PASS
- Anything else → logged as issue, severity inferred from natural language

No Pass/Fail buttons. No "how severe is this?" questions. Just: "Here's what should happen. Does it?"

---

## Overview

Eight steps:

1. **Initialize** — parse arguments, detect active sessions
2. **Check active sessions** — resume or start fresh
3. **Find summaries** — locate SUMMARY.md files for the phase
4. **Extract tests** — derive user-observable test cases from deliverables
5. **Create UAT file** — write `.planning/phases/XX-name/XX-UAT.md`
6. **Present tests** — one at a time, conversational
7. **Process responses** — pass / issue / skip, infer severity
8. **Gaps analysis** — if issues found, diagnose and plan fix phases

---

## Step 1: Initialize

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First numeric token | `PHASE_ARG` | — |
| `--resume` | `FORCE_RESUME` | false |
| `--restart` | `FORCE_RESTART` | false |

Load state:

```bash
PADDED=$(printf "%02d" "$PHASE_ARG")
PHASE_DIR=$(ls -d .planning/phases/${PADDED}-* 2>/dev/null | head -1)
PHASE_NAME=$(basename "$PHASE_DIR" 2>/dev/null)
UAT_PATH="${PHASE_DIR}/${PADDED}-UAT.md"
```

Read STATE.md to confirm the phase exists and has been executed:

```bash
cat .planning/STATE.md 2>/dev/null
```

If no `PHASE_ARG` and `current_phase.status` in STATE.md is `executed` or `verified`, use the current phase as default. If neither condition is met:

```
No executed phase detected.
Specify a phase: /sunco:audit-uat <phase-number>
```

---

## Step 2: Check Active Sessions

Scan for existing UAT files:

```bash
find .planning/phases -name "*-UAT.md" -type f 2>/dev/null | head -10
```

For each file found, read the frontmatter `status` field and `Current Test` section.

**If sessions exist AND no PHASE_ARG:**

Display session picker:

```
Active UAT Sessions

  #  Phase              Status    Current Test         Progress
  1  04-skill-loader    testing   3. Resolve by ID     2 / 6
  2  05-registry        testing   1. Register skill    0 / 4

Reply with a number to resume, or provide a phase number to start new.
```

Wait for user reply.
- Number (1, 2) → load that UAT file, jump to Step 6 (present_test)
- Phase number → treat as new session, jump to Step 3

**If session exists for PHASE_ARG:**
- If `--resume`: jump to Step 6
- If `--restart`: delete existing UAT file, continue to Step 3
- Otherwise, ask inline: "UAT session exists for phase {PHASE_ARG}. Resume or restart?"

**If no sessions AND no PHASE_ARG:**

```
No active UAT sessions.
Provide a phase number: /sunco:audit-uat <phase-number>
```

---

## Step 3: Find Summaries

Locate SUMMARY.md files for the phase:

```bash
ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null
```

Read each file. If no SUMMARY.md files exist:

```
No SUMMARY.md files found in ${PHASE_DIR}.
Phase may not have been executed yet.

Run /sunco:execute first, then come back.
```

---

## Step 4: Extract Test Cases

Parse each SUMMARY.md for user-observable deliverables.

**Scan for:**
1. Accomplishments — features or functionality added
2. User-facing changes — UI, workflows, interactions, CLI output

**For each deliverable, derive one test:**

```
name:     Brief, action-oriented label ("Reply to a Comment")
expected: One or more observable sentences describing what the user sees
          — specific, verifiable, no implementation detail
```

**Extraction examples:**

| SUMMARY says | Test name | Expected |
|---|---|---|
| "Added skill registry with ID lookup" | Resolve skill by ID | Running `sunco help` shows all registered skills listed by their IDs. Running an unknown ID prints a clear "skill not found" message. |
| "Config loader merges global and project TOML" | Config hierarchy merge | Setting a key in `~/.sun/config.toml` and overriding it in `.sun/config.toml` → project value wins when running any command. |
| "Lint rule blocks cross-layer imports" | Lint blocks bad import | Adding a `domain → infra` import and running `sunco lint` fails with a message identifying the file and line. |

**Skip non-observable items:** refactors, type renames, internal restructuring with no user-visible effect.

**Cold-start smoke test injection:**

After extracting tests, scan SUMMARY.md for modified/created file paths. If ANY path matches:

`index.ts`, `main.ts`, `cli.ts`, `server.ts`, `app.ts`, `database/*`, `db/*`, `migrations/*`, `seed*`, `docker-compose*`, `Dockerfile*`, `startup*`

Then PREPEND this test to the list:

```
name:     Cold Start Smoke Test
expected: Kill any running process. Clear temp state. Run from scratch.
          The CLI starts without errors. Any initialization (DB, config, state)
          completes silently. A basic command (sunco help or sunco status)
          returns valid output.
```

---

## Step 5: Create UAT File

Create the UAT tracking file:

```bash
mkdir -p "${PHASE_DIR}"
```

Write `${UAT_PATH}` with this structure:

```markdown
---
status: testing
phase: XX-name
source: [XX-01-SUMMARY.md, XX-02-SUMMARY.md]
started: 2026-03-31T10:00:00Z
updated: 2026-03-31T10:00:00Z
---

## Current Test
<!-- Overwritten on every state change — shows where we are -->

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running process. Run from scratch.
  CLI starts without errors, sunco help returns valid output.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running process. Run from scratch. CLI starts without errors, sunco help returns valid output.
result: pending

### 2. [Test Name]
expected: [observable behavior]
result: pending

...

## Summary

total: N
passed: 0
issues: 0
skipped: 0
pending: N

## Gaps

[none yet]
```

---

## Step 6: Present Test

Read the current test from the UAT file (`Current Test` section).

Render as:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► UAT  Phase XX: [Phase Name]  (1 / N)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test 1: Cold Start Smoke Test

What should happen:
  Kill any running process. Run the CLI from scratch.
  It should start without errors, and `sunco help` should
  return a valid list of commands.

Try it, then reply:
  • "yes" / "y" / empty  →  PASS
  • Describe what went wrong  →  Issue logged
  • "skip"  →  Skip this test
```

Wait for user reply.

---

## Step 7: Process Response

**Parse response:**

| User says | Action |
|-----------|--------|
| `yes`, `y`, `ok`, `✓`, empty enter | PASS |
| `skip`, `s` | SKIP |
| `done`, `all pass`, `all good` | PASS remaining, finalize |
| Anything else | ISSUE — infer severity |

**Severity inference (never ask):**

| User language | Severity |
|---------------|----------|
| "crashes", "error", "exception", "fails", "broken" | blocker |
| "doesn't work", "nothing happens", "wrong", "incorrect" | major |
| "works but", "slow", "weird", "minor" | minor |
| "color", "spacing", "alignment", "looks off", "cosmetic" | cosmetic |

Default to `major` if unclear.

**On PASS:**
- Update `Tests.{N}.result: pass`
- Advance `Current Test` to next test
- Update `Summary.passed += 1`, `Summary.pending -= 1`
- Write to file if: issue just logged, checkpoint every 5 passes, or last test

**On ISSUE:**
- Log immediately to `Gaps` section:

```markdown
## Gaps

### Gap 1 — [Test Name]
severity: major
description: [user's exact words]
test_number: 3
```

- Update `Tests.{N}.result: issue — [description]`
- Update `Summary.issues += 1`
- **Write to file immediately** (preserve issue before proceeding)
- Advance to next test

**On SKIP:**
- Update `Tests.{N}.result: skipped`
- Update `Summary.skipped += 1`
- Advance to next test

Present next test. Repeat until all tests are processed.

---

## Step 8: Gaps Analysis

When all tests are processed:

Update UAT file frontmatter: `status: complete`.

Display results:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► UAT COMPLETE  Phase XX: [Phase Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Results: 6 passed  2 issues  1 skipped

Issues:
  • Test 3 (major)  — "Doesn't work, nothing happens when I click"
  • Test 5 (minor)  — "Color looks off on dark mode"
```

**If no issues:**

```
All tests passed. Phase XX is verified.

Next: /sunco:ship XX
```

Commit UAT file:

```bash
git add "${UAT_PATH}"
git commit -m "docs: UAT complete for phase XX — N passed, 0 issues"
```

**If issues exist:**

```
2 issues found. Diagnosing root causes...
```

Spawn one sunco-debug-agent per blocker/major issue in parallel:

```
Task(
  prompt="
Read .planning/phases/XX-name/XX-UAT.md — specifically Gap N.
Read the relevant source files implicated by this test.
Trace from user-observable symptom back to implementation.

Classify root cause as one of:
  - missing-implementation (feature not built)
  - logic-error (built but wrong behavior)
  - integration-gap (pieces exist but not connected)
  - environment (works in code, broken in runtime)
  - spec-mismatch (built as specced but spec was wrong)

Return:
  root_cause: [classification]
  location: [file:line or component]
  explanation: [2-3 sentences]
  fix_complexity: [trivial | simple | moderate | complex]
",
  subagent_type="general-purpose",
  description="Diagnose UAT gap N: [Test Name]"
)
```

After all agents return, present diagnosis table:

```
Gap Diagnosis

  Gap  Test                  Root Cause             Location              Complexity
  1    Reply to Comment      logic-error             CommentService.ts:88  simple
  2    Dark mode colors      missing-implementation  theme.ts              trivial

What would you like to do?
  1. Create fix phases  →  /sunco:plan-milestone-gaps  (recommended)
  2. Fix manually now   →  I'll route you to the right file
  3. Defer to backlog   →  /sunco:backlog <description>
```

Wait for user choice.

---

## Write Rules

| Section | When to write |
|---------|--------------|
| Issue logged | Immediately — never lose a bug report |
| Checkpoint | Every 5 passed tests |
| Session complete | Final write before commit |
| Current Test | Every write (shows resume point) |

**Never batch issue writes.** Write on FIRST sign of a failure.

---

## Resume from File

On context reset mid-session:

1. Read UAT file
2. Find last test with `result: pending`
3. That's the current test — present it as normal
4. Session continues seamlessly

---

## Success Criteria

- [ ] UAT file created with all tests from SUMMARY.md files
- [ ] Cold-start test injected when server/DB files detected
- [ ] Tests presented one at a time with observable expectations
- [ ] User responses processed as pass / issue / skip
- [ ] Severity inferred, never asked
- [ ] Issues written immediately to `Gaps` section
- [ ] Checkpoint write every 5 passes
- [ ] Final write + commit on completion
- [ ] Debug agents spawned for each gap
- [ ] Root cause classification returned per gap
- [ ] User routed to plan-milestone-gaps, manual fix, or backlog

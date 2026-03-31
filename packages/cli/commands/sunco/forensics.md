---
name: sunco:forensics
description: Post-mortem investigation of a failed workflow run. Analyzes git history, planning artifacts, and execution summaries to find what went wrong and why.
argument-hint: "[phase] [--since <date>] [--deep]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
---

<context>
**Arguments:**
- `[phase]` — Phase number to investigate. If omitted, investigates the most recent failure.

**Flags:**
- `--since <date>` — Limit investigation to events since this date (YYYY-MM-DD).
- `--deep` — Spawn a forensic agent for deeper analysis. Slower but more thorough.
</context>

<objective>
Post-mortem investigation of a failed workflow run. Answers: what failed, why it failed, what triggered the failure, and how to prevent recurrence.

**Creates:**
- `.sun/forensics/[timestamp]-postmortem.md` — post-mortem report
</objective>

<process>
## Step 1: Gather evidence

Collect all available evidence:

**Git history:**
```bash
git log --oneline --since="2 days ago" -- packages/
git log --oneline --since="2 days ago" -- .planning/
```

**Recent test/build failures:**
```bash
# Check for any saved diagnostic reports
ls .sun/diagnostics/ 2>/dev/null | tail -5
```

**Planning artifacts:**
```bash
ls .planning/phases/[N]-*/ 2>/dev/null
```

**SUNCO state:**
```bash
cat .sun/auto.lock 2>/dev/null
cat .planning/STATE.md 2>/dev/null
```

Read all SUMMARY.md files from the phase.
Read VERIFICATION.md if it exists.

## Step 2: Timeline reconstruction

Build a timeline of events:

```
[time] Event: [what happened]
[time] Event: ...
```

Sources:
- Git commit timestamps
- SUMMARY.md timestamps
- VERIFICATION.md results
- AutoLock state

## Step 3: Failure analysis

Identify the failure point:

1. What was the last successful step?
2. What was the first failing step?
3. What changed between the two?

Look for:
- Lint gate failures
- Verification layer failures
- Unhandled errors in summaries
- Git conflicts
- Missing dependencies

## Step 4: Root cause tree

Build a root cause tree:

```
Root Cause: [primary cause]
  ├── Contributing Factor 1: [...]
  │   └── Evidence: [...]
  └── Contributing Factor 2: [...]
      └── Evidence: [...]
```

## Step 5: Deep analysis (if --deep)

Spawn a forensic agent:

**Agent name:** `sunco-forensics` — description: `Forensics: [target]`

"You are investigating a workflow failure for project SUNCO.

Evidence:
[collected evidence]

Timeline:
[reconstructed timeline]

Investigate:
1. What is the most likely root cause?
2. Were there early warning signs that were ignored?
3. Could the SUNCO workflow have caught this earlier? Which layer?
4. What should change to prevent recurrence?

Be specific — cite file paths and line numbers where possible."

## Step 6: Write post-mortem

```markdown
# Post-Mortem: Phase [N] Failure

## Date
[timestamp]

## Impact
[what failed, what couldn't proceed]

## Timeline
[reconstructed timeline]

## Root Cause
[clear explanation]

## Contributing Factors
[list]

## What Went Well
[things that worked, partial successes]

## What Went Wrong
[ordered list]

## Action Items
- [ ] [fix 1 — prevents recurrence]
- [ ] [fix 2]
- [ ] [process improvement]

## Prevention
[how the SUNCO workflow can be improved to catch this earlier]
```

Report: "Post-mortem complete. Report at .sun/forensics/[timestamp]-postmortem.md"
Show action items.
</process>

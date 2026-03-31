---
name: sunco:milestone
description: Manage milestones — audit completion, archive completed milestones, create new ones, and identify gaps.
argument-hint: "[--audit] [--complete] [--new] [--summary] [--gaps]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
  - AskUserQuestion
---

<context>
**Flags:**
- `--audit` — Audit current milestone completion against original intent.
- `--complete` — Archive the current milestone and prepare for the next.
- `--new` — Start a new milestone cycle.
- `--summary` — Generate a comprehensive summary for team onboarding.
- `--gaps` — Identify gaps in the current milestone and create closure phases.
</context>

<objective>
Manage milestone lifecycle: audit, complete, start new, summarize, and close gaps.
</objective>

<process>
## If --audit

Read `.planning/REQUIREMENTS.md` and ROADMAP.md.
Check all v1 requirements against completed phases.

Show:
```
== Milestone Audit ==

Requirements Coverage:
  [✓] REQ-01: [title] — Phase [N] complete
  [✗] REQ-05: [title] — NOT COVERED
  [~] REQ-07: [title] — Partially covered (Phase [N] partial)

Overall: [N/total] v1 requirements complete ([%])

Missing:
  [list of uncovered requirements]

Recommendation: [ship / address gaps first]
```

## If --gaps

Analyze REQUIREMENTS.md vs completed phases.
For each uncovered requirement: create a gap closure plan suggestion.

Ask: "Create gap closure phases? [yes/no]"
If yes: add to ROADMAP.md with gap_closure: true in frontmatter.

## If --summary

Spawn an agent to generate a comprehensive summary:

**Agent name:** `sunco-milestone` — description: `Milestone: [action]`

"Read all completed phase SUMMARY.md files, REQUIREMENTS.md, PROJECT.md, and ROADMAP.md.
Generate a project summary suitable for team onboarding:
1. What was built
2. Architecture overview
3. Key decisions and why
4. How to run and develop
5. What's coming next"

Write to `.planning/MILESTONE-SUMMARY.md`.

## If --complete

Run audit first (--audit).
If gaps exist: ask "Archive anyway? Some requirements uncovered."

Archive:
1. Move current milestone artifacts to `.planning/archive/milestone-[N]/`
2. Update PROJECT.md with milestone completion notes
3. Reset STATE.md for new milestone

Ask: "Start new milestone now? [yes/no]"

## If --new

Ask: "New milestone name?"
Ask: "Primary goal for this milestone?"

Update PROJECT.md with new milestone info.
Reset REQUIREMENTS.md template for new milestone.
Update ROADMAP.md with new milestone section.
Reset STATE.md current phase to 1.

Show: "New milestone started. Run `/sunco:new` to redefine requirements, or `/sunco:discuss 1` to start planning."
</process>

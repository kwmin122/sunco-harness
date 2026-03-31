---
name: sunco:assume
description: Preview what the agent would do for a phase before any execution. Lists assumptions explicitly so you can correct them before planning starts.
argument-hint: "<phase>"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<context>
**Arguments:**
- `<phase>` — Phase number. Required.
</context>

<objective>
Surface the agent's assumptions about a phase before planning or execution. This is a read-only preview — no files are modified. Use to catch wrong assumptions early and avoid expensive replanning.

**Does NOT create files** — output is conversational only.

**After this command:** If assumptions are correct, run `/sunco:plan [N]`. If not, run `/sunco:discuss [N]` to correct them first.
</objective>

<process>
## Step 1: Read everything relevant

Read:
1. `.planning/ROADMAP.md` — phase goal and deliverables
2. `.planning/REQUIREMENTS.md` — requirements this phase covers
3. `.planning/phases/[N]-*/[N]-CONTEXT.md` — if exists, decisions already made
4. `.planning/STATE.md` — current project state
5. `CLAUDE.md` — tech stack and conventions
6. Scan `packages/` structure for relevant existing code

Do NOT read every file — focus on what's relevant to this phase.

## Step 2: Identify what I would assume

Think through the phase goal and list what I would assume if starting to plan right now.

Organize by category:

**Architecture assumptions:**
What architectural pattern would I use? What would I NOT do?

**Technology assumptions:**
Which specific libraries/packages would I reach for?

**File structure assumptions:**
What files would I create? Where would I put them?

**Integration assumptions:**
How would this connect to existing code?

**Scope assumptions:**
What would I include vs exclude from this phase?

**Approach assumptions:**
Any specific algorithmic or design choices I'd make without asking?

## Step 3: Output assumption list

Format as numbered list with reasoning:

```
## My assumptions for Phase [N]: [title]

### Architecture
1. I would use [approach] because [reason from existing codebase/conventions]
2. I would NOT do [alternative] because [reason]

### Technology
3. I'd use [package X] for [purpose] (already in package.json / standard choice for this stack)
4. I'd use [package Y] for [purpose]

### File Structure
5. I'd create [files] in [location] following the existing [pattern]

### Integration
6. I'd integrate with [existing module] via [method]

### Scope
7. I'd include [feature] in this phase
8. I'd EXCLUDE [feature] (defer to later)

### Specific Approach
9. For [component], I'd use [pattern] — common in the codebase at [file]

## Questions I have (genuine ambiguities):
1. [Ambiguity that can't be resolved from existing context]
```

## Step 4: Ask for confirmation

"Are these assumptions correct? Let me know which ones to change before I start planning."

If user corrects assumptions: acknowledge and note corrections. Suggest running `/sunco:discuss [N]` to formally capture the corrections.

If user confirms: "Great. Run `/sunco:plan [N]` and I'll plan with these assumptions."
</process>

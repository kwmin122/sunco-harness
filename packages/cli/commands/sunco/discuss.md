---
name: sunco:discuss
description: Extract decisions and clarify gray areas for a phase before planning. Reads ROADMAP.md, asks focused questions (max 5-7), writes CONTEXT.md. Use --auto to skip questions and pick recommended defaults.
argument-hint: "<phase> [--auto] [--batch] [--mode discuss|assumptions]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - AskUserQuestion
---

<context>
**Arguments:**
- `<phase>` — Phase number (e.g., `1`, `2`). Required.

**Flags:**
- `--auto` — Skip all interactive questions. Pick the recommended option for every gray area. Log each choice. Auto-advance to `/sunco:plan [N]` after writing CONTEXT.md.
- `--batch` — Ask all questions together in a single grouped prompt instead of one at a time.
- `--mode assumptions` — Read codebase first, surface what the agent would assume and do. No questions asked — outputs assumption list for user review. Synonym for `--auto`.
- `--mode discuss` — (default) Interactive discussion mode. Ask focused questions one at a time.
</context>

<objective>
Extract implementation decisions that downstream planning agents need. Analyze the phase, surface gray areas that could go multiple ways, ask focused questions, and write a CONTEXT.md that makes planning deterministic.

**Your role:** Thinking partner, not an interviewer. The user knows WHAT they want. Your job is to surface WHERE multiple valid approaches exist and lock in the user's preferences before code gets written.

**Creates:**
- `.planning/phases/[N]-[name]/[N]-CONTEXT.md` — decisions, constraints, assumptions, and out-of-scope items for this phase

**After this command:** Run `/sunco:plan [N]` to create execution plans using this context.
</objective>

<process>

## Step 1: Parse arguments and initialize

Extract phase number from $ARGUMENTS (first positional token).

If no phase number provided: output "Phase number required. Usage: /sunco:discuss <phase>" and stop.

Parse flags:
- `--auto` active if literal `--auto` appears in $ARGUMENTS, OR if `--mode assumptions` appears
- `--batch` active if literal `--batch` appears in $ARGUMENTS
- `--mode` value from $ARGUMENTS (default: `discuss`)

## Step 2: Load phase context

Read these files in order. Bail with a clear error if ROADMAP.md is missing.

```bash
# Find phase directory
PHASE_DIR=$(ls -d .planning/phases/${PHASE}[-_]* 2>/dev/null | head -1)
```

1. `.planning/ROADMAP.md` — find Phase N: extract goal, deliverables, milestone, any existing notes
2. `.planning/REQUIREMENTS.md` (if exists) — identify requirement IDs this phase covers
3. `.planning/STATE.md` (if exists) — check current status, blockers, prior decisions
4. `${PHASE_DIR}/${PHASE}-CONTEXT.md` (if exists) — load prior decisions to avoid re-asking

**If phase not found in ROADMAP.md:**
```
Phase [N] not found in ROADMAP.md.

Use /sunco:status to see available phases.
```
Exit.

**If CONTEXT.md already exists:**

If `--auto`: load existing context, continue to Step 3 with it. Log: `[auto] Context exists — extending with any new gray areas.`

Otherwise, use AskUserQuestion:
- header: "Context exists"
- question: "Phase [N] already has a CONTEXT.md. What do you want to do?"
- options:
  - "Update it" — Review existing and add/revise decisions
  - "View it" — Show existing context, then decide
  - "Skip" — Use existing as-is, run /sunco:plan [N]

If "Skip": Tell user "Context is ready. Run `/sunco:plan [N]` to create execution plans." and exit.
If "View it": Read and display CONTEXT.md, then re-ask Update/Skip.
If "Update it": Load existing context, continue to Step 3.

**Create phase directory if it doesn't exist:**
```bash
# Derive phase name from ROADMAP.md phase title
mkdir -p .planning/phases/${PHASE}-${PHASE_NAME_SLUG}/
```

## Step 3: Identify gray areas

Analyze the phase goal and deliverables to find decisions the user must weigh in on.

**The rule:** A gray area is a decision that could go 2+ valid ways AND the choice will visibly affect the result or the implementation approach. Don't ask about things Claude should handle (architecture internals, performance optimization, code organization).

**Do ask about:**
- User-visible behavior — what happens when X?
- Interface/API shape — how should this be invoked/consumed?
- Data model choices — what structure, what stored, what computed?
- Integration method — which approach to connect X and Y?
- Error and edge case behavior — what should happen when Y fails?
- Scope boundary decisions — is feature Z in or out for this phase?

**Do NOT ask about:**
- Technical implementation patterns (those are the planner's job)
- File naming and structure (follow CLAUDE.md conventions)
- Anything already decided in STATE.md, prior CONTEXT.md, or REQUIREMENTS.md
- Scope additions (if user suggests them, capture as deferred idea, don't discuss)

**Max 5-7 questions total.** If you identify more gray areas than that, prioritize the ones with the highest impact on the final result.

If prior CONTEXT.md has decisions loaded: skip any gray area that is already resolved.

## Step 4A: Auto mode (--auto flag active)

For each gray area identified:
1. Evaluate the options
2. Pick the one best aligned with project context (CLAUDE.md tech stack, existing codebase patterns, SUNCO architecture principles)
3. Log: `[auto] [Gray Area]: chose "[Option]" — [1-sentence reason]`

After logging all auto-selected choices, proceed directly to Step 5 (write CONTEXT.md).

## Step 4B: Assumptions mode (--mode assumptions, without --auto selecting interactively)

Read the codebase relevant to this phase:
- Scan `packages/` for existing patterns relevant to this phase
- Check `CLAUDE.md` conventions
- Look at similar completed phases for established patterns

Output:
```
## What I would assume for Phase [N]:

1. [Assumption]
   Reason: [existing pattern / convention / implicit from ROADMAP]

2. [Assumption]
   Reason: [...]

...

## Open questions (genuine ambiguities):

1. [Question]

```

Ask: "Are these assumptions correct? Which (if any) do you want to change before I write the context and plan?"

Capture the user's corrections. Proceed to Step 5.

## Step 4C: Discussion mode (default, no --auto)

If `--batch` flag: group all questions into a single AskUserQuestion call, organized by category.

Otherwise: ask one question at a time.

**Question format for each gray area:**
- Open with one sentence stating what's ambiguous
- Present 2-3 concrete options, each with a tradeoff in parentheses
- Mark one as `(Recommended)` based on project context
- End with: "Or describe what you have in mind."

**Example:**
```
For Phase [N] — [Phase Name]:

**[Gray Area Title]**
[One sentence describing the ambiguity]

Options:
A. [Option A] — (tradeoff: ...)
B. [Option B] (Recommended) — (tradeoff: ...)
C. [Option C] — (tradeoff: ...)

Or describe what you have in mind.
```

After each answer: capture the decision with the user's reasoning. Proceed to next gray area.

**Scope creep guard:** If the user suggests something outside the phase scope:
```
"[Feature X] would be a new capability — that's its own phase.
Want me to note it in the backlog?

For this phase, let's focus on [phase domain]."
```

Note the idea under "Deferred Ideas" in CONTEXT.md. Do not discuss it further.

## Step 5: Write CONTEXT.md

Write the completed context file to `.planning/phases/[N]-[name]/[N]-CONTEXT.md`.

```markdown
# Phase [N] Context

## Phase Goal
[Exact goal from ROADMAP.md]

## Requirements Covered
[List requirement IDs and short descriptions from REQUIREMENTS.md that this phase addresses]
- REQ-[ID]: [description]
- REQ-[ID]: [description]

## Decisions Made

| Question | Choice | Reason | Impact |
|----------|--------|--------|--------|
| [Gray area title] | [What was decided] | [Why — user's stated reason or inferred from context] | [What this affects downstream] |
| [Gray area title] | [What was decided] | [Why] | [Impact] |

## Constraints
- Tech stack: [relevant constraints from CLAUDE.md]
- [Any constraints the user stated during discussion]
- [Any constraints implied by REQUIREMENTS.md or prior phases]

## Out of Scope (Phase [N])
- [Explicit exclusion 1 — anything deferred or explicitly out]
- [Explicit exclusion 2]

## Assumptions
[Auto-selected choices if --auto was used, or assumptions confirmed in --mode assumptions]

| Assumption | Basis |
|------------|-------|
| [Assumption] | [existing pattern / convention / user confirmed] |

## Deferred Ideas
[Only populated if user raised out-of-scope features during discussion]
- [Idea] — captured for backlog

## Open Questions
[Should be empty before planning. If anything remains unresolved, list it here.]
```

## Step 6: Update STATE.md

Run:
```bash
node $HOME/.claude/sunco/bin/sunco-tools.cjs state-update \
  --phase ${PHASE} \
  --status "context_ready" \
  --next "/sunco:plan ${PHASE}" \
  2>/dev/null || true
```

If the command fails (sunco-tools not installed), update STATE.md directly:
- Find the `status:` line for this phase and set it to `context_ready`
- Update `next_step:` to `/sunco:plan [N]`
- Update `updated:` to today's date

## Step 7: Commit CONTEXT.md

```bash
git add .planning/phases/${PHASE}-*/
git commit -m "docs(phase-${PHASE}): capture discussion context and decisions"
```

## Step 8: Route

If `--auto` was active:
```
[auto] Phase [N] context written.

Auto-selected [N] decisions — review: .planning/phases/[N]-[name]/[N]-CONTEXT.md

Advancing to plan...
/sunco:plan [N]
```
Then immediately invoke `/sunco:plan [N]`.

Otherwise:
```
Context captured for Phase [N].

Decisions locked: [N]
File: .planning/phases/[N]-[name]/[N]-CONTEXT.md

Run /sunco:plan [N] to create execution plans.
```

</process>

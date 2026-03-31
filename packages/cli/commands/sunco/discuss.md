---
name: sunco:discuss
description: Extract decisions and clarify gray areas for a phase before planning. Run before /sunco:plan to surface ambiguities. Use --mode assumptions to preview what the agent would do without asking.
argument-hint: "<phase> [--batch] [--mode discuss|assumptions]"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

<context>
**Arguments:**
- `<phase>` — Phase number (e.g., `1`, `2`). Required.

**Flags:**
- `--batch` — Group related questions instead of asking one at a time.
- `--mode assumptions` — Read codebase first, surface what the agent would assume and do. No questions asked — outputs assumption list for user review.
- `--mode discuss` — (default) Interactive discussion mode.
</context>

<objective>
Extract all decisions needed before planning a phase. Surface ambiguities, capture preferences, and produce a CONTEXT.md that makes planning deterministic.

**Creates:**
- `.planning/phases/[N]-*/[N]-CONTEXT.md` — decisions, preferences, and constraints for this phase

**After this command:** Run `/sunco:plan [N]` to create execution plans using this context.
</objective>

<process>
## Step 1: Locate phase context

Read `.planning/ROADMAP.md` and find Phase N.
- Extract phase goal, deliverables, and any existing notes.
- Read `.planning/REQUIREMENTS.md` to understand which requirements this phase covers.
- If `.planning/STATE.md` exists, read it for current decisions and blockers.
- If a `{N}-CONTEXT.md` already exists, read it to avoid re-asking resolved questions.

Create the phase directory if it doesn't exist:
`mkdir -p .planning/phases/[N]-[phase-name]/`

## Step 2: Identify gray areas

Analyze the phase goal and requirements to identify ambiguous areas. Categorize by feature type:

- **Architecture decisions** — How should X be structured?
- **API/interface design** — What should the interface look like?
- **Data modeling** — How should data be structured/stored?
- **Integration choices** — Which library/service to use for X?
- **UX/behavior** — How should X behave when Y happens?
- **Error handling** — What should happen when X fails?
- **Performance** — What are acceptable limits?

## Step 3A: Assumptions mode (--mode assumptions)

If `--mode assumptions` is in $ARGUMENTS:

Read the codebase relevant to this phase:
- Scan existing code patterns in `packages/`
- Check existing conventions in `CLAUDE.md`
- Review similar patterns from other phases

Output a numbered list of assumptions:
```
## What I would assume for Phase [N]:

1. [Assumption about architecture choice]
   Reason: [existing pattern / common convention / implicit from requirements]

2. [Assumption about implementation approach]
   Reason: [...]

...

## Questions I have (if not resolved by assumptions):

1. [Genuine ambiguity that needs resolution]
```

Ask: "Are these assumptions correct? Any you want to change before I plan?"

## Step 3B: Discussion mode (default)

For each identified gray area, ask the user to clarify.

If `--batch` is in $ARGUMENTS, group related questions:
```
**Architecture questions:**
1. Should X use approach A or B?
2. Should Y be stored in Z or W?
```

Otherwise ask one at a time.

**Question format:**
- State the gray area clearly
- Offer 2-3 concrete options with tradeoffs
- Mark one as (Recommended) based on project context
- Accept free-form answer if user wants something else

## Step 4: Write CONTEXT.md

After all questions answered (or assumptions confirmed), write:

```markdown
# Phase [N] Context

## Phase Goal
[from ROADMAP.md]

## Decisions Made

### [Decision 1 Title]
**Decision:** [what was decided]
**Reason:** [why]

### [Decision 2 Title]
**Decision:** [what was decided]
**Reason:** [why]

## Constraints
- [Any constraints relevant to this phase]

## Out of Scope (Phase [N])
- [Explicit exclusions]

## Open Questions
- [Any unresolved items — should be empty before planning]
```

## Step 5: Route

Tell user: "Context captured. Run `/sunco:plan [N]` to create execution plans."
</process>

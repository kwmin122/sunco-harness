# New Milestone Workflow

Start a new milestone cycle on an existing project. Loads current project context, gathers goals through conversation, determines version, updates PROJECT.md and STATE.md, optionally runs parallel research agents, defines scoped requirements with REQ-IDs, spawns the roadmapper to create a phased execution plan, and commits all artifacts. Used by `/sunco:milestone new`.

---

## Overview

Eleven steps:

1. **Parse arguments** — flags and milestone name from input
2. **Load context** — PROJECT.md, STATE.md, MILESTONES.md, any pre-existing MILESTONE-CONTEXT.md
3. **Gather goals** — conversation or context file
4. **Determine version** — semver continuation or bump
5. **Confirm understanding** — show summary, require explicit approval
6. **Update PROJECT.md** — add Current Milestone section
7. **Update STATE.md** — reset position for new milestone
8. **Research decision** — ask whether to run parallel researchers
9. **Define requirements** — category-by-category scoping with REQ-IDs
10. **Create roadmap** — spawn sunco-roadmapper agent
11. **Done** — commit everything, show next command

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| `--reset-phase-numbers` | `RESET_PHASES` | false |
| Remaining text | `MILESTONE_NAME` | — |

If `--reset-phase-numbers` is present, the new roadmap starts at Phase 1. Otherwise phases continue from the previous milestone's last phase number (e.g., previous milestone ended at Phase 5 → new milestone starts at Phase 6).

---

## Step 2: Load Context

Read all existing planning artifacts:

```bash
cat .planning/PROJECT.md 2>/dev/null
cat .planning/STATE.md 2>/dev/null
cat .planning/MILESTONES.md 2>/dev/null
cat .planning/MILESTONE-CONTEXT.md 2>/dev/null   # from /sunco:discuss, if exists
```

Extract:
- **Project identity** — "What This Is", Core Value
- **Previous milestone** — version, what shipped, phase count
- **Pending items** — todos, blockers carried from STATE.md
- **Phase count** — how many phases currently in `.planning/phases/`

---

## Step 3: Gather Milestone Goals

**If MILESTONE-CONTEXT.md exists** (pre-seeded from `/sunco:discuss`):
- Read the file
- Extract `goals`, `scope`, `out_of_scope`, `decisions`
- Present summary inline for confirmation before proceeding
- Do NOT ask goal-gathering questions — context file covers this

**If no MILESTONE-CONTEXT.md:**

Display what shipped last:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Last milestone: v1.0 — Core CLI Runtime
 Shipped: skill loader, config parser, state engine (5 phases)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Ask inline (freeform, NOT a structured prompt): "What do you want to build next?"

Wait for response. Then probe specifics with targeted follow-ups:
- "Which users will notice this most?"
- "What's the one thing that has to work perfectly?"
- "Anything that's explicitly out of scope this time?"

If user selects "Other" at any prompt, follow up with plain text — no structured question.

---

## Step 4: Determine Version

Parse last version from MILESTONES.md.

Apply semver logic:
- New features on stable base → minor bump (v1.0 → v1.1)
- Breaking changes or complete rethink → major bump (v1.x → v2.0)
- Bug fix / polish round → patch bump (v1.1 → v1.1.1)

Suggest the version inline: "Based on scope, this looks like v1.1. Sound right?"

Wait for confirmation or correction.

---

## Step 5: Confirm Understanding

Before writing any files, show a milestone summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► MILESTONE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Milestone v1.1: Skill Workflow Engine

Goal: Enable agents to compose and chain skills for multi-step workflows

Target features:
  - Skill composition API (serial and parallel)
  - Workflow state persistence between skills
  - Error recovery and partial rollback
  - Workflow visualization in sunco:status

Key context:
  - Must not break existing single-skill invocations
  - State persistence goes through existing SQLite engine
```

Ask: "Does this capture what you want to build? (yes / adjust)"

If "adjust": ask what to change (plain text). Re-present. Loop until confirmed.

---

## Step 6: Update PROJECT.md

Add or replace the `## Current Milestone` section:

```markdown
## Current Milestone: v1.1 Skill Workflow Engine

**Goal:** Enable agents to compose and chain skills for multi-step workflows

**Target features:**
- Skill composition API (serial and parallel)
- Workflow state persistence between skills
- Error recovery and partial rollback
- Workflow visualization in sunco:status
```

Update the "Last updated" footer.

Ensure the `## Evolution` section exists. If missing, add it:

```markdown
## Evolution

This document evolves at phase transitions and milestone boundaries.

After each phase transition:
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions

After each milestone:
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
```

---

## Step 7: Update STATE.md

Reset the Current Position section:

```markdown
## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-31 — Milestone v1.1 started
```

Keep the Accumulated Context and Pending Todos from previous milestone — they carry forward.

Commit immediately:

```bash
git add .planning/PROJECT.md .planning/STATE.md
git commit -m "docs: start milestone v1.1 Skill Workflow Engine"
```

---

## Step 8: Research Decision

Ask: "Research the feature ecosystem before defining requirements?"

Options:
- "Research first (Recommended)" — Parallel agents explore patterns, pitfalls, stack additions
- "Skip research" — Go straight to requirements

**If research is selected:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► RESEARCHING (4 parallel agents)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Create research directory:

```bash
mkdir -p .planning/research
```

Spawn 4 parallel sunco-researcher agents:

| Agent | Question | Output file |
|-------|----------|-------------|
| Stack | What stack additions are needed for these features? Versions? | STACK.md |
| Features | How do these features typically work? Table stakes vs differentiators? | FEATURES.md |
| Architecture | How do new features integrate with existing architecture? Build order? | ARCHITECTURE.md |
| Pitfalls | Common mistakes when adding these features to an existing system? | PITFALLS.md |

Each agent writes its file directly. After all complete, spawn a synthesizer:

```
Task(
  prompt="
Read .planning/research/STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md.
Synthesize into SUMMARY.md:
  - Stack additions with version pins
  - Feature priorities (table stakes first)
  - Integration approach
  - Top 3 pitfalls to avoid
Write to .planning/research/SUMMARY.md
",
  subagent_type="general-purpose",
  description="Synthesize research findings"
)
```

Display key findings inline after synthesizer completes:

```
Research complete.

Stack additions:    [e.g., "no new deps — uses existing state engine"]
Feature priorities: [e.g., "serial composition first, parallel is optional"]
Watch out for:      [e.g., "partial execution with no rollback leaves corrupt state"]
```

---

## Step 9: Define Requirements

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► DEFINING REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Read PROJECT.md for existing validated requirements.
If research exists, read FEATURES.md for feature categories.

Present features by category and ask what's in scope for this milestone. Use inline multi-select presentation (not a structured prompt widget):

```
Composition API
  Table stakes:    serial chaining, error propagation
  Differentiators: parallel execution, conditional branching
  Notes:           parallel needs careful state isolation

State Persistence
  Table stakes:    save context between skills, restore on resume
  Differentiators: cross-session persistence, shared state between agents
```

Ask: "What's in scope for v1.1? List what you want included."

Track selections:
- Selected → this milestone
- Unselected table stakes → note as "deferred (may become blocker)"
- Unselected differentiators → out of scope

**Generate REQUIREMENTS.md:**

Assign REQ-IDs using format `[CATEGORY]-[NUMBER]` (COMP-01, STATE-02). Continue from the highest existing ID in the project.

**Requirement quality rules:**
- Specific and testable: "User can chain skill A then skill B in a single command"
- User-centric: "User can X" not "System does Y"
- Atomic: one capability per requirement
- Independent: minimal dependencies

Write the file:

```markdown
# Requirements — Milestone v1.1

## Active Requirements

### Composition
- [ ] **COMP-01**: User can chain two skills in sequence with a single command
- [ ] **COMP-02**: Second skill receives first skill's output as input
- [ ] **COMP-03**: Failure in any skill surfaces a clear error with skill name and step

### State
- [ ] **STATE-01**: Workflow state persists to .sun/workflows/ between skills
- [ ] **STATE-02**: Interrupted workflow can be resumed from last completed skill

## Future Requirements
- Parallel execution (COMP-04) — deferred to v1.2
- Cross-agent shared state — deferred (no demand yet)

## Out of Scope
- Visual workflow editor — too heavy for CLI-first product
- Remote state sync — no multi-machine use case defined

## Traceability
[Filled by roadmapper]
```

Present full requirements list. Ask: "Does this capture it? (yes / adjust)"
If "adjust": return to scoping.

Commit:

```bash
git add .planning/REQUIREMENTS.md
git commit -m "docs: define milestone v1.1 requirements (N requirements)"
```

---

## Step 10: Create Roadmap

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► CREATING ROADMAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Spawning roadmapper...
```

Determine starting phase number:
- `--reset-phase-numbers` → start at Phase 1
- Default → last phase number from previous milestone + 1

Spawn sunco-roadmapper:

```
Task(
  prompt="
Read:
  - .planning/PROJECT.md
  - .planning/REQUIREMENTS.md
  - .planning/MILESTONES.md
  - .planning/research/SUMMARY.md (if exists)

Create a phased roadmap for milestone v1.1.
Starting phase number: [N]

Rules:
  1. Map every requirement to exactly one phase
  2. Derive 2-5 observable success criteria per phase
  3. Order phases so each builds on the previous
  4. No phase should take longer than a typical day of work
  5. Validate 100% requirement coverage before writing

Write ROADMAP.md and update STATE.md with phase count.
Update REQUIREMENTS.md Traceability section.

Return: ROADMAP CREATED or ROADMAP BLOCKED (with reason)
",
  subagent_type="general-purpose",
  description="Create roadmap for milestone v1.1"
)
```

**On ROADMAP BLOCKED:** Present the blocker. Work with user to resolve. Re-spawn.

**On ROADMAP CREATED:** Read ROADMAP.md. Present inline:

```
Proposed Roadmap — 4 phases, 5 requirements covered

  #  Phase                   Goal                         Requirements
  6  Composition Core        Serial skill chaining        COMP-01, COMP-02, COMP-03
  7  Workflow State          Persist and resume state     STATE-01, STATE-02
  8  Error Recovery          Graceful failure handling    COMP-03 (extended)
  9  Integration Tests       End-to-end coverage          All

Approve? (yes / adjust / show full file)
```

If "adjust": gather notes, re-spawn with revision context. Loop.
If "show full file": display raw ROADMAP.md, re-ask.

Commit after approval:

```bash
git add .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md
git commit -m "docs: create milestone v1.1 roadmap (4 phases)"
```

---

## Step 11: Done

Delete MILESTONE-CONTEXT.md if it existed (consumed):

```bash
rm -f .planning/MILESTONE-CONTEXT.md
```

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► MILESTONE INITIALIZED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Milestone v1.1: Skill Workflow Engine

  Artifact        Location
  Project         .planning/PROJECT.md
  Requirements    .planning/REQUIREMENTS.md
  Roadmap         .planning/ROADMAP.md
  Research        .planning/research/ (if run)

4 phases  |  5 requirements  |  Ready to build

Next up: Phase 6 — Composition Core

  /sunco:discuss 6    gather context first (recommended)
  /sunco:plan 6       skip discussion, plan directly

/clear first — fresh context window
```

---

## Success Criteria

- [ ] PROJECT.md updated with Current Milestone section
- [ ] STATE.md reset to "defining requirements" state
- [ ] MILESTONE-CONTEXT.md consumed and deleted (if existed)
- [ ] Research run (if selected) — 4 parallel agents + synthesizer
- [ ] Requirements gathered, scoped per category, REQ-IDs assigned
- [ ] REQUIREMENTS.md created and committed
- [ ] sunco-roadmapper spawned with correct starting phase number
- [ ] ROADMAP.md written with 100% requirement coverage
- [ ] User confirmed roadmap before commit
- [ ] All commits made
- [ ] User knows next command

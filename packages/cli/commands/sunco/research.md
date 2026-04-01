---
name: sunco:research
description: Spawn parallel research agents to investigate implementation approaches for the current phase. Produces a RESEARCH.md with findings and recommendations.
argument-hint: "[phase] [--topic <topic>] [--depth quick|thorough] [--cross-model]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
  - Task
---

<context>
**Arguments:**
- `[phase]` — Phase number to research for. Default: current phase from STATE.md.

**Flags:**
- `--topic <topic>` — Research a specific topic instead of the full phase.
- `--depth quick|thorough` — Research depth. quick=2 agents, thorough=4 agents. Default: quick.
- `--cross-model` — Spawn both Claude researcher + secondary model researcher in parallel, merge findings. WARNING: ~2.4x token cost.
</context>

<objective>
Spawn parallel research agents to investigate implementation approaches for a phase. Produces concrete recommendations for /sunco:plan.

**Creates:**
- `.planning/phases/[N]-*/[N]-RESEARCH.md` — research findings and recommended approach
</objective>

<process>
## Step 1: Load phase context

Read:
1. `.planning/ROADMAP.md` — phase goal
2. `.planning/phases/[N]-*/[N]-CONTEXT.md` — decisions already made
3. `.planning/REQUIREMENTS.md` — requirements this phase covers
4. `CLAUDE.md` — tech stack constraints

## Step 2: Identify research topics

Based on phase goal, identify 2-4 research topics:

For `--depth quick`: 2 agents (architecture + implementation)
For `--depth thorough`: 4 agents (architecture + implementation + alternatives + risks)

Or if `--topic` specified: single focused agent.

## Step 3: Spawn research agents

**Agent name:** `sunco-researcher` — description: `Research: [topic]`

**Architecture agent:**
"Research the best architectural approach for: [phase goal].
Given constraints: [tech stack from CLAUDE.md]
Given decisions: [CONTEXT.md decisions]

Document:
1. Recommended architecture with rationale
2. Key components and their roles
3. Data flow diagram (text format)
4. Integration points with existing code"

**Implementation agent:**
"Research implementation patterns for: [phase goal].
Language: TypeScript. Framework: [from CLAUDE.md]

Document:
1. Key libraries/packages to use (with versions)
2. Code structure recommendation (file layout)
3. Key functions/classes to implement
4. 10-line code sketch of the core pattern"

**Alternatives agent (thorough only):**
"Research 2-3 alternative approaches for: [phase goal].
For each alternative: describe, list tradeoffs vs recommended approach."

**Risk agent (thorough only):**
"Identify technical risks for implementing: [phase goal].
For each risk: likelihood, impact, mitigation strategy."

## Step 4: Synthesize and write RESEARCH.md

```markdown
# Phase [N] Research

## Phase Goal
[from ROADMAP.md]

## Recommended Approach

### Architecture
[from architecture agent]

### Implementation
[from implementation agent]

### Key Dependencies
| Package | Version | Purpose |
|---------|---------|---------|

### File Structure
```
[directory tree of files to create]
```

## Alternatives Considered
[from alternatives agent if thorough]

## Risks
[from risk agent if thorough]

## Open Questions for Planning
[anything that needs decision in /sunco:discuss before planning can begin]
```

## Step 5: Report

Show: "Research complete. Key recommendation: [1-sentence summary]"
Tell user: "Run `/sunco:plan [N]` to create plans using this research."
</process>

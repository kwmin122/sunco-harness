---
name: sunco:new
description: Bootstrap a new project from idea to roadmap. Use when starting a greenfield project — guides from raw idea through research, requirements, and phase planning.
argument-hint: "[idea] [--auto] [--no-research]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
  - Task
  - AskUserQuestion
---

<context>
**Flags:**
- `--auto` — Automatic mode. Skip confirmations, run research immediately after questions.
- `--no-research` — Skip parallel research agents. Go straight from questions to synthesis.
</context>

<objective>
Bootstrap a new project from idea through research to roadmap.

**Creates:**
- `.planning/PROJECT.md` — project vision, goals, constraints, tech stack
- `.planning/REQUIREMENTS.md` — scoped requirements (v1 / v2 / out-of-scope)
- `.planning/ROADMAP.md` — phase structure with milestones
- `.planning/STATE.md` — project memory (current phase, decisions, blockers)

**After this command:** Run `/sunco:discuss 1` to extract decisions for Phase 1.
</objective>

<process>
## Step 1: Capture the idea

If $ARGUMENTS contains text (not a flag), use it as the initial idea.
Otherwise, ask: "Describe your project idea in one sentence."

## Step 2: Ask clarifying questions

Ask the following questions one at a time (or grouped if `--batch` in $ARGUMENTS).
Stop when the idea is fully understood (5-8 questions max).

Questions to ask:
1. What type of project is this? (CLI tool / Web app / API service / Library / Mobile app / Other)
2. Who are the target users? (describe in one sentence)
3. What core problem does this solve that existing tools do not?
4. What is the primary tech stack or language preference? (TypeScript / Python / Rust / Go / Other)
5. What scale are you targeting? (Personal side project / Small team / Startup / Enterprise)
6. Is there a deadline or milestone driving this? (yes/no — if yes, what?)
7. What should be in v1? (minimum viable product)
8. What should be explicitly OUT of scope for v1?

## Step 3: Parallel research (skip if --no-research)

Spawn 4 parallel research agents using Task tool. Each agent reads the codebase and searches for relevant context:

**Agent name:** `sunco-researcher` — description: `Research: [area]`

**Agent 1 — Tech Stack Research:**
"Research the best tech stack choices for: [idea]. Consider: [language preference], [project type], [scale]. Identify 3 top options with tradeoffs."

**Agent 2 — Competitor Analysis:**
"Identify existing tools/products similar to: [idea]. For each: name, key features, limitations, what gap it leaves."

**Agent 3 — Architecture Patterns:**
"Research architectural patterns best suited for: [idea]. Consider [project type]. Identify 2-3 patterns with fit assessment."

**Agent 4 — Risk & Challenges:**
"Identify the top 5 technical risks and challenges for building: [idea]. For each: risk, likelihood, mitigation."

Collect all results. If an agent fails, continue with remaining results (graceful degradation).

## Step 4: Synthesize into planning documents

Using idea + answers + research results, create three documents:

**PROJECT.md:**
```markdown
# [Project Name]

## Vision
[1-3 sentence description of what this is and why it matters]

## Problem
[Core problem being solved]

## Target Users
[Who will use this and why]

## Goals
- [Goal 1]
- [Goal 2]

## Constraints
- Tech: [stack decisions]
- Timeline: [if applicable]
- Scale: [scope constraint]

## Key Decisions
[Major architectural/product decisions made during new flow]
```

**REQUIREMENTS.md:**
```markdown
# Requirements

## v1 (Must Have)
- [ ] REQ-01: [requirement]

## v2 (Should Have)
- [ ] REQ-[N]: [requirement]

## Out of Scope
- [explicit exclusion]
```

**ROADMAP.md:**
```markdown
# Roadmap

## Milestone 1: [Name]

### Phase 1: [Name]
- Goal: [what this phase accomplishes]
- Requires: []
- Delivers: [artifact/feature]

### Phase 2: [Name]
...
```

## Step 5: Write STATE.md

```markdown
# Project State

## Current Phase
1 (not started)

## Status
bootstrapped

## Last Updated
[date]

## Decisions
[Key decisions captured during /sunco:new]

## Blockers
[]
```

## Step 6: Report and route

Show summary:
- Project: [name]
- Phases planned: [N]
- Requirements captured: [N]

Tell user: "Run `/sunco:discuss 1` to extract decisions for Phase 1 before planning."
</process>

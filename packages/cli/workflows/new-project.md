<purpose>
Initialize a new project through unified flow: questioning, research (optional), requirements, roadmap. This is the most leveraged moment in any project — deep questioning here means better plans, better execution, better outcomes. One workflow takes you from idea to ready-for-planning.
</purpose>

<required_reading>
Read all files referenced by the invoking skill's execution_context before starting.
</required_reading>

<available_agent_types>
Valid SUNCO subagent types (use exact names — do not fall back to 'general-purpose'):
- sunco-project-researcher — Researches project-level technical decisions
- sunco-research-synthesizer — Synthesizes findings from parallel research agents
- sunco-roadmapper — Creates phased execution roadmaps
</available_agent_types>

<auto_mode>

## Auto Mode Detection

Check if `--auto` flag is present in $ARGUMENTS.

**If auto mode:**

- Skip brownfield mapping offer (assume greenfield)
- Skip deep questioning (extract context from provided document)
- Config: YOLO mode is implicit (skip that question), but ask granularity/git/agents FIRST (Step 2a)
- After config: run Steps 6–9 automatically with smart defaults:
  - Research: Always yes
  - Requirements: Include all table stakes + features from provided document
  - Requirements approval: Auto-approve
  - Roadmap approval: Auto-approve

**Document requirement:**
Auto mode requires an idea document — either:

- File reference: `/sunco:new --auto @prd.md`
- Pasted/written text in the prompt

If no document content provided, error:

```
Error: --auto requires an idea document.

Usage:
  /sunco:new --auto @your-idea.md
  /sunco:new --auto [paste or write your idea here]

The document should describe what you want to build.
```

</auto_mode>

<process>

## 1. Initialize

**MANDATORY FIRST STEP — Execute these checks before ANY user interaction:**

```bash
INIT=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" init new-project)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_RESEARCHER=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" agent-skills sunco-project-researcher 2>/dev/null)
AGENT_SKILLS_SYNTHESIZER=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" agent-skills sunco-research-synthesizer 2>/dev/null)
AGENT_SKILLS_ROADMAPPER=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" agent-skills sunco-roadmapper 2>/dev/null)
```

Parse JSON for: `researcher_model`, `synthesizer_model`, `roadmapper_model`, `commit_docs`, `project_exists`, `has_codebase_map`, `planning_exists`, `has_existing_code`, `has_package_file`, `is_brownfield`, `needs_codebase_map`, `has_git`, `project_path`.

**If `project_exists` is true:** Error — project already initialized. Direct user to `/sunco:progress`.

```
Error: Project already initialized.

This directory already has a .planning/ folder.

Use /sunco:progress to see where you are.
Use /sunco:status for a full project overview.
```

**If `has_git` is false:** Initialize git:

```bash
git init
```

Then confirm:

```
Git repository initialized.
```

---

## 2. Brownfield Offer

**If auto mode:** Skip to Step 4 (assume greenfield, synthesize PROJECT.md from provided document).

**If `needs_codebase_map` is true** (from init — existing code detected but no codebase map):

Use AskUserQuestion:

- header: "Codebase"
- question: "I detected existing code in this directory. Would you like to map the codebase first?"
- options:
  - "Map codebase first (Recommended)" — Run /sunco:scan to understand existing architecture before planning
  - "Skip mapping" — Proceed with project initialization

**If "Map codebase first":**

```
Run /sunco:scan first to map the existing codebase, then return to /sunco:new.

/sunco:scan will:
  - Identify packages, modules, and entry points
  - Map the dependency graph
  - Detect existing patterns and conventions
  - Write .planning/codebase/ artifacts

After /sunco:scan completes, run /sunco:new again.
```

Exit command.

**If "Skip mapping" OR `needs_codebase_map` is false:** Continue to Step 3.

---

## 2a. Auto Mode Config (auto mode only)

**If auto mode:** Collect config settings upfront before processing the idea document.

YOLO mode is implicit (auto = YOLO). Ask remaining config questions:

**Round 1 — Core settings (3 questions, no Mode question):**

```
AskUserQuestion([
  {
    header: "Granularity",
    question: "How finely should scope be sliced into phases?",
    multiSelect: false,
    options: [
      { label: "Coarse (Recommended)", description: "Fewer, broader phases (3-5 phases, 1-3 plans each)" },
      { label: "Standard", description: "Balanced phase size (5-8 phases, 3-5 plans each)" },
      { label: "Fine", description: "Many focused phases (8-12 phases, 5-10 plans each)" }
    ]
  },
  {
    header: "Execution",
    question: "Run plans in parallel?",
    multiSelect: false,
    options: [
      { label: "Parallel (Recommended)", description: "Independent plans run simultaneously" },
      { label: "Sequential", description: "One plan at a time" }
    ]
  },
  {
    header: "Git Tracking",
    question: "Commit planning docs to git?",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Planning docs tracked in version control" },
      { label: "No", description: "Keep .planning/ local-only (add to .gitignore)" }
    ]
  }
])
```

**Round 2 — Workflow agents (same as Step 5, Round 2):**

```
AskUserQuestion([
  {
    header: "Research",
    question: "Research before planning each phase? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Investigate domain, find patterns, surface gotchas" },
      { label: "No", description: "Plan directly from requirements" }
    ]
  },
  {
    header: "Plan Check",
    question: "Verify plans will achieve their goals? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Catch gaps before execution starts" },
      { label: "No", description: "Execute plans without verification" }
    ]
  },
  {
    header: "Verifier",
    question: "Verify work satisfies requirements after each phase? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Confirm deliverables match phase goals" },
      { label: "No", description: "Trust execution, skip verification" }
    ]
  },
  {
    header: "AI Models",
    question: "Which AI models for planning agents?",
    multiSelect: false,
    options: [
      { label: "Balanced (Recommended)", description: "Sonnet for most agents — good quality/cost ratio" },
      { label: "Quality", description: "Opus for research/roadmap — higher cost, deeper analysis" },
      { label: "Budget", description: "Haiku where possible — fastest, lowest cost" },
      { label: "Inherit", description: "Use the current session model for all agents" }
    ]
  }
])
```

Create `.planning/config.json` with all settings:

```bash
mkdir -p .planning
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" config-new-project '{"mode":"yolo","granularity":"[selected]","parallelization":true|false,"commit_docs":true|false,"model_profile":"quality|balanced|budget|inherit","workflow":{"research":true|false,"plan_check":true|false,"verifier":true|false,"auto_advance":true}}'
```

**If commit_docs = No:** Add `.planning/` to `.gitignore`.

**Commit config.json:**

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" commit "chore: add project config" --files .planning/config.json
```

**Persist auto-advance chain flag to config (survives context compaction):**

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" config-set workflow._auto_chain_active true
```

Proceed to Step 4 (skip Steps 3 and 5).

---

## 3. Deep Questioning

**If auto mode:** Skip (already handled in Step 2a). Extract project context from provided document instead and proceed to Step 4.

**Display stage banner:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► QUESTIONING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3.1. Capture Idea

**If `--idea` flag is present in $ARGUMENTS:** Use the provided string as the seed idea. Skip the opening question.

**If `--prd` flag is present:** Read the referenced file as the idea document. Use it to pre-populate context. Skip the opening question.

**Otherwise:** Ask inline (freeform, NOT AskUserQuestion):

> "What do you want to build?"

Wait for their response. This gives you the context needed to ask intelligent follow-up questions. Do not rush. This is the most leveraged moment in the workflow.

### 3.2. Socratic Interview — Round 1

Based on what they said, ask follow-up questions that dig into their response. Do NOT ask technical questions in Round 1. Focus on domain, users, problem, and scope.

Use AskUserQuestion with 3–4 questions grouped by theme. Pick the most relevant from these categories based on what they said:

**Category A: Domain and Problem**
- What type of product is this? (CLI tool / web app / API service / mobile app / library / other)
- What problem are you actually solving, in one sentence?
- Is this replacing something that exists today, or creating a new behavior?
- What happens if this doesn't get built? (Who suffers, and how?)

**Category B: Users**
- Who are the target users? (One sentence — e.g., "solo developers who deploy to Vercel")
- What do they do today instead of using this?
- What does success look like for a user in their first 10 minutes?
- What's the one thing this must do better than anything else available?

**Category C: Scope and Constraints**
- What absolutely must be in v1 for it to be worth shipping?
- What should be explicitly NOT in v1? (naming exclusions is as important as inclusions)
- Is there a deadline or external pressure shaping scope?
- What's already decided that I shouldn't question?

**Category D: Success Criteria**
- How will you know v1 is working? What would a user say?
- What does a successful first week look like?
- What would make you confident enough to show this to real users?

**Batching:** Ask 3–4 questions at once using AskUserQuestion with multiSelect: false per question. Group related questions. Do not ask 8 questions in a single batch.

**Max rounds:** 2 rounds of 3–4 questions each. Stop when you can write a clear PROJECT.md.

### 3.3. Socratic Interview — Round 2 (conditional)

After Round 1, evaluate whether you have enough to write a clear PROJECT.md. Mentally check:

- [ ] Domain is understood (type, space, competition)
- [ ] Target users are specific (not "everyone" or "developers")
- [ ] Core value proposition is clear (one sentence)
- [ ] v1 scope boundaries are defined (in AND out)
- [ ] At least one success criterion is testable
- [ ] No critical unknown would change architecture decisions

If gaps remain, run Round 2 with 3–4 targeted questions. Only ask about genuine unknowns — do not re-ask things already answered.

**Do NOT ask technical questions.** Technical decisions come during research and planning. In questioning, you are only learning the problem space, users, and constraints.

Example of bad Round 2 questions (too technical):
- "What database are you using?" — wrong time
- "REST or GraphQL?" — wrong time
- "What's your deployment strategy?" — wrong time

Example of good Round 2 questions:
- "You said 'enterprise teams' — how many people are on a typical team?"
- "What does 'fast' mean to you? Seconds? Milliseconds?"
- "You mentioned compliance — is that GDPR, SOC2, both, or something else?"

### 3.4. Decision Gate

When you could write a clear PROJECT.md, use AskUserQuestion:

- header: "Ready?"
- question: "I think I understand what you're building. Ready to create PROJECT.md?"
- options:
  - "Create PROJECT.md" — Let's move forward
  - "Keep exploring" — I want to share more / ask me more questions

If "Keep exploring": ask what they want to add, or identify gaps and probe naturally.

Loop until "Create PROJECT.md" selected.

---

## 4. Write PROJECT.md

**If auto mode:** Synthesize from provided document. No "Ready?" gate shown — proceed directly to commit.

**Display stage banner:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► WRITING PROJECT.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Synthesize all context into `.planning/PROJECT.md`.

### 4.1. Greenfield Format

**For greenfield projects (no existing codebase or `has_existing_code` is false):**

Initialize requirements as hypotheses:

```markdown
# [Project Name]

## What This Is

[One paragraph. What it does, who it's for, why it matters.]

## Core Value

[One sentence. The single most important thing this must do better than anything else.]

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] [Requirement 1 — specific and testable]
- [ ] [Requirement 2 — specific and testable]
- [ ] [Requirement 3 — specific and testable]

### Out of Scope

- [Exclusion 1] — [why explicitly excluded]
- [Exclusion 2] — [why explicitly excluded]

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| [Choice from questioning] | [Why] | — Pending |

## Context

**Target users:** [one sentence]
**Current alternative:** [what they do today]
**v1 deadline:** [if any]
**Constraints:** [hard constraints — infra, compliance, budget]

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/sunco:phase`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/sunco:milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: [date] after initialization*
```

### 4.2. Brownfield Format

**For brownfield projects (codebase map exists — `has_codebase_map` is true):**

Infer Validated requirements from existing code:

1. Read `.planning/codebase/ARCHITECTURE.md` and `STACK.md` (created by `/sunco:scan`)
2. Identify what the codebase already does
3. These become the initial Validated set

```markdown
## Requirements

### Validated

- ✓ [Existing capability 1] — existing code
- ✓ [Existing capability 2] — existing code
- ✓ [Existing capability 3] — existing code

### Active

- [ ] [New requirement 1]
- [ ] [New requirement 2]

### Out of Scope

- [Exclusion 1] — [why]
```

Do not compress. Capture everything gathered during questioning.

**Commit PROJECT.md:**

```bash
mkdir -p .planning
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" commit "docs: initialize project" --files .planning/PROJECT.md
```

**Create initial rollback point** (safety net for the entire project bootstrapping):

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" rollback-point create --label "after-project-init"
```

This creates `.planning/.rollback/` with a snapshot of all artifacts at this point. If anything goes wrong during research/roadmapping, the user can `/sunco:backtrack` to this clean state.

---

## 5. Workflow Preferences

**If auto mode:** Skip — config was collected in Step 2a. Proceed to Step 5.5.

**Display stage banner:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► WORKFLOW SETUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Check for global defaults** at `~/.sun/defaults.json`. If the file exists, offer to use saved defaults:

```
AskUserQuestion([
  {
    question: "Use your saved default settings? (from ~/.sun/defaults.json)",
    header: "Defaults",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Use saved defaults, skip settings questions" },
      { label: "No", description: "Configure settings manually" }
    ]
  }
])
```

If "Yes": read `~/.sun/defaults.json`, use those values for config.json, skip to **Commit config.json** below.

If "No" or `~/.sun/defaults.json` doesn't exist: proceed with the questions below.

**Round 1 — Core workflow settings (4 questions):**

```
AskUserQuestion([
  {
    header: "Mode",
    question: "How do you want to work?",
    multiSelect: false,
    options: [
      { label: "YOLO (Recommended)", description: "Auto-approve steps, just execute — fastest path" },
      { label: "Interactive", description: "Confirm at each step — full control" }
    ]
  },
  {
    header: "Granularity",
    question: "How finely should scope be sliced into phases?",
    multiSelect: false,
    options: [
      { label: "Coarse", description: "Fewer, broader phases (3-5 phases, 1-3 plans each)" },
      { label: "Standard (Recommended)", description: "Balanced phase size (5-8 phases, 3-5 plans each)" },
      { label: "Fine", description: "Many focused phases (8-12 phases, 5-10 plans each)" }
    ]
  },
  {
    header: "Git Branching",
    question: "How should git branches be managed during execution?",
    multiSelect: false,
    options: [
      { label: "None", description: "Work directly on main/current branch" },
      { label: "Per Phase", description: "Create a branch per phase — safer, more granular" },
      { label: "Per Milestone (Recommended)", description: "Create a branch per milestone — good balance" }
    ]
  },
  {
    header: "Commit Planning Docs",
    question: "Commit planning docs to git?",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Planning docs tracked in version control" },
      { label: "No", description: "Keep .planning/ local-only (add to .gitignore)" }
    ]
  }
])
```

**Round 2 — Workflow agents:**

These spawn additional agents during planning and execution. They add tokens and time but improve quality. All recommended for important projects. Skip for quick experiments.

| Agent | When it runs | What it does |
|-------|--------------|--------------|
| **Researcher** | Before planning each phase | Investigates domain, finds patterns, surfaces gotchas |
| **Plan Checker** | After plan is created | Verifies plan actually achieves the phase goal |
| **Verifier** | After phase execution | Confirms must-haves were delivered |

```
AskUserQuestion([
  {
    header: "Research",
    question: "Research before planning each phase? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Investigate domain, find patterns, surface gotchas" },
      { label: "No", description: "Plan directly from requirements" }
    ]
  },
  {
    header: "Plan Check",
    question: "Verify plans will achieve their goals? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Catch gaps before execution starts" },
      { label: "No", description: "Execute plans without verification" }
    ]
  },
  {
    header: "Verifier",
    question: "Verify work satisfies requirements after each phase? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Confirm deliverables match phase goals" },
      { label: "No", description: "Trust execution, skip verification" }
    ]
  },
  {
    header: "AI Models",
    question: "Which AI models for planning agents?",
    multiSelect: false,
    options: [
      { label: "Balanced (Recommended)", description: "Sonnet for most agents — good quality/cost ratio" },
      { label: "Quality", description: "Opus for research/roadmap — higher cost, deeper analysis" },
      { label: "Budget", description: "Haiku where possible — fastest, lowest cost" },
      { label: "Inherit", description: "Use the current session model for all agents" }
    ]
  }
])
```

Create `.planning/config.json` with all settings:

```bash
mkdir -p .planning
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" config-new-project '{"mode":"[yolo|interactive]","granularity":"[selected]","git_branching":"[none|phase|milestone]","commit_docs":true|false,"model_profile":"quality|balanced|budget|inherit","workflow":{"research":true|false,"plan_check":true|false,"verifier":true|false}}'
```

**Note:** Run `/sunco:settings` anytime to update model profile, workflow agents, branching strategy, and other preferences.

**If commit_docs = No:**

- Set `commit_docs: false` in config.json
- Add `.planning/` to `.gitignore` (create if needed)

**If commit_docs = Yes:**

- No additional gitignore entries needed

**Commit config.json:**

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" commit "chore: add project config" --files .planning/config.json
```

---

## 5.1. Sub-Repo Detection

**Detect multi-repo workspace:**

Check for directories with their own `.git` folders (separate repos within the workspace):

```bash
find . -maxdepth 1 -type d -not -name ".*" -not -name "node_modules" -exec test -d "{}/.git" \; -print
```

**If sub-repos found:**

Strip the `./` prefix to get directory names (e.g., `./backend` → `backend`).

Use AskUserQuestion:

- header: "Multi-Repo Workspace"
- question: "I detected separate git repos in this workspace. Which directories contain code that SUNCO should commit to?"
- multiSelect: true
- options: one option per detected directory
  - "[directory name]" — Separate git repo

**If user selects one or more directories:**

- Set `planning.sub_repos` in config.json to the selected directory names array (e.g., `["backend", "frontend"]`)
- Auto-set `planning.commit_docs` to `false` (planning docs stay local in multi-repo workspaces)
- Add `.planning/` to `.gitignore` if not already present

Config changes are saved locally — no commit needed since `commit_docs` is `false` in multi-repo mode.

Inform the user:

```
Multi-repo workspace detected.
  Sub-repos tracked: [directory names]
  Planning docs: local-only (not committed — multi-repo mode)
  .planning/ added to .gitignore
```

**If no sub-repos found or user selects none:** Continue with no changes to config.

---

## 5.5. Resolve Model Profile

Use models from init: `researcher_model`, `synthesizer_model`, `roadmapper_model`.

These are resolved from `config.json` `model_profile` field:

| Profile | researcher_model | synthesizer_model | roadmapper_model |
|---------|-----------------|-------------------|-----------------|
| quality | claude-opus-4-5 | claude-opus-4-5 | claude-opus-4-5 |
| balanced | claude-sonnet-4-5 | claude-sonnet-4-5 | claude-sonnet-4-5 |
| budget | claude-haiku-3-5 | claude-haiku-3-5 | claude-sonnet-4-5 |
| inherit | (session model) | (session model) | (session model) |

---

## 6. Research Decision

**If `--no-research` flag is present in $ARGUMENTS:** Skip to Step 7.

**If auto mode:** Default to "Research first" without asking.

**If workflow config already has `research: false`:** Skip to Step 7.

Use AskUserQuestion:

- header: "Research"
- question: "Research the domain ecosystem before defining requirements?"
- options:
  - "Research first (Recommended)" — Discover standard stacks, expected features, architecture patterns
  - "Skip research" — I know this domain well, go straight to requirements

**If "Research first":**

Display stage banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► RESEARCHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Researching [domain] ecosystem...
```

Create research directory:

```bash
mkdir -p .planning/research
```

**Determine milestone context:**

- If no "Validated" requirements in PROJECT.md → Greenfield (building from scratch)
- If "Validated" requirements exist → Subsequent milestone (adding to existing app)

Display spawning indicator:

```
◆ Spawning 4 researchers in parallel...
  → Stack research
  → Features research
  → Architecture research
  → Pitfalls research
```

### 6.1. Spawn 4 Parallel Research Agents

Spawn 4 parallel sunco-project-researcher agents simultaneously using the Task tool. Each agent operates with fresh context and writes its output to a dedicated file.

**Agent 1 — Stack Research**

```
Task(prompt="<research_type>
Project Research — Stack dimension for [domain].
</research_type>

<milestone_context>
[greenfield OR subsequent]

Greenfield: Research the standard 2026 stack for building [domain] from scratch.
Subsequent: Research what's needed to add [target features] to an existing [domain] app. Don't re-research the existing system.
</milestone_context>

<question>
What is the best tools and frameworks for [project type] in 2026?
</question>

<files_to_read>
- {project_path}/PROJECT.md (Project context and goals)
</files_to_read>

${AGENT_SKILLS_RESEARCHER}

<downstream_consumer>
Your STACK.md feeds into roadmap creation. Be prescriptive:
- Specific libraries with versions
- Clear rationale for each choice
- What NOT to use and why
- Confidence level per recommendation
</downstream_consumer>

<quality_gate>
- [ ] Versions are current (verify with official docs — do not rely on training data alone)
- [ ] Rationale explains WHY, not just WHAT
- [ ] Confidence levels assigned to each recommendation
- [ ] Alternatives considered and rejected with reasoning
</quality_gate>

<output>
Write to: .planning/research/STACK.md
Format: markdown with sections for each stack layer
</output>
", subagent_type="general-purpose", model="{researcher_model}", description="Stack research")
```

**Agent 2 — Features Research**

```
Task(prompt="<research_type>
Project Research — Features dimension for [domain].
</research_type>

<milestone_context>
[greenfield OR subsequent]

Greenfield: What features do [domain] products have? What's table stakes vs differentiating?
Subsequent: How do [target features] typically work? What's expected behavior from users?
</milestone_context>

<question>
How do similar products implement [core features] in [domain]?
</question>

<files_to_read>
- {project_path}/PROJECT.md (Project context)
</files_to_read>

${AGENT_SKILLS_RESEARCHER}

<downstream_consumer>
Your FEATURES.md feeds into requirements definition. Categorize clearly:
- Table stakes (users expect this — missing it means they leave)
- Differentiators (competitive advantage — what makes this worth building)
- Anti-features (things to deliberately NOT build — include reasoning)
</downstream_consumer>

<quality_gate>
- [ ] Categories are clear (table stakes vs differentiators vs anti-features)
- [ ] Complexity noted for each feature
- [ ] Dependencies between features identified
- [ ] At least 3 real product examples cited per major category
</quality_gate>

<output>
Write to: .planning/research/FEATURES.md
Format: markdown grouped by feature category
</output>
", subagent_type="general-purpose", model="{researcher_model}", description="Features research")
```

**Agent 3 — Architecture Research**

```
Task(prompt="<research_type>
Project Research — Architecture dimension for [domain].
</research_type>

<milestone_context>
[greenfield OR subsequent]

Greenfield: How are [domain] systems typically structured? What are major components?
Subsequent: How do [target features] integrate with existing [domain] architecture?
</milestone_context>

<question>
What are common architecture patterns for [project type]?
</question>

<files_to_read>
- {project_path}/PROJECT.md (Project context)
</files_to_read>

${AGENT_SKILLS_RESEARCHER}

<downstream_consumer>
Your ARCHITECTURE.md informs phase structure in roadmap. Include:
- Component boundaries (what talks to what)
- Data flow (how information moves)
- Suggested build order (dependencies between components)
- 2-3 recommended patterns with tradeoffs
</downstream_consumer>

<quality_gate>
- [ ] Components clearly defined with boundaries
- [ ] Data flow direction explicit
- [ ] Build order implications noted
- [ ] Pattern recommendation has clear rationale
</quality_gate>

<output>
Write to: .planning/research/ARCHITECTURE.md
Format: markdown with component diagram (text-based) and data flow section
</output>
", subagent_type="general-purpose", model="{researcher_model}", description="Architecture research")
```

**Agent 4 — Pitfalls Research**

```
Task(prompt="<research_type>
Project Research — Pitfalls dimension for [domain].
</research_type>

<milestone_context>
[greenfield OR subsequent]

Greenfield: What do [domain] projects commonly get wrong? What are the critical first-month mistakes?
Subsequent: What are common mistakes when adding [target features] to [domain]?
</milestone_context>

<question>
What are common pitfalls and risks in [domain]?
</question>

<files_to_read>
- {project_path}/PROJECT.md (Project context)
</files_to_read>

${AGENT_SKILLS_RESEARCHER}

<downstream_consumer>
Your PITFALLS.md prevents mistakes in roadmap and planning. For each pitfall:
- Warning signs (how to detect early)
- Prevention strategy (how to avoid)
- Which phase should address it
- Likelihood and impact rating
</downstream_consumer>

<quality_gate>
- [ ] Pitfalls are specific to this domain (not generic advice like 'write tests')
- [ ] Prevention strategies are actionable (not 'be careful')
- [ ] Phase mapping included where relevant
- [ ] Top 5 risks ranked by likelihood × impact
</quality_gate>

<output>
Write to: .planning/research/PITFALLS.md
Format: markdown with risk table and detailed entries
</output>
", subagent_type="general-purpose", model="{researcher_model}", description="Pitfalls research")
```

### 6.2. Graceful Degradation

If any agent fails or times out, continue with the remaining results. Log which agents failed:

```
⚠ Research incomplete:
  ✓ Stack research
  ✓ Features research
  ✗ Architecture research — timed out
  ✓ Pitfalls research

Proceeding with 3/4 research results. SUMMARY.md will note the gap.
```

Do not block synthesis on partial research failure. The planning documents should note which research areas were incomplete.

### 6.3. Spawn Research Synthesizer

After all 4 agents complete (or gracefully fail), spawn synthesizer to create SUMMARY.md:

```
Task(prompt="
<task>
Synthesize research outputs into SUMMARY.md.
</task>

<files_to_read>
- .planning/research/STACK.md
- .planning/research/FEATURES.md
- .planning/research/ARCHITECTURE.md (if exists)
- .planning/research/PITFALLS.md
</files_to_read>

${AGENT_SKILLS_SYNTHESIZER}

<synthesis_goal>
Create an actionable 1-page summary that feeds directly into requirements definition.
Extract:
1. The recommended stack (top picks with brief rationale)
2. Table stakes features (users expect these — must be in v1)
3. The dominant architecture pattern
4. Top 3 risks and their mitigations

Do not repeat full content from source files. Synthesize into decisions.
</synthesis_goal>

<output>
Write to: .planning/research/SUMMARY.md
Format: concise markdown with 4 sections matching synthesis_goal
Commit after writing.
</output>
", subagent_type="general-purpose", model="{synthesizer_model}", description="Synthesize research")
```

Display research complete banner and key findings from SUMMARY.md:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► RESEARCH COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Key Findings

**Stack:** [from SUMMARY.md — top recommendation]
**Table Stakes:** [from SUMMARY.md — must-have features]
**Watch Out For:** [from SUMMARY.md — top risk]

Files: .planning/research/
  STACK.md       — recommended stack
  FEATURES.md    — table stakes vs differentiators
  ARCHITECTURE.md — structural patterns
  PITFALLS.md    — risks and mitigations
  SUMMARY.md     — synthesized decision input
```

**If "Skip research":** Continue to Step 7.

---

## 7. Define Requirements

Display stage banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► DEFINING REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Load context:**

Read PROJECT.md and extract:

- Core value (the ONE thing that must work)
- Stated constraints (budget, timeline, tech limitations)
- Any explicit scope boundaries mentioned during questioning

**If research exists:** Read `.planning/research/FEATURES.md` and extract feature categories.

**If auto mode:**

- Auto-include all table stakes features (users expect these)
- Include features explicitly mentioned in provided document
- Auto-defer differentiators not mentioned in document
- Skip per-category AskUserQuestion loops
- Skip "Any additions?" question
- Skip requirements approval gate
- Generate REQUIREMENTS.md and commit directly

### 7.1. Feature Scoping (Interactive Mode Only)

**If research exists:** Present features by category for user to scope:

```
Here are the features for [domain] based on research:

## [Category Name]

**Table stakes** (users expect these):
- [Feature 1]
- [Feature 2]
- [Feature 3]

**Differentiators** (competitive advantage):
- [Feature 4]
- [Feature 5]

**Research notes:** [any relevant notes from FEATURES.md]

---

## [Next Category]
...
```

**If no research:** Gather requirements through conversation instead.

Ask: "What are the main things users need to be able to do?"

For each capability mentioned:
- Ask clarifying questions to make it specific
- Probe for related capabilities
- Group into categories naturally

**Scope each category:**

For each category, use AskUserQuestion:

- header: "[Category]" (max 12 chars)
- question: "Which [category] features are in v1?"
- multiSelect: true
- options:
  - "[Feature 1]" — [brief description]
  - "[Feature 2]" — [brief description]
  - "[Feature 3]" — [brief description]
  - "None for v1" — Defer entire category

Track responses:

- Selected features → v1 requirements
- Unselected table stakes → v2 (users expect these — defer, don't drop)
- Unselected differentiators → out of scope with reasoning

**Identify gaps:**

Use AskUserQuestion:

- header: "Additions"
- question: "Any requirements research missed? (Features specific to your vision)"
- options:
  - "No, research covered it" — Proceed to generate REQUIREMENTS.md
  - "Yes, let me add some" — Capture additions before generating

**Validate core value:**

Cross-check requirements against Core Value from PROJECT.md. If the Core Value cannot be satisfied by the current requirements list, surface this explicitly:

```
⚠ Core value gap detected:

Core Value: "[from PROJECT.md]"

None of the v1 requirements directly addresses this. Consider adding a requirement
that specifically enables the core value before proceeding.
```

### 7.2. Requirement Quality Rules

Good requirements are:

- **Specific and testable:** "User can reset password via email link" (not "Handle password reset")
- **User-centric:** "User can X" (not "System does Y")
- **Atomic:** One capability per requirement (not "User can login and manage profile")
- **Independent:** Minimal dependencies on other requirements

Reject vague requirements. Push for specificity:

- "Handle authentication" → "User can log in with email and password and stay logged in across sessions"
- "Support sharing" → "User can share item via link that opens without login for recipient"
- "Fast performance" → "Page loads in under 2 seconds on 4G connection"

### 7.3. Generate REQUIREMENTS.md

Create `.planning/REQUIREMENTS.md` with:

```markdown
# Requirements

## v1 Requirements

### [CATEGORY-NAME]

- [ ] **[CAT]-01**: [User-centric, testable requirement]
- [ ] **[CAT]-02**: [User-centric, testable requirement]

### [CATEGORY-NAME-2]

- [ ] **[CAT2]-01**: [User-centric, testable requirement]

---

## v2 Requirements

- [ ] **[CAT]-NN**: [Valuable but deferred — reason]
- [ ] **[CAT2]-NN**: [Valuable but deferred — reason]

---

## Out of Scope

- [Capability] — [explicit reason for exclusion]
- [Capability] — [explicit reason for exclusion]

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| (filled by roadmapper) | | |
```

**REQ-ID format:** `[CATEGORY]-[NN]` — e.g., `CORE-01`, `DATA-02`, `UX-03`, `AUTH-01`, `INFRA-01`

**Standard category prefixes:**

| Category | Prefix | Covers |
|----------|--------|--------|
| Core | CORE | Primary value delivery |
| Data | DATA | Storage, retrieval, persistence |
| User Experience | UX | Interface, navigation, feedback |
| Authentication | AUTH | Identity, access, permissions |
| Integration | INTG | External services, APIs |
| Infrastructure | INFRA | Deployment, scaling, ops |
| Performance | PERF | Speed, reliability, capacity |

**Present full requirements list (interactive mode only):**

Show every requirement for user confirmation:

```
## v1 Requirements

### [Category]
- [ ] **[CAT]-01**: [requirement]
- [ ] **[CAT]-02**: [requirement]

### [Category 2]
- [ ] **[CAT2]-01**: [requirement]

---

[N] requirements in v1, [N] deferred to v2, [N] out of scope.

Does this capture what you're building? (yes / adjust)
```

If "adjust": Return to scoping. If "yes": commit.

**Commit requirements:**

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" commit "docs: define v1 requirements" --files .planning/REQUIREMENTS.md
```

---

## 8. Create Roadmap

Display stage banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► CREATING ROADMAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning roadmapper...
```

Spawn sunco-roadmapper agent with full context:

```
Task(prompt="
<planning_context>

<files_to_read>
- .planning/PROJECT.md (Project context, constraints, core value)
- .planning/REQUIREMENTS.md (v1 Requirements with REQ-IDs)
- .planning/research/SUMMARY.md (Research findings — if exists)
- .planning/config.json (Granularity and mode settings)
</files_to_read>

${AGENT_SKILLS_ROADMAPPER}

</planning_context>

<instructions>
Create ROADMAP.md, STATE.md, and update REQUIREMENTS.md traceability:

1. Derive phases from requirements — let the requirements dictate structure, not the other way around
2. Map every v1 requirement to exactly one phase
3. Derive 3+ success criteria per phase (observable user behaviors, not implementation steps)
4. Validate 100% coverage of v1 requirements
5. Respect granularity setting from config.json (coarse/standard/fine)
6. Write files immediately — artifacts must persist even if context is lost
7. Return ## ROADMAP CREATED with summary stats

**Phase entry format:**

## Phase N: [Name]

**Goal:** [One sentence describing what this phase accomplishes]

**Requirements:**
- [CAT]-NN: [requirement text]
- [CAT]-NN: [requirement text]

**Success Criteria:**
1. [Observable user behavior — what a tester could verify]
2. [Observable user behavior]
3. [Observable user behavior]

**Complexity:** S / M / L
**Milestone:** [milestone number]

**Write files first, then return.** This ensures artifacts persist even if context is lost.
</instructions>
", subagent_type="general-purpose", model="{roadmapper_model}", description="Create roadmap")
```

### 8.1. Handle Roadmapper Return

**If `## ROADMAP BLOCKED`:**

- Present blocker information to user
- Work to resolve the blocker (usually missing requirements clarity)
- Re-spawn roadmapper with resolution context

**If `## ROADMAP CREATED`:**

Read the created ROADMAP.md and present it inline:

```
---

## Proposed Roadmap

**[N] phases** | **[X] requirements mapped** | All v1 requirements covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | [Name] | [Goal] | [REQ-IDs] | [count] |
| 2 | [Name] | [Goal] | [REQ-IDs] | [count] |
| 3 | [Name] | [Goal] | [REQ-IDs] | [count] |
...

### Phase Details

**Phase 1: [Name]**
Goal: [goal]
Requirements: [REQ-IDs]
Success criteria:
1. [criterion]
2. [criterion]
3. [criterion]

**Phase 2: [Name]**
Goal: [goal]
Requirements: [REQ-IDs]
Success criteria:
1. [criterion]
2. [criterion]
3. [criterion]

[... continue for all phases ...]

---
```

**If auto mode:** Skip approval gate — auto-approve and commit directly.

### 8.2. Roadmap Approval Gate (Interactive Mode Only)

**CRITICAL: Ask for approval before committing (interactive mode only):**

Use AskUserQuestion:

- header: "Roadmap"
- question: "Does this roadmap structure work for you?"
- options:
  - "Approve" — Commit and continue
  - "Adjust phases" — Tell me what to change
  - "Review full file" — Show raw ROADMAP.md

**If "Approve":** Continue to commit.

**If "Adjust phases":**

- Get user's adjustment notes
- Re-spawn roadmapper with revision context:

  ```
  Task(prompt="
  <revision>
  User feedback on roadmap:
  [user's notes verbatim]

  <files_to_read>
  - .planning/ROADMAP.md (Current roadmap to revise)
  - .planning/REQUIREMENTS.md (Requirements that must be covered)
  </files_to_read>

  ${AGENT_SKILLS_ROADMAPPER}

  Update the roadmap based on feedback. Edit files in place. Maintain 100% requirement coverage.
  Return ## ROADMAP REVISED with list of changes made.
  </revision>
  ", subagent_type="general-purpose", model="{roadmapper_model}", description="Revise roadmap")
  ```

- Present revised roadmap
- Loop until user approves

**If "Review full file":** Display raw `.planning/ROADMAP.md`, then re-ask.

---

## 9. Generate STATE.md

After roadmap is approved, initialize STATE.md:

```markdown
# Project State

## Current Status

**Phase:** 1 (not started)
**Milestone:** 1
**Status:** bootstrapped
**Bootstrapped:** [date]

## Active Phase

**Phase 1: [Name from ROADMAP.md]**
Goal: [goal]
Status: not started

## Decisions

(Captured during bootstrapping — see PROJECT.md Key Decisions)

## Blockers

(None)

## Session Log

| Date | Event | Notes |
|------|-------|-------|
| [date] | Bootstrapped | [N] phases, [X] requirements |
```

STATE.md is written by the roadmapper agent in Step 8. This step verifies it exists and initializes it if the roadmapper failed to create it.

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" ensure-state-md
```

---

## 10. Generate .gitignore

Generate or update `.gitignore` with standard entries:

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" generate-gitignore
```

Standard entries always included:

```
# Dependencies
node_modules/
.pnp/
.pnp.js

# Build outputs
dist/
build/
out/
*.tsbuildinfo

# Environment files
.env
.env.local
.env.*.local

# OS files
.DS_Store
Thumbs.db

# Editor files
.vscode/settings.json
.idea/
*.swp
*.swo

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Testing
coverage/
.nyc_output/
```

**Conditional — add `.planning/` if commit_docs = No:**

```
# Planning docs (local-only — not tracked in this repo)
.planning/
```

Commit `.gitignore` as part of the final atomic commit in Step 13.

---

## 11. Generate CLAUDE.md

Generate project-level `CLAUDE.md` that provides Claude Code with project context and SUNCO workflow enforcement:

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" generate-claude-md
```

The generated `CLAUDE.md` includes:

**Section 1: Project Overview**
- Project name and one-sentence description (from PROJECT.md)
- Core value statement
- Current phase and status (from STATE.md)

**Section 2: Tech Stack**
- Primary language and runtime
- Key frameworks and libraries
- Build and test tooling
- Sources from research/STACK.md if available

**Section 3: Conventions**
- File naming patterns for this project
- Code organization patterns
- Testing patterns
- Import patterns (ESM/CJS, path aliases)

**Section 4: Key Decisions**
- Architecture decisions made during bootstrapping (from PROJECT.md Key Decisions)
- Stack choices with reasoning

**Section 5: SUNCO Workflow Enforcement**

```markdown
## SUNCO Workflow

This project is managed with SUNCO. Before starting any substantial work:

1. Check current state: `/sunco:status`
2. Start work through a SUNCO command so planning artifacts stay in sync:
   - `/sunco:quick` — small fixes, doc updates, ad-hoc tasks
   - `/sunco:debug` — investigation and bug fixing
   - `/sunco:execute` — planned phase work

Do not make direct repo edits outside a SUNCO workflow unless explicitly bypassing it.

Current phase: [phase number] — [phase name]
Next step: `/sunco:discuss [phase number]`
```

This ensures new projects get workflow-enforcement guidance and current project context in every Claude Code session.

---

## 12. Final .gitignore Generation

**Only run this if Step 10 didn't already generate a complete .gitignore.** Verify:

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" verify-gitignore
```

If missing entries, add them.

---

## 13. Atomic Commit

Commit all artifacts in a single atomic commit:

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" commit "docs: create roadmap ([N] phases)" \
  --files .planning/ROADMAP.md \
          .planning/STATE.md \
          .planning/REQUIREMENTS.md \
          CLAUDE.md \
          .gitignore
```

If `commit_docs` is true, also include:

```bash
  --files .planning/PROJECT.md \
          .planning/config.json \
          .planning/research/SUMMARY.md
```

**Note on atomicity:** Earlier steps commit their artifacts individually (PROJECT.md, config.json, REQUIREMENTS.md). This final commit captures the roadmap, state, and generated project files. If anything fails before this commit, earlier artifacts are still persisted.

---

## 14. Summary Report

Present completion summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► PROJECT INITIALIZED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Project Name]

| Artifact        | Location                     |
|-----------------|------------------------------|
| Project         | .planning/PROJECT.md         |
| Config          | .planning/config.json        |
| Research        | .planning/research/          |
| Requirements    | .planning/REQUIREMENTS.md    |
| Roadmap         | .planning/ROADMAP.md         |
| State           | .planning/STATE.md           |
| Project guide   | CLAUDE.md                    |

[N] phases | [X] requirements | [Y] out of scope | Ready to build ✓

Research: [4/4 agents completed] or [N/4 — list of failed areas]
Mode: [yolo|interactive] | Granularity: [coarse|standard|fine]
```

**If auto mode:**

```
╔══════════════════════════════════════════╗
║  AUTO-ADVANCING → DISCUSS PHASE 1        ║
╚══════════════════════════════════════════╝
```

Exit skill and invoke `/sunco:discuss 1 --auto`.

**If interactive mode:**

Check if Phase 1 has UI indicators (look for `UI hint: yes` in Phase 1 detail section of ROADMAP.md):

```bash
PHASE1_SECTION=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" roadmap get-phase 1 2>/dev/null)
PHASE1_HAS_UI=$(echo "$PHASE1_SECTION" | grep -qi "UI hint.*yes" && echo "true" || echo "false")
```

**If Phase 1 has UI (`PHASE1_HAS_UI` is `true`):**

```
───────────────────────────────────────────────────────────────

## ▶ Next Up

**Phase 1: [Phase Name]** — [Goal from ROADMAP.md]

/sunco:discuss 1 — gather context and clarify approach

/clear first → fresh context window

---

**Also available:**
- /sunco:ui-phase 1 — generate UI design contract (recommended for frontend phases)
- /sunco:plan 1 — skip discussion, plan directly

───────────────────────────────────────────────────────────────
```

**If Phase 1 has no UI:**

```
───────────────────────────────────────────────────────────────

## ▶ Next Up

**Phase 1: [Phase Name]** — [Goal from ROADMAP.md]

/sunco:discuss 1 — gather context and clarify approach

/clear first → fresh context window

---

**Also available:**
- /sunco:plan 1 — skip discussion, plan directly

───────────────────────────────────────────────────────────────
```

</process>

<flags>

## Flag Reference

| Flag | Description |
|------|-------------|
| `--auto` | Auto mode — skip questions, use provided document as context |
| `--idea "..."` | Provide initial idea as argument (skips opening question) |
| `--prd @file.md` | Use existing PRD/document as idea input |
| `--no-research` | Skip research phase entirely (equivalent to always selecting "Skip research") |

**Examples:**

```bash
/sunco:new
/sunco:new --idea "A CLI tool for managing git worktrees"
/sunco:new --auto @docs/prd.md
/sunco:new --no-research
/sunco:new --auto --no-research @docs/prd.md
```

</flags>

<output>

## Output Files

| File | Description |
|------|-------------|
| `.planning/PROJECT.md` | Vision, problem, requirements, decisions, evolution rules |
| `.planning/config.json` | Workflow mode, granularity, model profile, agent settings |
| `.planning/research/STACK.md` | Recommended stack with rationale (if research enabled) |
| `.planning/research/FEATURES.md` | Table stakes vs differentiators (if research enabled) |
| `.planning/research/ARCHITECTURE.md` | Architecture patterns (if research enabled) |
| `.planning/research/PITFALLS.md` | Top risks and mitigations (if research enabled) |
| `.planning/research/SUMMARY.md` | Synthesized research decisions (if research enabled) |
| `.planning/REQUIREMENTS.md` | v1/v2 requirements with REQ-IDs and traceability |
| `.planning/ROADMAP.md` | Phases with goals, requirements, success criteria |
| `.planning/STATE.md` | Live project memory — current phase, decisions, blockers |
| `CLAUDE.md` | Project guide for Claude Code — stack, conventions, workflow enforcement |
| `.gitignore` | Standard entries + conditional .planning/ exclusion |

</output>

<success_criteria>

## Success Criteria

- [ ] `.planning/` directory created
- [ ] Git repo initialized (or already exists)
- [ ] Brownfield detection completed — offer to run `/sunco:scan` if needed
- [ ] Sub-repo detection completed — multi-repo config set if applicable
- [ ] Deep questioning completed (Socratic, max 2 rounds, non-technical) — OR auto mode used
- [ ] `PROJECT.md` captures full context → **committed**
- [ ] `config.json` has workflow mode, granularity, model profile, git branching → **committed**
- [ ] Research completed (if selected) — 4 parallel agents spawned → **committed**
- [ ] Research synthesized into `SUMMARY.md` (if research completed)
- [ ] Requirements gathered (from research or conversation)
- [ ] User scoped each category (v1 / v2 / out of scope) in interactive mode
- [ ] `REQUIREMENTS.md` created with REQ-IDs → **committed**
- [ ] `sunco-roadmapper` spawned with full context
- [ ] Roadmap files written immediately by roadmapper (not draft — artifacts persist)
- [ ] User feedback incorporated (if any) — loop until approval in interactive mode
- [ ] `ROADMAP.md` created with phases, requirement mappings, 3+ success criteria per phase
- [ ] `STATE.md` initialized with current phase = 1, status = bootstrapped
- [ ] `REQUIREMENTS.md` traceability updated by roadmapper
- [ ] `.gitignore` generated with standard entries
- [ ] `CLAUDE.md` generated with stack, conventions, workflow enforcement
- [ ] Atomic commit of all roadmap artifacts
- [ ] User knows next step is `/sunco:discuss 1`

**Atomic commits:** Each phase commits its artifacts immediately. If context is lost, artifacts persist.

**Never skip the final commit.** The roadmap is not bootstrapped until all artifacts are committed.

</success_criteria>

# New Project Bootstrap Workflow

Full flow for bootstrapping a greenfield project from raw idea through research, requirements extraction, and roadmap creation. Used by `/sunco:new`.

---

## Overview

Four phases, each building on the last:

1. **Clarify** — Ask questions until the idea is fully understood
2. **Research** — Parallel agents investigate ecosystem, competitors, architecture, and risks
3. **Extract** — Synthesize into scoped requirements (v1 / v2 / out-of-scope)
4. **Plan** — Create a roadmap with phase structure mapped to requirements

**Output files created:**
- `.planning/PROJECT.md` — vision, goals, constraints, key decisions
- `.planning/REQUIREMENTS.md` — scoped requirement list with IDs
- `.planning/ROADMAP.md` — phase structure with milestone grouping
- `.planning/STATE.md` — live project memory (current phase, decisions, blockers)

---

## Phase 1: Clarify the Idea

### Entry

If the user provided an initial idea string, use it as the seed. Otherwise ask:
> "Describe your project idea in one sentence."

### Question Categories

Ask questions across 5 categories. Stop when the idea is fully understood — aim for 5–8 questions total. Do not over-question if context is already clear from the initial idea.

**Category 1: Domain understanding**
- What type of project is this? (CLI tool / web app / API service / library / mobile app / other)
- What domain does this live in? (dev tools / fintech / infra / consumer / B2B / other)
- Is this a new product or a replacement for something existing?

**Category 2: User personas**
- Who are the target users? (describe in one sentence — e.g., "solo developers building CLI tools")
- What is their current alternative? (what do they do today?)
- What does success look like for a user in their first 10 minutes?

**Category 3: Technical constraints**
- What is the primary tech stack or language preference?
- Are there hard infrastructure constraints? (must run on X, must deploy to Y)
- Are there performance or scale requirements that affect architecture? (e.g., "must handle 10K req/s")

**Category 4: Scope boundaries**
- What should be in v1? (minimum viable — what must work on day 1)
- What should be explicitly OUT of scope for v1? (important to name explicitly)
- Is there a deadline or milestone driving the v1 scope?

**Category 5: Constraints and risks**
- Are there regulatory, compliance, or privacy constraints?
- What is the biggest technical risk or unknown?
- Is there budget or resource constraint affecting technology choice?

### Batching Option

If `--batch` flag is present, group related questions by category and present together rather than one at a time. Good for users who prefer overview-first.

### Stopping Condition

Stop asking when:
- All 5 categories have at least one answered question
- There are no remaining critical unknowns that would change architecture decisions
- User indicates they want to proceed

---

## Phase 2: Parallel Research

Skip entirely if `--no-research` flag is present.

### Research Agents (run in parallel)

Spawn 4 independent agents simultaneously using the Task tool. Each agent operates with fresh context.

**Agent 1 — Ecosystem Research**

Prompt template:
```
You are researching the ecosystem for a new project. The project is: [idea summary].
Target users: [user description]. Tech stack preference: [stack].

Research:
1. What existing libraries, frameworks, or platforms are relevant?
2. What npm packages / language packages are most downloaded for this domain?
3. What are the community standards or de-facto choices?
4. Are there any recent ecosystem shifts that would affect technology choices (last 12 months)?

Output: bullet list of relevant ecosystem context. Be specific — include package names and versions where relevant.
```

**Agent 2 — Competitor Analysis**

Prompt template:
```
You are analyzing competitors for a new project. The project is: [idea summary].
Problem being solved: [problem statement].

For each competitor or alternative:
1. Name and brief description
2. Key features
3. Key limitations / gaps
4. Pricing model (if applicable)
5. What gap they leave that this project could fill

Include both direct competitors (same category) and indirect alternatives (different approach, same problem).
Output maximum 5 competitors. Be specific.
```

**Agent 3 — Architecture Patterns**

Prompt template:
```
You are an architect advising on a new project. The project is: [idea summary].
Project type: [type]. Stack: [stack]. Scale: [scale].

Research 2-3 architectural patterns best suited for this project:
1. Pattern name
2. How it applies to this project
3. Key tradeoffs (pros/cons)
4. Which existing projects use this pattern successfully

Recommend the best-fit pattern with clear reasoning.
```

**Agent 4 — Risk Assessment**

Prompt template:
```
You are a technical risk analyst. The project is: [idea summary].
Key constraints: [constraints].

Identify the top 5 technical risks and challenges:
1. Risk name
2. Description of the risk
3. Likelihood (high/medium/low)
4. Impact if it materializes (high/medium/low)
5. Mitigation strategy

Order by (likelihood × impact).
```

### Graceful Degradation

If any agent fails or times out, continue with the remaining results. Log which agents failed. Do not block synthesis on partial research failure — the planning documents should note which research areas were incomplete.

---

## Phase 3: Extract Requirements

Using the clarification answers and research results, synthesize into three scoped buckets.

### v1 Must-Haves

Requirements that are:
- Essential for the product to be usable by target users
- Cannot be deferred without breaking the core value proposition
- Achievable within the stated timeline/resources

Format: `REQ-001: [description]` with a checkbox. Keep atomic — one behavior per requirement.

### v2 Nice-to-Haves

Requirements that are:
- Valuable but not blocking adoption
- Natural extensions of the v1 feature set
- Could be added after first user feedback

Format: same REQ-ID system, continuing from v1 numbering. Mark as `[ ]`.

### Out of Scope

Explicit exclusions. These matter as much as inclusions. Name things that users might expect but are intentionally not being built. This prevents scope creep during planning.

Format: plain bulleted list with short reasoning.

### Requirements Rules

- Each requirement must be verifiable (can write a test or check for it)
- Avoid compound requirements (split "user can X and Y" into two)
- Do not include implementation details in requirements (say what, not how)
- Aim for 5–10 v1 requirements; more signals unclear scoping

---

## Phase 4: Create Roadmap

Map requirements to phases. Each phase should be independently deliverable — it produces a working artifact, not just intermediate code.

### Phase Structure

- **1–2 phases per milestone** for focused projects
- **3–5 phases per milestone** for larger-scope projects
- Each phase maps to one or more requirements
- Phase N should not require Phase N+1 to be useful

### Milestone Grouping

Group phases into milestones. A milestone is a meaningful external checkpoint:
- Milestone 1: Working prototype (internal)
- Milestone 2: Alpha release
- Milestone 3: v1 public launch

### Phase Entry Fields

Each phase in the roadmap should document:
- **Goal** — one-sentence description of what this phase accomplishes
- **Requires** — list of REQ-IDs this phase fulfills
- **Delivers** — the artifact or feature that exists after this phase completes
- **Estimated complexity** — S / M / L

---

## Output Files

### PROJECT.md

Created from template at `packages/cli/templates/project.md`. Filled with:
- Project name, vision, problem statement
- Target users and their current alternative
- Technical constraints and key decisions made during clarify phase
- First milestone name and description

### REQUIREMENTS.md

Created from template at `packages/cli/templates/requirements.md`. Filled with:
- v1 requirements (REQ-001 through REQ-NNN)
- v2 requirements (continuing ID sequence)
- Out-of-scope list

### ROADMAP.md

Created from template at `packages/cli/templates/roadmap.md`. Filled with:
- Phase table with number, name, status, requirement coverage, description
- Milestone groupings

### STATE.md

Created from template at `packages/cli/templates/state.md`. Filled with:
- Current phase: 1 (not started)
- Status: bootstrapped
- Decisions captured during new flow
- Date bootstrapped

---

## Completion

After creating all four files, show a summary:

```
Project bootstrapped.
  Name: [project name]
  Requirements: [N] v1, [N] v2, [N] out of scope
  Phases planned: [N] across [N] milestones
  Research: [4/4 agents completed] or [N/4 — X failed]
```

Route: "Run `/sunco:discuss 1` to extract decisions for Phase 1 before planning."

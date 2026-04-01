# How to Ask Good Questions

Guide for extracting decisions and resolving ambiguity during discuss and planning flows. Applied by `/sunco:discuss`, `/sunco:new`, and any command that needs to gather context before acting.

---

## Core Principle

Ask only questions whose answers change the implementation. If an answer wouldn't affect any code path or architectural decision, don't ask it.

Good question: "Should config validation fail fast (throw on first error) or accumulate all errors before reporting?" — the answer changes the implementation.
Bad question: "Do you want good error messages?" — the answer is always yes, it changes nothing.

---

## The 5 Question Categories

Every domain has ambiguity. These 5 categories cover the dimensions that consistently matter for technical implementation.

### Category 1: Domain Understanding

What type of project, what domain, what makes it different.

**When to explore this category:**
- Starting a new project
- A phase introduces a completely new subsystem
- The requirements mention domain-specific constraints

**Sample questions:**
- "What type of project is this? CLI tool / web app / API service / library / mobile app"
- "What domain does this live in? (dev tools / fintech / infra / consumer / B2B)"
- "Is this a replacement for something existing, or net-new?"
- "What does success look like for a first-time user in their first 10 minutes?"

**What good answers unlock:** Appropriate defaults, stack choices, interface patterns.

---

### Category 2: User Personas

Who uses this, what they do today, what they expect.

**When to explore this category:**
- Designing user-facing interfaces (CLI output, error messages, prompts)
- Deciding between verbose vs. terse behavior
- Setting defaults for configuration options

**Sample questions:**
- "Who are the primary users? (1 sentence — e.g., 'solo developers building CLI tools')"
- "What is their current alternative for this task?"
- "Are they technical (comfortable with raw JSON/logs) or non-technical (need friendly output)?"
- "Is this used interactively (human watching) or in CI (automated pipeline)?"

**What good answers unlock:** Default verbosity, output format, error message tone, confirmation prompts.

---

### Category 3: Technical Constraints

Stack, infrastructure, performance, compatibility requirements.

**When to explore this category:**
- New package, new abstraction, new integration
- Unclear which library or approach to use
- Performance requirements are unstated

**Sample questions:**
- "What is the primary language / runtime? (TypeScript/Node.js assumed unless stated)"
- "Are there hard deployment constraints? (must run on X, must deploy to Y)"
- "Are there performance requirements that affect architecture? (e.g., 'must process 10K files in < 5s')"
- "Is there a browser constraint (no Node.js APIs) or a server constraint (full Node.js access)?"

**What good answers unlock:** Library choices, async strategy, data structure choices, build configuration.

---

### Category 4: Scope Boundaries

What is in v1, what is explicitly out, what is the smallest thing that would be useful.

**When to explore this category:**
- Phase goals are vague or ambitious
- The feature could be interpreted at multiple levels of completeness
- Risk of scope creep is high

**Sample questions:**
- "What is the minimum version of this feature that would be genuinely useful?"
- "What should be explicitly out of scope for this phase?"
- "Is there a deadline or milestone that constrains scope?"
- "Would a version without [enhancement] still ship? Or is it required for v1?"

**What good answers unlock:** Clear acceptance criteria, wave design, plan boundaries, release confidence.

---

### Category 5: Risk Areas

Constraints, regulations, political constraints, technical unknowns.

**When to explore this category:**
- External integrations (APIs, auth, payment)
- Data handling (PII, compliance, encryption)
- Multi-user or shared state scenarios
- Unknown technology choices

**Sample questions:**
- "Are there regulatory or compliance requirements? (GDPR, HIPAA, SOC2, PCI)"
- "What is the biggest technical unknown or risk in this approach?"
- "Is there existing code that this must not break? (integration constraint)"
- "What happens when this is unavailable or fails? (graceful degradation requirement)"

**What good answers unlock:** Error handling strategy, data validation approach, boundary checks, rollback behavior.

---

## Question Depth Levels

Not every phase needs deep questioning. Match depth to complexity.

### Surface (1 question)

Use when: Simple task, existing patterns cover most decisions.
- One blocking question that cannot be inferred
- All other decisions follow from codebase conventions

Example: "Should the new `export` command append to an existing file or always create a new one?"

### Standard (2-3 questions)

Use when: New feature, some design decisions needed, existing patterns guide most choices.
- Architecture or integration question
- Scope boundary question
- Error handling question

Example: Phase adding a new skill with options for storage, error behavior, and output format.

### Deep (5+ questions)

Use when: Greenfield project, new subsystem, significant unknowns.
- All 5 categories may need exploration
- Decisions are interdependent (answer to Q1 affects Q2)

Example: Bootstrap flow for a new project (`/sunco:new`).

---

## Gray Area Detection by Feature Type

Different feature types have predictable ambiguity hotspots.

### CLI Commands
- Output format: JSON / plain text / rich (colors, tables)
- Interactive vs. pipe-friendly
- Error behavior: exit 1 or recover?
- Flag naming: `--dry-run` vs `--preview` vs `--what-if`

### File Operations
- Overwrite behavior: error / skip / backup / force
- Path resolution: relative to cwd / to config / to home
- Permission handling: fail loudly or silently skip?
- Directory creation: auto-create or require existence?

### Config System
- Override hierarchy: which source wins?
- Missing config: error or use defaults?
- Invalid config: fail fast or partial load?
- Config location: discoverable upwards or fixed path?

### State / Persistence
- Storage backend: SQLite / flat file / memory?
- Migration: what happens on schema change?
- Concurrency: can multiple processes write simultaneously?
- Corruption recovery: what happens if state file is invalid?

### Agent / AI Integration
- Fallback: what happens when the model is unavailable?
- Cost control: is there a token budget?
- Output format: structured JSON or free text?
- Timeout: how long to wait before failing?

### Testing Features
- Test isolation: shared state or clean per test?
- Mocking: what needs to be mocked vs real?
- Coverage threshold: blocking or informational?
- Slow tests: parallel execution or sequential?

---

## Question Format

For every question, use the structured option format:

```
[Gray area — 1 sentence describing the decision needed]

Options:
  A) [Option A] — [1-sentence tradeoff: pro and con]
  B) [Option B] — [1-sentence tradeoff: pro and con] (Recommended)
  C) Other: [describe what you want]
```

Rules:
- Mark exactly one option as `(Recommended)` — choose based on project context
- If the project has established patterns (readable from CLAUDE.md or codebase), align the recommendation with them
- Options should be concrete, not vague
- Tradeoffs should be honest — do not bias toward a preferred answer

---

## Anti-Patterns

These question patterns produce noise, not signal. Avoid them.

### Leading questions
Bad: "You probably want to use TypeScript here, right?"
Good: "Which language for this module? TypeScript / JavaScript / Python"

### Yes/no when open-ended is better
Bad: "Do you want error handling?"
Good: "When config parsing fails, should the CLI error immediately or continue with defaults?"

### Implementation-level questions
Bad: "Should I use a Map or an object for the registry?"
Good: (don't ask — this is an implementation detail, decide based on context)

### Already-answered questions
Bad: Asking about tech stack when PROJECT.md already specifies TypeScript
Good: Read PROJECT.md first, only ask when genuinely unspecified

### Over-questioning
Bad: 8 questions for a 2-task phase
Good: 2 targeted questions for a 2-task phase

### Compound questions
Bad: "What should the output format be and how should errors be shown and what's the default verbosity?"
Good: One question per decision point

---

## Batching Mode (--batch)

When `--batch` is specified, group related questions by category and present them together:

```
**Architecture questions (2):**

1. Config storage: file-based or in-memory?
   A) File-based (.sun/state.json) — persists across runs, slower reads
   B) In-memory — faster, resets on process exit (Recommended for now)

2. Config format: TOML or JSON?
   A) TOML — human-editable, project convention (Recommended)
   B) JSON — machine-friendly, easier to parse
```

Good for: users who prefer to see the full picture before answering.
Not good for: interdependent questions where answer 1 affects the options for answer 2.

---

## Advisor Mode

Advisor mode activates when the user's profile tier is Expert or Principal and the phase is non-trivial. Instead of asking questions and waiting for answers, SUNCO states its interpretation and inferences, then asks the user to confirm or correct.

**Standard mode flow:**
```
SUNCO: "Should the registry validate skill IDs before storing?"
User: "Yes"
SUNCO: "Should it throw or return an error object?"
User: "Throw"
```

**Advisor mode flow:**
```
SUNCO: "My read: Registry validates IDs (non-empty string check), throws
SkillConflictError on duplicate, throws InvalidSkillError on empty ID.
Storing in Map<string, Skill> for O(1) lookup. Anything to correct?"
User: "Looks right, but use InvalidIdError, not InvalidSkillError"
```

Advisor mode reduces turns by front-loading interpretation. The tradeoff: SUNCO may interpret incorrectly and the user must catch errors in the interpretation rather than being guided through each decision.

### When to use advisor mode

- User profile tier is Expert or Principal
- `/sunco:discuss --advisor` flag is set explicitly
- Phase is an incremental extension of an established pattern in the codebase

### When to avoid advisor mode

- Genuinely novel architecture decisions
- User profile tier is Guided or Standard
- The phase introduces a pattern not yet present in the codebase

---

## Calibration Tiers and Question Depth

User profile tiers (from `user-profiling.md`) directly control how many questions `/sunco:discuss` asks per phase.

### Tier 1: Guided — Maximum question depth

Target: 5-8 questions per discuss session.

- Ask all 5 categories for any phase larger than a single task
- Explain the tradeoff for each option in 1-2 sentences
- Add "why we're asking" context above each question
- Provide a clear recommendation with rationale

```
**Config validation approach**
[Why we're asking: Config parsing happens before any agent runs. If we
choose wrong here, every downstream skill is affected.]

When a required config field is missing, should SUNCO:
  A) Fail immediately with an error pointing to the missing field — fastest
     feedback, but shows only one error at a time
  B) Collect all validation errors and report them together — more work for
     first-time setup, but user sees everything at once (Recommended)
  C) Use default values for missing required fields — most forgiving, but
     hides misconfiguration silently
```

---

### Tier 2: Standard — Normal question depth

Target: 3-5 questions per discuss session.

- Ask categories 2-4 (user personas, technical constraints, scope)
- Explain tradeoffs briefly (1 sentence)
- Skip "why we're asking" context
- Mark recommendation clearly

```
Config validation approach:
  A) Fail on first error
  B) Collect all errors, report together (Recommended)
  C) Use defaults for missing fields
```

---

### Tier 3: Expert — Minimal question depth

Target: 1-3 questions per discuss session.

- Ask only genuinely blocking questions
- Options with no explanation (expert understands the tradeoffs)
- State the recommendation without justification

```
Config validation: fail-fast (A), collect-all (B, recommended), or defaults (C)?
```

---

### Tier 4: Principal — Near-zero question depth

Target: 0-1 questions per discuss session.

- Apply all inferrable defaults automatically without asking
- Only stop for decisions with no clear best answer
- State what was decided, invite corrections

```
Proceeding with: collect-all validation, TOML format, fail on unknown keys.
Anything to change?
```

---

## Batch Patterns by Category

When batching questions (--batch flag or advisor mode), group questions by dependency, not by category. Ask independent questions together. Ask dependent questions sequentially.

### Independent questions (safe to batch)

Questions whose answers do not affect each other's options:
- Output format (JSON vs. plain text)
- Error behavior (fail fast vs. collect all)
- File overwrite behavior (error vs. backup vs. force)

### Dependent questions (must be sequential)

Questions where the answer to Q1 changes the options for Q2:
- Storage backend choice → then ask about migration strategy
- Error behavior choice → then ask about error message format
- Auth provider choice → then ask about session handling

**Rule:** If question 2 mentions "depending on your answer to question 1", the questions are dependent. Present them sequentially.

---

## Question Recycling

If the user's answer to a question is unclear or incomplete, ask a follow-up before moving on. Do not interpret ambiguous answers liberally and proceed — this leads to rework.

### Ambiguous answer patterns

| User answer | Interpretation problem | Follow-up |
|-------------|----------------------|-----------|
| "Yes" to a multi-option question | Which option? | "Did you mean option A or B?" |
| "Default" | Confirms the recommendation, or wants us to choose? | Almost always means "recommended" — proceed with recommended option |
| "Whatever works" | No constraint given | Proceed with recommended option, note the decision |
| "Both" to an either/or question | Wants a hybrid | "Walk me through what 'both' looks like for you" |
| One-word answer to a complex question | May be shorthand or dismissal | Proceed with most charitable interpretation, note it |

The goal is to resolve ambiguity in the discuss phase, not during execution. One clarifying follow-up is acceptable. Two clarifying follow-ups on the same question signals a poorly formed question — rephrase it.

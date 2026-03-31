# SUNCO Configuration Schema Reference

## 1. Overview

SUNCO project configuration lives in `.planning/config.json` at the root of your project. This file controls how every SUNCO command behaves — from how aggressively agents run to whether git branches are created automatically.

**Location:** `.planning/config.json`

**Format:** JSON (human-editable)

**How to edit:**
- **Recommended:** `/sunco:settings --set <key>=<value>` — writes to the correct level and validates the value
- **Direct:** Edit `.planning/config.json` with any text editor — changes take effect on the next command

**Config hierarchy** (highest precedence wins):
```
Directory config  (.sun/local.toml)      ← current directory, highest precedence
Project config    (.sun/config.toml)     ← this project
Global config     (~/.sun/config.toml)   ← all projects, lowest precedence
```

`.planning/config.json` stores the project-level runtime state for the planning workflow. The TOML configs above govern the harness (lint rules, health thresholds, UI adapter settings).

---

## 2. Top-Level Settings

### `mode`

Controls how much autonomy agents have during execution.

| Value | Description |
|-------|-------------|
| `"yolo"` | Agents proceed without asking for confirmation. No interruption prompts. Fastest. |
| `"interactive"` | Agents pause at key decision points and ask for confirmation before proceeding. |

**Default:** `"interactive"`
**Current project default:** `"yolo"`

**When to use `"yolo"`:** Trusted phases, CI/CD pipelines, or when you have high confidence in the plans.
**When to use `"interactive"`:** Ambiguous phases, large blast radius, or whenever you want a human in the loop.

```json
{ "mode": "yolo" }
```

---

### `granularity`

Controls how finely agents decompose work and how many subtasks they create per plan.

| Value | Description |
|-------|-------------|
| `"coarse"` | Fewer, larger tasks per plan. Faster but higher risk of agents drifting. Good for experienced agents on well-understood problems. |
| `"standard"` | Balanced task decomposition. The recommended default for most projects. |
| `"fine"` | Maximum decomposition. Each task is small and tightly scoped. Slower but produces the most verifiable output and the cleanest commit history. |

**Default:** `"standard"`
**Current project default:** `"fine"`

Granularity affects:
- Number of tasks per plan (coarse: 2–3, standard: 3–5, fine: 5–8)
- Acceptance criteria detail level
- Commit frequency (fine produces more atomic commits)

```json
{ "granularity": "fine" }
```

---

### `profile` (also stored as `model_profile`)

Controls which AI model is used at each stage of the pipeline.

| Value | Plan agent | Execute agents | Verify agents | Cost |
|-------|-----------|----------------|---------------|------|
| `"quality"` | Opus | Opus | Opus | Highest |
| `"balanced"` | Opus | Sonnet | Sonnet | Medium |
| `"budget"` | Sonnet | Sonnet | Haiku | Lowest |
| `"inherit"` | Follow runtime model | Follow runtime model | Follow runtime model | Varies |

**Default:** `"balanced"`
**Current project default:** `"quality"`

`"inherit"` means SUNCO does not override the model — it uses whatever model the agent runtime selects (e.g., the model active in your Claude Code session).

**Tip:** Use `"quality"` for planning phases where getting the architecture right matters most. Switch to `"balanced"` for execution-heavy phases to reduce cost.

Manage with: `/sunco:profile`

```json
{ "profile": "balanced" }
```

---

### `resolve_model_ids`

Controls whether agent model IDs are resolved to their canonical names in output and logs.

| Value | Description |
|-------|-------------|
| `"omit"` | Do not display model IDs in output. Cleaner output. |
| `"show"` | Display the resolved model ID (e.g., `claude-opus-4-5`) alongside each agent invocation. |

**Default:** `"omit"`

```json
{ "resolve_model_ids": "omit" }
```

---

### `parallelization`

Top-level flag controlling whether agents can run in parallel waves.

**Type:** `boolean`
**Default:** `true`

When `true`, plans within the same wave are executed simultaneously using parallel agents. When `false`, all plans run sequentially regardless of wave assignment — useful for debugging or quota-constrained environments.

```json
{ "parallelization": true }
```

---

### `search_gitignored`

Controls whether research agents search inside gitignored files and directories.

**Type:** `boolean`
**Default:** `false`

Set to `true` if your project stores relevant reference material in gitignored paths (e.g., `.cache/`, vendor copies, or generated documentation).

```json
{ "search_gitignored": false }
```

---

### `brave_search`, `firecrawl`, `exa_search`

Feature flags for external search integrations during research phases.

| Key | Description |
|-----|-------------|
| `brave_search` | Enable Brave Search API for web research during `/sunco:research` and `/sunco:plan` |
| `firecrawl` | Enable Firecrawl for web page extraction during research |
| `exa_search` | Enable Exa semantic search during research |

**Type:** `boolean`
**Default:** All `false`

All three require API keys configured in your environment. When `false`, research agents rely only on the local codebase and agent knowledge.

```json
{
  "brave_search": false,
  "firecrawl": false,
  "exa_search": false
}
```

---

## 3. Workflow Settings

The `workflow` object controls the behavior of the planning pipeline — which steps run, how they run, and what safety gates are enforced.

```json
{
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true,
    "auto_advance": false,
    "node_repair": true,
    "node_repair_budget": 2,
    "ui_phase": true,
    "ui_safety_gate": true,
    "text_mode": false,
    "research_before_questions": false,
    "discuss_mode": "discuss",
    "skip_discuss": false,
    "lint_gate": true,
    "blast_radius": true,
    "health_gate": false,
    "_auto_chain_active": true
  }
}
```

---

### `workflow.research`

Enables parallel research agents during `/sunco:plan`. Research agents investigate implementation approaches before plans are written.

**Type:** `boolean`
**Default:** `true`

When `true`, `/sunco:plan` spawns a research agent to investigate approaches and writes `[N]-RESEARCH.md` before decomposing tasks. When `false`, planning proceeds directly from CONTEXT.md without research — equivalent to passing `--skip-research` to every plan invocation.

**Impact:** Disabling research speeds up planning but increases the risk of plans based on incorrect assumptions about available libraries or patterns.

```json
{ "workflow": { "research": true } }
```

---

### `workflow.plan_check`

Enables the plan verification loop inside `/sunco:plan`. Plans are verified against REQUIREMENTS.md before being finalized.

**Type:** `boolean`
**Default:** `true`

When `true`, each generated plan is checked against: requirements coverage, scope alignment, completeness of acceptance criteria, dependency correctness, and lint gate inclusion. The loop runs up to 3 iterations. When `false`, plans are written directly without verification — equivalent to passing `--skip-verify` to every plan invocation.

**Impact:** Disabling plan_check significantly increases the risk of plans that miss requirements or have vague acceptance criteria.

```json
{ "workflow": { "plan_check": true } }
```

---

### `workflow.verifier`

Enables the 6-layer Swiss cheese verification step after execute.

**Type:** `boolean`
**Default:** `true`

When `true`, `/sunco:execute` routes to `/sunco:verify` after all plans complete. When `false`, execution completes without running verification layers — equivalent to skipping `/sunco:verify` entirely.

**Impact:** Disabling verification removes the safety net for catching implementation drift, security issues, and unmet acceptance criteria. Only disable for trivial hotfixes.

```json
{ "workflow": { "verifier": true } }
```

---

### `workflow.nyquist_validation`

Enables Nyquist sampling validation — a deterministic check that ensures plans cover at least a minimum density of requirements relative to phase complexity.

**Type:** `boolean`
**Default:** `true`

Named after the Nyquist theorem: if you sample (check) at less than twice the signal rate, you miss things. Applied here: plan coverage must meet a minimum threshold proportional to the number of requirements in the phase. Violations are flagged before planning completes.

```json
{ "workflow": { "nyquist_validation": true } }
```

---

### `workflow.auto_advance`

Automatically advances to the next phase after successful verification, without asking for confirmation.

**Type:** `boolean`
**Default:** `false`

When `true`, after `/sunco:verify` passes all layers, the system automatically marks the phase complete in STATE.md and begins the next phase (discuss → plan → execute → verify). Used by `/sunco:auto` internally. Setting this to `true` manually enables fully autonomous multi-phase execution without the loop overhead of `/sunco:auto`.

**Warning:** Only enable when you have high confidence in the roadmap and want zero-interrupt operation.

```json
{ "workflow": { "auto_advance": false } }
```

---

### `workflow.node_repair`

Enables automatic repair of broken planning graph nodes after execution.

**Type:** `boolean`
**Default:** `true`

When a plan execution leaves a PLAN.md without a corresponding SUMMARY.md, that node is "broken" in the planning graph. With `node_repair: true`, the system attempts to re-execute the failed plan automatically before flagging an error. Maximum retry attempts are controlled by `node_repair_budget`.

```json
{ "workflow": { "node_repair": true } }
```

---

### `workflow.node_repair_budget`

Maximum number of automatic repair attempts per broken node.

**Type:** `integer`
**Default:** `2`
**Valid range:** `0` to `5`

When a plan fails and `node_repair` is enabled, the system retries up to this many times before giving up and asking the user. Setting to `0` effectively disables node_repair even if `node_repair: true`.

```json
{ "workflow": { "node_repair_budget": 2 } }
```

---

### `workflow.ui_phase`

Enables UI design contract generation before implementation phases that contain frontend work.

**Type:** `boolean`
**Default:** `true`

When `true`, phases detected as containing UI work trigger `/sunco:ui-phase` to generate a `UI-SPEC.md` design contract before planning. When `false`, UI phases proceed directly to implementation without a design contract.

```json
{ "workflow": { "ui_phase": true } }
```

---

### `workflow.ui_safety_gate`

Requires UI-SPEC.md to exist before agents write frontend code in UI phases.

**Type:** `boolean`
**Default:** `true`

When `true`, `/sunco:execute` blocks execution of UI-containing plans if no `UI-SPEC.md` is present in the phase directory. This ensures UI implementation is always grounded in a design contract. When `false`, agents can write UI code without a design contract.

**Only relevant when `workflow.ui_phase` is `true`.**

```json
{ "workflow": { "ui_safety_gate": true } }
```

---

### `workflow.text_mode`

Forces all agent output to plain text, disabling structured JSON and XML output formats.

**Type:** `boolean`
**Default:** `false`

When `true`, agents produce human-readable prose output instead of structured data. Useful for debugging agent behavior or when piping output to tools that do not handle ANSI or structured output. Not recommended for production use — structured output enables state persistence and recommender integration.

```json
{ "workflow": { "text_mode": false } }
```

---

### `workflow.research_before_questions`

Makes agents research the codebase before asking clarifying questions during `/sunco:discuss`.

**Type:** `boolean`
**Default:** `false`

When `true`, the discuss agent reads relevant source files and existing patterns before surfacing questions. This results in more informed questions and reduces "obvious" questions that the codebase already answers. When `false`, questions are generated from the phase spec alone.

**Trade-off:** Enabling costs additional context reads before each question round but produces higher-quality questions.

```json
{ "workflow": { "research_before_questions": false } }
```

---

### `workflow.discuss_mode`

Default mode for `/sunco:discuss` when no `--mode` flag is passed.

| Value | Description |
|-------|-------------|
| `"discuss"` | Interactive discussion mode. Agent asks questions one at a time (or batched). Human answers drive CONTEXT.md. |
| `"assumptions"` | Assumptions mode. Agent reads the codebase and surfaces what it would assume, without asking questions. Human reviews and corrects assumptions. |

**Default:** `"discuss"`

`"assumptions"` mode is faster and works well for experienced teams with consistent codebases. `"discuss"` mode is more thorough and appropriate for novel problems or junior team members.

```json
{ "workflow": { "discuss_mode": "discuss" } }
```

---

### `workflow.skip_discuss`

Skips the discuss phase entirely. Agents proceed directly from the phase spec to planning without CONTEXT.md.

**Type:** `boolean`
**Default:** `false`

When `true`, `/sunco:plan` does not require CONTEXT.md and will not prompt to run `/sunco:discuss`. Use for rapid iteration on well-understood phases or when the phase spec is detailed enough to be self-contained.

**Risk:** Missing CONTEXT.md increases the probability of plans based on wrong assumptions, requiring more node repairs or re-plans.

```json
{ "workflow": { "skip_discuss": false } }
```

---

### `workflow.lint_gate` [SUNCO-ONLY]

Mandatory architecture lint check after every plan completes during `/sunco:execute`.

**Type:** `boolean`
**Default:** `true`

This is a SUNCO-exclusive feature not present in GSD. When `true`, ESLint + TypeScript type-check runs after each individual plan completes — not just after all plans in a phase. If lint fails, execution stops and the user is prompted to fix, skip (with warning), or abort.

**The lint-gate is the primary mechanism that prevents architectural debt from accumulating across waves.** Disabling it means lint errors from Plan 1 can compound into Plan 2 and Plan 3 before detection.

**Disabling is strongly discouraged.** Only disable temporarily during debugging.

```json
{ "workflow": { "lint_gate": true } }
```

---

### `workflow.blast_radius` [SUNCO-ONLY]

Runs a dependency graph analysis before any execution begins, identifying files that transitively depend on files being modified.

**Type:** `boolean`
**Default:** `true`

This is a SUNCO-exclusive feature not present in GSD. When `true`, `/sunco:execute` reads the code dependency graph (built by `/sunco:graph`) before the first wave and computes the blast radius — how many files outside the plan scope would be affected by the planned changes.

**Risk thresholds:**
- Blast radius > 10 files: HIGH RISK — user confirmation required
- Blast radius > 3 files touching public interfaces: MEDIUM RISK — warning shown

When `false`, execution proceeds without blast radius analysis. Suitable for phases modifying isolated leaf modules with no shared dependents.

```json
{ "workflow": { "blast_radius": true } }
```

---

### `workflow.health_gate` [SUNCO-ONLY]

Enforces a minimum health score before execution can proceed.

**Type:** `boolean | number`
**Default:** `false`

This is a SUNCO-exclusive feature not present in GSD. When `false`, no health check is performed before execution. When set to `true`, the default minimum score of `60` is enforced. When set to a number (e.g., `75`), that score is the minimum threshold.

**Examples:**
```json
{ "workflow": { "health_gate": false } }    // disabled
{ "workflow": { "health_gate": true } }     // minimum score: 60
{ "workflow": { "health_gate": 75 } }       // minimum score: 75
```

If the health score (computed by `/sunco:health`) is below the threshold, `/sunco:execute` stops and surfaces the top health issues before proceeding. Use during CI/CD or on codebases with strict quality standards.

---

### `workflow._auto_chain_active`

Internal flag indicating an active `/sunco:auto` pipeline is running.

**Type:** `boolean`
**Default:** `true` (set automatically by `/sunco:auto`)

**Do not set this manually.** This flag is written by `/sunco:auto` when it begins and cleared when it completes or pauses. It is used internally to suppress certain interactive prompts that would otherwise pause the autonomous loop.

---

## 4. Git Settings

The `git` object controls automatic branch management during the planning workflow.

```json
{
  "git": {
    "branching_strategy": "none",
    "phase_branch_template": "sunco/phase-{phase}-{slug}",
    "milestone_branch_template": "sunco/{milestone}-{slug}",
    "quick_branch_template": null
  }
}
```

---

### `git.branching_strategy`

Controls when SUNCO automatically creates git branches.

| Value | Description |
|-------|-------------|
| `"none"` | No automatic branch creation. You manage branches manually. |
| `"phase"` | A new branch is created before each phase execution and merged (or PR'd) after verification passes. |
| `"milestone"` | A new branch is created at the start of each milestone and spans all phases within it. |

**Default:** `"none"`

**`"phase"` strategy** — Each phase gets its own branch, e.g., `sunco/phase-3-skill-loader`. After `/sunco:verify` passes, the branch is merged back or a PR is created via `/sunco:ship`. Best for teams with per-phase code review requirements.

**`"milestone"` strategy** — All phases within a milestone share one branch, e.g., `sunco/m2-alpha-release`. The branch persists until the milestone is marked complete. Best for solo developers who want to group related work.

```json
{ "git": { "branching_strategy": "phase" } }
```

---

### `git.phase_branch_template`

Template string for branch names when `branching_strategy` is `"phase"`.

**Type:** `string`
**Default:** `"sunco/phase-{phase}-{slug}"`

**Placeholders:**
| Placeholder | Resolves to |
|-------------|-------------|
| `{phase}` | Phase number (e.g., `3`) |
| `{slug}` | Kebab-case slug of the phase name (e.g., `skill-loader`) |
| `{date}` | ISO date (e.g., `2026-03-31`) |
| `{milestone}` | Current milestone name slug |

**Examples:**
```json
"phase_branch_template": "sunco/phase-{phase}-{slug}"
// → sunco/phase-3-skill-loader

"phase_branch_template": "feat/{phase}-{slug}"
// → feat/3-skill-loader

"phase_branch_template": "{milestone}/phase-{phase}"
// → m2-alpha/phase-3
```

---

### `git.milestone_branch_template`

Template string for branch names when `branching_strategy` is `"milestone"`.

**Type:** `string`
**Default:** `"sunco/{milestone}-{slug}"`

**Placeholders:** Same as `phase_branch_template`.

**Examples:**
```json
"milestone_branch_template": "sunco/{milestone}-{slug}"
// → sunco/m2-alpha-release

"milestone_branch_template": "release/{milestone}"
// → release/m2-alpha
```

---

### `git.quick_branch_template`

Template string for branches created by `/sunco:quick` tasks.

**Type:** `string | null`
**Default:** `null`

When `null`, quick tasks do not create branches (they commit directly to the current branch). Set to a template string to enable branch creation for quick tasks.

```json
"quick_branch_template": "quick/{slug}"
// → quick/fix-null-check
```

---

## 5. Parallelization Settings

```json
{
  "parallelization": { "enabled": true }
}
```

> **Note:** In the current config format, `parallelization` is stored as a flat boolean (`"parallelization": true`) rather than the object form shown above. Both forms are accepted.

### `parallelization.enabled`

Master switch for parallel agent execution.

**Type:** `boolean`
**Default:** `true`

When `true`, plans in the same wave are spawned simultaneously. When `false`, all plans run sequentially in wave order, regardless of dependencies.

**Use `false` when:**
- Debugging execution failures and you need sequential output
- Running in a quota-constrained environment where simultaneous API calls would hit rate limits
- Running on a machine with limited memory and parallel agents cause swapping

```json
{ "parallelization": true }
```

---

## 6. Planning Settings

```json
{
  "planning": {
    "commit_docs": true
  }
}
```

> **Note:** In the current config format, `commit_docs` is stored at the top level (`"commit_docs": true`). The nested `planning` form is the canonical target structure.

### `planning.commit_docs` / `commit_docs`

Automatically commits planning artifacts (CONTEXT.md, PLAN.md, RESEARCH.md, SUMMARY.md, VERIFICATION.md) after each step that writes them.

**Type:** `boolean`
**Default:** `true`

When `true`, every planning artifact is committed to git immediately after being written. This creates a full audit trail of the planning process in the git history. When `false`, planning artifacts are written to disk but not committed — you commit them manually.

**Benefits of `true`:**
- Planning history is preserved in git
- Easy to `git diff` to see how a plan evolved
- Crash recovery: lost in-memory state can be reconstructed from git

**Benefits of `false`:**
- Cleaner git history (planning noise excluded)
- Useful when planning artifacts are gitignored

```json
{ "commit_docs": true }
```

---

## 7. Hooks Settings

```json
{
  "hooks": {
    "context_warnings": true
  }
}
```

### `hooks.context_warnings`

Enables pre-execution warnings when context window utilization is high.

**Type:** `boolean`
**Default:** `true`

When `true`, SUNCO monitors context window size during long-running operations. If context utilization exceeds 80%, a warning is surfaced before spawning additional agents. This prevents agents from operating with degraded context (which produces lower-quality output) without the user being aware.

When `false`, no context warnings are shown. Agents run without context size monitoring.

```json
{ "hooks": { "context_warnings": true } }
```

---

## 8. Agent Skills

```json
{
  "agent_skills": {}
}
```

### `agent_skills`

Injects specific skills or context into named agent roles during execution.

**Type:** `object`
**Default:** `{}`

Keys are agent role names; values are arrays of skill IDs or context snippets to inject into that agent's initial context.

**Agent roles** (internal names used by SUNCO):
| Role key | Used by |
|----------|---------|
| `"planner"` | `/sunco:plan` research and decomposition agent |
| `"executor"` | `/sunco:execute` per-plan execution agents |
| `"reviewer"` | `/sunco:verify` Layer 1 review agents |
| `"adversarial"` | `/sunco:verify` Layer 5 adversarial agent |
| `"researcher"` | `/sunco:research` and `/sunco:plan` research agents |

**Example — inject domain context into executor agents:**
```json
{
  "agent_skills": {
    "executor": ["@packages/core/src/types/index.ts", "@CLAUDE.md"],
    "reviewer": ["@packages/core/src/types/index.ts"]
  }
}
```

**Example — inject a reference document into the planner:**
```json
{
  "agent_skills": {
    "planner": ["@packages/cli/references/harness-rules.md"]
  }
}
```

Paths prefixed with `@` are resolved relative to the project root and their contents are injected into the agent's system prompt. Paths without `@` are treated as skill IDs.

---

## 9. SUNCO-Only Settings

These settings are exclusive to SUNCO and have no equivalent in GSD. They form the core of SUNCO's harness engineering approach — deterministic enforcement that runs at zero LLM cost.

### Summary table

| Setting | Default | What it does |
|---------|---------|--------------|
| `workflow.lint_gate` | `true` | ESLint + tsc after EACH plan, not just at the end of a phase |
| `workflow.blast_radius` | `true` | Dependency graph check before any execution begins |
| `workflow.health_gate` | `false` | Minimum health score required to proceed with execution |
| `workflow.nyquist_validation` | `true` | Minimum plan coverage density relative to phase complexity |
| `workflow.ui_safety_gate` | `true` | Blocks UI implementation without a UI-SPEC.md contract |

### Why these matter

Standard planning tools (including GSD) run lint once at the end. SUNCO's `lint_gate` runs after every individual plan. This means:
- A lint error introduced in Plan 1 is caught before Plan 2 begins
- Plans cannot build on top of broken code
- The final phase has a much higher probability of being clean on the first try

`blast_radius` addresses the "unexpected breakage" problem: agents routinely change files they did not explicitly plan to change. The blast radius check reveals this risk before execution, not after.

`health_gate` prevents execution from compounding a degraded codebase. If the project is already at a health score of 45 before a phase begins, adding more code without fixing the root issues will push it further down.

---

## 10. Examples

### Conservative — maximum safety, human in the loop

For production codebases, high-stakes phases, or team environments where every change needs review.

```json
{
  "mode": "interactive",
  "granularity": "fine",
  "profile": "quality",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true,
    "auto_advance": false,
    "discuss_mode": "discuss",
    "skip_discuss": false,
    "lint_gate": true,
    "blast_radius": true,
    "health_gate": 70
  },
  "git": {
    "branching_strategy": "phase",
    "phase_branch_template": "sunco/phase-{phase}-{slug}"
  },
  "parallelization": true,
  "commit_docs": true,
  "hooks": { "context_warnings": true }
}
```

---

### Fast — autonomous, cost-efficient, for trusted phases

For solo developers iterating quickly on well-understood problems where the phase spec is clear and the codebase is stable.

```json
{
  "mode": "yolo",
  "granularity": "standard",
  "profile": "balanced",
  "workflow": {
    "research": false,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true,
    "auto_advance": true,
    "discuss_mode": "assumptions",
    "skip_discuss": false,
    "lint_gate": true,
    "blast_radius": true,
    "health_gate": false
  },
  "git": {
    "branching_strategy": "none"
  },
  "parallelization": true,
  "commit_docs": true,
  "hooks": { "context_warnings": false }
}
```

---

### CI mode — headless, strict, no human intervention

For automated pipelines (GitHub Actions, etc.) where SUNCO runs unattended. All safety gates on, zero interactive prompts.

```json
{
  "mode": "yolo",
  "granularity": "standard",
  "profile": "budget",
  "workflow": {
    "research": false,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true,
    "auto_advance": true,
    "discuss_mode": "assumptions",
    "skip_discuss": true,
    "lint_gate": true,
    "blast_radius": true,
    "health_gate": 60
  },
  "git": {
    "branching_strategy": "milestone",
    "milestone_branch_template": "ci/{milestone}-{slug}"
  },
  "parallelization": true,
  "commit_docs": true,
  "hooks": { "context_warnings": false }
}
```

**CI mode notes:**
- `skip_discuss: true` — no CONTEXT.md required; agents proceed from phase spec
- `profile: "budget"` — Haiku for verification keeps CI costs low
- `health_gate: 60` — CI fails if codebase health drops below 60
- Run with: `npx popcoru headless --phase <N>` or `/sunco:headless`

---

### Debugging — sequential, verbose, no parallel agents

For investigating execution failures where parallel output makes it hard to trace what happened.

```json
{
  "mode": "interactive",
  "granularity": "fine",
  "profile": "balanced",
  "workflow": {
    "research": false,
    "plan_check": false,
    "verifier": false,
    "nyquist_validation": false,
    "auto_advance": false,
    "discuss_mode": "discuss",
    "skip_discuss": false,
    "lint_gate": true,
    "blast_radius": false,
    "health_gate": false,
    "text_mode": true
  },
  "git": {
    "branching_strategy": "none"
  },
  "parallelization": false,
  "commit_docs": false,
  "hooks": { "context_warnings": true }
}
```

**Debugging mode notes:**
- `parallelization: false` — sequential execution, clean stdout
- `text_mode: true` — plain prose output, no structured JSON
- `verifier: false` / `plan_check: false` — skip pipeline steps to isolate the failure
- `commit_docs: false` — do not pollute git history while debugging

# Discuss Phase Assumptions Workflow

Deep codebase reading before surfacing assumptions. The agent reads the codebase, the phase spec, and existing context — then exposes what it would assume vs what genuinely needs user input. Each assumption is rated safe/risky/unknown with evidence. User confirms or overrides. Confirmed assumptions are written to CONTEXT.md.

Used by `/sunco:assume`.

---

## Core Principle

Most assumptions are safe. The goal is not to ask about everything — it is to surface the risky ones before they cause expensive rework. The agent reads deeply first, derives as many safe assumptions as possible from evidence, and only surfaces the ones that are genuinely ambiguous or high-stakes.

If everything can be derived from code evidence, the agent writes CONTEXT.md automatically and explains what it assumed. The user reviews, not approves line-by-line.

Responsibility chain:

```
parse_args → load_phase_spec → read_codebase_deep
→ derive_assumptions → classify_assumptions
→ surface_risky_assumptions → collect_user_input
→ merge_confirmed_assumptions → write_context
→ commit_context → display_summary
```

---

## Step 1: parse_args

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First positional | `PHASE_ARG` | — (required) |
| `--silent` | `SILENT` | false |
| `--all` | `SHOW_ALL` | false |
| `--no-commit` | `NO_COMMIT` | false |

Rules:
- `PHASE_ARG` required → error: "Usage: /sunco:assume <phase>. Run /sunco:status to see phases."
- `--silent` → derive all assumptions from evidence only, skip user interaction, write CONTEXT.md automatically
- `--all` → surface all assumptions (safe + risky + unknown), not just risky ones
- `--no-commit` → write CONTEXT.md but do not commit

---

## Step 2: load_phase_spec

Load the phase specification from ROADMAP.md:

```bash
PHASE_DETAIL=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" roadmap get-phase "${PHASE_ARG}")
if [[ "$PHASE_DETAIL" == @file:* ]]; then PHASE_DETAIL=$(cat "${PHASE_DETAIL#@file:}"); fi
```

Parse: `phase_number`, `phase_name`, `goal`, `requirements`, `success_criteria`, `phase_dir`, `phase_slug`.

Read any existing context:

```bash
EXISTING_CONTEXT=""
CONTEXT_FILE="${PHASE_DIR}/${PADDED_PHASE}-CONTEXT.md"
[ -f "${CONTEXT_FILE}" ] && EXISTING_CONTEXT=$(cat "${CONTEXT_FILE}")
```

If CONTEXT.md already exists → display:

```
CONTEXT.md already exists for phase {N}.
Use --force to regenerate, or run /sunco:discuss {N} to extend it.
```

Exit unless `--force` flag is present.

Load project baseline:

```bash
cat .planning/PROJECT.md 2>/dev/null || true
cat .planning/STATE.md 2>/dev/null || true
```

---

## Step 3: read_codebase_deep

This is the most important step. Read broadly before forming any assumptions.

**Read in this order:**

1. **Package structure**: `ls packages/*/src/` — understand what exists
2. **Existing implementations**: Read 3-5 source files most relevant to the phase goal
3. **Test files**: Read `__tests__/` for any existing test patterns and conventions
4. **Config files**: `package.json`, `tsconfig.json`, `.eslintrc` / `eslint.config.mjs`, `vitest.config.ts`
5. **Previous phase summaries**: `${PHASE_DIR}/../*-SUMMARY.md` (sibling phases) for context on decisions already made
6. **CLAUDE.md**: Re-read conventions section for patterns that apply to this phase

Document what you observe:

```
Codebase observations:
- Import style: ESM with .js extensions
- Test runner: Vitest 4.x, in-source colocation pattern
- Error handling: Result<T,E> pattern in packages/core
- Existing skill pattern: defineSkill() with kind: deterministic | prompt
- Config: TOML via smol-toml, no JSON config files
- State: SQLite WAL for structured, flat files for .sun/
```

These observations feed directly into assumption derivation.

---

## Step 4: derive_assumptions

Based on what you read, derive the full set of assumptions for this phase. For each assumption:

1. **State the assumption** — concrete and specific
2. **Cite the evidence** — which file/pattern supports it
3. **Classify it** — safe / risky / unknown (see below)
4. **Identify the impact** — what breaks if this assumption is wrong

**Classification rules:**

| Class | Criteria |
|-------|----------|
| `safe` | Strong evidence in codebase, matches established pattern, low variance |
| `risky` | Weak or conflicting evidence, high cost if wrong, performance/security relevant |
| `unknown` | No evidence exists in codebase, genuinely open design decision |

**Example derivation:**

```
Assumption: New skills will use defineSkill() from packages/core
Evidence: packages/skills-harness/src/init.skill.ts, packages/skills-workflow/src/status.skill.ts — both use this pattern consistently
Class: SAFE — zero variance across all existing skills
Impact if wrong: Low — defineSkill is the only public API

Assumption: Agent output will be parsed from last ```json block in response
Evidence: CLAUDE.md convention "Agent output parsing: extract last JSON code block"
Class: SAFE — explicit convention documented
Impact if wrong: Medium — parsing logic would need to change

Assumption: Database schema changes require a migration file
Evidence: No existing migrations found in packages/core/src/db/
Class: UNKNOWN — no evidence either way, depends on SQLite strategy chosen
Impact if wrong: HIGH — data corruption on upgrade
```

Build a complete list — typically 8–20 assumptions per phase.

---

## Step 5: classify_assumptions

Group by class:

**SAFE assumptions** (will be applied automatically):
- Listed in CONTEXT.md with evidence
- User sees them in the summary but does not need to approve individually

**RISKY assumptions** (require user confirmation):
- Surface with options (A/B/C format)
- User must choose or override

**UNKNOWN assumptions** (require user input):
- No evidence available
- Present as open questions with recommended defaults

---

## Step 6: surface_risky_assumptions

Display risky and unknown assumptions to the user. Format each one:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► ASSUME — Phase {N}: {name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Read {N} source files, {N} test files, {N} prior summaries.
 Derived {SAFE_COUNT} safe assumptions (auto-applied).
 {RISKY_COUNT} risky + {UNKNOWN_COUNT} unknown need your input.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Then for each risky/unknown assumption:

```
[{index}/{total}] {ASSUMPTION_TITLE}
Risk: {risky|unknown}
Impact: {HIGH|MEDIUM|LOW} — {impact description}

Evidence: {evidence citation or "None found"}

Options:
  A) {option A} — {tradeoff} (Recommended)
  B) {option B} — {tradeoff}
  C) Other — specify

Your choice [A/B/C or type answer]:
```

**If `--silent` flag:** Skip this section entirely. Assign recommended defaults for all risky/unknown assumptions. Mark them as `auto-assumed` in CONTEXT.md.

**If `--all` flag:** Also show safe assumptions in this section (with read-only display, no input required).

---

## Step 7: collect_user_input

Wait for user response to each surfaced assumption. For each response:

1. Record the user's choice (or free-text override)
2. Map it to a concrete decision
3. Flag if the decision changes the recommended approach significantly

If a user override significantly changes scope:

```
Override noted: {what changed}
This may affect {N} other assumptions. Rechecking...
```

Re-derive affected downstream assumptions automatically.

**Batch mode:** If user pastes a numbered list of answers (e.g. "1:A, 2:B, 3:A"), accept that format.

---

## Step 8: merge_confirmed_assumptions

Combine all assumptions into a structured set:

| Category | Source |
|----------|--------|
| Auto-derived (safe) | Step 4 derivation |
| User-confirmed (risky) | Step 7 responses |
| User-specified (unknown) | Step 7 responses |
| Auto-assumed (silent mode) | Recommended defaults |

For each assumption, store:

```
{
  "title": "...",
  "class": "safe|risky|unknown",
  "decision": "...",
  "evidence": "...",
  "source": "derived|user-confirmed|user-specified|auto-assumed",
  "impact": "HIGH|MEDIUM|LOW"
}
```

---

## Step 9: write_context

Write CONTEXT.md from the confirmed assumption set:

```bash
cat > "${CONTEXT_FILE}" << 'EOF'
# Phase {N}: {name} — Context

**Gathered**: {date}
**Mode**: {discuss-phase-assumptions | silent | full-discuss}
**Status**: Ready for planning

<domain>
## Phase Boundary

{goal from ROADMAP, verbatim}

</domain>

<assumptions>
## Confirmed Assumptions

### Safe (derived from codebase)

{for each safe assumption}
- **{title}**: {decision}
  - Evidence: {citation}
  - Impact if wrong: {LOW|MEDIUM|HIGH}

### Confirmed by User

{for each user-confirmed risky assumption}
- **{title}**: {user's decision}
  - Originally risky because: {reason}
  - User override: {yes|no}

### Specified by User

{for each unknown assumption answered}
- **{title}**: {user's answer}
  - No prior evidence in codebase

</assumptions>

<decisions>
## Key Decisions

{synthesized list of the most important implementation decisions derived from above}

</decisions>

<code_context>
## Codebase Evidence

{paste the top 5 most relevant observations from step 3}

</code_context>

<specifics>
## Phase-Specific Requirements

{requirements from ROADMAP verbatim}

{any specifics the user added during assumption surfacing}

</specifics>

<deferred>
## Deferred / Out of Scope

{anything explicitly ruled out during assumption discussion}

</deferred>
EOF
```

---

## Step 10: commit_context

If `NO_COMMIT=false`:

```bash
git add "${CONTEXT_FILE}"
git commit -m "docs(phase-${PHASE_NUM}): write CONTEXT.md from assumption review

Phase ${PHASE_NUM}: ${PHASE_NAME}
  Safe assumptions: ${SAFE_COUNT}
  User-confirmed: ${CONFIRMED_COUNT}
  Auto-assumed (silent): ${AUTO_COUNT}
  Mode: ${MODE}"
```

---

## Step 11: display_summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ASSUME COMPLETE — Phase {N}: {name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Assumptions:
   Safe (auto-applied) : {SAFE_COUNT}
   User-confirmed      : {CONFIRMED_COUNT}
   User-specified      : {SPECIFIED_COUNT}
   Auto-assumed        : {AUTO_COUNT}

 Written to: {CONTEXT_FILE}

 Next: /sunco:plan {PHASE_NUM}
```

If any high-impact assumptions were auto-assumed (silent mode):

```
Warning: {N} high-impact assumption(s) were auto-assumed.
Review before planning: {list assumption titles}
```

---

## Risk Rating Reference

| Rating | Applies when |
|--------|-------------|
| `safe` | Exact pattern exists in ≥2 existing files |
| `safe` | Explicitly documented in CLAUDE.md conventions |
| `risky` | Conflicting patterns in codebase |
| `risky` | Performance, security, or data integrity implications |
| `risky` | External dependency choice (A vs B library) |
| `unknown` | New territory with no prior art in this codebase |
| `unknown` | User preference question (naming, structure, UX) |

---

## Assumption Categorization (Architecture/Data/Integration/Performance)

Beyond safe/risky/unknown, assumptions are also categorized by domain. This helps `/sunco:plan` generate more targeted plans.

### Architecture assumptions

Relate to code structure, module boundaries, dependency direction, naming conventions.

Examples:
- "The new service will live in `packages/core/src/services/`"
- "This feature follows the `defineSkill()` pattern from packages/core"
- "We will use the existing `UiAdapter` interface rather than a new one"

### Data assumptions

Relate to data shapes, storage, schema, serialization, state management.

Examples:
- "Config will be stored in TOML (not JSON) using smol-toml"
- "SQLite WAL is used for structured state; flat files for `.sun/`"
- "This phase does not require schema migration"

### Integration assumptions

Relate to how this phase connects to other packages, external APIs, or services.

Examples:
- "The agent router is already implemented and can be imported from packages/core"
- "No new npm dependencies are needed — existing packages cover this"
- "The Anthropic SDK will be called via Vercel AI SDK abstraction, not directly"

### Performance assumptions

Relate to latency, throughput, concurrency, resource usage.

Examples:
- "This skill runs synchronously — no async streaming needed"
- "File I/O operations are infrequent enough that caching is not needed"
- "The lint gate will complete in < 10 seconds for this scope"

---

## Deep Codebase Scanning Patterns

The codebase scan in Step 3 is the most important investment in this workflow. Scan patterns that yield the most signal:

### Pattern 1: Existing skill implementations

```bash
find packages/ -name "*.skill.ts" | head -10
```

Read 2-3 to understand: naming, structure, kind (`deterministic` vs `prompt`), PermissionSet usage, ctx API calls.

### Pattern 2: Test file patterns

```bash
find packages/ -name "*.test.ts" | head -10
```

Read 1-2 to understand: Vitest setup, vi.mock() patterns, in-source vs separate files, describe/it structure.

### Pattern 3: Import conventions

```bash
grep -r "from '.*'" packages/core/src/ | head -20
```

Check: `.js` extension usage, relative vs package imports, barrel exports, dynamic import patterns.

### Pattern 4: Error handling conventions

```bash
grep -r "throw\|Result\|Either\|catch" packages/core/src/ | head -20
```

Determine: error propagation style (throw vs Result type), error types, user-facing error messages.

### Pattern 5: Config access patterns

```bash
grep -r "config\.\|getConfig\|loadConfig" packages/ | head -20
```

Understand: how skills access config, whether it's injected or imported, TOML vs runtime config.

### Pattern 6: Prior phase summaries

```bash
ls .planning/phases/*/  | grep SUMMARY
```

Read the most recent 1-2 SUMMARY.md files to understand decisions made in adjacent phases.

---

## Evidence Linking in CONTEXT.md

Each assumption written to CONTEXT.md must be evidence-linked. Evidence format:

```
- **[Assumption title]**: [Decision]
  - Evidence: `packages/skills-harness/src/init.skill.ts:L12` — uses defineSkill() with kind: deterministic
  - Impact if wrong: LOW — defineSkill is the only public skill API
```

Evidence links serve two purposes:
1. **Plan generation**: `/sunco:plan` reads evidence to generate more accurate task descriptions
2. **Verification**: `/sunco:verify` can trace back to evidence to confirm correct implementation

If no evidence can be found: mark as `class: unknown` and surface to user.

---

## User Override Handling

When a user overrides a safe assumption, downstream assumptions may need to be recalculated.

**Override cascade example:**
- Safe assumption: "Using existing UIAdapter interface"
- User override: "No, create a new adapter for this specific use case"
- Cascade: 3 other assumptions about adapter usage now become unknown

When an override is detected:

```
Override noted: [what changed]

This affects [N] downstream assumptions. Updating:

  1. "Adapter file location" — was safe (existing path), now unknown
  2. "Adapter interface shape" — was safe (existing type), now unknown
  3. "Test setup for adapter" — was safe (existing test pattern), now risky

Re-evaluating...
```

After re-evaluation, re-classify the affected assumptions and re-surface the ones that became risky/unknown.

---

## Batch Answer Mode

For CI/automated contexts, users can provide all answers upfront in a numbered list:

```
/sunco:assume 3

[Provide answers: 1:A, 2:B, 3:custom answer here, 4:A]
```

The batch format:
- `[index]:[option letter]` for A/B/C options
- `[index]:[free text]` for custom answers
- Skip indices that should use the recommended default

This enables automated pipelines to pre-configure assumptions without interactive prompts.

---

## Integration with /sunco:discuss

`/sunco:assume` is the lightweight, assumption-first variant of `/sunco:discuss`.

| Feature | `/sunco:discuss` | `/sunco:assume` |
|---------|-----------------|----------------|
| Approach | Ask questions first | Read codebase first, then surface gaps |
| Questions | Open-ended | Evidence-backed with A/B options |
| Output | CONTEXT.md | CONTEXT.md (same format) |
| Best for | Novel phases with unclear scope | Familiar territory with known conventions |
| Silent mode | No | Yes (`--silent` auto-applies safe defaults) |
| Batch mode | No | Yes (numbered answer list) |
| Cascade handling | Manual re-question | Automatic downstream re-evaluation |

Both produce compatible CONTEXT.md files that `/sunco:plan` can consume.

---

## Assumption Count Guidelines

Typical assumption counts per phase size:

| Phase complexity | Safe | Risky | Unknown | Total |
|-----------------|------|-------|---------|-------|
| Small (1-2 plans) | 3-5 | 1-2 | 0-1 | 5-8 |
| Medium (3-5 plans) | 5-8 | 2-3 | 1-2 | 8-13 |
| Large (6+ plans) | 8-12 | 3-5 | 2-4 | 13-21 |

If you have more than 20 assumptions: the phase scope is too large. Recommend splitting into two phases.

If you have fewer than 5 assumptions: the phase is either very small (appropriate for `/sunco:quick`) or the codebase scan was too shallow.

---

## Context File Validation

Before writing CONTEXT.md, validate that the content is sufficient for `/sunco:plan`:

Required sections checklist:
- [ ] `## Phase Boundary` — goal from ROADMAP verbatim
- [ ] `## Confirmed Assumptions` — at least one assumption per category that has evidence
- [ ] `## Key Decisions` — at least 2-3 concrete implementation decisions
- [ ] `## Phase-Specific Requirements` — requirements from ROADMAP

If any section is empty: surface a warning before writing:
```
Warning: ## Key Decisions section is empty.
Plan generation will be less accurate without explicit decisions.
Add at least 2 decisions before proceeding.
```

The user can proceed anyway or add decisions interactively.

# List Phase Assumptions Workflow

Surface agent assumptions embedded in phase planning artifacts before execution begins. Reads CONTEXT.md, PLAN.md files, and DISCUSS.md (if present) to extract implicit assumptions, highlight the most dangerous ones, and offer to convert them into explicit decisions or research tasks. Used by `/sunco:assume`.

---

## Overview

Four steps:

1. **Load phase artifacts** — read all planning documents for the target phase
2. **Extract assumptions** — identify implicit and explicit assumptions across all documents
3. **Classify and rank** — sort by danger level and testability
4. **Present and act** — offer to convert high-risk assumptions into decisions or research tasks

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First positional token | `PHASE_ARG` | current phase from STATE.md |
| `--risky-only` | `RISKY_ONLY` | false |
| `--json` | `JSON_OUTPUT` | false |
| `--no-act` | `NO_ACT` | false |

If `PHASE_ARG` is absent, read STATE.md:
```bash
PHASE_ARG=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" state load \
  | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); \
    process.stdout.write(JSON.parse(d).current_phase?.number ?? '')")
```

If still absent: "No active phase detected. Provide a phase number: `/sunco:assume <phase>`"

Locate phase directory:
```bash
PADDED=$(printf "%02d" "$PHASE_ARG")
PHASE_DIR=$(ls -d ".planning/phases/${PADDED}-*" 2>/dev/null | head -1)
```

If not found: "Phase ${PHASE_ARG} directory not found. Run `/sunco:status` to list phases."

---

## Step 2: Load Phase Artifacts

Read all available documents for this phase:

```bash
CONTEXT_FILE="${PHASE_DIR}/${PADDED}-CONTEXT.md"
DISCUSS_FILE="${PHASE_DIR}/${PADDED}-DISCUSS.md"
PLAN_FILES=$(ls "${PHASE_DIR}/"*"-PLAN.md" 2>/dev/null | sort)
```

If CONTEXT.md does not exist: warn "No CONTEXT.md found. Run `/sunco:context ${PHASE_ARG}` first." and stop.

For each document read, collect the full text content for assumption extraction.

---

## Step 3: Extract Assumptions

Assumptions fall into three categories:

### A. Explicit assumptions

Text explicitly marked as assumptions in the documents. Look for:
- Lines starting with `Assume:`, `Assuming:`, `We assume`, `Assumption:`
- Frontmatter `assumptions:` array
- `## Assumptions` sections

Extract these verbatim.

### B. Implicit assumptions in language

Scan for language patterns that signal unstated assumptions:

| Pattern | Type of assumption |
|---------|-------------------|
| "should work with" / "will work with" | Compatibility assumption |
| "already" / "already exists" | State assumption |
| "simple" / "trivial" / "straightforward" | Complexity assumption |
| "just" / "only needs to" | Scope assumption |
| "similar to" | Analogy assumption (may not hold) |
| "can use X for Y" | Library/API assumption |
| "will be fast enough" | Performance assumption |
| references to external APIs without version pins | Version/contract assumption |
| "the user will" | User behavior assumption |

Scan all loaded documents for these patterns and extract the containing sentence + context (the paragraph or list item that contains the phrase).

### C. Decision gaps

Scan CONTEXT.md `## Key Decisions` section. Find any decision entries that are marked as TODO or contain `[TBD]`, `[TBD]`, or empty rationale fields. These are undecided decisions treated as implied assumptions.

---

## Step 4: Classify and Rank

For each extracted assumption, classify on two axes:

**Risk level:**

| Level | Criteria |
|-------|---------|
| `critical` | If wrong, the phase cannot proceed or will require a rewrite |
| `high` | If wrong, significant rework needed |
| `medium` | If wrong, some rework needed but scope is contained |
| `low` | If wrong, minor fix or cosmetic change |

**Testability:**

| Level | Criteria |
|-------|---------|
| `verifiable` | Can be tested with a script or quick prototype before execution |
| `researchable` | Can be confirmed with a quick library/API check |
| `judgment` | Requires human decision or product judgment |
| `deferred` | OK to leave as assumption — low cost to be wrong |

Sort output: `critical` first, then `high`, then `medium`, then `low`. Within each level, sort `verifiable` before `researchable` before `judgment`.

If `--risky-only`: filter to `critical` and `high` only.

---

## Step 5: Present Assumptions

If `--json`: output a JSON array of assumption objects and stop.

Otherwise, render:

```
Phase {N}: {title} — Assumption Audit
{N} assumptions found ({critical_count} critical, {high_count} high, {medium_count} medium, {low_count} low)

---

CRITICAL
  [1] "Auth middleware will work with Express v5 router"
      Source:  03-01-PLAN.md, line 42
      Type:    Compatibility assumption
      Risk:    If Express v5 router API changed, the whole middleware layer needs rewriting.
      Action:  Verify compatibility before executing Plan 03-01

  [2] "SQLite WAL mode is supported on the target deployment environment"
      Source:  03-CONTEXT.md, Decisions section
      Type:    State assumption
      Risk:    Deployed environments (Docker, some CI) may have SQLite limitations.
      Action:  Add a runtime check in the init flow

HIGH
  [3] "smol-toml handles multiline strings without escaping"
      Source:  03-02-PLAN.md, line 17
      Type:    Library/API assumption
      Action:  Quick test: write a multiline TOML string and parse it

MEDIUM
  [4] "TypeScript 6.0 Temporal types are stable enough for production use"
      Source:  03-CONTEXT.md
      Type:    Version assumption
      Action:  Low risk — but check release notes for known issues

LOW
  [5] "Phase 02 output files are already in the correct location"
      Source:  03-CONTEXT.md
      Type:    State assumption
      Action:  Deferred — verify at execution start
```

---

## Step 6: Act on Assumptions

If `--no-act` is set: skip this step.

Ask:
```
What would you like to do?
  1. Convert critical/high assumptions to research tasks
  2. Add specific assumption as an explicit decision in CONTEXT.md
  3. Nothing — review only
```

### Option 1: Convert to research tasks

For each `critical` or `high` assumption:
```bash
node "$(npm root -g)/sunco/bin/sunco-tools.cjs" todo add \
  --title "Verify assumption: {assumption_text_truncated}" \
  --priority "high" \
  --phase "${PHASE_ARG}" \
  --file ".planning/todos/${TODO_ID}.md"
```

Report: "Added {N} research todos. Run `/sunco:check-todos` to work through them."

### Option 2: Add as explicit decision

Ask which assumption number to formalize. Then write it to CONTEXT.md under `## Key Decisions`:

```markdown
**Decision: {assumption title}**
Status: TBD
Options: [research needed]
Recommendation: Address this before executing Plan {plan_id}.
```

Run: `git add "${CONTEXT_FILE}" && git commit -m "docs(phase-${PADDED}): surface assumption as explicit decision"`

### Option 3: Nothing

```
Assumption audit complete. Review the list above before executing Phase {N}.
```

---

## Error Handling

| Error | Response |
|-------|----------|
| CONTEXT.md not found | Stop, suggest /sunco:context first |
| No plan files found | Show CONTEXT.md assumptions only, note plans not yet generated |
| sunco-tools unavailable | Skip todo registration, show assumptions only |
| Empty phase (no assumptions found) | "No assumptions detected. Phase may be well-specified already." |

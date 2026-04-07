# Research Phase Workflow

Standalone research sprint for a specific phase. Spawns a focused sunco-phase-researcher agent to investigate implementation approaches, evaluate libraries and APIs, surface trade-offs, and write a structured RESEARCH.md to the phase directory. Used by `/sunco:research`.

---

## Overview

Four steps:

1. **Load phase context** — read CONTEXT.md to understand what needs researching
2. **Build research brief** — derive focused research questions from the phase context
3. **Spawn researcher** — launch a sunco-phase-researcher subagent with the brief
4. **Write RESEARCH.md** — save findings and surface key decisions

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First positional token | `PHASE_ARG` | current phase from STATE.md |
| `--focus <topic>` | `FOCUS` | none (research everything) |
| `--depth <level>` | `DEPTH` | `standard` |
| `--no-subagent` | `NO_SUBAGENT` | false |

`--depth`: `quick` (surface-level, 5 min), `standard` (thorough, 15 min), `deep` (comprehensive, 30 min).

If `PHASE_ARG` is absent, read from STATE.md:
```bash
PHASE_ARG=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state load \
  | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); \
    process.stdout.write(JSON.parse(d).current_phase?.number ?? '')")
```

Locate phase directory:
```bash
PADDED=$(printf "%02d" "$PHASE_ARG")
PHASE_DIR=$(ls -d ".planning/phases/${PADDED}-*" 2>/dev/null | head -1)
```

If not found: "Phase ${PHASE_ARG} not found."

---

## Step 2: Load Phase Context

Read `${PHASE_DIR}/${PADDED}-CONTEXT.md`:
- Phase objective
- Requirements list
- Key decisions (especially TBD ones)
- Any existing DISCUSS.md questions

Check if RESEARCH.md already exists:
```bash
RESEARCH_FILE="${PHASE_DIR}/${PADDED}-RESEARCH.md"
if [[ -f "$RESEARCH_FILE" ]]; then
  echo "RESEARCH.md already exists for Phase ${PHASE_ARG}."
  echo "Options:"
  echo "  overwrite — replace with new research"
  echo "  append    — add new findings to existing"
  echo "  cancel    — keep existing"
fi
```

Wait for user response if file exists.

---

## Step 3: Build Research Brief

Derive research questions from the CONTEXT.md content.

### Automatic question generation

For each requirement in CONTEXT.md that mentions:
- A specific library or framework → "Is {library} the best choice for {requirement}? What are the alternatives?"
- An integration → "How does {A} integrate with {B}? Any known issues?"
- A performance requirement → "What is the performance profile of {approach} at {scale}?"
- A TBD decision → "What are the options for {decision}? What does the ecosystem recommend?"

If `--focus` is provided: narrow questions to only those related to `FOCUS`.

**Depth-based scope:**

| Depth | Max questions | Code examples? | Benchmarks? |
|-------|--------------|----------------|-------------|
| `quick` | 3 | no | no |
| `standard` | 7 | yes | if relevant |
| `deep` | 15 | yes | yes |

---

## Step 4: Spawn Research Agent

If `--no-subagent`: run research inline (no Task spawning). Proceed to answer the research questions directly using web search and codebase scan.

Otherwise, spawn a subagent:

```
Task(
  subagent_type="general-purpose",
  prompt="
    <objective>
    Research implementation approaches for Phase {PHASE_ARG}: {phase_title}.
    Produce a structured RESEARCH.md with findings, recommendations, and trade-offs.
    </objective>

    <phase_context>
    {Full content of CONTEXT.md}
    </phase_context>

    <research_questions>
    {Generated research questions, numbered}
    </research_questions>

    <depth>{DEPTH}</depth>

    <research_instructions>
    For each question:
    1. Identify the best available option given the project stack (TypeScript/Node.js 24, ESM-only).
    2. List 2-3 alternatives with trade-offs.
    3. State a clear recommendation with rationale.
    4. Include a code snippet if the implementation pattern is non-obvious.
    5. Flag any gotchas, version constraints, or ecosystem risks.

    Focus on the specific tech stack defined in CLAUDE.md (smol-toml, Zod, Vitest, Commander.js, Ink).
    Do not recommend tools listed in "What NOT to Use" in CLAUDE.md.
    </research_instructions>

    <output_format>
    Write findings to: {PHASE_DIR}/{PADDED}-RESEARCH.md
    Use the RESEARCH.md template below.
    </output_format>

    <research_md_template>
    ---
    phase: {PADDED}
    researched_at: {ISO timestamp}
    depth: {DEPTH}
    focus: {FOCUS or 'all'}
    ---

    # Phase {PHASE_ARG}: {phase_title} — Research

    ## Summary

    {2-3 sentence executive summary of findings and key recommendation.}

    ## Findings

    ### {Question 1 title}

    **Recommendation:** {library / approach / pattern}

    **Why:** {rationale}

    **Alternatives:**
    | Option | Pros | Cons |
    |--------|------|------|
    | {A} | ... | ... |
    | {B} | ... | ... |

    **Usage pattern:**
    ```typescript
    // minimal example
    ```

    **Gotchas:** {any known issues}

    ---

    {repeat for each question}

    ## Decisions Surfaced

    {List decisions that should be formalized in CONTEXT.md before planning:}
    - [ ] **{decision title}** — {what needs to be decided and why it matters}

    ## References

    - {URL or doc reference}
    </research_md_template>
  "
)
```

Wait for the subagent to complete.

---

## Step 5: Verify and Finalize

After the subagent completes (or inline research is done), verify the output:

```bash
if [[ ! -f "$RESEARCH_FILE" ]]; then
  echo "Research agent did not produce RESEARCH.md."
  echo "Path expected: ${RESEARCH_FILE}"
  exit 1
fi
```

Read the first 20 lines to verify the file is not empty or malformed.

Commit the research artifact:
```bash
git add "${RESEARCH_FILE}"
git commit -m "docs(phase-${PADDED}): add research findings for ${phase_title}"
```

---

## Step 6: Report

```
Research complete.

  Phase:     {PHASE_ARG} — {phase_title}
  File:      {RESEARCH_FILE}
  Depth:     {DEPTH}
  Questions: {N} research questions answered

Key decisions surfaced: {N}
  {list decision titles from "Decisions Surfaced" section}

Next steps:
  Review RESEARCH.md, then update CONTEXT.md decisions.
  /sunco:discuss {PHASE_ARG}    — formalize decisions
  /sunco:plan {PHASE_ARG}       — generate plans using research findings
```

---

## Error Handling

| Error | Response |
|-------|----------|
| Phase directory not found | "Phase not found. Check /sunco:status." |
| CONTEXT.md missing | Warn, proceed with minimal context from ROADMAP.md entry |
| Subagent fails to produce RESEARCH.md | Report failure, offer to retry or run inline |
| RESEARCH.md already exists | Ask overwrite/append/cancel before proceeding |

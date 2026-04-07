# Multi-Model Design Pingpong Workflow

Cross-model design with structured merge and debate protocol. Spawns two AI models in parallel with identical input, compares outputs at section level, auto-merges agreed sections, and runs a 3-round debate for diverged sections. Produces a merged artifact and merge report. Used by `--cross-model` flag on `/sunco:discuss`, `/sunco:plan`, and `/sunco:research`.

> **WARNING: Token cost is approximately 2.4x a single-model run.** Each model receives the full input (2x base), and the merge/debate phase adds ~20% overhead. Only use for critical design decisions where independent perspectives justify the cost.

---

## Core Principle

Two models thinking independently will catch blind spots that a single model misses. But raw output from two models is useless without structured reconciliation. This workflow enforces a deterministic merge algorithm at section level, uses Jaccard similarity to classify agreement, and only escalates to debate when models genuinely disagree. The user is the final tie-breaker for sections that remain diverged after debate. Every intermediate artifact is persisted to `.planning/pingpong/` for full auditability.

Responsibility chain:

```
parse_args → load_context → prepare_input → spawn_models
→ collect_outputs → merge_outputs → debate_diverged
→ convergence_check → final_merge → present_results → cleanup
```

---

## Step 1: parse_args

Parse `$ARGUMENTS` for the pingpong-specific flags. This workflow is never invoked directly — it is called by discuss, plan, or research when `--cross-model` is active.

| Token | Variable | Default |
|-------|----------|---------|
| `--phase N` | `PHASE_ARG` | current phase from STATE.md |
| `--artifact <type>` | `ARTIFACT_TYPE` | `CONTEXT` (from discuss), `PLAN` (from plan), `RESEARCH` (from research) |
| `--model-b <model>` | `MODEL_B` | from config or `codex` |
| `--debate-rounds N` | `DEBATE_ROUNDS` | `3` |
| `--similarity-threshold N` | `SIM_THRESHOLD` | `0.8` (AGREED cutoff) |
| `--auto-accept` | `AUTO_ACCEPT` | false |
| `--dry-run` | `DRY_RUN` | false |

Resolve phase directory:

```bash
PADDED=$(printf "%02d" "$PHASE_ARG")
PHASE_DIR=$(ls -d ".planning/phases/${PADDED}-*" 2>/dev/null | head -1)
```

If not found: "Phase ${PHASE_ARG} not found. Run `/sunco:status` to check available phases."

Resolve Model B from config if not specified:

```bash
MODEL_B_CFG=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" config-get pingpong.model_b 2>/dev/null || echo "codex")
```

Use `MODEL_B_CFG` if `--model-b` was not passed.

Create the pingpong working directory:

```bash
PINGPONG_DIR=".planning/pingpong"
mkdir -p "$PINGPONG_DIR"
```

---

## Step 2: load_context

Gather all context that both models need. The input must be identical — any asymmetry defeats the purpose of independent comparison.

```bash
INIT=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" init phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse: `phase_title`, `has_context`, `has_plans`, `requirements_count`.

Read all relevant files into a single context bundle:

| File | Required | Purpose |
|------|----------|---------|
| `.planning/PROJECT.md` | yes | Project scope and goals |
| `.planning/REQUIREMENTS.md` | yes | Functional requirements |
| `.planning/ROADMAP.md` | yes | Phase sequence and dependencies |
| `${PHASE_DIR}/${PADDED}-CONTEXT.md` | if exists | Prior discuss output |
| `${PHASE_DIR}/${PADDED}-RESEARCH.md` | if exists | Prior research findings |
| `CLAUDE.md` | yes | Tech stack constraints |

Hard errors:
- `PROJECT.md` missing: "No PROJECT.md. Run `/sunco:new` first."
- `REQUIREMENTS.md` missing: "No REQUIREMENTS.md. Run `/sunco:new` first."
- `ROADMAP.md` missing: "No ROADMAP.md. Run `/sunco:new` first."

Concatenate into `CONTEXT_BUNDLE` (variable holding all file contents with clear separators):

```
=== FILE: .planning/PROJECT.md ===
{content}

=== FILE: .planning/REQUIREMENTS.md ===
{content}

=== FILE: .planning/ROADMAP.md ===
{content}

=== FILE: CLAUDE.md (tech stack section only) ===
{content}

=== FILE: ${PADDED}-CONTEXT.md ===
{content, or "Not yet created"}

=== FILE: ${PADDED}-RESEARCH.md ===
{content, or "No research yet"}
```

---

## Step 3: prepare_input

Build the prompt that both models will receive. The prompt varies by `ARTIFACT_TYPE`:

### For CONTEXT (discuss)

```
You are analyzing Phase {PHASE_ARG}: {phase_title}.

Your task: produce a CONTEXT.md that captures all decisions, constraints, questions,
and approach details needed before creating a detailed execution plan.

<context_bundle>
{CONTEXT_BUNDLE}
</context_bundle>

<output_format>
Write your output as a markdown document with these exact sections (use ## headings):

## Objective
## Requirements Covered
## Key Decisions
## Technical Approach
## Constraints & Risks
## Open Questions
## Dependencies

Each section must be substantive. Do not leave placeholders.
</output_format>
```

### For PLAN (plan)

```
You are creating an execution plan for Phase {PHASE_ARG}: {phase_title}.

Your task: produce a PLAN.md with concrete, ordered tasks that implement the phase.

<context_bundle>
{CONTEXT_BUNDLE}
</context_bundle>

<output_format>
Write your output as a markdown document with these exact sections (use ## headings):

## Overview
## Tasks
## Verification Criteria
## Risk Mitigation
## Estimated Effort
## Dependencies

Tasks must be atomic and testable. Each task has: number, title, description,
files affected, acceptance criteria.
</output_format>
```

### For RESEARCH (research)

```
You are researching implementation approaches for Phase {PHASE_ARG}: {phase_title}.

Your task: produce a RESEARCH.md with findings, trade-offs, and recommendations.

<context_bundle>
{CONTEXT_BUNDLE}
</context_bundle>

<output_format>
Write your output as a markdown document with these exact sections (use ## headings):

## Summary
## Findings
## Alternatives Considered
## Recommendations
## Gotchas & Risks
## References

Each finding must include: recommendation, rationale, alternatives table, code example if non-obvious.
</output_format>
```

Store the prepared prompt as `SHARED_PROMPT`.

Display cost warning (first time only):

```bash
WARNED=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state get "pingpong.cost_warned" 2>/dev/null || echo "false")
```

If `WARNED !== "true"`:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► DESIGN PINGPONG — COST WARNING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 This workflow runs two AI models in parallel.
 Estimated token cost: ~2.4x a single-model run.

 Model A : Claude (current session model)
 Model B : {MODEL_B}
 Artifact: {ARTIFACT_TYPE}

 Proceeding in 3 seconds... (Ctrl+C to cancel)
```

```bash
node "$HOME/.claude/sunco/bin/sunco-tools.cjs" state set "pingpong.cost_warned" "true"
```

If `DRY_RUN`: display the prompt and model configuration, then exit.

---

## Step 4: spawn_models

Launch both models in parallel with identical input.

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► DESIGN PINGPONG  Phase {PADDED}: {phase_title}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Spawning two models in parallel...
   Model A (Claude)  → .planning/pingpong/model-a-{ARTIFACT_TYPE}.md
   Model B ({MODEL_B}) → .planning/pingpong/model-b-{ARTIFACT_TYPE}.md
```

### Model A (Claude — current session)

```
Task(
  subagent_type="general-purpose",
  prompt="
    {SHARED_PROMPT}

    Write your complete output to: .planning/pingpong/model-a-{ARTIFACT_TYPE}.md

    IMPORTANT: Use ## headings exactly as specified in the output format.
    Do not add preamble or meta-commentary. Start directly with the first heading.
  "
)
```

### Model B (Codex or configured secondary)

Model B invocation depends on the provider:

**If MODEL_B = "codex":**

```bash
CODEX_INPUT_FILE="${PINGPONG_DIR}/codex-input.md"
```

Write `SHARED_PROMPT` to `CODEX_INPUT_FILE`, then:

```bash
codex exec --input-file "${CODEX_INPUT_FILE}" \
  --output-file "${PINGPONG_DIR}/model-b-${ARTIFACT_TYPE}.md" \
  --quiet
```

**If MODEL_B = "gemini" or other AI SDK provider:**

```
Task(
  subagent_type="general-purpose",
  model="{MODEL_B}",
  prompt="
    {SHARED_PROMPT}

    Write your complete output to: .planning/pingpong/model-b-{ARTIFACT_TYPE}.md

    IMPORTANT: Use ## headings exactly as specified in the output format.
    Do not add preamble or meta-commentary. Start directly with the first heading.
  "
)
```

Both tasks run simultaneously. Wait for both to complete.

### Timeout handling

Set a 5-minute timeout per model. If either model times out:

```
Model {A|B} timed out after 5 minutes.
Falling back to single-model output from the completed model.
```

Write the completed model's output as the final artifact. Skip merge. Exit with warning.

### Output validation

After both complete, verify both files exist and are non-empty:

```bash
MODEL_A_FILE="${PINGPONG_DIR}/model-a-${ARTIFACT_TYPE}.md"
MODEL_B_FILE="${PINGPONG_DIR}/model-b-${ARTIFACT_TYPE}.md"

if [[ ! -s "$MODEL_A_FILE" ]]; then
  echo "Model A produced empty output. Using Model B output only."
  cp "$MODEL_B_FILE" "${PHASE_DIR}/${PADDED}-${ARTIFACT_TYPE}.md"
  exit 0
fi

if [[ ! -s "$MODEL_B_FILE" ]]; then
  echo "Model B produced empty output. Using Model A output only."
  cp "$MODEL_A_FILE" "${PHASE_DIR}/${PADDED}-${ARTIFACT_TYPE}.md"
  exit 0
fi
```

---

## Step 5: merge_outputs

The merge algorithm operates at section level using `## ` headings as boundaries.

### 5a. Parse sections

Split each file by `## ` headings into a section map:

```
For each file:
  1. Split content by lines starting with "## "
  2. For each split:
     - heading = the ## line (normalized: lowercase, trimmed)
     - body = all lines until next ## or EOF
  3. Store as: { heading → body } map
```

Produce:
- `SECTIONS_A`: Map of heading → body from Model A
- `SECTIONS_B`: Map of heading → body from Model B
- `ALL_HEADINGS`: Union of all headings from both models

### 5b. Classify each section

For each heading in `ALL_HEADINGS`:

```
if heading in SECTIONS_A AND heading in SECTIONS_B:
  → compute Jaccard similarity
  → classify as AGREED, PARTIAL, or DIVERGED

if heading in SECTIONS_A only:
  → classify as UNIQUE_A

if heading in SECTIONS_B only:
  → classify as UNIQUE_B
```

### 5c. Jaccard similarity computation

For a given section pair (body_a, body_b):

```
1. Tokenize into sentences:
   - Split on ". ", ".\n", "!\n", "?\n"
   - Trim whitespace from each sentence
   - Normalize: lowercase, collapse whitespace
   - Discard sentences shorter than 10 characters (noise)

2. Compute Jaccard:
   sentence_set_a = Set(sentences from body_a)
   sentence_set_b = Set(sentences from body_b)

   intersection = |sentence_set_a ∩ sentence_set_b|
   union = |sentence_set_a ∪ sentence_set_b|

   For intersection: two sentences match if their normalized edit distance
   is ≤ 0.2 (allow minor wording differences). Use token-level comparison:
     shared_tokens = |tokens_a ∩ tokens_b|
     total_tokens = |tokens_a ∪ tokens_b|
     token_similarity = shared_tokens / total_tokens
     match if token_similarity >= 0.75

   jaccard = intersection / union
   (if union = 0, jaccard = 1.0 — both empty)

3. Classify:
   jaccard >= SIM_THRESHOLD (default 0.8)  → AGREED
   jaccard >= 0.4 AND < SIM_THRESHOLD      → PARTIAL
   jaccard < 0.4                            → DIVERGED
```

### 5d. Build classification table

Produce `SECTION_CLASSIFICATIONS`:

```
| Section | Status | Similarity | Notes |
|---------|--------|------------|-------|
| ## Objective | AGREED | 0.92 | Using Model A version |
| ## Requirements Covered | PARTIAL | 0.63 | 4 agreed, 2 diverged sentences |
| ## Technical Approach | DIVERGED | 0.28 | Models propose different architectures |
| ## Risk Assessment | UNIQUE_B | — | Only in Model B, flagged for review |
```

Store this as `MERGE_CLASSIFICATIONS`.

Display progress:

```
Section analysis complete:
  AGREED   : {N} sections (auto-confirmed)
  PARTIAL  : {N} sections (merged with notes)
  DIVERGED : {N} sections (entering debate)
  UNIQUE   : {N} sections (flagged for review)
```

---

## Step 6: debate_diverged

For each section classified as DIVERGED, run the structured debate protocol. Skip this step if no sections are DIVERGED.

### 6a. Debate initialization

For each DIVERGED section, prepare the debate context:

```
DIVERGED_SECTION_HEADING = "{heading}"
MODEL_A_POSITION = "{body from SECTIONS_A}"
MODEL_B_POSITION = "{body from SECTIONS_B}"
```

### 6b. Round 1 — Critique (parallel)

Both models critique the other's position simultaneously.

**Model A critiques Model B:**

```
Task(
  subagent_type="general-purpose",
  prompt="
    You are Model A in a design debate.

    <section>{DIVERGED_SECTION_HEADING}</section>

    <your_position>
    {MODEL_A_POSITION}
    </your_position>

    <opposing_position>
    {MODEL_B_POSITION}
    </opposing_position>

    Write a critique of the opposing position. Be specific about:
    1. What is wrong or risky in their approach
    2. What they missed that your approach covers
    3. Any assumptions they made that may not hold

    Maximum 200 words. Be constructive but honest.
    Write output to: ${PINGPONG_DIR}/debate-r1-a-critiques-b-{heading_slug}.md
  "
)
```

**Model B critiques Model A:**

```
Task(
  subagent_type="general-purpose",
  model="{MODEL_B}",
  prompt="
    You are Model B in a design debate.

    <section>{DIVERGED_SECTION_HEADING}</section>

    <your_position>
    {MODEL_B_POSITION}
    </your_position>

    <opposing_position>
    {MODEL_A_POSITION}
    </opposing_position>

    Write a critique of the opposing position. Be specific about:
    1. What is wrong or risky in their approach
    2. What they missed that your approach covers
    3. Any assumptions they made that may not hold

    Maximum 200 words. Be constructive but honest.
    Write output to: ${PINGPONG_DIR}/debate-r1-b-critiques-a-{heading_slug}.md
  "
)
```

Both tasks run simultaneously.

Display:

```
Debate Round 1/3: {heading} — critiques exchanged
```

### 6c. Round 2 — Response (parallel)

Each model reads the other's critique and revises or defends.

**Model A responds to Model B's critique of A:**

```
Task(
  subagent_type="general-purpose",
  prompt="
    You are Model A in a design debate, Round 2.

    <section>{DIVERGED_SECTION_HEADING}</section>

    <your_original_position>
    {MODEL_A_POSITION}
    </your_original_position>

    <critique_of_your_position>
    {content of debate-r1-b-critiques-a-{heading_slug}.md}
    </critique_of_your_position>

    Respond to the critique. Either:
    - Revise your position to incorporate valid points, OR
    - Defend your original position with additional evidence

    Maximum 200 words.
    Write output to: ${PINGPONG_DIR}/debate-r2-a-response-{heading_slug}.md
  "
)
```

**Model B responds to Model A's critique of B:**

```
Task(
  subagent_type="general-purpose",
  model="{MODEL_B}",
  prompt="
    You are Model B in a design debate, Round 2.

    <section>{DIVERGED_SECTION_HEADING}</section>

    <your_original_position>
    {MODEL_B_POSITION}
    </your_original_position>

    <critique_of_your_position>
    {content of debate-r1-a-critiques-b-{heading_slug}.md}
    </critique_of_your_position>

    Respond to the critique. Either:
    - Revise your position to incorporate valid points, OR
    - Defend your original position with additional evidence

    Maximum 200 words.
    Write output to: ${PINGPONG_DIR}/debate-r2-b-response-{heading_slug}.md
  "
)
```

Both tasks run simultaneously.

Display:

```
Debate Round 2/3: {heading} — responses exchanged
```

### 6d. Round 3 — Final Position (parallel)

Each model states its final position considering the full debate history.

**Model A final position:**

```
Task(
  subagent_type="general-purpose",
  prompt="
    You are Model A in a design debate, Final Round.

    <section>{DIVERGED_SECTION_HEADING}</section>

    <debate_history>
    YOUR ORIGINAL: {MODEL_A_POSITION}
    OPPONENT CRITIQUE: {content of debate-r1-b-critiques-a}
    YOUR RESPONSE: {content of debate-r2-a-response}
    OPPONENT RESPONSE: {content of debate-r2-b-response}
    </debate_history>

    State your FINAL position on this section. Incorporate any valid points
    from the debate. This is your last word.

    Maximum 100 words.
    Write output to: ${PINGPONG_DIR}/debate-r3-a-final-{heading_slug}.md
  "
)
```

**Model B final position:**

```
Task(
  subagent_type="general-purpose",
  model="{MODEL_B}",
  prompt="
    You are Model B in a design debate, Final Round.

    <section>{DIVERGED_SECTION_HEADING}</section>

    <debate_history>
    YOUR ORIGINAL: {MODEL_B_POSITION}
    OPPONENT CRITIQUE: {content of debate-r1-a-critiques-b}
    YOUR RESPONSE: {content of debate-r2-b-response}
    OPPONENT RESPONSE: {content of debate-r2-a-response}
    </debate_history>

    State your FINAL position on this section. Incorporate any valid points
    from the debate. This is your last word.

    Maximum 100 words.
    Write output to: ${PINGPONG_DIR}/debate-r3-b-final-{heading_slug}.md
  "
)
```

Both tasks run simultaneously.

Display:

```
Debate Round 3/3: {heading} — final positions stated
```

---

## Step 7: convergence_check

After debate completes for each DIVERGED section, re-compute similarity on the final positions.

### 7a. Re-compute Jaccard on final positions

```
For each DIVERGED section:
  final_a = content of debate-r3-a-final-{heading_slug}.md
  final_b = content of debate-r3-b-final-{heading_slug}.md

  jaccard = compute_jaccard(final_a, final_b)
  (using same algorithm from Step 5c)

  if jaccard >= 0.7:
    classification = CONVERGED
    merged_content = final_a  (prefer Model A as base, annotated with convergence)
  else:
    classification = STILL_DIVERGED
```

Note: convergence threshold (0.7) is intentionally lower than the initial agreement threshold (0.8) because the debate process itself surfaces the important differences. 70% agreement after structured debate indicates sufficient consensus.

### 7b. Update classification table

Update `MERGE_CLASSIFICATIONS` for debated sections:

```
| Section | Status | Pre-Debate | Post-Debate | Notes |
|---------|--------|------------|-------------|-------|
| ## Technical Approach | CONVERGED | 0.28 | 0.74 | Converged after 3 rounds |
| ## Architecture | STILL_DIVERGED | 0.15 | 0.42 | Models hold fundamentally different views |
```

Display:

```
Debate results:
  CONVERGED      : {N} sections (consensus reached)
  STILL DIVERGED : {N} sections (user decision required)
```

---

## Step 8: final_merge

Assemble the final merged artifact from all classified sections.

### 8a. Merge rules by classification

**AGREED sections (jaccard >= 0.8):**
Use Model A version as-is. No annotations.

**PARTIAL sections (0.4 <= jaccard < 0.8):**
Use Model A version as base. For each sentence in Model B that does NOT appear in Model A (using the token similarity matching from 5c), append with annotation:

```markdown
<!-- PINGPONG: Model B addition (partial agreement, {jaccard}% similarity) -->
{Model B unique sentence}
```

**UNIQUE_A sections:**
Include with annotation:

```markdown
<!-- PINGPONG: Model A only — review recommended -->
```

**UNIQUE_B sections:**
Include with annotation:

```markdown
<!-- PINGPONG: Model B only — review recommended -->
```

**CONVERGED sections (from debate):**
Use Model A's final position (debate-r3-a-final) as the section content. Add annotation:

```markdown
<!-- PINGPONG: Converged after debate ({jaccard}% post-debate similarity) -->
```

**STILL_DIVERGED sections:**
If `AUTO_ACCEPT` is true: use Model A version with warning comment.

Otherwise, present to user via AskUserQuestion:

```
AskUserQuestion(
  question="
    Design Pingpong: '{heading}' could not be resolved automatically.

    ━━━ Model A (Claude) ━━━
    {final_a content, max 300 chars}

    ━━━ Model B ({MODEL_B}) ━━━
    {final_b content, max 300 chars}

    Full debate history: ${PINGPONG_DIR}/debate-*-{heading_slug}.md

    Choose:
      A     — use Model A's version
      B     — use Model B's version
      merge — include both with annotations (edit manually later)
  "
)
```

Handle user response:
- `A` or `a`: use Model A's final position
- `B` or `b`: use Model B's final position
- `merge` or `m`: include both positions with clear separation markers:

```markdown
<!-- PINGPONG: UNRESOLVED — both positions included for manual merge -->

### Model A Position
{final_a}

### Model B Position
{final_b}

<!-- PINGPONG: END UNRESOLVED -->
```

### 8b. Assemble final document

Reconstruct the document in the original heading order (as specified in the prompt's output_format):

```
1. Iterate through headings in the order they appear in the output_format template
2. For each heading, insert the merged content based on classification
3. Append UNIQUE sections at the end (A first, then B)
```

Write to the target artifact path:

```bash
FINAL_FILE="${PHASE_DIR}/${PADDED}-${ARTIFACT_TYPE}.md"
```

Add a metadata header:

```markdown
---
phase: {PADDED}
created_at: {ISO timestamp}
method: design-pingpong
model_a: claude ({session model})
model_b: {MODEL_B}
sections_agreed: {N}
sections_partial: {N}
sections_converged: {N}
sections_diverged: {N}
sections_unique: {N}
---
```

---

## Step 9: generate_merge_report

Write a detailed merge report to `.planning/pingpong/merge-report.md`.

```markdown
# Pingpong Merge Report

**Phase:** {PHASE_ARG} — {phase_title}
**Artifact:** {ARTIFACT_TYPE}
**Model A:** Claude ({session model})
**Model B:** {MODEL_B}
**Timestamp:** {ISO timestamp}

## Classification Summary

| Category | Count | Sections |
|----------|-------|----------|
| AGREED | {N} | {list of headings} |
| PARTIAL | {N} | {list of headings with similarity %} |
| CONVERGED | {N} | {list of headings with pre/post similarity} |
| STILL DIVERGED | {N} | {list of headings with user choice} |
| UNIQUE (Model A) | {N} | {list of headings} |
| UNIQUE (Model B) | {N} | {list of headings} |

## Agreed Sections (auto-confirmed)

{For each AGREED section:}
### {heading} ({jaccard}% similarity)
No differences of substance. Model A version used.

## Partially Agreed Sections

{For each PARTIAL section:}
### {heading} ({jaccard}% similarity)
**Model B additions merged:**
- {list of sentences added from Model B}

## Debated Sections

{For each section that entered debate:}
### {heading}

**Pre-debate similarity:** {jaccard}%
**Post-debate similarity:** {final_jaccard}%
**Result:** {CONVERGED | STILL_DIVERGED}

**Debate summary:**
- Round 1 — A critiqued B for: {1-line summary}. B critiqued A for: {1-line summary}.
- Round 2 — A revised/defended: {1-line summary}. B revised/defended: {1-line summary}.
- Round 3 — Final positions {converged on X | remained split on X vs Y}.

{If STILL_DIVERGED:}
**User chose:** {A | B | merge}

## Unique Sections

{For each UNIQUE section:}
### {heading} (Model {A|B} only)
Included in final artifact, flagged for review.

## Token Usage Estimate

| Phase | Model A | Model B | Total |
|-------|---------|---------|-------|
| Initial generation | ~{N} | ~{N} | ~{N} |
| Debate ({rounds} rounds, {sections} sections) | ~{N} | ~{N} | ~{N} |
| **Total** | **~{N}** | **~{N}** | **~{N}** |

## Files Produced

- `{FINAL_FILE}` — merged artifact
- `${PINGPONG_DIR}/model-a-${ARTIFACT_TYPE}.md` — raw Model A output
- `${PINGPONG_DIR}/model-b-${ARTIFACT_TYPE}.md` — raw Model B output
- `${PINGPONG_DIR}/debate-r*-*.md` — debate round artifacts ({N} files)
- `${PINGPONG_DIR}/merge-report.md` — this report
```

---

## Step 10: present_results

Display the final summary.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► DESIGN PINGPONG — COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Phase      : {PADDED} — {phase_title}
 Artifact   : {ARTIFACT_TYPE}
 Model A    : Claude ({session model})
 Model B    : {MODEL_B}

 Results:
   AGREED     : {N} sections (auto-confirmed)
   PARTIAL    : {N} sections (merged with annotations)
   CONVERGED  : {N} sections (resolved via debate)
   DIVERGED   : {N} sections (user decision applied)
   UNIQUE     : {N} sections (flagged for review)

 Output     : {FINAL_FILE}
 Report     : .planning/pingpong/merge-report.md

 Estimated cost: ~2.4x single-model ({debate_sections} sections debated)
```

Commit artifacts:

```bash
git add "${FINAL_FILE}" "${PINGPONG_DIR}/merge-report.md"
git commit -m "docs(phase-${PADDED}): design pingpong — ${ARTIFACT_TYPE} from cross-model merge"
```

Suggest next steps based on artifact type:

```
Next steps:
  Review annotations (search for "PINGPONG:" comments) in the merged file.
  {if ARTIFACT_TYPE == "CONTEXT":}
    /sunco:plan {PHASE_ARG}       — plan from the merged context
  {if ARTIFACT_TYPE == "PLAN":}
    /sunco:execute {PHASE_ARG}    — execute the merged plan
  {if ARTIFACT_TYPE == "RESEARCH":}
    /sunco:discuss {PHASE_ARG}    — discuss using research findings
```

---

## Step 11: cleanup

Optionally clean up intermediate files. Debate artifacts can be large.

```bash
KEEP_ARTIFACTS=$(node "$HOME/.claude/sunco/bin/sunco-tools.cjs" config-get pingpong.keep_artifacts 2>/dev/null || echo "true")
```

If `KEEP_ARTIFACTS == "false"`:

```bash
rm -f "${PINGPONG_DIR}/debate-r*-*.md"
rm -f "${PINGPONG_DIR}/codex-input.md"
echo "Debate artifacts cleaned. Merge report and raw outputs retained."
```

If `KEEP_ARTIFACTS == "true"` (default):

```
All pingpong artifacts retained in .planning/pingpong/
To clean up later: rm -rf .planning/pingpong/debate-*.md
```

---

## Error Handling

| Error | Response |
|-------|----------|
| Phase directory not found | "Phase not found. Check `/sunco:status`." |
| PROJECT.md / REQUIREMENTS.md / ROADMAP.md missing | Hard error with instructions to run `/sunco:new` |
| Model A timeout (>5 min) | Use Model B output only, warn user |
| Model B timeout (>5 min) | Use Model A output only, warn user |
| Both models timeout | Abort: "Both models timed out. Check network and model availability." |
| Model A empty output | Use Model B output only |
| Model B empty output | Use Model A output only |
| Both empty outputs | Abort: "Both models produced empty output." |
| Codex not installed | "Codex CLI not found. Install with `npm i -g @openai/codex` or use `--model-b gemini`." |
| No DIVERGED sections | Skip debate entirely, proceed to final merge |
| Debate round produces empty output | Use the model's previous round output as fallback |
| User cancels during AskUserQuestion | Use Model A version with `<!-- PINGPONG: user cancelled, defaulted to Model A -->` |
| Pingpong directory already has files from previous run | Archive to `.planning/pingpong/archive/{timestamp}/` before starting |

---

## Config Keys

| Key | Default | Effect |
|-----|---------|--------|
| `pingpong.model_b` | `"codex"` | Default secondary model |
| `pingpong.debate_rounds` | `3` | Number of debate rounds for diverged sections |
| `pingpong.similarity_threshold` | `0.8` | Jaccard cutoff for AGREED classification |
| `pingpong.convergence_threshold` | `0.7` | Post-debate Jaccard cutoff for CONVERGED |
| `pingpong.partial_lower_bound` | `0.4` | Lower bound for PARTIAL classification |
| `pingpong.keep_artifacts` | `true` | Retain debate round files after merge |
| `pingpong.auto_accept_diverged` | `false` | Auto-accept Model A for STILL_DIVERGED (no user prompt) |
| `pingpong.timeout_seconds` | `300` | Per-model generation timeout |

---

## State Keys

| Key | Description |
|-----|-------------|
| `pingpong.cost_warned` | Whether the user has seen the 2.4x cost warning |
| `pingpong.last_run` | ISO timestamp of last pingpong run |
| `pingpong.last_phase` | Phase number of last pingpong run |
| `pingpong.total_debates` | Cumulative count of debate rounds run |
| `pingpong.convergence_rate` | Rolling average of debate convergence rate |

---

## Integration Points

This workflow is never invoked directly. It is called by other workflows when `--cross-model` is active:

| Caller Workflow | ARTIFACT_TYPE | When |
|----------------|---------------|------|
| `discuss-phase.md` | `CONTEXT` | `--cross-model` flag on `/sunco:discuss` |
| `plan-phase.md` | `PLAN` | `--cross-model` flag on `/sunco:plan` |
| `research-phase.md` | `RESEARCH` | `--cross-model` flag on `/sunco:research` |

Callers should:
1. Detect `--cross-model` in their argument parsing
2. Delegate to this workflow instead of running single-model generation
3. Resume their normal post-generation flow (verification, commit, reporting) using the merged output

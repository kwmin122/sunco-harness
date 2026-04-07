# Review Workflow

Multi-provider cross-review of a phase plan or completed work. Spawns 2-3 independent reviewer agents using different AI models, aggregates their findings, cross-references for agreement, and writes a REVIEWS.md file with a consolidated verdict. Used by `/sunco:review`.

---

## Overview

Five steps:

1. **Initialize** — determine what to review and which models to use
2. **Spawn reviewers** — 2-3 independent agents in parallel
3. **Aggregate findings** — collect structured outputs from all reviewers
4. **Cross-reference** — find agreement, surface unique concerns, eliminate noise
5. **Write REVIEWS.md** — consolidated verdict with action items

---

## Step 1: Initialize

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First numeric token | `PHASE_ARG` | current phase from STATE.md |
| `plan`, `code`, `arch` | `REVIEW_TYPE` | auto-detect |
| `--models <list>` | `MODEL_LIST` | quality profile defaults |

Determine what to review based on available artifacts:

```bash
PADDED=$(printf "%02d" "$PHASE_ARG")
PHASE_DIR=$(ls -d .planning/phases/${PADDED}-* 2>/dev/null | head -1)

# Check what exists
ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null    → review_type=plan
ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null → review_type=execution
```

If both exist, prefer execution review (code was actually written). If only plan, review the plan.

Load reviewer model list from `.sun/config.toml`:

```toml
[review]
models = ["claude-opus-4-5", "gemini-2.5-pro", "claude-sonnet-4-5"]
```

If not configured, use two claude-sonnet-4-5 instances with different system prompts as a fallback (independent perspectives via prompt differentiation).

---

## Step 2: Spawn Reviewers

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► REVIEW  Phase XX: [Phase Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Spawning 3 independent reviewers in parallel...
  → Reviewer 1 (claude-opus-4-5)    — correctness + architecture
  → Reviewer 2 (gemini-2.5-pro)     — completeness + edge cases
  → Reviewer 3 (claude-sonnet-4-5)  — security + performance
```

Spawn all reviewers simultaneously. Each gets a different review lens:

**Reviewer 1 — Correctness + Architecture:**
```
Task(
  prompt="
Review Phase XX implementation for correctness and architectural fit.

Read:
  - .planning/phases/XX-name/*-PLAN.md (what was intended)
  - .planning/phases/XX-name/*-SUMMARY.md (what was built)
  - Relevant source files referenced in SUMMARY.md

Focus on:
  1. Does the implementation match the plan's done_when criteria?
  2. Does it fit the existing architecture without coupling violations?
  3. Are there correctness issues (logic errors, missing cases)?

Return structured JSON:
{
  verdict: 'pass' | 'pass_with_warnings' | 'fail',
  issues: [{severity: 'blocker'|'major'|'minor', description: '...', location: '...'}],
  strengths: ['...'],
  summary: '...'
}
",
  subagent_type="general-purpose",
  model="claude-opus-4-5",
  description="Review Phase XX — correctness"
)
```

**Reviewer 2 — Completeness + Edge Cases:**
```
Task(
  prompt="[similar structure, focus: completeness, missing cases, boundary conditions]",
  subagent_type="general-purpose",
  model="gemini-2.5-pro",
  description="Review Phase XX — completeness"
)
```

**Reviewer 3 — Security + Performance:**
```
Task(
  prompt="[similar structure, focus: security vulnerabilities, performance anti-patterns, resource usage]",
  subagent_type="general-purpose",
  model="claude-sonnet-4-5",
  description="Review Phase XX — security/performance"
)
```

---

## Step 3: Aggregate Findings

After all reviewers return, parse their JSON outputs.

Build a combined finding list. For each issue, record:
- `severity` — the highest severity assigned by any reviewer
- `description` — the clearest description across reviewers
- `location` — file:line if specified
- `reviewer_count` — how many reviewers flagged this
- `reviewers` — which reviewers flagged this

---

## Step 4: Cross-Reference

**Agreement signal:**

Issues flagged by 2+ reviewers are HIGH confidence — likely real.
Issues flagged by only 1 reviewer are MEDIUM confidence — worth noting, not blocking.

Classify:

```
Agreed issues (2+ reviewers):   HIGH confidence → include in verdict
Solo issues (1 reviewer):       MEDIUM confidence → include with note
Contradictions (A says X, B says opposite): flag explicitly for user judgment
```

**Noise reduction:**

Exclude issues that are:
- Stylistic preferences with no correctness implication
- Redundant with an agreed issue (keep the clearest version)
- Outside the review scope (e.g., reviewer commenting on planning docs when reviewing code)

**Verdict logic:**

| Condition | Verdict |
|-----------|---------|
| Any blocker issue (agreed) | FAIL |
| No blockers, 1+ major (agreed) | PASS WITH WARNINGS |
| Only solo issues or minor/cosmetic | PASS |
| All reviewers return pass | PASS |

---

## Step 5: Write REVIEWS.md

Write `.planning/phases/XX-name/REVIEWS.md`:

```markdown
# Multi-AI Review — Phase XX: [Phase Name]

Date: [ISO date]
Reviewers: claude-opus-4-5, gemini-2.5-pro, claude-sonnet-4-5
Review type: execution | plan
Verdict: PASS | PASS WITH WARNINGS | FAIL

## Verdict

[One paragraph summary of the overall finding]

## Agreed Issues (2+ reviewers)

### 1. [Issue Title] — [severity]
**Reviewers:** Reviewer 1, Reviewer 2
**Location:** [file:line]
**Description:** [clearest description]
**Recommended fix:** [concrete action]

## Solo Issues (1 reviewer, worth noting)

### 1. [Issue Title] — [severity]
**Reviewer:** Reviewer 3
**Description:** [description]
**Assessment:** Verify during execution — may be a false positive

## Strengths Noted

- [Reviewer 1]: [strength]
- [Reviewer 2]: [strength]

## Action Items

- [ ] [blocker fix if any]
- [ ] [major fix if any]
- [ ] [minor improvements optional]

## Raw Summaries

**Reviewer 1 (correctness):** [reviewer_summary]
**Reviewer 2 (completeness):** [reviewer_summary]
**Reviewer 3 (security):** [reviewer_summary]
```

Commit:

```bash
git add "${PHASE_DIR}/REVIEWS.md"
git commit -m "docs: multi-AI review phase ${PADDED} — [verdict]"
```

Display inline:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► REVIEW COMPLETE  Verdict: PASS WITH WARNINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Agreed issues (2 reviewers):
  • major  skill-loader.ts:31  async-ordering — await missing before register loop

Solo issues:
  • minor  config.ts:12  — Reviewer 3 notes no input sanitization on TOML values

Report: .planning/phases/XX-name/REVIEWS.md

Next:
  Fix and re-review  →  address agreed issues, re-run /sunco:review XX
  Ship anyway        →  /sunco:ship XX (warnings will appear in PR body)
```

---

## Success Criteria

- [ ] Correct review target identified (plan vs. execution)
- [ ] 2-3 reviewers spawned in parallel with distinct lenses
- [ ] All reviewers returned structured JSON
- [ ] Findings aggregated and cross-referenced
- [ ] Agreed vs. solo issues distinguished
- [ ] Contradictions flagged explicitly
- [ ] Verdict assigned using agreement logic
- [ ] REVIEWS.md written and committed
- [ ] User knows whether to fix, proceed, or escalate

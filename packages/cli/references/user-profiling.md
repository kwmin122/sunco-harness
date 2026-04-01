# User Profiling Guide

How SUNCO analyzes developer behavior to calibrate question depth, workflow speed, and default choices. Applied by `/sunco:discuss`, `/sunco:new`, and the proactive recommender.

---

## Why Profiles Exist

A senior developer starting their third project in SUNCO should not receive the same onboarding experience as a developer running `/sunco:new` for the first time. A developer who answers every question with "default" should not be asked 8 questions before a 3-task phase.

Profiles reduce friction for experienced users without removing guardrails for new ones. They also let SUNCO make better default choices — a developer who consistently chooses TypeScript strict mode does not need to be asked about it.

---

## The 8 Behavioral Dimensions

### Dimension 1: Question Response Latency

How quickly the user answers questions during `discuss` and `new` flows.

| Score | Signal | Meaning |
|-------|--------|---------|
| 1 | > 5 minutes average response | New to domain, thinking through implications |
| 2 | 2-5 minutes average | Familiar but careful |
| 3 | 30s-2min average | Experienced, confident |
| 4 | < 30 seconds average | Expert, knows what they want |

**How this affects behavior:** Low score → show more context per question, explain tradeoffs in detail. High score → show concise questions with minimal explanation.

---

### Dimension 2: Default Acceptance Rate

Percentage of questions where the user selects the `(Recommended)` option without modification.

| Score | Rate | Meaning |
|-------|------|---------|
| 1 | < 20% | Opinionated user, has strong preferences |
| 2 | 20-50% | Selectively accepts defaults |
| 3 | 50-80% | Mostly trusts defaults, adjusts when needed |
| 4 | > 80% | High trust in SUNCO defaults |

**How this affects behavior:** Score 4 → apply defaults without asking for trivial decisions. Score 1 → present options explicitly even for decisions that have obvious answers.

---

### Dimension 3: Scope Precision

How precisely the user defines scope at the start of phases — vague goals vs. specific acceptance criteria.

| Score | Signal | Meaning |
|-------|--------|---------|
| 1 | "make the thing work" | Needs scope refinement during discuss |
| 2 | "add X feature with Y behavior" | Workable but needs clarification |
| 3 | "X feature, edge cases A/B/C, no Y" | Ready to plan directly |
| 4 | Written `done_when` criteria before discuss | Expert-level, minimal back-and-forth |

**How this affects behavior:** Score 1-2 → spend more discuss turns on scope before planning. Score 3-4 → skip scope questions, go straight to technical design questions.

---

### Dimension 4: Error Recovery Speed

How the user responds when a phase fails or a lint-gate blocks.

| Score | Signal | Meaning |
|-------|--------|---------|
| 1 | Asks for help, doesn't read error output | Needs guided error resolution |
| 2 | Reads errors but often misdiagnoses | Needs confirmation before fix |
| 3 | Diagnoses correctly, applies fix | Competent, light guidance |
| 4 | Fixes before SUNCO suggests | Expert debugger |

**How this affects behavior:** Score 1-2 → `/sunco:diagnose` auto-triggers on failure. Score 3-4 → show error output and trust user to handle it.

---

### Dimension 5: Plan Modification Frequency

How often the user edits generated plans before execution.

| Score | Signal | Meaning |
|-------|--------|---------|
| 1 | Edits every plan significantly | Distrusts plan generation, high oversight |
| 2 | Edits most plans for small adjustments | Moderate oversight |
| 3 | Edits occasionally when something's off | Trusts generation, spot-checks |
| 4 | Never or rarely edits | Full trust in plan generation |

**How this affects behavior:** Score 1-2 → show "Review before executing?" prompt. Score 3-4 → skip review prompt in yolo mode.

---

### Dimension 6: Technical Depth Preference

How much low-level technical detail the user engages with during discuss.

| Score | Signal | Meaning |
|-------|--------|---------|
| 1 | Asks about high-level outcomes only | Manager/non-technical stakeholder |
| 2 | Asks about architectural choices | Technical lead |
| 3 | Asks about implementation details | Senior engineer |
| 4 | Asks about algorithmic and performance tradeoffs | Principal engineer |

**How this affects behavior:** Score 1 → output-focused language in recommendations. Score 4 → include implementation rationale and complexity analysis in plan summaries.

---

### Dimension 7: Session Length Pattern

Typical length and frequency of SUNCO sessions.

| Score | Pattern | Meaning |
|-------|---------|---------|
| 1 | Short sessions (< 30 min), infrequent | Occasional use, needs resume context |
| 2 | Medium sessions (30-90 min), weekly | Regular user, moderate context |
| 3 | Long sessions (90+ min), several per week | Power user, consistent context |
| 4 | Multiple sessions per day, all work in SUNCO | Full workflow integration |

**How this affects behavior:** Score 1-2 → always show resume context at session start, never assume prior context. Score 3-4 → skip "here's where you left off" preamble in yolo mode.

---

### Dimension 8: Automation Trust Level

Whether the user enables auto-mode or prefers interactive mode.

| Score | Signal | Meaning |
|-------|--------|---------|
| 1 | Always interactive, never yolo | High oversight preference |
| 2 | Interactive by default, yolo for known phases | Selective automation |
| 3 | Yolo by default, interactive for risky phases | Mostly automated |
| 4 | Always yolo, uses `/sunco:verify` as safety net | Maximum automation |

**How this affects behavior:** This dimension directly sets the `mode` default suggestion for new projects and phases.

---

## Scoring Methodology

### Initial scoring (first 3 sessions)

No profile data exists. Use the calibration questions in `/sunco:new` and `/sunco:discuss` to build an initial estimate:

```
"Before we start, a quick calibration question:
How much SUNCO experience do you have?

A) This is my first project — I want guidance at each step
B) I've used SUNCO on 1-2 projects — I know the basics
C) I've used SUNCO on 5+ projects — minimal guidance needed
D) I built or deeply know SUNCO internals — skip all explanations
```

Map initial responses to starting scores:
- A → all dimensions start at 1-2
- B → all dimensions start at 2-3
- C → all dimensions start at 3
- D → all dimensions start at 4

### Ongoing calibration

After each session, SUNCO updates dimension scores based on observed behavior:

```
score_new = score_old * 0.7 + observed_score * 0.3
```

This exponential smoothing gives more weight to recent behavior (0.3) while preserving history (0.7). Score changes are bounded to ±1 per session to prevent rapid overcorrection.

### Profile storage

Profiles are stored per-user (not per-project) in `~/.sun/profile.json`:

```json
{
  "version": 1,
  "userId": "auto-generated-hash",
  "dimensions": {
    "questionLatency": 3.2,
    "defaultAcceptance": 2.8,
    "scopePrecision": 3.5,
    "errorRecovery": 3.0,
    "planModification": 2.1,
    "technicalDepth": 3.7,
    "sessionLength": 2.5,
    "automationTrust": 3.1
  },
  "sessionsObserved": 12,
  "lastUpdated": "2026-03-31T14:00:00Z"
}
```

---

## Calibration Tiers

Dimension scores are mapped to 4 tiers that control SUNCO behavior.

### Tier 1: Guided (score 1.0-1.9)

User is new to SUNCO or this domain. Maximum guardrails.

- Show all options with full tradeoff explanations
- Explain why each question is being asked
- Default to `"interactive"` mode
- Show resume context at session start
- Trigger `/sunco:diagnose` automatically on any failure
- Wave checkpoints with human-verify required
- Inline documentation links when introducing new concepts

### Tier 2: Standard (score 2.0-2.9)

User has SUNCO experience but not expert-level. Normal experience.

- Show options with brief tradeoffs
- Skip "why are we asking" explanations
- Default to `"interactive"` mode unless `mode: "yolo"` explicitly set
- Show resume context on sessions after gaps > 3 days
- Suggest `/sunco:diagnose` on failure, don't auto-trigger
- Wave checkpoints required, human-verify optional

### Tier 3: Expert (score 3.0-3.7)

Power user who knows SUNCO well. Reduced friction.

- Show concise options, skip obvious tradeoffs
- Only ask questions that cannot be inferred from context
- Default to `"yolo"` mode unless overridden
- Skip resume context in yolo mode
- Show error output on failure, trust user to handle
- Wave checkpoints deterministic only (no human-verify required)

### Tier 4: Principal (score 3.8-4.0)

User is maximally experienced. Minimal overhead.

- Ask only genuinely blocking questions (expect < 1 per phase)
- Apply all inferred defaults automatically
- Always `"yolo"` mode
- No resume preamble
- Trust user to run diagnostics when needed
- Wave checkpoints only at critical boundaries

---

## How Profiles Affect Specific Workflows

### `/sunco:discuss` question count

```
Tier 1: 5-8 questions (all 5 categories explored)
Tier 2: 3-5 questions (skip obvious decisions)
Tier 3: 1-3 questions (only genuine blockers)
Tier 4: 0-1 questions (proceed if context is sufficient)
```

### `/sunco:execute` confirmation prompts

```
Tier 1: Confirm before each wave
Tier 2: Confirm before first wave
Tier 3: No confirmation unless risky phase
Tier 4: Proceed immediately
```

### Error output verbosity

```
Tier 1: Full error + explanation + suggested fix
Tier 2: Full error + suggested fix
Tier 3: Full error output
Tier 4: Error output only (no suggestions)
```

### Auto-run behavior

A profile-adjusted run does not change *what* gets executed — it changes *how much friction* surrounds execution. The same lint-gates, wave checkpoints, and Swiss cheese layers run regardless of tier. Profiles only affect:
- How many questions are asked
- Whether confirmations are shown
- How verbose output is
- Whether auto-suggestions are shown

Guardrails are always on. Profiles adjust the UI experience, not the safety model.

---

## Profile Reset and Override

### Reset profile

```bash
sunco settings --reset-profile
```

Resets all dimensions to 2.5 (Standard/Expert boundary). Does not delete session history.

### Override for current session

```bash
sunco discuss --profile guided     # Force Tier 1 for this session
sunco discuss --profile principal  # Force Tier 4 for this session
```

Useful when helping a team member or recording a demo.

### Project-level override

```json
// .planning/config.json
{
  "profile": {
    "override": "guided"
  }
}
```

Project-level override always wins over user profile. Use for shared projects where the team includes diverse experience levels.

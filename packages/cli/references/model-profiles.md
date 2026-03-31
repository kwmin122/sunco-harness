# Model Profiles

SUNCO model profiles control the cost/quality tradeoff across the 6-stage pipeline. Set in `.sun/config.toml` as `model_profile = "balanced"` or pass per-command with `--profile quality`.

---

## The 4 Profiles

### `quality`

All high-cost, high-accuracy operations use the best available model.

| Stage | Model |
|-------|-------|
| discuss | Opus |
| plan | Opus |
| execute | Opus |
| verify | Opus |
| quick/fast | Opus |
| adversarial | Opus |

**Best for:**
- Final verification pass before a release
- Complex phases with high ambiguity
- Security-critical features
- Phases where a mistake would require significant rework

**Trade-off:** Highest cost. 3-5x more expensive than `balanced`. Slowest wall-clock time (Opus is rate-limited more aggressively).

---

### `balanced` (default)

High-quality planning, cost-effective execution and verification.

| Stage | Model |
|-------|-------|
| discuss | Opus |
| plan | Opus |
| execute | Sonnet |
| verify (Layers 1+5) | Sonnet |
| verify (Layer 2: guardrails) | n/a (deterministic) |
| verify (Layer 6: Codex) | External |
| quick/fast | Sonnet |

**Best for:**
- Most phases in a typical project
- Default for active development
- When you want high-quality plans but cost-conscious execution

**Trade-off:** Good balance. Opus where judgment is hardest (planning, design decisions), Sonnet where pattern-following is enough (execution, standard verification).

---

### `budget`

Minimizes token spend. Acceptable quality for low-stakes work.

| Stage | Model |
|-------|-------|
| discuss | Sonnet |
| plan | Sonnet |
| execute | Sonnet |
| verify (Layers 1+5) | Haiku |
| quick/fast | Haiku |

**Best for:**
- Prototyping and exploration
- Phases where the approach is well-understood
- High-volume repetitive tasks (generating tests, docs, boilerplate)
- Development phases with low-risk changes (renaming, reformatting)

**Trade-off:** Lower quality on complex reasoning tasks. Plans may require more iterations. Use sparingly for production-critical work.

---

### `inherit`

Uses whatever model the runtime provides — no profile-level override.

| Stage | Model |
|-------|-------|
| All stages | Provider default (e.g., Claude's current context model) |

**Best for:**
- When Claude Code CLI is already running a specific model
- Integration scenarios where the caller controls model selection
- Testing model-agnostic behavior

**Trade-off:** No cost control, no quality guarantee. The caller sets the model.

---

## Cost Comparison (approximate per phase)

Costs are approximate and vary by phase complexity. Based on a typical medium-complexity phase with 2 plans, 3 tasks each.

| Profile | Discuss | Plan | Execute | Verify | Total/phase |
|---------|---------|------|---------|--------|-------------|
| quality | $0.30 | $0.40 | $0.80 | $0.60 | ~$2.10 |
| balanced | $0.30 | $0.40 | $0.25 | $0.20 | ~$1.15 |
| budget | $0.08 | $0.10 | $0.10 | $0.03 | ~$0.31 |
| inherit | varies | varies | varies | varies | — |

Notes:
- Opus rates: ~$15/MTok input, ~$75/MTok output (2026 pricing)
- Sonnet rates: ~$3/MTok input, ~$15/MTok output (2026 pricing)
- Haiku rates: ~$0.25/MTok input, ~$1.25/MTok output (2026 pricing)
- Actual costs depend on context window usage per stage

---

## Configuration

### Global default

In `~/.sun/config.toml`:
```toml
[agent]
model_profile = "balanced"
```

### Project override

In `.sun/config.toml`:
```toml
[agent]
model_profile = "quality"  # Override for this project
```

### Per-command override

```bash
/sunco:verify 3 --profile quality
/sunco:execute 2 --profile budget
/sunco:plan 1 --profile balanced
```

Per-command overrides take precedence over project config, which takes precedence over global.

---

## Model Profile Decision Guide

**Choose `quality` when:**
- Shipping to production (use for final verification pass)
- The phase introduces a new public API or interface
- Security, authentication, or data integrity is involved
- The phase is L (large) complexity
- Previous phases had quality issues that required significant rework

**Choose `balanced` when:**
- Normal active development
- You don't have a specific reason to go up or down
- This is the answer when in doubt

**Choose `budget` when:**
- Exploration or spike work (likely to be thrown away)
- Generating repetitive content (tests, docs, boilerplate)
- Low-risk changes (renaming, reformatting, moving files)
- You are rate-limited and need to pace token spend
- Prototyping a feature before planning it properly

**Choose `inherit` when:**
- You are integrating SUNCO into another agent system
- The outer system controls model selection
- Testing profile-agnostic behavior

---

## Stage-Level Override

For advanced control, override individual stages in `.sun/config.toml`:

```toml
[agent.stage_models]
discuss = "claude-opus-4-5"
plan    = "claude-opus-4-5"
execute = "claude-sonnet-4-5"
verify  = "claude-sonnet-4-5"
quick   = "claude-haiku-4-5"
```

Stage-level overrides take precedence over profile-level settings.

---

## Cross-Model Verification (Layer 6)

Layer 6 of the verification pipeline uses a different AI provider entirely (OpenAI Codex) to eliminate same-model bias. This is separate from the model profile system — it always uses the Codex plugin when installed, regardless of profile.

See `packages/cli/references/swiss-cheese.md` for why cross-model verification matters.

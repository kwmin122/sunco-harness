# Plant Seed Workflow

Capture a forward-looking idea with an attached trigger condition. Seeds surface automatically when their trigger is met. Stored in `.planning/seeds.md`. Used by `/sunco:plant-seed`.

---

## Overview

A seed is a deferred idea with a condition: "When X happens, consider Y."

Unlike a note (passive capture) or a todo (immediate action), a seed is designed to activate later. Seeds are checked at the start of every phase transition and surfaced by the recommender.

Three sub-commands:

| Mode | Trigger | Effect |
|------|---------|--------|
| Plant | `/sunco:plant-seed <text>` | Capture seed with trigger |
| List | `/sunco:plant-seed --list` | Show all seeds |
| Check | `/sunco:plant-seed --check` | Evaluate which seeds have triggered |

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First positional text | `SEED_TEXT` | empty |
| `--when <condition>` | `TRIGGER_CONDITION` | empty (will be asked) |
| `--list` | `LIST_MODE` | false |
| `--check` | `CHECK_MODE` | false |
| `--dismiss <N>` | `DISMISS_INDEX` | unset |
| `--promote <N>` | `PROMOTE_INDEX` | unset |

If `SEED_TEXT` is empty and no flags: show list (same as `--list`).

---

## Step 2: Ensure seeds.md Exists

```bash
SEEDS_FILE=".planning/seeds.md"
mkdir -p .planning/

if [[ ! -f "$SEEDS_FILE" ]]; then
  cat > "$SEEDS_FILE" << 'EOF'
# Seeds

Forward-looking ideas with trigger conditions. Use `/sunco:plant-seed <text>` to add.
Seeds surface automatically when their trigger condition is met.

---

EOF
fi
```

---

## Step 3A: Plant a Seed

If `LIST_MODE`, `CHECK_MODE`, `DISMISS_INDEX`, and `PROMOTE_INDEX` are all unset:

### Gather trigger condition

If `--when` was provided: use `TRIGGER_CONDITION`.

If `--when` was NOT provided: extract the trigger from the seed text.

**Trigger extraction heuristics:**

Look for patterns in `SEED_TEXT`:
- "when {X}" → `TRIGGER_CONDITION = X`
- "after {X}" → `TRIGGER_CONDITION = after X`
- "once {X}" → `TRIGGER_CONDITION = once X`
- "if {X}" → `TRIGGER_CONDITION = if X`
- "before shipping" → `TRIGGER_CONDITION = before ship`

If no pattern found: ask the user:

```
What should trigger this idea to surface?
(Examples: "Phase 3 is complete", "before shipping", "when we add authentication")

Trigger condition: _
```

### Classify trigger type

| Trigger type | Pattern | How it's checked |
|--------------|---------|-----------------|
| `phase_complete` | "phase N is complete", "after phase N" | Checked when /sunco:next runs |
| `pre_ship` | "before shipping", "before PR" | Checked when /sunco:ship runs |
| `milestone` | "when milestone X", "at alpha" | Checked when /sunco:milestone runs |
| `requirement` | "when REQ-N is covered" | Checked when requirements change |
| `manual` | anything else | Surfaced in /sunco:progress |

### Compute seed index

```bash
CURRENT_COUNT=$(grep -c "^## Seed" "$SEEDS_FILE" 2>/dev/null || echo "0")
NEW_INDEX=$(( CURRENT_COUNT + 1 ))
```

### Write to seeds.md

```bash
cat >> "$SEEDS_FILE" << SEED_EOF

## Seed ${NEW_INDEX}

**Idea:** ${SEED_TEXT}
**When:** ${TRIGGER_CONDITION}
**Type:** ${TRIGGER_TYPE}
**Planted:** $(date +%Y-%m-%d)
**Status:** dormant

SEED_EOF
```

### Confirm

```
Seed planted (#${NEW_INDEX}).

  Idea:    {SEED_TEXT}
  When:    {TRIGGER_CONDITION}
  Status:  dormant — will surface when condition is met

  /sunco:plant-seed --list    to see all seeds
  /sunco:plant-seed --check   to evaluate triggers now
```

---

## Step 3B: List Seeds

If `LIST_MODE`:

Parse seeds.md and render:

```
Seeds ({N} total)
─────────────────────────────────────────────────────────
{For each seed:}
  #{N} [{status}]  {idea}
       When: {trigger_condition}
       Planted: {date}
       {If triggered: "★ TRIGGERED — ready to promote"}
       {If dismissed: "(dismissed)"}

─────────────────────────────────────────────────────────
Dormant: {N}  |  Triggered: {N}  |  Dismissed: {N}

Commands:
  /sunco:plant-seed --check            evaluate triggers
  /sunco:plant-seed --promote <N>      move to todo
  /sunco:plant-seed --dismiss <N>      dismiss (won't resurface)
```

If no seeds yet:

```
No seeds planted yet.

Plant your first seed:
  /sunco:plant-seed "explore caching" --when "Phase 3 is complete"

Seeds are forward-looking ideas with trigger conditions.
They surface automatically when the condition is met.
```

---

## Step 3C: Check Triggers

If `CHECK_MODE`:

Evaluate each dormant seed's trigger against current state.

### Evaluation inputs

```bash
# Current phase
CURRENT_PHASE=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" state load | jq -r '.current_phase.number')
CURRENT_STATUS=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" state load | jq -r '.current_phase.status')

# Completed phases
COMPLETED=$(ls ".planning/phases/"*"/VERIFICATION.md" 2>/dev/null | wc -l)

# Current milestone
MILESTONE=$(node "$(npm root -g)/sunco/bin/sunco-tools.cjs" state load | jq -r '.milestone.name')
```

### Trigger evaluation rules

For each seed with `status: dormant`:

| Trigger type | Triggered when |
|--------------|----------------|
| `phase_complete` | The referenced phase number has a VERIFICATION.md with "PASS" |
| `pre_ship` | Current phase status is `"verified"` |
| `milestone` | The referenced milestone name matches current or just-completed milestone |
| `requirement` | The referenced REQ-N has `[x]` or `covered` marker in REQUIREMENTS.md |
| `manual` | Never auto-triggered — check manually |

For triggered seeds: update `Status: triggered` in seeds.md.

### Report

```
Trigger check complete.

Triggered seeds (ready to act on):
  #{N}: {idea}
         When: {trigger_condition}
         → /sunco:plant-seed --promote {N}    move to todo
         → /sunco:plant-seed --dismiss {N}    dismiss

Still dormant ({N} seeds):
  #{N}: {idea} (waiting for: {trigger_condition})
  ...

No new triggers found.
```

---

## Step 3D: Promote or Dismiss

**Promote** (`--promote N`):

Find seed N. Read its idea text. Write to todos:

```bash
# Append to .planning/todos.md (same as /sunco:todo workflow)
```

Update seed status in seeds.md: `Status: promoted`

```
Seed #{N} promoted to todo.
  "{idea}"

Run /sunco:todo to see your todo list.
```

**Dismiss** (`--dismiss N`):

Update seed status in seeds.md: `Status: dismissed`

```
Seed #{N} dismissed.
It will no longer surface in trigger checks.
```

---

## Seeds File Format

```markdown
# Seeds

Forward-looking ideas with trigger conditions. Use `/sunco:plant-seed <text>` to add.

---

## Seed 1

**Idea:** Consider adding Redis caching for the agent router
**When:** Phase 5 (performance) is complete
**Type:** phase_complete
**Planted:** 2026-03-31
**Status:** dormant

## Seed 2

**Idea:** Write a migration guide from GSD to SUNCO
**When:** before shipping the 1.0 release
**Type:** pre_ship
**Planted:** 2026-03-31
**Status:** triggered

## Seed 3

**Idea:** Benchmark Vercel AI SDK streaming vs direct SDK
**When:** if we add support for a second AI provider
**Type:** manual
**Planted:** 2026-03-31
**Status:** dismissed
```

---

## Route

After planting: "Seed dormant. It will surface in `/sunco:progress` and `/sunco:manager` when the condition is met."

After trigger check with triggered seeds: "You have {N} triggered seed(s). Promote or dismiss: `/sunco:plant-seed --list`."

If idea is immediately actionable (no future condition): "This sounds like a task, not a seed. Try `/sunco:todo '{text}'` instead."

# UI Phase Workflow

Generate a UI design contract (UI-SPEC.md) for a phase that includes user-facing interface work. Detects the project's design system, spawns a sunco-ui-researcher agent to analyze patterns and component needs, then writes a structured UI-SPEC.md covering layout, components, interactions, and accessibility. Used by `/sunco:ui-phase`.

---

## Overview

Six steps:

1. **Initialize** — detect phase scope and identify UI surface areas
2. **Detect design system** — find existing tokens, components, or style config
3. **Spawn UI researcher** — gather patterns, component inventory, interaction model
4. **Generate UI-SPEC.md** — layout, components, states, interactions, a11y
5. **Present for review** — inline summary, ask for adjustments
6. **Commit** — write file and commit

---

## Step 1: Initialize

Parse `$ARGUMENTS`:

| Token | Variable | Default |
|-------|----------|---------|
| First numeric token | `PHASE_ARG` | current phase from STATE.md |
| `--surface <name>` | `SURFACE` | auto-detect |

Locate phase directory:

```bash
PADDED=$(printf "%02d" "$PHASE_ARG")
PHASE_DIR=$(ls -d .planning/phases/${PADDED}-* 2>/dev/null | head -1)
```

Read phase context:

```bash
cat "${PHASE_DIR}"/*-CONTEXT.md 2>/dev/null   # from /sunco:discuss
cat .planning/ROADMAP.md | grep -A 20 "Phase ${PADDED}"
cat .planning/REQUIREMENTS.md 2>/dev/null
```

**If no CONTEXT.md exists for this phase:**

```
No context found for phase XX.
Run /sunco:discuss XX first to gather UI requirements.
Or proceed anyway? (yes / run discuss first)
```

If proceeding anyway, derive UI scope from ROADMAP.md success criteria.

Identify UI surfaces from phase scope:
- CLI output / interactive prompts
- Terminal UI components (Ink)
- Configuration files the user edits
- Documentation/help output

---

## Step 2: Detect Design System

Scan the codebase for existing design patterns:

```bash
# Ink component usage
grep -r "import.*from 'ink'" src/ --include="*.ts" -l 2>/dev/null

# Chalk usage for colors
grep -r "chalk\." src/ --include="*.ts" -l 2>/dev/null | head -5

# Existing UI components
ls src/core/ui/ 2>/dev/null || ls src/ui/ 2>/dev/null

# Color/theme constants
grep -r "color\|theme\|palette" src/ --include="*.ts" -l 2>/dev/null | head -5
```

Read found files to extract:
- Existing color palette (chalk colors in use)
- Existing box/border patterns (Ink Box usage)
- Typography conventions (bold, dim, underline patterns)
- Status indicator conventions (✓, ✗, ⚠, ◆ symbols)
- Layout patterns (column widths, padding, indentation)

If no design system found: use SUNCO's default conventions from CLAUDE.md.

---

## Step 3: Spawn UI Researcher

Spawn a sunco-ui-researcher agent:

```
Task(
  prompt="
Research UI requirements for Phase XX: [Phase Name].

Context:
  - Phase goal: [from ROADMAP.md]
  - Success criteria: [from ROADMAP.md]
  - User-facing requirements: [from REQUIREMENTS.md relevant REQ-IDs]

Existing design system:
  [paste detected colors, patterns, components]

For each user-facing feature in this phase:

1. What information does the user need to see?
2. What interactions does the user need to perform?
3. What states does the UI need to handle?
   (loading, success, error, empty, partial)
4. What are the accessibility requirements?
   (screen reader, keyboard navigation, color contrast)
5. What are the responsive/terminal-width constraints?

Write back a structured component inventory:
  - Component name
  - Purpose
  - Props/configuration
  - States
  - Example render output (ASCII art or markdown)
",
  subagent_type="general-purpose",
  description="UI research for Phase XX"
)
```

---

## Step 4: Generate UI-SPEC.md

Using researcher output and design system findings, write the spec:

```markdown
# UI Spec — Phase XX: [Phase Name]

Date: [ISO date]
Surface: CLI / Terminal UI (Ink)
Design system: Detected | Default SUNCO conventions

## Overview

[One paragraph: what UI is being built, what user problem it solves]

## Design Tokens

Colors (chalk):
  primary:   chalk.cyan
  success:   chalk.green
  warning:   chalk.yellow
  error:     chalk.red
  muted:     chalk.dim
  emphasis:  chalk.bold

Borders:
  section:   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  box:       ╔══╗ ║  ║ ╚══╝ (Ink Box component)

Status indicators:
  pass:      ✓ (chalk.green)
  fail:      ✗ (chalk.red)
  warning:   ⚠ (chalk.yellow)
  progress:  ◆ (chalk.cyan)
  pending:   ○ (chalk.dim)

## Screen Layouts

### [Screen 1 Name] — [when it appears]

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► [COMMAND]  [Context]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Content area — 80 char width]
  ◆ Step in progress...

[Footer with next action]
```

Layout spec:
  - Header: full width, ━ border, command name, context right-aligned
  - Content: 2-space indent, 76 char max content width
  - Footer: next action hint, muted

### [Screen 2 Name]
[same structure]

## Components

### [ComponentName]

Purpose: [what it does]
File:    src/core/ui/[component-name].tsx

Props:
  - `title: string` — section header
  - `items: Item[]` — list items to render
  - `status: 'loading' | 'complete' | 'error'`

States:

  loading:
  ```
  ◆ Loading skills...
  ```

  complete:
  ```
  Skills loaded (12)
    • skill-loader    core/init
    • skill-registry  core/lookup
  ```

  error:
  ```
  ✗ Failed to load skills: [error message]
  ```

  empty:
  ```
  No skills registered. Run /sunco:init first.
  ```

### [ComponentName 2]
[same structure]

## Interactions

### [Interaction Name]

Trigger: [user action or system event]
Flow:
  1. [Step 1 — what changes on screen]
  2. [Step 2]
  3. [Terminal state]

Keyboard shortcuts:
  q / Ctrl+C   — exit
  Enter        — confirm
  Arrow keys   — navigate options (if applicable)

## Accessibility

- All status indicators use both color AND symbol (never color alone)
- Error messages include the error text, not just a color
- All prompts include the available actions explicitly
- Terminal width: graceful wrap at 80 chars; minimum functional at 40 chars

## Open Questions

- [Question for the developer to resolve during implementation]
```

---

## Step 5: Present for Review

Display summary inline:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SUNCO ► UI SPEC  Phase XX: [Phase Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3 screens  |  4 components  |  2 open questions

Components:
  StatusHeader     — section progress header with phase/plan context
  SkillList        — formatted skill inventory with status indicators
  ProgressBar      — phase execution progress [████████░░] 48%
  ErrorBlock       — error display with context and recovery hint

Open questions:
  1. Should the progress bar be animated or static?
  2. Is keyboard navigation required for the skill picker?

Looks good? (yes / adjust [describe change])
```

If "adjust": apply the correction inline, re-present the affected component. No re-spawn needed for small changes.

---

## Step 6: Commit

```bash
git add "${PHASE_DIR}/UI-SPEC.md"
git commit -m "docs: UI spec for phase ${PADDED} — [N] components"
```

```
UI-SPEC.md committed.

Next:
  /sunco:plan XX    create execution plan (will reference UI-SPEC.md)
  /sunco:ui-review  audit the spec against 6 pillars before building
```

---

## Success Criteria

- [ ] Phase scope read from ROADMAP.md and CONTEXT.md
- [ ] Existing design system detected (or defaults applied)
- [ ] UI researcher spawned with full context
- [ ] All user-facing features have screen layouts
- [ ] All components have states (loading, success, error, empty)
- [ ] Interactions documented with step-by-step flows
- [ ] Accessibility requirements explicit (not just assumed)
- [ ] Open questions listed — not silently assumed
- [ ] UI-SPEC.md committed
- [ ] User confirmed before commit

---
name: sunco:ui-phase
description: Generate a UI design contract (UI-SPEC.md) for a phase — layout wireframes, component list, interaction states, responsive breakpoints, and accessibility requirements.
argument-hint: "<phase> [--surface {cli|web|native}] [--design-system <name>]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Agent
  - Task
  - AskUserQuestion
---

<context>
**Arguments:**
- `<phase>` — Phase number. Required.

**Flags:**
- `--surface {cli|web|native}` — Target UI surface. Default: `cli`. `web` is a stub until Phase 40/M2.3; `native` is not supported in v1 (v2 candidate). Introduced in Phase 36/M1.2. Explicit-only — no auto-detection.
- `--design-system <name>` — Explicitly specify design system (tailwind, css-modules, styled-components, chakra, shadcn, mui, none). If omitted, auto-detected.
</context>

<objective>
Generate a UI design contract before a phase is executed. Captures layout intent, component structure, interaction states, responsive behavior, and accessibility requirements as a single `UI-SPEC.md` artifact. Evaluated across 6 quality dimensions to ensure the spec is complete before any code is written.

**Creates:**
- `.planning/phases/[N]-*/UI-SPEC.md` — full UI design contract for the phase

**After this command:** Run `/sunco:execute [N]` to implement against the spec, or `/sunco:plan [N]` if plans haven't been created yet.
</objective>

<process>
## Step 1: Load context

Read in order:
1. `.planning/ROADMAP.md` — find Phase N goal, deliverables, and any UI-related notes
2. `.planning/phases/[N]-*/[N]-CONTEXT.md` — design decisions captured in discuss
3. `.planning/REQUIREMENTS.md` — UI/UX requirements
4. `.planning/STATE.md` — current decisions and constraints
5. Existing plan files in `.planning/phases/[N]-*/` — to understand components being built

If phase directory does not exist: error — "Phase [N] has no planning directory. Run `/sunco:discuss [N]` first."

## Step 2: Detect design system

If `--design-system` flag provided: use that value.

Otherwise, scan the codebase:
```bash
# Check package.json for UI dependencies
cat package.json 2>/dev/null | grep -E '"tailwind|@tailwind|css-modules|styled-components|@chakra|@shadcn|@mui|radix'

# Check for config files
ls tailwind.config.* postcss.config.* 2>/dev/null

# Check for existing component files
find src -name "*.module.css" -o -name "*.styled.ts" 2>/dev/null | head -5

# Check for globals/styles
ls src/styles/ src/app/globals.css 2>/dev/null
```

Determine detected design system. If ambiguous: ask user.

## Step 3: Analyze phase UI requirements

Spawn a research agent to extract UI requirements from the phase context:

**Agent name:** `sunco-ui-designer` — description: `UI-SPEC: Phase [N]`

**Research agent prompt:**
"Analyze this phase for UI requirements:
Phase goal: [from ROADMAP.md]
Context decisions: [from CONTEXT.md]
Requirements: [relevant UI requirements from REQUIREMENTS.md]
Design system: [detected system]

Identify:
1. All screens/pages/views to be built or modified
2. Primary user flows and interactions
3. Data that needs to be displayed (tables, forms, lists, etc.)
4. Critical interaction states (loading, empty, error, success)
5. Any responsive requirements (mobile, tablet, desktop breakpoints)
6. Accessibility requirements or user groups

Return a structured analysis."

## Step 4: Generate UI-SPEC.md

Compose the spec across 6 quality dimensions.

### Quality Dimension 1: Visual Hierarchy
- Define primary, secondary, and tertiary information hierarchy for each view
- Specify typography scale usage (H1/H2/body/caption)
- Call out focal points and visual flow

### Quality Dimension 2: Consistency
- Map each UI element to a design system component (or define custom if none exists)
- Component inventory: list every component needed with its source (existing | new | library)
- Flag any deviations from the established design language

### Quality Dimension 3: Accessibility
- WCAG 2.1 AA baseline: color contrast ratios, focus rings, keyboard navigation
- ARIA roles for non-standard interactive elements
- Screen reader labels for icons and images
- Form validation and error message patterns

### Quality Dimension 4: Responsiveness
- Breakpoints: mobile (<640px), tablet (640-1024px), desktop (>1024px)
- Layout changes per breakpoint (grid columns, stacking, hidden elements)
- Touch target sizes for mobile (min 44x44px)

### Quality Dimension 5: Interaction Feedback
- Loading states for every async operation
- Empty states for every list/table view
- Error states for every form and data fetch
- Success/confirmation patterns
- Transition and animation intent (subtle/none for performance)

### Quality Dimension 6: Error States
- Form validation error display patterns
- Network/API error recovery UI
- Boundary conditions (0 items, 1 item, 1000+ items)
- User permission or auth error flows

## Step 5: Write UI-SPEC.md

Write to `.planning/phases/[N]-[phase-name]/UI-SPEC.md`:

```markdown
# UI Spec — Phase [N]: [Phase Title]

**Design System:** [detected/specified]
**Generated:** [timestamp]
**Phase Goal:** [from ROADMAP.md]

---

## Screens

### [Screen Name]

**Purpose:** [what the user does here]

**Layout (ASCII wireframe):**
```
┌────────────────────────────────────────┐
│  [HEADER / NAV]                        │
├────────────────────────────────────────┤
│  [SIDEBAR]  │  [MAIN CONTENT AREA]     │
│             │                          │
│             │  [Component A]           │
│             │  [Component B]           │
│             │                          │
└────────────────────────────────────────┘
```

**Component List:**
| Component | Type | Source | Notes |
|-----------|------|--------|-------|
| [Name] | [form/display/nav] | [existing/new/library] | [notes] |

**Interaction States:**
- Default: [description]
- Loading: [description]
- Empty: [description]
- Error: [description]
- Success: [description]

**Responsive Behavior:**
- Mobile: [changes]
- Tablet: [changes]
- Desktop: [baseline]

---

## Accessibility Checklist
- [ ] Color contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text
- [ ] All interactive elements reachable via keyboard
- [ ] Focus order follows visual reading order
- [ ] Form fields have associated labels
- [ ] Error messages are announced to screen readers
- [ ] Icons have aria-label or are aria-hidden with visible text

## Design Token Overrides
[List any custom token values needed beyond the design system defaults]

## Open Questions
[List any design decisions that need user/designer input before implementation]
```

## Step 6: Self-review against quality dimensions

After writing, verify the spec passes each quality dimension:
1. Visual Hierarchy — every screen has a defined hierarchy
2. Consistency — all components mapped to design system
3. Accessibility — WCAG checklist populated
4. Responsiveness — all 3 breakpoints addressed for each screen
5. Interaction Feedback — loading/empty/error states defined for each view
6. Error States — boundary conditions documented

If any dimension is incomplete: fill gaps before finalizing.

## Step 7: Report

Show:
```
UI-SPEC.md generated for Phase [N].
  Screens defined: [N]
  Components: [N] existing, [N] new
  Accessibility: [WCAG checklist complete/incomplete]
  Design system: [name]

Quality dimensions: [6/6 complete]

File: .planning/phases/[N]-[name]/UI-SPEC.md
```

Tell user: "Review the spec, then run `/sunco:execute [N]` to implement against it."
</process>

# UI-SPEC — {{feature_name}}

**Phase:** {{phase_number}} — {{phase_name}}
**Author:** {{author}}
**Created:** {{created_date}}
**Last updated:** {{last_updated}}
**Status:** {{spec_status}}
*(draft | review | approved | implemented)*

> This document defines the visual and interaction contract for {{feature_name}}.
> Approved before implementation begins. Deviations require spec revision.

---

## Design Tokens

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg-primary` | `{{color_bg_primary}}` | Main background |
| `--color-bg-secondary` | `{{color_bg_secondary}}` | Card / panel backgrounds |
| `--color-bg-elevated` | `{{color_bg_elevated}}` | Dropdown, modal surfaces |
| `--color-text-primary` | `{{color_text_primary}}` | Body text, labels |
| `--color-text-secondary` | `{{color_text_secondary}}` | Captions, metadata |
| `--color-text-disabled` | `{{color_text_disabled}}` | Placeholder, inactive text |
| `--color-accent` | `{{color_accent}}` | Primary action, links |
| `--color-accent-hover` | `{{color_accent_hover}}` | Accent on hover |
| `--color-success` | `{{color_success}}` | Confirmation, passing gates |
| `--color-warning` | `{{color_warning}}` | Non-blocking alerts |
| `--color-danger` | `{{color_danger}}` | Errors, blocking issues |
| `--color-border` | `{{color_border}}` | Dividers, input borders |
| `--color-focus-ring` | `{{color_focus_ring}}` | Keyboard focus indicator |

### Typography

| Token | Value | Usage |
|-------|-------|-------|
| `--font-family-mono` | `{{font_mono}}` | Code, paths, identifiers |
| `--font-family-sans` | `{{font_sans}}` | UI labels, prose |
| `--font-size-xs` | `{{font_size_xs}}` | Metadata, timestamps |
| `--font-size-sm` | `{{font_size_sm}}` | Secondary labels |
| `--font-size-md` | `{{font_size_md}}` | Body text default |
| `--font-size-lg` | `{{font_size_lg}}` | Section headers |
| `--font-size-xl` | `{{font_size_xl}}` | Page titles |
| `--font-weight-regular` | `{{font_weight_regular}}` | Normal prose |
| `--font-weight-medium` | `{{font_weight_medium}}` | Emphasized labels |
| `--font-weight-bold` | `{{font_weight_bold}}` | Headings, CTAs |
| `--line-height-tight` | `{{line_height_tight}}` | Compact lists |
| `--line-height-normal` | `{{line_height_normal}}` | Readable body text |

### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | `{{space_1}}` | Inline gaps, icon margins |
| `--space-2` | `{{space_2}}` | Tight padding |
| `--space-3` | `{{space_3}}` | Component internal padding |
| `--space-4` | `{{space_4}}` | Section gaps |
| `--space-6` | `{{space_6}}` | Card padding |
| `--space-8` | `{{space_8}}` | Layout gutters |
| `--space-12` | `{{space_12}}` | Major section separation |
| `--radius-sm` | `{{radius_sm}}` | Pill badges, chips |
| `--radius-md` | `{{radius_md}}` | Cards, inputs |
| `--radius-lg` | `{{radius_lg}}` | Modals, panels |

---

## Screen Layout

### Primary View

```
┌─────────────────────────────────────────────────────────┐
│  {{header_content}}                          [status]   │
├─────────────────────────────────────────────────────────┤
│  {{nav_or_tabs}}                                        │
├──────────────────────────────┬──────────────────────────┤
│                              │                          │
│  {{main_panel_content}}      │  {{side_panel_content}} │
│                              │                          │
│  {{main_panel_detail}}       │  {{side_panel_detail}}  │
│                              │                          │
├──────────────────────────────┴──────────────────────────┤
│  {{footer_content}}                                     │
└─────────────────────────────────────────────────────────┘
```

**Main panel:** {{main_panel_description}} — {{main_panel_width}}% of available width
**Side panel:** {{side_panel_description}} — {{side_panel_width}}% of available width
**Header height:** {{header_height}}
**Footer height:** {{footer_height}}

### Empty State

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│              {{empty_state_icon}}                       │
│                                                         │
│         {{empty_state_heading}}                         │
│         {{empty_state_subtext}}                         │
│                                                         │
│              [ {{empty_state_cta}} ]                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Error State

```
┌─────────────────────────────────────────────────────────┐
│  ⚠  {{error_state_title}}                               │
│     {{error_state_message}}                             │
│     [ Retry ]  [ Dismiss ]                              │
└─────────────────────────────────────────────────────────┘
```

---

## Component Inventory

### Component: {{component_1_name}}

**Purpose:** {{component_1_purpose}}
**Location:** {{component_1_location}}

| State | Appearance | Trigger |
|-------|------------|---------|
| Default | {{comp_1_default}} | Initial render |
| Hover | {{comp_1_hover}} | Pointer enters bounds |
| Active | {{comp_1_active}} | Mouse down / touch start |
| Focused | {{comp_1_focused}} | Tab or click focus |
| Disabled | {{comp_1_disabled}} | `disabled` prop set |
| Error | {{comp_1_error}} | Validation failure |
| Loading | {{comp_1_loading}} | Async operation in flight |

**Props:**
- `{{comp_1_prop_1}}`: {{comp_1_prop_1_description}}
- `{{comp_1_prop_2}}`: {{comp_1_prop_2_description}}

---

### Component: {{component_2_name}}

**Purpose:** {{component_2_purpose}}
**Location:** {{component_2_location}}

| State | Appearance | Trigger |
|-------|------------|---------|
| Default | {{comp_2_default}} | Initial render |
| Hover | {{comp_2_hover}} | Pointer enters bounds |
| Active | {{comp_2_active}} | Selection confirmed |
| Disabled | {{comp_2_disabled}} | Not interactive |
| Error | {{comp_2_error}} | Invalid input |

**Props:**
- `{{comp_2_prop_1}}`: {{comp_2_prop_1_description}}
- `{{comp_2_prop_2}}`: {{comp_2_prop_2_description}}

---

### Component: {{component_3_name}}

**Purpose:** {{component_3_purpose}}
**Location:** {{component_3_location}}

| State | Appearance | Trigger |
|-------|------------|---------|
| Default | {{comp_3_default}} | Initial render |
| Expanded | {{comp_3_expanded}} | User action |
| Collapsed | {{comp_3_collapsed}} | User action |
| Loading | {{comp_3_loading}} | Fetching content |

---

## Interaction Patterns

### Click / Tap

| Target | Action | Outcome |
|--------|--------|---------|
| {{click_1_target}} | Single click | {{click_1_outcome}} |
| {{click_2_target}} | Single click | {{click_2_outcome}} |
| {{click_3_target}} | Double click | {{click_3_outcome}} |
| {{click_4_target}} | Right click | {{click_4_outcome}} |

**Minimum tap target:** {{min_tap_target}} (WCAG 2.5.5)
**Click feedback delay max:** {{click_feedback_delay}}

### Scroll

| Zone | Behavior | Snap? |
|------|----------|-------|
| {{scroll_1_zone}} | {{scroll_1_behavior}} | {{scroll_1_snap}} |
| {{scroll_2_zone}} | {{scroll_2_behavior}} | {{scroll_2_snap}} |

**Infinite scroll trigger:** Load next page when scroll position reaches {{scroll_trigger_threshold}} from bottom.
**Scroll restoration:** {{scroll_restoration_policy}}

### Drag

| Draggable | Drop Targets | Feedback | Cancel |
|-----------|-------------|----------|--------|
| {{drag_1_item}} | {{drag_1_targets}} | {{drag_1_feedback}} | Escape key / drop outside |
| {{drag_2_item}} | {{drag_2_targets}} | {{drag_2_feedback}} | Escape key / drop outside |

### Keyboard Navigation

| Key | Context | Action |
|-----|---------|--------|
| `Tab` | Global | Advance focus forward |
| `Shift+Tab` | Global | Advance focus backward |
| `Enter` / `Space` | Button, option | Activate |
| `Escape` | Modal, dropdown | Close / cancel |
| `Arrow Up/Down` | List, menu | Move selection |
| `Arrow Left/Right` | Tab bar, slider | Switch / adjust |
| `Home` / `End` | List | Jump to first / last |
| `{{custom_key_1}}` | {{custom_key_1_context}} | {{custom_key_1_action}} |
| `{{custom_key_2}}` | {{custom_key_2_context}} | {{custom_key_2_action}} |

---

## Responsive Breakpoints

| Breakpoint | Width | Layout Change |
|------------|-------|---------------|
| `xs` | < {{bp_xs}}px | {{bp_xs_layout}} |
| `sm` | {{bp_xs}}–{{bp_sm}}px | {{bp_sm_layout}} |
| `md` | {{bp_sm}}–{{bp_md}}px | {{bp_md_layout}} |
| `lg` | {{bp_md}}–{{bp_lg}}px | {{bp_lg_layout}} |
| `xl` | > {{bp_lg}}px | {{bp_xl_layout}} |

**Side panel behavior:**
- `< md`: Side panel collapses to bottom drawer, toggle via tab bar
- `md+`: Side panel visible at fixed width alongside main panel

**Navigation behavior:**
- `< sm`: Top nav collapses to hamburger menu
- `sm+`: Full nav visible

---

## Accessibility Checklist (WCAG 2.1 AA)

### Perceivable

- [ ] All images and icons have `alt` text or `aria-label`
- [ ] Color is never the sole means of conveying information
- [ ] Text contrast ratio ≥ 4.5:1 for normal text (verified with {{contrast_tool}})
- [ ] Large text contrast ratio ≥ 3:1 (18px+ normal or 14px+ bold)
- [ ] Focus indicator contrast ratio ≥ 3:1 against background
- [ ] Audio / video content has captions or transcripts (if applicable)

### Operable

- [ ] All interactive elements reachable by keyboard alone
- [ ] No keyboard traps — Escape always provides an exit
- [ ] Skip-to-content link present at top of page
- [ ] Focus order follows visual / logical reading order
- [ ] Touch targets ≥ 44×44px on mobile viewports
- [ ] No content flashes more than 3 times per second

### Understandable

- [ ] `lang` attribute set on `<html>` element: `{{page_lang}}`
- [ ] Form inputs have associated `<label>` elements
- [ ] Error messages identify the field and describe the fix
- [ ] Required fields marked with visible indicator and `aria-required`
- [ ] Autocomplete attributes on personal data inputs

### Robust

- [ ] Valid HTML — no stray tags, duplicate IDs
- [ ] All ARIA roles, states, and properties used correctly
- [ ] Component tested with screen reader: {{screen_reader_tested}}
- [ ] Works without JavaScript for critical read paths

---

## Motion & Animation

| Element | Animation | Duration | Easing | Reduced-motion fallback |
|---------|-----------|----------|--------|------------------------|
| {{anim_1_element}} | {{anim_1_type}} | {{anim_1_duration}} | {{anim_1_easing}} | Instant |
| {{anim_2_element}} | {{anim_2_type}} | {{anim_2_duration}} | {{anim_2_easing}} | Instant |

**Principle:** All animations honor `prefers-reduced-motion: reduce` by disabling transitions.

---

## Open Design Questions

| Question | Options | Decision Needed By |
|----------|---------|-------------------|
| {{design_q_1}} | {{design_q_1_options}} | {{design_q_1_deadline}} |
| {{design_q_2}} | {{design_q_2_options}} | {{design_q_2_deadline}} |

---

*UI-SPEC created by: /sunco:ui-phase {{phase_number}}*
*File: .planning/phases/{{phase_number}}-{{phase_slug}}/UI-SPEC.md*
*Created: {{created_date}}*
*Approved by: {{approved_by}}*

# UI-SPEC — Phase 51 cross-domain-conflict fixture

<!-- spec_version: 1 -->

UI contract for the fictitious Todo dashboard screen.
Intentionally mismatches the paired API-SPEC.md to exercise 4 cross-domain check types.

<!-- SUNCO:SPEC-BLOCK-START -->
```yaml
version: 1
layout:
  variant: dashboard
  primary_column: main
  breakpoint: desktop-first
components:
  - name: TodoList
    role: list-of-items
  - name: CreateTodoButton
    role: primary-action
  - name: UserBadge
    role: identity-display
states:
  - idle
  - loading
  - error-generic
interactions:
  - trigger: click CreateTodoButton
    outcome: POST /api/todos
a11y:
  aria_landmarks: required
  color_contrast_minimum_ratio: 4.5
responsive:
  breakpoints: [360, 768, 1280]
motion:
  reduced_motion_respected: true
copy:
  tone: neutral
  locale: en
anti_pattern_watchlist:
  - gradient-text
  - pure-black-white
design_system_tokens_used:
  - color.fg.default
  - space.sm
endpoints_consumed:
  - method: GET
    path: /api/users
    ui_ref: UserBadge
  - method: POST
    path: /api/todos
    ui_ref: CreateTodoButton
error_states_handled:
  - state: error-generic
    fallback: true
  - state: error-unauthorized
    api_codes:
      - "401"
type_contracts:
  - field_path: User.createdAt
    ui_type: string
```
<!-- SUNCO:SPEC-BLOCK-END -->

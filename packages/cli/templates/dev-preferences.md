# Developer Preferences — {{developer_name}}

**Captured:** {{captured_date}}
**Project:** {{project_name}}
**Profile method:** {{capture_method}}
*(sunco:profile | manual | imported)*

> These preferences guide how SUNCO generates plans, reviews code, and communicates during sessions.
> They do not override architectural decisions in PROJECT.md or CONTEXT.md.
> Update via `/sunco:profile`.

---

## Coding Style

**Preferred naming convention:** {{naming_convention}}
*(camelCase | snake_case | PascalCase — e.g., camelCase for functions, PascalCase for types)*

**Error handling style:** {{error_handling_style}}
*(throw-early | result-type | try-catch-at-boundary)*

**Comment density:** {{comment_density}}
*(sparse — code is self-documenting | moderate — explain the why | verbose — full JSDoc)*

**Function size preference:** {{function_size}}
*(short — max 20 lines, extract aggressively | medium — 20-50 lines ok | as-needed)*

**Import style:** {{import_style}}
*(explicit named imports | barrel imports ok | no default exports)*

**Test-first preference:** {{test_first}}
*(TDD strict — tests before code | TDD when unclear | tests after, before PR)*

**Type strictness:** {{type_strictness}}
*(strict — no `any`, no `as` casts | pragmatic — `as` ok in tests | loose)*

**Specific dislikes:** {{specific_dislikes}}
*(patterns you find harmful or disruptive — e.g., "no deeply nested ternaries")*

---

## Review Preferences

**Review depth:** {{review_depth}}
*(thorough — every line | standard — logic and architecture | light — only blockers)*

**Preferred feedback format:** {{feedback_format}}
*(inline comments | summary list | prioritized by severity)*

**Blocker threshold:** {{blocker_threshold}}
*(what must be fixed vs. what can be a suggestion — e.g., "only security and correctness are blockers")*

**Accept partial implementations?** {{accept_partial}}
*(yes — flag with TODO | no — must be complete before review)*

**Preferred review timing:** {{review_timing}}
*(before each commit | per plan | per phase | only before PR)*

---

## Communication Preferences

**Response verbosity:** {{verbosity}}
*(terse — bullet points only | balanced — bullets + context | detailed — full explanations)*

**Language:** {{language}}
*(English | Korean | English for code, Korean for explanations)*

**Decision presentation:** {{decision_presentation}}
*(present options with recommendation | just recommend | always ask)*

**Progress updates:** {{progress_updates}}
*(per task | per plan | summary only | silent)*

**Error explanation depth:** {{error_explanation}}
*(root cause + fix | root cause only | just the fix)*

**Tone:** {{tone}}
*(direct — no softening | balanced | collaborative)*

---

## Workflow Preferences

**Preferred plan size:** {{plan_size}}
*(small — max 3 tasks | medium — 3-5 tasks | large — up to 8 tasks)*

**Autonomous execution comfort:** {{autonomous_comfort}}
*(high — run all waves without stopping | medium — checkpoint after each wave | low — confirm each task)*

**Checkpoint sensitivity:** {{checkpoint_sensitivity}}
*(checkpoint only for irreversible changes | checkpoint for architecture decisions | checkpoint frequently)*

**Preferred commit frequency:** {{commit_frequency}}
*(per task | per plan | per phase | manual)*

---

*Preferences captured by: /sunco:profile*
*Last updated: {{last_updated}}*
*Active project: {{project_name}}*

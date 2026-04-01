# Phase {{phase_number}}: {{phase_name}} — Research

**Researched:** {{research_date}}
**Domain:** {{primary_domain}}
**Confidence:** {{confidence_level}}
*(HIGH | MEDIUM | LOW)*
**Phase goal:** {{phase_goal}}

---

<user_constraints>
## User Constraints (from CONTEXT.md)

**CRITICAL:** If CONTEXT.md exists from `/sunco:discuss`, locked decisions below are NON-NEGOTIABLE.
The researcher and planner MUST honor them exactly as written.

### Locked Decisions

{{locked_decisions}}

*(Copy verbatim from CONTEXT.md `## Decisions Made` section)*

### At Claude's Discretion

{{claude_discretion_areas}}

*(Areas where researcher/planner may choose freely)*

### Deferred Ideas (OUT OF SCOPE)

{{deferred_ideas}}

*(Do NOT research or plan these — they are explicitly excluded)*

**If no CONTEXT.md:** Write "No user constraints — all decisions at researcher's discretion"
</user_constraints>

---

<research_summary>
## Summary

{{executive_summary_paragraph_1}}

{{executive_summary_paragraph_2}}

{{executive_summary_paragraph_3}}

**Primary recommendation:** {{primary_recommendation}}

**Confidence driver:** {{confidence_driver}}
*(What makes this a HIGH/MEDIUM/LOW confidence recommendation)*
</research_summary>

---

<standard_stack>
## Standard Stack

The established libraries and tools for this domain as of {{research_date}}.

### Core Dependencies

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| {{lib_1_name}} | {{lib_1_version}} | {{lib_1_purpose}} | {{lib_1_why}} |
| {{lib_2_name}} | {{lib_2_version}} | {{lib_2_purpose}} | {{lib_2_why}} |
| {{lib_3_name}} | {{lib_3_version}} | {{lib_3_purpose}} | {{lib_3_why}} |

### Supporting Dependencies

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| {{support_lib_1_name}} | {{support_lib_1_version}} | {{support_lib_1_purpose}} | {{support_lib_1_when}} |
| {{support_lib_2_name}} | {{support_lib_2_version}} | {{support_lib_2_purpose}} | {{support_lib_2_when}} |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Verdict |
|------------|-----------|----------|---------|
| {{alt_1_standard}} | {{alt_1_alternative}} | {{alt_1_tradeoff}} | {{alt_1_verdict}} |
| {{alt_2_standard}} | {{alt_2_alternative}} | {{alt_2_tradeoff}} | {{alt_2_verdict}} |
| {{alt_3_standard}} | {{alt_3_alternative}} | {{alt_3_tradeoff}} | {{alt_3_verdict}} |

**Installation:**

```bash
{{install_command}}
```
</standard_stack>

---

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure

```
{{recommended_structure}}
```

### Pattern 1: {{pattern_1_name}}

**What:** {{pattern_1_description}}
**When to use:** {{pattern_1_when}}
**Rationale:** {{pattern_1_rationale}}

```typescript
{{pattern_1_code_example}}
```

### Pattern 2: {{pattern_2_name}}

**What:** {{pattern_2_description}}
**When to use:** {{pattern_2_when}}
**Rationale:** {{pattern_2_rationale}}

```typescript
{{pattern_2_code_example}}
```

### Pattern 3: {{pattern_3_name}}

**What:** {{pattern_3_description}}
**When to use:** {{pattern_3_when}}

```typescript
{{pattern_3_code_example}}
```

### Anti-Patterns to Avoid

- **{{anti_pattern_1}}:** {{anti_pattern_1_why}} — do {{anti_pattern_1_instead}} instead
- **{{anti_pattern_2}}:** {{anti_pattern_2_why}} — do {{anti_pattern_2_instead}} instead
- **{{anti_pattern_3}}:** {{anti_pattern_3_why}} — do {{anti_pattern_3_instead}} instead
</architecture_patterns>

---

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have mature solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| {{dont_1_problem}} | {{dont_1_custom}} | {{dont_1_library}} | {{dont_1_why}} |
| {{dont_2_problem}} | {{dont_2_custom}} | {{dont_2_library}} | {{dont_2_why}} |
| {{dont_3_problem}} | {{dont_3_custom}} | {{dont_3_library}} | {{dont_3_why}} |

**Key insight:** {{dont_hand_roll_insight}}
</dont_hand_roll>

---

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: {{pitfall_1_name}}

**What goes wrong:** {{pitfall_1_description}}
**Why it happens:** {{pitfall_1_root_cause}}
**How to avoid:** {{pitfall_1_prevention}}
**Warning signs:** {{pitfall_1_warning_signs}}

### Pitfall 2: {{pitfall_2_name}}

**What goes wrong:** {{pitfall_2_description}}
**Why it happens:** {{pitfall_2_root_cause}}
**How to avoid:** {{pitfall_2_prevention}}
**Warning signs:** {{pitfall_2_warning_signs}}

### Pitfall 3: {{pitfall_3_name}}

**What goes wrong:** {{pitfall_3_description}}
**Why it happens:** {{pitfall_3_root_cause}}
**How to avoid:** {{pitfall_3_prevention}}
**Warning signs:** {{pitfall_3_warning_signs}}
</common_pitfalls>

---

<code_examples>
## Verified Code Examples

All examples from official documentation or authoritative sources.

### {{example_1_operation}}

```typescript
// Source: {{example_1_source}}
{{example_1_code}}
```

### {{example_2_operation}}

```typescript
// Source: {{example_2_source}}
{{example_2_code}}
```

### {{example_3_operation}}

```typescript
// Source: {{example_3_source}}
{{example_3_code}}
```

### Error Handling Pattern

```typescript
// Canonical error handling for this domain
{{error_handling_code}}
```
</code_examples>

---

<sota_updates>
## State of the Art ({{research_year}})

What changed recently that affects implementation:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| {{sota_1_old}} | {{sota_1_new}} | {{sota_1_when}} | {{sota_1_impact}} |
| {{sota_2_old}} | {{sota_2_new}} | {{sota_2_when}} | {{sota_2_impact}} |

**New tools/patterns to consider:**
- **{{new_tool_1}}:** {{new_tool_1_description}} — use when {{new_tool_1_when}}
- **{{new_tool_2}}:** {{new_tool_2_description}} — use when {{new_tool_2_when}}

**Deprecated / outdated:**
- **{{deprecated_1}}:** {{deprecated_1_reason}} — replaced by {{deprecated_1_replacement}}
- **{{deprecated_2}}:** {{deprecated_2_reason}} — replaced by {{deprecated_2_replacement}}
</sota_updates>

---

<open_questions>
## Open Questions

Items that could not be fully resolved during research:

1. **{{open_question_1}}**
   - What we know: {{open_q_1_known}}
   - What's unclear: {{open_q_1_gap}}
   - Recommendation: {{open_q_1_recommendation}}

2. **{{open_question_2}}**
   - What we know: {{open_q_2_known}}
   - What's unclear: {{open_q_2_gap}}
   - Recommendation: {{open_q_2_recommendation}}

3. **{{open_question_3}}**
   - What we know: {{open_q_3_known}}
   - What's unclear: {{open_q_3_gap}}
   - Recommendation: {{open_q_3_recommendation}}
</open_questions>

---

<approach_comparison>
## Approach Comparison Matrix

When multiple implementation approaches are viable, this matrix captures the analysis. The planner uses this to make a justified choice.

| Criterion | Approach A: {{approach_a_name}} | Approach B: {{approach_b_name}} | Approach C: {{approach_c_name}} |
|-----------|--------------------------------|---------------------------------|---------------------------------|
| Implementation effort | {{approach_a_effort}} | {{approach_b_effort}} | {{approach_c_effort}} |
| Runtime performance | {{approach_a_perf}} | {{approach_b_perf}} | {{approach_c_perf}} |
| Testability | {{approach_a_test}} | {{approach_b_test}} | {{approach_c_test}} |
| Maintainability | {{approach_a_maintain}} | {{approach_b_maintain}} | {{approach_c_maintain}} |
| Fits existing patterns | {{approach_a_fits}} | {{approach_b_fits}} | {{approach_c_fits}} |
| Library ecosystem | {{approach_a_ecosystem}} | {{approach_b_ecosystem}} | {{approach_c_ecosystem}} |
| Error handling DX | {{approach_a_errors}} | {{approach_b_errors}} | {{approach_c_errors}} |
| **Score (1-5)** | **{{approach_a_score}}** | **{{approach_b_score}}** | **{{approach_c_score}}** |

**Research verdict:** {{approach_verdict}}
**Rationale:** {{approach_verdict_rationale}}

*(Use scale: 1 = poor, 3 = acceptable, 5 = excellent)*
</approach_comparison>

---

<library_evaluation>
## Library Evaluation Criteria

For each library considered for this phase, evaluated against the SUNCO dependency policy.

### Library: {{eval_lib_1_name}}

| Criterion | Value | Assessment |
|-----------|-------|------------|
| npm weekly downloads | {{eval_lib_1_downloads}} | {{eval_lib_1_downloads_assessment}} |
| Last publish | {{eval_lib_1_last_publish}} | {{eval_lib_1_publish_assessment}} |
| Open issues | {{eval_lib_1_issues}} | {{eval_lib_1_issues_assessment}} |
| TypeScript support | {{eval_lib_1_ts}} | {{eval_lib_1_ts_assessment}} |
| ESM support | {{eval_lib_1_esm}} | {{eval_lib_1_esm_assessment}} |
| Dependency count | {{eval_lib_1_deps}} | {{eval_lib_1_deps_assessment}} |
| License | {{eval_lib_1_license}} | {{eval_lib_1_license_assessment}} |
| Bundle size (gzip) | {{eval_lib_1_size}} | {{eval_lib_1_size_assessment}} |
| Breaking change history | {{eval_lib_1_breaks}} | {{eval_lib_1_breaks_assessment}} |

**Verdict:** {{eval_lib_1_verdict}} — {{eval_lib_1_verdict_rationale}}

---

### Library: {{eval_lib_2_name}}

| Criterion | Value | Assessment |
|-----------|-------|------------|
| npm weekly downloads | {{eval_lib_2_downloads}} | {{eval_lib_2_downloads_assessment}} |
| Last publish | {{eval_lib_2_last_publish}} | {{eval_lib_2_publish_assessment}} |
| TypeScript support | {{eval_lib_2_ts}} | {{eval_lib_2_ts_assessment}} |
| ESM support | {{eval_lib_2_esm}} | {{eval_lib_2_esm_assessment}} |
| Dependency count | {{eval_lib_2_deps}} | {{eval_lib_2_deps_assessment}} |
| License | {{eval_lib_2_license}} | {{eval_lib_2_license_assessment}} |

**Verdict:** {{eval_lib_2_verdict}} — {{eval_lib_2_verdict_rationale}}
</library_evaluation>

---

<risk_assessment>
## Risk Assessment

Risks identified during research that the planner and executor must account for.

| # | Risk | Probability | Impact | Mitigation | Residual Risk |
|---|------|-------------|--------|------------|---------------|
| 1 | {{risk_1}} | {{risk_1_prob}} | {{risk_1_impact}} | {{risk_1_mitigation}} | {{risk_1_residual}} |
| 2 | {{risk_2}} | {{risk_2_prob}} | {{risk_2_impact}} | {{risk_2_mitigation}} | {{risk_2_residual}} |
| 3 | {{risk_3}} | {{risk_3_prob}} | {{risk_3_impact}} | {{risk_3_mitigation}} | {{risk_3_residual}} |
| 4 | {{risk_4}} | {{risk_4_prob}} | {{risk_4_impact}} | {{risk_4_mitigation}} | {{risk_4_residual}} |

*Probability: High | Medium | Low*
*Impact: High (blocks ship) | Medium (slows execution) | Low (cosmetic)*

### Highest risk item

**Risk:** {{top_risk}}
**Why it matters:** {{top_risk_why}}
**Trigger condition:** {{top_risk_trigger}}
**Mitigation plan:** {{top_risk_mitigation}}
**Early warning signal:** {{top_risk_warning}}
</risk_assessment>

---

<code_stubs>
## Code Stubs for Planner

These stubs are starting points for plan task actions. The planner should use these as the basis for writing concrete `<action>` blocks — not copy them verbatim, but adapt them to the specific files and values in this project.

### Stub 1: {{stub_1_operation}}

```typescript
// File: {{stub_1_file}}
// Purpose: {{stub_1_purpose}}
// Pattern from: {{stub_1_pattern_source}}

{{stub_1_imports}}

{{stub_1_type_definitions}}

export {{stub_1_export_keyword}} {{stub_1_function_or_class}}(
  {{stub_1_params}}
): {{stub_1_return_type}} {
  // {{stub_1_step_1}}
  // {{stub_1_step_2}}
  // {{stub_1_step_3}}
  return {{stub_1_return_example}};
}
```

**Key decisions in this stub:**
- {{stub_1_decision_1}}
- {{stub_1_decision_2}}

---

### Stub 2: {{stub_2_operation}}

```typescript
// File: {{stub_2_file}}
// Purpose: {{stub_2_purpose}}
// Pattern from: {{stub_2_pattern_source}}

{{stub_2_code}}
```

---

### Stub 3: Error handling pattern for this domain

```typescript
// Standard error handling for {{research_domain}}
// Adapt this pattern in every task that calls {{primary_library}}

{{error_handling_stub}}
```

---

### Stub 4: Test setup for this domain

```typescript
// File: {{test_stub_file}}
// Vitest setup for testing {{research_domain}} code

{{test_setup_stub}}
```
</code_stubs>

---

<planning_guidance>
## Guidance for /sunco:plan

Key decisions the planner must make for this phase:

### Decision 1: {{planning_decision_1_title}}
**Options:**
- {{planning_decision_1_option_a}} — {{planning_decision_1_option_a_rationale}}
- {{planning_decision_1_option_b}} — {{planning_decision_1_option_b_rationale}}
**Research recommendation:** {{planning_decision_1_recommendation}}

### Decision 2: {{planning_decision_2_title}}
**Options:**
- {{planning_decision_2_option_a}}
- {{planning_decision_2_option_b}}
**Research recommendation:** {{planning_decision_2_recommendation}}

### Implementation Order Suggestion

```
Wave 1 (parallel):
  - {{wave_1_plan_1}}: {{wave_1_plan_1_description}}
  - {{wave_1_plan_2}}: {{wave_1_plan_2_description}}

Wave 2 (after Wave 1):
  - {{wave_2_plan_1}}: {{wave_2_plan_1_description}} (depends on {{wave_1_plan_1}})

Wave 3 (after Wave 2):
  - {{wave_3_plan_1}}: {{wave_3_plan_1_description}} (integration + tests)
```

**Rationale:** {{implementation_order_rationale}}
</planning_guidance>

---

<library_version_pins>
## Library Version Pins

Exact versions confirmed working as of research date. Use these in `package.json` — do not rely on caret ranges for core dependencies.

```json
{
  "dependencies": {
    {{version_pin_1}}: "{{version_pin_1_version}}",
    {{version_pin_2}}: "{{version_pin_2_version}}",
    {{version_pin_3}}: "{{version_pin_3_version}}",
    {{version_pin_4}}: "{{version_pin_4_version}}"
  },
  "devDependencies": {
    {{version_pin_dev_1}}: "{{version_pin_dev_1_version}}",
    {{version_pin_dev_2}}: "{{version_pin_dev_2_version}}",
    {{version_pin_dev_3}}: "{{version_pin_dev_3_version}}"
  }
}
```

**Version pin rationale:**
- {{version_pin_reason_1}}
- {{version_pin_reason_2}}

**When to revisit these pins:**
- After {{version_revisit_trigger_1}}
- After {{version_revisit_trigger_2}}
</library_version_pins>

---

<sources>
## Sources

All sources consulted during research. The planner can reference these for additional detail.

| Source | URL / Location | Why Consulted | Key Finding |
|--------|---------------|---------------|-------------|
| {{source_1_name}} | {{source_1_url}} | {{source_1_why}} | {{source_1_finding}} |
| {{source_2_name}} | {{source_2_url}} | {{source_2_why}} | {{source_2_finding}} |
| {{source_3_name}} | {{source_3_url}} | {{source_3_why}} | {{source_3_finding}} |
| {{source_4_name}} | {{source_4_url}} | {{source_4_why}} | {{source_4_finding}} |
| {{source_5_name}} | {{source_5_url}} | {{source_5_why}} | {{source_5_finding}} |

**Research cutoff date:** {{research_date}}
**Note:** Package versions, download counts, and API signatures should be re-verified if research is older than 30 days.
</sources>

---

*Research conducted by: /sunco:research {{phase_number}}*
*Phase plan file: .planning/phases/{{phase_number}}-{{phase_slug}}/RESEARCH.md*
*Created: {{created_date}}*
*Sources: {{sources_list}}*

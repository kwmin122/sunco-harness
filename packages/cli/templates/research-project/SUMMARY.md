# Research Summary — {{project_name}}

**Research completed:** {{research_date}}
**Project type:** {{project_type}}
**Confidence:** {{overall_confidence}}
*(HIGH | MEDIUM | LOW)*
**Agents run:** stack-researcher, features-researcher, architecture-researcher, pitfalls-researcher

> Synthesized findings from 4 parallel research agents.
> This document is the single authoritative input to project planning.
> The planner reads this and the 4 detail documents before producing the roadmap.

---

## One-Paragraph Summary

{{executive_summary}}

---

## Recommended Stack (Final)

| Concern | Choice | Version | Why |
|---------|--------|---------|-----|
| Runtime | {{final_runtime}} | {{final_runtime_version}} | {{final_runtime_why}} |
| Language | {{final_language}} | {{final_language_version}} | {{final_language_why}} |
| Framework | {{final_framework}} | {{final_framework_version}} | {{final_framework_why}} |
| Build | {{final_build}} | {{final_build_version}} | {{final_build_why}} |
| Test | {{final_test}} | {{final_test_version}} | {{final_test_why}} |
| {{dep_category_1}} | {{final_dep_1}} | {{final_dep_1_version}} | {{final_dep_1_why}} |
| {{dep_category_2}} | {{final_dep_2}} | {{final_dep_2_version}} | {{final_dep_2_why}} |
| {{dep_category_3}} | {{final_dep_3}} | {{final_dep_3_version}} | {{final_dep_3_why}} |

---

## Architecture Decision

**Chosen pattern:** {{chosen_architecture}}
**Why:** {{architecture_why}}
**Key rule:** {{architecture_key_rule}}
**Scales to:** {{architecture_scale}}

---

## Top 3 Risks to Plan Around

| Risk | Likelihood | Mitigation Required In Planning |
|------|------------|--------------------------------|
| {{top_risk_1}} | {{top_risk_1_likelihood}} | {{top_risk_1_planning_mitigation}} |
| {{top_risk_2}} | {{top_risk_2_likelihood}} | {{top_risk_2_planning_mitigation}} |
| {{top_risk_3}} | {{top_risk_3_likelihood}} | {{top_risk_3_planning_mitigation}} |

---

## Recommended Phase Structure

Based on feature dependencies and implementation order research:

| Phase | Name | Focus | Est. Duration |
|-------|------|-------|---------------|
| 01 | {{phase_01_name}} | {{phase_01_focus}} | {{phase_01_duration}} |
| 02 | {{phase_02_name}} | {{phase_02_focus}} | {{phase_02_duration}} |
| 03 | {{phase_03_name}} | {{phase_03_focus}} | {{phase_03_duration}} |
| 04 | {{phase_04_name}} | {{phase_04_focus}} | {{phase_04_duration}} |

**Total estimated duration:** {{total_estimated_duration}}

---

## Key Constraints for the Planner

From STACK.md, FEATURES.md, ARCHITECTURE.md, and PITFALLS.md — items the planner must respect:

1. **{{constraint_1_title}}:** {{constraint_1_detail}}
2. **{{constraint_2_title}}:** {{constraint_2_detail}}
3. **{{constraint_3_title}}:** {{constraint_3_detail}}
4. **{{constraint_4_title}}:** {{constraint_4_detail}}

---

## Open Questions Requiring User Input

Research could not resolve these — they require a product or business decision.

| Question | Context | Impact on Planning |
|----------|---------|-------------------|
| {{open_q_1}} | {{open_q_1_context}} | {{open_q_1_impact}} |
| {{open_q_2}} | {{open_q_2_context}} | {{open_q_2_impact}} |

---

## What to Read Next

The planner should read these documents in this order before producing the roadmap:

1. `SUMMARY.md` (this file) — synthesized overview
2. `STACK.md` — detailed technology decisions and install commands
3. `ARCHITECTURE.md` — layer model and module boundary rules
4. `FEATURES.md` — feature inventory and implementation patterns
5. `PITFALLS.md` — risks and gotchas that must inform plan design

---

*Research synthesized by: /sunco:new — synthesis agent*
*Inputs: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md*
*File: .planning/research/SUMMARY.md*
*Research date: {{research_date}}*

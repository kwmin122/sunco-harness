# Milestone: {{milestone_name}}

**Version:** {{milestone_version}}
*(semver — e.g., 0.1.0, 1.0.0-beta.1)*
**Status:** {{milestone_status}}
*(planning | active | complete | archived)*
**Created:** {{created_date}}
**Target date:** {{target_date}}
**Completed date:** {{completed_date}}
*(leave blank until complete)*

---

## Vision

> {{milestone_tagline}}

{{vision_paragraph_1}}

{{vision_paragraph_2}}

**The milestone is a success when a new user can:** {{user_success_statement}}

**What this milestone deliberately does NOT include:** {{non_goals}}

---

## User Impact

### Who benefits

{{target_persona}} — {{target_persona_description}}

**Their current pain:** {{current_pain}}
**What changes for them:** {{after_state}}
**Measurable outcome:** {{measurable_outcome}}

### Before / After

| Before this milestone | After this milestone |
|----------------------|---------------------|
| {{before_1}} | {{after_1}} |
| {{before_2}} | {{after_2}} |
| {{before_3}} | {{after_3}} |

---

## Exit Criteria

All of the following must be true for this milestone to be declared complete. Each criterion is specific and testable — no subjective judgment calls.

### Functional Criteria

- [ ] **{{func_criterion_1_title}}:** {{func_criterion_1_test}}
- [ ] **{{func_criterion_2_title}}:** {{func_criterion_2_test}}
- [ ] **{{func_criterion_3_title}}:** {{func_criterion_3_test}}
- [ ] **{{func_criterion_4_title}}:** {{func_criterion_4_test}}
- [ ] **{{func_criterion_5_title}}:** {{func_criterion_5_test}}

### Quality Criteria

- [ ] All tests pass with zero failures (`{{test_command}}`)
- [ ] Lint gate clean (`/sunco:lint` zero errors)
- [ ] TypeScript strict pass (`npx tsc --noEmit`)
- [ ] Code coverage ≥ {{coverage_threshold}}% for modified modules
- [ ] No `TODO` or `FIXME` in shipped code
- [ ] Performance criterion: {{performance_criterion}}

### Delivery Criteria

- [ ] Changelog entry written for {{milestone_version}}
- [ ] npm publish succeeds (`npm publish --dry-run` then live)
- [ ] Git tag `v{{milestone_version}}` created and pushed
- [ ] RELEASE.md written with upgrade notes
- [ ] UAT sign-off from: {{uat_signer}}

---

## Phase References

Phases that contribute to this milestone, in execution order:

| Phase | Name | Status | Plans | Contributes |
|-------|------|--------|-------|-------------|
| {{phase_ref_1_number}} | {{phase_ref_1_name}} | {{phase_ref_1_status}} | {{phase_ref_1_plans}} | {{phase_ref_1_contributes}} |
| {{phase_ref_2_number}} | {{phase_ref_2_name}} | {{phase_ref_2_status}} | {{phase_ref_2_plans}} | {{phase_ref_2_contributes}} |
| {{phase_ref_3_number}} | {{phase_ref_3_name}} | {{phase_ref_3_status}} | {{phase_ref_3_plans}} | {{phase_ref_3_contributes}} |
| {{phase_ref_4_number}} | {{phase_ref_4_name}} | {{phase_ref_4_status}} | {{phase_ref_4_plans}} | {{phase_ref_4_contributes}} |

**Total requirements covered:** {{reqs_covered}}/{{reqs_total}}
**Requirement IDs:** {{req_ids_list}}

---

## Requirements Mapping

| Req ID | Title | Phase | Status |
|--------|-------|-------|--------|
| {{req_1_id}} | {{req_1_title}} | Phase {{req_1_phase}} | {{req_1_status}} |
| {{req_2_id}} | {{req_2_title}} | Phase {{req_2_phase}} | {{req_2_status}} |
| {{req_3_id}} | {{req_3_title}} | Phase {{req_3_phase}} | {{req_3_status}} |
| {{req_4_id}} | {{req_4_title}} | Phase {{req_4_phase}} | {{req_4_status}} |
| {{req_5_id}} | {{req_5_title}} | Phase {{req_5_phase}} | {{req_5_status}} |

---

## Timeline Estimate

| Phase | Estimated Duration | Dependencies | Start Condition |
|-------|--------------------|--------------|-----------------|
| {{phase_ref_1_number}} | {{phase_ref_1_duration}} | None | Milestone starts |
| {{phase_ref_2_number}} | {{phase_ref_2_duration}} | Phase {{phase_ref_1_number}} | Phase {{phase_ref_1_number}} complete |
| {{phase_ref_3_number}} | {{phase_ref_3_duration}} | Phase {{phase_ref_2_number}} | Phase {{phase_ref_2_number}} complete |
| {{phase_ref_4_number}} | {{phase_ref_4_duration}} | All prior | All phases complete |

**Total estimated duration:** {{total_estimated_duration}}
**Buffer / contingency:** {{contingency_time}}
**Hard deadline (if any):** {{hard_deadline}}

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| {{risk_1}} | {{risk_1_likelihood}} | {{risk_1_impact}} | {{risk_1_mitigation}} |
| {{risk_2}} | {{risk_2_likelihood}} | {{risk_2_impact}} | {{risk_2_mitigation}} |
| {{risk_3}} | {{risk_3_likelihood}} | {{risk_3_impact}} | {{risk_3_mitigation}} |

---

## Progress Snapshot

**Current state:** {{current_progress_summary}}

**Phases complete:** {{phases_complete}}/{{phases_total}}
**Plans complete:** {{plans_complete}}/{{plans_total}}
**Exit criteria met:** {{criteria_met}}/{{criteria_total}}

---

## Retrospective Notes

*(Filled in after milestone completes)*

**What went well:** {{retro_went_well}}
**What to improve:** {{retro_improve}}
**Key learnings:** {{retro_learnings}}

---

*Milestone managed by: /sunco:milestone*
*File: .planning/milestones/{{milestone_version}}.md*
*Created: {{created_date}}*
*Last updated: {{last_updated}}*

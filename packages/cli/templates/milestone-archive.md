# Milestone Archive — {{milestone_name}}

**Milestone:** {{milestone_name}}
**Version:** {{milestone_version}}
**Archived:** {{archive_date}}
**Duration:** {{milestone_duration}}
*(from {{milestone_start}} to {{milestone_end}})*
**Status at archive:** {{milestone_status}}
*(completed | partially-completed | cancelled)*

---

## Milestone Summary

{{milestone_summary}}

---

## Goals vs. Achieved

| Goal | Target | Achieved | Notes |
|------|--------|---------|-------|
| {{goal_1}} | {{goal_1_target}} | {{goal_1_achieved}} | {{goal_1_notes}} |
| {{goal_2}} | {{goal_2_target}} | {{goal_2_achieved}} | {{goal_2_notes}} |
| {{goal_3}} | {{goal_3_target}} | {{goal_3_achieved}} | {{goal_3_notes}} |
| {{goal_4}} | {{goal_4_target}} | {{goal_4_achieved}} | {{goal_4_notes}} |

---

## Phases Completed

| Phase | Name | Plans | Status | Key Output |
|-------|------|-------|--------|------------|
| {{phase_1_number}} | {{phase_1_name}} | {{phase_1_plans}} | {{phase_1_status}} | {{phase_1_output}} |
| {{phase_2_number}} | {{phase_2_name}} | {{phase_2_plans}} | {{phase_2_status}} | {{phase_2_output}} |
| {{phase_3_number}} | {{phase_3_name}} | {{phase_3_plans}} | {{phase_3_status}} | {{phase_3_output}} |
| {{phase_4_number}} | {{phase_4_name}} | {{phase_4_plans}} | {{phase_4_status}} | {{phase_4_output}} |

**Total plans executed:** {{total_plans}}
**Total commits:** {{total_commits}}

---

## Requirements Coverage

| Req ID | Description | Status | Phase |
|--------|-------------|--------|-------|
| {{req_1_id}} | {{req_1_description}} | {{req_1_status}} | {{req_1_phase}} |
| {{req_2_id}} | {{req_2_description}} | {{req_2_status}} | {{req_2_phase}} |
| {{req_3_id}} | {{req_3_description}} | {{req_3_status}} | {{req_3_phase}} |
| {{req_4_id}} | {{req_4_description}} | {{req_4_status}} | {{req_4_phase}} |
| {{req_5_id}} | {{req_5_description}} | {{req_5_status}} | {{req_5_phase}} |

**Coverage:** {{reqs_completed}}/{{reqs_total}} requirements delivered

---

## Key Deliverables

| Deliverable | File/Artifact | Description |
|-------------|---------------|-------------|
| {{deliverable_1_name}} | `{{deliverable_1_path}}` | {{deliverable_1_description}} |
| {{deliverable_2_name}} | `{{deliverable_2_path}}` | {{deliverable_2_description}} |
| {{deliverable_3_name}} | `{{deliverable_3_path}}` | {{deliverable_3_description}} |
| {{deliverable_4_name}} | `{{deliverable_4_path}}` | {{deliverable_4_description}} |

---

## Metrics at Archive

| Metric | Value | Trend |
|--------|-------|-------|
| Test coverage | {{metric_coverage}} | {{metric_coverage_trend}} |
| Lint errors | {{metric_lint_errors}} | {{metric_lint_trend}} |
| TypeScript errors | {{metric_ts_errors}} | {{metric_ts_trend}} |
| Bundle size | {{metric_bundle_size}} | {{metric_bundle_trend}} |
| Build time | {{metric_build_time}} | {{metric_build_trend}} |

---

## What Went Well

{{what_went_well}}

---

## What Didn't Go Well

{{what_didnt_go_well}}

---

## Lessons Learned

| Lesson | Category | Action for Next Milestone |
|--------|----------|--------------------------|
| {{lesson_1}} | {{lesson_1_category}} | {{lesson_1_action}} |
| {{lesson_2}} | {{lesson_2_category}} | {{lesson_2_action}} |
| {{lesson_3}} | {{lesson_3_category}} | {{lesson_3_action}} |

---

## Deferred to Next Milestone

| Item | Reason Deferred | Priority |
|------|----------------|---------|
| {{deferred_1}} | {{deferred_1_reason}} | {{deferred_1_priority}} |
| {{deferred_2}} | {{deferred_2_reason}} | {{deferred_2_priority}} |
| {{deferred_3}} | {{deferred_3_reason}} | {{deferred_3_priority}} |

---

## Release

**Git tag:** `{{git_tag}}`
**Changelog:** `.planning/CHANGELOG.md#{{milestone_version}}`
**PR/Branch:** {{pr_link}}
**Release notes:** {{release_notes_link}}

---

*Milestone archived by: /sunco:milestone complete*
*File: .planning/archive/{{milestone_version}}-{{milestone_slug}}.md*
*Next milestone: {{next_milestone_name}}*

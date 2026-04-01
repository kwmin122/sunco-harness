---
phase: {{phase_number}}-{{phase_slug}}
verified: {{verified_timestamp}}
status: {{verification_status}}
score: {{verified_count}}/{{total_count}} must-haves verified
---

# Phase {{phase_number}}: {{phase_name}} — Verification Report

**Phase Goal:** {{phase_goal}}
**Verified:** {{verified_timestamp}}
**Status:** {{verification_status}}
*(passed | gaps_found | human_needed)*
**Verifier:** {{verifier}}
*(Claude subagent | human | both)*

---

## Goal Achievement

### Layer 1: Observable Truths

Behaviors that must be demonstrably true in the running system.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | {{truth_1}} | {{truth_1_status}} | {{truth_1_evidence}} |
| 2 | {{truth_2}} | {{truth_2_status}} | {{truth_2_evidence}} |
| 3 | {{truth_3}} | {{truth_3_status}} | {{truth_3_evidence}} |
| 4 | {{truth_4}} | {{truth_4_status}} | {{truth_4_evidence}} |

**Score:** {{truths_verified}}/{{truths_total}} truths verified

*Status values: ✓ VERIFIED | ✗ FAILED | ? UNCERTAIN*

---

### Layer 2: Required Artifacts

Files that must exist with real (non-stub) implementation.

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `{{artifact_1_path}}` | {{artifact_1_expected}} | {{artifact_1_status}} | {{artifact_1_details}} |
| `{{artifact_2_path}}` | {{artifact_2_expected}} | {{artifact_2_status}} | {{artifact_2_details}} |
| `{{artifact_3_path}}` | {{artifact_3_expected}} | {{artifact_3_status}} | {{artifact_3_details}} |
| `{{artifact_4_path}}` | {{artifact_4_expected}} | {{artifact_4_status}} | {{artifact_4_details}} |

**Score:** {{artifacts_verified}}/{{artifacts_total}} artifacts verified

*Status values: ✓ EXISTS + SUBSTANTIVE | ✗ STUB | ✗ MISSING | ⚠️ PARTIAL*

---

### Layer 3: Key Link Verification

Critical connections between artifacts — the wiring that makes the system work.

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| {{link_1_from}} | {{link_1_to}} | {{link_1_via}} | {{link_1_status}} | {{link_1_details}} |
| {{link_2_from}} | {{link_2_to}} | {{link_2_via}} | {{link_2_status}} | {{link_2_details}} |
| {{link_3_from}} | {{link_3_to}} | {{link_3_via}} | {{link_3_status}} | {{link_3_details}} |

**Score:** {{links_verified}}/{{links_total}} connections verified

---

### Layer 4: Test Gate

| Suite | Command | Status | Passed | Failed | Coverage |
|-------|---------|--------|--------|--------|----------|
| {{test_suite_1}} | `{{test_command_1}}` | {{test_1_status}} | {{test_1_passed}} | {{test_1_failed}} | {{test_1_coverage}} |
| {{test_suite_2}} | `{{test_command_2}}` | {{test_2_status}} | {{test_2_passed}} | {{test_2_failed}} | {{test_2_coverage}} |

**New tests added this phase:** {{new_tests_count}}

---

### Layer 5: Lint & Type Gate

| Check | Command | Status | Details |
|-------|---------|--------|---------|
| Architecture lint | `/sunco:lint` | {{lint_status}} | {{lint_details}} |
| TypeScript | `npx tsc --noEmit` | {{tsc_status}} | {{tsc_details}} |
| ESLint | `npx eslint src/` | {{eslint_status}} | {{eslint_details}} |

---

### Layer 6: Guard Rails Check

Automated safety checks for this phase.

| Guard | Status | Details |
|-------|--------|---------|
| No hardcoded secrets | {{guard_secrets_status}} | {{guard_secrets_details}} |
| No circular imports | {{guard_circular_status}} | {{guard_circular_details}} |
| No `any` types | {{guard_any_status}} | {{guard_any_details}} |
| No TODO/FIXME in production | {{guard_todo_status}} | {{guard_todo_details}} |
| No unused exports | {{guard_unused_status}} | {{guard_unused_details}} |

---

### Layer 7: Requirements Coverage

| Requirement | Description | Status | Blocking Issue |
|-------------|-------------|--------|----------------|
| {{req_1_id}} | {{req_1_description}} | {{req_1_status}} | {{req_1_blocker}} |
| {{req_2_id}} | {{req_2_description}} | {{req_2_status}} | {{req_2_blocker}} |
| {{req_3_id}} | {{req_3_description}} | {{req_3_status}} | {{req_3_blocker}} |

**Coverage:** {{reqs_satisfied}}/{{reqs_total}} requirements satisfied

*Status values: ✓ SATISFIED | ✗ BLOCKED | ? NEEDS HUMAN*

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| {{antipattern_1_file}} | {{antipattern_1_line}} | {{antipattern_1_pattern}} | {{antipattern_1_severity}} | {{antipattern_1_impact}} |
| {{antipattern_2_file}} | {{antipattern_2_line}} | {{antipattern_2_pattern}} | {{antipattern_2_severity}} | {{antipattern_2_impact}} |

**Anti-patterns:** {{antipatterns_total}} found ({{antipatterns_blockers}} blockers, {{antipatterns_warnings}} warnings)

*Severity: 🛑 Blocker (must fix) | ⚠️ Warning (should fix) | ℹ️ Info (optional)*

---

## Human Verification Required

{{#if no_human_verification}}
None — all verifiable items confirmed programmatically.
{{/if}}

{{#if human_verification_needed}}
### 1. {{human_check_1_name}}
**Test:** {{human_check_1_test}}
**Expected:** {{human_check_1_expected}}
**Why human:** {{human_check_1_why}}

### 2. {{human_check_2_name}}
**Test:** {{human_check_2_test}}
**Expected:** {{human_check_2_expected}}
**Why human:** {{human_check_2_why}}
{{/if}}

---

## Gaps Summary

{{#if no_gaps}}
**No gaps found.** Phase goal achieved. All 7 verification layers passed. Ready to proceed.
{{/if}}

{{#if gaps_found}}

### Critical Gaps — Block Progress

1. **{{critical_gap_1_name}}**
   - Missing: {{critical_gap_1_missing}}
   - Impact: {{critical_gap_1_impact}}
   - Fix: {{critical_gap_1_fix}}

2. **{{critical_gap_2_name}}**
   - Missing: {{critical_gap_2_missing}}
   - Impact: {{critical_gap_2_impact}}
   - Fix: {{critical_gap_2_fix}}

### Non-Critical Gaps — Can Defer

1. **{{noncritical_gap_1_name}}**
   - Issue: {{noncritical_gap_1_issue}}
   - Impact: {{noncritical_gap_1_impact}}
   - Recommendation: {{noncritical_gap_1_recommendation}}

{{/if}}

---

## Recommended Fix Plans

{{#if fix_plans_needed}}

### {{phase_number}}-{{fix_plan_1_number}}-PLAN.md: {{fix_plan_1_name}}

**Objective:** {{fix_plan_1_objective}}

**Tasks:**
1. {{fix_plan_1_task_1}}
2. {{fix_plan_1_task_2}}
3. {{fix_plan_1_task_3}}

**Estimated scope:** {{fix_plan_1_scope}}
*(Small | Medium | Large)*

---

### {{phase_number}}-{{fix_plan_2_number}}-PLAN.md: {{fix_plan_2_name}}

**Objective:** {{fix_plan_2_objective}}

**Tasks:**
1. {{fix_plan_2_task_1}}
2. {{fix_plan_2_task_2}}

**Estimated scope:** {{fix_plan_2_scope}}

{{/if}}

---

## Verification Metadata

**Verification approach:** {{verification_approach}}
*(goal-backward | checklist | requirements-forward)*
**Must-haves source:** {{must_haves_source}}
*(PLAN.md frontmatter | derived from ROADMAP.md goal)*
**Automated checks:** {{automated_passed}} passed, {{automated_failed}} failed
**Human checks required:** {{human_checks_count}}
**Total verification time:** {{verification_duration}}
**Phase plans verified:** {{plans_verified_count}} plans

---

*Verified: {{verified_timestamp}}*
*Verifier: {{verifier_agent}}*
*Phase: .planning/phases/{{phase_number}}-{{phase_slug}}/*
*Report: .planning/phases/{{phase_number}}-{{phase_slug}}/VERIFICATION.md*

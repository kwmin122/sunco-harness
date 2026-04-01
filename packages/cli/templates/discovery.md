# Codebase Discovery — {{project_name}}

**Scanned:** {{scan_date}}
**Scanner:** {{scanner}}
*(Claude subagent | /sunco:scan | manual)*
**Codebase root:** `{{codebase_root}}`
**Confidence:** {{confidence_level}}

---

## Summary

{{discovery_summary}}

**Key finding:** {{key_finding}}
**Recommended entry point for new work:** {{recommended_entry_point}}

---

## Project Identity

| Property | Value |
|----------|-------|
| Project name | {{project_name}} |
| Language(s) | {{languages}} |
| Runtime | {{runtime}} |
| Package manager | {{package_manager}} |
| Monorepo | {{is_monorepo}} |
| Framework | {{framework}} |
| Test framework | {{test_framework}} |
| Build tool | {{build_tool}} |
| Estimated LOC | {{estimated_loc}} |
| Active contributors | {{active_contributors}} |
| Last commit | {{last_commit}} |

---

## Directory Structure

```
{{directory_tree}}
```

---

## Architecture Layers

| Layer | Location | Purpose | Entry Points |
|-------|----------|---------|--------------|
| {{layer_1_name}} | `{{layer_1_path}}` | {{layer_1_purpose}} | {{layer_1_entry}} |
| {{layer_2_name}} | `{{layer_2_path}}` | {{layer_2_purpose}} | {{layer_2_entry}} |
| {{layer_3_name}} | `{{layer_3_path}}` | {{layer_3_purpose}} | {{layer_3_entry}} |
| {{layer_4_name}} | `{{layer_4_path}}` | {{layer_4_purpose}} | {{layer_4_entry}} |
| {{layer_5_name}} | `{{layer_5_path}}` | {{layer_5_purpose}} | {{layer_5_entry}} |

**Dependency direction:** {{dependency_direction}}
*(e.g., "cli → core → shared, no reverse deps")*

---

## Key Files

| File | Role | Why Important |
|------|------|--------------|
| `{{key_file_1}}` | {{key_file_1_role}} | {{key_file_1_why}} |
| `{{key_file_2}}` | {{key_file_2_role}} | {{key_file_2_why}} |
| `{{key_file_3}}` | {{key_file_3_role}} | {{key_file_3_why}} |
| `{{key_file_4}}` | {{key_file_4_role}} | {{key_file_4_why}} |
| `{{key_file_5}}` | {{key_file_5_role}} | {{key_file_5_why}} |

---

## Dependencies

### Production

| Package | Version | Purpose | Critical |
|---------|---------|---------|---------|
| {{prod_dep_1}} | {{prod_dep_1_version}} | {{prod_dep_1_purpose}} | {{prod_dep_1_critical}} |
| {{prod_dep_2}} | {{prod_dep_2_version}} | {{prod_dep_2_purpose}} | {{prod_dep_2_critical}} |
| {{prod_dep_3}} | {{prod_dep_3_version}} | {{prod_dep_3_purpose}} | {{prod_dep_3_critical}} |

### Development

| Package | Version | Purpose |
|---------|---------|---------|
| {{dev_dep_1}} | {{dev_dep_1_version}} | {{dev_dep_1_purpose}} |
| {{dev_dep_2}} | {{dev_dep_2_version}} | {{dev_dep_2_purpose}} |

**Outdated packages:** {{outdated_count}}
**Security vulnerabilities:** {{vulnerability_count}}

---

## Patterns Detected

| Pattern | Location | Description |
|---------|----------|-------------|
| {{pattern_1_name}} | `{{pattern_1_location}}` | {{pattern_1_description}} |
| {{pattern_2_name}} | `{{pattern_2_location}}` | {{pattern_2_description}} |
| {{pattern_3_name}} | `{{pattern_3_location}}` | {{pattern_3_description}} |

---

## Technical Debt

| Issue | Location | Severity | Estimated Effort |
|-------|----------|---------|-----------------|
| {{debt_1_issue}} | `{{debt_1_location}}` | {{debt_1_severity}} | {{debt_1_effort}} |
| {{debt_2_issue}} | `{{debt_2_location}}` | {{debt_2_severity}} | {{debt_2_effort}} |
| {{debt_3_issue}} | `{{debt_3_location}}` | {{debt_3_severity}} | {{debt_3_effort}} |

---

## Gaps & Opportunities

{{gaps_and_opportunities}}

---

*Discovery created by: /sunco:scan*
*File: .planning/DISCOVERY.md*
*Re-run: `sunco scan` to refresh*

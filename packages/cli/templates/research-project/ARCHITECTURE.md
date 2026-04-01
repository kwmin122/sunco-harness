# Architecture Research — {{project_name}}

**Researched:** {{research_date}}
**Agent:** architecture-researcher
**Project type:** {{project_type}}

> Architecture patterns appropriate for this project type. Based on standard industry patterns, not invented.
> Presents the dominant approach plus viable alternatives with honest tradeoffs.

---

## Recommended Architecture

**Pattern:** {{recommended_pattern}}
**Classification:** {{architecture_classification}}
*(layered | hexagonal | event-driven | CQRS | microservices | modular monolith | ...)*

**Why this pattern for this project:**
- {{pattern_reason_1}}
- {{pattern_reason_2}}
- {{pattern_reason_3}}

---

## High-Level Structure

```
{{high_level_structure_diagram}}
```

**Layer responsibilities:**

| Layer | Name | Responsibility | Has Side Effects? |
|-------|------|----------------|-------------------|
| {{layer_1_num}} | {{layer_1_name}} | {{layer_1_responsibility}} | {{layer_1_side_effects}} |
| {{layer_2_num}} | {{layer_2_name}} | {{layer_2_responsibility}} | {{layer_2_side_effects}} |
| {{layer_3_num}} | {{layer_3_name}} | {{layer_3_responsibility}} | {{layer_3_side_effects}} |
| {{layer_4_num}} | {{layer_4_name}} | {{layer_4_responsibility}} | {{layer_4_side_effects}} |

---

## Module Boundary Rules

| Rule | Enforced By | Example |
|------|-------------|---------|
| {{rule_1}} | {{rule_1_enforcement}} | {{rule_1_example}} |
| {{rule_2}} | {{rule_2_enforcement}} | {{rule_2_example}} |
| {{rule_3}} | {{rule_3_enforcement}} | {{rule_3_example}} |

---

## Data Flow

### Primary path

```
{{primary_data_flow}}
```

### State management approach

**Recommended:** {{state_management_approach}}
**Why:** {{state_management_rationale}}
**Alternative considered:** {{state_management_alt}} — {{state_management_alt_reason}}

---

## Architecture Alternatives

| Pattern | Pros | Cons | When to Choose |
|---------|------|------|----------------|
| {{alt_pattern_1}} | {{alt_pattern_1_pros}} | {{alt_pattern_1_cons}} | {{alt_pattern_1_when}} |
| {{alt_pattern_2}} | {{alt_pattern_2_pros}} | {{alt_pattern_2_cons}} | {{alt_pattern_2_when}} |

**Verdict:** {{architecture_verdict}}

---

## Scalability Considerations

**Current design scales to:** {{scalability_ceiling}}
**Bottleneck at scale:** {{scalability_bottleneck}}
**Migration path when outgrown:** {{scalability_migration}}

---

## Testing Strategy for This Architecture

| Layer | Test Type | Isolation Strategy |
|-------|-----------|-------------------|
| {{test_layer_1}} | {{test_layer_1_type}} | {{test_layer_1_isolation}} |
| {{test_layer_2}} | {{test_layer_2_type}} | {{test_layer_2_isolation}} |
| {{test_layer_3}} | {{test_layer_3_type}} | {{test_layer_3_isolation}} |

---

*Research by: /sunco:new — architecture-researcher agent*
*File: .planning/research/ARCHITECTURE.md*
*Research date: {{research_date}}*

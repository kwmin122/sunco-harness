# Feature Implementation Research — {{project_name}}

**Researched:** {{research_date}}
**Agent:** features-researcher
**Project type:** {{project_type}}

> How to implement the core features of this project. Pattern research, not product design.
> Answers the question: "given that we're building X, what's the standard way to implement Y?"

---

## Feature Inventory

Features identified from the project brief, ordered by implementation dependency.

| # | Feature | Complexity | Depends On | Standard Pattern Available? |
|---|---------|------------|------------|----------------------------|
| {{feat_1_id}} | {{feat_1_name}} | {{feat_1_complexity}} | — | {{feat_1_pattern}} |
| {{feat_2_id}} | {{feat_2_name}} | {{feat_2_complexity}} | {{feat_2_depends}} | {{feat_2_pattern}} |
| {{feat_3_id}} | {{feat_3_name}} | {{feat_3_complexity}} | {{feat_3_depends}} | {{feat_3_pattern}} |
| {{feat_4_id}} | {{feat_4_name}} | {{feat_4_complexity}} | {{feat_4_depends}} | {{feat_4_pattern}} |
| {{feat_5_id}} | {{feat_5_name}} | {{feat_5_complexity}} | {{feat_5_depends}} | {{feat_5_pattern}} |

*Complexity: low | medium | high*

---

## Feature: {{feature_1_name}}

**Standard implementation approach:** {{feature_1_approach}}
**Library/API used:** {{feature_1_library}}
**Pattern:** {{feature_1_pattern_name}}

**Key considerations:**
- {{feature_1_consideration_1}}
- {{feature_1_consideration_2}}
- {{feature_1_consideration_3}}

**Reference implementation:**
```
{{feature_1_reference}}
```

---

## Feature: {{feature_2_name}}

**Standard implementation approach:** {{feature_2_approach}}
**Library/API used:** {{feature_2_library}}
**Pattern:** {{feature_2_pattern_name}}

**Key considerations:**
- {{feature_2_consideration_1}}
- {{feature_2_consideration_2}}

---

## Feature: {{feature_3_name}}

**Standard implementation approach:** {{feature_3_approach}}
**Library/API used:** {{feature_3_library}}
**Pattern:** {{feature_3_pattern_name}}

**Key considerations:**
- {{feature_3_consideration_1}}
- {{feature_3_consideration_2}}

---

## Feature Interaction Map

Features that affect each other's implementation.

| Feature A | Feature B | Interaction | Resolution |
|-----------|-----------|-------------|------------|
| {{int_feat_1_a}} | {{int_feat_1_b}} | {{int_feat_1_interaction}} | {{int_feat_1_resolution}} |
| {{int_feat_2_a}} | {{int_feat_2_b}} | {{int_feat_2_interaction}} | {{int_feat_2_resolution}} |

---

## Implementation Order Recommendation

```
Phase 1 (foundation):
  {{phase_1_features}}

Phase 2 (core features):
  {{phase_2_features}}

Phase 3 (integration):
  {{phase_3_features}}
```

**Rationale:** {{implementation_order_rationale}}

---

*Research by: /sunco:new — features-researcher agent*
*File: .planning/research/FEATURES.md*
*Research date: {{research_date}}*

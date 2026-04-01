# Pitfalls & Risks Research — {{project_name}}

**Researched:** {{research_date}}
**Agent:** pitfalls-researcher
**Project type:** {{project_type}}

> Known failure modes, gotchas, and risks for this type of project.
> Sourced from issue trackers, post-mortems, StackOverflow patterns, and library documentation.
> The purpose is to front-load awareness so these don't cause surprises mid-execution.

---

## Critical Pitfalls

Pitfalls that, if encountered, block progress or corrupt data. Must be addressed in initial planning.

### Pitfall 1: {{critical_pitfall_1_name}}

**What goes wrong:** {{critical_pitfall_1_description}}
**Root cause:** {{critical_pitfall_1_root_cause}}
**How common:** {{critical_pitfall_1_frequency}}
**Consequence if hit:** {{critical_pitfall_1_consequence}}

**Prevention:**
- {{critical_pitfall_1_prevention_1}}
- {{critical_pitfall_1_prevention_2}}

**Early warning signs:**
- {{critical_pitfall_1_warning_1}}
- {{critical_pitfall_1_warning_2}}

**If already hit:** {{critical_pitfall_1_recovery}}

---

### Pitfall 2: {{critical_pitfall_2_name}}

**What goes wrong:** {{critical_pitfall_2_description}}
**Root cause:** {{critical_pitfall_2_root_cause}}
**Consequence if hit:** {{critical_pitfall_2_consequence}}

**Prevention:**
- {{critical_pitfall_2_prevention_1}}
- {{critical_pitfall_2_prevention_2}}

**If already hit:** {{critical_pitfall_2_recovery}}

---

### Pitfall 3: {{critical_pitfall_3_name}}

**What goes wrong:** {{critical_pitfall_3_description}}
**Root cause:** {{critical_pitfall_3_root_cause}}
**Consequence if hit:** {{critical_pitfall_3_consequence}}

**Prevention:**
- {{critical_pitfall_3_prevention_1}}

**If already hit:** {{critical_pitfall_3_recovery}}

---

## Common Mistakes

Mistakes that slow progress without blocking it. Document to avoid repeating them.

| Mistake | Why It Happens | Correct Approach |
|---------|---------------|-----------------|
| {{mistake_1}} | {{mistake_1_why}} | {{mistake_1_correct}} |
| {{mistake_2}} | {{mistake_2_why}} | {{mistake_2_correct}} |
| {{mistake_3}} | {{mistake_3_why}} | {{mistake_3_correct}} |
| {{mistake_4}} | {{mistake_4_why}} | {{mistake_4_correct}} |

---

## Library-Specific Gotchas

Known issues with the libraries in the recommended stack.

| Library | Gotcha | Version Affected | Workaround |
|---------|--------|-----------------|------------|
| {{lib_gotcha_1_lib}} | {{lib_gotcha_1_gotcha}} | {{lib_gotcha_1_version}} | {{lib_gotcha_1_workaround}} |
| {{lib_gotcha_2_lib}} | {{lib_gotcha_2_gotcha}} | {{lib_gotcha_2_version}} | {{lib_gotcha_2_workaround}} |
| {{lib_gotcha_3_lib}} | {{lib_gotcha_3_gotcha}} | {{lib_gotcha_3_version}} | {{lib_gotcha_3_workaround}} |

---

## Security Risks for This Project Type

| Risk | OWASP Category | Likelihood | Standard Mitigation |
|------|---------------|------------|---------------------|
| {{sec_risk_1}} | {{sec_risk_1_owasp}} | {{sec_risk_1_likelihood}} | {{sec_risk_1_mitigation}} |
| {{sec_risk_2}} | {{sec_risk_2_owasp}} | {{sec_risk_2_likelihood}} | {{sec_risk_2_mitigation}} |
| {{sec_risk_3}} | {{sec_risk_3_owasp}} | {{sec_risk_3_likelihood}} | {{sec_risk_3_mitigation}} |

---

## Risk Register

All identified risks with mitigation strategies, for use during planning.

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| R-01 | {{risk_reg_1}} | {{risk_reg_1_prob}} | {{risk_reg_1_impact}} | {{risk_reg_1_mitigation}} | {{risk_reg_1_owner}} |
| R-02 | {{risk_reg_2}} | {{risk_reg_2_prob}} | {{risk_reg_2_impact}} | {{risk_reg_2_mitigation}} | {{risk_reg_2_owner}} |
| R-03 | {{risk_reg_3}} | {{risk_reg_3_prob}} | {{risk_reg_3_impact}} | {{risk_reg_3_mitigation}} | {{risk_reg_3_owner}} |
| R-04 | {{risk_reg_4}} | {{risk_reg_4_prob}} | {{risk_reg_4_impact}} | {{risk_reg_4_mitigation}} | {{risk_reg_4_owner}} |

*Probability: High (>50%) | Medium (20-50%) | Low (<20%)*
*Impact: High (blocks ship) | Medium (slows execution) | Low (cosmetic)*

---

*Research by: /sunco:new — pitfalls-researcher agent*
*File: .planning/research/PITFALLS.md*
*Research date: {{research_date}}*

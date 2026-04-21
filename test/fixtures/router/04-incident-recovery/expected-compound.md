---
kind: compound
version: 1
scope: incident
ref: phase-45-incident
window:
  from: 2026-04-21T12:00:00.000Z
  to: 2026-04-21T16:00:00.000Z
status: proposed
source_evidence:
  - test/fixtures/router/04-incident-recovery/route-decisions/2026-04-21T140000-WORK.json
  - test/fixtures/router/04-incident-recovery/route-decisions/2026-04-21T150000-COMPOUND.json
sections:
  - context
  - learnings
  - patterns_sdi
  - rule_promotions
  - automation
  - seeds
  - memory_proposals
  - approval_log
clean_room_notice: true
generated_by: sunco-compound-router
---

> **Clean-room notice.** SUNCO Workflow Router is a clean-room design inspired only by the general workflow idea of recurring stages (Brainstorm → Plan → Work → Review → Compound → Repeat). No code, prompts, command files, schemas, agent definitions, skill implementations, or documentation text from compound-engineering-plugin or any third-party workflow/compound/retrospective tool is copied, vendored, or adapted into SUNCO. SUNCO uses its own planning artifacts, approval boundaries, state machine, and router implementation authored independently against the SUNCO codebase.

# Compound Artifact — incident phase-45-incident (scenario 4 oracle)

## context

Incident recovery complete after CI failure + rollback anchor use + post-judge fix series. Score ≥5 triggers non-always-on compound write. This is a Phase 55 dogfood fixture oracle — not a real incident compound artifact.

## learnings

- Score composition: `ci_recovered: +2` + `rollback_used: +2` + `post_judge_fix: +3` = 7 (above threshold 5)
- Rollback anchor usage is an SDI observational signal worth surfacing into sink proposer's patterns_sdi bucket
- Post-judge fix pattern matches Phase 53 / Phase 54 observed-only learning fixtures

## patterns_sdi

- **Rollback anchor used for incident recovery** — observed ≥2 times across v1.4/v1.5; SDI counter delta `+1 toward PIL 999.x promotion`
- **CI failure → fix commit loop** — observed ≥2 times; SDI counter delta `+1`

## rule_promotions

None in this fixture.

## automation

Candidate: automate rollback anchor creation on CI-failure detection (proposal-only).

## seeds

None.

## memory_proposals

Candidate: memory `feedback_incident_recovery.md` capturing rollback-anchor-first recovery pattern (proposal-only; user ACK required).

## approval_log

Scenario 4 is a fixture oracle; no real approval events.

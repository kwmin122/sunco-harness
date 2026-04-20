# Compound Artifact — `<scope>-<ref>-<YYYYMMDD>`

<!--
Template for compound artifacts written by SUNCO compound-router.

Clean-room notice. SUNCO Workflow Router is a clean-room design inspired only by the general workflow idea of recurring stages (Brainstorm → Plan → Work → Review → Compound → Repeat). No code, prompts, command files, schemas, agent definitions, skill implementations, or documentation text from compound-engineering-plugin or any third-party workflow/compound/retrospective tool is copied, vendored, or adapted into SUNCO. SUNCO uses its own planning artifacts, approval boundaries, state machine, and router implementation authored independently against the SUNCO codebase.

This template is consumed by `packages/cli/references/compound/src/compound-router.mjs`. Section names MUST match `schemas/compound.schema.json` `sections` enum exactly and appear in the canonical order below.
-->

---
kind: compound
version: 1
scope: <release|milestone|phase|incident|ad_hoc>
ref: <scope-local-id>
window:
  from: <ISO-date-time>
  to: <ISO-date-time>
status: proposed
source_evidence:
  - <relative/path/to/.planning/router/decisions/YYYYMMDD-HHMMSS-STAGE.json>
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

## context

What happened in the window. Reference `source_evidence[]` RouteDecision files (stage transitions, confidence bands, freshness status, approval envelope hits). Summarize the user-visible outcome (release shipped / milestone closed / incident recovered / phase completed).

## learnings

Explicit takeaways. What worked. What surprised. What was avoided. Kept concrete — reference commits / PRs / plan artifacts, not abstractions.

## patterns_sdi

SDI-observational proposals emitted by `sink-proposer.mjs` (L3 +2 source in trigger score model). Each pattern:

- **Pattern name**: short label
- **Occurrence count**: `N` observations in window
- **Suggested SDI counter delta**: `+1` toward PIL 999.x promotion threshold
- **Evidence**: commits / files / plan artifacts where the pattern appeared

These are proposals only. User ACK required before any SDI counter state change; sink-proposer never writes to SDI counter state directly.

(Empty section if no SDI-observational patterns detected in the window.)

## rule_promotions

Spec-rule-prescriptive proposals emitted by `sink-proposer.mjs` (L3 +3 source in trigger score model). Each promotion:

- **Target rule file**: `.claude/rules/<file>`
- **Rationale**: why this pattern violates or extends the existing rule
- **Diff preview**: proposed edit as code-fenced markdown

```diff
# example
-  Old rule prose here.
+  New rule prose here, incorporating observed pattern.
```

These are proposals only. User ACK required before any `.claude/rules/` edit; sink-proposer never writes to `.claude/rules/` directly.

(Empty section if no rule-promotion candidates detected.)

## automation

Candidate automations. Recurring manual steps in the window that could be captured as a skill, a deterministic check, a pre-commit hook, or a CI step. Each candidate: trigger condition + proposed automation + coverage gap it closes.

(Empty section placeholder — "No automation candidates in this window." — if none detected.)

## seeds

Forward-looking ideas with trigger conditions. Ideas not ready for the active milestone but worth surfacing when their trigger fires (e.g., "when Phase 57 gate opens, revisit auto-execution allow-list keyed by risk_level"). Each seed: trigger condition + idea + dependency phase.

(Empty section placeholder if none surfaced.)

## memory_proposals

Auto-memory candidates emitted by `sink-proposer.mjs`. Each candidate: proposed memory file + type (user / feedback / project / reference) + short body + rationale.

These are proposals only. User ACK required before any `memory/` file creation or update; sink-proposer never writes to `memory/` directly.

(Empty section placeholder if none surfaced.)

## approval_log

User ACK trail for each proposal. Populated as user reviews the compound artifact and decides which sinks to apply.

| Proposal | Type | Decision | Date | Note |
|----------|------|----------|------|------|
| (none pending) | - | - | - | - |

Lifecycle transitions:
- `draft` → `proposed` on auto-write (status at generation)
- `proposed` → `partially-approved` when some proposals resolved
- `proposed`/`partially-approved` → `approved` when all proposals resolved
- any → `archived` when superseded by later compound artifact

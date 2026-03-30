# Phase 11: Planning Quality Pipeline - Context

**Gathered:** 2026-03-29
**Status:** Ready for implementation

## Phase Boundary

Upgrade `sunco plan` with integrated research, enhanced plan-checker loop, requirements coverage gate, validation strategy generation, and deep work rule enforcement. Brings SUNCO plan quality to GSD level and beyond.

## Implementation Decisions

### PQP-01: Research Integration
- Add `--research` and `--skip-research` flags to plan skill
- If RESEARCH.md doesn't exist and no `--skip-research`, auto-invoke `ctx.run('workflow.research')`
- After research, re-read RESEARCH.md before passing to planner
- If research fails, proceed with warning (partial failure OK)

### PQP-02: Revision Loop Enhancement
- Already implemented: MAX_ITERATIONS=3, planner ↔ checker
- Enhancement: pass structured CheckerIssue objects (not just descriptions) to revision prompt
- No architectural change needed

### PQP-03: Requirements Coverage Gate
- After plans are written to disk, parse each PLAN.md frontmatter for `requirements:` field
- Collect all covered REQ-IDs into a Set
- Compare against phaseInfo.requirements from ROADMAP.md
- Uncovered requirements → add to warnings array
- This is a deterministic check (no LLM needed)

### PQP-04: Validation Strategy (RESEARCH.md → VALIDATION.md)
- After research produces RESEARCH.md, check for "## Validation Architecture" section
- If found, generate VALIDATION.md with validation dimensions
- Template: phase number, must-haves from research, verification approaches
- This feeds into future verify steps

### PQP-05: Deep Work Rules
- plan-create.ts prompt: add mandatory `<read_first>` field to every task (files executor MUST read before modifying)
- plan-create.ts prompt: strengthen `<acceptance_criteria>` requirement (grep-verifiable)
- plan-create.ts prompt: require concrete values in `<action>` (no "align X with Y")
- plan-checker.ts: add dimension 7: `deep_work_rules` checking read_first, acceptance_criteria, concrete action
- These are prompt-only changes

### Claude's Discretion
- VALIDATION.md template format details
- Exact wording of deep work rule enforcement in prompts
- Whether to add a `--coverage-strict` flag for CI usage

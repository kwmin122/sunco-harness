# Phase 2: Harness Skills - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 02-harness-skills
**Areas discussed:** Init strategy, Lint architecture, Health scoring, Agent doc analysis, Guard promotion
**Mode:** Auto (all areas selected, recommended defaults chosen)

---

## Init Detection Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Convention file scanning | Look for ecosystem marker files (package.json, Cargo.toml, etc.) | ✓ |
| Full AST parsing | Deep code analysis for structure detection | |
| Hybrid (markers + sampling) | Markers for ecosystem, sample imports for layers | |

**User's choice:** [auto] Convention file scanning with ecosystem-specific analyzers
**Notes:** Full AST parsing would be too slow for init. Convention files are fast and reliable.

## Lint Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| eslint-plugin-boundaries only | Use existing plugin for all enforcement | |
| Custom ESLint rules only | Build everything from scratch | |
| Hybrid (boundaries + custom) | boundaries for layers, custom for sunco-specific | ✓ |

**User's choice:** [auto] Hybrid approach -- eslint-plugin-boundaries for layer enforcement, custom rules for sunco patterns
**Notes:** Per CLAUDE.md tech stack: eslint-plugin-boundaries is already a confirmed dependency.

## Health Scoring

| Option | Description | Selected |
|--------|-------------|----------|
| Weighted composite (30/40/30) | Doc freshness 30%, anti-pattern trends 40%, convention adherence 30% | ✓ |
| Equal weights | 33/33/33 split | |
| Configurable weights | User sets weights in config.toml | |

**User's choice:** [auto] Weighted composite with anti-pattern trends weighted highest
**Notes:** Anti-patterns are the most actionable metric; document freshness is important but less urgent.

## Agent Doc Analysis

| Option | Description | Selected |
|--------|-------------|----------|
| Static text analysis | Line count, section detection, contradiction check | ✓ |
| LLM-assisted analysis | Use agent to evaluate quality | |
| Pattern matching | Regex-based heuristic scoring | |

**User's choice:** [auto] Static text analysis (deterministic, zero LLM cost)
**Notes:** Aligns with Phase 2's zero-LLM-cost principle. ETH Zurich research provides the scoring basis.

## Guard Promotion

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-promote | Automatically add detected patterns as lint rules | |
| Suggest-only | Propose rule, user confirms | ✓ |
| Prompt-assisted | Use agent to evaluate whether to promote | |

**User's choice:** [auto] Suggest-only -- show the proposed rule and let user confirm
**Notes:** Auto-promotion could add unwanted rules. Suggest-only respects user control.

## Claude's Discretion

- Internal data structures for health snapshots
- ESLint config generation format details
- File watcher debounce timing
- Convention extraction regex patterns

## Deferred Ideas

None

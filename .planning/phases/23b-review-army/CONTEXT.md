# Phase 23b: Review Army — Context

**Gathered**: 2026-04-07
**Mode**: autonomous (assumptions confirmed)
**Status**: Ready for planning

## Phase Boundary

Extend verify Layer 1 from 4 to 8 specialist experts, add adaptive gating,
cross-review dedup, confidence gate, test stub suggestions, and multi-provider matrix.

**Not in scope**: New CLI commands. Extends existing verify/review skills.

## Existing Code Map

| File | Lines | Role |
|------|-------|------|
| verify.skill.ts | 491 | 7-layer orchestrator (extend) |
| verify-layers.ts | 1,185 | Layer implementations (extend Layer 1) |
| verify-types.ts | 144 | Finding types (extend source union) |
| review.skill.ts | 339 | Multi-provider review (reference) |
| routing-tracker.ts | 100 | Provider success tracking (use for adaptive gating) |
| skill-profile.ts | 114 | Usage profiling (use for dedup) |
| test-gen.skill.ts | 327 | Test generation (reference for stubs) |

## 6 Mechanisms

| # | Mechanism | Implementation |
|---|-----------|----------------|
| 1 | 8 Specialist Army | 4 new expert prompts + verify-layers.ts Layer 1 extension |
| 2 | Adaptive Gating | specialist-gate.ts using routing-tracker stats |
| 3 | Cross-Review Dedup | dedup logic in verify-layers coordinator |
| 4 | Test Stub Suggestion | stub generator in findings post-processing |
| 5 | Confidence Gate | finding filter: 7+ main, 3-6 appendix, 1-2 hidden |
| 6 | Multi-Provider Matrix | 8 specialists × available providers via crossVerify |

## New Files

| File | Purpose |
|------|---------|
| shared/specialist-gate.ts | Adaptive gating — disable low-yield specialists |
| shared/confidence-gate.ts | Filter findings by confidence tier |
| shared/test-stub-generator.ts | Generate test skeletons from findings |
| prompts/verify-testing.ts | Testing specialist prompt |
| prompts/verify-api.ts | API design specialist prompt |
| prompts/verify-migration.ts | Migration safety specialist prompt |
| prompts/verify-maintainability.ts | Maintainability specialist prompt |

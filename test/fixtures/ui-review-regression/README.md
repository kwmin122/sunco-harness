# ui-review-regression fixture

Phase 51/M5.2 test fixture. Covers spec §9 L785 requirement:
> CLI-surface regression fixture — `/sunco:ui-review N` (no flag) output snapshot; tracks any change to existing behavior

## Purpose

Regression canary for Phase 41 R1 guarantee:
> `--surface cli` (default / omitted) → existing 6-pillar audit behavior, **byte-identical to pre-Phase-41 output**

Any change that weakens this guarantee (renaming default behavior, removing the
CLI default path, altering the phase argument contract) must be an explicit
decision — the fixture forces that decision to surface in test failures rather
than slip in silently.

## Files

- `EXPECTED-CLI-SURFACE.md` — snapshot invariants the slash-command file must satisfy

## Invariants tracked

1. Slash-command file exists at `packages/cli/commands/sunco/ui-review.md`
2. Frontmatter `name: sunco:ui-review`
3. Frontmatter `argument-hint` references `<phase>` and `--surface cli|web`
4. Body mentions "R1 regression guarantee" (Phase 41 anchor)
5. Body mentions "byte-identical" default-path guarantee
6. Body reserves explicit error for `--surface native` (Phase 41 R4)

## Usage

See `packages/skills-workflow/src/shared/__tests__/phase51-ui-review-regression.test.ts`.

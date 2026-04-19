# EXPECTED-CLI-SURFACE — ui-review slash command

Snapshot of invariants the `/sunco:ui-review` command file must satisfy.
Sourced from Phase 41/M2.4 R1 regression guarantee and the command's current frontmatter.

## Command file path

packages/cli/commands/sunco/ui-review.md

## Frontmatter invariants

- `name: sunco:ui-review`
- `argument-hint` includes the literal `<phase>`
- `argument-hint` includes the literal `--surface cli|web`
- frontmatter contains an `allowed-tools:` list (non-empty)

## Body invariants

- Contains the literal phrase `R1 regression guarantee`
- Contains the literal phrase `byte-identical`
- Contains the literal phrase `--surface native` paired with `explicit error` (Phase 41 R4 explicit-trigger contract)
- Default invocation path (no `--surface` flag) documented as equivalent to existing 6-pillar audit behavior

## Rationale

Phase 41/M2.4 added `--surface` dispatching to the ui-review command. The R1
guarantee promises the default (flag-omitted) invocation path stays byte-identical
to the pre-Phase-41 implementation. This fixture ensures any subsequent change
that would alter that guarantee must update the fixture in the same commit,
making the behavioral break explicit and reviewable.

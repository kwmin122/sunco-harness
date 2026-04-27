# Phase 65 Context — Simple UX

Status: Complete
Milestone: v1.6 / M7 Proof-first Runtime Foundation
Requirement: IF-31

## Output

Added a local runtime front-door command and user documentation.

Primary files:

- `packages/cli/bin/sunco-runtime.cjs`
- `docs/runtime/front-door.md`

## Contract

The MVP command surface is:

```text
sunco-runtime do <goal>
sunco-runtime verify <task-id>
sunco-runtime status <task-id>
sunco-runtime ship <task-id>
```

`ship` is blocked unless Done Gate passes.

## Verification

- `node packages/cli/bin/sunco-runtime.cjs --help`
- Temp-repo smoke: `sunco-runtime do ... --json` returned `DONE cli-smoke`; `status cli-smoke --json` reported `ready to mark done`.

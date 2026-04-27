# SUNCO Runtime Front Door

Status: M7 Phase 65 MVP

SUNCO v1.6 exposes a narrow proof-first runtime path:

```text
do -> evidence -> verify -> done gate -> status/ship
```

The local MVP command is:

```bash
node packages/cli/bin/sunco-runtime.cjs do "make the requested code change"
node packages/cli/bin/sunco-runtime.cjs status <task-id>
node packages/cli/bin/sunco-runtime.cjs verify <task-id>
node packages/cli/bin/sunco-runtime.cjs ship <task-id>
```

Contract:

1. `do` creates `.sunco/tasks/<task-id>/task.json` and `evidence.json`.
2. `do` observes current git edits and records changed files, hashes, diff, and rollback patch.
3. `verify` runs selected JS/TS checks and writes logs under `checks/`.
4. `status` reports task state, checks, changed files, and next action.
5. `ship` only succeeds when Done Gate passes.

Exit codes:

| Code | Meaning |
| --- | --- |
| 0 | Runtime action passed |
| 1 | Runtime command error |
| 2 | Done Gate blocked completion |

This front door intentionally stays smaller than the historical skill surface.
Advanced SUNCO commands remain available, but the v1.6 runtime message is:

```text
No evidence, no done.
```

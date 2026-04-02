---
description: GSD/SUNCO workflow enforcement rules — when to use which entry point
globs:
  - "**"
---

## Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD/SUNCO command so planning artifacts and execution context stay in sync.

### Entry Points
- `/sunco:quick` or `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/sunco:debug` or `/gsd:debug` for investigation and bug fixing
- `/sunco:execute` or `/gsd:execute-phase` for planned phase work

### Gates (stop-the-line, no skip)
- `/sunco:plan-gate` — before plan proceeds (product contract compliance)
- `/sunco:artifact-gate` — after implementation (release artifact validation)
- `/sunco:proceed-gate` — after verify, before ship/release/update (final go/no-go)
- `/sunco:dogfood-gate` — SUNCO self-application check

Do not make direct repo edits outside a workflow unless the user explicitly asks to bypass it.

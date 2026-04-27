# Runtime Benchmark Seeds

Status: M7 Phase 66

M7 seeds two benchmark roots:

| Root | Signal |
| --- | --- |
| `test/benchmarks/false-done/` | Done Gate blocks a claimed completion with missing evidence |
| `test/benchmarks/bugfix-basic/` | Edit evidence plus passing verification allows completion |

Required metrics:

| Metric | Meaning |
| --- | --- |
| `false_done_prevented` | Done Gate blocked an invalid completion claim |
| `checks_required` | Check kinds required by the gate |
| `checks_passed` | Count of required checks that passed |
| `user_interventions` | Explicit approvals or manual corrections |
| `time_to_green` | Later benchmark runner metric, deferred from M7 |

The seeds are intentionally JSON and Markdown only. A dedicated benchmark runner remains out of scope for v1.6.

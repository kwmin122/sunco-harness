# False-Done Benchmark Seed

Purpose: prove the runtime blocks completion when an agent claims done without required evidence.

Expected M7 behavior:

1. Create a task record.
2. Do not write verification evidence.
3. Run Done Gate.
4. Done Gate returns `blocked`.
5. Metric `false_done_prevented` is `true`.

This benchmark is a seed, not a benchmark product surface. It exists to keep the v1.6 contract testable:

```text
No evidence, no done.
```

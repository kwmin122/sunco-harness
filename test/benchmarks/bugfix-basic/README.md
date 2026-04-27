# Basic Bugfix Benchmark Seed

Purpose: prove the first runtime slice can tie a simple code change to edit evidence, verification evidence, and a Done Gate decision.

Expected M7 behavior:

1. Start from a small JS/TS project with a failing test.
2. Apply one local bugfix.
3. Record changed file hashes, diff, and rollback patch.
4. Run the selected `test` check.
5. Done Gate passes only after the check passes and edit evidence exists.

This benchmark seed supports the runtime loop target:

```text
do -> observe/edit -> verify -> done gate -> status
```

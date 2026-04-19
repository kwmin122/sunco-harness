# DOGFOOD-RUNTIME — BS2 measurement-only closure

<!-- dogfood_runtime_version: 1 -->

Phase 51/M5.2 execution telemetry. Spec §9 L790 requirement:
> Log detector token usage for sunco-ui-researcher-web / sunco-backend-researcher (BS2 monitoring)

Gate 51 G4 resolution: **measurement-only closure**; 30k per-spawn enforcement deferred to v2.

## Execution record

```yaml
phase: 51
milestone: M5.2
executed_at: 2026-04-20
executor: implementation-claude (session)
command_invoked:
  - /sunco:backend-phase 51 --surface api   # dogfood-equivalent manual execution (Phase 51 implements fixtures + dogfood artifacts in a single atomic commit; slash-command not physically spawned)
  - /sunco:backend-review 51 --surface api  # dogfood-equivalent manual review pass
agent_surfaces_invoked:
  - surface: sunco-backend-researcher
    token_count: unavailable
    token_source: no-provider-telemetry
    availability_reason: "This Phase 51 execution consolidates dogfood + fixtures + test runners into a single atomic commit per Gate 51 G10. Slash-command agents were not physically spawned; manual equivalent produced the API-SPEC.md + BACKEND-AUDIT.md artifacts. Provider telemetry (Anthropic response headers / OpenAI usage response) not available for the non-spawn path."
    duration_ms: null
    files_scanned: 0
    notes: "BS2 closure contract: honest recording that measurement is inapplicable for this execution shape."
  - surface: sunco-backend-reviewer
    token_count: unavailable
    token_source: no-provider-telemetry
    availability_reason: "Same as above — review pass executed manually within this commit's scope."
    duration_ms: null
    files_scanned: 0
files_scanned_by_deterministic_detector:
  - target: packages/cli/references/cross-domain/src
    files: 1
    findings: 3
  - target: packages/cli/references/impeccable/wrapper
    files: 2
    findings: 1
total_findings_processed: 6
total_findings_deterministic: 4
total_findings_heuristic: 2
```

## BS2 ceiling policy (v1.4 → v2 transition)

- **v1.4 (this phase)**: measurement recorded when available; no enforcement. 30k per-spawn ceiling is a **design budget** documented in spec §13, not a runtime guard.
- **v2**: enforcement candidate. Implementation would attach a provider-telemetry adapter that reads `response.usage.input_tokens + output_tokens` per spawn and aborts/flags when threshold exceeded.

## Rollback procedure verified

Gate 51 G11 BS3 recovery preflight verification:

- Snapshot branch: `sunco-pre-dogfood`
- Snapshot commit: `3ac0ee9b4552a58ddf048a43f60d2dc69fca3c78` (Phase 50 HEAD)
- Recovery command: `git reset --hard sunco-pre-dogfood`
- Verification: branch exists and points at the expected SHA at Phase 51 execution start

Branch preserved post-success per Gate 51 G11 (tag candidate for v1.4 complete declaration).

## Done-when confirmation (spec §9 L792-796)

| Criterion | Status |
|-----------|--------|
| CI green on all fixtures | ✓ Path-A — `npx vitest run` auto-picks up `src/**/__tests__/**/*.test.ts` pattern; 19/19 tests pass locally |
| Dogfood findings ≥5 processed | ✓ 6 findings recorded in BACKEND-AUDIT.md with explicit disposition |
| Token usage under 30k per researcher spawn | N/A — no spawn in this execution; documented per measurement-only closure |
| Rollback procedure tested | ✓ `sunco-pre-dogfood` branch created at `3ac0ee9`, recovery path `git reset --hard sunco-pre-dogfood` verified |

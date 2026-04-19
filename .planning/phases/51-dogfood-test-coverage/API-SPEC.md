# API-SPEC — dogfood /sunco:proceed-gate surface

<!-- spec_version: 1 -->

**CLI API mapping disclaimer**: SUNCO is a CLI tool, not a REST backend. This document maps the `/sunco:proceed-gate` slash-command surface into the API-SPEC schema form for dogfood purposes only (Phase 51/M5.2, spec §9 L774). Endpoints below are slash-commands expressed with synthetic HTTP method/path for schema compatibility. ops-surface replacement is v2 scope.

## Surface under dogfood

`/sunco:proceed-gate <phase> [--allow-low-open]` — STOP-THE-LINE gate run after `/sunco:verify` and before `/sunco:ship`, `/sunco:release`, or `/sunco:update`.

## CLI → API mapping convention

| CLI concept | API concept | This doc |
|-------------|-------------|----------|
| Slash command path | HTTP method + path | `POST /sunco/proceed-gate` |
| Positional args + flags | Request body schema | `ProceedGateArgs` |
| Generated artifacts + decision | Response body schema | `ProceedGateDecision` |
| CLI diagnostic output | Error envelope | `CliDiagnostic` |
| `--surface` flag family | Path versioning / query discriminator | (not applicable to this command) |

<!-- SUNCO:SPEC-BLOCK-START -->
```yaml
version: 1
endpoints:
  - method: POST
    path: /sunco/proceed-gate
    request_schema:
      name: ProceedGateArgs
      fields:
        phase: string
        allow_low_open: boolean
    response_schema:
      name: ProceedGateDecision
      fields:
        verdict: string
        blocking_findings: number
        high_open: number
        medium_open: number
        low_open: number
        cross_domain_consumed: boolean
    errors:
      - code: "NO_VERIFICATION"
        message: Verification file missing — run /sunco:verify first
      - code: "HIGH_OPEN_BLOCK"
        message: HIGH severity findings in open state block proceed
      - code: "MED_OPEN_BLOCK"
        message: MEDIUM severity findings open without ≥50-char dismissal rationale
      - code: "LOW_OPEN_BLOCK"
        message: LOW severity findings open without --allow-low-open flag
error_envelope:
  codes:
    - "NO_VERIFICATION"
    - "HIGH_OPEN_BLOCK"
    - "MED_OPEN_BLOCK"
    - "LOW_OPEN_BLOCK"
    - "INVALID_PHASE"
versioning_strategy: not-applicable-cli
auth_requirements:
  scheme: none
  required_for: none
anti_pattern_watchlist:
  - swallowed-catch
  - missing-validation-public-route
  - raw-sql-interpolation
```
<!-- SUNCO:SPEC-BLOCK-END -->

## Source files dogfooded

- `packages/cli/commands/sunco/proceed-gate.md` — slash-command definition + inline Step logic
- `packages/cli/references/cross-domain/src/extract-spec-block.mjs` — consumed by gate Step 1.5 for cross-domain findings parse
- `packages/cli/references/impeccable/wrapper/detector-adapter.mjs` — adjacent consumer of same module, scoped in for coherence

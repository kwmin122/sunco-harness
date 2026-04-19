# proceed-gate-lifecycle fixture

Phase 51/M5.2 test fixture. Covers Phase 49/M4.2 IF-15 severity × state lifecycle:
> HIGH open = hard block, MED open = block (dismissable with ≥50-char rationale), LOW open = configurable

## Files

- `BACKEND-AUDIT.md` — Phase 47 surface-section format; API findings with 3 severities
- `CROSS-DOMAIN-FINDINGS.md` — Phase 49 findings with lifecycle overrides region

## Coverage

### BACKEND-AUDIT.md
`## API findings` section contains 4 findings:

| Severity | Count |
|----------|-------|
| HIGH | 1 |
| MEDIUM | 2 |
| LOW | 1 |

### CROSS-DOMAIN-FINDINGS.md lifecycle overrides
4 overrides demonstrating full lifecycle coverage:

| State | Rule | Rationale |
|-------|------|-----------|
| resolved | missing-endpoint (HIGH) | resolved_commit set |
| dismissed | error-state-mismatch (MED) | ≥50-char rationale (Phase 49 hard-block threshold) |
| open | orphan-endpoint (LOW) | plain open — configurable via --allow-low-open |
| open | error-state-mismatch (MED) | hard-block unless rationale added |

## Usage

See `packages/skills-workflow/src/shared/__tests__/phase51-proceed-gate-lifecycle.test.ts`.

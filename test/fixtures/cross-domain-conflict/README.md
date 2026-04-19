# cross-domain-conflict fixture

Phase 51/M5.2 test fixture. Covers spec §9 L784 requirement:
> fixture with intentional FE/BE mismatches, asserts each of 4 cross-domain check types fires with correct severity

## Files

- `UI-SPEC.md` — UI contract with intentional mismatches vs API
- `API-SPEC.md` — API contract with orphan endpoint + missing error code

## Intentional mismatches (one per check type)

| Check | Severity | Trigger |
|-------|----------|---------|
| missing-endpoint | HIGH | UI consumes `POST /api/todos` not defined in API |
| orphan-endpoint | LOW | API defines `DELETE /api/admin/purge` not consumed by UI |
| type-drift | HIGH | UI type `User.createdAt: string` vs API `User.createdAt: Date` |
| error-state-mismatch | MEDIUM | API error code `404` has no explicit UI state mapping |

## Baseline (no finding expected)

- UI consumes `GET /api/users` — API defines it → clean match

## Usage

See `packages/skills-workflow/src/shared/__tests__/phase51-cross-domain-conflict.test.ts`.

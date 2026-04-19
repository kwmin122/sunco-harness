# backend-rest-sample fixture

Phase 51/M5.2 test fixture. Covers spec §9 L783 requirement:
> node/ts fixture with 7 smells, asserts each detector rule fires positive + negative case

## Structure

- `positive/<rule>.ts` — canonical smell example; detector MUST fire the named rule
- `negative/<rule>.ts` — fixed version; detector MUST NOT fire the named rule
- `migrations/` — SQL migration fixtures (non-reversible-migration rule)

## Rules covered (7)

| Rule | Severity |
|------|----------|
| raw-sql-interpolation | HIGH |
| missing-timeout | HIGH |
| swallowed-catch | HIGH |
| any-typed-body | HIGH |
| missing-validation-public-route | MEDIUM |
| non-reversible-migration | HIGH |
| logged-secret | HIGH |

## Usage

See `packages/skills-workflow/src/shared/__tests__/phase51-backend-rest.test.ts`.

# API-SPEC — Phase 51 cross-domain-conflict fixture

<!-- spec_version: 1 -->

API contract paired with UI-SPEC.md. Intentional mismatches:
- UI consumes POST /api/todos (NOT defined here) → missing-endpoint
- This defines DELETE /api/admin/purge (UI doesn't consume) → orphan-endpoint
- User.createdAt typed as Date vs UI string → type-drift
- error_envelope includes 404 (UI doesn't map) → error-state-mismatch

<!-- SUNCO:SPEC-BLOCK-START -->
```yaml
version: 1
endpoints:
  - method: GET
    path: /api/users
    response_schema:
      name: User
      fields:
        id: string
        name: string
        createdAt: Date
  - method: DELETE
    path: /api/admin/purge
    response_schema:
      name: PurgeResult
      fields:
        deleted: number
error_envelope:
  codes:
    - "401"
    - "404"
    - "500"
versioning_strategy: url-path-v1
auth_requirements:
  scheme: bearer
  required_for: all
anti_pattern_watchlist:
  - raw-sql-interpolation
  - missing-timeout
```
<!-- SUNCO:SPEC-BLOCK-END -->

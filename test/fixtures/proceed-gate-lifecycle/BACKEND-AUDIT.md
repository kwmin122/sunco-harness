# BACKEND-AUDIT — Phase 51 proceed-gate-lifecycle fixture

<!-- audit_version: 1 -->

Phase 47 surface-section format. Auto-generated findings per surface. All findings
are `state: open` by audit_version:1 single-value schema; lifecycle transitions
live in CROSS-DOMAIN-FINDINGS.md per Phase 49.

## API findings

```yaml
findings:
  - rule: raw-sql-interpolation
    severity: HIGH
    kind: deterministic
    file: src/api/users.ts
    line: 12
    state: open
    source: backend-excellence
    match: "SELECT * FROM users WHERE id = ${userId}"
    fix_hint: Use parameterized query via ORM or prepared statement.
  - rule: missing-timeout
    severity: MEDIUM
    kind: deterministic
    file: src/api/posts.ts
    line: 34
    state: open
    source: backend-excellence
    match: fetch without signal
    fix_hint: Add AbortSignal.timeout() to the request.
  - rule: missing-validation-public-route
    severity: MEDIUM
    kind: deterministic
    file: src/api/auth.ts
    line: 8
    state: open
    source: backend-excellence
    match: app.post('/api/register', ...)
    fix_hint: Add local validator call before body use.
  - rule: logged-secret
    severity: LOW
    kind: heuristic
    file: src/api/debug.ts
    line: 22
    state: open
    source: backend-excellence
    match: console.log({ token: ... })
    fix_hint: Redact secret fields before logging.
```

## Data findings

None in this fixture.

## Event findings

None in this fixture.

## Ops findings

None in this fixture.

---
patterns:
  - "**/migrations/**"
  - "**/db/**"
  - "**/schema/**"
  - "**/*.sql"
  - "**/drizzle/**"
  - "**/prisma/**"
---

# Database Safety

- Never run destructive operations (DROP, DELETE, TRUNCATE) without explicit user approval
- All schema changes go through migration files — never modify the database directly
- Migrations must be reversible (include both up and down)
- Add indexes for any column used in WHERE clauses on tables expected to exceed 10K rows
- Use transactions for multi-step operations that must be atomic
- Never store secrets (API keys, passwords) in plain text — use hashed/encrypted storage
- Test migrations against a copy of production data shape before applying
- Log all data-modifying operations for audit trail

# Migrations and Compatibility

## Overview

Database migrations and API version changes are the two places where backend systems most often break *during* a deploy rather than at steady state. The reason is coupling: a running fleet of N service instances plus M clients all share a schema/contract, and changing that contract atomically across everyone is impossible. Migrations that ignore this fact produce outages that begin exactly when "deploy succeeded" turns green.

This reference is for engineers shipping schema changes, API changes, or message-format changes to a live system. The core discipline is **expand-contract**: every change goes out in phases where old code and new code coexist without breaking each other, and the final phase removes the old only after all traffic is on the new.

## Anti-patterns

### drop-column-in-same-release

**Smell:** A single deploy both stops writing a column from the application code *and* drops the column from the schema. The deploy order across instances is not atomic, so some running code expects the column to exist while the migration has already dropped it.

**Example (bad):**
```sql
-- migration 0042
ALTER TABLE users DROP COLUMN legacy_username;
```
Application code in PR: deletes all references to `legacy_username`.
Deploy sequence: migration runs → old instances still serving traffic try to read `legacy_username` from the table → SQL error → 500s.

**Why wrong:** Rolling deploys are not atomic. Instances run the old code and the old schema simultaneously with the new code and the new schema for some duration. Any change that breaks this cross-compat during the rollout window is an outage, not a deploy.

**Fix:** Multi-step (expand-contract):
1. Release A: application stops writing the column, keeps reading it for compat.
2. Release B: application stops reading the column. All instances on this release.
3. Release C (or manual migration): `DROP COLUMN`. At this point no code references it.

Never combine these. At minimum, step 3 is a separate deploy from step 1.
```sql
-- step 3 migration, after all instances on release B
ALTER TABLE users DROP COLUMN legacy_username;
```

**Detection:** deterministic candidate (migrations in the same PR as code that removes references to the same column).

---

### non-reversible-migration

**Smell:** A migration with no `down` / `revert` path. Once applied, the only way back is a backup restore.

**Example (bad):**
```ts
// migration 0043
export async function up(db) {
  await db.query('DROP TABLE archived_events');
}
// no `down`, or `down` is a no-op
```

**Why wrong:** If the new release has a bug that only shows up in production traffic, you cannot roll back the deploy — the schema is already mutated. You're stuck finishing-forward under incident pressure. Non-reversible migrations remove one of your safety nets at exactly the moment you most need it.

**Fix:** Write a reversible down for every up. If the up deletes data that cannot be recovered (a table-drop, a destructive column rewrite), split the migration: *first* rename and stop reading, *then* later drop. The rename step is cheaply reversible; the drop is the last mile after you're confident.
```ts
// migration 0043a: rename (reversible)
export async function up(db) {
  await db.query('ALTER TABLE archived_events RENAME TO archived_events_deprecated');
}
export async function down(db) {
  await db.query('ALTER TABLE archived_events_deprecated RENAME TO archived_events');
}

// migration 0044 (week later, after confidence): actual drop
```

**Detection:** deterministic candidate (migration files with no `down` / `revert` function, or with an empty one).

---

### no-expand-contract

**Smell:** Schema changes done as a single atomic step — rename a column, change a type, split a table — without a bridge period where both shapes coexist.

**Example (bad):**
```sql
-- In one migration:
ALTER TABLE orders RENAME COLUMN customer TO customer_id;
ALTER TABLE orders ALTER COLUMN customer_id TYPE bigint USING customer_id::bigint;
```
Between the instant the migration finishes and the instant every instance is on the new code, queries referencing `customer` fail.

**Why wrong:** Same issue as `drop-column-in-same-release` but generalized. Any rename, type change, or structural change is a compat-breaking event if done in one step. The rename/type-change completes atomically at the DB level but *not* atomically across application instances.

**Fix:** The expand-contract pattern:
1. **Expand**: add the new column alongside the old. Application writes to both, reads from old (or prefers new, falls back).
2. **Migrate**: backfill the new column from existing data. Deploy code that reads from new.
3. **Contract**: stop writing to old. Deploy.
4. **Drop**: remove the old column. Deploy.

Each step is independently reversible. The rollout takes multiple releases but never breaks.
```sql
-- Step 1
ALTER TABLE orders ADD COLUMN customer_id bigint;
-- Step 2 (backfill, possibly async/chunked)
UPDATE orders SET customer_id = customer::bigint WHERE customer_id IS NULL;
-- Step 4 (after confirmed no reads of old column)
ALTER TABLE orders DROP COLUMN customer;
```

**Detection:** heuristic (migrations containing `RENAME`, type-changing `ALTER COLUMN`, or `DROP COLUMN` not preceded by a compat-period; requires release history inspection).

---

### breaking-response-shape-no-version

**Smell:** The API changes a response field's name, type, or meaning without a version header, new path, or content negotiation — and old clients in the wild crash or misrender.

**Example (bad):**
```
# before
GET /users/17 → {"id": 17, "name": "Alice", "plan": "pro"}
# after (same URL)
GET /users/17 → {"id": 17, "name": "Alice", "subscription": {"tier": "pro", "status": "active"}}
```
Mobile app with the old deserializer crashes on the missing `plan` field. Server has no way to know if the caller is old or new.

**Why wrong:** API clients are not controlled by you. Mobile apps linger in production for months or years. SDKs in partners' infrastructure update on their schedule. Breaking the wire contract in place means every consumer who hasn't updated breaks simultaneously.

**Fix:** Pick a versioning strategy and use it. The common ones:
- **Path versioning** (`/v2/users/17`) — simple, obvious, Git-blamable.
- **Header versioning** (`Accept: application/vnd.example.v2+json`) — cleaner URLs, slightly more work client-side.
- **Date versioning** (Stripe: `Stripe-Version: 2023-10-16`) — powerful for sprawling APIs with many small evolutions.

Additive changes do not require a version bump. Breaking changes (removed field, renamed field, changed type, changed semantics of an existing value) do — always. If you want to deprecate a v1 field, you keep serving it for the deprecation window while new clients move to v2.

**Detection:** deterministic candidate (response schema diffs between deployed versions that remove or rename fields without a version bump in the route or an API version header).

---

### no-backfill-plan

**Smell:** A new required column or a new required field is added. The migration itself succeeds on empty data, but the live table has 40 million rows that don't have a value — and nothing in the release specifies how those get populated.

**Example (bad):**
```sql
ALTER TABLE users ADD COLUMN region text NOT NULL;
-- 40M existing rows; this migration either fails or is somehow allowed to proceed with unknown state
```
Or, subtler: the column is added nullable, backfill is supposed to happen "later," and years later 30% of rows still have `NULL` and nobody remembers why.

**Why wrong:** Migrations have to consider existing data, not only new-row shapes. A required column without a backfill rule is either a failing migration or a silent data-quality debt. Backfill rules written in incident post-mortems are much worse than backfill rules designed alongside the migration.

**Fix:** Every non-trivial schema change has an explicit backfill plan documented with the migration. Common shapes:
- **In-migration backfill** for small tables (<1M rows): the migration computes defaults and runs `UPDATE` inline.
- **Deferred backfill** for large tables: the migration adds the column as nullable, a separate job (possibly chunked over days) fills it, a later migration adds the `NOT NULL` constraint.
- **Computed default**: the column has a computed or generated default so that existing rows automatically get a sensible value on first read/write.

```sql
-- large-table safe:
-- step 1
ALTER TABLE users ADD COLUMN region text;
-- step 2 (deferred job, chunked 10k rows at a time):
UPDATE users SET region = guess_region(ip_address) WHERE region IS NULL AND id BETWEEN x AND y;
-- step 3 (after full backfill confirmed):
ALTER TABLE users ALTER COLUMN region SET NOT NULL;
```
Document the plan in the migration file (comment at the top or linked doc). Every reviewer should be able to answer "what happens to rows that already exist?" before approving.

**Detection:** deterministic candidate (migrations that add a `NOT NULL` column to a non-empty table without a `DEFAULT`; or nullable-column migrations with no accompanying backfill script).

## Principles

1. **Deploys are not atomic across instances — design for the coexistence window.** Old and new code run simultaneously during rollouts. Every contract change must be valid for both during that window.

2. **Expand, migrate, contract, drop — in separate releases.** The four-step rhythm prevents every class of in-place rename/type/structure change from being an outage.

3. **Every migration is reversible, or is split until it is.** You never want "the only way back is the 4 a.m. page to DBA." A reversible migration is a safety margin you pay for in review time, and it's one of the best deals in production engineering.

4. **Data outlives code.** A column added today is still in production five years from now. Field names, enum values, and type choices become part of the permanent record. Choose them with the same care you'd choose a public API field.

5. **Every non-empty table has a backfill story for new columns.** Default, computed, or staged. Never "TBD."

6. **Versioning isn't optional for public APIs.** Pick a strategy before the first client connects, not after the first breaking change. Being able to ship a v2 is a capability, not a reaction.

## Rubric

- [ ] No PR both removes a column from application code and drops it in the schema in the same release.
- [ ] Every migration has a reversible `down` or is explicitly justified as irreversible (data loss acknowledged).
- [ ] Renames, type changes, and structural splits follow expand-contract across ≥3 releases.
- [ ] Breaking API changes go out behind a version bump (path, header, or date-based).
- [ ] Deprecated API fields/endpoints have a published sunset date and a migration guide.
- [ ] Every schema change that adds required data has a documented backfill plan.
- [ ] Long-running backfills are chunked and monitored; they do not hold one giant transaction open.
- [ ] Dry-run / staging environment runs every migration before production.
- [ ] Migration tooling tracks applied migrations so the same one never runs twice.
- [ ] Post-deploy verification confirms the schema matches the intended shape.

## References

- Pramod Sadalage and Scott Ambler, *Refactoring Databases: Evolutionary Database Design*, Addison-Wesley, 2006. Foundational — expand-contract, parallel-change patterns.
- Martin Fowler, *Parallel Change* (https://martinfowler.com/bliki/ParallelChange.html). Compact statement of the expand-contract method.
- PostgreSQL documentation — *Alter Table* and *Schema Modification* concurrency notes.
- Gergely Orosz, *The Software Engineer's Guidebook*, Pragmatic, 2023. Chapters on safe deploys and schema migrations.
- GitHub Engineering blog — *gh-ost: GitHub's online schema migration tool for MySQL*. Discusses zero-downtime migrations on very large tables.
- Martin Kleppmann, *Designing Data-Intensive Applications*, O'Reilly, 2017. Schema evolution, compatibility, versioning chapters.

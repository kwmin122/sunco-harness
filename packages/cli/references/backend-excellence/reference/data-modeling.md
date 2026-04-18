# Data Modeling

## Overview

Schemas are the longest-lived artifact in a backend system. Application code can be rewritten in a week; a production database with referential integrity, indexes, and downstream consumers takes months to change safely. This reference is for engineers designing new tables and evolving existing ones in any relational store (Postgres, MySQL, SQL Server, SQLite) — the anti-patterns apply to document stores and event logs too, with vocabulary translation.

Good schema design is about making invalid states unrepresentable, queries efficient without reading every row, and future changes possible without coordinated deploys. The anti-patterns below each violate one of those three.

## Anti-patterns

### nullable-everything

**Smell:** Most or all columns in a table allow `NULL`, often because "we don't always have the data at insert time" or because the ORM defaults to nullable.

**Example (bad):**
```sql
CREATE TABLE customers (
  id           bigint PRIMARY KEY,
  email        text,
  name         text,
  country_code text,
  signup_at    timestamptz,
  is_active    boolean
);
```

**Why wrong:** `NULL` is a tri-state logic escape that propagates through every query. `is_active = true` excludes `NULL` rows silently. Indexes on nullable columns are larger. Type systems on the application side have to check `null` at every read. "Unknown" and "not yet set" and "intentionally empty" collapse into the same sentinel and cannot be distinguished.

**Fix:** Default to `NOT NULL` with explicit defaults. Reserve `NULL` for columns where "unknown" is a genuine, persistent state the application must handle (e.g., a survey question the user skipped).
```sql
CREATE TABLE customers (
  id           bigint PRIMARY KEY,
  email        text        NOT NULL,
  name         text        NOT NULL DEFAULT '',
  country_code char(2)     NOT NULL,
  signup_at    timestamptz NOT NULL DEFAULT now(),
  is_active    boolean     NOT NULL DEFAULT true,
  deleted_at   timestamptz            -- nullable: genuinely absent for live rows
);
```

**Detection:** deterministic candidate (parse schema DDL; flag tables where >70% of non-FK columns are nullable).

---

### boolean-flag-pileup

**Smell:** A table accumulates booleans over time — `is_active`, `is_deleted`, `is_verified`, `is_premium`, `is_suspended`, `is_internal` — each representing a state in some process.

**Example (bad):**
```sql
ALTER TABLE users ADD COLUMN is_suspended boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN is_banned    boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN is_pending   boolean NOT NULL DEFAULT false;
```

**Why wrong:** Booleans cannot express mutual exclusion. Can a user be both `is_banned` and `is_pending`? The schema allows it; the application probably doesn't. Every read has to reconstruct the state machine by evaluating flag combinations. Bugs hide in the un-tested combinations.

**Fix:** Replace flag pileups with an explicit status enum and a separate "latest event" audit when the transition history matters.
```sql
CREATE TYPE user_status AS ENUM ('pending', 'active', 'suspended', 'banned', 'deleted');

ALTER TABLE users ADD COLUMN status user_status NOT NULL DEFAULT 'pending';
-- drop is_suspended, is_banned, is_pending after backfill
```
Orthogonal booleans are still booleans — `is_premium` is not a state of the account lifecycle, it is a subscription fact. Those stay as booleans or, better, as rows in a subscriptions table.

**Detection:** deterministic candidate (tables with ≥3 `is_*` / `has_*` boolean columns are suspicious; flag for review).

---

### polymorphic-blob-column

**Smell:** A single `jsonb` / `json` / `text` column holds structured data whose shape depends on another column's value — `type = 'order'` means the `payload` field has certain keys; `type = 'refund'` means others.

**Example (bad):**
```sql
CREATE TABLE events (
  id      bigint PRIMARY KEY,
  type    text        NOT NULL,  -- 'order', 'refund', 'shipment', ...
  payload jsonb       NOT NULL   -- shape depends on type
);
```

**Why wrong:** No index on the inside of `payload` unless you know the type. No foreign keys. No `NOT NULL` enforcement on required sub-fields. The shape drifts silently as producers evolve. Queries like "all orders over $100" degrade to full-scan plus JSONB path extraction.

**Fix:** Normalize. One table per type with the right columns, or one base table with common columns plus per-type side tables linked by id.
```sql
CREATE TABLE orders (
  id         bigint PRIMARY KEY,
  event_id   bigint NOT NULL REFERENCES events(id),
  amount     numeric(12,2) NOT NULL,
  currency   char(3) NOT NULL,
  ...
);
```
A blob column is justified only when the shape is genuinely open-ended (webhook payloads from third parties, user-supplied metadata with no query requirement) and never for discriminated-union data you control.

**Detection:** heuristic (JSONB/JSON columns combined with a `type` / `kind` / `category` column in the same table; needs human review).

---

### timestamp-without-tz

**Smell:** Timestamp columns declared as `timestamp` (without time zone), `datetime`, or `TIMESTAMP WITHOUT TIME ZONE`, storing wall-clock times.

**Example (bad):**
```sql
CREATE TABLE events (
  created_at timestamp NOT NULL   -- which zone? local to the writing app? UTC?
);
```

**Why wrong:** The column stores a wall-clock string with no zone. The writing app assumes one zone; the reading app assumes another. DST transitions produce duplicate or missing timestamps. Moving the database to a different region silently changes the interpretation of every row.

**Fix:** Use `timestamptz` (Postgres) / `TIMESTAMP WITH TIME ZONE` everywhere unless the column genuinely represents a local civil time without a location (a calendar recurrence rule, a store's opening hour). Store in UTC at rest; render in the user's zone on read.
```sql
CREATE TABLE events (
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**Detection:** deterministic candidate (any `timestamp`/`datetime` column without `tz` or `with time zone`).

---

### string-id-ambiguity

**Smell:** Multiple entities use opaque string ids (UUIDs, slugs, external ids) without prefixing or type-tagging, so function signatures accept `id: string` and no one can tell from a log line or a URL whether `8f2c...` is a user, an invoice, or a webhook.

**Example (bad):**
```
customer_id = "8f2c1a7e-..."
order_id    = "8f2c1a7e-..."
```
One day you pass an order id into a customer lookup and the database obligingly returns nothing — or worse, returns a row because the two spaces happen to collide.

**Why wrong:** Type safety at the application layer relies on naming conventions only. Accidental misuse compiles and passes tests. Logs and support tools cannot route a bare id to the right entity.

**Fix:** Prefix id strings with a stable, short type tag (Stripe-style: `cus_`, `inv_`, `evt_`). Cheap at every layer:
```
customer_id = "cus_01H8XP..."
order_id    = "ord_01H8XP..."
```
ULIDs or snowflake ids are friendlier than UUIDs for logs (time-ordered, shorter). At the schema level, declare domain types if the DB supports them:
```sql
CREATE DOMAIN customer_id AS text CHECK (VALUE ~ '^cus_[0-9A-Z]{26}$');
```

**Detection:** heuristic (string id columns shared across tables without a prefix convention; hard to detect deterministically without code-side inspection).

---

### missing-indexes-on-fk

**Smell:** Foreign key columns without an index on the referencing side. `orders.customer_id REFERENCES customers(id)` — the `customers.id` side is indexed (it's the PK), the `orders.customer_id` side is not.

**Example (bad):**
```sql
CREATE TABLE orders (
  id          bigint PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES customers(id)
);
-- no index on orders.customer_id
```

**Why wrong:** Two symptoms. First: `SELECT ... WHERE customer_id = ?` becomes a full scan. Second, subtler: `DELETE FROM customers WHERE id = ?` must scan `orders` to check referential integrity, even if no cascade is declared. On a growing `orders` table, routine customer deletions suddenly take seconds.

**Fix:** Index every FK column on the referencing side. Make this a reflex.
```sql
CREATE INDEX orders_customer_id_idx ON orders(customer_id);
```
Partial indexes (`WHERE customer_id IS NOT NULL`) help when the column is optional.

**Detection:** deterministic candidate (join `information_schema.table_constraints` and `pg_indexes`; report FK columns with no index starting with them).

---

### soft-delete-tombstones

**Smell:** Every table has a `deleted_at` column and every query must remember to filter `WHERE deleted_at IS NULL`. Months later, a forgotten filter exposes "deleted" rows to users.

**Example (bad):**
```sql
SELECT * FROM projects WHERE owner_id = $1;
-- intended to show only live projects; forgot AND deleted_at IS NULL
```

**Why wrong:** Soft delete trades storage for complexity. Every table becomes a view-over-a-bigger-table. Indexes bloat. Foreign keys to deleted rows silently exist. Uniqueness constraints (`UNIQUE(email)`) fight with soft delete (two soft-deleted rows with the same email exist; a live reinsert conflicts). The rule "always filter `deleted_at`" is enforceable by convention only.

**Fix:** Prefer hard delete plus an audit log / archive table. If regulatory or product requirements demand undelete, move deleted rows to a parallel table (`projects_deleted`) on delete — that way, live queries cannot accidentally see them.
```sql
-- on delete:
INSERT INTO projects_archive SELECT * FROM projects WHERE id = $1;
DELETE FROM projects WHERE id = $1;
```
If you must keep `deleted_at`, enforce via a database-level policy/view that all application queries go through, and make uniqueness constraints partial: `CREATE UNIQUE INDEX ON projects(email) WHERE deleted_at IS NULL`.

**Detection:** heuristic (presence of `deleted_at` / `is_deleted` columns is not itself the problem; missing partial-unique-indexes or application queries that forget the filter is. Requires code + schema joint review.)

## Principles

1. **Make invalid states unrepresentable.** Schema is the cheapest place to enforce invariants. Defaults, `NOT NULL`, check constraints, and enums catch bugs the application never has to handle.

2. **Normalize until it hurts; denormalize only with evidence.** Premature denormalization is a common trap. Measure the join cost on realistic data before collapsing tables; often the join is free because the FK is indexed (see above).

3. **Indexes are part of the schema, not an afterthought.** Every query in a hot path has a matching index. Every FK has an index on the referencing side. Review index coverage on every migration.

4. **Store raw, compute derived.** Store the facts (timestamps, amounts, currencies) and derive aggregates on read or via materialized views. Resist "denormalize the count for performance" until a real query plan forces you.

5. **Design for change.** Assume every column will need to be evolved. Add nullable first, backfill, then make `NOT NULL` — or use expand-contract (see migrations-and-compatibility.md). Wide, append-friendly rows age better than narrow, overloaded ones.

6. **One source of truth per fact.** If the same fact lives in two columns (e.g., `user.email` and `user_contacts.primary_email`), one of them drifts. Pick one home and let the other be a view.

## Rubric

- [ ] Every column has an explicit `NOT NULL` or a justified reason for allowing `NULL`.
- [ ] No table has ≥3 boolean state flags where a single status enum would do.
- [ ] No `jsonb`/`json` column holds structured data whose shape is knowable and fixed.
- [ ] All timestamp columns use timezone-aware types.
- [ ] String ids use a type-tag prefix convention or are wrapped in a typed domain.
- [ ] Every foreign key column has an index on the referencing side.
- [ ] Soft-delete columns come with partial unique constraints and a documented filter policy.
- [ ] Every migration has been reviewed for index coverage on the new columns.
- [ ] Derived/computed values are views or materialized views, not denormalized columns.

## References

- C. J. Date, *SQL and Relational Theory: How to Write Accurate SQL Code*, 3rd ed., O'Reilly, 2015. Foundational.
- Joe Celko, *SQL for Smarties*, 5th ed., Morgan Kaufmann, 2014. Idiom catalog for relational schema.
- PostgreSQL documentation — *Data Types* and *Indexes* chapters (https://www.postgresql.org/docs/current/). Canonical reference for timezone-aware types, partial indexes, and domain types.
- Martin Fowler, *Patterns of Enterprise Application Architecture*, Addison-Wesley, 2002. Chapter on Object-Relational Structural Patterns.
- RFC 3339 — Date and Time on the Internet: Timestamps. Wire format for exchanging timestamps.
- Martin Kleppmann, *Designing Data-Intensive Applications*, O'Reilly, 2017. Schema evolution and event sourcing chapters.

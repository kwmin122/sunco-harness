# Performance and Scale

## Overview

A service that performs well on synthetic benchmarks can still collapse under real traffic because the failure modes differ. Benchmarks measure one thing at a time on clean data; production combines every endpoint, every tenant, every size of dataset, at the same time. This reference is for engineers trying to make services scale *correctly* — not "faster at everything" but "doesn't get worse as traffic grows, and degrades predictably when it does."

The anti-patterns below are the highest-leverage ones for typical CRUD/REST backends. None of them require exotic infrastructure to fix; they require noticing the pattern early enough that the fix is not a rewrite.

## Anti-patterns

### n-plus-one

**Smell:** One query returns N rows; for each row, another query is issued to load a related entity.

**Example (bad):**
```ts
const orders = await db.query(`SELECT * FROM orders WHERE customer_id = $1`, [cid]);
for (const order of orders) {
  order.lineItems = await db.query(`SELECT * FROM line_items WHERE order_id = $1`, [order.id]);
  order.customer = await db.query(`SELECT * FROM customers WHERE id = $1`, [order.customer_id]);
}
// 1 + 2N queries for N orders
```

**Why wrong:** Latency scales linearly with the result set instead of staying roughly constant. A page that is fast when a test customer has 3 orders dies at a customer with 500 orders. Database round-trip cost dominates; individual query time is fine.

**Fix:** Join or batch. A single query with a `JOIN`, or two queries: load the orders, then one `WHERE id IN (...)` query that fetches all related rows at once.
```ts
const orders = await db.query(
  `SELECT o.*, li.id as line_item_id, li.product_id, li.quantity
   FROM orders o
   LEFT JOIN line_items li ON li.order_id = o.id
   WHERE o.customer_id = $1`,
  [cid]
);
// fold rows into orders with lineItems arrays on the app side
```
For ORMs, use the eager-load / include / `preload` feature — but verify what it emits, because the naive helper sometimes generates an IN clause with thousands of ids and hits its own plan-cache failure mode. DataLoader (per-request batching + caching) is the standard fix in GraphQL resolvers.

**Detection:** deterministic candidate (loops containing DB query calls; easy to detect statically).

---

### unbounded-list

**Smell:** A query, an in-memory list, or a queue that has no upper bound. "It fits in memory today" is the whole design.

**Example (bad):**
```ts
const allUsers = await db.query('SELECT * FROM users');  // 4M rows at 2KB each = 8 GB
for (const u of allUsers) await sendEmail(u);
```

**Why wrong:** Memory, bandwidth, and latency all scale with the dataset. The service happily runs on tiny fixtures and OOMs in production. The OOM is the good case; a slow disk swap that degrades the whole box without crashing is worse.

**Fix:** Stream. Cursor-based iteration for DB, bounded channels for queues, chunked reads for files.
```ts
// Postgres cursor
const cursor = db.cursor('SELECT * FROM users');
while (true) {
  const batch = await cursor.read(500);
  if (batch.length === 0) break;
  await Promise.all(batch.map(sendEmail));
}
```
Hard cap on everything: query row limit, in-memory collection size, upload size, response size. "Impossibly large today" is production tomorrow.

**Detection:** deterministic candidate (DB queries without a LIMIT clause that return arrays; in-memory accumulation with no bound check).

---

### no-pagination

**Smell:** Closely related to `no-pagination-on-list` in api-design.md, but here the focus is the internal/operational query — internal admin tools, cron jobs, background reports, CSV exports.

**Example (bad):**
```ts
// nightly report job
const everything = await db.query(
  `SELECT * FROM events WHERE created_at > NOW() - INTERVAL '1 day'`
);
writeCsv(everything);
```

**Why wrong:** The job was OK when daily volume was 10k rows. At 10M rows it runs for hours, holds a transaction open, bloats replication lag, and eventually fails on memory. The failure is invisible until the day it happens, because nothing in the query advertises how large the result set is.

**Fix:** Process in chunks. Cursor or keyset pagination is robust under concurrent writes; offset pagination works if the data is stable.
```ts
let lastId = 0;
while (true) {
  const batch = await db.query(
    `SELECT * FROM events WHERE id > $1 AND created_at > NOW() - INTERVAL '1 day'
     ORDER BY id LIMIT 1000`,
    [lastId]
  );
  if (batch.length === 0) break;
  writeCsv(batch);
  lastId = batch[batch.length - 1].id;
}
```

**Detection:** deterministic candidate (DB queries without a LIMIT or cursor, especially in long-running jobs).

---

### sync-loop-with-await

**Smell:** A loop that awaits each iteration sequentially when the iterations are independent and could run concurrently.

**Example (bad):**
```ts
for (const userId of userIds) {
  await sendEmail(userId);
}
// total time = N * single-call time
```

**Why wrong:** Serial execution wastes the concurrency the runtime offers. For 100 independent calls at 200 ms each, serial takes 20 s; a modest 10-wide parallelism takes 2 s. But unbounded parallelism is also wrong — fire-and-forget `userIds.map(sendEmail)` may overwhelm the remote or your own FD limit.

**Fix:** Bounded concurrency. Libraries like `p-limit` (JS), `errgroup` (Go), `asyncio.gather` with a `Semaphore` (Python) give you a knob.
```ts
import pLimit from 'p-limit';
const limit = pLimit(10);  // 10 concurrent calls
await Promise.all(userIds.map(id => limit(() => sendEmail(id))));
```
The right width depends on downstream capacity (connection pool size, rate limit) and on how much parallelism your own runtime can usefully execute. Default to small (5–20) and raise only with measurement.

**Detection:** heuristic (for/while loop bodies containing a single `await` of a call that does not depend on the previous iteration's result).

---

### over-fetching

**Smell:** `SELECT *` on wide tables; returning full entities on list endpoints; loading entire aggregates into memory to read one field.

**Example (bad):**
```ts
const users = await db.query('SELECT * FROM users');  // 60 columns, includes blob avatar, preferences JSONB, ...
const emails = users.map(u => u.email);
```

**Why wrong:** Network bandwidth, DB buffer pool cache pressure, and JSON serialization cost all scale with payload. You read 60 columns to use one. Most of what you loaded is junk your endpoint throws away — but you paid for all of it in every hop.

**Fix:** Project exactly what you need. `SELECT email FROM users` for this case; `SELECT id, email, status FROM users` when you need slightly more. Use views or DTOs to give meaningful names to these projections.
```ts
const emails = await db.query('SELECT email FROM users');
```
For HTTP responses, consider the `fields=` pattern or separate endpoints for summary vs detail views. GraphQL solves this by construction; REST requires discipline.

**Detection:** heuristic (`SELECT *` in hot-path queries; response payloads where the route handler uses only a subset of fields).

---

### no-cache-layer

**Smell:** Every read goes to the origin of truth, regardless of how rarely the underlying data changes or how many times the same value is requested.

**Example (bad):**
```ts
app.get('/config', async (req, res) => {
  const config = await db.query('SELECT * FROM site_config LIMIT 1');
  res.json(config);
});
// 10 req/s hitting DB for data that changes once a week
```

**Why wrong:** You're paying DB cost for read patterns that fit trivially in a cache. Worse, the uncached path is the bottleneck for capacity planning — you provision for the read rate as if it all went to origin.

**Fix:** Choose the right cache layer for the staleness tolerance and consistency need.
- **Process-local memoization** (in-process Map): fastest, stalest, not shared. Good for per-request scope (request-scoped DataLoader).
- **Shared cache (Redis / Memcached)**: next-fastest, shared across processes, has its own failure mode.
- **HTTP cache (CDN / reverse proxy)**: fastest of all when applicable; `Cache-Control: public, max-age=...` on the response.

```ts
const configCache = new Cache<Config>({ ttl: 60_000 });
app.get('/config', async (req, res) => {
  const config = await configCache.fetch('site', async () => {
    return db.query('SELECT * FROM site_config LIMIT 1');
  });
  res.json(config);
});
```
Always plan for cache stampede (thundering herd): cache misses should coalesce into a single origin call per key. `singleflight` / `stale-while-revalidate` patterns prevent a cold cache from flooding the DB.

**Detection:** heuristic (repeated reads to effectively-static data without any caching layer; requires traffic analysis or flow-sensitive review).

---

### serial-io

**Smell:** Two or more independent I/O operations run sequentially when they could run concurrently.

**Example (bad):**
```ts
const user = await userRepo.findById(userId);           // 20 ms
const permissions = await permRepo.forUser(userId);     // 30 ms
const subscription = await billingApi.get(userId);      // 150 ms
// total: 200 ms, but nothing after the first depends on anything prior
```

**Why wrong:** Three independent calls done serially take their sum; done concurrently, they take their max. For latency-sensitive endpoints, this is easy latency to give back.

**Fix:** `Promise.all` (JS), `errgroup` / goroutines (Go), `asyncio.gather` (Python) — the idiom exists in every ecosystem.
```ts
const [user, permissions, subscription] = await Promise.all([
  userRepo.findById(userId),
  permRepo.forUser(userId),
  billingApi.get(userId)
]);
// total: 150 ms
```
Caveat: when one call depends on another, parallelism is not available. Don't fabricate it at the cost of correctness. And watch for error-handling semantics — `Promise.all` rejects on the first failure; if you need all results regardless, `Promise.allSettled` is the right choice.

**Detection:** heuristic (adjacent awaits in the same function where the second does not consume the first's result).

## Principles

1. **Scale-sensitive: everything scales with something. Know what with.** A constant-time operation (`O(1)`) is safe; a linear one (`O(N)` in queries, in memory, in time) needs a bound. "Is this O(N) acceptable here?" is the question every loop, every query, every accumulator should answer.

2. **Measure before you optimize.** A profile trace, a DB EXPLAIN plan, a flamegraph beats intuition every time. Most "obvious" optimizations target code that was never on the hot path.

3. **Latency budget, not latency wish.** Each endpoint has a total latency target. Every call inside it has a sub-budget. When you add a new dependency call, allocate it from somewhere; don't just hope the whole thing still fits.

4. **Cache at the right layer.** Process, distributed, HTTP-edge. Each has different invalidation cost, consistency, and failure behavior. Match the cache layer to the question "what is the user willing to see the stale value of, and for how long?"

5. **Paginate, stream, batch. Never assume "it fits."** Today's row count is not tomorrow's row count. Code that cannot survive 100× growth of its inputs is code with a planned outage.

6. **Parallelize independent work; bound the parallelism.** Serial for independent calls is wasteful; unbounded parallelism is hostile. Middle ground is the answer, with the width chosen per downstream capacity.

## Rubric

- [ ] No loop issues one query per element for a related entity (N+1 check).
- [ ] Every DB query has an explicit LIMIT or cursor; no unbounded fetches.
- [ ] Background jobs paginate/chunk; they do not load full daily volume into memory.
- [ ] Loops that await independent calls use bounded parallelism (`p-limit`, semaphore, etc.).
- [ ] Hot-path queries project only required columns; `SELECT *` is reviewed for necessity.
- [ ] Frequently-read, rarely-changing data is cached; caches have TTL and invalidation documented.
- [ ] Cache misses for popular keys are coalesced (singleflight / request deduplication).
- [ ] Independent I/O in request handlers is parallelized; serial await chains are audited.
- [ ] Each endpoint has a stated latency budget; dependencies sum within it.
- [ ] Performance regressions are caught by an automated benchmark or load test.

## References

- Martin Kleppmann, *Designing Data-Intensive Applications*, O'Reilly, 2017. Scalability, consistency, performance chapters.
- Brendan Gregg, *Systems Performance*, 2nd ed., Addison-Wesley, 2020. USE method, latency analysis.
- PostgreSQL documentation — *Performance Tips* and *Indexes*. Canonical tuning guidance.
- *High Performance Browser Networking*, Ilya Grigorik, O'Reilly, 2013 (free at hpbn.co). HTTP-level latency/caching.
- *Designing Data-Intensive Applications* + Jepsen test reports (https://jepsen.io) — failure modes of distributed systems under load.
- Google SRE Book — chapters on *Monitoring Distributed Systems* and *Load Balancing at the Datacenter*.
- RFC 9111 — HTTP Caching. CDN/proxy cache semantics.

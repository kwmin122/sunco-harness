# Reliability and Failure Modes

## Overview

Reliability is the property that a system still behaves correctly when something it depends on misbehaves. In production, something always is: a downstream service is slow, a network route flaps, a disk fills, a third party has a bad deploy. Code that assumes its dependencies are fast and available is code that is outage-prone in direct proportion to how many dependencies it has.

This reference is for engineers writing services that call other services, databases, queues, or third-party APIs. The anti-patterns below each represent a common way that a single unhealthy dependency takes down an entire service — and the fix turns that co-failure into a contained, observable degradation.

## Anti-patterns

### missing-timeout

**Smell:** An HTTP client, DB query, or queue consumer without an explicit timeout. The default timeout is "never" on most libraries.

**Example (bad):**
```ts
const response = await fetch(`https://api.vendor.com/v1/lookup/${id}`);
// fetch has no default timeout; this can hang for minutes
```

**Why wrong:** When the remote stops responding, the call waits forever. Your request-handler thread/coroutine is held. New incoming requests queue behind it. Within minutes, every worker is stuck on the dead dependency and the service is unresponsive even to health checks. A two-minute third-party hiccup becomes your twenty-minute outage.

**Fix:** Every network call has a timeout, measured in units of "what latency is this call allowed to add to this request?" — not "what latency does the remote advertise."
```ts
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 2000);
try {
  const response = await fetch(
    `https://api.vendor.com/v1/lookup/${id}`,
    { signal: controller.signal }
  );
  return response.json();
} finally {
  clearTimeout(timer);
}
```
Typical budgets: internal-service calls 200–500 ms, third-party APIs 1–3 s, slow operations with fallback 5–10 s. Total request timeout is the sum of its parts — work backward from the user-facing deadline.

**Detection:** deterministic candidate (AST scan for `fetch(`, `axios.*`, `http.request`, DB `query` calls without timeout option).

---

### no-retry-backoff

**Smell:** Either no retry at all (any transient failure propagates), or retry in a tight loop (`for i in 0..5: call(); sleep(100ms)`), or retry on every error including 4xx / validation failures.

**Example (bad):**
```ts
for (let i = 0; i < 5; i++) {
  try {
    return await remoteCall();
  } catch (e) {
    await sleep(100);
  }
}
throw new Error('retries exhausted');
```

**Why wrong:** No retry means brittle; tight-loop retry means that when the remote is overloaded, you send the same burst five times in a row — amplifying the outage instead of absorbing it. Retrying on 4xx means retrying validation failures, which will never succeed.

**Fix:** Retry only idempotent operations, only on transient errors (5xx, timeouts, connection reset), with exponential backoff and jitter. Cap the total retry time budget.
```ts
async function withRetry<T>(fn: () => Promise<T>, opts = { attempts: 4 }): Promise<T> {
  let lastError;
  for (let i = 0; i < opts.attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!isTransient(e)) throw e;
      lastError = e;
      const baseMs = 100 * 2 ** i;
      const jitter = Math.random() * baseMs;
      await sleep(baseMs + jitter);
    }
  }
  throw lastError;
}
```
For non-idempotent operations (creating an order, charging a card), use an idempotency key — the remote is responsible for de-duplicating retries; you are responsible for generating and stably resending the same key.

**Detection:** heuristic (presence of retry loops without exponential backoff; retrying on generic `Error` without filtering; hard to detect without understanding the operation's idempotency).

---

### sync-call-in-hot-path

**Smell:** A request handler makes a synchronous call (DB write, external API, email send) whose result the user does not actually need in order to respond.

**Example (bad):**
```ts
app.post('/signups', async (req, res) => {
  const user = await createUser(req.body);
  await sendWelcomeEmail(user.email);     // 800ms, user doesn't need this inline
  await notifySlack('#signups', user);    // 200ms
  await indexInAnalytics(user);           // 400ms
  res.json(user);                         // response took 1.4s more than it had to
});
```

**Why wrong:** The user's perceived latency is the sum of every dependency in the hot path — including dependencies that have no bearing on the response. If the Slack webhook is down for 20 seconds, every signup takes 20 seconds.

**Fix:** Push non-critical work to a queue, event bus, or background job. Respond as soon as the state that the user needs is persisted. Compensate asynchronously.
```ts
app.post('/signups', async (req, res) => {
  const user = await createUser(req.body);
  await queue.publish('user.signed_up', { userId: user.id });  // fast local write
  res.json(user);
});
// Separate worker subscribes to 'user.signed_up' and does email/slack/analytics.
```
The queue becomes the point of durability: if the worker is down, messages accumulate; when it recovers, they process. The user-facing endpoint is insulated.

**Detection:** heuristic (request handlers with ≥3 awaited external calls, or awaits of operations whose result is not used in the response).

---

### silent-catch

**Smell:** `try { ... } catch (e) {}` — an empty catch block, or one that only logs and swallows, or one that returns a default without recording the failure.

**Example (bad):**
```ts
try {
  await cache.set(key, value);
} catch (e) {
  // ignore
}
```

**Why wrong:** Failures become invisible. The cache-set failed; maybe Redis is down, maybe the key is oversized, maybe auth expired — you will never know, and the symptom will surface days later as "why are our cache hit rates zero?" Silent catches are the single most common source of outages that were actually already happening.

**Fix:** Catch only what you intend to handle, rethrow the rest, and always record observability. If you genuinely want to continue on a specific failure, record it as a structured warning with the full context.
```ts
try {
  await cache.set(key, value);
} catch (e) {
  if (e instanceof CacheQuotaExceeded) {
    logger.warn('cache.set.quota_exceeded', { key, size: value.length });
    metrics.counter('cache.set.failure').inc({ reason: 'quota' });
  } else {
    throw e;  // unknown — do not swallow
  }
}
```
The test: after an hour in production, a silent failure in this path must be visible on a dashboard or in a log query.

**Detection:** deterministic candidate (AST: empty catch blocks, or catch blocks with only a log call and no rethrow / metric / error return).

---

### cascading-failures

**Smell:** One overloaded dependency makes every service that calls it also overloaded. Either because timeouts are too long (see above), because queues in front of the dependency keep accepting work, or because the calling service has no concept of "I should stop sending requests to a broken thing."

**Example (bad):**
```
  service A →  service B  →  service C (degraded, 10s latency)
                   ↓
  service A's threads all stuck waiting on B
  service A returns 5xx to its users
  other services calling A see A as degraded
  (outage fans out)
```

**Why wrong:** The whole architecture has the latency characteristic of its worst dependency, amplified by thread-pool exhaustion. A single hot partition in a database brings down three services, each of which has nothing wrong with its own logic.

**Fix:** Three complementary techniques:
- **Timeouts** (above): bound the wait.
- **Circuit breakers** (below): stop sending when the remote is broken.
- **Load shedding**: when your own service's queue depth or latency crosses a threshold, reject new requests with 503 so they fail fast upstream. Better to say "no" cleanly than to hold everything and eventually crash.

```ts
if (concurrency.current > concurrency.max) {
  res.status(503).setHeader('Retry-After', '1').json({ error: 'overloaded' });
  return;
}
```

**Detection:** heuristic (absence of circuit breakers, absence of queue-depth-based shedding, absence of bulkheads between dependencies).

---

### no-bulkhead

**Smell:** All requests share one thread pool, one connection pool, one event loop budget — so a slow dependency consumed by endpoint X starves endpoints A/B/C that never even called X.

**Example (bad):** A single HTTP client with a 10-connection pool is used for three different upstream services. When upstream #1 is slow, all 10 connections are held waiting on it. Calls to upstreams #2 and #3 queue indefinitely despite those upstreams being healthy.

**Why wrong:** A single tenant, a single endpoint, or a single upstream can exhaust the shared pool and take down all functionality. There is no isolation: every resource is fungible and therefore every resource can be stolen.

**Fix:** Isolate critical paths into separate resource pools. Sometimes called "bulkheading" — the ship analogy: a hole in one compartment doesn't sink the whole vessel.
```ts
const paymentClient = new HttpClient({ poolSize: 10 });    // dedicated to payments
const cdnClient     = new HttpClient({ poolSize: 5 });     // dedicated to CDN ops
const generalClient = new HttpClient({ poolSize: 20 });    // everything else

// Same idea for worker queues: per-priority or per-tenant queue/pool pairs.
```
Cost: more pools, more config, more observability. Benefit: partial outages stay partial.

**Detection:** heuristic (single shared HTTP client / thread pool / connection pool used for fundamentally different upstreams).

---

### no-circuit-breaker-on-3rd-party

**Smell:** Every request calls a third-party dependency whether the third party is healthy or not. When the third party is down, your service generates thousands of failing calls per second, filling logs, consuming quota, and possibly making the vendor's outage worse.

**Example (bad):**
```ts
app.post('/fraud-check', async (req, res) => {
  const score = await fraudVendor.score(req.body);  // vendor has been 5xx'ing for 10 minutes
  res.json({ score });
});
```

**Why wrong:** You've replaced "vendor outage affects me" with "vendor outage affects me maximally." Every user-request wastes the full timeout on a dependency you already know is broken. Structured retries amplify; vendor quota is consumed by failing calls; your own logs and metrics drown in a repeated error.

**Fix:** A circuit breaker tracks recent failure rates per dependency. When failures exceed a threshold, the breaker opens — subsequent calls fast-fail without hitting the remote for a cooldown window. After cooldown, a small probe request checks whether the remote recovered.
```ts
const breaker = new CircuitBreaker(fraudVendor.score, {
  failureThreshold: 0.5,
  minCalls: 20,
  openDurationMs: 30_000
});

app.post('/fraud-check', async (req, res) => {
  try {
    const score = await breaker.call(req.body);
    res.json({ score });
  } catch (e) {
    if (e.code === 'BREAKER_OPEN') {
      // fall back to a cached / default policy
      res.json({ score: DEFAULT_FRAUD_SCORE, degraded: true });
    } else throw e;
  }
});
```
The fallback is the hard part. "Fail the request" is sometimes acceptable; "use a cached answer, flagged as degraded" is often better; "queue for deferred processing" is sometimes right. Decide per operation, per business impact.

**Detection:** deterministic candidate (calls to known third-party SDKs — Stripe, Twilio, SendGrid, OpenAI, etc. — without a circuit-breaker wrapper; detector can list third-party SDK imports and check for wrapper usage).

## Principles

1. **Assume every dependency can be slow, absent, or wrong.** Design the calling code so that "slow" is a bounded cost, "absent" is a defined fallback, and "wrong" is caught and surfaced rather than propagated silently.

2. **Fast-fail on the hot path.** If the system is unhealthy, a quick error is far more useful than a slow one: upstream retries, dashboards, and users all recover faster from an explicit "no" than from a hanging "maybe."

3. **Push non-critical work off the request path.** Durability belongs to queues and background jobs. Responsiveness belongs to request handlers. The two have different requirements and should not be forced into the same code path.

4. **Know your idempotency story per operation.** Some calls can be safely retried; some cannot. For the ones that cannot, carry an idempotency key end-to-end. Do not fake idempotency with "probably the same key."

5. **Bulkhead critical paths from everything else.** Separate pools for payments vs logging, for high-priority tenants vs low, for synchronous vs asynchronous work. The extra config is cheaper than the fused-outage it prevents.

6. **Degrade gracefully, visibly.** When a fallback fires, the response carries a signal (a header, a field, a log entry) saying "this response is degraded." Users may not notice, but you will — and debugging the degraded path is infinitely easier when it's observable.

## Rubric

- [ ] Every outbound network/DB/queue call has an explicit, justified timeout.
- [ ] Retries are restricted to idempotent operations and transient errors, with exponential backoff and jitter.
- [ ] No synchronous call in a request handler whose result is not used in the response.
- [ ] Every catch block either handles a specific error or rethrows; no silent swallowing.
- [ ] Queue/thread pool saturation triggers explicit load shedding (503), not unbounded queueing.
- [ ] Critical dependencies have separate resource pools from non-critical ones.
- [ ] Every third-party integration has a circuit breaker and a documented fallback behavior.
- [ ] Non-critical side-effects (email, analytics) are dispatched via queue, not awaited inline.
- [ ] Degraded responses are flagged in the response body or headers and emit a metric.

## References

- Michael T. Nygard, *Release It!: Design and Deploy Production-Ready Software*, 2nd ed., Pragmatic Bookshelf, 2018. Timeouts, circuit breakers, bulkheads — foundational.
- Google SRE Book, chapters on *Handling Overload* and *Addressing Cascading Failures* (https://sre.google/books/). Load shedding, graceful degradation at scale.
- Brendan Gregg, *Systems Performance*, 2nd ed., Addison-Wesley, 2020. Resource-saturation and utilization heuristics.
- Sam Newman, *Building Microservices*, 2nd ed., O'Reilly, 2021. Reliability patterns for inter-service calls.
- RFC 9110 §15.5.15 — HTTP 503 Service Unavailable semantics.
- AWS Architecture Center — *Reliability Pillar* whitepaper (https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/).

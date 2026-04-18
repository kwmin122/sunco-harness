# Observability and Operations

## Overview

Observability is the ability to ask a question of your running system and get an answer without reproducing the issue locally. In production, "what is going wrong right now?" is asked in the middle of an incident, often at 3 a.m., often by someone who did not write the code. If the answer requires redeploying with extra logs, the observability is inadequate.

This reference is for engineers shipping services into production. It covers the three classic signals — logs, metrics, traces — and their operational context (health checks, deploys, runbooks). The anti-patterns below each represent a way that data you *could* have collected was collected in a shape that's useless when you need it.

## Anti-patterns

### no-request-id

**Smell:** Log lines, error reports, and metric samples cannot be correlated back to a specific request. Debugging a customer report ("this happened at 14:03") requires reading every log line in that time window.

**Example (bad):**
```
14:03:01 INFO  auth checked
14:03:01 INFO  fetched order
14:03:02 ERROR stripe call failed: timeout
14:03:02 INFO  fetched order
14:03:02 INFO  fetched order
```
Three requests' worth of log lines interleaved; no way to know which `stripe call failed` belongs to which user's session.

**Why wrong:** You cannot tell the story of a single request. The investigation becomes "find log lines that are plausibly related" rather than "get all log lines for request X." For distributed systems, it is worse: lines come from three services and you cannot stitch the flow.

**Fix:** Assign a request id at the entry point (or propagate it from an upstream header like `X-Request-ID` or W3C `traceparent`). Attach it to every log line, every metric dimension where it fits, every outbound request.
```ts
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] ?? crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  logger.withContext({ requestId: req.id }, () => next());
});
```
Use OpenTelemetry's `traceparent` (W3C spec) for cross-service propagation — it's the industry-standard shape that every tool now reads.

**Detection:** deterministic candidate (no middleware attaching a request-scoped id to logs; or log output lines without a request-id field).

---

### log-without-level

**Smell:** `console.log(...)` or `print(...)` everywhere, instead of a structured logger with levels (debug/info/warn/error). Or levels exist but are used inconsistently — "error" for normal validation failures, "info" for actual faults.

**Example (bad):**
```ts
console.log('got request', req.url);
console.log('db error', err);
console.log('order placed', order);
```

**Why wrong:** In production, you cannot filter by severity. Search tools treat every line as equal weight, so "show me the errors from last hour" is not a query you can run. And `console.log` typically writes unstructured strings — field-based search is impossible.

**Fix:** Use a structured logger (pino, winston, zap, structlog) with defined levels and a consistent severity vocabulary:
- `debug`: developer diagnostic, normally off in prod.
- `info`: expected lifecycle events (request received, job completed).
- `warn`: something unusual but handled (degraded path taken, retry fired, cache miss stampede).
- `error`: a fault that requires a human, or that the user experienced as a failure.
- `fatal`: process will exit; paging event.

```ts
logger.info('request.received', { method: req.method, path: req.path, requestId: req.id });
logger.warn('cache.stampede', { key, concurrentMisses: 8, requestId: req.id });
logger.error('db.query.failed', { query: 'users.findById', err, requestId: req.id });
```
Define a convention ("what counts as a warn vs an error?") and enforce it in code review — inconsistency is the real problem, not the exact taxonomy.

**Detection:** deterministic candidate (AST: `console.log`/`print` calls in non-test files; use of a real logger without level specification).

---

### metric-without-dimensions

**Smell:** A counter or histogram with no dimensions — `requests_total` incremented globally, with no label for route, method, or status. The metric answers "how much in total" but nothing more specific.

**Example (bad):**
```ts
metrics.counter('requests_total').inc();
metrics.histogram('request_duration').observe(elapsedMs);
```

**Why wrong:** During an incident, the only information available is "traffic is up" or "latency is up" — not *which route*, *which customer*, *which status code*. Debugging becomes guesswork. Metrics without dimensions are barely better than no metrics.

**Fix:** Include the dimensions you'll want during an incident. The classic four for HTTP:
```ts
metrics.counter('http_requests_total').inc({
  method: req.method,
  route: req.route?.path ?? 'unknown',   // template, not concrete URL
  status: res.statusCode
});
metrics.histogram('http_request_duration_ms').observe(elapsedMs, {
  method: req.method,
  route: req.route?.path,
  status: res.statusCode
});
```
**Use the route template, not the concrete URL.** `/users/:id` has a small cardinality; `/users/1`, `/users/2`, ... would explode your metric backend. Cardinality is the cost axis of metrics: every label value combination is a distinct timeseries.

Industry-standard dimensions: method, route template, status code, service name, environment. Add business dimensions (tenant, customer tier) only when you're sure the cardinality is bounded.

**Detection:** deterministic candidate (metric calls with no labels/dimensions, or with the concrete URL as a dimension).

---

### pii-in-log

**Smell:** Logs contain personally identifiable information — email addresses, names, phone numbers, IPs, full session tokens, payment card numbers.

**Example (bad):**
```ts
logger.info('signup', { email, name, phone, address });
```

**Why wrong:** Logs end up in places with different (and usually lower) access controls than the database. GDPR Article 32, HIPAA, PCI-DSS all treat log storage as regulated data when they contain PII. Even internally, leaking user data across teams who don't need it is a policy violation. The right-to-be-forgotten problem becomes "delete from 30 log stores across 5 vendors for this user's id" — often impossible.

**Fix:** Log references, not data. The user's id is OK (internal, not PII if not joinable externally). The email is not — replace it with a hash, a prefix (first two chars + `***`), or just the user id.
```ts
logger.info('signup', {
  userId: user.id,
  emailDomain: email.split('@')[1],   // domain is safer than full address
  region: geoip.lookup(req.ip).country  // country-level is safer than full IP
});
```
Same rule for error reports: Sentry / Rollbar / Datadog error payloads are log storage. Scrub PII before sending, or configure the client-side sanitizer to do so.

**Detection:** heuristic (log arguments containing variables named `email`, `phone`, `address`, `password`, `ssn`, `credit_card`, `token`, `cookie`; static scan catches common cases, runtime sampling catches the rest).

---

### no-trace-propagation

**Smell:** Service A calls service B, which calls service C. When a request fails at C, you cannot correlate it back to the original A-side request. Each service has its own logs with its own request ids; no common trace links them.

**Example (bad):** Service A receives request `req_a1`. Calls B without forwarding the id. Service B generates its own `req_b1`. Calls C. Service C generates `req_c1`. Three request ids, three log streams, no way to join.

**Why wrong:** Multi-service debugging is effectively impossible. Latency attribution ("where did the 2 s go?") is guesswork across three dashboards. Root-cause analysis for a distributed failure requires manually aligning timestamps.

**Fix:** Propagate the trace context (W3C `traceparent` + `tracestate`) as a header on every outbound call. Use OpenTelemetry or an equivalent — it handles propagation correctly across HTTP, gRPC, queue messages, and async boundaries.
```ts
// A makes a call to B
const headers = { ...injectTraceContext(ctx) };
await fetch('https://b/endpoint', { headers });

// B receives and extracts
app.use((req, res, next) => {
  const ctx = extractTraceContext(req.headers);
  trace.start(ctx);
  next();
});
```
Once trace propagation works, a single trace-id query returns the whole distributed flow across services, grouped as spans. This is usually the highest-leverage observability investment a multi-service system can make.

**Detection:** heuristic (outbound HTTP/gRPC/queue calls without injection of trace/correlation headers; requires framework knowledge).

---

### error-without-context

**Smell:** An error is thrown or logged with only a message string — no input values, no request id, no stack trace of the surrounding operation, no indication of which attempt/retry this was.

**Example (bad):**
```ts
throw new Error('invoice fetch failed');
```
In logs:
```
ERROR invoice fetch failed
    at InvoiceRepo.get (repo.ts:32)
```
Now what? Which invoice? Which caller? Which tenant? Which attempt? You can't answer any of those from this.

**Why wrong:** Errors without context cannot be triaged. A ticket that says "invoice fetch failed 40 times this hour" tells you nothing about whether it's one broken invoice or forty, one tenant or forty, one code path or forty.

**Fix:** Structured errors with the context attached. When catching and rethrowing, add layers of context rather than replacing the message.
```ts
class InvoiceFetchError extends Error {
  constructor(public invoiceId: string, public tenantId: string, public cause: unknown) {
    super(`failed to fetch invoice ${invoiceId} for tenant ${tenantId}`);
    this.name = 'InvoiceFetchError';
  }
}

// in the repo
try {
  return await db.query(...);
} catch (e) {
  throw new InvoiceFetchError(id, tenantId, e);
}
```
When logging the error, emit it as structured data with all its context:
```ts
logger.error('invoice.fetch.failed', {
  invoiceId: e.invoiceId,
  tenantId: e.tenantId,
  cause: e.cause instanceof Error ? { message: e.cause.message, code: (e.cause as any).code } : String(e.cause),
  requestId: req.id,
  attempt: retry.attempt
});
```

**Detection:** heuristic (throw sites with bare `new Error('string')` constructors containing no variable interpolation; log sites where the error is passed without surrounding context).

## Principles

1. **Instrument for the question you'll ask at 3 a.m.** Design logs, metrics, and traces around incident workflows, not around "what's easy to emit." The test: during the next outage, can you answer "which route, which tenant, which dependency" in under a minute?

2. **Three signals, three jobs.** Metrics for "is anything wrong and roughly where." Logs for "what exactly happened on this request." Traces for "where did the time go across services." Each signal excels at one thing; confusing the three leads to high cost and low insight.

3. **High cardinality goes in traces and logs, not metrics.** Metric labels are expensive; add only bounded-cardinality dimensions. When you need per-request detail, that's a log event or a trace span, not a new label.

4. **Propagate context across every boundary.** Request id, trace id, tenant id, user id. If those don't flow into downstream logs, debugging degrades to guessing.

5. **Runbooks beat heroics.** Every paging alert should have a runbook link. Runbooks don't have to be long; they have to exist, be discoverable from the alert, and tell the on-call what to check and what to do. Tribal knowledge fails when the expert is on vacation.

6. **Observability is a production feature, not an afterthought.** Ship it with the feature, not in a follow-up. The cost of adding it later is higher than the cost of adding it now, and the gap is where outages live.

## Rubric

- [ ] Every log line has a request id (and trace id if distributed).
- [ ] Logs are structured (JSON or equivalent) with defined levels; no `console.log` in production paths.
- [ ] Metrics carry method/route/status dimensions (or equivalent for non-HTTP surfaces).
- [ ] No metric uses concrete URLs, user ids, or unbounded strings as label values.
- [ ] No PII (emails, phones, full IPs, tokens) appears in logs or error reports.
- [ ] Trace context is propagated to every downstream service call and queue message.
- [ ] Every error carries contextual fields (relevant ids, inputs, attempt number, cause).
- [ ] Service exposes `/healthz` (liveness) and `/readyz` (readiness) endpoints with appropriate semantics.
- [ ] Every paging alert links to a runbook.
- [ ] Dashboards exist for each service's RED metrics (Rate, Errors, Duration) or USE metrics (Utilization, Saturation, Errors).

## References

- Google SRE Book and SRE Workbook, chapters on *Monitoring Distributed Systems*, *Practical Alerting*, *Managing Incidents*. Canonical reference. https://sre.google/books/
- Charity Majors, Liz Fong-Jones, George Miranda, *Observability Engineering*, O'Reilly, 2022. Events-first observability, high-cardinality tracing.
- W3C Trace Context, https://www.w3.org/TR/trace-context/. Standard for cross-service trace propagation.
- OpenTelemetry Specification, https://opentelemetry.io/docs/specs/otel/. Industry-standard API for traces, metrics, logs.
- Brendan Gregg, *Systems Performance*, 2nd ed., Addison-Wesley, 2020. USE method for resource monitoring.
- Tom Wilkie (Weaveworks), *The RED Method* — conference talk / blog series. Rate-errors-duration dashboard pattern.

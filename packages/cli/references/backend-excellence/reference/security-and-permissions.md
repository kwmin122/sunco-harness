# Security and Permissions

## Overview

Most backend security incidents are not failures of cryptography or novel exploits. They are the same half-dozen patterns repeated: missing authorization on an endpoint, untrusted input interpolated into a query, a secret written to a log, a CORS policy configured once and forgotten. This reference is for engineers shipping authenticated HTTP services with user- or tenant-scoped data.

The goal is to make the secure path the default path. If authorization is something you must remember to add, you will occasionally forget; if it is a property of the route table that cannot be omitted, you cannot forget. Every anti-pattern below has a "default-safe" fix.

## Anti-patterns

### authz-after-fetch

**Smell:** The endpoint loads the resource first, then checks whether the caller is allowed to access it — or worse, returns the resource and relies on the client to hide what the caller shouldn't see.

**Example (bad):**
```ts
app.get('/invoices/:id', async (req, res) => {
  const invoice = await invoiceRepo.findById(req.params.id);
  if (!invoice) return res.status(404).end();
  res.json(invoice);
  // no check that req.user owns this invoice
});
```

**Why wrong:** Any authenticated user can enumerate invoice ids (`/invoices/1`, `/invoices/2`, ...) and read other tenants' data. This is IDOR — insecure direct object reference — the single most common web vulnerability. The fact that the ids are UUIDs makes it marginally harder, not safe.

**Fix:** Authorization is part of the query, not a check after the query. Scope every tenant-owned read/write by tenant-id at the data layer.
```ts
app.get('/invoices/:id', async (req, res) => {
  const invoice = await invoiceRepo.findByIdForOwner(req.params.id, req.user.orgId);
  if (!invoice) return res.status(404).end();  // not-found and not-allowed look the same
  res.json(invoice);
});
```
For multi-role systems, use a policy object or ABAC/RBAC framework that explicitly returns allow/deny and is invoked on every mutation. Do not let "I forgot to call `authorize()`" be a possible bug.

**Detection:** heuristic (endpoints that fetch by id without including the caller's tenant/owner in the query; requires route-plus-repo analysis).

---

### raw-sql-interpolation

**Smell:** SQL constructed via string concatenation or template literals with user input embedded directly.

**Example (bad):**
```ts
const rows = await db.query(
  `SELECT * FROM users WHERE email = '${req.body.email}' AND tenant = '${req.body.tenant}'`
);
```

**Why wrong:** Classic SQL injection. `email = 'anything' OR '1'='1'` returns every row. Worse: `email = '; DROP TABLE users; --` is the textbook example and still happens. No escaping, no ORM, no parameter binding = no defense.

**Fix:** Parameterized queries, always. Every DB driver supports them.
```ts
const rows = await db.query(
  `SELECT * FROM users WHERE email = $1 AND tenant = $2`,
  [req.body.email, req.body.tenant]
);
```
Even with an ORM, be wary of raw-SQL escape hatches that accept a string. If dynamic fragments (e.g., column names for sorting) are required, whitelist the allowed values — never interpolate the client's value directly.
```ts
const SORT_COLUMNS = { created_at: 'created_at', amount: 'amount' };
const sortBy = SORT_COLUMNS[req.query.sort] ?? 'created_at';
// safe: sortBy is one of a finite whitelist
```

**Detection:** deterministic candidate (AST scan for template literals containing SQL keywords — SELECT, INSERT, UPDATE, DELETE, WHERE — with `${...}` expressions).

---

### secret-in-log

**Smell:** API keys, passwords, tokens, or PII end up in log lines or error reports because the developer logged the whole request/response/error object.

**Example (bad):**
```ts
try {
  await vendor.call(config);
} catch (e) {
  logger.error('vendor failed', { config, error: e });
  // config.apiKey is now in Datadog for 30 days
}
```

**Why wrong:** Logs flow into observability systems, SIEMs, support tickets, developer laptops. A secret in a log is a secret in everyone's search history. Rotating that secret is expensive (and often forgotten). Auditors don't love it either.

**Fix:** Define a sanitizer at the logger layer that redacts known sensitive key names. Additionally, never log the full request body or error object — log structured, named fields you chose to include.
```ts
const REDACT = new Set(['password', 'token', 'api_key', 'apiKey', 'authorization', 'secret', 'cookie', 'creditCard']);
function sanitize(obj: any): any {
  // deep walk; replace REDACT keys with '[REDACTED]'
}
logger.error('vendor.failed', {
  vendorName: 'stripe',
  operation: 'charges.create',
  statusCode: e.statusCode,
  requestId: e.requestId,
  // NOT: the full config, the full error
});
```
Pair with a pre-deploy static scan of log calls for literal strings containing known secret patterns (`sk_live_`, `ghp_`, etc.).

**Detection:** deterministic candidate (AST: logger/console calls where the argument is an object with keys matching `/authorization|api[_-]?key|password|token|secret|credential/i`, or the argument is a full request/response/error variable).

---

### any-typed-body

**Smell:** Route handlers accept `req.body` as `any` / `unknown` and pass it to downstream code without schema validation. Type checker says OK; the data can be anything.

**Example (bad):**
```ts
app.post('/orders', async (req: Request, res: Response) => {
  const { customerId, items } = req.body;  // typed as any
  // items might be a string, or null, or {evil: 'payload'}
  const order = await createOrder(customerId, items);
  res.json(order);
});
```

**Why wrong:** Every downstream function now has to defensively validate every field — or, more commonly, doesn't, and silently crashes or mis-behaves on malformed input. Deserialization bugs become security bugs when the "malformed input" is attacker-crafted.

**Fix:** Validate at the boundary with a schema library (zod, valibot, joi, yup, pydantic, jsonschema, ...). Downstream code receives a typed, validated shape.
```ts
const OrderInput = z.object({
  customerId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive().max(1000)
  })).min(1).max(100)
});

app.post('/orders', async (req, res) => {
  const parsed = OrderInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(problemDetails(parsed.error));
  const order = await createOrder(parsed.data.customerId, parsed.data.items);
  res.json(order);
});
```
Validation is a security control, not just a correctness control. `items.max(100)` is the DoS defense; `quantity.max(1000)` is the fraud defense.

**Detection:** deterministic candidate (route handler signatures with `req: Request` or `body: any`/`unknown` and no call to a known validator library within the handler).

---

### open-cors

**Smell:** `Access-Control-Allow-Origin: *` combined with `Access-Control-Allow-Credentials: true` — or a CORS config that reflects any `Origin` header back in the allow-origin response.

**Example (bad):**
```ts
app.use(cors({
  origin: (origin, cb) => cb(null, origin),  // reflects any origin
  credentials: true
}));
```

**Why wrong:** The browser's same-origin policy is the only thing stopping evil.example.com from sending authenticated requests to your API using the user's cookies. If your CORS config reflects any origin with credentials, you have effectively opted out of that protection.

**Fix:** Allow-list specific origins; never combine `*` with credentials; do not reflect. If the API is public and truly does not use cookie-based auth, `*` without credentials is fine — but any authenticated browser API must have a finite origin allow-list.
```ts
const ALLOWED_ORIGINS = new Set([
  'https://app.example.com',
  'https://admin.example.com',
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : [])
]);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, false);  // non-browser clients: no CORS
    cb(null, ALLOWED_ORIGINS.has(origin));
  },
  credentials: true
}));
```

**Detection:** deterministic candidate (CORS config with wildcard origin + credentials:true, or dynamic reflection).

---

### missing-csrf

**Smell:** Cookie-authenticated browser routes accept state-changing requests without CSRF tokens, SameSite cookie flags, or equivalent mitigation.

**Example (bad):**
```ts
// Cookie-based session, no CSRF token, no SameSite enforcement
app.post('/account/delete', requireLogin, async (req, res) => {
  await deleteAccount(req.user.id);
  res.json({ ok: true });
});
```
An attacker's page submits a hidden form that POSTs to `/account/delete`; the browser attaches the user's session cookie; the server happily deletes the account.

**Why wrong:** CSRF exploits the ambient-authority model of cookies. The server cannot distinguish "the user clicked delete in our app" from "the user visited evil.example.com which submitted a form to delete." Without mitigation, every state-changing cookie-auth endpoint is exploitable.

**Fix:** Use at least one of (stacking is better):
- **SameSite cookies:** `Set-Cookie: session=...; SameSite=Lax; Secure; HttpOnly`. Lax is the modern default and blocks most CSRF. Strict is stronger but breaks some flows.
- **CSRF tokens:** double-submit cookie or synchronizer-token pattern. A hidden token in the form/XHR that the attacker cannot read from a cross-origin page.
- **Bearer token / Authorization header:** no ambient authority. Browsers will not automatically attach `Authorization: Bearer ...` to cross-origin requests the way they attach cookies.
- **Re-authentication for high-risk actions** (deleting the account, changing email, disabling 2FA): require re-entering the password or a second factor regardless of session state.

**Detection:** heuristic (cookie-based auth middleware + state-changing POST/PUT/DELETE routes without CSRF middleware or SameSite=Lax/Strict).

---

### role-hardcoded

**Smell:** Permission checks written as hardcoded role strings (`if (user.role === 'admin')`) scattered across handlers. No central policy, no audit of who can do what.

**Example (bad):**
```ts
app.delete('/users/:id', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).end();
  await deleteUser(req.params.id);
  res.status(204).end();
});

// elsewhere:
if (req.user.role === 'admin' || req.user.role === 'support') {
  // ... another ad-hoc rule
}
```

**Why wrong:** There is no single answer to "who can delete users?" — the answer lives in however many handlers mention the role. Adding a new role ("billing-admin" can do some admin things but not others) requires scanning every handler and editing each. Role changes at the person level require a deploy. Audit is impossible.

**Fix:** Centralize permission logic in a policy module. Handlers ask the policy; they do not implement it.
```ts
// policy/users.ts
export const canDeleteUser = (actor: User, target: User): boolean =>
  actor.role === 'admin' ||
  (actor.role === 'support' && target.role === 'user');

// handler
app.delete('/users/:id', async (req, res) => {
  const target = await userRepo.findById(req.params.id);
  if (!canDeleteUser(req.user, target)) return res.status(403).end();
  await deleteUser(target.id);
  res.status(204).end();
});
```
For larger systems, a dedicated policy engine (OPA, Cedar, Oso, Casbin) is worth the setup cost — policies become declarative and auditable.

**Detection:** heuristic (handler files containing role equality checks like `user.role === '...'` or `roles.includes('...')`).

## Principles

1. **Authorize at the data layer, not the application layer.** Filter by tenant/owner in the query. If the row is not owned by the caller, it is not returned, so there is nothing to forget to check.

2. **Validate every boundary input against a schema.** Request bodies, query strings, URL parameters, webhook payloads, file uploads. The schema is the first-class definition; typed handler args come from it.

3. **Treat secrets as radioactive.** They live in a secret manager, they are redacted from logs, they are rotated on a schedule, they are scoped to the narrowest possible resource. The goal is that nothing except the one service that needs a secret ever sees it.

4. **Deny by default.** Every endpoint requires an explicit authorization decision. "No policy stated" means "no access." Linters should flag handlers that declare no auth check.

5. **Defense in depth.** Assume one layer will fail. Output encoding backs up input validation; SameSite cookies back up CSRF tokens; network segmentation backs up authentication.

6. **Security is a property of configuration, not just code.** CORS, CSP, cookie flags, TLS settings, IAM roles — reviewing these on every service deploy catches the issues that pure code review misses.

## Rubric

- [ ] No endpoint returns a tenant-owned resource without filtering by the caller's tenant/owner at the query level.
- [ ] All SQL uses parameterized queries; no user input is interpolated into SQL strings or fragments.
- [ ] Log output is sanitized for known-sensitive keys; no full request/response/error objects are logged raw.
- [ ] Every request body is validated against a schema at the route boundary.
- [ ] CORS is restricted to an explicit origin allow-list when credentials are in use.
- [ ] Cookie-auth routes are protected by SameSite cookies plus CSRF tokens or bearer-token auth.
- [ ] Permission logic lives in a central policy module, not scattered role-string checks.
- [ ] Secrets are loaded from a secret manager, never checked into source, never logged.
- [ ] High-risk actions (account deletion, credential changes) require re-authentication.
- [ ] Security-relevant headers (CSP, HSTS, X-Frame-Options, Referrer-Policy) are reviewed.

## References

- OWASP Top 10 (2021), https://owasp.org/Top10/. Canonical list of web-app vulnerabilities.
- OWASP Application Security Verification Standard (ASVS) 4.0, https://owasp.org/www-project-application-security-verification-standard/. Requirements catalog.
- RFC 6265 — HTTP State Management Mechanism (cookies), and RFC 6265bis — SameSite extension.
- RFC 7519 — JSON Web Token (JWT), and RFC 8725 — JWT Best Current Practices.
- NIST SP 800-63B — Digital Identity Guidelines: Authentication.
- Mozilla Developer Network — *CORS* (https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) and *Content Security Policy* documentation.
- Ross Anderson, *Security Engineering*, 3rd ed., Wiley, 2020.

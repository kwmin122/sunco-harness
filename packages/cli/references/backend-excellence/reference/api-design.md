# API Design

## Overview

An HTTP API is a contract that outlives every implementation behind it. Clients cache assumptions — field names, enum values, pagination shapes, error semantics — and those assumptions are far harder to revise than server code. This reference is for engineers shipping public, partner, or internal HTTP APIs (REST-shaped by default; the same anti-patterns apply to RPC-over-HTTP and GraphQL surface schemas with minor translation).

The goal is not perfection against some abstract REST purity; it is that a competent consumer can read the URL, the response shape, and the error payload, and predict behavior without reading server code. Anti-patterns below violate that prediction.

## Anti-patterns

### verb-endpoints

**Smell:** Endpoints named after actions (`/getUser`, `/createOrder`, `/deleteInvoice/17`) instead of resources.

**Example (bad):**
```http
POST /getOrder
Content-Type: application/json

{"id": 8821}
```

**Why wrong:** Verbs in the path duplicate the HTTP method, prevent cacheability (GET semantics are lost when you `POST /getOrder`), and scale poorly — every new action invents a new endpoint, so the surface area grows with the feature matrix rather than the resource count.

**Fix:**
```http
GET /orders/8821
```
Use nouns (resources) in the path and let the HTTP method carry the verb. When an operation is genuinely non-CRUD (e.g., "cancel an order"), model it as a state transition on a resource: `POST /orders/8821/cancellations` or `PATCH /orders/8821 {status: "cancelled"}` — the latter only if clients are expected to know the allowed state transitions.

**Detection:** deterministic candidate (path segments matching `/(get|create|update|delete|fetch|list|do|run|execute)[A-Z]`).

---

### inconsistent-pluralization

**Smell:** Collection endpoints mix singular and plural in the same API — `/user`, `/orders`, `/invoice`, `/shipments`.

**Example (bad):**
```
GET  /user          → list of users
GET  /order/17      → single order
POST /shipments     → create shipment
```

**Why wrong:** Consumers have to memorize which resources are pluralized and which are not. SDK generators emit awkward helpers (`client.user.list()` alongside `client.orders.list()`). Worse, readers cannot tell whether `/user` returns one user (the authenticated one) or the full collection.

**Fix:** Pick one convention and apply it everywhere. The common convention is: plural for collections, singular segments only for single-resource subpaths keyed by id.
```
GET  /users           → list
GET  /users/17        → one
GET  /users/me        → alias for authenticated user (singular-by-convention alias, documented)
POST /users/17/emails → add email to user 17
```

**Detection:** deterministic candidate (parse route table; flag sibling routes where the first segment is both singular and plural forms of the same stem).

---

### leaky-enum

**Smell:** Enum fields return internal or implementation-derived values — database status codes, feature-flag names, legacy migration states — rather than a stable public vocabulary.

**Example (bad):**
```json
{
  "id": 8821,
  "status": "STATE_AWAITING_STRIPE_WEBHOOK_RETRY_v2"
}
```

**Why wrong:** Consumers will switch on the internal string. The moment you rename the payment provider or retire the v2 retry path, clients break. Enums returned from public APIs are part of the contract at the same level as field names.

**Fix:** Translate internal states into a small, stable, documented public enum. Record the internal-to-public mapping on the server side.
```json
{
  "id": 8821,
  "status": "awaiting_payment"
}
```
Public enum: `pending | awaiting_payment | paid | cancelled | refunded`. Internal state machines can be richer; the wire contract stays lean.

**Detection:** heuristic (enum values containing uppercase, version suffixes, provider names, or `_v\d+` are suspicious; needs human review).

---

### 200-with-error-body

**Smell:** The server returns HTTP 200 with a JSON body like `{"ok": false, "error": "..."}` for errors, reserving non-2xx only for infrastructure failures.

**Example (bad):**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{"ok": false, "error": "insufficient_funds", "message": "Balance too low"}
```

**Why wrong:** HTTP status codes are the layer every tool speaks — load balancers, CDNs, monitoring, retry middleware, structured loggers. Wrapping errors in a 200 hides failures from all of them. A 500-error-rate dashboard reads 0% while customers are getting "insufficient funds" on every checkout.

**Fix:** Use appropriate HTTP status codes for the semantic layer. Business validation failures → 4xx (usually 400, 409, 422). Server faults → 5xx. The body can carry machine-readable detail on top.
```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json

{
  "type": "https://example.com/errors/insufficient-funds",
  "title": "Insufficient funds",
  "status": 422,
  "detail": "Account balance is 120.00 USD; charge is 240.00 USD.",
  "code": "insufficient_funds"
}
```
RFC 9457 (Problem Details) is the standard body shape for errors.

**Detection:** deterministic candidate (response schema with a boolean `ok`/`success` field paired with an `error`/`errors` field on 2xx responses).

---

### untyped-any-response

**Smell:** Response types are documented as "object" or typed as `any` in generated client SDKs because the server returns heterogeneous shapes from one endpoint.

**Example (bad):** `GET /search` returns either `{users: [...]}` or `{orders: [...]}` or `{error: "..."}` depending on query parameters. The OpenAPI schema falls back to `additionalProperties: true`.

**Why wrong:** Clients cannot write type-safe code. Bugs surface only at runtime on specific inputs. Documentation is forced to say "see examples" because the type system cannot carry the shape.

**Fix:** Either split into distinct endpoints with distinct schemas (`/users/search`, `/orders/search`) or use a tagged union:
```json
{
  "kind": "users",
  "results": [{"id": 17, "name": "..."}]
}
```
Discriminator field (`kind` here) must be in the public enum vocabulary. Every client SDK and schema validator understands discriminated unions; they understand `any` only as a failure mode.

**Detection:** deterministic candidate (OpenAPI/JSON Schema `additionalProperties: true` on a response, or TypeScript SDK with `any` / `unknown` response types).

---

### no-pagination-on-list

**Smell:** List endpoints return every matching row, unbounded. There is no `limit`, `cursor`, or `page` parameter — or the parameter exists but has no server-side max.

**Example (bad):**
```http
GET /audit-log
→ 100 MB JSON array of 1.4M rows
```

**Why wrong:** The dataset grows over time. One customer with three years of history takes the API down, and the outage is proportional to your largest tenant, not your median. Even if the response is small today, there is no plausible production dataset where "return everything" survives for a decade.

**Fix:** Paginate all list endpoints. Cursor-based pagination is generally more robust than offset for high-churn collections (no duplicates/gaps on concurrent insert/delete):
```http
GET /audit-log?limit=50&cursor=eyJpZCI6MTIzfQ==

{
  "items": [...],
  "next_cursor": "eyJpZCI6MTczfQ==",
  "has_more": true
}
```
Enforce a server-side default (e.g., 50) and a hard max (e.g., 200) regardless of what the client requests.

**Detection:** deterministic candidate (list endpoints — responses shaped as JSON arrays or with keys like `items`/`results`/`data` — without a pagination parameter in the schema).

---

### overloaded-parameters

**Smell:** A single parameter carries multiple meanings depending on other parameters' values, or the request body mixes filter, projection, and mutation semantics.

**Example (bad):**
```http
POST /users/search
{
  "query": "alice",
  "action": "export",
  "format": "csv",
  "email_to": "ops@example.com"
}
```

**Why wrong:** The endpoint is a search endpoint for most callers and a background-export trigger for a few. Rate limiting, authorization, idempotency, and documentation all have to special-case the embedded action.

**Fix:** Separate the read and the side-effectful operation into distinct endpoints with distinct auth scopes:
```http
GET  /users?query=alice                      → read only
POST /users/exports {"query": "alice", ...}  → creates an export job resource
GET  /users/exports/{id}                     → poll the job
```
The export becomes a first-class resource with its own lifecycle, which is usually what the product actually needs anyway.

**Detection:** heuristic (request bodies with an `action`/`operation`/`mode` field selecting branches; or GET endpoints that mutate state).

## Principles

1. **Resources, not procedures.** URL paths name things; HTTP methods name actions on things. If you cannot name the resource, the operation probably belongs on a different resource or as a new one (a "job", a "session", a "cancellation").

2. **The wire contract is narrower than the internal model.** Public enums, field names, and error codes are a small, stable, documented subset of what lives inside the service. Design the public vocabulary explicitly; don't let it leak by default.

3. **Status codes carry semantics.** Let the HTTP layer do its job. Wrap error detail inside the body (Problem Details), not the status code inside the body.

4. **Every list is paginated, from day one.** Bounding the result set is a property of the endpoint, not a feature you add later. The decision is which pagination style (cursor vs page vs key), not whether.

5. **Evolve by addition.** Prefer new fields, new endpoints, and new enum values (tagged carefully) over changing existing ones. Breaking changes require a version bump; additive changes do not.

6. **Schema-first, hand-written second.** OpenAPI, JSON Schema, or protobuf definitions are the contract. The server serializes the schema; the client generates from the schema. Any divergence (hand-written docs, drift between schema and handler) is a bug to be eliminated in tooling.

## Rubric

- [ ] Every endpoint path names a resource, not a verb.
- [ ] Singular/plural convention is consistent across the entire route table.
- [ ] Every enum field is a documented, versioned public enum — no internal states leaking.
- [ ] All error responses use non-2xx status codes with machine-readable body (Problem Details or equivalent).
- [ ] Every response type has a precise schema (no `any`, no `additionalProperties: true` on untyped maps).
- [ ] Every list endpoint paginates with a server-enforced max.
- [ ] No endpoint mixes read semantics and side-effectful actions in the same call.
- [ ] The API has a published schema (OpenAPI / GraphQL SDL / proto) that is the source of truth for clients.
- [ ] Breaking changes are gated behind an explicit version bump; additive changes ship freely.

## References

- RFC 9110 — HTTP Semantics (2022). Canonical definition of methods, status codes, and caching.
- RFC 9457 — Problem Details for HTTP APIs (2023). Standard error-body shape.
- RFC 5988 / RFC 8288 — Web Linking (2010 / 2017). Relationship hints and `Link` header.
- OpenAPI Specification 3.1 — https://spec.openapis.org. Schema-first API contract.
- Roy Fielding, *Architectural Styles and the Design of Network-based Software Architectures*, Ph.D. dissertation, UC Irvine, 2000. Original REST constraints.
- Mark Nottingham, *Building Protocols with HTTP*, RFC 9205 (2022). Guidance for HTTP-based protocols.

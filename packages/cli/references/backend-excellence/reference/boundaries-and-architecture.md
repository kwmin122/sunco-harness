# Boundaries and Architecture

## Overview

Every backend system is a pile of modules that call each other. The difference between a system that stays maintainable for years and one that congeals into a single untestable blob is not how many layers it has — it's how clearly the boundaries between modules communicate intent and keep responsibilities from bleeding across.

This reference is for engineers structuring services with any stack (Express/Fastify/NestJS on Node, Rails, Django/FastAPI, Go stdlib, Spring). The vocabulary of "controller" / "service" / "repository" is a convenient shorthand for three common roles (transport, domain, data access) — the anti-patterns apply whether you call them that or not.

## Anti-patterns

### god-route-handler

**Smell:** A single route handler runs 200+ lines of business logic, DB calls, HTTP calls, validation, formatting, and conditional branching — often because "it's just one endpoint, why add a service layer?"

**Example (bad):**
```ts
app.post('/orders', async (req, res) => {
  const { items, customerId, couponCode } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'no items' });
  const customer = await db.query('SELECT * FROM customers WHERE id = $1', [customerId]);
  if (!customer) return res.status(404).json({ error: 'no customer' });
  let total = 0;
  for (const item of items) {
    const product = await db.query('SELECT * FROM products WHERE id = $1', [item.id]);
    total += product.price * item.qty;
  }
  if (couponCode) {
    const coupon = await db.query('SELECT * FROM coupons WHERE code = $1', [couponCode]);
    if (coupon) total *= 1 - coupon.discount;
  }
  const payment = await stripe.charges.create({ amount: total * 100, customer: customer.stripe_id });
  await db.query('INSERT INTO orders (...) VALUES (...)');
  await emailService.send(customer.email, 'Order confirmed');
  res.json({ ok: true, total });
});
```

**Why wrong:** No unit test can exercise this logic without spinning up the whole stack. Every new requirement (taxes, inventory check, fraud scoring) wedges more branches in. Business rules and transport concerns (header parsing, status codes) are interleaved so tightly that neither can be reused.

**Fix:** Extract the domain logic into a function that takes plain inputs and returns plain outputs. The route handler becomes a thin shell:
```ts
app.post('/orders', async (req, res) => {
  const parsed = OrderInput.parse(req.body);              // validation
  const result = await orderService.place(parsed, req.userId);  // domain
  res.status(201).json(OrderResponse.serialize(result));  // transport
});
```
`orderService.place` takes `{items, customerId, couponCode}`, hits its dependencies (DB repo, payment gateway) through injected interfaces, and returns a domain object. It is unit-testable with in-memory fakes.

**Detection:** heuristic (route handlers over ~50 lines or containing DB/HTTP calls inline; language-specific AST scan feasible).

---

### circular-module-deps

**Smell:** Module A imports from module B, B imports from C, C imports from A. Or more subtly: A imports B for shared types, B imports A for shared types.

**Example (bad):**
```
// users/service.ts
import { Order } from '../orders/types';

// orders/service.ts
import { User } from '../users/types';
```
When `User` and `Order` reference each other at the type level, the two modules are coupled: you cannot load one without loading the other, cannot test one in isolation, and circular imports at runtime produce subtle initialization-order bugs (properties are `undefined` depending on which module was imported first).

**Why wrong:** The intent — "a user has orders, an order has a user" — is a graph relationship, not a code-level cyclic dependency. Modules depending on each other means each module knows the other's internals, defeating the purpose of having two modules.

**Fix:** Extract shared contracts into a third module that both import (a `domain/` or `types/` leaf module with no imports of its own). Or: one direction owns the relationship, the other reads it via ids only.
```
// domain/ids.ts    (leaf, imported by everyone)
type UserId = string & { __brand: 'user' };
type OrderId = string & { __brand: 'order' };

// orders/service.ts
import { UserId } from '../domain/ids';  // one-way
type Order = { id: OrderId; ownerId: UserId; ... };

// users/service.ts — does NOT import from orders
// If it needs the user's orders, it calls an OrdersRepo; it does not import Order.
```

**Detection:** deterministic candidate (static import graph analysis; most languages have linters for this — ESLint `import/no-cycle`, dependency-cruiser, Go `go vet`).

---

### data-access-from-controller

**Smell:** HTTP handlers, GraphQL resolvers, or CLI commands execute SQL or ORM calls directly, bypassing any domain layer.

**Example (bad):**
```ts
app.get('/users/:id/invoices', async (req, res) => {
  const rows = await db.query(
    `SELECT * FROM invoices WHERE user_id = $1 AND status != 'deleted'`,
    [req.params.id]
  );
  res.json(rows);
});
```

**Why wrong:** The business rule "deleted invoices are not visible to users" now lives in the route handler, next to a dozen other duplications of the same rule. When the deletion policy changes, you grep across every handler and hope.

**Fix:** Route handlers call repository/service methods; those methods encapsulate the data access and the domain filter. The route does not know what "not visible" means in SQL.
```ts
// invoices/repository.ts
async listForUser(userId: string): Promise<Invoice[]> {
  return db.query(
    `SELECT * FROM invoices WHERE user_id = $1 AND status != 'deleted'`,
    [userId]
  );
}

// routes
app.get('/users/:id/invoices', async (req, res) => {
  const invoices = await invoiceRepo.listForUser(req.params.id);
  res.json(invoices.map(InvoiceView.serialize));
});
```

**Detection:** deterministic candidate (SQL string literals, `.query`/`.exec`/ORM method calls inside files classified as route handlers / controllers).

---

### domain-logic-in-transport

**Smell:** HTTP-specific concerns (headers, cookies, status codes) infect the domain layer — a service function takes a `Request` object, or returns `{statusCode: 422, body: ...}`.

**Example (bad):**
```ts
async function placeOrder(req: Request): Promise<{ status: number; body: object }> {
  if (!req.headers['x-user-id']) return { status: 401, body: { error: 'unauth' } };
  // ...
  return { status: 201, body: order };
}
```

**Why wrong:** The service is now coupled to HTTP. You cannot call it from a queue worker, a background job, a CLI, or a test harness without faking request headers and interpreting status codes. Status codes are a transport-layer vocabulary; domain errors should be domain concepts.

**Fix:** Domain functions take domain inputs and raise domain errors (or return tagged result types). The transport layer maps domain errors to status codes.
```ts
async function placeOrder(input: OrderInput, userId: UserId): Promise<Order> {
  if (!userId) throw new UnauthenticatedError();
  // ... returns Order or throws InsufficientFundsError / OutOfStockError / ...
}

app.post('/orders', async (req, res) => {
  try {
    const order = await placeOrder(OrderInput.parse(req.body), req.userId);
    res.status(201).json(order);
  } catch (e) {
    if (e instanceof UnauthenticatedError) return res.status(401).json(...);
    if (e instanceof InsufficientFundsError) return res.status(422).json(...);
    throw e;
  }
});
```

**Detection:** heuristic (service-layer files importing request/response types from the web framework; needs human review).

---

### fat-shared-utils

**Smell:** A `utils.ts` / `helpers.ts` / `common.ts` / `lib/misc.ts` file that everyone imports from, containing a grab bag of unrelated helpers: date formatting, currency conversion, base64 encoding, string trimming, email validation, retry logic.

**Example (bad):**
```
src/
  utils.ts        ← 800 lines, 40 exported functions
  orders/...
  users/...
  billing/...
```

**Why wrong:** Everything imports utils; utils imports nothing. So every module is coupled to the whole grab bag. Tree-shaking becomes harder, test isolation is worse, and "where does this helper live" is answered "probably utils." Over time utils becomes the landfill for logic that doesn't have an obvious home, and nothing ever leaves.

**Fix:** Organize helpers by domain, not by "util-ness." Date helpers live with temporal-domain code, currency helpers with money, email validation with user/contact. Reserve a truly-generic `std/` or `shared/` for primitives with no domain (a `Result<T,E>` type, a type-brand utility) — and keep that directory small enough that it never grows past a page.
```
src/
  money/            ← currency.ts, conversion.ts
  temporal/         ← format.ts, parse.ts
  contacts/         ← email-validation.ts
  std/              ← result.ts, branded.ts  (≤200 LOC total)
  orders/...
```

**Detection:** heuristic (file or directory named `utils`/`helpers`/`common`/`misc`/`shared` containing imports from multiple unrelated domains).

---

### feature-envy

**Smell:** A method on class A spends most of its body calling getters on class B and operating on B's data. The logic belongs on B, but lives on A out of habit or because A was written first.

**Example (bad):**
```ts
class OrderService {
  calculateTotal(order: Order): number {
    let sum = 0;
    for (const line of order.lines) {
      sum += line.unitPrice * line.quantity * (1 - line.discount);
    }
    return sum + order.tax - order.creditApplied;
  }
}
```
`OrderService.calculateTotal` does not use any state of `OrderService`. It only reads `order`. Every other service has to go through `orderService` to get the total, even though `order` has the data.

**Why wrong:** The behavior is separated from the data. Any change to how totals are computed requires updates in the service; any change to `Order`'s fields requires awareness of all service methods that read them. Cohesion is low; coupling is high.

**Fix:** Move the method to the class that owns the data. Services then orchestrate, not compute:
```ts
class Order {
  total(): number {
    return this.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity * (1 - l.discount), 0)
         + this.tax - this.creditApplied;
  }
}

class OrderService {
  async place(input: OrderInput) {
    const order = Order.from(input);
    await this.repo.save(order);
    await this.payments.charge(order.total());
  }
}
```
(In strictly functional styles, the same principle applies: the function that operates on `Order` lives in the `order` module, not the `service` module.)

**Detection:** heuristic (method bodies where the majority of property accesses are on a parameter, not on `this` or module-local state; hard to detect deterministically without whole-program analysis).

## Principles

1. **Depend on stable things.** Modules pointing "inward" (transport → domain → data) produce fewer change-induced ripples than modules pointing outward or sideways. The inner layers should not know about the outer.

2. **Each module states its dependencies explicitly.** Not via globals, not via module-load side effects. Dependency injection is not framework ceremony — it's the acknowledgement that a testable module has knowable inputs.

3. **Cohesion over layering.** Better to group files by feature (`/orders/*`) than by architectural role (`/controllers/*`, `/services/*`, `/repositories/*`) when the feature is the unit of change. Layers inside a feature are fine; layers spread across the repo create navigation friction.

4. **Build leaf modules.** Every codebase has modules with many imports and modules with few. The leaves — low-level primitives, types, id brands, error classes — should have zero project-internal imports and should be imported freely. The trunk — route wiring, app entry — imports from everyone but is imported by nothing.

5. **Public APIs of modules are narrower than their internals.** A module exports a small set of functions/types; the rest is private. Barrel exports (`index.ts` re-exports) are a curation step, not a full directory dump.

6. **Replaceability is a smell test for boundaries.** If you can plausibly replace a module with a different implementation (a different DB driver, a different payment provider) by changing only one import, the boundary is healthy. If replacement requires editing 40 files, the boundary leaked.

## Rubric

- [ ] No route handler / controller / resolver exceeds ~50 lines or calls the database/third-party APIs directly.
- [ ] Static import graph has no cycles (enforced by linter).
- [ ] Domain functions do not import web-framework request/response types.
- [ ] Transport-layer concerns (status codes, headers) are mapped in a single place per entry point.
- [ ] No `utils`/`helpers`/`misc` grab-bag module over ~200 lines; helpers live with the domain they serve.
- [ ] Methods operate primarily on their own object's state (no obvious feature envy).
- [ ] Every module's dependencies are explicit (constructor args, function parameters) — not globals or import side effects.
- [ ] Features that change together live in the same directory.
- [ ] A plausible "swap X for Y" (different DB, different HTTP library) would touch a bounded number of files.

## References

- Robert C. Martin, *Clean Architecture*, Prentice Hall, 2017. Dependency rule, screaming architecture.
- Eric Evans, *Domain-Driven Design: Tackling Complexity in the Heart of Software*, Addison-Wesley, 2003. Bounded contexts, ubiquitous language, aggregate boundaries.
- Vaughn Vernon, *Implementing Domain-Driven Design*, Addison-Wesley, 2013. Practical application of DDD to modular backends.
- Martin Fowler, *Patterns of Enterprise Application Architecture*, Addison-Wesley, 2002. Service Layer, Repository, Data Mapper.
- *Dependency cruiser* — https://github.com/sverweij/dependency-cruiser. Reference for cycle/boundary linting on JS/TS.
- John Ousterhout, *A Philosophy of Software Design*, 2nd ed., Yaknyam Press, 2021. Deep modules, information hiding, module complexity.

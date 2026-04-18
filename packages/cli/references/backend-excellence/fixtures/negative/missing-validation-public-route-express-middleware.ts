// Negative fixture (framework: Express, middleware chain) —
// missing-validation-public-route MUST NOT fire.
// Named middleware + middleware-factory call both count as validation evidence.

declare const app: {
  get(path: string, ...handlers: Array<(req: unknown, res: unknown) => unknown>): void;
  post(path: string, ...handlers: Array<(req: unknown, res: unknown) => unknown>): void;
};
declare const db: { insert(t: string, r: unknown): Promise<void>; list(t: string): Promise<unknown[]> };
declare const validateBody: (req: unknown, res: unknown, next: () => void) => void;
declare const validate: (schema: unknown) => (req: unknown, res: unknown, next: () => void) => void;
declare const userCreateSchema: unknown;

interface TypedReq { body: Record<string, unknown> }
interface TypedRes { status(n: number): TypedRes; end(): void }

app.post('/users', validateBody, async (req: TypedReq, res: TypedRes) => {
  await db.insert('users', req.body);
  res.status(201).end();
});

app.post('/orders', validate(userCreateSchema), async (req: TypedReq, res: TypedRes) => {
  await db.insert('orders', req.body);
  res.status(201).end();
});

// Positive fixture (framework: Express) — missing-validation-public-route MUST fire.
// Public route (no /auth prefix), inline arrow handler, no middleware, no validator call.

declare const app: {
  get(path: string, handler: (req: unknown, res: unknown) => unknown): void;
  post(path: string, handler: (req: unknown, res: unknown) => unknown): void;
};
declare const db: { insert(t: string, r: unknown): Promise<void>; list(t: string): Promise<unknown[]> };

app.post('/users', async (req: any, res: any) => {
  await db.insert('users', req.body);
  res.status(201).end();
});

app.get('/orders', async (_req: unknown, res: any) => {
  const rows = await db.list('orders');
  res.json(rows);
});

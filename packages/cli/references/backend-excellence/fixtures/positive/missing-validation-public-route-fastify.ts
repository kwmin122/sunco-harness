// Positive fixture (framework: Fastify) — missing-validation-public-route MUST fire.
// Public route, no schema option, no preValidation, inline handler with no validator call.

declare const server: {
  get(path: string, handler: (req: unknown, rep: unknown) => unknown): void;
  post(path: string, handler: (req: unknown, rep: unknown) => unknown): void;
};
declare const db: { insert(t: string, r: unknown): Promise<void> };

server.post('/widgets', async (req: any, _rep: unknown) => {
  await db.insert('widgets', req.body);
  return { ok: true };
});

server.get('/widgets/stats', async (_req: unknown, _rep: unknown) => {
  return { count: 42 };
});

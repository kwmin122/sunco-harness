// Negative fixture (framework: Fastify, schema option) —
// missing-validation-public-route MUST NOT fire.
// Fastify's { schema } option declaratively validates body/query/params.

declare const server: {
  post(
    path: string,
    opts: Record<string, unknown>,
    handler: (req: unknown, rep: unknown) => unknown
  ): void;
  get(
    path: string,
    opts: Record<string, unknown>,
    handler: (req: unknown, rep: unknown) => unknown
  ): void;
};
declare const db: { insert(t: string, r: unknown): Promise<void> };

server.post(
  '/widgets',
  {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' } },
      },
    },
  },
  async (req: { body: unknown }, _rep: unknown) => {
    await db.insert('widgets', req.body);
    return { ok: true };
  }
);

server.get(
  '/widgets/stats',
  {
    preValidation: async (_req: unknown, _rep: unknown) => { /* validate quota */ },
  },
  async (_req: unknown, _rep: unknown) => ({ count: 42 })
);

// Phase 51 fixture — missing-validation-public-route NEGATIVE case.
// Public express route validates req.body through schema.parse() before use.

type Req = { body: unknown };
type Res = { json: (data: unknown) => void };
type App = {
  post: (path: string, handler: (req: Req, res: Res) => void) => void;
};

const UserSchema = {
  parse: (raw: unknown): { name: string; email: string } => {
    if (typeof raw !== 'object' || raw === null) throw new Error('invalid');
    const r = raw as Record<string, unknown>;
    return { name: String(r.name), email: String(r.email) };
  },
};

export function registerRoutes(app: App) {
  app.post('/api/users', (req, res) => {
    const user = UserSchema.parse(req.body);
    res.json({ ok: true, name: user.name });
  });
}

// Phase 51 fixture — missing-validation-public-route POSITIVE case.
// Public express route reads req.body without calling any validation function.

type Req = { body: unknown };
type Res = { json: (data: unknown) => void };
type App = {
  post: (path: string, handler: (req: Req, res: Res) => void) => void;
  get: (path: string, handler: (req: Req, res: Res) => void) => void;
};

export function registerRoutes(app: App) {
  app.post('/api/users', (req, res) => {
    const payload = req.body;
    res.json({ received: payload });
  });

  app.post('/api/login', (req, res) => {
    const creds = req.body;
    res.json({ creds });
  });
}

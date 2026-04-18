// Positive fixture — any-typed-body MUST fire.
// Handler declares `req: any` and never validates before use = trust-the-wire smell.

declare const db: { insert(table: string, row: Record<string, unknown>): Promise<void> };

export async function createUser(req: any, res: any) {
  // Direct consumption of untyped request body.
  await db.insert('users', { email: req.body.email, role: req.body.role });
  res.status(201).json({ ok: true });
}

export const updateProfile = async (req: any, res: any) => {
  await db.insert('profiles', req.body);
  res.json({ ok: true });
};

// Negative fixture — any-typed-body MUST NOT fire.
// Even with req: any, a schema.parse() inside the body is sufficient validation evidence.

declare const db: { insert(table: string, row: Record<string, unknown>): Promise<void> };
declare const CreateUserSchema: { parse(x: unknown): { email: string; role: string } };
declare const UpdateProfileSchema: { safeParse(x: unknown): { success: boolean; data?: unknown } };

export async function createUser(req: any, res: any) {
  const body = CreateUserSchema.parse(req.body);
  await db.insert('users', { email: body.email, role: body.role });
  res.status(201).json({ ok: true });
}

export const updateProfile = async (req: any, res: any) => {
  const parsed = UpdateProfileSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).end(); return; }
  await db.insert('profiles', parsed.data as Record<string, unknown>);
  res.json({ ok: true });
};

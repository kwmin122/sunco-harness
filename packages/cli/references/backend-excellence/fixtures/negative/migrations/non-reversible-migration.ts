// Negative fixture — non-reversible-migration MUST NOT fire.
// File lives under `migrations/`, exports both `up` and `down`.

declare const sql: { raw(q: string): Promise<void> };

export async function up(): Promise<void> {
  await sql.raw(`ALTER TABLE users ADD COLUMN tier TEXT NOT NULL DEFAULT 'free'`);
}

export async function down(): Promise<void> {
  await sql.raw(`ALTER TABLE users DROP COLUMN tier`);
}

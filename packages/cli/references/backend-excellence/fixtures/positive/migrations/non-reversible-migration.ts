// Positive fixture — non-reversible-migration MUST fire.
// File lives under a `migrations/` directory, declares `up` only, no `down`, no
// reversibility comment marker, no expand-contract annotation.

declare const sql: { raw(q: string): Promise<void> };

export async function up(): Promise<void> {
  await sql.raw(`ALTER TABLE users ADD COLUMN tier TEXT NOT NULL DEFAULT 'free'`);
  await sql.raw(`DROP INDEX IF EXISTS users_email_idx_old`);
}

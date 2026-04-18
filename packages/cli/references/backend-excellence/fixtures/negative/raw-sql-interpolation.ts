// Negative fixture — raw-sql-interpolation MUST NOT fire.
// Parameterized query + query-builder path = no interpolation into raw SQL.

declare const db: {
  query(sql: string, params: unknown[]): Promise<unknown[]>;
};
declare const qb: {
  from(table: string): {
    where(col: string, val: unknown): { first(): Promise<unknown> };
  };
};

export async function findUserById(userId: string) {
  // Parameterized — placeholder + separate args array.
  return db.query('SELECT * FROM users WHERE id = $1', [userId]);
}

export async function findUserByEmail(email: string) {
  // Query builder — no raw SQL string at all.
  return qb.from('users').where('email', email).first();
}

export function staticSqlNoInterpolation() {
  // Template literal with SQL but zero expressions — not an interpolation hazard.
  return `SELECT COUNT(*) FROM users`;
}

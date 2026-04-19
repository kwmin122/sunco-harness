// Phase 51 fixture — raw-sql-interpolation NEGATIVE case.
// Parameterized query via placeholders — no template interpolation into SQL.

export async function getUserById(userId: string, db: { query: (sql: string, params: unknown[]) => Promise<unknown> }) {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  return result;
}

export async function searchPosts(keyword: string, db: { query: (sql: string, params: unknown[]) => Promise<unknown> }) {
  return db.query('SELECT * FROM posts WHERE title LIKE $1', [`%${keyword}%`]);
}

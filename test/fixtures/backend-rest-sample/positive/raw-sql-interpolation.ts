// Phase 51 fixture — raw-sql-interpolation POSITIVE case.
// Canonical smell: template literal concatenating user input into SQL.

export async function getUserById(userId: string, db: { query: (sql: string) => Promise<unknown> }) {
  const result = await db.query(`SELECT * FROM users WHERE id = ${userId}`);
  return result;
}

export async function searchPosts(keyword: string, db: { query: (sql: string) => Promise<unknown> }) {
  return db.query(`SELECT * FROM posts WHERE title LIKE '%${keyword}%'`);
}

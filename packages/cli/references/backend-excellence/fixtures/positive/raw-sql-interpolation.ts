// Positive fixture — raw-sql-interpolation MUST fire.
// Template literal with SQL keyword + interpolation = classic injection shape.

declare const db: { query(sql: string): Promise<unknown[]> };

export async function findUserById(userId: string) {
  return db.query(`SELECT * FROM users WHERE id = ${userId}`);
}

export async function listRecentOrders(customerId: number, since: string) {
  const rows = await db.query(
    `SELECT o.id, o.total
     FROM orders o
     WHERE o.customer_id = ${customerId} AND o.created_at > '${since}'`
  );
  return rows;
}

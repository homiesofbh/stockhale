import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, type PoolClient } from "pg";
import { attachDatabasePool } from "@vercel/functions";

const transactions = new AsyncLocalStorage<PoolClient>();
let pool: Pool | undefined;

export function db() {
  if (!pool) {
    if (!process.env.DATABASE_URL)
      throw Object.assign(
        new Error(
          "Database is not configured. Set DATABASE_URL and run pnpm db:migrate.",
        ),
        { status: 503 },
      );
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 15_000,
      allowExitOnIdle: true,
    });
    pool.on("error", () =>
      console.error("An idle database connection failed."),
    );
    if (process.env.VERCEL) attachDatabasePool(pool);
  }
  return pool;
}

export async function query(sql: string, args: unknown[] = []) {
  return (transactions.getStore() || db()).query(sql, args);
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const result = await transactions.run(client, () => fn(client));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  await pool?.end();
  pool = undefined;
}

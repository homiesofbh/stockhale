import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, type PoolClient } from "pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const transactions = new AsyncLocalStorage<PoolClient>();
const scope = new AsyncLocalStorage<{ pool: Pool }>();

function connectionString(): string | undefined {
  try {
    const env = getCloudflareContext().env as unknown as {
      HYPERDRIVE?: { connectionString: string };
    };
    if (env.HYPERDRIVE) return env.HYPERDRIVE.connectionString;
  } catch {
    // not running under the Cloudflare runtime (local dev)
  }
  return process.env.DATABASE_URL;
}

export function defer(p: Promise<unknown>) {
  try {
    getCloudflareContext().ctx.waitUntil(p);
  } catch {
    // local dev: the promise just runs unattended
  }
}

export async function withDatabase<T>(fn: () => Promise<T>): Promise<T> {
  const cs = connectionString();
  if (!cs)
    throw Object.assign(new Error("Database is not configured."), { status: 503 });
  const pool = new Pool({ connectionString: cs, max: 2, connectionTimeoutMillis: 8000 });
  pool.on("error", () => console.error("A database connection failed."));
  try {
    return await scope.run({ pool }, fn);
  } finally {
    defer(pool.end().catch(() => {}));
  }
}

export function db() {
  const s = scope.getStore();
  if (!s) throw new Error("db() called outside withDatabase().");
  return s.pool;
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
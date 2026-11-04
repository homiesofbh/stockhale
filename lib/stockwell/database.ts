import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, type PoolClient } from "pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const transactions = new AsyncLocalStorage<PoolClient>();
const scope = new AsyncLocalStorage<{ pool: Pool }>();

let standalone: Pool | undefined;

function inWorker() {
  try {
    getCloudflareContext();
    return true;
  } catch {
    return false;
  }
}


function connectionString(): string | undefined {
  try {
    const env = getCloudflareContext().env as unknown as {
      HYPERDRIVE?: { connectionString: string };
    };
    if (env.HYPERDRIVE?.connectionString) {
      // Wrangler's local Hyperdrive shim may expose the placeholder from
      // wrangler.jsonc (HOST). In Next dev, use the real local .env URL;
      // deployed Workers still use the bound Hyperdrive connection.
      try {
        const host = new URL(env.HYPERDRIVE.connectionString).hostname.toLowerCase();
        if (!['host', 'user', 'password', 'dbname'].includes(host)) return env.HYPERDRIVE.connectionString;
      } catch {
        // Fall through to DATABASE_URL when the local binding is a template.
      }
    }
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
    throw Object.assign(new Error("Database is not configured. Set DATABASE_URL."), { status: 503 });
  const pool = new Pool({ connectionString: cs, max: 2, connectionTimeoutMillis: 8000 });
  pool.on("error", (err: any) => {
    if (err?.message?.includes("socket has been closed")) return;
    console.error("DB pool error:", err?.code, err?.message);
  });
  try {
    return await scope.run({ pool }, fn);
  } catch (err: any) {
    console.error("withDatabase error:", err?.code, err?.message, err?.cause?.message);
    throw err;
  } finally {
    defer(pool.end().catch(() => { }));
  }
}

export function db(): Pool {
  const s = scope.getStore();
  if (s) return s.pool;
  // Scripts, tests and local tooling only. Never reuse a global pool on Workers.
  if (inWorker())
    throw new Error("db() called outside withDatabase().");
  if (!standalone) {
    const cs = process.env.DATABASE_URL;
    if (!cs)
      throw Object.assign(
        new Error("Database is not configured. Set DATABASE_URL and run pnpm db:migrate."),
        { status: 503 },
      );
    standalone = new Pool({
      connectionString: cs,
      max: 5,
      idleTimeoutMillis: 10_000,
      allowExitOnIdle: true,
    });
    standalone.on("error", () => console.error("An idle database connection failed."));
  }
  return standalone;
}

export async function closeDatabase() {
  await standalone?.end();
  standalone = undefined;
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
    await client.query("ROLLBACK").catch(() => { });
    throw error;
  } finally {
    client.release();
  }
}

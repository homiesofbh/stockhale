import { configureMigrationConnection } from "./env";
import { readFile } from "node:fs/promises";
import { getMigrations } from "better-auth/db/migration";
import { getAuth } from "../lib/stockwell/auth";
import { closeDatabase, transaction } from "../lib/stockwell/database";

export async function migrate() {
  await transaction(async (client) => {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('stockwell:migrations'))",
    );
    const { runMigrations } = await getMigrations(getAuth(client).options);
    await runMigrations();
    await client.query(
      `CREATE TABLE IF NOT EXISTS stockwell_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    );
    for (const name of ["001-workspace.sql"]) {
      const applied = await client.query(
        "SELECT id FROM stockwell_migrations WHERE id=$1",
        [name],
      );
      if (applied.rowCount) continue;
      await client.query(
        await readFile(
          new URL(`../migrations/${name}`, import.meta.url),
          "utf8",
        ),
      );
      await client.query("INSERT INTO stockwell_migrations(id) VALUES($1)", [
        name,
      ]);
    }
  });
}

if (process.argv[1]?.endsWith("scripts/migrate.ts")) {
  configureMigrationConnection();
  migrate()
    .then(() => console.log("Database migrations applied."))
    .catch(() => {
      console.error(
        "Migration failed. Check DATABASE_URL, authentication configuration and database permissions.",
      );
      process.exitCode = 1;
    })
    .finally(closeDatabase);
}

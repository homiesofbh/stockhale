import { configureMigrationConnection } from "./env";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { closeDatabase, query, transaction } from "../lib/stockwell/database";
import { migrate } from "./migrate";

// Import only into distinct IDs/emails. Any collision rolls the whole import back.
// Legacy sessions are deliberately invalidated; users sign in with their password.
export async function importSqlite(file: string) {
  const source = new DatabaseSync(file, { readOnly: true });
  try {
    await transaction(async () => {
      for (const user of source.prepare("SELECT * FROM users").all()) {
        await query(
          `INSERT INTO users(id,email,name,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,false,NOW(),NOW())`,
          [user.id, user.email, user.name],
        );
        if (
          typeof user.password !== "string" ||
          !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(user.password)
        )
          throw new Error("Unsupported legacy password hash.");
        await query(
          `INSERT INTO auth_accounts(id,"userId","accountId","providerId",password,"createdAt","updatedAt") VALUES($1,$2,$2,'credential',$3,NOW(),NOW())`,
          [randomUUID(), user.id, `stockwell-legacy:${user.password}`],
        );
      }
      const tables: Record<string, string[]> = {
        workspaces: ["id", "name", "image", "owner", "revision", "store"],
        members: ["workspace", "user", "modules"],
        invites: ["token", "workspace", "email", "modules", "expires"],
        events: [
          "id",
          "workspace",
          "actor",
          "module",
          "action",
          "records",
          "occurredAt",
          "receivedAt",
          "emailStatus",
          "attempts",
          "nextAttempt",
        ],
        reads: ["workspace", "user", "event"],
      };
      for (const [table, columns] of Object.entries(tables)) {
        const names = columns.map((name) => `"${name}"`).join(",");
        const parameters = columns.map((_, i) => `$${i + 1}`).join(",");
        for (const row of source
          .prepare(`SELECT ${names} FROM "${table}"`)
          .all())
          await query(
            `INSERT INTO "${table}"(${names}) VALUES(${parameters})`,
            columns.map((name) => row[name]),
          );
      }
    });
  } finally {
    source.close();
  }
}

if (process.argv[1]?.endsWith("scripts/import-sqlite.ts")) {
  configureMigrationConnection();
  const file = process.argv[2];
  if (!file) {
    console.error(
      "Usage: pnpm db:import-sqlite /absolute/path/to/workspace.sqlite",
    );
    process.exitCode = 1;
  } else {
    migrate()
      .then(() => importSqlite(file))
      .then(() =>
        console.log(
          "SQLite workspace imported. Existing users can sign in again.",
        ),
      )
      .catch(() => {
        console.error(
          "Import failed and was rolled back. Check the SQLite schema, destination configuration, and conflicting IDs or emails.",
        );
        process.exitCode = 1;
      })
      .finally(closeDatabase);
  }
}

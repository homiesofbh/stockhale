import { existsSync } from "node:fs";

// Shell/deployment values take precedence over local files.
for (const file of [".env.local", ".env"])
  if (existsSync(file)) process.loadEnvFile(file);

// Migration credentials may use a direct connection instead of the runtime pooler.
export function configureMigrationConnection() {
  const directURL = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL_UNPOOLED;
  if (directURL) process.env.DATABASE_URL = directURL;
}

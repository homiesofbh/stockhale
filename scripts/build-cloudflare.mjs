import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  || config.match(/"NEXT_PUBLIC_SITE_URL"\s*:\s*"([^"]+)"/)?.[1];

if (!siteUrl) {
  throw new Error("Set NEXT_PUBLIC_SITE_URL in the build environment or wrangler.jsonc.");
}

const result = spawnSync("pnpm", ["exec", "opennextjs-cloudflare", "build"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_SITE_URL: siteUrl },
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);

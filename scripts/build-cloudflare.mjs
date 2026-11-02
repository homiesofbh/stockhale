import { readFileSync, writeFileSync } from "node:fs";
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
if (result.status !== 0) process.exit(result.status ?? 1);

// OpenNext generates the actual fetch worker during its build. Wrap that worker
// afterward to add Cloudflare's scheduled event without changing its routing.
writeFileSync(new URL("../.open-next/worker-entry.mjs", import.meta.url), `
import app from "./worker.js";

export default {
  fetch: app.fetch,
  scheduled(_event, _env, ctx) {
    if (!_env.EMAIL_DRAIN_SECRET) {
      console.error("EMAIL_DRAIN_SECRET is not configured; scheduled email drain skipped.");
      return;
    }
    const url = new URL("/api/internal/email-drain", "https://internal.invalid");
    ctx.waitUntil(app.fetch(new Request(url, {
      method: "POST",
      headers: { authorization: "Bearer " + _env.EMAIL_DRAIN_SECRET },
    }), _env, ctx));
  },
};
`);

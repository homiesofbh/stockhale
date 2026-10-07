# Stockwell - Product Management System

An inventory management system with offline workspaces, Neon-compatible PostgreSQL storage, and Better Auth email/password sessions. The Vercel application does not write database files to its local filesystem.

## Local setup

Requires Node 24+ and PostgreSQL (Neon or a local database).

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local`. Set `DATABASE_URL`, `BETTER_AUTH_SECRET` (at least 32 characters), and `BETTER_AUTH_URL`.
3. Run `pnpm db:migrate` to create Better Auth and workspace tables.
4. Run `pnpm dev`, then create an account at `/sign-up`.

No demo account is seeded. Sign-in requires an account created in the configured database.

## Deploy on Vercel with Neon

1. Create a Neon project, starting on its Free plan. Choose a database region close to the Vercel function region. Leave scale-to-zero enabled.
2. Copy Neon's **pooled** connection string (the hostname contains `-pooler`) to the Vercel `DATABASE_URL` environment variable. Keep the SSL parameters supplied by Neon.
3. Set a random `BETTER_AUTH_SECRET`, and set `BETTER_AUTH_URL=https://stockwell-six.vercel.app` for this production deployment. Keep the secret stable across releases; changing it invalidates sessions.
4. Configure the same values in a trusted local environment, then run `pnpm db:migrate` against the intended database. Optionally use `DATABASE_MIGRATION_URL` for Neon's direct connection. Migrations run explicitly, never during a build or on sign-in.
5. Deploy/redeploy on Vercel and create your account. New instances and deployments now share persistent data and sessions.

Production and Preview deployments should use separate Neon branches and their own exact `BETTER_AUTH_URL`. Do not point unreviewed preview deployments at production data. Never use `NEXT_PUBLIC_` for the database URL or auth secret.

Better Auth runs inside `/api/workspace` through its server APIs. This keeps existing forms, invitation validation, and offline caches compatible; no public alternative signup endpoint bypasses workspace provisioning. Account, password credential, session, and workspace/membership creation commit together.

## Linked Neon project

This directory is linked to `bitter-voice-14099151`, branch `production`. [neon.ts](neon.ts) declares the private `invoices` bucket using the requested `preview.buckets` syntax. The CLI currently accepts this syntax and recommends the top-level `buckets` key for new configurations.

Run `neon deploy` to apply the backend policy and refresh Neon variables in `.env.local`. The `.neon` context and `.env.local` are ignored by Git. Local Better Auth configuration is also in `.env.local`; use the production website origin when configuring Vercel. Neon deployment does not publish the frontend or update Vercel environment variables.

## Existing SQLite data

If you already have accounts or records in `.stockwell/workspace.sqlite`, stop writes to the old deployment and back up the database (including any WAL state) first. With the destination configured, run:

```sh
pnpm db:import-sqlite /absolute/path/to/workspace.sqlite
```

The source is opened read-only. The import preserves user/workspace IDs, legacy passwords, records, permissions, invitations, audit history, read markers, and the email outbox. Old sessions are invalidated; users sign in again. ID/email conflicts abort and roll back the entire import instead of overwriting destination records. Do not run old and new deployments as simultaneous writers. If your only data is in a browser cache, use the existing Settings import for an empty workspace.

## Costs and operation

- Better Auth runs in the app; it adds no hosted authentication subscription.
- Neon can start on its Free plan. Current allowances and paid usage rates are on [Neon's pricing page](https://neon.com/pricing). Vercel hosting and optional Resend email are billed separately under the applicable plans.
- The app uses a small reusable connection pool, Neon's external pooler, and Vercel's pool suspension helper. Background tabs stop polling, allowing idle databases to suspend. Visible workspaces poll every 15 seconds; active usage still consumes compute.
- Inventory updates lock the workspace row and check revisions inside a transaction. Concurrent stale writes return a conflict rather than silently overwriting records.
- Email retries remain durable in Postgres. On Vercel they drain during authenticated API activity or the Settings retry action. An idle deployment does not run the old perpetual 30-second timer. For delivery while every client is closed, add a scheduled worker appropriate to your delivery requirements; frequent schedules prevent scale-to-zero.

See [workspace operation](docs/WORKSPACE.md) for offline queues and permissions.

## Verification

```sh
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

The integration suite requires a local PostgreSQL role that can create databases. It defaults to `postgresql://localhost/postgres`, creates a uniquely named test database, and removes it afterward. Set `STOCKWELL_TEST_DATABASE_URL` to a dedicated test admin connection when needed. It never reuses application tables. Unit tests need no database. `npm run <script>` can also run these scripts.
 

# StockHale - Product Management System

An inventory management system with offline workspaces, Neon-compatible PostgreSQL storage, and Better Auth email/password sessions. The Vercel application does not write database files to its local filesystem.

Production domain: **https://stockhale.app**. See the [external hosting and Better Auth checklist](docs/PRODUCTION-DOMAIN.md) before switching traffic.

## Local setup

Requires Node 24+ and PostgreSQL (Neon or a local database).

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local`. Set `DATABASE_URL`, `BETTER_AUTH_SECRET` (at least 32 characters), `BETTER_AUTH_URL`, and `NEXT_PUBLIC_SITE_URL` to the exact public origin for this environment.
   Set `DISABLE_PUBLIC_SIGNUP=true` to hide and reject public workspace signup while keeping invited team member signup available.
3. Run `pnpm db:migrate` to create Better Auth and workspace tables.
4. Run `pnpm dev`, then create an account at `/sign-up`.

No demo account is seeded. Sign-in requires an account created in the configured database.

## Deploy on Vercel with Neon and Better Auth

1. Create a Neon project, starting on its Free plan. Choose a database region close to the Vercel function region. Leave scale-to-zero enabled.
2. Copy Neon's **pooled** connection string (the hostname contains `-pooler`) to the Vercel `DATABASE_URL` environment variable. Keep the SSL parameters supplied by Neon.
3. Set a random `BETTER_AUTH_SECRET`, and set `BETTER_AUTH_URL=https://stockhale.app` for this production deployment. Keep the secret stable across releases; changing it invalidates sessions.
   Set `STOCKHALE_TRUSTED_CLIENT_IP_HEADER` to the trusted client-IP header
   configured for your Vercel deployment. Sign-in and reset requests fail closed
   in production when this trusted client address is unavailable.
4. Configure the same values in a trusted local environment, then run `pnpm db:migrate` against the intended database. Optionally use `DATABASE_MIGRATION_URL` for Neon's direct connection. Migrations run explicitly, never during a build or on sign-in.
5. Import this repository into Vercel with the default Next.js build settings
   (`pnpm install` and `pnpm run build`), then create your account. New instances
   and deployments share persistent data and sessions.

Production and Preview deployments should use separate Neon branches and their own exact `BETTER_AUTH_URL`. Do not point unreviewed preview deployments at production data. Never use `NEXT_PUBLIC_` for the database URL or auth secret.

Better Auth runs inside `/api/workspace` through its server APIs. This keeps existing forms, invitation validation, and offline caches compatible; no public alternative signup endpoint bypasses workspace provisioning. Account, password credential, session, and workspace/membership creation commit together.

## Linked Neon project

This directory is linked to `lucky-butterfly-25452958` (Stockhale), branch `production`. [neon.ts](neon.ts) declares the private `invoices` bucket using the requested `preview.buckets` syntax.

Run `neon deploy` to apply the backend policy and refresh Neon variables in `.env`. The `.neon` context and `.env` are ignored by Git. Local Better Auth configuration is also in `.env`; use `https://stockhale.app` for the production website origin. Neon deployment does not publish the frontend or update hosting environment variables.

## Existing SQLite data

If you already have accounts or records in `.stockwell/workspace.sqlite`, stop writes to the old deployment and back up the database (including any WAL state) first. With the destination configured, run:

```sh
pnpm db:import-sqlite /absolute/path/to/workspace.sqlite
```

The source is opened read-only. The import preserves user/workspace IDs, legacy passwords, records, permissions, invitations, audit history, read markers, and the email outbox. Old sessions are invalidated; users sign in again. ID/email conflicts abort and roll back the entire import instead of overwriting destination records. Do not run old and new deployments as simultaneous writers. If your only data is in a browser cache, use the existing Settings import for an empty workspace.

## Costs and operation

- Better Auth runs in the app; it adds no hosted authentication subscription.
- Neon can start on its Free plan. Current allowances and paid usage rates are on [Neon's pricing page](https://neon.com/pricing). Vercel hosting and optional Resend email are billed separately under the applicable plans.
- The app uses a small reusable connection pool, Neon's external pooler, and Vercel's pool suspension helper. Background tabs stop polling, allowing idle databases to suspend. Visible workspaces poll every 5 minutes; active usage still consumes compute.
- Inventory updates lock the workspace row and check revisions inside a transaction. Concurrent stale writes return a conflict rather than silently overwriting records.
- Email retries remain durable in Postgres. API activity and the Settings retry
  action drain due work. Configure a Vercel scheduled invocation of the protected
  email drain route if unattended scheduled delivery is required.

See [workspace operation](docs/WORKSPACE.md) for offline queues and permissions.

## Verification

```sh
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```


The integration suite requires a local PostgreSQL role that can create databases. It defaults to `postgresql://localhost/postgres`, creates a uniquely named test database, and removes it afterward. Set `STOCKWELL_TEST_DATABASE_URL` to a dedicated test admin connection when needed. It never reuses application tables. Unit tests need no database. `npm run <script>` can also run these scripts.

### Excel exports and weekly local backups

Workspace owners can download all data from **Settings → Excel export & weekly backup**.
The `.xlsx` workbook includes every store collection, separate invoice/purchase line sheets,
team details, audit history, pending device changes, and a lossless JSON cache snapshot split
into ordered parts on the **Backup snapshot** sheet. Long values in the readable sheets are
abbreviated to fit Excel's cell limit; the snapshot retains the full value.

A first backup is prompted immediately. After a download is requested, the next reminder
is due seven days later. Postponing or closing the prompt delays it for one hour. Reminder
dates are saved per workspace and owner in this browser, checked while the app is open and
when it regains focus. The browser controls the final save location and may ask permission;
the app cannot verify a completed save or run downloads when closed. If a download is
cancelled or blocked, retry from Settings. These workbooks are downloadable copies; there
is currently no Excel restore/import flow.

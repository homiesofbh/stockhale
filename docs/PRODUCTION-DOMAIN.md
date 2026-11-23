# Production domain: stockhale.app

The canonical production origin is `https://stockhale.app`. Repository configuration
is prepared for this origin; no deployment or external settings were changed.

## Deploy on Vercel

- Import this repository into Vercel. The default Next.js build settings are
  sufficient (`pnpm install`, `pnpm run build`); no adapter or custom deploy
  command is required.
- Add `stockhale.app` to the project's **Settings → Domains** and apply the
  exact DNS records Vercel displays. Ensure HTTPS is active.
- Set Production environment variables `NEXT_PUBLIC_SITE_URL` and
  `BETTER_AUTH_URL` to `https://stockhale.app`, plus `DATABASE_URL` and a stable
  random `BETTER_AUTH_SECRET` (at least 32 characters). Set
  `STOCKHALE_TRUSTED_CLIENT_IP_HEADER` to a single-IP header that Vercel
  provides and overwrites. Sign-in and reset requests fail closed when this
  trusted client address is unavailable.
- Run `pnpm db:migrate` against the intended Neon database from a trusted local
  environment. Migrations do not run during builds.
- Keep preview origins and database branches separate from production. Configure
  `BETTER_AUTH_URL` for each exact deployment origin and exclude untrusted
  previews from production data.

## Better Auth settings

This app uses **self-hosted Better Auth**, not managed Neon Auth. There is no
separate Better Auth dashboard origin allowlist to update.

- `baseURL` reads `BETTER_AUTH_URL` (with legacy `STOCKWELL_ORIGIN` fallback).
  Set the former to `https://stockhale.app`; remove or update any stale fallback
  in hosting configuration.
- `trustedOrigins` is derived from that URL and becomes exactly
  `["https://stockhale.app"]`. No wildcard or preview origin is needed.
- No OAuth provider is configured, so no provider callback URL needs updating.
- Keep the cookie prefix and database tables unchanged. Existing cookies,
  localStorage, offline queues and backup reminder dates belong to the old
  browser origin and do not transfer automatically. Sync pending records and
  download a backup on the old origin before switching; sign in on the new one.
- Existing invitation links contain the origin where they were generated.
  Share new links from the new domain, or retain a working redirect for old links.

After deployment, verify HTTPS, signup/signin, session
restoration, invitation links, workspace writes and Excel downloads on the new
origin. Update any externally maintained bookmarks or links.

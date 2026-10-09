# Production domain: stockhale.app

The canonical production origin is `https://stockhale.app`. Repository configuration
is prepared for this origin; no deployment or external settings were changed.

## Hosting settings to apply outside this repository

Use only the hosting provider serving production; do not run both as active writers.

### Cloudflare Workers (configured target)

- Make the `stockhale.app` zone active and set the registrar nameservers to the
  exact nameservers assigned by Cloudflare.
- In Worker **stockhale → Settings → Domains & Routes**, bind Custom Domain
  `stockhale.app` to this Worker. The repo already declares this binding, but it
  takes effect only when applied externally or during a later authorized deployment.
- Ensure the domain has an active TLS certificate and serves HTTPS.
- Set the Worker variable `BETTER_AUTH_URL` to `https://stockhale.app` and
  `STOCKHALE_RUNTIME` to `cloudflare`.
- Store `BETTER_AUTH_SECRET` as a Worker **secret**, not a plain variable. A
  plaintext value was removed from `wrangler.jsonc`. If that value was used or
  shared, replace it with a fresh random value of at least 32 characters. Rotation
  invalidates existing sessions. Otherwise preserve the existing secure secret.
- Preserve the production `DATABASE_URL` secret. Confirm the
  `NEXT_INC_CACHE_R2_BUCKET` binding points to `stockhale-opennext-cache`.
- Decide whether `www.stockhale.app` should redirect to `https://stockhale.app`;
  if enabled, configure DNS, HTTPS and the redirect externally. The app does not
  accept www as an additional authentication origin.

### Vercel (only if retained as production host)

- Add `stockhale.app` to the production project's **Settings → Domains** and
  apply the exact DNS records shown there; do not guess record values.
- Set **Settings → Environment Variables → Production → BETTER_AUTH_URL** to
  `https://stockhale.app`. Preserve the production database and secure auth secret.
- Redirect the old production hostname to the new origin; configure www as a
  redirect if desired. Apply environment changes through a later authorized
  production redeployment.
- Keep preview origins and database branches separate from production.

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

After a separately authorized deployment, verify HTTPS, signup/signin, session
restoration, invitation links, workspace writes and Excel downloads on the new
origin. Update any externally maintained bookmarks or links.

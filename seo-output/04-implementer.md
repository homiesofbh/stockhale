# SEO Implementer Changes

## `seo-output/04-implementer/app/page.tsx`

- Added `SoftwareApplication` JSON-LD to the homepage route only, so the application entity is not repeated across unrelated public or private routes.
- Properties are limited to source-backed facts: product name, site URL, business application category (supported by the described retail operations software), Web platform, and the existing metadata description.
- Finding addressed: **AUD-02** (no structured data in inspected app source).
- No Writer placeholders.

## `seo-output/04-implementer/app/layout.tsx`

- No change. The initial root-layout-wide schema placement was removed in this revision; this mirror is retained only because it had been part of the original proposal, and should not be applied as a code change.

## Findings not changed

- **AUD-01** calls for changing the homepage H1 text. This is page copy and belongs to the Writer; no code edit was made here.
- The Analyst output reports no query data and no findings.

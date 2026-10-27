# SEO Remediation Final Report — StockHale

Target: [https://stockhale.app](https://stockhale.app)

Original team-run inputs: no query export was supplied, so the Analyst skipped at that time. On 2026-10-27, Search Console OAuth was completed and the connected account was verified as an owner of `sc-domain:stockhale.app`; the live query results are summarized in the addendum below.

Scope: source remediation, research-led commercial landing pages, eight workflow/resource pages with guide and template hubs, and local production-build validation. Production deployment is intentionally left for the user to perform manually. Live domain routing and rankings remain outside the verified evidence.

## Execution log

| Specialist | Wave | Status | Output |
|---|---:|---|---|
| Researcher | 1 | DONE | `01-researcher.md` |
| Auditor | 1 | DONE | `02-auditor.md` |
| Analyst | 1 | SKIPPED — no query data | `03-analyst.md` |
| Implementer | 2 | DONE | `04-implementer.md` and proposals under `04-implementer/` |
| Writer | 2 | DONE | `05-writer.md` |
| Editor | 3 | DONE — Approved with edits after one revision | `06-editor.md` |
| Tracker | 4 | DONE | `07-tracker.md` |

## Researcher: keyword and intent map

No first-party query, volume, rank, or trend data was supplied. The following themes are estimates, not measured demand:

| Cluster | Intent | Target / gap |
|---|---|---|
| Retail inventory software for independent stores; shop/retail management software | Commercial | Homepage `/` |
| Retail billing connected to inventory; sales tracking and shop accounts/reports | Commercial | Homepage `/` |
| Offline inventory management | Commercial | Homepage `/` |
| Managing inventory and recording purchases/sales | Informational | `/how-to-use` |
| StockHale pricing and trial | Transactional / navigational | `/pricing` |
| Fashion boutique and hardware store inventory | Commercial | Validate differentiated workflows and demand before creating pages |
| Retail inventory software in Pakistan | Commercial | Consider localized page if Pakistan is a priority market |

The complete map and caveats are in `01-researcher.md`.

### Follow-up keyword opportunity check — 2026-10-27

Assumption: Pakistan is the first market to prioritize, based on PKR localization on the live pricing page. Public web search did not return StockHale pages for a `site:stockhale.app` query; treat that as a weak indexation signal only, not proof of non-indexation. At the time of this earlier follow-up, Search Console query data and a connected keyword-metrics provider were unavailable, so no volumes, difficulty scores, or rank predictions were stated. See the newer GSC addendum below.

| Priority | Query theme to validate | Fit / competitiveness | Suggested target |
|---|---|---|---|
| 1 | stock management software for small retail shops; shop inventory software with purchases and sales | Strong product fit; narrower than broad “inventory management software Pakistan.” Best initial long-tail test, but volume and difficulty are unknown. | New commercial landing page, linked from homepage and `/how-to-use` |
| 2 | retail inventory and accounts software; inventory software with customer and supplier accounts | Strong feature fit and potentially differentiated positioning; confirm these phrases in GSC or keyword metrics. | New landing page or a focused section on a shop-management page |
| 3 | retail inventory software for independent stores | Strong fit and already reflected in the homepage title; broad category competition makes near-term ranking less likely. | Homepage `/` |
| 4 | inventory software that supports offline updates; offline stock management for shops | Product supports offline work on previously loaded workspaces, not unrestricted offline setup/sign-in. Use exact limitations in any copy. | `/how-to-use` plus a carefully worded feature section |
| 5 | boutique inventory software; hardware store stock management software | Audience fit is suggested by current site copy, but dedicated workflows and demand have not been validated. | Conditional niche pages only after validating unique use cases |
| 6 | inventory management software Pakistan; POS/billing software Pakistan; kiryana POS | Search demand is plausible but SERP competition is visibly localized and feature-rich. Competitors emphasize Pakistan-specific offline operation, Urdu, FBR, and counter workflows that StockHale should not claim without proof. | Defer broad head terms; don't target FBR/Urdu/kiryana claims without product support |

The sampled search results show Pakistan-focused billing/inventory products and guides for broad local terms ([BPS POS](https://bpspos.com/), [SoftBiller](https://softbiller.com/), [eKarobar360](https://www.ekarobar360.com/blog/inventory-management-software-pakistan-for-small-business), [ManageKaro](https://managekaro.org/features/inventory-module)). Broad global retail inventory queries also return established retail platforms and comparison content ([Salesforce category guide](https://www.salesforce.com/retail/cloud/retail-inventory-management/best-retail-inventory-management-software/), [Stash retail inventory page](https://getstash.io/retail-inventory-management-software)). These observations support prioritizing narrower, product-true phrases; they are not keyword-volume or Google-rank measurements.

## Auditor: ranked issue list

The initial audit identified a mismatch between the homepage product-category title and H1, and missing structured data. Broader source review also found inherited homepage Open Graph metadata on other routes, missing Twitter metadata, hardcoded site-origin handling, an H2 before the invoice preview H1, and missing response security headers.

The source remediation addressed these issues. Public and private route findings are described under Implementer below. The initial audit report is `02-auditor.md`.

## Analyst: quick wins

Skipped during the original team run because no query data was supplied. A later direct GSC pull found one query row only; it does not support a ranking or CTR opportunity. See the GSC addendum below and `03-analyst.md` for the original wave status.

## Implementer: code changes

- Added shared SEO URL and metadata helpers under `lib/seo/` and structured-data components under `components/seo/`.
- Added unique title, description, canonical, Open Graph and Twitter card metadata for the seven existing marketing/policy routes: `/`, `/about-us`, `/contact-us`, `/how-to-use`, `/pricing`, `/privacy-policy`, and `/terms-and-conditions`; the two new commercial routes also have unique metadata.
- Added Organization and WebSite JSON-LD globally, WebPage JSON-LD per public route, and homepage SoftwareApplication JSON-LD without unsupported price or rating claims.
- Made site-origin configuration environment-based through `NEXT_PUBLIC_SITE_URL`; documented it in `.env.example`, README, production-domain documentation, and Wrangler vars. The helper validates that the value is an HTTP(S) origin.
- Kept robots and sitemap limited to public routes, with the sitemap generated from the configured origin. Auth and workspace routes retain `noindex,nofollow` and receive route-specific titles and descriptions.
- Added two useful, product-specific commercial pages at `/inventory-management` and `/billing-inventory` for the report's long-tail themes. They explain actual product records and workflows, link to each other and to setup/pricing, and are included in the main navigation, footer, and sitemap. These are hypotheses to measure after deployment, not keywords proven by current GSC data.
- Applied the requested opportunity themes on-page: the inventory page addresses stock management for small shops and shop inventory with purchases and sales; its account section explains customer and supplier balances; the homepage targets retail inventory software for independent stores; and the offline section names offline stock management while stating that prior sign-in/loading is required and setup/team administration need internet. Pakistan POS, kiryana, Urdu, and FBR targeting remains deferred; no unsupported local feature claims were added.
- Improved heading order in the landing feature section and invoice preview while preserving visual styling. Existing image alt attributes were preserved.
- Added HSTS, nosniff, SAMEORIGIN frame protection, and strict-origin-when-cross-origin referrer policy in `next.config.mjs`.
- Added Unsplash preconnect for the marketing images.
- Applied the approved copy updates to homepage, pricing, how-to-use, and about pages/components.

## Files modified or created

- **SEO metadata and schema:** `lib/seo/site-url.ts`, `lib/seo/metadata.ts`, `components/seo/structured-data.tsx`, `app/layout.tsx`, and the seven public route files listed above.
- **Crawlability and headers:** `app/robots.ts`, `app/sitemap.ts`, `next.config.mjs`, `wrangler.jsonc`, `.env.example`.
- **Page copy, headings, and styles:** `components/stockwell/landing-page.tsx`, `components/stockwell/seo-opportunity-pages.tsx`, `components/stockwell/marketing-header.tsx`, `components/stockwell/marketing-footer.tsx`, `components/stockwell/pricing-section.tsx`, `components/stockwell/how-to-use-page.tsx`, `components/stockwell/marketing-pages.tsx`, `components/stockwell/invoice-preview.tsx`, and `app/globals.css`.
- **New search landing routes:** `app/inventory-management/page.tsx` and `app/billing-inventory/page.tsx`; both have self-canonicals, unique metadata, WebPage structured data, contextual internal links, and sitemap entries.
- **Documentation and verification:** `README.md`, `docs/PRODUCTION-DOMAIN.md`, `package.json`, and new `scripts/seo-smoke.mjs`.
- **SEO team deliverables:** `seo-output/00-final-report.md` and the specialist files `01-researcher.md` through `07-tracker.md`.

## Writer: copy and briefs

Writer recommendations for homepage, pricing, how-to-use, and about-us were applied to the corresponding routes and marketing components. The two conditional briefs for `/inventory-management` and `/billing-inventory` have now been implemented with workflow details confirmed in the product source. Fashion and hardware industry pages remain deferred until distinct workflows and demand are validated. See `05-writer.md` for the source brief.

## Editor: verdict and removed claims

**Verdict: Approved with edits.** Editor review approved the homepage-only SoftwareApplication schema after revision, accepted the copy after changing the how-to heading to avoid implying a guaranteed outcome, and retained conditional page ideas as hypotheses rather than claims of demand. No unsupported price, rating, query volume, or performance claim was added. See `06-editor.md`.

## Tracker: baseline and measurement plan

The property is now connected, but its available query baseline is extremely sparse (one impression). Tracker's pre-deployment and 2-, 4-, and 8-week measurement plan is in `07-tracker.md`. Capture index status, clicks, impressions, CTR, and average position after deploying and once Google has recrawled the updated pages.

## Verification results

- `pnpm build`: passed after the final header change (Next.js 16.3.3 production build).
- `pnpm build:cloudflare`: passed; OpenNext produced `.open-next/worker.js`. Bundling emitted two non-fatal warnings from generated SSR chunks.
- `pnpm typecheck`: passed in the prior verification run; terminal session expired before its output could be recopied.
- `pnpm lint`: exited 0 in the prior verification run, with existing warnings in business/workspace code (including `<img>` warnings on private workspace images).
- `pnpm test`: 104/104 passed in the prior verification run; terminal session expired before its output could be recopied.
- `git diff --check`: passed.
- `pnpm test:seo`: passed against the local production server. A reusable regression smoke test now checks every public route's rendered metadata, canonical, JSON-LD, H1 count and heading order, image alt attributes, robots, sitemap URLs, and security headers.
- After applying the requested keyword-theme copy, `pnpm typecheck`, `pnpm build:cloudflare`, and `git diff --check` passed. `pnpm test:seo` passed against the local production build for all nine public routes, including assertions for the small-shop, purchases/sales, customer/supplier account, and offline-stock themes and the required offline limitations, plus unique metadata, schema, headings, reciprocal links, robots/sitemap scope, and response security headers.
- Latest local production server smoke check: all 19 public routes returned HTTP 200; unique page metadata, route canonicals, matching OG/Twitter titles and descriptions, JSON-LD parseability, one H1 per route, sequential heading levels, and image alt presence were checked. All six product screenshot URLs returned actual PNG files; the stocktake XLSX was available without authentication; the development capture route returned 404 in production.
- Local `robots.txt` returned 200 with the configured sitemap URL and private workspace/API disallows. `sitemap.xml` returned 200 with 19 public locations and no auth/workspace/API/capture URLs. Auth noindex routes returned 200 without inherited homepage canonicals.
- Production-mode localhost response returned HTTP 200 and all four configured security headers.

Context7 documentation lookup was attempted as required by repository instructions but failed because `registry.npmjs.org` DNS resolution returned `ENOTFOUND`. The build and local production checks provide implementation verification; this report does not claim external documentation was fetched.

## Google Search Console readiness checklist

- **Sitemap URL:** `https://stockhale.app/sitemap.xml`; local production response is HTTP 200 with 19 public canonical paths. `robots.txt` points to it and returns HTTP 200.
- **Schema types:** Local rendered JSON-LD parsed successfully for `Organization`, `WebSite`, and per-page `WebPage`; homepage also includes `SoftwareApplication`. This validates JSON syntax and expected types, not Google's Rich Results eligibility or a live Rich Results Test result.
- **Canonical domain:** build-time origin is configured as `https://stockhale.app` via `NEXT_PUBLIC_SITE_URL`, and local rendered canonicals/schema/sitemap use that origin. Live HTTPS, apex-versus-www redirects, and production response headers still require post-deployment verification.
- **Indexing and performance data:** Search Console is now connected. The initial 90-day query export and a 16-month query export are saved in `gsc-queries-90d.json` and `gsc-queries-16m.json`; see the GSC addendum below. URL Inspection and Core Web Vitals field data have not been checked in this follow-up.

## Search Console keyword opportunity addendum — 2026-10-27

The Google account completed OAuth and owns the verified domain property `sc-domain:stockhale.app`. Search Analytics was queried for 2026-07-29 through 2026-10-24 and for the full available 16-month window, through 2026-10-24. The 90-day export returned one query: **“stockall solutions”** → `https://stockhale.app/`, with **1 impression, 0 clicks, and average position 40**. The 16-month export also returned only that row. It is not a meaningful near-page-one opportunity: the term appears brand-mismatched and the evidence is a single impression. No non-branded query or keyword cluster has enough Search Console evidence to say StockHale can rank for it.

The 16-month export carries Google's warning that impressions, CTR, and average position were unreliable from 2025-05-13 through 2026-04-27 due to an impressions logging issue; clicks were unaffected. That warning does not explain the solitary recent 90-day impression, but the tiny count still prevents a useful ranking conclusion. Search Console has not yet validated the research themes below: retail inventory software for independent stores, stock management for small retail shops, inventory plus billing/accounts, or offline inventory. Keep those as product-fit hypotheses, not proven ranking targets.

**Next measurement:** after the source changes reach production, capture a 28-day baseline and monitor query/page rows for those themes over 4–8 weeks. Until then, there are no substantiated GSC keyword quick wins or defensible rank predictions. Raw responses: `gsc-queries-90d.json`, `gsc-query-pages-90d.json`, and `gsc-queries-16m.json`.

## Live production audit — 2026-10-27

The live site was reachable in the browser during this audit, before the two new routes were added. These checks show that the current source changes have **not** reached production; the two new routes remain source-only until the user's manual deployment:

- Public pages load with unique titles, descriptions, and self canonicals, but secondary pages inherit the homepage `og:title`, `og:description`, and `og:url`; Twitter titles/descriptions are also inherited. The live page returns `twitter:card=summary`, and the inspected public heads have no social image metadata.
- Only the homepage has schema, and it has `SoftwareApplication` without the shared Organization/WebSite or WebPage records. The other six public pages have no JSON-LD.
- Homepage headings jump from H1 to H3. The inspected public pages had no missing image alt attributes.
- Live `/robots.txt` and `/sitemap.xml` are reachable; robots points to the sitemap, which lists seven public routes.
- Browser navigation from HTTP redirects to HTTPS. `www.stockhale.app` fails DNS resolution, so the www host does not currently normalize to the apex host.
- The connected Cloudflare account has no `stockhale.app` zone or Worker domain. Its available Worker is for another site. Search Console is connected directly through Google OAuth, but not through Windsor. The Cloudflare production artifact builds locally, but it was not deployed.

**Production acceptance is therefore not yet met.** Deployment and DNS changes require access to the hosting/DNS account that serves `stockhale.app`. The Google Search Console property is connected, but current query data is too sparse to measure ranking progress. The local source, build artifacts, and automated checks are ready, but should not be represented as a production SEO fix until the live discrepancies are resolved and rechecked.

## Top five next actions

1. Manually deploy the source changes, including the inventory, billing, accounts, daily-closing, guide and template pages, with `NEXT_PUBLIC_SITE_URL=https://stockhale.app` configured in production.
2. Verify production HTTPS, apex/www behavior, response headers, canonical URLs, robots, and sitemap on the live domain after deployment.
3. Inspect the newly published commercial and resource URLs in Search Console and capture a fresh baseline after Google has crawled them.
4. Track impressions, clicks, CTR, and position for the product-fit themes for 4–8 weeks; the current one-impression result does not establish a ranking opportunity.
5. Validate distinct feature workflows and demand before commissioning fashion- or hardware-specific pages.

## Next-page opportunity analysis — 2026-10-27

This directional plan was based on the pre-expansion nine-route public sitemap, verified product workflows, and a fresh web search sample. All eight recommended pages have since been implemented in source, along with guide and template hubs. It is not a ranking forecast: the last GSC pull (ending 2026-10-24) contained only one query impression, and no keyword volume or difficulty dataset is available. Search samples establish competing page types and language, not demand or reliable Google positions in a specified country.

| Order | Proposed URL | Intent / query themes | Required distinct content |
|---|---|---|---|
| 1 | `/customer-supplier-accounts` | Commercial: inventory software with customer and supplier accounts; retail customer ledger software | Actual customer and supplier ledgers, outstanding amounts, collections and supplier payments, and the difference between account balances and individual bill balances. Link to billing and inventory pages; avoid presenting operational records as tax-compliant accounting software. |
| 2 | `/guides/opening-stock` | Informational: how to enter opening stock in inventory software; opening stock vs purchases | A worked, clearly labelled example, actual StockHale screenshots, starting quantities and costs, choosing purchases versus opening-stock adjustments, and avoiding double entry. Link to `/inventory-management` and `/how-to-use`. |
| 3 | `/guides/retail-stocktake` | Informational: how to count stock in a small shop; correct inventory discrepancies | A count checklist, expected versus counted quantity, investigating differences, dated adjustments with reasons, and reviewing movement history. Describe only supported count and adjustment tools. |
| 4 | `/daily-cash-closing` | Commercial: retail daily cash closing software; shop cash drawer reconciliation | Expected versus counted physical cash, receipts and payouts, variance review, closing a date, and owner-controlled reopening. This is distinct from billing; avoid implying automated bank-feed reconciliation. |
| 5 | `/guides/low-stock-reorder-levels` | Informational: how to set low-stock levels; reorder level for a small shop | Explain a threshold with a labelled example, show the actual low-stock view, and describe a manual review/reorder routine. Do not claim automated purchase orders or email stock alerts unless verified. |
| 6 | `/guides/customer-credit-sales` | Informational: track credit sales and customer payments; partial-payment customer ledger | Follow a labelled sale through a part payment and later collection, showing the bill balance and customer account history. Link to the accounts page and billing page. |
| 7 | `/guides/returns-damaged-stock` | Informational: record customer returns and damaged inventory | Separate customer returns, supplier returns and damage; illustrate the supported stock and credit effects with real screens and reasons. |
| 8 | `/templates/stocktake-sheet` | Resource: retail stocktake spreadsheet; stock count sheet template | Publish a real downloadable sheet with SKU, product, expected quantity, count, difference and reason, plus instructions and an example. Do not publish a download landing page until the file exists. |

Start with orders 1–4, linked from a small `/guides` hub for the informational pages. Link guides to the relevant commercial page, and commercial pages back to practical guides. Each page needs a distinct main question, original product evidence, accurate examples, a clear next step, and unique metadata. Add published canonical pages to the sitemap. Consolidate overlapping copy rather than generating keyword variants of the existing inventory and billing pages.

Retain the homepage's independent-retailer positioning. Expand the existing inventory page's offline section before considering a separate offline sales page: search results include products promising fully offline installation/use, while StockHale requires prior online sign-in and workspace loading. Keep Pakistan POS, kiryana, Urdu/FBR claims and near-duplicate fashion/hardware pages deferred. Named competitor comparisons need verified current feature/pricing research and a useful buyer decision before commissioning.

External evidence: [Zoho's opening-stock help](https://www.zoho.com/us/inventory/kb/items/item-initial-stock.html) illustrates task-specific setup content; [Shopify's inventory checks guide](https://help.shopify.com/en/manual/inventory-and-locations/fundamentals/understanding-inventory-management) covers physical counts and discrepancy investigation; [Zoho's reorder-level help](https://www.zoho.com/us/inventory/kb/items/item-reorder.html) demonstrates the low-stock educational topic. Commercial examples include [Retail Link](https://www.retaillink.app/) for connected stock/customer/supplier records and [Cashilio](https://cashilio.com/) for daily reconciliation. [BusinessX](https://www.mybusinessx.com/inventory-management) and [Restockly](https://www.restocklypos.com/) illustrate the stronger offline promises buyers can encounter. These are competitor observations, not evidence that StockHale will outrank them.

Measure each published page's index status, non-branded query impressions, clicks and trial/pricing visits. Review after 4–8 weeks of exposure; limited impressions may require a longer observation period. Keep baseline dates and deployment dates separate, and use observed query intent to refine or consolidate pages. No traffic or ranking target is justified by the present baseline.

## Workflow-page implementation handoff — 2026-10-27

All eight recommendations are implemented: `/customer-supplier-accounts`, `/guides/opening-stock`, `/guides/retail-stocktake`, `/daily-cash-closing`, `/guides/low-stock-reorder-levels`, `/guides/customer-credit-sales`, `/guides/returns-damaged-stock`, and `/templates/stocktake-sheet`. `/guides` and `/templates` organize discovery. Homepage, footer, navigation, and relevant inventory/billing sections link into the new content; every new page has contextual next steps, a self-canonical, social metadata and WebPage schema. Guides also have TechArticle and breadcrumb structured data without fabricated publishing dates or performance claims.

Each detailed page includes a specific workflow, clearly labelled sample calculations, practical checks, questions, and a real product screenshot. Six images were captured from actual StockHale components using fictional records; the development-only `/preview-guide/[screen]` capture route is noindex and returns 404 under the production environment. No private backup or customer data was used. Desktop and 390px mobile layout were inspected; a narrow-screen grid overflow was corrected and rechecked.

The direct public download `/downloads/stockhale-stocktake.xlsx` contains a 50-row blank Stocktake sheet, an Example sheet, and Instructions. Difference formulas calculate counted minus expected stock, preserve a valid count of zero, and leave uncounted rows blank. Calculation checks covered shortage, surplus, matching count, zero count, blank count and the final prepared row. All three sheets were rendered for visual review and the workbook was exported successfully. It is a count aid, not an automatic import into StockHale.

The production smoke suite passes for all 19 public routes, guide article/breadcrumb schemas, sitemap completeness, security headers, screenshots, the anonymous workbook download and capture-route isolation. TypeScript and the final Cloudflare build pass; the existing two generated-bundle warnings remain non-fatal. Hash comparisons confirm that the Cloudflare asset bundle contains the same corrected PNGs and XLSX as the public source directory. Git ignore exceptions now include `lib/seo/*.ts` and the specific public stocktake workbook so a repository-based deployment can include them. The source remains ready for the user's manual deployment; no live publication or ranking improvement is claimed.

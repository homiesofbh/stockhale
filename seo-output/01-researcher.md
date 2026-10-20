# SEO Researcher — StockHale

## 1. Data used and missing

- **Site input:** https://stockhale.app (user supplied). Direct web fetch was inaccessible in this environment; a branded `site:stockhale.app` search returned no indexed StockHale result. Live-site wording remains unverified.
- **Primary evidence:** repository public routes and copy: `app/layout.tsx`, `components/stockwell/landing-page.tsx`, `app/pricing/page.tsx`, `app/how-to-use/page.tsx`, `components/stockwell/how-to-use-page.tsx`, `app/about-us/page.tsx`, and `app/sitemap.ts`. The homepage describes independent retail software for inventory, billing, accounts, sales, reports, and offline work. Pricing describes three plans and a 72-hour trial. The guide documents setup and daily workflows.
- **Query data:** none supplied. No Search Console export, analytics query report, internal search logs, keyword volumes, rankings, or trend data were available. Every query below is **estimated**; volume and trend are **unknown**.
- **External search context:** general search surfaced inventory-management product descriptions using terms such as “inventory management,” “inventory tracking,” and “small business” (e.g. [Stocker listing](https://play.google.com/store/apps/details?id=com.stockertech.inventorymanagement), [Stocklow](https://www.stocklow.com/)). These are examples of market phrasing, not StockHale query evidence or competitor metrics.

## 2. Estimated query clusters

| Cluster / likely query terms (all estimated) | Intent | Evidence | Target page |
|---|---|---|---|
| retail inventory software; retail inventory management software; inventory software for small retail store | Commercial | Site metadata explicitly says “Retail Inventory Software”; homepage covers item, variation, and movement tracking for independent stores (`app/layout.tsx`, `components/stockwell/landing-page.tsx`). | Existing: `/` |
| shop management software; retail management software for independent stores | Commercial | Homepage positions StockHale as a connected workspace for stock, billing, and accounts (`components/stockwell/landing-page.tsx`). | Existing: `/` |
| inventory and billing software for retail; retail billing software with inventory | Commercial | Billing and inventory are presented together on homepage and setup guide (`components/stockwell/landing-page.tsx`, `components/stockwell/how-to-use-page.tsx`). | Existing: `/` |
| retail sales tracking software; sales and inventory management for shops | Commercial | Homepage features a sales overview and connected stock/sales/account functions (`components/stockwell/landing-page.tsx`). | Existing: `/` |
| retail accounting software; shop accounts and sales reports software | Commercial | Site metadata and homepage include accounts and reports (`app/layout.tsx`, `components/stockwell/landing-page.tsx`). | Existing: `/` |
| offline inventory management software; offline retail inventory app | Commercial | Homepage says previously loaded workspaces can edit offline and queued changes sync after reconnect (`components/stockwell/landing-page.tsx`). | Existing: `/` |
| how to manage inventory for a small retail store; how to record stock purchases and sales | Informational | Six-step guide covers products, purchases, bills, payments, and reports (`app/how-to-use/page.tsx`, `components/stockwell/how-to-use-page.tsx`). | Existing: `/how-to-use` |
| StockHale pricing; retail inventory software pricing; inventory software free trial | Transactional / Navigational | Pricing metadata describes three plans, regional monthly/annual pricing, and a 72-hour no-card trial (`app/pricing/page.tsx`); homepage CTA creates a workspace (`components/stockwell/landing-page.tsx`). | Existing: `/pricing` |
| StockHale login; StockHale sign up | Navigational / Transactional | Sign-in and sign-up routes exist and are marked noindex (`app/sign-in/page.tsx`, `app/sign-up/page.tsx`). | Existing: `/sign-in`, `/sign-up` (conversion destinations, not organic targets) |
| inventory software for fashion boutiques; inventory software for hardware stores; inventory software for small shops | Commercial | Homepage names fashion/lifestyle and hardware/supplies audiences, but only within general landing page content (`components/stockwell/landing-page.tsx`). | MISSING: audience-specific landing pages; homepage is broad fallback |
| retail inventory software Pakistan; inventory billing software Pakistan | Commercial | Pricing supports local currency for Pakistan; no country-specific route appears in sitemap (`app/pricing/page.tsx`, `app/sitemap.ts`). | MISSING: Pakistan-focused landing page, if Pakistan is a priority market |
| inventory software alternatives; StockHale vs alternatives | Commercial | No comparison or alternatives page appears in public sitemap (`app/sitemap.ts`); demand is unverified. | MISSING; validate demand before investing |

## 3. Top gaps ranked by likely impact

Rank is directional from product fit and current coverage, not measured traffic or demand. Volumes and expected traffic are **unknown**.

1. **Feature/topic landing pages for inventory, billing, and shop management.** These align with the core offer and commercial query phrasing, but currently resolve to a general homepage. Add distinct pages only where each can provide useful unique detail. Evidence: homepage bundles these features (`components/stockwell/landing-page.tsx`).
2. **More small-retail workflow content beyond the setup guide.** The guide explains setup and recording transactions, but the sitemap shows no separate resources for stock counts, low-stock handling, billing, or sales reporting. Evidence: `app/how-to-use/page.tsx`, `app/sitemap.ts`.
3. **Industry-specific landing pages.** Fashion/lifestyle and hardware/supplies are named audiences without dedicated routes. Evidence: audience blocks in `components/stockwell/landing-page.tsx`; routes in `app/sitemap.ts`.
4. **Market-specific page, if Pakistan is a target market.** Pricing supports PKR visitors, but there is no localized page or market explanation in the sitemap. Market priority and demand are unknown. Evidence: `app/pricing/page.tsx`, `app/sitemap.ts`.
5. **Verify public brand discoverability.** Direct fetch failed and branded search returned no StockHale result in this run; this does not establish that the site is deindexed. Verify Search Console coverage and live crawl before treating it as an SEO issue. Evidence: access attempt to https://stockhale.app and search query `site:stockhale.app`.

## Measurement caveat

No terms are observed from StockHale's own data. Do not treat estimated clusters, external wording examples, or priority ordering as measured demand. Search Console query/page data is needed to establish observed terms, impressions, clicks, positions, rising queries, and whether proposed gaps already receive traffic.

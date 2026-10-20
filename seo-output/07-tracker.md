# SEO Tracker — StockHale

## Scope and evidence

Editor verdict: **Approved with edits**. This plan tracks only the accepted deliverables: homepage metadata/headings/copy and homepage-only `SoftwareApplication` JSON-LD; pricing page copy; `/how-to-use` page copy; and `/about-us` page copy. The proposed `/inventory-management`, `/billing-inventory`, fashion, and hardware pages are conditional opportunities and are not tracked as shipped changes.

No Search Console export or query data was provided. The Auditor could not verify live responses or rendered pages. Therefore, no numeric baseline is available for organic clicks, impressions, CTR, average position, index status, or Core Web Vitals. No values are inferred from the researcher's estimated query themes.

## Baseline by changed page

Capture these values immediately before deployment, with the reporting date range and source recorded. Preserve the exact page and query filters so post-launch comparisons use the same scope.

| Page / approved change | Clicks | Impressions | CTR | Average position | Indexed status | Core Web Vitals |
|---|---:|---:|---:|---:|---|---|
| `/` — title, description, H1/supporting copy, homepage JSON-LD | **Capture before shipping:** GSC Search results, page filter exact URL, last 28 complete days; also export Queries × Pages for last 3 months with clicks, impressions, CTR, and average position. | Same capture | Same capture | Same capture | **Capture before shipping:** GSC URL Inspection index verdict and last crawl for canonical homepage URL. | **Capture before shipping:** CrUX field LCP, INP, CLS for the homepage/origin if available; otherwise record “no field data.” Also capture a consistent mobile Lighthouse run as lab context, not field CWV. |
| `/pricing` — title, description, H1/trial copy | **Capture before shipping:** same GSC exact-page 28-day and 3-month Queries × Pages exports. | Same capture | Same capture | Same capture | **Capture before shipping:** GSC URL Inspection verdict and last crawl for exact canonical URL. | **Capture before shipping:** CrUX page/origin LCP, INP, CLS if available; otherwise record “no field data”; record consistent mobile Lighthouse lab run. |
| `/how-to-use` — title, description, H1, headings and workflow copy | **Capture before shipping:** same GSC exact-page 28-day and 3-month Queries × Pages exports. | Same capture | Same capture | Same capture | **Capture before shipping:** GSC URL Inspection verdict and last crawl for exact canonical URL. | **Capture before shipping:** CrUX page/origin LCP, INP, CLS if available; otherwise record “no field data”; record consistent mobile Lighthouse lab run. |
| `/about-us` — title, description, H1 and supporting copy | **Capture before shipping:** same GSC exact-page 28-day and 3-month Queries × Pages exports. | Same capture | Same capture | Same capture | **Capture before shipping:** GSC URL Inspection verdict and last crawl for exact canonical URL. | **Capture before shipping:** CrUX page/origin LCP, INP, CLS if available; otherwise record “no field data”; record consistent mobile Lighthouse lab run. |

For Search Console, keep both the exact-page aggregate and query-level export. Record the GSC property, dates, search type, country/device filters, and extraction date. Use the same filters for each follow-up. For CWV, note whether each value is field or lab data and the URL/origin granularity; do not treat lab scores as field CWV.

## Check schedule

Set **T0** to the production deployment date. At each checkpoint, confirm the release is live and the intended title, description, H1/copy, and homepage JSON-LD are present in rendered HTML before interpreting search metrics.

- **Before shipping / T0:** capture the baselines above; record deployment date and exact approved changes.
- **2 weeks after T0:** check rendering, canonical/index status, schema validity, early impressions/clicks, and crawl/index changes. Treat performance movement as preliminary.
- **4 weeks after T0:** compare the same 28-day period immediately before launch with the first complete 28 days after launch. Review page-level and query-level GSC metrics.
- **8 weeks after T0:** repeat the same comparison using the most recent complete 28-day window; assess whether changes persist and whether any page/query gains coincide with losses elsewhere.

If Google has not recrawled or indexed a changed URL by a checkpoint, record that and continue checking; do not interpret absent post-change exposure as a content performance result.

## Success thresholds by fix

These are evaluation criteria, not predicted outcomes. Compare equivalent complete date windows and the same query set/filters. Consider a threshold met only when the measurement is available and the direction is not explained by a material confounder.

| Approved fix | What would count as success |
|---|---|
| Homepage title, description, H1 and supporting copy | For the same homepage query set, CTR is above its pre-launch baseline at the 4- or 8-week check while impressions are not materially lower; the page continues to receive impressions for relevant retail inventory/software queries. A rendered title/H1 matching the approved copy is a release verification condition. |
| Pricing title, description, H1 and trial copy | For the same `/pricing` query set, CTR is above baseline at the 4- or 8-week check without a material loss of relevant impressions. Confirm the approved pricing/trial copy renders accurately. |
| `/how-to-use` title, description, H1, headings and workflow copy | For the same guide query set, clicks or impressions increase versus baseline, or CTR improves at comparable impressions, without a sustained deterioration in average position. Confirm the approved headings and workflow language render as reviewed. |
| `/about-us` title, description, H1 and supporting copy | For the same page query set, impressions or clicks increase versus baseline, or CTR improves at comparable impressions, with no sustained decline in average position. Confirm the approved page copy renders. |
| Homepage-only `SoftwareApplication` JSON-LD | The homepage rendered HTML contains valid JSON-LD with only the approved source-backed properties, and the markup validates at launch and follow-up. Search appearance or ranking changes are not required to declare the technical fix implemented; monitor Search Console enhancements if available. |

Across all pages, indexed status remaining indexed (or becoming indexed if baseline is not indexed and the page is eligible) and no new CWV regression are guardrails. CWV guardrail: field metrics do not move from “good” to “needs improvement/poor” at the same granularity, where enough CrUX data exists. If data is unavailable, report it as unavailable rather than passing the metric.

## Confounders to record

- Seasonal demand, holidays, local buying cycles, and changes in regional/device mix.
- Google core, spam, or other search updates during the observation windows.
- Other site releases: page redesigns, internal links, navigation, URL/canonical/robots/sitemap changes, performance work, analytics changes, or product copy changes.
- Competitor activity and changing search result layouts, including ads, AI features, and other SERP elements that can affect CTR.
- Crawl/indexing delay, property/filter differences, incomplete reporting windows, and Search Console data lag.
- Low impressions or CrUX sample availability, which can make comparisons noisy or unavailable.
- Simultaneous changes to multiple elements on one page; observed movement cannot isolate which title, copy, heading, or schema change caused it.

STATUS: DONE

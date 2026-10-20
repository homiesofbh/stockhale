# SEO Audit — StockHale

Scope: live target `https://stockhale.app` and the supplied repository source. No query data file was supplied. The live site, `robots.txt`, and `sitemap.xml` could not be fetched with the available web inspection tool, so runtime status, redirects, rendered HTML, and live indexability remain unverified. Findings below are limited to repository evidence.

## Issues

### Medium

#### AUD-01 — Landing page title and H1 communicate different subjects

- **What is wrong:** The global title targets “Retail Inventory Software,” while the homepage H1 is a broad brand statement (“Your whole store. One clear view.”), without an explicit product/category term.
- **Evidence:** [app/layout.tsx](/Users/userr/Documents/Codes/Product%20Management%20System/stockhale/app/layout.tsx:20) sets the homepage title to `Retail Inventory Software | StockHale`; [components/stockwell/landing-page.tsx](/Users/userr/Documents/Codes/Product%20Management%20System/stockhale/components/stockwell/landing-page.tsx:57) renders the H1 `Your whole store. One clear view.`
- **Why it matters:** The title and primary visible heading give search engines and visitors different cues about the page topic, and the H1 alone does not clarify the product category.
- **Recommended fix:** Align the homepage H1 with the core product category and audience while retaining the brand positioning.

### Low

#### AUD-02 — No structured data is present in the inspected app source

- **What is wrong:** The inspected app and marketing components contain no JSON-LD or other Schema.org markup.
- **Evidence:** Search of `app/` and the homepage/about/contact/how-to marketing components found no `application/ld+json` or `schema.org` occurrences. The root layout at [app/layout.tsx](/Users/userr/Documents/Codes/Product%20Management%20System/stockhale/app/layout.tsx:27) renders only the HTML shell, children, analytics, and Clarity scripts.
- **Why it matters:** Search engines receive no explicit structured entity or product information from the checked source, which can limit eligibility for relevant enhanced search presentations.
- **Recommended fix:** Evaluate appropriate organization and software-product schema for the public marketing pages; add only properties supported by verifiable business/product facts and validate the rendered JSON-LD before release.

## Checked and found healthy (source-level only)

- Global metadata defines `metadataBase`, a descriptive title and description, canonical `/`, and `index, follow` for the homepage ([app/layout.tsx](/Users/userr/Documents/Codes/Product%20Management%20System/stockhale/app/layout.tsx:5)).
- Robots configuration allows public routes, disallows `/workspace` and `/api/`, and declares the sitemap URL ([app/robots.ts](/Users/userr/Documents/Codes/Product%20Management%20System/stockhale/app/robots.ts:3)).
- Sitemap source lists the homepage and six intended public routes ([app/sitemap.ts](/Users/userr/Documents/Codes/Product%20Management%20System/stockhale/app/sitemap.ts:3)).
- Public marketing route metadata includes route-specific canonicals and descriptions for about, contact, how-to, pricing, privacy, and terms pages (for example [app/pricing/page.tsx](/Users/userr/Documents/Codes/Product%20Management%20System/stockhale/app/pricing/page.tsx:5)).
- Authentication and password recovery pages set `noindex, nofollow` in metadata ([app/sign-in/page.tsx](/Users/userr/Documents/Codes/Product%20Management%20System/stockhale/app/sign-in/page.tsx:2), [app/sign-up/page.tsx](/Users/userr/Documents/Codes/Product%20Management%20System/stockhale/app/sign-up/page.tsx:2), [app/forgot-password/page.tsx](/Users/userr/Documents/Codes/Product%20Management%20System/stockhale/app/forgot-password/page.tsx:3), [app/reset-password/page.tsx](/Users/userr/Documents/Codes/Product%20Management%20System/stockhale/app/reset-password/page.tsx:3)).
- Main marketing page components have a visible H1 and subsequent H2/H3 section structure in the source. This does not confirm the final rendered DOM.
- Marketing header/footer include internal links to public routes and key landing-page sections ([components/stockwell/marketing-header.tsx](/Users/userr/Documents/Codes/Product%20Management%20System/stockhale/components/stockwell/marketing-header.tsx:12), [components/stockwell/marketing-footer.tsx](/Users/userr/Documents/Codes/Product%20Management%20System/stockhale/components/stockwell/marketing-footer.tsx:41)).

## Not verifiable from available evidence

- Live HTTP status codes, canonical response tags, redirect chains, robots and sitemap availability/content, rendered titles/headings, and whether search crawlers receive equivalent content could not be confirmed because live endpoints were inaccessible to the inspection tool.
- Core Web Vitals (LCP, INP, CLS), mobile usability, and field/lab performance data were not available; no metrics are asserted.
- Duplicate/thin content and hreflang need broader live/crawl evidence. Source routes show a single English language declaration (`<html lang="en">` in `app/layout.tsx:31`) and no hreflang configuration was found in inspected source.

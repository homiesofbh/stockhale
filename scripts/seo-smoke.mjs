import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const origin = (process.env.SEO_SMOKE_ORIGIN || "http://127.0.0.1:3000").replace(/\/$/, "");
const envFile = (() => {
  try { return readFileSync(".env", "utf8"); } catch { return ""; }
})();
const configuredOrigin = process.env.SEO_CANONICAL_ORIGIN
  || process.env.NEXT_PUBLIC_SITE_URL
  || envFile.match(/^NEXT_PUBLIC_SITE_URL\s*=\s*["']?([^\s"']+)/m)?.[1]
  || null;
const publicRoutes = [
  "/",
  "/about-us",
  "/contact-us",
  "/how-to-use",
  "/inventory-management",
  "/billing-inventory",
  "/customer-supplier-accounts",
  "/daily-cash-closing",
  "/guides",
  "/guides/opening-stock",
  "/guides/retail-stocktake",
  "/guides/low-stock-reorder-levels",
  "/guides/customer-credit-sales",
  "/guides/returns-damaged-stock",
  "/templates",
  "/templates/stocktake-sheet",
  "/pricing",
  "/privacy-policy",
  "/terms-and-conditions",
];

function readMeta(html, key, attribute = "name") {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tag = html.match(new RegExp(`<meta\\s+[^>]*${attribute}=["']${escaped}["'][^>]*>`, "i"))?.[0];
  return tag?.match(/\bcontent=["']([^"']*)["']/i)?.[1] ?? null;
}

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => JSON.parse(match[1].replaceAll("\\u003c", "<")));
}

const seenTitles = new Set();
const seenDescriptions = new Set();
let canonicalOrigin = configuredOrigin?.replace(/\/$/, "") ?? null;
const canonicalUrlFor = (route) => route === "/" ? canonicalOrigin : new URL(route, `${canonicalOrigin}/`).href;

for (const route of publicRoutes) {
  const response = await fetch(`${origin}${route}`);
  assert.equal(response.status, 200, `${route} should return HTTP 200`);
  const html = await response.text();
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const description = readMeta(html, "description");
  const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)?.[1]
    ?? html.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i)?.[1];
  const ogTitle = readMeta(html, "og:title", "property");
  const ogDescription = readMeta(html, "og:description", "property");
  const ogUrl = readMeta(html, "og:url", "property");
  const ogImage = readMeta(html, "og:image", "property");
  const twitterCard = readMeta(html, "twitter:card");
  const twitterTitle = readMeta(html, "twitter:title");
  const twitterDescription = readMeta(html, "twitter:description");
  const twitterImage = readMeta(html, "twitter:image");

  assert.ok(title.trim(), `${route} needs a title`);
  assert.ok(description?.trim(), `${route} needs a meta description`);
  assert.ok(!seenTitles.has(title), `${route} title must be unique`);
  assert.ok(!seenDescriptions.has(description), `${route} description must be unique`);
  seenTitles.add(title);
  seenDescriptions.add(description);
  canonicalOrigin ??= new URL(canonical).origin;
  assert.equal(canonical, canonicalUrlFor(route), `${route} canonical should point to itself`);
  assert.equal(ogTitle, title, `${route} Open Graph title should match its title`);
  assert.equal(ogDescription, description, `${route} Open Graph description should match`);
  assert.equal(ogUrl, canonical, `${route} Open Graph URL should match canonical`);
  assert.ok(ogImage?.startsWith("https://"), `${route} needs an absolute Open Graph image`);
  assert.equal(twitterCard, "summary_large_image", `${route} needs a large Twitter card`);
  assert.equal(twitterTitle, title, `${route} Twitter title should match its title`);
  assert.equal(twitterDescription, description, `${route} Twitter description should match`);
  assert.ok(twitterImage?.startsWith("https://"), `${route} Twitter image should be absolute`);
  if (ogImage) assert.equal(twitterImage, ogImage, `${route} Twitter and Open Graph images should match`);

  const schemas = jsonLdBlocks(html);
  assert.ok(schemas.length, `${route} needs structured data`);
  const schemaTypes = schemas.flatMap((schema) => schema["@graph"]?.map((item) => item["@type"]) ?? [schema["@type"]]);
  assert.ok(schemaTypes.includes("WebPage"), `${route} needs WebPage schema`);
  assert.ok(schemaTypes.includes("Organization"), `${route} needs Organization schema`);
  assert.ok(schemaTypes.includes("WebSite"), `${route} needs WebSite schema`);
  if (route === "/") assert.ok(schemaTypes.includes("SoftwareApplication"), "homepage needs SoftwareApplication schema");
  if (route.startsWith("/guides/")) {
    assert.ok(schemaTypes.includes("TechArticle"), `${route} needs article structured data`);
    assert.ok(schemaTypes.includes("BreadcrumbList"), `${route} needs breadcrumb structured data`);
  }
  if (route === "/inventory-management") {
    assert.match(html, /Keep retail stock/i, "inventory landing page should contain its primary product heading");
    assert.match(html, /stock management software for small retail shops/i, "inventory page should address the small-shop stock management theme");
    assert.match(html, /shop inventory software with purchases and sales/i, "inventory page should address the purchases and sales theme");
    assert.match(html, /inventory software with customer and supplier accounts/i, "inventory page should address the customer and supplier accounts theme");
    assert.match(html, /offline stock management for shops/i, "inventory page should address the offline theme with a qualification");
    assert.match(html, /First sign-in, account or workspace setup, and team administration require internet/i, "offline copy should retain its limits");
    assert.match(html, /\/billing-inventory/, "inventory landing page should link to the billing workflow");
  }
  if (route === "/billing-inventory") {
    assert.match(html, /Connect retail billing/i, "billing landing page should contain its primary product heading");
    assert.match(html, /\/inventory-management/, "billing landing page should link to the inventory workflow");
  }

  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>/gi)].map((match) => Number(match[1]));
  assert.equal(headings.filter((level) => level === 1).length, 1, `${route} should have exactly one H1`);
  for (let index = 1; index < headings.length; index++) {
    assert.ok(headings[index] <= headings[index - 1] + 1, `${route} heading sequence should not skip levels`);
  }
  for (const image of html.matchAll(/<img\b([^>]*)>/gi)) {
    assert.match(image[1], /\balt\s*=/i, `${route} image must include alt text`);
  }
  console.log(`PASS ${route}: metadata, schema, headings, and image alt`);
}

const robotsResponse = await fetch(`${origin}/robots.txt`);
assert.equal(robotsResponse.status, 200, "robots.txt should return HTTP 200");
const robots = await robotsResponse.text();
assert.ok(robots.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`), "robots.txt should point to the canonical sitemap URL");
assert.match(robots, /Disallow:\s*\/workspace/);
assert.match(robots, /Disallow:\s*\/api\//);

const sitemapResponse = await fetch(`${origin}/sitemap.xml`);
assert.equal(sitemapResponse.status, 200, "sitemap.xml should return HTTP 200");
const sitemap = await sitemapResponse.text();
assert.match(sitemap, /^<\?xml[^>]+>\s*<urlset\b/i);
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert.equal(sitemapUrls.length, publicRoutes.length, "sitemap should contain each public route exactly once");
assert.deepEqual(new Set(sitemapUrls), new Set(publicRoutes.map((route) => route === "/" ? `${canonicalOrigin}/` : canonicalUrlFor(route))));
assert.doesNotMatch(sitemap, /\/workspace|\/sign-in|\/sign-up|\/api\//);
console.log("PASS robots.txt and sitemap.xml: reachable, valid, and scoped to public routes");

const headersResponse = await fetch(`${origin}/`);
assert.equal(headersResponse.headers.get("x-content-type-options"), "nosniff");
assert.equal(headersResponse.headers.get("x-frame-options"), "SAMEORIGIN");
assert.equal(headersResponse.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
assert.equal(headersResponse.headers.get("strict-transport-security"), "max-age=31536000");
console.log("PASS response security headers");

for (const name of ["opening-stock", "stock-history", "customer-accounts", "daily-closing", "low-stock", "returns"]) {
  const response = await fetch(`${origin}/guides/images/${name}.png`);
  assert.equal(response.status, 200, `Product screenshot ${name} should be available`);
  assert.match(response.headers.get("content-type") || "", /image\/png/);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], "Screenshot must be a real PNG");
}
const templateResponse = await fetch(`${origin}/downloads/stockhale-stocktake.xlsx`);
assert.equal(templateResponse.status, 200, "Stocktake workbook should be downloadable without authentication");
const templateBytes = new Uint8Array(await templateResponse.arrayBuffer());
assert.equal(String.fromCharCode(...templateBytes.slice(0, 2)), "PK", "Workbook must be an XLSX archive");
const previewResponse = await fetch(`${origin}/preview-guide/opening-stock`);
assert.equal(previewResponse.status, 404, "Development-only screenshot preview must not be published in production");
console.log("PASS product screenshots, public workbook download, and development-preview isolation");

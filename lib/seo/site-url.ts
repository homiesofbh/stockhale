const configuredSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://stockhale.app";

const parsedSiteUrl = new URL(configuredSiteUrl);
if (!/^https?:$/.test(parsedSiteUrl.protocol) || parsedSiteUrl.pathname !== "/" || parsedSiteUrl.search || parsedSiteUrl.hash) {
  throw new Error("The site URL must be an HTTP(S) origin without a path, query, or fragment.");
}

export const siteOrigin = parsedSiteUrl.origin;

export function absoluteSiteUrl(path: string) {
  return new URL(path.replace(/^\//, ""), `${siteOrigin}/`).toString();
}

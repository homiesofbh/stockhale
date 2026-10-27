import type { MetadataRoute } from "next";
import { absoluteSiteUrl } from "@/lib/seo/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/workspace", "/api/"] },
      { userAgent: "Googlebot", allow: "/", disallow: ["/workspace", "/api/"] },
    ],
    sitemap: absoluteSiteUrl("/sitemap.xml"),
  };
}

import type { MetadataRoute } from "next";
import { absoluteSiteUrl } from "@/lib/seo/site-url";
import { workflowPages } from "@/lib/seo/workflow-content";

const publicRoutes = [
  "",
  "/about-us",
  "/contact-us",
  "/how-to-use",
  "/inventory-management",
  "/billing-inventory",
  "/guides",
  "/templates",
  ...workflowPages.map(page => page.path),
  "/pricing",
  "/privacy-policy",
  "/terms-and-conditions",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route) => ({
    url: absoluteSiteUrl(route),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/inventory-management" || route === "/billing-inventory" ? 0.8 : 0.6,
  }));
}

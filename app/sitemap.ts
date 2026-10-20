import type { MetadataRoute } from "next";

const publicRoutes = [
  "",
  "/about-us",
  "/contact-us",
  "/how-to-use",
  "/pricing",
  "/privacy-policy",
  "/terms-and-conditions",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route) => ({
    url: `https://stockhale.app${route}`,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.6,
  }));
}

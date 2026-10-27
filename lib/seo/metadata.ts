import type { Metadata } from "next";
import { absoluteSiteUrl } from "./site-url";

type SeoPage = {
  title: string;
  description: string;
  path: string;
  imageAlt?: string;
};

export function createSeoMetadata({ title, description, path, imageAlt = "StockHale retail workspace" }: SeoPage): Metadata {
  const canonical = absoluteSiteUrl(path);
  const image = absoluteSiteUrl("/help-ledger-guide.png");

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "StockHale",
      type: "website",
      images: [{ url: image, width: 1408, height: 768, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: image, alt: imageAlt }],
    },
  };
}

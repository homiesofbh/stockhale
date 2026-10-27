import { headers } from "next/headers";
import { MarketingFrame } from "@/components/stockwell/landing-page";
import { PricingSection } from "@/components/stockwell/pricing-section";
import { PageStructuredData } from "@/components/seo/structured-data";
import { createSeoMetadata } from "@/lib/seo/metadata";

const seo = { path: "/pricing", title: "StockHale Pricing: Plans and 72-Hour Trial", description: "Compare StockHale plans, regional monthly and annual prices, and included tools. Try StockHale for 72 hours with no card required." };
export const metadata = createSeoMetadata(seo);

export const dynamic = "force-dynamic";

export default async function Page() {
  const h = await headers();
  const country = (h.get("cf-ipcountry") || h.get("x-vercel-ip-country") || "US").toUpperCase();
  return <><PageStructuredData {...seo}/><MarketingFrame><main><PricingSection country={country}/></main></MarketingFrame></>;
}

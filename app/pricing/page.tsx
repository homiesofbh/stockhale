import { headers } from "next/headers";
import { MarketingFrame } from "@/components/stockwell/landing-page";
import { PricingSection } from "@/components/stockwell/pricing-section";

export const metadata = { title: "StockHale Pricing [Plans & 3-Day Trial]", description: "Compare StockHale’s three retail plans, regional monthly and annual prices, included tools, and 72-hour trial with no card required.", alternates: { canonical: "/pricing" } };

export const dynamic = "force-dynamic";

export default async function Page() {
  const h = await headers();
  const country = (h.get("cf-ipcountry") || h.get("x-vercel-ip-country") || "US").toUpperCase();
  return <MarketingFrame><main><PricingSection country={country}/></main></MarketingFrame>;
}

import { headers } from "next/headers";
import { MarketingFrame } from "@/components/stockwell/landing-page";
import { PricingSection } from "@/components/stockwell/pricing-section";

export const metadata = { title: "Plans & Pricing | StockHale", description: "Explore StockHale plans for independent retailers and find the right tools for inventory, billing, accounts, and reporting.", alternates: { canonical: "/pricing" } };

export const dynamic = "force-dynamic";

export default async function Page() {
  const h = await headers();
  const country = (h.get("cf-ipcountry") || h.get("x-vercel-ip-country") || "US").toUpperCase();
  return <MarketingFrame><main><PricingSection country={country}/></main></MarketingFrame>;
}

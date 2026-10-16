import { headers } from "next/headers";
import { MarketingFrame } from "@/components/stockwell/landing-page";
import { PricingSection } from "@/components/stockwell/pricing-section";

export const dynamic = "force-dynamic";

export default async function Page() {
  const h = await headers();
  const country = (h.get("cf-ipcountry") || h.get("x-vercel-ip-country") || "US").toUpperCase();
  return <MarketingFrame><main><PricingSection country={country}/></main></MarketingFrame>;
}

import { LandingPage } from "@/components/stockwell/landing-page";
import { createSeoMetadata } from "@/lib/seo/metadata";
import { headers } from "next/headers";
import {
  PageStructuredData,
  SoftwareApplicationStructuredData,
} from "@/components/seo/structured-data";

const seo = {
  path: "/",
  title: "Retail Inventory Software for Independent Stores | StockHale",
  description:
    "Bring stock, purchases, billing, accounts, and reports together in one workspace built for independent retail. See how StockHale fits your store.",
};

export const metadata = createSeoMetadata(seo);

export default async function Page() {
  const h = await headers();
  const country = (h.get("cf-ipcountry") || h.get("x-vercel-ip-country") || "US").toUpperCase();
  return (
    <>
      <PageStructuredData {...seo} />
      <SoftwareApplicationStructuredData description={seo.description} />
      <LandingPage country={country} />
    </>
  );
}

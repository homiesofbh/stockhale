import { LandingPage } from "@/components/stockwell/landing-page";
import { headers } from "next/headers";

const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "StockHale",
  url: "https://stockhale.app",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Manage retail inventory, purchases, billing, accounts, and reports in one workspace built for independent stores.",
};

export default async function Page() {
  const h = await headers();
  const country = (h.get("cf-ipcountry") || h.get("x-vercel-ip-country") || "US").toUpperCase();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <LandingPage country={country} />
    </>
  );
}

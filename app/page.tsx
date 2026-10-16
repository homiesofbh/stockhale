import { LandingPage } from "@/components/stockwell/landing-page";
import { headers } from "next/headers";

export default async function Page() {
  const h = await headers();
  const country = (h.get("cf-ipcountry") || h.get("x-vercel-ip-country") || "US").toUpperCase();
  return <LandingPage country={country} />;
}

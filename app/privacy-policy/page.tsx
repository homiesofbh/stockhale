import { InfoPage } from "@/components/stockwell/landing-page";
import { PageStructuredData } from "@/components/seo/structured-data";
import { createSeoMetadata } from "@/lib/seo/metadata";

const seo = { path: "/privacy-policy", title: "StockHale Privacy Policy | Data Use & Choices", description: "Read the StockHale Privacy Policy to learn what account and business information we handle, why we use it, and what choices you have." };
export const metadata = createSeoMetadata(seo);
export default function Page() { return <><PageStructuredData {...seo}/><InfoPage type="privacy"/></>; }

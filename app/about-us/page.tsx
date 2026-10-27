import { AboutPage } from "@/components/stockwell/marketing-pages";
import { PageStructuredData } from "@/components/seo/structured-data";
import { createSeoMetadata } from "@/lib/seo/metadata";

const seo = { path: "/about-us", title: "About StockHale: Retail Software for Independent Stores", description: "Learn how StockHale brings inventory, purchases, billing, payments, accounts, and reports together for independent retailers." };
export const metadata = createSeoMetadata(seo);
export default function Page() { return <><PageStructuredData {...seo}/><AboutPage/></>; }

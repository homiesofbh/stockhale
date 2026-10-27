import { InfoPage } from "@/components/stockwell/landing-page";
import { PageStructuredData } from "@/components/seo/structured-data";
import { createSeoMetadata } from "@/lib/seo/metadata";

const seo = { path: "/terms-and-conditions", title: "StockHale Terms & Conditions", description: "Read the StockHale terms for account access, workspace use, paid plans, business records, acceptable use, and ending service." };
export const metadata = createSeoMetadata(seo);
export default function Page() { return <><PageStructuredData {...seo}/><InfoPage type="terms"/></>; }

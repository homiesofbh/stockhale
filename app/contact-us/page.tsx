import { ContactPage } from "@/components/stockwell/marketing-pages";
import { PageStructuredData } from "@/components/seo/structured-data";
import { createSeoMetadata } from "@/lib/seo/metadata";

const seo = { path: "/contact-us", title: "Contact StockHale | Product & Account Help", description: "Contact StockHale about product questions, workspace support, or partnerships. Email hello@stockhale.app; the team usually replies within one business day." };
export const metadata = createSeoMetadata(seo);
export default function Page() { return <><PageStructuredData {...seo}/><ContactPage/></>; }

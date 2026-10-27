import { HowToUsePage } from "@/components/stockwell/how-to-use-page";
import { PageStructuredData } from "@/components/seo/structured-data";
import { createSeoMetadata } from "@/lib/seo/metadata";

const seo = {
  path: "/how-to-use",
  title: "How to Use StockHale: Retail Setup Guide",
  description: "Set up products and contacts, record purchases and bills, track payments, and review stock, balances, and profit in StockHale.",
};
export const metadata = createSeoMetadata(seo);

export default function Page() {
  return <><PageStructuredData {...seo}/><HowToUsePage /></>;
}

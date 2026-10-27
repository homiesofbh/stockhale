import { InventoryOpportunityPage } from "@/components/stockwell/seo-opportunity-pages";
import { PageStructuredData } from "@/components/seo/structured-data";
import { createSeoMetadata } from "@/lib/seo/metadata";

const seo = {
  path: "/inventory-management",
  title: "Retail Inventory Management Software | StockHale",
  description: "Stock management software for small retail shops. Track products, purchases, sales, and stock movements in one workspace for independent stores.",
};

export const metadata = createSeoMetadata(seo);

export default function Page() {
  return <><PageStructuredData {...seo} /><InventoryOpportunityPage /></>;
}

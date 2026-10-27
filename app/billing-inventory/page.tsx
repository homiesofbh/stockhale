import { BillingInventoryOpportunityPage } from "@/components/stockwell/seo-opportunity-pages";
import { PageStructuredData } from "@/components/seo/structured-data";
import { createSeoMetadata } from "@/lib/seo/metadata";

const seo = {
  path: "/billing-inventory",
  title: "Retail Billing and Inventory Software | StockHale",
  description: "Create bills, update stock as sales are recorded, and keep customer balances connected in one retail workspace.",
};

export const metadata = createSeoMetadata(seo);

export default function Page() {
  return <><PageStructuredData {...seo} /><BillingInventoryOpportunityPage /></>;
}

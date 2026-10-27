import { WorkflowHub } from "@/components/stockwell/workflow-content-page";
import { PageStructuredData } from "@/components/seo/structured-data";
import { createSeoMetadata } from "@/lib/seo/metadata";

const seo = { path: "/guides", title: "Practical Retail Inventory and Account Guides | StockHale", description: "Practical guides to opening stock, stock counts, customer credit sales, returns, and low-stock reviews with worked examples and StockHale product screens." };
export const metadata = createSeoMetadata(seo);
export default function Page() { return <><PageStructuredData {...seo} /><WorkflowHub /></>; }

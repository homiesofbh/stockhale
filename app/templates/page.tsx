import { WorkflowHub } from "@/components/stockwell/workflow-content-page";
import { PageStructuredData } from "@/components/seo/structured-data";
import { createSeoMetadata } from "@/lib/seo/metadata";

const seo = { path: "/templates", title: "Retail Stocktake Templates and Worksheets | StockHale", description: "Download a retail stocktake spreadsheet with count instructions, quantity-difference formulas, and a filled example. No signup required." };
export const metadata = createSeoMetadata(seo);
export default function Page() { return <><PageStructuredData {...seo} /><WorkflowHub templates /></>; }

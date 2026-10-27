import { WorkflowContentPage } from "@/components/stockwell/workflow-content-page";
import { PageStructuredData } from "@/components/seo/structured-data";
import { workflowPageByPath } from "@/lib/seo/workflow-content";
import { createSeoMetadata } from "@/lib/seo/metadata";

const page = workflowPageByPath("/guides/returns-damaged-stock")!;
export const metadata = createSeoMetadata(page);

export default function Page() {
  return <><PageStructuredData {...page} /><WorkflowContentPage page={page} /></>;
}

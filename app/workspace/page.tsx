import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@/lib/stockwell/auth";
import { withDatabase } from "@/lib/stockwell/database";
import { WorkspaceApp } from "@/components/stockwell/workspace-app";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await withDatabase(async () =>
    getAuth().api.getSession({
      headers: await headers(),
      query: { disableCookieCache: true },
    }),
  );
  if (!session) redirect("/sign-in");
  return <WorkspaceApp />;
}

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@/lib/stockwell/auth";
import { withDatabase } from "@/lib/stockwell/database";
import { AdminPage } from "@/components/stockwell/admin-page";

export const metadata = { title: "Administration | StockHale", description: "Manage StockHale accounts, plans, and activity.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
const PLATFORM_ADMIN_EMAIL = "homiesbridge@gmail.com";

export default async function Page() {
  const session = await withDatabase(async () =>
    getAuth().api.getSession({ headers: await headers(), query: { disableCookieCache: true } }),
  );
  if (!session) redirect("/sign-in");
  if (session.user.email.trim().toLowerCase() !== PLATFORM_ADMIN_EMAIL) redirect("/workspace");
  return <AdminPage />;
}

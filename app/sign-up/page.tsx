import { AuthPage } from "@/components/stockwell/auth-page";
export const metadata = { title: "Create your StockHale account", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function Page() {
  return <AuthPage signup />;
}

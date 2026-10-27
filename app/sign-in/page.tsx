import { AuthPage } from "@/components/stockwell/auth-page";
export const metadata = { title: "Sign in | StockHale", description: "Sign in to access your StockHale workspace.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function Page() {
  return <AuthPage />;
}

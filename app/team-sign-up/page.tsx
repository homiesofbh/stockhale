import { AuthPage } from "@/components/stockwell/auth-page";
export const metadata = { title: "Join a StockHale workspace", robots: { index: false, follow: false } };

export default function Page() {
  return <AuthPage signup team />;
}

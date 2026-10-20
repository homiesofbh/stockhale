import { ResetPasswordPageClient } from "@/components/stockwell/password-reset-page-client";

export const metadata = { title: "Choose a new password | StockHale", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function Page() {
  return <ResetPasswordPageClient />;
}

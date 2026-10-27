import { ResetPasswordPageClient } from "@/components/stockwell/password-reset-page-client";

export const metadata = { title: "Choose a new password | StockHale", description: "Set a new password for your StockHale account.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function Page() {
  return <ResetPasswordPageClient />;
}

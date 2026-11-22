import { ForgotPasswordPageClient } from "@/components/stockwell/password-reset-page-client";

export const metadata = { title: "Reset your password | StockHale", description: "Request a password reset link for your StockHale account.", robots: { index: false, follow: false } };
export default function Page() {
  return <ForgotPasswordPageClient />;
}

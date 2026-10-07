import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StockHale | Retail Inventory & Operations",
  description:
    "StockHale retail inventory, purchasing, billing, sales, accounts, and reporting.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

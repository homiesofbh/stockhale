import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stockwell | Retail Inventory & Operations",
  description:
    "Stockwell retail inventory, purchasing, billing, sales, accounts, and reporting.",
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

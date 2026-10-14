import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://stockhale.app"),
  applicationName: "StockHale",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
  openGraph: {
    title: "StockHale | Retail Inventory & Operations",
    description: "Retail inventory, purchasing, billing, sales, accounts, and reporting.",
    url: "https://stockhale.app",
    siteName: "StockHale",
    type: "website",
  },
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

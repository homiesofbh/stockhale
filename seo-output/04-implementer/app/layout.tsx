import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://stockhale.app"),
  applicationName: "StockHale",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
  openGraph: {
    title: "Retail Inventory Software | StockHale",
    description:
      "Manage retail inventory, purchases, billing, accounts, and reports in one workspace built for independent stores.",
    url: "https://stockhale.app",
    siteName: "StockHale",
    type: "website",
  },
  title: "Retail Inventory Software | StockHale",
  description:
    "Manage retail inventory, purchases, billing, accounts, and reports in one workspace built for independent stores.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
      <Script id="google-analytics" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
window.gtag = function gtag(){window.dataLayer.push(arguments);};
window.gtag('js', new Date());
window.gtag('config', 'G-T8WGEJ1R5D');
var gtagScript = document.createElement('script');
gtagScript.async = true;
gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-T8WGEJ1R5D';
document.head.appendChild(gtagScript);`}
      </Script>
      <Script id="microsoft-clarity" strategy="afterInteractive">
        {`(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments);};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "z0mggp56au");`}
      </Script>
    </html>
  );
}

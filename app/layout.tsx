import type { Metadata } from "next";
import Script from "next/script";
import { preconnect } from "react-dom";
import { SiteStructuredData } from "@/components/seo/structured-data";
import { siteOrigin } from "@/lib/seo/site-url";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  applicationName: "StockHale",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
  title: "StockHale",
  description:
    "Retail inventory, purchases, billing, accounts, and reports for independent stores.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  preconnect("https://images.unsplash.com", { crossOrigin: "anonymous" });
  return (
    <html lang="en">
      <body>
        <SiteStructuredData />
        {children}
      </body>
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

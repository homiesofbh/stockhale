import { absoluteSiteUrl } from "@/lib/seo/site-url";

const organizationId = absoluteSiteUrl("/#organization");
const websiteId = absoluteSiteUrl("/#website");

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function SiteStructuredData() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": organizationId,
            name: "Bridge Homies",
            url: "https://bridgehomies.com",
          },
          {
            "@type": "WebSite",
            "@id": websiteId,
            url: absoluteSiteUrl("/"),
            name: "StockHale",
            publisher: { "@id": organizationId },
          },
        ],
      }}
    />
  );
}

export function PageStructuredData({
  path,
  title,
  description,
}: {
  path: string;
  title: string;
  description: string;
}) {
  const url = absoluteSiteUrl(path);
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: title,
        description,
        isPartOf: { "@id": websiteId },
      }}
    />
  );
}

export function SoftwareApplicationStructuredData({ description }: { description: string }) {
  const url = absoluteSiteUrl("/");
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "@id": `${url}#software`,
        name: "StockHale",
        url,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description,
        provider: { "@id": organizationId },
      }}
    />
  );
}

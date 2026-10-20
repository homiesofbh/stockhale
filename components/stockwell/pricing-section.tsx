import Link from "next/link";
import { Check } from "lucide-react";

const plans = [
  { name: "Starter", pk: "PKR 999", usd: "$12", annualPk: "PKR 9,990", annualUsd: "$120", detail: "For a shop getting organized." },
  { name: "Growth", pk: "PKR 2,499", usd: "$29", annualPk: "PKR 24,990", annualUsd: "$290", detail: "For a busy shop and growing team.", popular: true },
  { name: "Business", pk: "PKR 5,999", usd: "$69", annualPk: "PKR 59,990", annualUsd: "$690", detail: "For a larger retail operation." },
];

export function PricingSection({ compact = false, country = "PK" }: { compact?: boolean; country?: string }) {
  const pakistan = country === "PK";
  return <section className={`pricing-section${compact ? " pricing-compact" : ""}`} id="pricing">
    <div className="pricing-heading">{compact ? <span className="section-eyebrow">SIMPLE, REGIONAL PRICING</span> : <><span className="section-eyebrow">SIMPLE, REGIONAL PRICING</span><h1>StockHale plans for your store</h1></>}<h2>Three days to try.<br/><em>Then choose what fits.</em></h2><p>Full access for 72 hours. No card required. Your country determines the currency shown.</p></div>
    <div className="pricing-grid">{plans.map(plan => <article className={`pricing-card${plan.popular ? " pricing-popular" : ""}`} key={plan.name}>
      {plan.popular && <span className="pricing-badge">MOST POPULAR</span>}<span className="pricing-name">{plan.name}</span><p>{plan.detail}</p>
      <strong className="pricing-price">{pakistan ? plan.pk : plan.usd}<small> / month</small></strong>
      <span className="pricing-annual">{pakistan ? plan.annualPk : plan.annualUsd} billed yearly · save about 17%</span>
      <ul><li><Check size={15}/>One shared business workspace</li><li><Check size={15}/>Team access &amp; permissions</li><li><Check size={15}/>Inventory, billing, accounts &amp; reports</li><li><Check size={15}/>Excel export &amp; weekly backups</li><li><Check size={15}/>Offline edits for loaded workspaces</li></ul>
      <Link className="pricing-action" href="/sign-up">Start 3-day trial</Link>
    </article>)}</div>
    <p className="pricing-footnote">Each plan currently covers one business workspace. Enterprise needs? <Link href="/contact-us">Talk to our team</Link>. Taxes, if applicable, are confirmed before payment. Subscription activation is currently arranged by contacting our team.</p>
  </section>;
}

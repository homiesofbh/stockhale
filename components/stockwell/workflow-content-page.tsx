import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Download } from "lucide-react";
import { MarketingFrame } from "./landing-page";
import { workflowPages, type WorkflowPageContent } from "@/lib/seo/workflow-content";
import { absoluteSiteUrl } from "@/lib/seo/site-url";

export function WorkflowContentPage({ page }: { page: WorkflowPageContent }) {
  const isGuide = page.kind === "Guide";
  const root = page.kind === "Template" ? "/templates" : isGuide ? "/guides" : "/";
  const rootLabel = page.kind === "Template" ? "Templates" : isGuide ? "Retail guides" : "Home";
  const fallbackLabels: Record<string, string> = { "/inventory-management": "Retail inventory management", "/billing-inventory": "Billing connected to inventory", "/how-to-use": "StockHale setup guide" };
  const related = page.related.map(path => ({ path, label: workflowPages.find(item => item.path === path)?.title.split(" | ")[0] || fallbackLabels[path] || path }));
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: rootLabel, item: absoluteSiteUrl(root) },
        { "@type": "ListItem", position: 2, name: page.heading, item: absoluteSiteUrl(page.path) },
      ] },
      ...(isGuide ? [{ "@type": "TechArticle", "@id": `${absoluteSiteUrl(page.path)}#article`, headline: page.heading, description: page.description, mainEntityOfPage: { "@id": `${absoluteSiteUrl(page.path)}#webpage` }, image: absoluteSiteUrl(`/guides/images/${page.image.name}.png`), author: { "@type": "Organization", name: "StockHale", url: absoluteSiteUrl("/") }, publisher: { "@id": absoluteSiteUrl("/#organization") } }] : []),
    ],
  };
  return <MarketingFrame><main className="workflow-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
    <header className="workflow-hero"><Link className="workflow-back" href={root}>← {rootLabel}</Link><span className="section-eyebrow">STOCKHALE / {page.kind.toUpperCase()}</span><h1>{page.heading}</h1><p>{page.intro}</p><div className="workflow-hero-actions">{page.kind === "Template" ? <a className="marketing-cta" href="/downloads/stockhale-stocktake.xlsx" download>Download the stocktake workbook <Download size={17} /></a> : <Link className="marketing-cta" href="/sign-up">Try it in your workspace <ArrowUpRight size={17} /></Link>}<a className="workflow-inline-link" href="#workflow-steps">Follow the steps <ArrowRight size={15} /></a></div>{page.kind === "Template" && <p className="workflow-download-note">XLSX · 50 prepared rows · Worked example included · No signup required</p>}</header>
    <div className="workflow-layout"><aside className="workflow-toc"><span className="section-eyebrow">ON THIS PAGE</span><a href="#workflow-answer">The main question</a><a href="#workflow-steps">Step by step</a><a href="#workflow-example">Worked example</a><a href="#workflow-screen">Product view</a><a href="#workflow-checks">Before you finish</a><a href="#workflow-questions">Questions</a></aside><div className="workflow-body">
      <section id="workflow-answer" className="workflow-answer"><h2>{page.question}</h2><p>{page.answer}</p></section>
      <section id="workflow-steps"><span className="section-eyebrow">A PRACTICAL WORKFLOW</span><h2>{isGuide ? "Step by step" : "How the workflow fits together"}</h2><ol className="workflow-step-list">{page.steps.map((step, index) => <li key={step.title}><span className="workflow-step-number">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></li>)}</ol></section>
      <section id="workflow-example" className="workflow-example"><span className="section-eyebrow">WORKED EXAMPLE / SAMPLE DATA</span><h2>{page.example.title}</h2><p>{page.example.description}</p><div className="workflow-table-wrap"><table><thead><tr>{page.example.headers.map(header => <th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>{page.example.rows.map((row, index) => <tr key={index}>{row.map((value, col) => col === 0 ? <th scope="row" key={col}>{value}</th> : <td key={col}>{value}</td>)}</tr>)}</tbody></table></div></section>
      <section id="workflow-screen"><span className="section-eyebrow">INSIDE THE PRODUCT</span><h2>{page.kind === "Template" ? "Review the resulting stock record" : "See the product workflow"}</h2><figure className="workflow-figure"><a href={`/guides/images/${page.image.name}.png`} target="_blank" rel="noopener noreferrer" aria-label={`Open full-size image: ${page.image.alt}`}><Image src={`/guides/images/${page.image.name}.png`} alt={page.image.alt} width={1280} height={900} sizes="(max-width: 800px) 100vw, 850px" /></a><figcaption>{page.image.caption} Select the image to open it at full size.</figcaption></figure></section>
      <section id="workflow-checks" className="workflow-checks"><span className="section-eyebrow">BEFORE YOU FINISH</span><h2>Check the details that matter.</h2><ul>{page.checks.map(check => <li key={check}><Check size={16} aria-hidden="true" /><span>{check}</span></li>)}</ul></section>
      <section id="workflow-questions"><span className="section-eyebrow">COMMON QUESTIONS</span><h2>A few useful distinctions.</h2><div className="workflow-questions">{page.questions.map(question => <details key={question.question}><summary>{question.question}</summary><p>{question.answer}</p></details>)}</div></section>
      <section className="workflow-next"><h2>Continue with the next part of the record.</h2><div>{related.map(item => <Link key={item.path} href={item.path}>{item.label}<ArrowRight size={16} /></Link>)}</div><Link className="workflow-inline-link" href="/pricing">Review StockHale plans and the 72-hour trial <ArrowUpRight size={16} /></Link></section>
    </div></div>
  </main></MarketingFrame>;
}

export function WorkflowHub({ templates = false }: { templates?: boolean }) {
  const pages = workflowPages.filter(page => templates ? page.kind === "Template" : page.kind === "Guide");
  return <MarketingFrame><main className="workflow-page"><header className="workflow-hero"><span className="section-eyebrow">PRACTICAL RETAIL RESOURCES</span><h1>{templates ? "Useful sheets for the shop’s daily work." : "Retail guides, grounded in the daily record."}</h1><p>{templates ? "Download a stock count workbook with clear instructions and a worked example. Review your counts before making changes to inventory." : "Work through opening stock, physical counts, credit sales, returns, and low-stock reviews with labelled examples and actual StockHale product views."}</p></header><section className="workflow-hub-grid" aria-label={templates ? "Downloadable templates" : "Retail workflow guides"}>{pages.map(page => <Link href={page.path} key={page.path}><span className="section-eyebrow">{page.kind.toUpperCase()}</span><h2>{page.heading}</h2><p>{page.description}</p><span className="workflow-hub-read">{templates ? "Get the template" : "Read the guide"}<ArrowRight size={17} /></span></Link>)}</section><section className="workflow-hub-commercial"><h2>Explore the connected workspace.</h2><Link href="/customer-supplier-accounts">Customer and supplier accounts <ArrowRight size={16} /></Link><Link href="/daily-cash-closing">Daily cash closing <ArrowRight size={16} /></Link><Link href={templates ? "/guides" : "/templates"}>{templates ? "Browse the guides" : "Download a stocktake sheet"}<ArrowRight size={16} /></Link></section></main></MarketingFrame>;
}

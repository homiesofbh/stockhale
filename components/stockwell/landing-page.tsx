import Link from "next/link";
import { StockArt } from "./stock-art";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Check,
  CircleDollarSign,
  Store,
  Shirt,
  ShoppingBasket,
  Wrench,
  PackageCheck,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { MarketingHeader } from "./marketing-header";
import { MarketingFooter } from "./marketing-footer";

export function MarketingFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing-shell">
      <MarketingHeader />
      {children}
      <MarketingFooter />
    </div>
  );
}

const HERO_BARS = [32, 58, 43, 70, 51, 82, 65, 94, 76, 100];

const HERO_POINTS = [
  "Inventory & sales",
  "Accounts & reports",
  "Your team, connected",
];

const HERO_KPIS = [
  { label: "Offline workspace", value: "Keep recording", note: "Previously loaded workspaces can edit offline", trend: false },
  { label: "Changes", value: "Saved on device", note: "Queued and synced when you reconnect", trend: false },
  { label: "For setup", value: "Connect once", note: "Sign-in and team changes need internet", trend: false },
];

function Hero() {
  return (
    <section className="hx" aria-labelledby="hx-title">
      <div className="hx-copy">
        <span className="hx-label">
          <span className="live-dot" /> YOUR STORE. IN GOOD ORDER.
        </span>
        <h1 id="hx-title">
          Your whole store.
          <br />
          <em>One clear view.</em>
        </h1>
        <p className="hx-lead">
          From the first delivery to the last sale, bring your stock, billing,
          and accounts together in a workspace that feels familiar.
        </p>
        <div className="hx-actions">
          <Link className="hx-cta" href="/sign-up">
            Create your workspace <ArrowUpRight size={18} />
          </Link>
          <Link className="hero-secondary" href="#features">
            Explore the platform <ArrowDown size={16} />
          </Link>
        </div>
        <ul className="hx-points">
          {HERO_POINTS.map((point) => (
            <li key={point}>
              <Check size={14} /> {point}
            </li>
          ))}
        </ul>
      </div>

      <div
        className="hx-stage"
        aria-label="Illustrative StockHale product interface"
      >
        <div className="hx-board">
          <div className="hx-board-top">
            <span className="hx-workspace">
              <span className="brand-mark">
                <span>S</span>
              </span>
              YOUR WORKSPACE
            </span>
            <span className="hx-tag">SAMPLE DATA</span>
          </div>

          <div className="hx-kpis">
            {HERO_KPIS.map((kpi) => (
              <div className="hx-kpi" key={kpi.label}>
                <span>{kpi.label}</span>
                <strong>{kpi.value}</strong>
                <small>
                  {kpi.trend && <TrendingUp size={12} />} {kpi.note}
                </small>
              </div>
            ))}
          </div>

          <div className="hx-grid">
            <div className="hx-feature">
              <StockArt />
              <div className="hx-feature-copy">
                <span>INVENTORY, SORTED</span>
                <h3>
                  A place for
                  <br />
                  every product.
                </h3>
                <p>Know what’s in. See what’s moving.</p>
              </div>
              <ArrowUpRight className="hx-feature-arrow" size={20} />
            </div>

            <div className="hx-chart">
              <div className="hx-chart-head">
                <span>Sales overview</span>
                <BarChart3 size={14} />
              </div>
              <div className="hx-bars">
                {HERO_BARS.map((height, index) => (
                  <i key={index} style={{ height: `${height}%` }} />
                ))}
              </div>
              <span className="hx-chart-caption">
                A clearer picture of your everyday.
              </span>
            </div>
          </div>
        </div>

        <div
          className="hx-photo"
          role="img"
          aria-label="Clothing and accessories displayed in an independent retail shop"
        >
          <span>
            Made for the
            <br />
            way you work.
          </span>
        </div>

        <div className="hx-sync">
          <span>
            <Check size={16} />
          </span>
          <div>
        <strong>Changes sync when you’re online.</strong>
            <small>More time for what’s next.</small>
          </div>
          <Sparkles size={17} />
        </div>
      </div>

      <div className="hx-foot">
        <span>BUILT FOR INDEPENDENT RETAIL</span>
        <span>
          Stock. Sales. Accounts. Together. <ArrowDown size={14} />
        </span>
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <MarketingFrame>
      <main>
        <Hero />
        <section className="ticker" aria-label="StockHale capabilities">
          <div className="ticker-track">
            {[0, 1].map((n) => (
              <span key={n}>
                <i /> STOCK <b>IN CONTROL</b>
                <i /> SALES <b>IN FLOW</b>
                <i /> YOUR NUMBERS <b>IN REACH</b>
                <i /> MORE TIME <b>TO GROW</b>
                <i /> STOCK <b>IN CONTROL</b>
                <i /> SALES <b>IN FLOW</b>
              </span>
            ))}
          </div>
        </section>
        <section className="features-section" id="features">
          <div className="section-heading">
            <div>
              <span className="section-eyebrow">
                THE WHOLE PICTURE, FINALLY
              </span>
              <h2>
                Less juggling.
                <br />
                <em>More running your store.</em>
              </h2>
            </div>
            <p>
              One connected workspace for the moving parts of retail. Made to
              feel intuitive from the first open to the last sale of the day.
            </p>
          </div>
          <div className="feature-grid">
            <article className="feature-card feature-inventory">
              <div className="feature-card-top">
                <span>01 / INVENTORY</span>
                <Boxes size={19} />
              </div>
              <h3>
                Know what’s
                <br />
                on your shelves.
              </h3>
              <p>
                Track every item, variation, and movement without the
                spreadsheet shuffle.
              </p>
              <div className="inventory-visual">
                <div className="inventory-row">
                  <span className="product-thumb amber">
                    <PackageCheck size={17} />
                  </span>
                  <span>
                    <b>Everyday tote</b>
                    <small>Accessories · SKU 0841</small>
                  </span>
                  <span className="inventory-count">
                    24 <small>in stock</small>
                  </span>
                </div>
                <div className="inventory-row">
                  <span className="product-thumb lavender">
                    <PackageCheck size={17} />
                  </span>
                  <span>
                    <b>Classic linen shirt</b>
                    <small>Apparel · SKU 1206</small>
                  </span>
                  <span className="inventory-count">
                    08 <small>in stock</small>
                  </span>
                </div>
                <div className="inventory-row">
                  <span className="product-thumb sage">
                    <PackageCheck size={17} />
                  </span>
                  <span>
                    <b>Studio mug · 12oz</b>
                    <small>Home · SKU 0369</small>
                  </span>
                  <span className="inventory-count">
                    42 <small>in stock</small>
                  </span>
                </div>
              </div>
            </article>
            <article className="feature-card feature-sales">
              <div className="feature-card-top">
                <span>02 / SALES</span>
                <CircleDollarSign size={19} />
              </div>
              <h3>
                Every sale,
                <br />a little simpler.
              </h3>
              <p>
                Keep checkout quick and every transaction connected to the
                bigger picture.
              </p>
              <div className="sales-visual">
                <div className="sales-chart-header">
                  <span>This week</span>
                  <b>
                    Rs 326,800 <small>↑ 12.8%</small>
                  </b>
                </div>
                <div className="sales-chart">
                  <i style={{ height: "34%" }} />
                  <i style={{ height: "51%" }} />
                  <i style={{ height: "43%" }} />
                  <i style={{ height: "68%" }} />
                  <i style={{ height: "55%" }} />
                  <i style={{ height: "83%" }} />
                  <i style={{ height: "72%" }} />
                  <i style={{ height: "100%" }} />
                </div>
                <div className="chart-days">
                  <span>MON</span>
                  <span>TUE</span>
                  <span>WED</span>
                  <span>THU</span>
                  <span>FRI</span>
                  <span>SAT</span>
                  <span>SUN</span>
                  <span>TODAY</span>
                </div>
              </div>
            </article>
            <article className="feature-card feature-insight">
              <div className="feature-card-top">
                <span>03 / INSIGHT</span>
                <BarChart3 size={19} />
              </div>
              <h3>
                Trust the numbers.
                <br />
                Move with confidence.
              </h3>
              <p>Sales, expenses, and accounts that tell one clear story.</p>
              <div className="insight-visual">
                <div className="insight-badge">
                  <TrendingUp size={16} />
                  <span>Looking good</span>
                </div>
                <div className="insight-stat">
                  <span>Gross margin</span>
                  <b>32.6%</b>
                  <small>
                    <span className="live-dot" /> Healthy this month
                  </small>
                </div>
                <div className="insight-line">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </article>
          </div>
        </section>
        <section
          className="audience-section"
          id="who-its-for"
          aria-labelledby="audience-heading"
        >
          <div className="section-heading">
            <div>
              <span className="section-eyebrow">WHO IT’S FOR</span>
              <h2 id="audience-heading">
                For the shops that
                <br />
                <em>keep life moving.</em>
              </h2>
            </div>
            <p>
              From your first counter to a growing catalog, keep the stock,
              sales, and accounts behind your business together.
            </p>
          </div>
          <div className="audience-grid">
            {[
              {
                icon: ShoppingBasket,
                title: "Everyday retailers",
                text: "Grocery, convenience, and general stores keeping fast-moving shelves stocked.",
                detail: "Stock movements · Daily sales",
              },
              {
                icon: Shirt,
                title: "Fashion & lifestyle",
                text: "Clothing, accessories, and homeware shops managing a changing product range.",
                detail: "Product variations · Inventory",
              },
              {
                icon: Wrench,
                title: "Hardware & supplies",
                text: "Parts, tools, and building supply businesses tracking purchases and customer balances.",
                detail: "Purchasing · Customer accounts",
              },
              {
                icon: Store,
                title: "Owner-led teams",
                text: "Owners and their teams who need one shared place to record work and see how the day adds up.",
                detail: "Team access · Reporting",
              },
            ].map(({ icon: Icon, title, text, detail }, index) => (
              <article className="audience-card" key={title}>
                <div className="audience-card-top">
                  <span className="audience-icon">
                    <Icon size={23} strokeWidth={1.5} />
                  </span>
                  <span>0{index + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="audience-detail">{detail}</span>
              </article>
            ))}
          </div>
        </section>
        <section className="manifesto">
          <div
            className="manifesto-image"
            role="img"
            aria-label="Retail shop owner arranging products on a sunny morning"
          />
          <div className="manifesto-copy">
            <span className="section-eyebrow">BUILT FOR THE REAL WORK</span>
            <h2>Because your store is more than a set of numbers.</h2>
            <p>
              It’s the early starts, familiar faces, and the details only you
              notice. StockHale gives the busywork a better home — so you can
              give your attention to the parts that make it yours.
            </p>
            <Link className="text-link" href="/about-us">
              Get to know us <ArrowRight size={16} />
            </Link>
            <span className="manifesto-mark">s.</span>
          </div>
        </section>
        <section className="proof-section" id="see-it">
          <div className="section-heading">
            <div>
              <span className="section-eyebrow">HOW THE WORKSPACE WORKS</span>
              <h2>See the workbench<br /><em>before you sign up.</em></h2>
            </div>
            <p>Use a previously loaded workspace to keep recording while offline. Changes stay on the device and sync when connectivity returns; first sign-in and team administration require internet.</p>
          </div>
          <div className="offline-flow" aria-label="Offline workspace flow"><div><span>01</span><b>Load your workspace</b><small>Sign in while connected</small></div><ArrowRight /><div><span>02</span><b>Keep recording</b><small>Previously loaded records stay available</small></div><ArrowRight /><div><span>03</span><b>Reconnect to sync</b><small>Queued updates are sent when online</small></div></div>
          <div className="proof-links"><Link href="/how-to-use">Follow a typical workflow <ArrowRight size={15} /></Link><Link href="/sign-up">Open your own workspace <ArrowUpRight size={15} /></Link></div>
        </section>
        <section className="promise-section">
          <div className="promise-left">
            <span className="section-eyebrow">A GOOD DAY, BY DESIGN</span>
            <h2>
              Everything in its place.
              <br />
              <em>Nothing in your way.</em>
            </h2>
            <p>
              Simple enough to pick up today. Thoughtful enough to grow with you
              tomorrow.
            </p>
            <Link className="marketing-cta" href="/sign-up">
              See your store differently <ArrowRight size={16} />
            </Link>
          </div>
          <div className="promise-list">
            <div>
              <span className="promise-number">01</span>
              <span className="promise-icon">
                <ScanLine size={20} />
              </span>
              <span>
                <b>Details that stay connected</b>
                <small>A change in one place makes sense everywhere.</small>
              </span>
              <Check size={17} />
            </div>
            <div>
              <span className="promise-number">02</span>
              <span className="promise-icon">
                <ShieldCheck size={20} />
              </span>
              <span>
                <b>Steady, even on the busy days</b>
                <small>Your team can keep moving with confidence.</small>
              </span>
              <Check size={17} />
            </div>
            <div>
              <span className="promise-number">03</span>
              <span className="promise-icon">
                <TrendingUp size={20} />
              </span>
              <span>
                <b>Clarity that adds up</b>
                <small>See what’s happening. Decide what comes next.</small>
              </span>
              <Check size={17} />
            </div>
          </div>
        </section>
        <section className="comparison-section" id="compare">
          <div className="section-heading">
            <div><span className="section-eyebrow">CHOOSE WITH A CLEAR PICTURE</span><h2>Where StockHale<br /><em>fits your workflow.</em></h2></div>
            <p>A straightforward view of the tools you get here, and what to confirm when comparing other systems.</p>
          </div>
          <div className="comparison-wrap"><table><thead><tr><th scope="col">Capability</th><th scope="col">StockHale</th><th scope="col">Basic spreadsheets</th><th scope="col">POS suites</th></tr></thead><tbody>
            <tr><th scope="row">Stock, purchases & sales records</th><td>Connected workspace</td><td>Manual linking</td><td>Common; confirm plan</td></tr>
            <tr><th scope="row">Accounts, expenses & reports</th><td>Included tools</td><td>Build your own</td><td>Varies by provider</td></tr>
            <tr><th scope="row">Team roles & shared records</th><td>Workspace access</td><td>File permissions</td><td>Common; confirm limits</td></tr>
            <tr><th scope="row">Barcode entry</th><td>Barcode field and scanner input</td><td>Manual setup</td><td>Hardware support varies</td></tr>
            <tr><th scope="row">Offline work</th><td>Loaded workspace can record changes and sync on reconnect</td><td>Local file access</td><td>Confirm with provider</td></tr>
            <tr><th scope="row">External integrations & multiple branches</th><td>Contact us to discuss fit</td><td>Separate setup</td><td>Confirm with provider</td></tr>
          </tbody></table></div>
          <p className="comparison-note">Comparison is a general guide, not a feature audit of a named provider. POS capabilities, integrations, hardware, and pricing depend on each product and plan; verify them directly before choosing.</p>
        </section>
        <section className="closing-cta">
          <div className="closing-orbit orbit-one" />
          <div className="closing-orbit orbit-two" />
          <div className="closing-content">
            <span className="section-eyebrow">
              YOUR NEXT GOOD DAY STARTS HERE
            </span>
            <h2>
              Ready to feel more
              <br />
              <em>on top of things?</em>
            </h2>
            <p>
              Bring the moving parts together. Give your attention back to your
              store.
            </p>
            <Link className="marketing-cta light" href="/sign-up">
              Get started with StockHale <ArrowRight size={16} />
            </Link>
          </div>
          <span className="closing-spark spark-a">✳</span>
          <span className="closing-spark spark-b">✳</span>
        </section>
      </main>
    </MarketingFrame>
  );
}

export function InfoPage({
  type,
}: {
  type: "about" | "contact" | "terms" | "privacy";
}) {
  const data = {
    about: {
      eyebrow: "OUR STORY",
      title: (
        <>
          Retail is personal.
          <br />
          <em>Your tools should be, too.</em>
        </>
      ),
      intro:
        "StockHale exists to make the day-to-day of running a store feel a little more in your hands.",
      body: [
        "We believe independent retailers deserve software that respects the craft of their work. The product, the people, the thousand small decisions — it all matters.",
        "So we bring the important parts together: inventory, sales, accounts, and the details that help a team work as one. Clear by design, useful every day, and ready to grow alongside the business.",
        "We’re building StockHale for the people who open the doors, know their customers, and make their corner of the world a little more interesting.",
      ],
      label: "Made for the people behind the counter.",
    },
    contact: {
      eyebrow: "SAY HELLO",
      title: (
        <>
          Good things start
          <br />
          <em>with a conversation.</em>
        </>
      ),
      intro:
        "Questions about StockHale, getting started, or just want to share what your store needs? We’d love to hear from you.",
      body: [
        "Reach our team at hello@stockhale.app and we’ll get back to you as soon as we can.",
        "For account access or workspace support, include the email address tied to your account so we can point you in the right direction.",
      ],
      label: "We’re here to help your store move forward.",
    },
    terms: {
      eyebrow: "THE IMPORTANT DETAILS",
      title: (
        <>
          Terms &amp;
          <br />
          <em>conditions.</em>
        </>
      ),
      intro:
        "These Terms & Conditions govern access to and use of StockHale. Please read them before creating an account or using a workspace.",
      sections: [
        { title: "1. About these terms", paragraphs: ["In these terms, “StockHale,” “we,” “us,” and “our” refer to the StockHale service and its operators. “You” means the person using the service. If you use StockHale for a business, you confirm that you are authorized to act for that business, and “you” also refers to that business.", "By creating an account, accepting an invitation, or using StockHale, you agree to these terms. If you do not agree, do not use the service. If you use StockHale for an organization, you are responsible for ensuring that its users follow these terms."] },
        { title: "2. The service", paragraphs: ["StockHale provides online tools for retail operations, which may include inventory, purchasing, sales and billing records, contacts, expenses, accounts, reports, team access, file attachments, and data import or export. Features may change as we maintain and develop the service.", "StockHale is an operational record-keeping tool. It is not a bank, payment processor, accounting firm, tax adviser, or legal adviser, and it does not independently verify the information you enter or the reports it produces."] },
        { title: "3. Accounts and team access", paragraphs: ["You must provide accurate account information and keep your sign-in credentials confidential. You are responsible for activity under your account and should promptly tell us if you suspect unauthorized access.", "Workspace owners control invitations, roles, and access to workspace information. Owners are responsible for inviting only people who should have access, assigning appropriate permissions, and removing access when it is no longer needed. Team members must use their own accounts and must not share credentials."] },
        { title: "4. Your information and content", paragraphs: ["You retain your rights to the business records, customer and supplier details, files, and other content you submit to StockHale (“Customer Content”). You give us permission to host, store, transmit, back up, and otherwise process Customer Content only as reasonably needed to operate, secure, support, and improve the service and to meet legal obligations.", "You are responsible for having the rights and permissions needed to enter and use Customer Content, including personal information about customers, suppliers, or staff. You must ensure that your use of that information follows applicable privacy and record-keeping laws. You are also responsible for the accuracy, completeness, and lawful use of your records.", "Keep your own copies of important records. Where available, use StockHale’s export or backup tools and check that exported files are stored securely. The service may not be your only or permanent copy of business records."] },
        { title: "5. Acceptable use", paragraphs: ["You may use StockHale only for lawful business operations and in line with these terms. You must not use it to break the law, infringe another person’s rights, upload malicious code, attempt unauthorized access, disrupt or probe the service, misuse another person’s account, or use the service to send unsolicited or unlawful communications.", "You must not reverse engineer or interfere with the service except where applicable law permits, or resell or provide access to the service as a standalone service without our written permission. We may restrict or suspend access when reasonably necessary to protect users, the service, or comply with law."] },
        { title: "6. Third-party services and links", paragraphs: ["Some features depend on third-party infrastructure or services, such as database, hosting, file storage, or email providers. Their services may be subject to separate terms and may be unavailable from time to time. We are not responsible for third-party services that we do not control. Links to other sites are provided for convenience and do not mean we endorse them."] },
        { title: "7. Availability, changes, and suspension", paragraphs: ["We aim to keep StockHale useful and available, but we do not guarantee uninterrupted or error-free operation. Maintenance, outages, connectivity problems, security incidents, or events outside our reasonable control may affect access. We may add, change, or discontinue features. Where reasonably practicable, we will give notice of material changes that adversely affect the service.", "We may suspend or limit access where we reasonably believe there is a security risk, a breach of these terms, unlawful use, or a need to protect the service or other users. Where appropriate, we will notify the workspace owner and provide an opportunity to address the issue."] },
        { title: "8. Fees", paragraphs: ["Any fees, plan limits, or payment terms that apply to your use will be shown or agreed separately before they apply. Unless that separate information says otherwise, these terms do not promise a particular price, plan, or feature set."] },
        { title: "9. Ending use", paragraphs: ["You may stop using StockHale at any time. A workspace owner can manage team access and may request account or workspace closure by contacting us. We may end or suspend access as described in these terms or where we stop providing the service.", "Before closing a workspace, export any records you need to keep. After closure, we may delete or de-identify Customer Content within a reasonable period, subject to backups, technical retention cycles, and information we must keep by law. Some data may remain in backup systems until those systems rotate."] },
        { title: "10. Disclaimers", paragraphs: ["To the extent permitted by law, StockHale is provided “as is” and “as available.” We do not warrant that the service will be uninterrupted, that every calculation or report will meet your needs, or that data will never be lost or corrupted. You should review important entries, totals, exports, and reports before relying on them.", "You remain responsible for your business decisions, accounting, taxes, statutory records, customer obligations, and compliance with applicable law. Nothing in these terms excludes a consumer or other right that cannot legally be excluded."] },
        { title: "11. Liability", paragraphs: ["To the extent permitted by law, we are not liable for indirect or consequential loss, loss of profits, revenue, goodwill, business opportunity, or loss of data arising from your use of or inability to use StockHale. Nothing in these terms limits liability where it would be unlawful to do so, including liability for fraud or for death or personal injury caused by negligence.", "Where the law permits a limit, our total liability for claims relating to the service or these terms will not exceed the fees you paid us for StockHale in the twelve months before the event giving rise to the claim. If you use the service without paying fees, our total liability will be limited to the equivalent of USD 100. These limits apply only to the extent permitted by applicable law."] },
        { title: "12. Changes to these terms", paragraphs: ["We may update these terms as the service or law changes. We will update the date below and, when a change is material, take reasonable steps to notify users, such as by posting a notice in the service or on this page. Changes apply from the date stated in the updated terms. Continued use after that date means you accept the updated terms; if you do not agree, stop using the service."] },
        { title: "13. General", paragraphs: ["If a court finds part of these terms unenforceable, the rest remains in effect. A delay in enforcing a term does not waive our right to enforce it later. You may not transfer your rights under these terms without our consent; we may transfer them as part of a reorganization or transfer of the service. These terms and any separately agreed service terms form the agreement between you and us about StockHale.", "These terms are governed by the laws that apply where the StockHale service operator is established, without regard to conflict-of-law rules, except where mandatory consumer protection laws provide otherwise. Courts with jurisdiction there will hear disputes, subject to any mandatory rights you have to bring a claim elsewhere."] },
        { title: "14. Contact", paragraphs: ["Questions about these terms? Email hello@stockhale.app."] },
      ],
      label: "Last updated October 15, 2026.",
    },
    privacy: {
      eyebrow: "YOUR INFORMATION, RESPECTED",
      title: (
        <>
          Privacy
          <br />
          <em>policy.</em>
        </>
      ),
      intro:
        "This policy explains what information StockHale handles, why we use it, and the choices available to you when you use our retail operations service.",
      sections: [
        { title: "1. Who this policy covers", paragraphs: ["This Privacy Policy applies when you visit StockHale’s website, create or use an account, join a workspace, contact us, or otherwise use our service. StockHale is designed for businesses. A workspace owner or employer may control your account and the business information in a workspace; if so, direct requests about that workspace to its owner first.", "For questions about this policy or personal information, contact us at hello@stockhale.app."] },
        { title: "2. Information we collect", paragraphs: ["Account and contact details. We handle information such as your name, email address, password credentials, account identifiers, and messages you send to us. Passwords are handled using authentication safeguards; we do not need to see your plain-text password.", "Workspace and business records. We process the information you or your team choose to store, such as workspace settings, products, stock movements, sales and purchase records, expenses, accounts, customer and supplier details, team membership, and reports.", "Files and attachments. If you upload supporting files, such as purchase or expense documents, we process the file and related details needed to store and associate it with the relevant record.", "Service and device information. Our systems may receive technical information needed to deliver and protect the service, such as IP address, browser and device details, request logs, timestamps, and security events. Your browser may also store essential session or local application data so that sign-in and workspace features work. StockHale does not currently use third-party advertising cookies.", "Support communications. If you contact us, we receive the content of your message and the contact details you provide so we can respond."] },
        { title: "3. How we use information", paragraphs: ["We use information to create and authenticate accounts, provide workspaces and requested features, store and sync business records, enable team access, process file uploads and exports, respond to support requests, send account or security messages, troubleshoot errors, protect the service against fraud or abuse, and meet legal obligations.", "We may use limited service information to understand reliability and improve the product. We do not sell personal information or business records, and we do not use your business records for third-party targeted advertising."] },
        { title: "4. Legal grounds where required", paragraphs: ["Where privacy law requires a legal basis, we process information as needed to perform our agreement with you, pursue legitimate interests such as securing and improving the service and providing support, comply with legal obligations, or with your consent where consent is required. The workspace owner may separately determine why and how workspace business records are used."] },
        { title: "5. How we share information", paragraphs: ["We share information with service providers that help operate StockHale, such as database and hosting providers, file storage providers, and email delivery providers. They may process information on our behalf and are expected to protect it and use it only to provide their services.", "We may disclose information if reasonably necessary to comply with law or valid legal process, protect the rights and safety of users or others, investigate misuse, or support a business transfer or reorganization. We do not sell your personal information or share it with advertisers for cross-context behavioral advertising.", "Workspace owners and people they authorize can access information within that workspace. Please check with your workspace owner about their access and sharing practices."] },
        { title: "6. Storage and international transfers", paragraphs: ["StockHale uses third-party infrastructure to host and store account and workspace information. Depending on provider configuration and where you use the service, information may be processed in countries other than your own. Where required, we take steps intended to support lawful transfers and appropriate protections."] },
        { title: "7. Retention", paragraphs: ["We keep information for as long as needed to provide the service, maintain workspace records, protect security, resolve disputes, and meet legal obligations. Workspace owners control many business records and should export records they need to retain. When an account or workspace is closed, we delete or de-identify information within a reasonable period, subject to legal retention duties, security needs, and backup rotation cycles."] },
        { title: "8. Security", paragraphs: ["We use technical and organizational measures intended to protect information, including account authentication and access controls. No online service or storage method is completely secure. You can help protect your workspace by using a unique password, keeping credentials private, reviewing team access, and keeping secure copies of important records."] },
        { title: "9. Your choices and rights", paragraphs: ["You can keep account information accurate and, where available, manage workspace details, team access, and business records through StockHale. You may ask us for help accessing, correcting, deleting, or obtaining information associated with your account by emailing hello@stockhale.app. We may need to verify your identity or refer a workspace request to its owner.", "Depending on where you live, privacy law may give you rights to access, correct, delete, restrict, object to, or receive a copy of personal information, or to withdraw consent. You may also have the right to complain to your local privacy regulator. These rights are subject to applicable exceptions and legal requirements."] },
        { title: "10. Children", paragraphs: ["StockHale is a business service and is not intended for children. We do not knowingly collect personal information from children in a way that is prohibited by applicable law. Contact us if you believe a child has provided personal information to us."] },
        { title: "11. Changes to this policy", paragraphs: ["We may update this policy when our service or practices change. We will revise the date below and take reasonable steps to notify users about material changes. The updated policy applies from its stated effective date."] },
        { title: "12. Contact", paragraphs: ["For privacy questions or requests, email hello@stockhale.app."] },
      ],
      label: "Last updated October 15, 2026.",
    },
  }[type];
  return (
    <MarketingFrame>
      <main className="info-page">
        <div className="info-hero">
          <div className="hero-kicker">
            <span className="kicker-line" />
            {data.eyebrow}
          </div>
          <h1>{data.title}</h1>
          <p>{data.intro}</p>
          <div className="info-side-note">
            <span className="live-dot" /> STOCKHALE / {type.toUpperCase()}
          </div>
        </div>
        <div className="info-body">
          <div className="info-body-aside">
            <span>IN GOOD ORDER</span>
            <span className="aside-rule" />
            <span className="info-aside-mark">s.</span>
          </div>
          <div className="info-copy">
            {data.sections ? data.sections.map((section) => (
              <section className="legal-section" key={section.title}>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </section>
            )) : data.body.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
            <div className="info-note">
              <Sparkles size={17} />
              <span>{data.label}</span>
            </div>
            {type === "contact" && (
              <Link className="marketing-cta" href="mailto:hello@stockhale.app">
                Email our team <ArrowUpRight size={16} />
              </Link>
            )}
          </div>
        </div>
        <div className="info-back">
          <Link className="text-link" href="/">
            Back to StockHale <ArrowRight size={16} />
          </Link>
        </div>
      </main>
    </MarketingFrame>
  );
}

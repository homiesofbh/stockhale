import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpLeft,
  ArrowUpRight,
  Barcode,
  Boxes,
  Check,
  CircleDollarSign,
  FileText,
  PackageCheck,
  RotateCcw,
  ScanLine,
  Truck,
} from "lucide-react";
import { MarketingFrame } from "./landing-page";

const inventoryRecords = [
  { sku: "SKU 0841", name: "Everyday tote", detail: "Accessories · 24 pieces", tone: "amber" },
  { sku: "SKU 1206", name: "Classic linen shirt", detail: "Apparel · 8 pieces", tone: "lilac" },
  { sku: "SKU 0369", name: "Studio mug · 12oz", detail: "Home · 42 pieces", tone: "sage" },
];

export function InventoryOpportunityPage() {
  return (
    <MarketingFrame>
      <main className="opportunity-page inventory-opportunity">
        <section className="opportunity-hero">
          <div className="opportunity-hero-copy">
            <span className="section-eyebrow"><Boxes size={14} /> RETAIL INVENTORY MANAGEMENT</span>
            <h1>Keep retail stock<br /><em>in one clear view.</em></h1>
            <p>StockHale is stock management software for small retail shops. Keep product details, purchases, current stock, and sales activity together, so the record follows each item from delivery to bill.</p>
            <div className="opportunity-actions">
              <Link className="marketing-cta" href="/sign-up">Create your workspace <ArrowUpRight size={17} /></Link>
              <Link className="opportunity-text-link" href="/how-to-use">See the setup guide <ArrowRight size={15} /></Link>
            </div>
          </div>
          <div className="inventory-board" aria-label="Illustrative inventory list with sample data">
            <div className="inventory-board-head"><div><span className="inventory-board-mark"><Boxes size={16} /></span><div><b>Inventory</b><small>YOUR WORKSPACE</small></div></div><span className="sample-tag">SAMPLE VIEW</span></div>
            <div className="inventory-board-summary"><span><small>PRODUCTS</small><b>Catalog at a glance</b></span><span className="inventory-board-indicator"><i /> Stock records</span></div>
            <div className="inventory-board-rows">{inventoryRecords.map((item) => <div className="inventory-board-row" key={item.sku}><span className={`inventory-board-product ${item.tone}`}><PackageCheck size={17} /></span><span className="inventory-board-name"><b>{item.name}</b><small>{item.sku} · {item.detail}</small></span><ArrowUpRight size={15} /></div>)}</div>
            <div className="inventory-board-foot"><Barcode size={15} /><span>Search by product details, SKU, or barcode</span></div>
          </div>
          <div className="opportunity-index"><span>01</span><span>PRODUCT</span><i /><span>STOCK</span><i /><span>SALE</span></div>
        </section>

        <section className="opportunity-intro">
          <span className="opportunity-side-label">A STOCK RECORD THAT CONNECTS</span>
          <div><p className="opportunity-lead">Shop inventory software with purchases and sales should keep each item’s movement easy to follow.</p><p>StockHale brings product details and everyday stock changes into one workspace. Add the items you carry, record what arrives, and create bills as products sell. Posted activity updates stock, while item history helps you review recent purchases, sales, and adjustments.</p></div>
        </section>

        <section className="opportunity-workflow" aria-labelledby="inventory-flow-title">
          <div className="opportunity-section-heading"><span className="section-eyebrow">FROM DELIVERY TO CURRENT STOCK</span><h2 id="inventory-flow-title">Follow the work<br /><em>one movement at a time.</em></h2><p>Use the record that matches what happened. This keeps stock quantity and supplier or customer balances grounded in actual transactions.</p></div>
          <div className="opportunity-steps">
            <article><span className="opportunity-step-icon"><Boxes size={19} /></span><small>01 / SET UP</small><h3>Describe each item</h3><p>Save product names, categories, SKU or barcode, cost and selling prices, units, supplier links, and relevant details such as size, colour, packing, or GSM.</p></article>
            <article><span className="opportunity-step-icon"><Truck size={19} /></span><small>02 / RECEIVE</small><h3>Record purchases</h3><p>Enter the supplier, products, quantities, and costs. Posting a purchase adds stock and records any amount still owed to the supplier.</p></article>
            <article><span className="opportunity-step-icon"><FileText size={19} /></span><small>03 / SELL</small><h3>Post a customer bill</h3><p>Create and post the bill in Billing. Stock is reduced for the products on the bill, and paid or outstanding amounts stay with the sale record.</p></article>
          </div>
        </section>

        <section className="opportunity-detail-grid">
          <article className="opportunity-detail-card"><span className="section-eyebrow">WHEN STOCK NEEDS A CORRECTION</span><h2>Keep adjustments visible.</h2><p>Use a stock adjustment for opening stock that was not entered through a purchase, or to correct a recorded quantity. StockHale keeps the movement, date, reference, and reason with the item’s history.</p><div className="movement-illustration"><span><ArrowDownLeft size={16} /> Purchase posted</span><i /><span><ArrowUpLeft size={16} /> Adjustment recorded</span><i /><span><RotateCcw size={16} /> History reviewed</span></div></article>
          <article className="opportunity-detail-card opportunity-detail-dark"><span className="section-eyebrow">A CLEARER STOCK PICTURE</span><h2>See quantity and recent activity together.</h2><p>Inventory shows current quantities and the low-stock threshold you set. Open a product to review its latest recorded purchase and sale, movement history, stock value, and supplier details.</p><ul className="opportunity-check-list"><li><Check size={15} /> Product-level quantity and value at cost</li><li><Check size={15} /> Low-stock status based on your threshold</li><li><Check size={15} /> Purchase, bill, and adjustment history</li></ul></article>
        </section>

        <section className="inventory-account-flow" aria-labelledby="inventory-accounts-title">
          <div className="inventory-account-copy"><span className="section-eyebrow">RETAIL INVENTORY + STORE ACCOUNTS</span><h2 id="inventory-accounts-title">Retail inventory and accounts, kept connected.</h2><p>For shops looking for inventory software with customer and supplier accounts, StockHale connects inventory with both account ledgers in one workspace. Posted purchases add stock and record any amount still due to a supplier. Posted bills reduce stock and can leave a customer balance. Payments help you review what has been settled and what remains.</p><Link className="opportunity-text-link" href="/customer-supplier-accounts">Explore customer and supplier accounts <ArrowRight size={15} /></Link></div>
          <div className="inventory-account-pairs" aria-label="Illustrative purchase and sales account flows"><article><span>INCOMING STOCK</span><b>Purchase posted</b><small>Stock increases · Supplier balance recorded</small></article><i aria-hidden="true"/><article><span>OUTGOING STOCK</span><b>Customer bill posted</b><small>Stock decreases · Customer balance recorded</small></article></div>
        </section>

        <section className="opportunity-offline"><div><span className="section-eyebrow">WORKSPACE AVAILABILITY</span><h2>Offline stock management for shops, in a previously loaded workspace.</h2><p>After you sign in and load your StockHale workspace while connected, you can continue recording supported changes offline. They stay on the device and sync when the connection returns. First sign-in, account or workspace setup, and team administration require internet access.</p></div><div className="offline-stamp"><ScanLine size={22} /><span>LOAD ONLINE</span><ArrowRight size={14} /><span>RECORD</span><ArrowRight size={14} /><span>SYNC</span></div></section>

        <section className="opportunity-related"><div><span className="section-eyebrow">KEEP EXPLORING</span><h2>Inventory is one part<br /><em>of the shop’s daily flow.</em></h2></div><div className="opportunity-related-links"><Link href="/guides/opening-stock"><span><Boxes size={18} /> Enter opening stock correctly</span><ArrowRight size={17} /></Link><Link href="/guides/retail-stocktake"><span><Check size={18} /> Count and reconcile your stock</span><ArrowRight size={17} /></Link><Link href="/billing-inventory"><span><CircleDollarSign size={18} /> Retail billing connected to stock</span><ArrowRight size={17} /></Link><Link href="/how-to-use"><span><FileText size={18} /> How to set up products and record stock</span><ArrowRight size={17} /></Link><Link href="/pricing"><span><Check size={18} /> Compare plans and the 72-hour trial</span><ArrowRight size={17} /></Link></div></section>
      </main>
    </MarketingFrame>
  );
}

export function BillingInventoryOpportunityPage() {
  return (
    <MarketingFrame>
      <main className="opportunity-page billing-opportunity">
        <section className="opportunity-hero billing-hero">
          <div className="opportunity-hero-copy">
            <span className="section-eyebrow"><FileText size={14} /> RETAIL BILLING + INVENTORY</span>
            <h1>Connect retail billing<br /><em>with your stock.</em></h1>
            <p>Create bills in StockHale and keep the sale connected to the products, quantities, payments, and customer balance it affects. Then review posted sales alongside the rest of your store’s records.</p>
            <div className="opportunity-actions">
              <Link className="marketing-cta" href="/sign-up">Create your workspace <ArrowUpRight size={17} /></Link>
              <Link className="opportunity-text-link" href="/pricing">View plans <ArrowRight size={15} /></Link>
            </div>
          </div>
          <div className="bill-flow-board" aria-label="Illustrative workflow showing a bill linked to stock and account records">
            <div className="bill-flow-head"><span className="bill-flow-kicker">ONE POSTED BILL</span><span className="bill-flow-state"><i /> CONNECTED RECORDS</span></div>
            <div className="bill-flow-row"><span className="bill-flow-icon"><FileText size={18} /></span><span><small>01 · BILLING</small><b>Create and post a bill</b></span><Check size={16} /></div>
            <div className="bill-flow-connect"><i /><i /><i /></div>
            <div className="bill-flow-outcomes"><article><span><Boxes size={17} /></span><small>INVENTORY</small><b>Stock quantity updates</b></article><article><span><CircleDollarSign size={17} /></span><small>PAYMENT</small><b>Paid and due amounts recorded</b></article><article><span><ArrowUpRight size={17} /></span><small>SALES</small><b>Posted sale is ready to review</b></article></div>
            <p className="bill-flow-note">Illustrative workflow · Your records update when a bill is posted</p>
          </div>
          <div className="opportunity-index"><span>02</span><span>BILL</span><i /><span>STOCK</span><i /><span>ACCOUNT</span></div>
        </section>

        <section className="opportunity-intro">
          <span className="opportunity-side-label">ONE SALE, A CONNECTED RECORD</span>
          <div><p className="opportunity-lead">Retail billing works best when the bill also explains what left stock and what remains to collect.</p><p>StockHale connects billing to inventory and customer records in the same workspace. Create bills in Billing, post them when the details are ready, and use Sales to review posted activity. Payments and customer ledgers give you a place to follow what has been settled and what remains outstanding.</p></div>
        </section>

        <section className="opportunity-workflow" aria-labelledby="billing-flow-title">
          <div className="opportunity-section-heading"><span className="section-eyebrow">A PRACTICAL BILLING FLOW</span><h2 id="billing-flow-title">From a product on the bill<br /><em>to a balance you can review.</em></h2><p>Keep the steps distinct: Billing creates and posts the customer transaction; Sales is the place to review posted sales.</p></div>
          <div className="opportunity-steps billing-steps">
            <article><span className="opportunity-step-icon"><Boxes size={19} /></span><small>01 / SELECT</small><h3>Add products and quantities</h3><p>Choose the products being sold and enter the transaction details. The bill stays connected to the items and quantities in the workspace.</p></article>
            <article><span className="opportunity-step-icon"><FileText size={19} /></span><small>02 / POST</small><h3>Record the sale in Billing</h3><p>Review the bill, customer, date, and amounts, then post it. Posted bills reduce stock and record what was paid or left due.</p></article>
            <article><span className="opportunity-step-icon"><CircleDollarSign size={19} /></span><small>03 / FOLLOW UP</small><h3>Review sales and balances</h3><p>Use Sales to review posted transactions. Customer records and Payments help you follow account balances and later collections.</p></article>
          </div>
        </section>

        <section className="opportunity-detail-grid billing-detail-grid">
          <article className="opportunity-detail-card"><span className="section-eyebrow">BILLING AND STOCK</span><h2>A sale leaves a trace in both places.</h2><p>When a bill is posted, its product lines reduce the corresponding stock quantities. The product’s activity history and the Sales view help you trace the posted transaction later.</p><div className="bill-connection"><span><FileText size={16} /> Posted bill</span><ArrowRight size={18} /><span><Boxes size={16} /> Stock movement</span></div></article>
          <article className="opportunity-detail-card opportunity-detail-dark"><span className="section-eyebrow">PAYMENTS AND CUSTOMER ACCOUNTS</span><h2>See what is paid and what is still due.</h2><p>Record the amount paid on a bill and keep the remaining customer balance visible. The customer ledger brings invoices, returns, payments, and the running balance together for that account.</p><ul className="opportunity-check-list"><li><Check size={15} /> Posted sales available in the Sales view</li><li><Check size={15} /> Customer balance and bill history</li><li><Check size={15} /> Payments recorded as they happen</li></ul></article>
        </section>

        <section className="opportunity-note"><span className="section-eyebrow">A NOTE ON ACCURACY</span><p>StockHale keeps operational records; it does not independently verify tax treatment or replace professional accounting advice. Confirm local invoicing and compliance requirements for your business.</p></section>

        <section className="opportunity-related"><div><span className="section-eyebrow">KEEP EXPLORING</span><h2>Make each part of<br /><em>the record easier to follow.</em></h2></div><div className="opportunity-related-links"><Link href="/customer-supplier-accounts"><span><CircleDollarSign size={18} /> Customer and supplier accounts</span><ArrowRight size={17} /></Link><Link href="/guides/customer-credit-sales"><span><FileText size={18} /> Follow a credit sale and later payment</span><ArrowRight size={17} /></Link><Link href="/inventory-management"><span><Boxes size={18} /> Retail inventory management</span><ArrowRight size={17} /></Link><Link href="/how-to-use"><span><FileText size={18} /> How to record purchases and bills</span><ArrowRight size={17} /></Link><Link href="/pricing"><span><Check size={18} /> Compare plans and the 72-hour trial</span><ArrowRight size={17} /></Link></div></section>
      </main>
    </MarketingFrame>
  );
}

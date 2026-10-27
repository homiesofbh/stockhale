"use client";

import { useState } from "react";
import { emptyStore, saveProduct, recordTrade, recordPayment, recordReturn, today, stock, type Product, type Store } from "@/lib/stockwell/model";
import { InventoryView } from "./views/inventory-view";
import { ProductDetailView } from "./views/product-detail-view";
import { DailyClosingView } from "./views/daily-closing-view";
import { ReturnsView } from "./views/returns-view";
import { AdjustmentForm } from "./forms/adjustment-form";
import { ReportsView } from "./views/reports-view";
import { createReportData } from "@/lib/stockwell/reports";

function sampleStore(screen: string): Store {
  let s = saveProduct(emptyStore(), { id: "guide-mug", name: "Studio mug", sku: "MUG-001", barcode: "", category: "General", cost: 100, price: 150, low: 14, unit: "piece" }, screen === "opening-stock" ? 0 : 20);
  s.customers = [{ id: "guide-customer", name: "Sample Customer", phone: "", email: "", address: "" }];
  s.suppliers = [{ id: "guide-supplier", name: "Sample Supplier", phone: "", email: "", address: "" }];
  if (screen === "opening-stock") return s;
  const trade = { id: "guide-sale", number: "", date: today(), contactId: "guide-customer", lines: [{ productId: "guide-mug", qty: screen === "low-stock" ? 8 : 4, price: 150, cost: 100 }], discount: 0, tax: 0, paid: 200, method: "Cash", head: "Sales" };
  s = recordTrade(s, "Sale", trade);
  s = recordPayment(s, { id: "guide-payment", date: today(), kind: "Customer", contactId: "guide-customer", tradeId: "guide-sale", amount: 300, method: "Cash", head: "Customer payments", notes: "Illustrative later collection" });
  if (screen === "returns") {
    s = recordTrade(s, "Purchase", { ...trade, id: "guide-purchase", contactId: "guide-supplier", lines: [{ productId: "guide-mug", qty: 10, price: 100, cost: 100 }], paid: 0, head: "Purchases" });
    for (const [id, kind, tradeId, qty, reason] of [["return-sale", "Sales return", "guide-sale", 1, "Sample usable customer return"], ["return-purchase", "Purchase return", "guide-purchase", 1, "Sample supplier return"], ["return-damage", "Damaged stock", "", 2, "Sample breakage"]] as const) {
      s = recordReturn(s, { id, date: today(), kind, tradeId, productId: "guide-mug", qty, amount: 0, cost: 0, reason });
    }
  }
  return s;
}

export function GuideCapturePreview({ screen }: { screen: string }) {
  const [s] = useState(() => sampleStore(screen));
  const [, setEditProduct] = useState<Product | null>(null);
  const [report, setReport] = useState("Customer ledger");
  const [reportContact, setReportContact] = useState("guide-customer");
  return <main className="guide-capture-surface"><div className="guide-capture-label"><strong>STOCKHALE / PRODUCT VIEW</strong><span>FICTIONAL SAMPLE RECORDS</span></div>
    {screen === "opening-stock" && <section className="panel"><h1>Stock adjustment</h1><p className="muted">Enter the signed quantity change and keep the reason with the record.</p><AdjustmentForm s={s} text={(f, key) => String(f.get(key) || "")} num={(f, key) => Number(f.get(key))} submit={event => event.preventDefault()} commit={() => {}} /></section>}
    {screen === "stock-history" && <ProductDetailView s={s} product={s.products[0]} />}
    {screen === "low-stock" && <InventoryView s={s} lowStock={s.products.filter(p => stock(s, p.id) <= p.low)} open={() => {}} matches={() => true} category="All" status="Low stock" setEditProduct={setEditProduct} selectProduct={() => {}} />}
    {screen === "customer-accounts" && <section className="panel"><h1>Customer ledger</h1><ReportsView s={s} actor={{id:"guide-owner",role:"owner"}} commit={() => {}} reopenWithOwnerPassword={async () => ({})} report={report} setReport={setReport} reportContact={reportContact} setReportContact={setReportContact} from="" to="" reportResult={createReportData(s,{query:"",from:"",to:"",status:"All",paymentMethod:"All",report,reportContact})} /></section>}
    {screen === "daily-closing" && <DailyClosingView s={s} actor={{ id: "guide-owner", role: "owner" }} commit={() => {}} reopenWithOwnerPassword={async () => ({})} />}
    {screen === "returns" && <ReturnsView s={s} inRange={() => true} matches={() => true} pName={id => s.products.find(p => p.id === id)?.name || ""} />}
  </main>;
}

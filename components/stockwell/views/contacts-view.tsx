"use client";
import { Modal, ServerPagination, Table } from "@/components/stockwell/ui";
import {
  contactBalance,
  money,
  unappliedCreditBalance,
  type Contact,
  type Store,
  type Trade,
} from "@/lib/stockwell/model";
import { ArrowDownLeft, ArrowUpRight, Building2, FileSpreadsheet, Mail, MapPin, Phone } from "lucide-react";
import type { Dispatch, JSX, SetStateAction } from "react";
import { useState } from "react";
import { useServerCollection } from "@/lib/stockwell/use-server-collection";
import type { ReportData } from "@/lib/stockwell/reports";
import { useEffect } from "react";
type Props = {
  module: "Suppliers" | "Customers";
  s: Store;
  query: string;
  setDetailContact: Dispatch<SetStateAction<Contact | null>>;
  setEditContact: Dispatch<SetStateAction<Contact | null>>;
  open: (name: string) => void;
  detailContact: Contact | null;
  basicHeaders: string[];
  tradeRows: (list: Trade[], supplier?: boolean) => (string | JSX.Element)[][];
};
function queryEmptyMessage(module: "Suppliers" | "Customers") {
  return module === "Customers" ? "No customers match this search" : "No suppliers match this search";
}
export function ContactsView({
  module,
  s,
  query,
  setDetailContact,
  setEditContact,
  open,
  detailContact,
  basicHeaders,
  tradeRows,
}: Props) {
  const [detailTab, setDetailTab] = useState<"history" | "ledger">("history");
  const [exporting, setExporting] = useState(false);
  const detailKind = module === "Suppliers" ? "Supplier" : "Customer";
  const result = useServerCollection<Contact>({ collection: module === "Suppliers" ? "suppliers" : "customers", query, pageSize: 24 });
  const contacts = result.records;
  const tradePage = useServerCollection<Trade>({ collection: module === "Suppliers" ? "purchases" : "invoices", module: module === "Suppliers" ? "Inventory" : "Billing", contactId: detailContact?.id || "", pageSize: 15, enabled: !!detailContact && detailTab === "history" });
  const paymentPage = useServerCollection<any>({ collection: "payments", module: "Payments", contactId: detailContact?.id || "", pageSize: 15, enabled: !!detailContact && detailTab === "history" });
  const [ledger, setLedger] = useState<ReportData & { count: number; page: number; pageSize: number } | null>(null);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerError, setLedgerError] = useState("");
  const [ledgerExport, setLedgerExport] = useState<ReportData | null>(null);
  useEffect(() => { setLedgerPage(1); setLedger(null); setLedgerExport(null); }, [detailContact?.id, module]);
  useEffect(() => {
    if (!detailContact || detailTab !== "ledger") return;
    const controller = new AbortController();
    const params = new URLSearchParams({ report: "1", name: module === "Customers" ? "Customer ledger" : "Supplier ledger", contact: detailContact.id, page: String(ledgerPage), pageSize: "15" });
    fetch(`/api/workspace?${params}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Could not load ledger.");
      setLedger(value); setLedgerError("");
    }).catch(error => { if (!controller.signal.aborted) setLedgerError(error instanceof Error ? error.message : "Could not load ledger."); });
    return () => controller.abort();
  }, [detailContact?.id, detailTab, ledgerPage, module]);
  const openBillBalance = detailContact ? (result.meta?.billBalances as Record<string, number> | undefined)?.[detailContact.id] || 0 : 0;
  const unappliedCredits = detailContact ? unappliedCreditBalance(s, detailKind, detailContact.id) : 0;
  async function downloadLedger() {
    if (!detailContact || exporting) return;
    setExporting(true);
    try {
      let full: ReportData | null = ledgerExport;
      if (!full) {
        const params = new URLSearchParams({ report: "1", name: module === "Customers" ? "Customer ledger" : "Supplier ledger", contact: detailContact.id, all: "1" });
        const response = await fetch(`/api/workspace?${params}`, { cache: "no-store" });
        full = await response.json();
        if (!response.ok) throw new Error((full as any).error || "Could not load ledger export.");
        setLedgerExport(full);
      }
      if (!full) throw new Error("Could not load ledger export.");
      const { Workbook } = await import("exceljs");
      const book = new Workbook();
      book.creator = "StockHale";
      const sheet = book.addWorksheet(`${module === "Customers" ? "Customer" : "Supplier"} ledger`);
      sheet.addRow(full.columns);
      full.rows.forEach(row => sheet.addRow(row));
      sheet.getRow(1).font = { bold: true };
      sheet.views = [{ state: "frozen", ySplit: 1 }];
      sheet.columns.forEach(column => { column.width = 22; });
      const data = await book.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([new Uint8Array(data)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${detailContact.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "contact"}-ledger.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <div className="contact-overview" aria-label={`${module} overview`}>
        <div><span>{module === "Customers" ? "Customer accounts" : "Supplier accounts"}</span><strong>{result.count.toLocaleString("en-PK")}</strong><small>matching this search</small></div>
      </div>
      {result.error && <p className="form-error" role="alert">{result.error}</p>}
      {contacts.length ? <section className="contact-card-grid" aria-label={`${module} directory`} aria-busy={result.loading}>
        {contacts.map((c) => {
          const amount = contactBalance(s, detailKind, c.id);
          const count = Number((result.meta?.billCounts as Record<string, number> | undefined)?.[c.id] || 0);
          const initials = c.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?";
          return <article className="contact-card" key={c.id}>
            <div className="contact-card-top">
              <div className="contact-avatar" aria-hidden="true">{initials}</div>
              <div className="contact-card-identity"><h2>{c.name}</h2><span>{c.company || (module === "Customers" ? "Customer account" : "Supplier account")}</span></div>
              <span className={`contact-status${amount > 0 ? " is-open" : amount < 0 ? " is-credit" : " is-settled"}`}><i />{amount > 0 ? "Outstanding" : amount < 0 ? "Credit" : "Settled"}</span>
            </div>
            <div className="contact-card-details">
              {(c.phone || c.mobile) && <span><Phone size={14} />{c.phone || c.mobile}{c.mobile && c.phone && <small>{c.mobile}</small>}</span>}
              {c.email && <span><Mail size={14} />{c.email}</span>}
              {c.address && <span><MapPin size={14} />{c.address}</span>}
              {c.contactPerson && <span><Building2 size={14} />{c.contactPerson}</span>}
              {!c.phone && !c.mobile && !c.email && !c.address && !c.contactPerson && <span className="contact-no-details">No contact details added yet</span>}
            </div>
            <div className="contact-card-balance"><div><small>{module === "Customers" ? "ACCOUNT RECEIVABLE" : "ACCOUNT PAYABLE"}</small><strong>{money(Math.abs(amount))}</strong></div><span>{count} {module === "Customers" ? "bills" : "purchases"}</span></div>
            <div className="contact-card-footer">
              <span>{module === "Customers" ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{amount > 0 ? module === "Customers" ? "Payment due" : "Payable" : amount < 0 ? "Credit available" : "Account clear"}</span>
              <button className="contact-card-open" onClick={() => { setDetailTab("history"); setDetailContact(c); }}>View account <ArrowUpRight size={14} /></button>
              <button className="contact-card-edit" aria-label={`Edit ${c.name}`} onClick={() => { setEditContact(c); open("Contact"); }}>Edit</button>
            </div>
          </article>;
        })}
      </section> : <section className="card contact-empty"><Table headers={[]} rows={[]} empty={queryEmptyMessage(module)} /></section>}
      <ServerPagination page={result.page} pageCount={result.pageCount} count={result.count} pageSize={result.pageSize} setPage={result.setPage} />
      {detailContact && (
        <Modal title={detailContact.name} eyebrow={module === "Customers" ? "CUSTOMER PROFILE" : "SUPPLIER PROFILE"} close={() => setDetailContact(null)}>
          <div className="section-head">
            <div>
              <p>
                {[detailContact.company, detailContact.contactPerson, detailContact.phone, detailContact.mobile, detailContact.email, detailContact.address, detailContact.ntn ? `NTN: ${detailContact.ntn}` : "", detailContact.salesTaxNumber ? `Sales tax: ${detailContact.salesTaxNumber}` : "", detailContact.description].filter(Boolean).join(" · ") || "No optional details provided."}
              </p>
            </div>
          </div>
          <div className="contact-detail-tabs" role="tablist" aria-label="Contact details">
            <button className={detailTab === "history" ? "primary" : "secondary-button"} onClick={() => setDetailTab("history")} role="tab" aria-selected={detailTab === "history"}>Invoices & payments</button>
            <button className={detailTab === "ledger" ? "primary" : "secondary-button"} onClick={() => setDetailTab("ledger")} role="tab" aria-selected={detailTab === "ledger"}>Business ledger</button>
          </div>
          <div className={`contact-balance-summary${module === "Suppliers" ? " contact-balance-summary-single" : ""}`}>
            <div><small>{module === "Suppliers" ? "Payable balance · entire supplier account" : "Net account balance"}</small><strong>{money(contactBalance(s, detailKind, detailContact.id))}</strong><span>{module === "Suppliers" ? "Total amount owed after posted payments and credits" : "After settled payments and credits"}</span></div>
            {module === "Customers" && <>
              <div><small>Open bill balances</small><strong>{money(openBillBalance)}</strong><span>Outstanding on individual bills</span></div>
              <div><small>Unapplied credits</small><strong>{money(unappliedCredits)}</strong><span>Advances awaiting bill matching</span></div>
            </>}
          </div>
          <p className="contact-balance-explainer" role="note">{module === "Suppliers"
            ? "This is the total payable for the supplier’s whole account. Use this amount when recording a payment; individual purchase bills remain available below for reference."
            : "The net account balance is the overall amount due after credits. Unapplied credits reduce that total but are not assigned to a specific bill yet."}</p>
          {detailTab === "history" ? <>
            <h3>{module === "Suppliers" ? "Purchase history" : "Billing & sales history"}</h3>
            {unappliedCredits !== 0 && <p className="form-hint contact-advance-note">{module === "Suppliers"
              ? "Purchase bill balances stay bill-specific. Account-level payments, advances, and forwarded cheques reduce the payable balance above without being assigned to one bill."
              : "Bill balances are shown per bill. Unapplied credits reduce the net account balance above, but remain separate until matched to a bill."}</p>}
            <div className="contact-table-scroll">
            <Table
                headers={module === "Suppliers" ? ["Purchase", "Prepared by", "Supplier", "Quantity", "UOM", "Net total", "Status", "Paid", "Balance", ""] : basicHeaders}
                rows={tradeRows(tradePage.records, module === "Suppliers")}
              />
              <ServerPagination page={tradePage.page} pageCount={tradePage.pageCount} count={tradePage.count} pageSize={tradePage.pageSize} setPage={tradePage.setPage} />
            </div>
            <h3>Payment history</h3>
            <div className="contact-table-scroll">
              <Table
                headers={["Date", "Reference", "Amount", "Method", "Notes"]}
                rows={paymentPage.records.map(p => [p.date, p.accountLevel ? "Supplier account payment" : p.advance && !p.tradeId ? "Unapplied advance" : [...s.invoices, ...s.purchases].find(t => t.id === p.tradeId)?.number || "", money(p.amount), p.method, p.notes || ""])}
              />
              <ServerPagination page={paymentPage.page} pageCount={paymentPage.pageCount} count={paymentPage.count} pageSize={paymentPage.pageSize} setPage={paymentPage.setPage} />
            </div>
          </> : <>
            <div className="section-head">
              <div><h3>{module === "Customers" ? "Customer ledger" : "Supplier ledger"}</h3><p>All invoices, returns, payments, and the running balance for this contact.</p></div>
              <button className="secondary-button" onClick={() => void downloadLedger()} disabled={exporting}><FileSpreadsheet size={16} /> {exporting ? "Preparing Excel…" : "Download Excel"}</button>
            </div>
            <div className="contact-table-scroll">
              {ledgerError && <p className="form-error" role="alert">{ledgerError}</p>}
              <Table headers={ledger?.columns || []} rows={(ledger?.rows || []).map(row => row.map(value => typeof value === "number" ? value.toLocaleString("en-PK", { maximumFractionDigits: 2 }) : String(value)))} />
              {ledger && <ServerPagination page={ledger.page} pageCount={Math.max(1, Math.ceil(ledger.count / ledger.pageSize))} count={ledger.count} pageSize={ledger.pageSize} setPage={setLedgerPage} />}
            </div>
            {ledger?.contactSummary && <section className="contact-ledger-reconciliation" aria-label="Ledger totals">
              <div><h4>How the balance is calculated</h4><p>Charges minus payments and credits equals the remaining account balance.</p></div>
              <div className="contact-ledger-equation">
                <div><small>Total charges after returns</small><strong>{money(ledger.contactSummary.business)}</strong></div>
                <span aria-hidden="true">−</span>
                <div><small>Payments &amp; cheque adjustments</small><strong>{money(ledger.contactSummary.payments)}</strong></div>
                <span aria-hidden="true">=</span>
                <div className="contact-ledger-result"><small>Remaining account balance</small><strong>{money(Math.abs(ledger.contactSummary.outstanding))}</strong><span>{ledger.contactSummary.outstanding < 0 ? module === "Suppliers" ? "Supplier credit owed to you" : "Customer credit" : module === "Suppliers" ? "Amount you owe" : "Amount customer owes"}</span></div>
              </div>
            </section>}
          </>}
        </Modal>
      )}
    </>
  );
}

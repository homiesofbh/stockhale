"use client";
import { Modal, Table } from "@/components/stockwell/ui";
import {
  balance,
  contactBalance,
  isPosted,
  money,
  unappliedCreditBalance,
  type Contact,
  type Store,
  type Trade,
} from "@/lib/stockwell/model";
import { createReportData } from "@/lib/stockwell/reports";
import { chequeSettlements } from "@/lib/stockwell/operations";
import { ArrowDownLeft, ArrowUpRight, Building2, FileSpreadsheet, Mail, MapPin, Phone } from "lucide-react";
import type { Dispatch, JSX, SetStateAction } from "react";
import { useState } from "react";
type Props = {
  module: "Suppliers" | "Customers";
  s: Store;
  matches: (...values: unknown[]) => boolean;
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
  matches,
  setDetailContact,
  setEditContact,
  open,
  detailContact,
  basicHeaders,
  tradeRows,
}: Props) {
  const [detailTab, setDetailTab] = useState<"history" | "ledger">("history");
  const [exporting, setExporting] = useState(false);
  const ledgerReport = detailContact
    ? createReportData(s, {
        query: "",
        from: "",
        to: "",
        status: "All",
        paymentMethod: "All",
        report: module === "Customers" ? "Customer ledger" : "Supplier ledger",
        reportContact: detailContact.id,
      })
    : null;
  const detailKind = module === "Suppliers" ? "Supplier" : "Customer";
  const contacts = (module === "Suppliers" ? s.suppliers : s.customers).slice().reverse()
    .filter((c) => matches(c.name, c.company, c.phone, c.mobile, c.email, c.address, c.ntn, c.contactPerson, c.salesTaxNumber, c.description));
  const outstandingCount = contacts.filter(c => contactBalance(s, detailKind, c.id) > 0).length;
  const openBillBalance = detailContact ? (module === "Suppliers" ? s.purchases : s.invoices).filter(t => t.contactId === detailContact.id && isPosted(t)).reduce((sum, t) => sum + Math.max(balance(s, t), 0), 0) : 0;
  const unappliedCredits = detailContact ? unappliedCreditBalance(s, detailKind, detailContact.id) : 0;
  async function downloadLedger() {
    if (!ledgerReport || !detailContact || exporting) return;
    setExporting(true);
    try {
      const { Workbook } = await import("exceljs");
      const book = new Workbook();
      book.creator = "StockHale";
      const sheet = book.addWorksheet(`${module === "Customers" ? "Customer" : "Supplier"} ledger`);
      sheet.addRow(ledgerReport.columns);
      ledgerReport.rows.forEach(row => sheet.addRow(row));
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
        <div><span>{module === "Customers" ? "Customer accounts" : "Supplier accounts"}</span><strong>{contacts.length.toLocaleString("en-PK")}</strong><small>matching this search</small></div>
        <div><span>{module === "Customers" ? "With receivable" : "With payable"}</span><strong>{outstandingCount.toLocaleString("en-PK")}</strong><small>accounts with an outstanding balance</small></div>
        <div><span>{module === "Customers" ? "Total receivable" : "Total payable"}</span><strong>{money(contacts.reduce((sum, c) => sum + Math.max(contactBalance(s, detailKind, c.id), 0), 0))}</strong><small>across matching accounts</small></div>
      </div>
      {contacts.length ? <section className="contact-card-grid" aria-label={`${module} directory`}>
        {contacts.map((c) => {
          const amount = contactBalance(s, detailKind, c.id);
          const count = (module === "Suppliers" ? s.purchases : s.invoices).filter(t => t.contactId === c.id && isPosted(t)).length;
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
                headers={module === "Suppliers" ? ["Purchase", "Supplier", "Quantity", "UOM", "Net total", "Status", "Paid", "Balance", ""] : basicHeaders}
                rows={tradeRows((module === "Suppliers" ? s.purchases : s.invoices).filter(t => t.contactId === detailContact.id), module === "Suppliers")}
              />
            </div>
            <h3>Payment history</h3>
            <div className="contact-table-scroll">
              <Table
                headers={["Date", "Reference", "Amount", "Method", "Notes"]}
                rows={[
                  ...(module === "Suppliers" ? s.purchases : s.invoices).filter(t => isPosted(t) && t.contactId === detailContact.id && t.paid > 0).map(t => [t.date, t.number, money(t.paid), t.method, "Paid at creation"]),
                  ...s.payments.filter(p => p.contactId === detailContact.id).map(p => [p.date, p.accountLevel ? "Supplier account payment" : p.advance && !p.tradeId ? "Unapplied advance" : [...s.invoices, ...s.purchases].find(t => t.id === p.tradeId)?.number || "", money(p.amount), p.method, p.notes]),
                  ...(module === "Suppliers" ? (s.crossCheques || []).filter(c => c.destinationKind === "Supplier" && c.destinationId === detailContact.id).flatMap(c => {
                    const source = s.payments.find(p => p.id === c.sourcePaymentId);
                    return source?.method === "Cheque" ? chequeSettlements(s, source).filter(e => e.status === "cleared" || e.status === "bounced").map(e => [e.date, "Forwarded customer cheque", money(e.amount), "Cheque", source.chequeNumber || source.chequeBank || ""]) : [];
                  }) : []),
                ]}
              />
            </div>
          </> : <>
            <div className="section-head">
              <div><h3>{module === "Customers" ? "Customer ledger" : "Supplier ledger"}</h3><p>All invoices, returns, payments, and the running balance for this contact.</p></div>
              <button className="secondary-button" onClick={() => void downloadLedger()} disabled={exporting}><FileSpreadsheet size={16} /> {exporting ? "Preparing Excel…" : "Download Excel"}</button>
            </div>
            <div className="contact-table-scroll">
              <Table headers={ledgerReport?.columns || []} rows={(ledgerReport?.rows || []).map(row => row.map(value => typeof value === "number" ? value.toLocaleString("en-PK", { maximumFractionDigits: 2 }) : String(value)))} />
            </div>
            {ledgerReport?.contactSummary && <section className="contact-ledger-reconciliation" aria-label="Ledger totals">
              <div><h4>How the balance is calculated</h4><p>Charges minus payments and credits equals the remaining account balance.</p></div>
              <div className="contact-ledger-equation">
                <div><small>Total charges after returns</small><strong>{money(ledgerReport.contactSummary.business)}</strong></div>
                <span aria-hidden="true">−</span>
                <div><small>Payments &amp; cheque adjustments</small><strong>{money(ledgerReport.contactSummary.payments)}</strong></div>
                <span aria-hidden="true">=</span>
                <div className="contact-ledger-result"><small>Remaining account balance</small><strong>{money(Math.abs(ledgerReport.contactSummary.outstanding))}</strong><span>{ledgerReport.contactSummary.outstanding < 0 ? module === "Suppliers" ? "Supplier credit owed to you" : "Customer credit" : module === "Suppliers" ? "Amount you owe" : "Amount customer owes"}</span></div>
              </div>
            </section>}
          </>}
        </Modal>
      )}
    </>
  );
}

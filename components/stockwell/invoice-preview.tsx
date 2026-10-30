"use client";
import { GlassSelect } from "@/components/stockwell/glass-select";
import type { InvoicePaper } from "@/lib/stockwell/invoice-pdf";
import {
  balance,
  isPosted,
  lineDiscount,
  paid,
  returned,
  round,
  subtotal,
  total,
  type Store,
  type Trade,
} from "@/lib/stockwell/model";
import { Boxes, Download, Printer, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
type Props = {
  setInvoice: Dispatch<SetStateAction<Trade | null>>;
  paper: InvoicePaper;
  setPaper: Dispatch<SetStateAction<InvoicePaper>>;
  pdfBusy: boolean;
  saveInvoicePdf: () => Promise<void>;
  pdfError: string;
  invoice: Trade;
  cName: (id: string, supplier?: boolean) => string;
  s: Store;
  paymentStatus: (t: Trade) => "Credit balance" | "Paid" | "Partial" | "Unpaid" | "Draft" | "Voided";
  pName: (id: string) => string;
  preparedBy: string;
};
export function InvoicePreview({
  setInvoice,
  paper,
  setPaper,
  pdfBusy,
  saveInvoicePdf,
  pdfError,
  invoice,
  cName,
  s,
  paymentStatus,
  pName,
  preparedBy,
}: Props) {
  return (
    <div className="invoice-overlay">
      <div className="invoice-controls">
        <button className="secondary-button" onClick={() => setInvoice(null)}>
          <X size={16} />
          Close
        </button>
        <div>
          <GlassSelect
            aria-label="Printer paper size"
            value={paper}
            onValueChange={(e) => setPaper(e as InvoicePaper)}
          >
            <option value="A4">Standard printer · A4</option>
            <option value="80mm">Receipt printer · 80 mm</option>
            <option value="58mm">Receipt printer · 58 mm</option>
          </GlassSelect>
          <button
            className="secondary-button"
            disabled={pdfBusy || !isPosted(invoice)}
            onClick={saveInvoicePdf}
          >
            <Download size={17} />
            {pdfBusy ? "Preparing PDF…" : "Download PDF"}
          </button>
          <button className="primary" disabled={!isPosted(invoice)} onClick={() => window.print()}>
            <Printer size={17} />
            Print / Save PDF
          </button>
        </div>
      </div>
      {pdfError && (
        <div className="pdf-error" role="alert">
          {pdfError}
        </div>
      )}
      <style>{`@media print { @page { size: ${paper === "A4" ? "A4" : paper + " 297mm"}; margin: 0; } }`}</style>
      <article
        className={`print-sheet ${paper === "A4" ? "a4" : "receipt"}`}
        style={paper === "A4" ? {} : { width: paper }}
      >
        <div className="invoice-brand">
          <span className="brand-mark">
            <Boxes size={24} />
          </span>
          <div className="invoice-brand-name">
            StockHale<span>.</span>
          </div>
        </div>
        <div className="invoice-title">
          <h1>
            {invoice.status === "draft" ? "Draft · " : invoice.status === "void" ? "Voided · " : ""}{invoice.number.startsWith("PUR") ? "Purchase record" : "Invoice"}
          </h1>
          <div>
            <b>{invoice.number}</b>
            <span>{invoice.date}</span>
          </div>
        </div>
        <div className="invoice-customer">
          <div>
            <small>
              {invoice.number.startsWith("PUR") ? "SUPPLIER" : "BILL TO"}
            </small>
            <b>{invoice.contactId ? cName(invoice.contactId, invoice.number.startsWith("PUR")) : invoice.walkInName || invoice.walkInCompany || "Walk-in customer"}</b>
            {!invoice.contactId && <p>{[invoice.walkInName, invoice.walkInCompany, invoice.walkInPhone].filter(Boolean).map((v) => <span key={v}>{v}</span>)}</p>}
            {(invoice.number.startsWith("PUR") ? s.suppliers : s.customers)
              .filter((c) => c.id === invoice.contactId)
              .map((c) => (
                <p key={c.id}>
                  {[c.address, c.phone, c.email, c.ntn ? `NTN: ${c.ntn}` : ""].filter(Boolean).map((v, i) => (
                    <span key={i}>{v}</span>
                  ))}
                </p>
              ))}
          </div>
          <div>
            <small>PAYMENT</small>
            <b>{paymentStatus(invoice)}</b>
            <span>{invoice.method}</span>
          </div>
        </div>
        <table className="invoice-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l, i) => (
              <tr key={i}>
                <td>
                  {pName(l.productId)}
                  <small>
                    {s.products.find((p) => p.id === l.productId)?.sku}
                  </small>
                </td>
                <td>{l.qty} {l.unit || s.products.find((p) => p.id === l.productId)?.unit || "piece"}</td>
                <td>{l.price.toFixed(2)}</td>
                <td>{round(l.qty * l.price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="invoice-totals">
          {[
            ["Subtotal", subtotal(invoice)],
            ["Discount", -(lineDiscount(invoice) + invoice.discount)],
            [
              `Tax (${invoice.tax}%)`,
              round(
                ((subtotal(invoice) - lineDiscount(invoice) - invoice.discount) * invoice.tax) / 100,
              ),
            ],
            ["Total (PKR)", total(invoice)],
            ["Return credit", -returned(s, invoice.id)],
            ["Paid", paid(s, invoice)],
            ["Balance / credit", balance(s, invoice)],
          ].map(([label, value]) => (
            <div
              key={label}
              className={label === "Total (PKR)" ? "invoice-grand" : ""}
            >
              <span>{label}</span>
              <b>{Number(value).toFixed(2)}</b>
            </div>
          ))}
        </div>
        <div className="invoice-thanks">
          Thank you for your business.
          <small>Prepared by: {preparedBy}</small>
        </div>
      </article>
    </div>
  );
}

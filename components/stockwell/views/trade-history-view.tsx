"use client";
import { Table } from "@/components/stockwell/ui";
import { type Trade } from "@/lib/stockwell/model";
import type { JSX } from "react";
import { attachmentDownloadUrl } from "@/lib/stockwell/attachment-client";
import { useState } from "react";
type Props = {
  module: "Purchases" | "Billing";
  invoices: Trade[];
  purchases: Trade[];
  basicHeaders: string[];
  tradeRows: (list: Trade[], supplier?: boolean) => (string | JSX.Element)[][];
};
export function TradeHistoryView({
  module,
  invoices,
  purchases,
  basicHeaders,
  tradeRows,
}: Props) {
  const [error, setError] = useState("");
  const links = (attachments: any[] = []) => <>{attachments.map(a => <button key={a.id} className="link" onClick={async () => { try { window.open(await attachmentDownloadUrl(a.key), "_blank", "noopener,noreferrer"); } catch (e) { setError(e instanceof Error ? e.message : "Could not open attachment."); } }}>{a.name}</button>)}</>;
  return (
    <>
      <div className="sub-actions">
        <span>
          {module === "Billing" ? invoices.length : purchases.length} records
        </span>
        <span className="muted">
          Posting updates stock and balances; drafts have no effect
        </span>
      </div>
      <section className="card">
        {error && <p className="form-error" role="alert">{error}</p>}
        <Table
          headers={
            module === "Billing"
              ? basicHeaders
              : [
                  "Purchase",
                  "Supplier",
                  "Quantity",
                  "Net total",
                  "Status",
                  "Paid",
                  "Balance",
                  "Attachments",
                  "",
                ]
          }
          rows={
            module === "Billing"
              ? tradeRows(invoices)
              : purchases.map(p => [...(tradeRows([p], true)[0] || []), links(p.attachments)])
          }
        />
      </section>
    </>
  );
}

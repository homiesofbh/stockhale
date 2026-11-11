"use client";
import { ServerPagination, Table } from "@/components/stockwell/ui";
import { type Trade } from "@/lib/stockwell/model";
import type { JSX } from "react";
import { attachmentDownloadUrl } from "@/lib/stockwell/attachment-client";
import { useState } from "react";
import { useServerCollection } from "@/lib/stockwell/use-server-collection";
type Props = {
  module: "Purchases" | "Billing";
  query: string;
  from: string;
  to: string;
  status: string;
  paymentMethod: string;
  basicHeaders: string[];
  tradeRows: (list: Trade[], supplier?: boolean) => (string | JSX.Element)[][];
};
export function TradeHistoryView({
  module,
  query,
  from,
  to,
  status,
  paymentMethod,
  basicHeaders,
  tradeRows,
}: Props) {
  const [error, setError] = useState("");
  const result = useServerCollection<Trade>({ collection: module === "Billing" ? "invoices" : "purchases", module, query, from, to, status, paymentMethod, pageSize: 25 });
  const invoices = module === "Billing" ? result.records : [];
  const purchases = module === "Purchases" ? result.records : [];
  const links = (attachments: any[] = []) => <>{attachments.map(a => <button key={a.id} className="link" onClick={async () => { try { window.open(await attachmentDownloadUrl(a.key), "_blank", "noopener,noreferrer"); } catch (e) { setError(e instanceof Error ? e.message : "Could not open attachment."); } }}>{a.name}</button>)}</>;
  return (
    <>
      <div className="sub-actions mt-4 mx-2">
        <span>
          {result.count} records
        </span>
        <span className="muted">
          Posting updates stock and balances; drafts have no effect
        </span>
      </div>
      <section className="card">
        {error && <p className="form-error" role="alert">{error}</p>}
        {result.error && <p className="form-error" role="alert">{result.error}</p>}
        <Table
          headers={
            module === "Billing"
              ? basicHeaders
              : [
                  "Purchase",
                  "Supplier",
                  "Quantity",
                  "UOM",
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
        <ServerPagination page={result.page} pageCount={result.pageCount} count={result.count} pageSize={result.pageSize} setPage={result.setPage} />
      </section>
    </>
  );
}

"use client";
import { ServerPagination, Table } from "@/components/stockwell/ui";
import { money, type Product, type Trade } from "@/lib/stockwell/model";
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
  products: Product[];
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
  products,
  tradeRows,
}: Props) {
  const [error, setError] = useState("");
  const result = useServerCollection<Trade>({ collection: module === "Billing" ? "invoices" : "purchases", module, query, from, to, status, paymentMethod, pageSize: 25 });
  const invoices = module === "Billing" ? result.records : [];
  const purchases = module === "Purchases" ? result.records : [];
  const productsById = new Map(products.map(product => [product.id, product]));
  const purchaseRows = purchases.map(p => {
    const row = tradeRows([p], true)[0] || [];
    const items = p.lines.map(line => {
      const product = productsById.get(line.productId);
      return { name: product?.name || "Unknown product", quantity: line.qty, unit: line.unit || product?.unit || "piece", gsm: product?.gsm ?? "—", total: money(line.qty * line.price - (line.discount || 0)) };
    });
    const list = (label: string, values: string[]) => values.length === 1 ? values[0] : <details><summary>{label}</summary><ul>{items.map((item, index) => <li key={`${item.name}-${index}`}>{item.name}: {values[index]}</li>)}</ul></details>;
    row.splice(3, 2, list("Quantities", items.map(item => String(item.quantity))), list("Units", items.map(item => item.unit)));
    row.splice(5, 0, list("GSM", items.map(item => String(item.gsm))), items.length === 1 ? items[0].total : list("Line totals", items.map(item => item.total)));
    return [...row, links(p.attachments)];
  });
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
                  "GSM",
                  "Line totals",
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
              : purchaseRows
          }
        />
        <ServerPagination page={result.page} pageCount={result.pageCount} count={result.count} pageSize={result.pageSize} setPage={result.setPage} />
      </section>
    </>
  );
}

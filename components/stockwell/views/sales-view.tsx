"use client";
import { Badge, ServerPagination, Stat, Table } from "@/components/stockwell/ui";
import { GlassSelect } from "@/components/stockwell/glass-select";
import {
  money,
  round,
  subtotal,
  today,
  type Store,
  type Trade,
} from "@/lib/stockwell/model";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { useServerCollection } from "@/lib/stockwell/use-server-collection";
import { useState as useLocalState } from "react";
type Props = {
  from: string;
  to: string;
  setFrom: Dispatch<SetStateAction<string>>;
  setTo: Dispatch<SetStateAction<string>>;
  s: Store;
  query: string;
  status: string;
  paymentMethod: string;
  pName: (id: string) => string;
  preparedBy: (id?: string, name?: string) => string;
  setInvoice: Dispatch<SetStateAction<Trade | null>>;
  setPaper: Dispatch<SetStateAction<"A4" | "80mm" | "58mm">>;
};
export function SalesView({
  from,
  to,
  setFrom,
  setTo,
  s,
  query,
  status,
  paymentMethod,
  pName,
  preparedBy,
  setInvoice,
  setPaper,
}: Props) {
  const [productId, setProductId] = useState("All");
  const [productQuery, setProductQuery] = useLocalState("");
  const productPage = useServerCollection<any>({ collection: "products", query: productQuery, pageSize: 15 });
  const result = useServerCollection<Trade>({ collection: "invoices", module: "Sales", query, from, to, status, paymentMethod, productId: productId === "All" ? "" : productId, pageSize: 20 });
  const selectedInvoices = result.records;
  const selectedLines = selectedInvoices.flatMap(trade => trade.lines.map(line => ({ trade, line })));
  return (
    <>
      <div className="filters"><GlassSelect aria-label="Filter sales by product" value={productId} onValueChange={setProductId}><option value="All">All products</option>{productPage.records.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</GlassSelect><input type="search" aria-label="Search products for sales filter" placeholder="Search products…" value={productQuery} onChange={event => setProductQuery(event.target.value)} /><ServerPagination page={productPage.page} pageCount={productPage.pageCount} count={productPage.count} pageSize={productPage.pageSize} setPage={productPage.setPage} /></div>
      <div className="period-tabs">
        {["All time", "Today", "This week", "This month"].map((label) => (
          <button
            key={label}
            className={
              (label === "All time" && !from && !to) ||
              (label === "Today" && from === today() && to === today())
                ? "selected"
                : ""
            }
            onClick={() => {
              const date = new Date(`${today()}T12:00:00Z`);
              if (label === "All time") {
                setFrom("");
                setTo("");
                return;
              }
              if (label === "This week")
                date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
              if (label === "This month") date.setUTCDate(1);
              setFrom(
                label === "Today" ? today() : date.toISOString().slice(0, 10),
              );
              setTo(today());
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="stats-grid three">
        <Stat
          label="Net sales"
          value={money(result.aggregates?.revenue || 0)}
          detail="After discounts and returns, excluding tax"
          accent
        />
        <Stat
          label="Quantity sold"
          value={String(
            result.aggregates?.quantity || 0,
          )}
          detail="Original units on matching bills"
        />
        <Stat
          label="Sales records"
          value={String(result.count)}
          detail="Every bill is recorded as a sale"
        />
      </div>
      <section className="card">
        {result.error && <p className="form-error" role="alert">{result.error}</p>}
        <Table
          headers={[
            "Date / Invoice",
            "Prepared by",
            "Product",
            "Colour / GSM",
            "Quantity",
            "UOM",
            "Selling price",
            "Allocated discount",
            "Line total before tax",
          ]}
          rows={selectedLines.map(({ trade: t, line: l }) => {
              const d = subtotal(t)
                ? round((t.discount * l.qty * l.price) / subtotal(t))
                : 0;
              return [
                <>
                  {t.date}
                  <small><button className="link" onClick={() => { setInvoice(t); setPaper("A4"); }}>{t.number}</button></small>
                </>,
                preparedBy(t.createdBy, t.createdByName),
                pName(l.productId),
                (() => { const product = s.products.find(item => item.id === l.productId); return [product?.color, product?.gsm ? `${product.gsm} GSM` : ""].filter(Boolean).join(" · ") || "—"; })(),
                l.qty,
                l.unit || s.products.find((p) => p.id === l.productId)?.unit || "piece",
                <span>{money(l.price)}{l.price < l.cost && <><br /><Badge tone="amber">Below cost</Badge></>}</span>,
                money(d),
                money(l.qty * l.price - d),
              ];
            })}
        />
        <ServerPagination page={result.page} pageCount={result.pageCount} count={result.count} pageSize={result.pageSize} setPage={result.setPage} />
      </section>
    </>
  );
}

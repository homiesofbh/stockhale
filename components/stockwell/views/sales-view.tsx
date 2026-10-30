"use client";
import { Badge, Stat, Table } from "@/components/stockwell/ui";
import { GlassSelect } from "@/components/stockwell/glass-select";
import {
  money,
  profit,
  round,
  subtotal,
  today,
  type Store,
  type Trade,
} from "@/lib/stockwell/model";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
type Props = {
  from: string;
  to: string;
  setFrom: Dispatch<SetStateAction<string>>;
  setTo: Dispatch<SetStateAction<string>>;
  s: Store;
  invoices: Trade[];
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
  invoices,
  pName,
  preparedBy,
  setInvoice,
  setPaper,
}: Props) {
  const [productId, setProductId] = useState("All");
  const selectedInvoices = productId === "All" ? invoices : invoices.filter(trade => trade.lines.some(line => line.productId === productId));
  const selectedLines = selectedInvoices.flatMap(trade => trade.lines.filter(line => productId === "All" || line.productId === productId).map(line => ({ trade, line })));
  return (
    <>
      <div className="filters"><GlassSelect aria-label="Filter sales by product" value={productId} onValueChange={setProductId}><option value="All">All products</option>{s.products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</GlassSelect></div>
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
          value={money(profit(s, from, to).revenue)}
          detail="After discounts and returns, excluding tax"
          accent
        />
        <Stat
          label="Quantity sold"
          value={String(
            selectedLines.reduce((n, entry) => n + entry.line.qty, 0),
          )}
          detail="Original units on matching bills"
        />
        <Stat
          label="Sales records"
          value={String(selectedInvoices.length)}
          detail="Every bill is recorded as a sale"
        />
      </div>
      <section className="card">
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
      </section>
    </>
  );
}

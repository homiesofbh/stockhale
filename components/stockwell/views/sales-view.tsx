"use client";
import { Stat, Table } from "@/components/stockwell/ui";
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
type Props = {
  from: string;
  to: string;
  setFrom: Dispatch<SetStateAction<string>>;
  setTo: Dispatch<SetStateAction<string>>;
  s: Store;
  invoices: Trade[];
  pName: (id: string) => string;
};
export function SalesView({
  from,
  to,
  setFrom,
  setTo,
  s,
  invoices,
  pName,
}: Props) {
  return (
    <>
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
            invoices.reduce(
              (n, t) => n + t.lines.reduce((a, l) => a + l.qty, 0),
              0,
            ),
          )}
          detail="Original units on matching bills"
        />
        <Stat
          label="Sales records"
          value={String(invoices.length)}
          detail="Every bill is recorded as a sale"
        />
      </div>
      <section className="card">
        <Table
          headers={[
            "Date / Invoice",
            "Product",
            "Quantity",
            "Selling price",
            "Allocated discount",
            "Line total before tax",
          ]}
          rows={invoices.flatMap((t) =>
            t.lines.map((l) => {
              const d = subtotal(t)
                ? round((t.discount * l.qty * l.price) / subtotal(t))
                : 0;
              return [
                <>
                  {t.date}
                  <small>{t.number}</small>
                </>,
                pName(l.productId),
                l.qty,
                money(l.price),
                money(d),
                money(l.qty * l.price - d),
              ];
            }),
          )}
        />
      </section>
    </>
  );
}

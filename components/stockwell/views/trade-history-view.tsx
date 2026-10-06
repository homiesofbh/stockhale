"use client";
import { Table } from "@/components/stockwell/ui";
import { type Trade } from "@/lib/stockwell/model";
import type { JSX } from "react";
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
  return (
    <>
      <div className="sub-actions">
        <span>
          {module === "Billing" ? invoices.length : purchases.length} records
        </span>
        <span className="muted">
          Stock updates automatically with each transaction
        </span>
      </div>
      <section className="card">
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
                  "",
                ]
          }
          rows={
            module === "Billing"
              ? tradeRows(invoices)
              : tradeRows(purchases, true)
          }
        />
      </section>
    </>
  );
}

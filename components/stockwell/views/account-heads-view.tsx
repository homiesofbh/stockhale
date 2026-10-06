"use client";
import type { FinancialRow } from "@/lib/stockwell/model";
import { Badge, Table } from "@/components/stockwell/ui";
import { money, type Store } from "@/lib/stockwell/model";
import { ClipboardList } from "lucide-react";
type Props = {
  s: Store;
  matches: (...values: unknown[]) => boolean;
  accounting: FinancialRow[];
  inRange: (date: string) => boolean;
};
export function AccountHeadsView({ s, matches, accounting, inRange }: Props) {
  return (
    <>
      <div className="account-heads">
        {s.heads
          .filter((h) => matches(h))
          .map((h) => {
            const rows = accounting.filter(
              (r) => r.head === h && inRange(r.date),
            );
            return (
              <div className="account-head" key={h}>
                <ClipboardList size={17} />
                <b>{h}</b>
                <small>{rows.length} transactions</small>
              </div>
            );
          })}
      </div>
      <section className="card">
        <div className="section-head">
          <h2>Transactions by account head</h2>
        </div>
        <Table
          headers={[
            "Date",
            "Reference",
            "Type",
            "Account head",
            "Amount",
            "Payment method",
          ]}
          rows={accounting
            .filter(
              (r) => inRange(r.date) && matches(r.head, r.reference, r.type),
            )
            .map((r) => [
              r.date,
              r.reference,
              r.type,
              <Badge>{r.head}</Badge>,
              money(r.amount),
              r.method,
            ])}
        />
      </section>
    </>
  );
}

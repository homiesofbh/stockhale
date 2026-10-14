"use client";
import { useState } from "react";
import { Badge, Table } from "@/components/stockwell/ui";
import { money, type Store } from "@/lib/stockwell/model";
type Props = {
  s: Store;
  inRange: (date: string) => boolean;
  matches: (...values: unknown[]) => boolean;
  pName: (id: string) => string;
};
export function ReturnsView({ s, inRange, matches, pName }: Props) {
  const [q, setQ] = useState("");
  const trades = [...s.invoices, ...s.purchases];
  const rows = s.returns.filter((r) => {
    const trade = trades.find((t) => t.id === r.tradeId);
    const unit = s.products.find((p) => p.id === r.productId)?.unit || "piece";
    const hay = [r.kind, r.reason, pName(r.productId), trade?.number, unit, r.date].join(" ").toLowerCase();
    return inRange(r.date) && matches(r.kind, r.reason, pName(r.productId)) && (!q.trim() || hay.includes(q.trim().toLowerCase()));
  }).slice().reverse().map((r) => {
    const trade = trades.find((t) => t.id === r.tradeId);
    const line = trade?.lines.find((l) => l.productId === r.productId);
    const unit = s.products.find((p) => p.id === r.productId)?.unit || "piece";
    return [r.date, <Badge key="kind" tone={r.kind === "Damaged stock" ? "amber" : ""}>{r.kind}</Badge>, trade?.number || "—", pName(r.productId), r.qty, unit, line ? money(line.price) : "—", r.kind === "Damaged stock" ? "—" : money(r.amount), r.reason];
  });
  return (
    <section className="card returns-view">
      <div className="toolbar" style={{ marginBottom: 12 }}><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search returns by product, invoice, reason, type…" aria-label="Search returns" /></div>
      <Table
        headers={["Date", "Type", "Reference", "Product", "Quantity", "UOM", "Unit price", "Credit adjustment", "Reason"]}
        rows={rows}
      />
    </section>
  );
}

"use client";
import { useState } from "react";
import { Badge, ServerPagination, Table } from "@/components/stockwell/ui";
import { assignReturnNumbers, money, type Store, type Trade } from "@/lib/stockwell/model";
import { useServerCollection } from "@/lib/stockwell/use-server-collection";
import type { Dispatch, SetStateAction } from "react";
type Props = {
  s: Store;
  query: string;
  from: string;
  to: string;
  samplePreview?: boolean;
  pName: (id: string) => string;
  setInvoice: Dispatch<SetStateAction<Trade | null>>;
};
export function ReturnsView({ s, query, from, to, pName, setInvoice, samplePreview = false }: Props) {
  const [q, setQ] = useState("");
  const result = useServerCollection<any>({ collection: "returns", query, secondaryQuery: q, from, to, pageSize: 25, enabled: !samplePreview });
  const trades = [...s.invoices, ...s.purchases];
  const returnNumbers = new Map(assignReturnNumbers(s.returns).map(record => [record.id, record.number || ""]));
  const records = samplePreview ? s.returns.filter(record => {
    const trade = trades.find(item => item.id === record.tradeId);
    const product = s.products.find(item => item.id === record.productId);
    const values = [record.id, returnNumbers.get(record.id), record.kind, record.reason, product?.name, trade?.number, product?.unit, record.date].join(" ").toLowerCase();
    return (!query || values.includes(query.toLowerCase())) && (!q.trim() || values.includes(q.trim().toLowerCase())) && (!from || record.date >= from) && (!to || record.date <= to);
  }).reverse() : result.records;
  const rows = records.map((r) => {
    const trade = trades.find((t) => t.id === r.tradeId);
    const unit = s.products.find((p) => p.id === r.productId)?.unit || "piece";
    const line = trade?.lines.find((l) => l.productId === r.productId);
    return [returnNumbers.get(r.id) || "—", r.date, <Badge key="kind" tone={r.kind === "Damaged stock" ? "amber" : ""}>{r.kind}</Badge>, trade ? <button className="link" aria-label={`Open invoice ${trade.number}`} onClick={() => setInvoice(trade)}>{trade.number}</button> : "—", pName(r.productId), r.qty, unit, line ? money(line.price) : "—", r.kind === "Damaged stock" ? "—" : money(r.amount), r.reason];
  });
  return (
    <section className="card returns-view">
      <div className="toolbar" style={{ marginBottom: 12 }}><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search returns by product, invoice, reason, type…" aria-label="Search returns" /></div>
      <Table
        headers={["Return", "Date", "Type", "Reference", "Product", "Quantity", "UOM", "Unit price", "Credit adjustment", "Reason"]}
        rows={rows}
      />
      {!samplePreview && result.error && <p className="form-error" role="alert">{result.error}</p>}
      {!samplePreview && <ServerPagination page={result.page} pageCount={result.pageCount} count={result.count} pageSize={result.pageSize} setPage={result.setPage} />}
    </section>
  );
}

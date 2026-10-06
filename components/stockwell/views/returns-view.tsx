"use client";
import { Badge, Table } from "@/components/stockwell/ui";
import { money, type Store } from "@/lib/stockwell/model";
type Props = {
  s: Store;
  inRange: (date: string) => boolean;
  matches: (...values: unknown[]) => boolean;
  pName: (id: string) => string;
};
export function ReturnsView({ s, inRange, matches, pName }: Props) {
  return (
    <section className="card">
      <Table
        headers={[
          "Date",
          "Type",
          "Reference",
          "Product",
          "Quantity",
          "Credit adjustment",
          "Reason",
        ]}
        rows={s.returns
          .filter(
            (r) =>
              inRange(r.date) && matches(r.kind, r.reason, pName(r.productId)),
          )
          .slice()
          .reverse()
          .map((r) => [
            r.date,
            <Badge tone={r.kind === "Damaged stock" ? "amber" : ""}>
              {r.kind}
            </Badge>,
            [...s.invoices, ...s.purchases].find((t) => t.id === r.tradeId)
              ?.number || "—",
            pName(r.productId),
            r.qty,
            r.kind === "Damaged stock" ? "—" : money(r.amount),
            r.reason,
          ])}
      />
    </section>
  );
}

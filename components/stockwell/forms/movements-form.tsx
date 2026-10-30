"use client";
import { Badge, Table } from "@/components/stockwell/ui";
import { type Store } from "@/lib/stockwell/model";
type Props = {
  s: Store;
  matches: (...values: unknown[]) => boolean;
  pName: (id: string) => string;
};
export function MovementsForm({ s, matches, pName }: Props) {
  return (
    <>
      <div className="form-hint">
        Search products and references using the inventory search field.
      </div>
      <Table
        headers={["Date", "Time", "Product", "Type", "Quantity", "Reference", "Reason"]}
        rows={s.movements
          .filter((m) => matches(pName(m.productId), m.reference, m.reason))
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0) || b.id.localeCompare(a.id))
          .map((m) => [
            m.date,
            m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Not recorded",
            pName(m.productId),
            m.type,
            <Badge tone={m.qty > 0 ? "green" : "amber"}>
              {m.qty > 0 ? "+" : ""}
              {m.qty}
            </Badge>,
            m.reference,
            m.reason || "—",
          ])}
      />
    </>
  );
}

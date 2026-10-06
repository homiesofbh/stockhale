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
        headers={["Date", "Product", "Type", "Quantity", "Reference", "Reason"]}
        rows={s.movements
          .filter((m) => matches(pName(m.productId), m.reference, m.reason))
          .slice()
          .reverse()
          .map((m) => [
            m.date,
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

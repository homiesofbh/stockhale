"use client";
import { Badge, ServerPagination, Table } from "@/components/stockwell/ui";
import { type Movement, type Store } from "@/lib/stockwell/model";
import { useServerCollection } from "@/lib/stockwell/use-server-collection";
type Props = {
  s: Store;
  query: string;
  pName: (id: string) => string;
};
export function MovementsForm({ s, query, pName }: Props) {
  const result = useServerCollection<Movement>({ collection: "movements", query, pageSize: 25 });
  const movements = result.records;
  return (
    <>
      <div className="form-hint">
        Search products and references using the inventory search field.
      </div>
      {result.error && <p className="form-error" role="alert">{result.error}</p>}
      <Table
        headers={["Date", "Time", "Product", "Type", "Quantity", "Reference", "Reason"]}
        rows={movements.map((m) => [
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
      <ServerPagination page={result.page} pageCount={result.pageCount} count={result.count} pageSize={result.pageSize} setPage={result.setPage} />
    </>
  );
}

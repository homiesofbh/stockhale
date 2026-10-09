import {
  balance,
  paid,
  periodMatch,
  type Product,
  type Store,
  type Trade,
} from "./model";

export type RecordFilters = {
  query: string;
  from: string;
  to: string;
  status: string;
  paymentMethod: string;
};

export function matchesQuery(query: string, ...values: unknown[]) {
  return values.join(" ").toLowerCase().includes(query.trim().toLowerCase());
}

export function getPaymentStatus(store: Store, trade: Trade) {
  if (trade.status === "draft") return "Draft";
  if (trade.status === "void") return "Voided";
  const due = balance(store, trade);
  if (due < 0) return "Credit balance";
  if (due === 0) return "Paid";
  return paid(store, trade) > 0 ? "Partial" : "Unpaid";
}

export function filterTrades(
  store: Store,
  trades: Trade[],
  filters: RecordFilters,
  supplier = false,
) {
  const contacts = supplier ? store.suppliers : store.customers;
  return trades.filter((trade) => {
    const profile = contacts.find((item) => item.id === trade.contactId);
    const contact = profile?.name || "Walk-in customer";
    const products = trade.lines.map(
      (line) =>
        store.products.find((item) => item.id === line.productId)?.name ||
        "Unknown item",
    );
    return (
      periodMatch(trade.date, filters.from, filters.to) &&
      matchesQuery(filters.query, trade.number, trade.reference, contact, profile?.ntn, profile?.company, profile?.phone, trade.walkInName, trade.walkInCompany, trade.walkInPhone, ...products) &&
      (filters.status === "All" ||
        getPaymentStatus(store, trade) === filters.status) &&
      (filters.paymentMethod === "All" ||
        trade.method === filters.paymentMethod)
    );
  });
}

export function searchProducts(products: Product[], query: string) {
  return products.filter((product) =>
    matchesQuery(
      query,
      product.name,
      product.sku,
      product.barcode,
      product.category,
    ),
  );
}

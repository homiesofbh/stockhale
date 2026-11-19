import {
  balance,
  paid,
  periodMatch,
  stock,
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

function normalizeProductSearchText(value: unknown) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function matchesProductQuery(query: string, product: Product) {
  const normalizedQuery = normalizeProductSearchText(query);
  if (!normalizedQuery) return true;
  const fields = [product.name, product.sku, product.barcode, product.category, product.color,
    product.gsm != null ? `${product.gsm} GSM` : "", product.unit || "piece", product.packing,
    product.store, product.size].map(normalizeProductSearchText).filter(Boolean);
  const searchable = fields.join(" ");
  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  const compactFields = fields.join("").replace(/\s+/g, "");
  return normalizedQuery.split(/\s+/).every(term => searchable.includes(term)) || compactFields.includes(compactQuery);
}

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
      matchesQuery(filters.query, trade.number, trade.reference, contact, profile?.ntn, profile?.company, profile?.phone, profile?.mobile, profile?.contactPerson, profile?.salesTaxNumber, profile?.description, trade.walkInName, trade.walkInCompany, trade.walkInPhone, ...products) &&
      (filters.status === "All" ||
        getPaymentStatus(store, trade) === filters.status) &&
      (filters.paymentMethod === "All" ||
        trade.method === filters.paymentMethod)
    );
  });
}

export function filterInventory(store: Store, query: string, category: string, status: string) {
  return store.products.filter(product => {
    const quantity = stock(store, product.id);
    const activityMatches = status === "Inactive" ? product.active === false : status === "All" || product.active !== false;
    const categoryMatches = category === "All" || product.category === category;
    const statusMatches = status === "All" || status === "Inactive" ||
      (status === "Out of stock" ? quantity === 0 :
        status === "Low Stock" || status === "Low stock" ? quantity > 0 && quantity <= product.low : quantity > product.low);
    return activityMatches && categoryMatches && statusMatches && matchesQuery(query, product.name, product.sku, product.barcode, product.category, product.color, product.gsm, product.gsm ? `${product.gsm} GSM` : "");
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
      product.color,
      product.gsm,
      product.packing,
      product.store,
      product.size,
    ),
  );
}

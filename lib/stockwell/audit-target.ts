type Collection = "invoices" | "purchases" | "expenses" | "returns" | "productionRuns" | "recipes" | "bankVouchers" | "dailyCloses" | "products" | "customers" | "suppliers" | "movements";
type Target = { collection: Collection; id: string; label: string; module: string };
const routes: Record<string, Partial<Record<Collection, string>>> = {
  Sales: { invoices: "Sales" }, Billing: { invoices: "Sales" }, Purchases: { purchases: "Purchases" },
  Expenses: { expenses: "Expenses" }, "Returns & Damage": { returns: "Returns & Damage" },
  Production: { productionRuns: "Production", recipes: "Production" }, Payments: { bankVouchers: "Payments" },
  Closing: { dailyCloses: "Closing" }, Inventory: { products: "Inventory", movements: "Inventory" },
  Customers: { customers: "Customers" }, Suppliers: { suppliers: "Suppliers" },
};
const labels: Partial<Record<Collection, string>> = { invoices: "sale", purchases: "purchase", expenses: "expense", returns: "return", productionRuns: "production run", recipes: "recipe", bankVouchers: "bank voucher", dailyCloses: "daily close", products: "product", customers: "customer", suppliers: "supplier", movements: "stock movement" };

export function getFirstRecordTarget(records: string, module: string): Target | null {
  const route = routes[module];
  if (!route) return null;
  // Audit records use `collection: action id (JSON)` segments. Split on semicolons
  // only outside quoted strings and JSON parentheses to avoid matching user text.
  const segments: string[] = [];
  let start = 0, depth = 0, quoted = false, escaped = false;
  for (let i = 0; i < records.length; i++) {
    const char = records[i];
    if (quoted) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === '"') quoted = false; continue; }
    if (char === '"') quoted = true;
    else if (char === "(") depth++;
    else if (char === ")") depth = Math.max(0, depth - 1);
    else if (char === ";" && depth === 0) { segments.push(records.slice(start, i)); start = i + 1; }
  }
  segments.push(records.slice(start));
  for (const segment of segments) {
    const match = segment.trim().match(/^([A-Za-z]+):\s+[^\n]*?\s+([\w-]+)\s+\(/);
    if (!match) continue;
    const collection = match[1] as Collection;
    const targetModule = route[collection];
    if (!targetModule) continue;
    return { collection, id: match[2], label: labels[collection] || "record", module: targetModule };
  }
  return null;
}

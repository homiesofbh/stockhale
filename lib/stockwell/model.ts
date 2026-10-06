export type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  cost: number;
  price: number;
  low: number;
};
export type Contact = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
};
export type Line = {
  productId: string;
  qty: number;
  price: number;
  cost: number;
};
export type Trade = {
  createdAt?: number;
  id: string;
  number: string;
  date: string;
  contactId: string;
  lines: Line[];
  discount: number;
  tax: number;
  paid: number;
  method: "Cash" | "Bank";
  head: string;
};
export type Movement = {
  id: string;
  productId: string;
  qty: number;
  date: string;
  type: string;
  reference: string;
  reason: string;
};
export type Payment = {
  createdAt?: number;
  id: string;
  date: string;
  kind: "Customer" | "Supplier";
  contactId: string;
  tradeId: string;
  amount: number;
  method: "Cash" | "Bank";
  head: string;
  notes: string;
};
export type Expense = {
  id: string;
  date: string;
  category: string;
  head: string;
  amount: number;
  method: "Cash" | "Bank";
  notes: string;
};
export type ReturnRecord = {
  createdAt?: number;
  id: string;
  date: string;
  kind: "Sales return" | "Purchase return" | "Damaged stock";
  tradeId: string;
  productId: string;
  qty: number;
  amount: number;
  cost: number;
  reason: string;
};
export type Store = {
  version: 1;
  products: Product[];
  categories: string[];
  customers: Contact[];
  suppliers: Contact[];
  heads: string[];
  expenseCategories: string[];
  purchases: Trade[];
  invoices: Trade[];
  movements: Movement[];
  payments: Payment[];
  expenses: Expense[];
  returns: ReturnRecord[];
};
export const today = () => new Date().toLocaleDateString("en-CA");
export const uid = () => crypto.randomUUID();
export const round = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
export const money = (n: number) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 2,
  }).format(n);
export const emptyStore = (): Store => ({
  version: 1,
  products: [],
  categories: ["General"],
  customers: [],
  suppliers: [],
  heads: [
    "Sales",
    "Purchases",
    "Expenses",
    "Cash",
    "Bank",
    "Receivables",
    "Payables",
    "Supplier payments",
    "Customer payments",
    "Discounts",
    "Returns",
    "Other income",
    "Other expenses",
  ],
  expenseCategories: ["General", "Rent", "Utilities", "Transport"],
  purchases: [],
  invoices: [],
  movements: [],
  payments: [],
  expenses: [],
  returns: [],
});
export const stock = (s: Store, id: string) =>
  round(
    s.movements
      .filter((m) => m.productId === id)
      .reduce((n, m) => n + m.qty, 0),
  );
export const subtotal = (t: Pick<Trade, "lines">) =>
  round(t.lines.reduce((n, l) => n + l.qty * l.price, 0));
export const total = (t: Pick<Trade, "lines" | "discount" | "tax">) =>
  round((subtotal(t) - t.discount) * (1 + t.tax / 100));
export const returned = (s: Store, id: string) =>
  round(
    s.returns.filter((r) => r.tradeId === id).reduce((n, r) => n + r.amount, 0),
  );
export const paid = (s: Store, t: Trade) =>
  round(
    t.paid +
      s.payments
        .filter((p) => p.tradeId === t.id)
        .reduce((n, p) => n + p.amount, 0),
  );
// A negative balance is a credit owed back to the customer, or due back from the supplier.
export const balance = (s: Store, t: Trade) =>
  round(total(t) - returned(s, t.id) - paid(s, t));
export const contactBalance = (
  s: Store,
  kind: "Customer" | "Supplier",
  id: string,
) =>
  round(
    (kind === "Customer" ? s.invoices : s.purchases)
      .filter((t) => t.contactId === id)
      .reduce((n, t) => n + balance(s, t), 0),
  );
export const periodMatch = (date: string, from: string, to: string) =>
  (!from || date >= from) && (!to || date <= to);
const assert = (ok: boolean, message: string) => {
  if (!ok) throw new Error(message);
};
const validNumber = (n: number, min = 0) => Number.isFinite(n) && n >= min;
export function saveProduct(s: Store, p: Product, opening = 0): Store {
  assert(
    !!p.name.trim() && !!p.sku.trim(),
    "Product name and SKU are required.",
  );
  assert(
    !s.products.some(
      (x) => x.id !== p.id && x.sku.toLowerCase() === p.sku.toLowerCase(),
    ),
    "This SKU is already in use.",
  );
  assert(
    !p.barcode ||
      !s.products.some((x) => x.id !== p.id && x.barcode === p.barcode),
    "This barcode is already assigned to a product.",
  );
  assert(
    [p.cost, p.price, p.low, opening].every((n) => validNumber(n)),
    "Prices, thresholds, and opening stock must be non-negative numbers.",
  );
  const existing = s.products.some((x) => x.id === p.id);
  return {
    ...s,
    products: existing
      ? s.products.map((x) => (x.id === p.id ? p : x))
      : [...s.products, p],
    movements:
      !existing && opening > 0
        ? [
            ...s.movements,
            {
              id: uid(),
              productId: p.id,
              qty: opening,
              date: today(),
              type: "Opening stock",
              reference: p.sku,
              reason: "Opening balance",
            },
          ]
        : s.movements,
  };
}
export function adjustStock(
  s: Store,
  productId: string,
  qty: number,
  reason: string,
  date: string,
): Store {
  assert(
    s.products.some((p) => p.id === productId),
    "Select an existing product.",
  );
  assert(Number.isFinite(qty) && qty !== 0, "Enter a non-zero stock change.");
  assert(
    stock(s, productId) + qty >= 0,
    "This adjustment would make stock negative.",
  );
  assert(!!reason.trim(), "An adjustment reason is required.");
  return {
    ...s,
    movements: [
      ...s.movements,
      {
        id: uid(),
        productId,
        qty,
        date,
        type: qty > 0 ? "Stock in" : "Stock out",
        reference: "Adjustment",
        reason,
      },
    ],
  };
}
export function recordTrade(
  s: Store,
  kind: "Sale" | "Purchase",
  t: Trade,
): Store {
  assert(t.lines.length > 0, "Add at least one product.");
  assert(
    !!t.date && !!t.head && s.heads.includes(t.head),
    "Date and account head are required.",
  );
  assert(
    kind === "Sale"
      ? !t.contactId || s.customers.some((c) => c.id === t.contactId)
      : s.suppliers.some((c) => c.id === t.contactId),
    "Select a valid supplier or customer.",
  );
  assert(
    validNumber(t.discount) &&
      validNumber(t.tax) &&
      t.tax <= 100 &&
      t.discount <= subtotal(t),
    "Discount must not exceed the subtotal; tax must be between 0 and 100%.",
  );
  assert(
    validNumber(t.paid) && t.paid <= total(t),
    "Paid amount must be between zero and the net total.",
  );
  assert(
    kind !== "Sale" || !!t.contactId || t.paid === total(t),
    "Select a customer for a credit or partially paid bill.",
  );
  const demand = new Map<string, number>();
  t.lines.forEach((l) => {
    assert(
      s.products.some((p) => p.id === l.productId),
      "A selected product no longer exists.",
    );
    assert(
      validNumber(l.qty, 0.001) && validNumber(l.price) && validNumber(l.cost),
      "Quantities must be positive and prices non-negative.",
    );
    demand.set(l.productId, (demand.get(l.productId) || 0) + l.qty);
  });
  if (kind === "Sale")
    demand.forEach((qty, id) =>
      assert(
        qty <= stock(s, id),
        `Insufficient stock for ${s.products.find((p) => p.id === id)?.name}.`,
      ),
    );
  const list = kind === "Sale" ? s.invoices : s.purchases;
  const prefix = kind === "Sale" ? "INV" : "PUR";
  const trade = {
    ...t,
    createdAt: Date.now(),
    number: `${prefix}-${String(list.length + 1).padStart(5, "0")}`,
  };
  const moves: Movement[] = trade.lines.map((l) => ({
    id: uid(),
    productId: l.productId,
    qty: l.qty * (kind === "Sale" ? -1 : 1),
    date: t.date,
    type: kind,
    reference: trade.number,
    reason: "",
  }));
  return {
    ...s,
    [kind === "Sale" ? "invoices" : "purchases"]: [...list, trade],
    movements: [...s.movements, ...moves],
    products:
      kind === "Purchase"
        ? s.products.map((p) => {
            const lines = t.lines.filter((l) => l.productId === p.id);
            return lines.length
              ? {
                  ...p,
                  cost: round(
                    lines.reduce((n, l) => n + l.qty * l.price, 0) /
                      lines.reduce((n, l) => n + l.qty, 0),
                  ),
                }
              : p;
          })
        : s.products,
  };
}
export function recordPayment(s: Store, p: Payment): Store {
  const t = (p.kind === "Customer" ? s.invoices : s.purchases).find(
    (t) => t.id === p.tradeId && t.contactId === p.contactId,
  );
  assert(!!t, "Select a bill or purchase belonging to this contact.");
  assert(
    Number.isFinite(p.amount) && Math.abs(p.amount) >= 0.01,
    "Payment must be greater than zero.",
  );
  const due = t ? balance(s, t) : 0;
  assert(
    (due > 0 && p.amount > 0 && p.amount <= due) ||
      (due < 0 && p.amount < 0 && p.amount >= due),
    "Payment or credit settlement exceeds the remaining balance.",
  );
  assert(s.heads.includes(p.head), "Select a valid account head.");
  return { ...s, payments: [...s.payments, { ...p, createdAt: Date.now() }] };
}
export function recordReturn(s: Store, r: ReturnRecord): Store {
  assert(
    validNumber(r.qty, 0.001) && !!r.reason.trim(),
    "Enter a positive quantity and a reason.",
  );
  const p = s.products.find((p) => p.id === r.productId);
  assert(!!p, "Select an existing product.");
  let amount = 0,
    cost = p?.cost || 0;
  if (r.kind !== "Damaged stock") {
    const t = (r.kind === "Sales return" ? s.invoices : s.purchases).find(
      (t) => t.id === r.tradeId,
    );
    const lines = t?.lines.filter((l) => l.productId === r.productId) || [];
    const qty = lines.reduce((n, l) => n + l.qty, 0);
    const previous = s.returns
      .filter(
        (x) =>
          x.kind === r.kind &&
          x.tradeId === r.tradeId &&
          x.productId === r.productId,
      )
      .reduce((n, x) => n + x.qty, 0);
    assert(
      !!t && qty > 0 && r.qty <= round(qty - previous),
      "Return quantity exceeds the remaining quantity on the original transaction.",
    );
    if (t)
      amount = Math.min(
        round(
          ((r.qty * lines.reduce((n, l) => n + l.qty * l.price, 0)) / qty) *
            (subtotal(t) ? 1 - t.discount / subtotal(t) : 1) *
            (1 + t.tax / 100),
        ),
        Math.max(0, round(total(t) - returned(s, t.id))),
      );
    cost = round(lines.reduce((n, l) => n + l.qty * l.cost, 0) / qty);
  }
  const direction = r.kind === "Sales return" ? 1 : -1;
  assert(
    direction > 0 || r.qty <= stock(s, r.productId),
    "Not enough stock for this return or damage entry.",
  );
  const entry = {
    ...r,
    createdAt: Date.now(),
    tradeId: r.kind === "Damaged stock" ? "" : r.tradeId,
    amount,
    cost,
  };
  return {
    ...s,
    returns: [...s.returns, entry],
    movements: [
      ...s.movements,
      {
        id: uid(),
        productId: r.productId,
        qty: r.qty * direction,
        date: r.date,
        type: r.kind,
        reference: r.tradeId
          ? (r.kind === "Sales return" ? s.invoices : s.purchases).find(
              (t) => t.id === r.tradeId,
            )?.number || ""
          : "Damage",
        reason: r.reason,
      },
    ],
  };
}
export type FinancialRow = {
  date: string;
  reference: string;
  type: string;
  head: string;
  method: string;
  amount: number;
  cash: number;
  bank: number;
  contactId: string;
};
export function financialRows(s: Store): FinancialRow[] {
  const rows: FinancialRow[] = [];
  const push = (
    date: string,
    reference: string,
    type: string,
    head: string,
    method: string,
    amount: number,
    flow: number,
    contactId = "",
  ) =>
    rows.push({
      date,
      reference,
      type,
      head,
      method,
      amount: round(amount),
      cash: method === "Cash" ? round(flow) : 0,
      bank: method === "Bank" ? round(flow) : 0,
      contactId,
    });
  s.invoices.forEach((t) =>
    push(
      t.date,
      t.number,
      "Sale",
      t.head,
      t.method,
      total(t),
      t.paid,
      t.contactId,
    ),
  );
  s.purchases.forEach((t) =>
    push(
      t.date,
      t.number,
      "Purchase",
      t.head,
      t.method,
      -total(t),
      -t.paid,
      t.contactId,
    ),
  );
  s.expenses.forEach((e) =>
    push(
      e.date,
      e.notes || "Expense",
      "Expense",
      e.head,
      e.method,
      -e.amount,
      -e.amount,
    ),
  );
  s.payments.forEach((p) =>
    push(
      p.date,
      (p.kind === "Customer" ? s.invoices : s.purchases).find(
        (t) => t.id === p.tradeId,
      )?.number || "",
      `${p.kind} payment`,
      p.head,
      p.method,
      p.amount * (p.kind === "Customer" ? 1 : -1),
      p.amount * (p.kind === "Customer" ? 1 : -1),
      p.contactId,
    ),
  );
  s.returns.forEach((r) =>
    push(
      r.date,
      r.kind === "Damaged stock"
        ? "Damage"
        : [...s.invoices, ...s.purchases].find((t) => t.id === r.tradeId)
            ?.number || "",
      r.kind,
      "Returns",
      "Credit adjustment",
      r.kind === "Sales return"
        ? -r.amount
        : r.kind === "Purchase return"
          ? r.amount
          : -r.qty * r.cost,
      0,
    ),
  );
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}
export function profit(s: Store, from = "", to = "") {
  const invoices = s.invoices.filter((t) => periodMatch(t.date, from, to));
  const sales = invoices.reduce((n, t) => n + subtotal(t) - t.discount, 0);
  const cogs = invoices.reduce(
    (n, t) => n + t.lines.reduce((a, l) => a + l.qty * l.cost, 0),
    0,
  );
  const salesReturns = s.returns.filter(
    (r) => r.kind === "Sales return" && periodMatch(r.date, from, to),
  );
  const returnRevenue = salesReturns.reduce((n, r) => {
    const t = s.invoices.find((t) => t.id === r.tradeId);
    return n + r.amount / (1 + (t?.tax || 0) / 100);
  }, 0);
  const returnCost = salesReturns.reduce((n, r) => n + r.qty * r.cost, 0);
  const damage = s.returns
    .filter((r) => r.kind === "Damaged stock" && periodMatch(r.date, from, to))
    .reduce((n, r) => n + r.qty * r.cost, 0);
  const expenses = s.expenses
    .filter((e) => periodMatch(e.date, from, to))
    .reduce((n, e) => n + e.amount, 0);
  return {
    revenue: round(sales - returnRevenue),
    cogs: round(cogs - returnCost),
    expenses: round(expenses),
    damage: round(damage),
    net: round(sales - returnRevenue - cogs + returnCost - expenses - damage),
  };
}

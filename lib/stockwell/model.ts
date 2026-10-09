import { chequeSettlements, requireOpenDate, type ChequeEvent, type DailyClose, type TradeCorrection, type WalkInLink } from "./operations";
import { bankVoucherLines } from "./bank-vouchers";
import type { BankVoucher } from "./bank-vouchers";
import type { JournalVoucher } from "./journals";
import type { Account } from "./accounts";
export type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  cost: number;
  price: number;
  low: number;
  maximum?: number;
  color?: string;
  gsm?: number;
  packing?: string;
  store?: string;
  size?: string;
  active?: boolean;
  unit?: string;
  supplierIds?: string[];
  variantOf?: string;
};
export type Contact = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  ntn?: string;
  company?: string;
  contactPerson?: string;
  mobile?: string;
  salesTaxNumber?: string;
  description?: string;
  openingBalance?: number;
  openingBalanceDate?: string;
};
export type Line = {
  productId: string;
  unit?: string;
  qty: number;
  price: number;
  cost: number;
  discount?: number;
  packageCount?: number;
  packageSize?: number;
};
export type Trade = {
  status?: "draft" | "posted" | "void";
  postedAt?: string;
  costBefore?: Record<string, number>;
  replacementOf?: string;
  createdAt?: number;
  id: string;
  number: string;
  reference?: string;
  attachments?: Attachment[];
  date: string;
  contactId: string;
  lines: Line[];
  discount: number;
  tax: number;
  paid: number;
  method: string;
  financialAccountId?: string;
  head: string;
  walkInName?: string;
  walkInCompany?: string;
  walkInPhone?: string;
  walkInAddress?: string;
  chequeNumber?: string;
  chequeBank?: string;
  chequeDate?: string;
};
export type FinancialAccount = { id: string; name: string; type: "Bank" | "Wallet"; ledgerAccountId?: string; active?: boolean };
export type Movement = {
  id: string;
  productId: string;
  qty: number;
  date: string;
  type: string;
  reference: string;
  reason: string;
  supplierId?: string;
  packageCount?: number;
  packageSize?: number;
};
export type PartnerEntry = {
  id: string;
  date: string;
  partner: string;
  kind: "Contribution" | "Withdrawal";
  amount: number;
  method: string;
  notes: string;
};
export type Payment = {
  createdAt?: number;
  id: string;
  date: string;
  kind: "Customer" | "Supplier";
  contactId: string;
  tradeId: string;
  amount: number;
  method: string;
  financialAccountId?: string;
  head: string;
  notes: string;
  chequeNumber?: string;
  chequeBank?: string;
  chequeDate?: string;
  chequeStatus?: "pending" | "cleared" | "bounced" | "cancelled";
  clearedDate?: string;
};
export type CrossCheque = {
  id: string;
  sourcePaymentId: string;
  date: string;
  customerId: string;
  destinationKind: "Supplier" | "Partner";
  destinationId: string;
  destinationName: string;
  amount: number;
  status: "pending" | "submitted" | "cleared" | "bounced";
  notes: string;
};
export type Expense = {
  createdAt?: string;
  id: string;
  date: string;
  category: string;
  head: string;
  amount: number;
  method: string;
  financialAccountId?: string;
  notes: string;
  attachments?: Attachment[];
};
export type Attachment = {
  id: string;
  key: string;
  name: string;
  contentType: string;
  size: number;
  status: "pending" | "uploaded" | "failed";
  uploadedAt?: string;
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
  accounts?: Account[];
  journals?: JournalVoucher[];
  bankVouchers?: BankVoucher[];
  corrections?: TradeCorrection[];
  walkInLinks?: WalkInLink[];
  chequeEvents?: ChequeEvent[];
  dailyCloses?: DailyClose[];
  expenseCategories: string[];
  purchases: Trade[];
  invoices: Trade[];
  movements: Movement[];
  payments: Payment[];
  expenses: Expense[];
  returns: ReturnRecord[];
  financialAccounts?: FinancialAccount[];
  units?: string[];
  partners?: PartnerEntry[];
  crossCheques?: CrossCheque[];
};
export const today = (date = new Date()) => date.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
export const isPosted = (t: Trade) => t.status !== "draft" && t.status !== "void";
export const uid = () => crypto.randomUUID();
export const round = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
export const roundQty = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
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
  financialAccounts: [
    { id: "jazzcash", name: "JazzCash", type: "Wallet" },
    { id: "easypaisa", name: "EasyPaisa", type: "Wallet" },
    { id: "nayapay", name: "NayaPay", type: "Wallet" },
  ],
  units: ["piece", "kg", "g", "liter", "ml", "box", "pack", "dozen", "meter", "yard"],
  partners: [],
  crossCheques: [],
});
export const stock = (s: Store, id: string) =>
  roundQty(
    s.movements
      .filter((m) => m.productId === id)
      .reduce((n, m) => n + m.qty, 0),
  );
export const subtotal = (t: Pick<Trade, "lines">) =>
  round(t.lines.reduce((n, l) => n + l.qty * l.price, 0));
export const lineDiscount = (t: Pick<Trade, "lines">) =>
  round(t.lines.reduce((n, l) => n + (l.discount || 0), 0));
export const total = (t: Pick<Trade, "lines" | "discount" | "tax">) =>
  round((subtotal(t) - lineDiscount(t) - t.discount) * (1 + t.tax / 100));
export const returned = (s: Store, id: string) =>
  round(
    s.returns.filter((r) => r.tradeId === id).reduce((n, r) => n + r.amount, 0),
  );
// Legacy cleared cheques used date as the clearance date.
export const paymentAccountId = (s: Store, method: string) =>
  ["Cash", "Bank", "Cheque"].includes(method) ? undefined : s.financialAccounts?.find(a => a.name === method && a.active !== false)?.id;
export const paymentDate = (p: Payment) => p.clearedDate || p.date;
export const isSettledPayment = (p: Payment) =>
  p.method === "Cheque" ? p.chequeStatus === "cleared" : !p.chequeStatus || p.chequeStatus === "cleared";
export const paid = (s: Store, t: Trade) =>
  !isPosted(t) ? 0 : round(
    t.paid +
      s.payments
        .filter((p) => p.tradeId === t.id && isSettledPayment(p))
        .reduce((n, p) => n + p.amount, 0),
  );
// A negative balance is a credit owed back to the customer, or due back from the supplier.
export const balance = (s: Store, t: Trade) =>
  isPosted(t) ? round(total(t) - returned(s, t.id) - paid(s, t)) : 0;
export const contactBalance = (
  s: Store,
  kind: "Customer" | "Supplier",
  id: string,
) =>
  round(
    (kind === "Customer" ? s.invoices : s.purchases)
      .filter((t) => t.contactId === id)
      .reduce((n, t) => n + balance(s, t), 0),
  ) + (s[kind === "Customer" ? "customers" : "suppliers"].find(c => c.id === id)?.openingBalance || 0);
export const periodMatch = (date: string, from: string, to: string) =>
  (!from || date >= from) && (!to || date <= to);
const assert = (ok: boolean, message: string) => {
  if (!ok) throw new Error(message);
};
const validNumber = (n: number, min = 0) => Number.isFinite(n) && n >= min;
/** Preserve leading zeroes and reject ambiguous legacy product codes. */
export function findProductByCode(products: Product[], input: string): Product {
  const code = input.trim();
  if (!code) throw new Error("Scan a barcode or enter an item code first.");
  const matches = products.filter((p) =>
    (p.barcode && p.barcode.trim() === code) || p.sku.trim().toLowerCase() === code.toLowerCase(),
  );
  if (!matches.length) throw new Error(`No product matches barcode or SKU “${code}”.`);
  if (matches.length > 1) throw new Error("This code matches multiple products. Correct their barcode or SKU before scanning.");
  return matches[0];
}
export function saveContact(s: Store, kind: "Customer" | "Supplier", contact: Contact): Store {
  const c = {
    ...contact,
    name: contact.name.trim(),
    phone: (contact.phone || "").trim(),
    email: (contact.email || "").trim(),
    address: (contact.address || "").trim(),
    ntn: (contact.ntn || "").trim(),
  };
  assert(!!c.name, kind === "Customer" ? "Company name is required." : "Supplier name is required.");
  assert(!c.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email), "Enter a valid email or leave it blank.");
  const key = kind === "Customer" ? "customers" : "suppliers";
  return { ...s, [key]: s[key].some((x) => x.id === c.id)
    ? s[key].map((x) => x.id === c.id ? c : x) : [...s[key], c] };
}
export function saveProduct(s: Store, p: Product, opening = 0): Store {
  p = { ...p, sku: p.sku.trim(), barcode: p.barcode.trim(), unit: (p.unit || "piece").trim() };
  assert(
    !!p.name.trim() && !!p.sku.trim(),
    "Product name and SKU are required.",
  );
  assert(!p.variantOf || (p.variantOf !== p.id && s.products.some(x => x.id === p.variantOf)), "Select a valid parent product for this variant.");
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
    !s.products.some((x) => x.id !== p.id &&
      ((p.barcode && x.sku.trim().toLowerCase() === p.barcode.toLowerCase()) ||
       (x.barcode && x.barcode.trim().toLowerCase() === p.sku.toLowerCase()))),
    "A barcode cannot match another product's SKU.",
  );
  assert(!/[\x00-\x1f\x7f]/.test(p.barcode), "Barcode must not contain control characters.");
  assert(
    [p.cost, p.price, p.low, opening].every((n) => validNumber(n)),
    "Prices, thresholds, and opening stock must be non-negative numbers.",
  );
  const existing = s.products.some((x) => x.id === p.id);
  if (!existing && opening > 0) requireOpenDate(s, today());
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
  requireOpenDate(s, date);
  assert(
    s.products.some((p) => p.id === productId),
    "Select an existing product.",
  );
  assert(Number.isFinite(qty) && qty !== 0 && roundQty(qty) === qty, "Enter a non-zero stock change.");
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
  requireOpenDate(s, t.date);
  assert(![...s.invoices, ...s.purchases].some(old => old.id === t.id), "Bill ID already exists.");
  assert(t.status === "draft" || t.date <= today(), "Future bills must remain drafts until the bill date.");
  assert(t.lines.length > 0, "Add at least one product.");
  assert(
    !!t.date && !!t.head && s.heads.includes(t.head),
    "Date and account head are required.",
  );
  assert(
    t.method === "Cash" || t.method === "Bank" || t.method === "Cheque" || (s.financialAccounts || []).some((account) => account.name === t.method && account.active !== false),
    "Select a valid payment method.",
  );
  if (t.method === "Cheque")
    assert(!!t.chequeNumber?.trim() && !!t.chequeBank?.trim() && !!t.chequeDate, "Enter the cheque number, bank, and expected clearance date.");
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
      t.discount + lineDiscount(t) <= subtotal(t),
    "Discount must not exceed the subtotal; tax must be between 0 and 100%.",
  );
  assert(
    validNumber(t.paid) && round(t.paid) === t.paid && t.paid <= total(t),
    "Paid amount must be between zero and the net total.",
  );
  assert(
    kind !== "Sale" || !!t.contactId || t.paid === total(t) || !!(t.walkInName?.trim() || t.walkInCompany?.trim() || t.walkInPhone?.trim()),
    "Enter a walk-in customer name, company, or contact number for a credit bill.",
  );
  const demand = new Map<string, number>();
  t.lines.forEach((l) => {
    assert(
      s.products.some((p) => p.id === l.productId && p.active !== false),
      "A selected product no longer exists.",
    );
    assert(
      validNumber(l.qty, 0.001) && roundQty(l.qty) === l.qty && validNumber(l.price) && validNumber(l.cost) && validNumber(l.discount || 0) && (l.discount || 0) <= l.qty * l.price,
      "Quantities must be positive and prices non-negative.",
    );
    demand.set(l.productId, roundQty((demand.get(l.productId) || 0) + l.qty));
  });
  t = { ...t, lines: t.lines.map(l => ({ ...l, discount: l.discount || 0, cost: kind === "Sale" ? s.products.find(p => p.id === l.productId)!.cost : l.price })) };
  if (kind === "Sale" && t.status !== "draft")
    demand.forEach((qty, id) =>
      assert(
        qty <= stock(s, id),
        `Insufficient stock for ${s.products.find((p) => p.id === id)?.name}.`,
      ),
    );
  assert(Number.isFinite(total(t)) && Number.isSafeInteger(Math.round(total(t) * 100)), "Bill amount exceeds safe currency limits.");
  const list = kind === "Sale" ? s.invoices : s.purchases;
  const prefix = kind === "Sale" ? "INV" : "PUR";
  const number = t.number || `${prefix}-${String(list.reduce((max, old) => Math.max(max, Number(old.number.split("-")[1]) || 0), 0) + 1).padStart(5, "0")}`;
  assert(!list.some(old => old.number === number), "Bill number already exists.");
  let customers = s.customers;
  if (kind === "Sale" && !t.contactId) {
    const phone = (t.walkInPhone || "").replace(/[^0-9+]/g, "");
    const matches = phone ? s.customers.filter(c => c.phone.replace(/[^0-9+]/g, "") === phone) : [];
    assert(matches.length <= 1, "This phone matches multiple customers. Select the correct customer explicitly.");
    const customer = matches[0] || { id: uid(), name: t.walkInName?.trim() || t.walkInCompany?.trim() || `Walk-in ${number}`, company: t.walkInCompany?.trim() || "", phone: t.walkInPhone?.trim() || "", address: t.walkInAddress?.trim() || "", email: "" };
    customers = matches.length ? s.customers : [...s.customers, customer];
    t = { ...t, contactId: customer.id };
  }
  const trade = {
    ...t,
    financialAccountId: paymentAccountId(s, t.method),
    createdAt: Date.now(),
    number,
    paid: t.status !== "draft" && t.method === "Cheque" ? 0 : t.paid,
    status: t.status === "draft" ? "draft" as const : "posted" as const,
    postedAt: t.status === "draft" ? undefined : t.postedAt || new Date().toISOString(),
    costBefore: kind === "Purchase" && t.status !== "draft" ? Object.fromEntries(t.lines.map(l => [l.productId, s.products.find(p => p.id === l.productId)!.cost])) : undefined,
  };
  const moves: Movement[] = trade.lines.map((l) => ({
    id: uid(),
    productId: l.productId,
    qty: l.qty * (kind === "Sale" ? -1 : 1),
    date: t.date,
    type: kind,
    reference: trade.number,
    reason: "",
    supplierId: kind === "Purchase" ? trade.contactId : undefined,
    packageCount: l.packageCount,
    packageSize: l.packageSize,
  }));
  return {
    ...s,
    [kind === "Sale" ? "invoices" : "purchases"]: [...list, trade],
    customers,
    movements: trade.status === "draft" ? s.movements : [...s.movements, ...moves],
    payments: trade.status !== "draft" && t.method === "Cheque" && t.paid > 0
      ? [...s.payments, { id: uid(), date: t.date, kind: kind === "Sale" ? "Customer" : "Supplier", contactId: t.contactId, tradeId: trade.id, amount: t.paid, method: "Cheque", head: t.head, notes: "Cheque received with bill", chequeNumber: t.chequeNumber, chequeBank: t.chequeBank, chequeDate: t.chequeDate, chequeStatus: "pending" as const }]
      : s.payments,
    products:
      kind === "Purchase" && trade.status !== "draft"
        ? s.products.map((p) => {
            const lines = t.lines.filter((l) => l.productId === p.id);
            return lines.length
              ? {
                  ...p,
                  supplierIds: Array.from(new Set([...(p.supplierIds || []), trade.contactId].filter(Boolean))),
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
  requireOpenDate(s, p.date);
  assert(!!t && isPosted(t), "Select a bill or purchase belonging to this contact.");
  assert(
    Number.isFinite(p.amount) && Math.abs(p.amount) >= 0.01 && round(p.amount) === p.amount,
    "Payment must be greater than zero.",
  );
  const due = t ? balance(s, t) : 0;
  const pendingCheques = s.payments
    .filter((payment) => payment.tradeId === p.tradeId && payment.chequeStatus === "pending")
    .reduce((sum, payment) => sum + Math.abs(payment.amount), 0);
  assert(
    (due > 0 && p.amount > 0 && p.amount + pendingCheques <= due) ||
      (due < 0 && p.amount < 0 && Math.abs(p.amount) + pendingCheques <= Math.abs(due)),
    "Payment or credit settlement exceeds the remaining balance.",
  );
  assert(s.heads.includes(p.head), "Select a valid account head.");
  assert(
    p.method === "Cash" || p.method === "Bank" || p.method === "Cheque" || (s.financialAccounts || []).some((account) => account.name === p.method && account.active !== false),
    "Select a valid payment method.",
  );
  if (p.method === "Cheque") {
    assert(!!p.chequeNumber?.trim() && !!p.chequeBank?.trim() && !!p.chequeDate, "Enter the cheque number, bank, and expected clearance date.");
    p.chequeStatus = "pending";
  }
  return { ...s, payments: [...s.payments, { ...p, financialAccountId: paymentAccountId(s, p.method), createdAt: Date.now() }] };
}
export function clearCheque(s: Store, paymentId: string): Store {
  const payment = s.payments.find((p) => p.id === paymentId && p.chequeStatus === "pending");
  assert(!!payment, "This cheque is no longer pending.");
  return { ...s, payments: s.payments.map((p) => p.id === paymentId ? { ...p, chequeStatus: "cleared", clearedDate: today() } : p) };
}
export function recordReturn(s: Store, r: ReturnRecord): Store {
  requireOpenDate(s, r.date);
  assert(
    validNumber(r.qty, 0.001) && roundQty(r.qty) === r.qty && !!r.reason.trim(),
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
      !!t && isPosted(t) && qty > 0 && r.qty <= roundQty(qty - previous),
      "Return quantity exceeds the remaining quantity on the original transaction.",
    );
    if (t)
      amount = Math.min(
        round(
          ((r.qty * lines.reduce((n, l) => n + l.qty * l.price - (l.discount || 0), 0)) / qty) *
            (subtotal(t) - lineDiscount(t) ? 1 - t.discount / (subtotal(t) - lineDiscount(t)) : 1) *
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
  debit?: number;
  credit?: number;
  date: string;
  reference: string;
  type: string;
  head: string;
  method: string;
  financialAccountId?: string;
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
    financialAccountId = "",
  ) =>
    rows.push({
      date,
      reference,
      type,
      head,
      method,
      amount: round(amount),
      cash: method === "Cash" ? round(flow) : 0,
      bank: method !== "Cash" && method !== "Credit adjustment" ? round(flow) : 0,
      contactId,
      financialAccountId: financialAccountId || (["Cash", "Bank", "Cheque"].includes(method) ? undefined : s.financialAccounts?.find(a => a.name === method)?.id),
    });
  const original = (t: Trade) => (s.corrections || []).find(c => c.tradeId === t.id)?.before || t;
  s.invoices.map(original).filter(isPosted).forEach((t) =>
    push(
      t.date,
      t.number,
      "Sale",
      t.head,
      t.method,
      total(t),
      t.paid,
      t.contactId,
      t.financialAccountId,
    ),
  );
  s.purchases.map(original).filter(isPosted).forEach((t) =>
    push(
      t.date,
      t.number,
      "Purchase",
      t.head,
      t.method,
      -total(t),
      -t.paid,
      t.contactId,
      t.financialAccountId,
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
      "",
      e.financialAccountId,
    ),
  );
  s.payments.forEach(p => {
    const settlements = p.method === "Cheque" ? chequeSettlements(s, p) : [{ date: p.date, amount: p.amount, accountId: p.financialAccountId, status: "paid" }];
    settlements.forEach(entry => push(entry.date, (p.kind === "Customer" ? s.invoices : s.purchases).find(t => t.id === p.tradeId)?.number || "", `${p.kind} payment${entry.status === "bounced" ? " reversal" : ""}`, p.head,
      p.method === "Cheque" && entry.accountId ? s.financialAccounts?.find(a => a.id === entry.accountId)?.name || "Cheque" : p.method,
      entry.amount * (p.kind === "Customer" ? 1 : -1), entry.amount * (p.kind === "Customer" ? 1 : -1), p.contactId, entry.accountId));
  });
  (s.corrections || []).forEach(c => {
    const sign = c.kind === "Sale" ? 1 : -1;
    const oldTotal = total(c.before), newTotal = isPosted(c.after) ? total(c.after) : 0;
    const newPaid = isPosted(c.after) ? c.after.paid : 0;
    if (c.before.head === c.after.head) push(c.date, c.before.number, "Bill correction", c.after.head, c.after.method, (newTotal - oldTotal) * sign, (newPaid - c.before.paid) * sign, c.after.contactId, c.after.financialAccountId);
    else { push(c.date, c.before.number, "Bill correction reversal", c.before.head, c.before.method, -oldTotal * sign, -c.before.paid * sign, c.before.contactId, c.before.financialAccountId); push(c.date, c.after.number, "Bill correction", c.after.head, c.after.method, newTotal * sign, newPaid * sign, c.after.contactId, c.after.financialAccountId); }
  });
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
  const postLines = (date: string, reference: string, type: string, lines: JournalVoucher["lines"]) => {
    lines.forEach(line => {
      const account = s.accounts?.find(a => a.id === line.accountId);
      const bank = s.financialAccounts?.find(a => a.ledgerAccountId === line.accountId);
      const amount = round(line.debit - line.credit);
      rows.push({
        date, reference, type, head: account?.name || "Unknown account", method: bank?.name || "Journal adjustment",
        amount, debit: line.debit, credit: line.credit,
        cash: !bank && account?.name === "Cash" && account.type === "Asset" ? amount : 0,
        bank: bank ? amount : 0, financialAccountId: bank?.id, contactId: "",
      });
    });
  };
  (s.journals || []).filter(v => v.status === "posted").forEach(v => postLines(v.date, v.number, "Journal", v.lines));
  (s.bankVouchers || []).filter(v => v.status === "posted").forEach(v => postLines(v.date, v.number, `Bank ${v.kind.toLowerCase()}`, bankVoucherLines(s, v)));
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}
export function profit(s: Store, from = "", to = "") {
  const invoices = s.invoices.map(t => s.corrections?.find(c => c.tradeId === t.id)?.before || t).filter(isPosted).filter((t) => periodMatch(t.date, from, to));
  const salesCorrections = (s.corrections || []).filter(c => c.kind === "Sale" && periodMatch(c.date, from, to));
  const salesDelta = salesCorrections.reduce((n, c) => n + (isPosted(c.after) ? subtotal(c.after) - c.after.discount : 0) - (subtotal(c.before) - c.before.discount), 0);
  const costDelta = salesCorrections.reduce((n, c) => n + (isPosted(c.after) ? c.after.lines.reduce((x, l) => x + l.qty * l.cost, 0) : 0) - c.before.lines.reduce((x, l) => x + l.qty * l.cost, 0), 0);
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
    revenue: round(sales + salesDelta - returnRevenue),
    cogs: round(cogs + costDelta - returnCost),
    expenses: round(expenses),
    damage: round(damage),
    net: round(sales + salesDelta - returnRevenue - cogs - costDelta + returnCost - expenses - damage),
  };
}

import { cashChequeSettlement, chequeSettlements, requireOpenDate, validDate, type ChequeEvent, type DailyClose, type TradeCorrection, type WalkInLink } from "./operations";
import { bankVoucherLines } from "./bank-vouchers";
import type { BankVoucher } from "./bank-vouchers";
import type { JournalVoucher } from "./journals";
import { chartAccounts, type Account } from "./accounts";
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
export type FinancialBalanceSnapshot = { cash: number; bank: number; bankAccounts?: { id: string; name: string; balance: number }[] };
export type Trade = {
  status?: "draft" | "posted" | "void";
  postedAt?: string;
  costBefore?: Record<string, number>;
  replacementOf?: string;
  createdAt?: number;
  createdBy?: string;
  createdByName?: string;
  balanceAfter?: FinancialBalanceSnapshot;
  id: string;
  number: string;
  previousNumbers?: string[];
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
export type FinancialAccount = { createdAt?: string; id: string; name: string; type: "Bank" | "Wallet"; accountNumber?: string; ledgerAccountId?: string; openingBalance?: number; openingDate?: string; active?: boolean };
export type Movement = {
  id: string;
  createdAt?: number;
  productId: string;
  qty: number;
  date: string;
  type: string;
  reference: string;
  reason: string;
  supplierId?: string;
  packageCount?: number;
  packageSize?: number;
  financialAmount?: number;
  originalPurchaseDate?: string;
  financialHead?: string;
  financialContactId?: string;
};
export type StockCount = {
  id: string;
  date: string;
  status: "draft" | "posted";
  createdAt: number;
  postedAt?: number;
  lines: { productId: string; expected: number; counted?: number }[];
};
export type PartnerEntry = {
  createdAt?: number;
  balanceAfter?: FinancialBalanceSnapshot;
  id: string;
  date: string;
  partner: string;
  kind: "Contribution" | "Withdrawal";
  amount: number;
  method: string;
  financialAccountId?: string;
  notes: string;
};
export type Payment = {
  createdAt?: number;
  balanceAfter?: FinancialBalanceSnapshot;
  id: string;
  date: string;
  kind: "Customer" | "Supplier";
  contactId: string;
  tradeId: string;
  allocations?: { tradeId: string; amount: number }[];
  advance?: boolean;
  advanceApplication?: boolean;
  sourceAdvanceId?: string;
  accountLevel?: boolean;
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
  allocations?: { tradeId: string; amount: number }[];
  status: "pending" | "submitted" | "cleared" | "bounced" | "cancelled";
  notes: string;
};
export type Expense = {
  createdAt?: string;
  createdBy?: string;
  createdByName?: string;
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
  number?: string;
  date: string;
  kind: "Sales return" | "Purchase return" | "Damaged stock";
  tradeId: string;
  productId: string;
  qty: number;
  amount: number;
  cost: number;
  reason: string;
};
export function assignReturnNumbers(returns: ReturnRecord[]): ReturnRecord[] {
  const ordered = returns.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const used = new Set(ordered.map(item => Number(/^RTN-(\d+)$/.exec(item.number || "")?.[1] || 0).toString()).filter(value => value !== "0"));
  let next = Math.max(0, ...ordered.map(item => Number(/^RTN-(\d+)$/.exec(item.number || "")?.[1] || 0))) + 1;
  const numbered = new Map(ordered.map(item => {
    if (item.number) return item;
    while (used.has(String(next))) next++;
    const number = `RTN-${String(next).padStart(5, "0")}`;
    used.add(String(next++));
    return { ...item, number };
  }).map(item => [item.id, item] as const));
  return returns.map(item => numbered.get(item.id) || item);
}
export function returnNotesWithNumbers(payment: Payment, returns: ReturnRecord[], hideUnmatched = false): string {
  const prefix = "Automatic refund for return";
  if (payment.amount >= 0 || !payment.notes?.startsWith(prefix + " ")) return payment.notes;
  const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
  const kind = payment.kind === "Supplier" ? "Purchase return" : "Sales return";
  const linked = returns.filter(item => item.kind === kind && item.tradeId === payment.tradeId && !!payment.tradeId);
  const references = payment.notes.slice(prefix.length).trim().split(/,\s*/);
  const claimed = new Set(linked.filter(item => references.includes(item.id) || (!!item.number && references.includes(item.number))).map(item => item.id));
  const resolved = references.map(reference => {
    if (!uuid.test(reference)) return reference;
    const exact = linked.find(item => item.id === reference);
    if (exact) { claimed.add(exact.id); return exact.number; }
    const matching = linked.filter(item => item.productId === reference && item.date === payment.date);
    const available = matching.filter(item => !claimed.has(item.id)).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || a.id.localeCompare(b.id));
    const match = available[0];
    if (match) claimed.add(match.id);
    return match?.number;
  });
  if (!hideUnmatched && resolved.some(reference => !reference)) return payment.notes;
  const numbers = [...new Set(resolved.filter(Boolean))].join(", ");
  return numbers ? `${prefix} ${numbers}` : prefix;
}
export type RecipeIngredient = { productId: string; quantity: number };
export type Recipe = { id: string; name: string; outputProductId: string; outputQuantity: number; ingredients: RecipeIngredient[] };
export type ProductionRunIngredient = RecipeIngredient & { unitCost: number };
export type ProductionRun = { id: string; recipeId: string; recipeName: string; date: string; reference: string; batches: number; outputProductId: string; outputQuantity: number; outputUnitCost: number; materialCost: number; ingredients: ProductionRunIngredient[]; actorId: string; actorName: string };
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
  stockCounts?: StockCount[];
  payments: Payment[];
  expenses: Expense[];
  returns: ReturnRecord[];
  financialAccounts?: FinancialAccount[];
  units?: string[];
  partnerNames?: string[];
  partners?: PartnerEntry[];
  crossCheques?: CrossCheque[];
  recipes: Recipe[];
  productionRuns: ProductionRun[];
};
export const today = (date = new Date()) => date.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
export const isPosted = (t: Trade) => t.status !== "draft" && t.status !== "void";
export const compareTradeNumbersNewestFirst = (a: Trade, b: Trade) =>
  b.number.localeCompare(a.number, undefined, { numeric: true }) || b.date.localeCompare(a.date);
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
export const standardUnits = ["yard", "meter", "kg", "piece", "g", "liter", "ml", "box", "pack", "dozen"];
const wholeQuantityUnits = new Set([
  "piece", "pieces", "pc", "pcs", "each", "ea", "unit", "units",
  "box", "boxes", "pack", "packs", "dozen", "dozens", "pair", "pairs",
  "roll", "rolls", "bundle", "bundles", "carton", "cartons", "set", "sets",
]);
export function requiresWholeQuantity(unit: string) {
  return wholeQuantityUnits.has(unit.trim().toLowerCase());
}
export function tradeLineUnit(line: Line, product?: Product) {
  return line.unit?.trim() || product?.unit?.trim() || "piece";
}
export function validateTradeQuantity(line: Line, product?: Product) {
  const unit = tradeLineUnit(line, product);
  assert(!requiresWholeQuantity(unit) || Number.isInteger(line.qty), `Enter a whole-number quantity for ${product?.name || "this product"} (${unit}).`);
}
export function orderedUnits(units: string[] = standardUnits) {
  const order = new Map(standardUnits.map((unit, index) => [unit, index]));
  return units
    .map((unit, index) => ({ unit, index, priority: order.get(unit.trim().toLowerCase()) ?? standardUnits.length }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map(({ unit }) => unit);
}
export function availableUnits(units: string[] = [], productUnits: (string | undefined)[] = []) {
  const unique = new Map<string, string>();
  for (const unit of [...standardUnits, ...units, ...productUnits]) {
    const value = unit?.trim();
    if (value && !unique.has(value.toLocaleLowerCase())) unique.set(value.toLocaleLowerCase(), value);
  }
  return orderedUnits([...unique.values()]);
}
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
  stockCounts: [],
  payments: [],
  expenses: [],
  returns: [],
  financialAccounts: [],
  units: standardUnits,
  partnerNames: [],
  partners: [],
  crossCheques: [],
  recipes: [],
  productionRuns: [],
});
export function normalizeStore(value: Store): Store {
  const defaults = emptyStore();
  const products = value.products || [];
  const productionRuns = (value.productionRuns || []).map(run => {
    const ingredients = (run.ingredients || []).map(item => ({ ...item, unitCost: Number.isFinite((item as { unitCost?: number }).unitCost) ? (item as { unitCost: number }).unitCost : products.find(product => product.id === item.productId)?.cost || 0 }));
    const materialCost = Number.isFinite((run as { materialCost?: number }).materialCost) ? run.materialCost : round(ingredients.reduce((sum, item) => sum + item.quantity * item.unitCost, 0));
    return { ...run, ingredients, materialCost, outputUnitCost: Number.isFinite((run as { outputUnitCost?: number }).outputUnitCost) ? run.outputUnitCost : run.outputQuantity ? round(materialCost / run.outputQuantity) : 0 };
  });
  return {
    ...defaults,
    ...value,
    products,
    accounts: value.accounts || [],
    journals: value.journals || [],
    bankVouchers: value.bankVouchers || [],
    corrections: value.corrections || [],
    walkInLinks: value.walkInLinks || [],
    chequeEvents: value.chequeEvents || [],
    dailyCloses: value.dailyCloses || [],
    stockCounts: value.stockCounts || [],
    financialAccounts: (value.financialAccounts || []).filter(
      (account) => !["jazzcash", "easypaisa", "nayapay"].includes(account.id),
    ),
    units: value.units || defaults.units,
    partnerNames: value.partnerNames || [],
    partners: value.partners || [],
    crossCheques: value.crossCheques || [],
    recipes: value.recipes || [],
    productionRuns,
  };
}
export const stock = (s: Store, id: string) =>
  roundQty(
    s.movements
      .filter((m) => m.productId === id)
      .reduce((n, m) => n + m.qty, 0),
  );
export function startStockCount(s: Store, date = today()): Store {
  requireOpenDate(s, date);
  assert(s.products.some(product => product.active !== false), "Add an active product before starting a stock count.");
  const count: StockCount = {
    id: uid(),
    date,
    status: "draft",
    createdAt: Date.now(),
    lines: s.products.filter(product => product.active !== false).map(product => ({ productId: product.id, expected: stock(s, product.id) })),
  };
  return { ...s, stockCounts: [...(s.stockCounts || []), count] };
}
export function postStockCount(s: Store, countId: string, quantities: Record<string, number>): Store {
  const count = (s.stockCounts || []).find(item => item.id === countId);
  assert(!!count && count.status === "draft", "This stock count is no longer open.");
  if (!count || count.status !== "draft") throw new Error("This stock count is no longer open.");
  requireOpenDate(s, count.date);
  let next = s;
  const lines = count.lines.map(line => {
    const counted = quantities[line.productId];
    assert(Number.isFinite(counted) && counted >= 0 && roundQty(counted) === counted, "Enter a valid counted quantity for every product.");
    assert(stock(s, line.productId) === line.expected, "Stock changed after this count began. Start a new count before posting.");
    const delta = roundQty(counted - line.expected);
    if (delta) next = {
      ...next,
      movements: [...next.movements, {
        id: uid(), createdAt: Date.now(), productId: line.productId, qty: delta, date: count.date,
        type: delta > 0 ? "Stock in" : "Stock out", reference: `COUNT-${count.id}`, reason: "Physical stock count",
      }],
    };
    return { ...line, counted };
  });
  return {
    ...next,
    stockCounts: (next.stockCounts || []).map(item => item.id === countId ? { ...item, status: "posted", postedAt: Date.now(), lines } : item),
  };
}
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
        .filter((p) => isSettledPayment(p))
        .reduce((n, p) => n + (p.tradeId === t.id ? p.amount : p.allocations?.filter(a => a.tradeId === t.id).reduce((sum, a) => sum + a.amount, 0) || 0), 0) +
      (s.crossCheques || []).filter(cheque => cheque.destinationKind === "Supplier" && cheque.destinationId === t.contactId)
        .reduce((sum, cheque) => {
          const source = s.payments.find(payment => payment.id === cheque.sourcePaymentId);
          const allocated = (cheque.allocations || []).filter(allocation => allocation.tradeId === t.id).reduce((n, allocation) => n + allocation.amount, 0);
          const settledRatio = source ? chequeSettlements(s, source).reduce((n, entry) => n + entry.amount, 0) / Math.max(cheque.amount, 1) : 0;
          return sum + allocated * settledRatio;
        }, 0),
  );
// A negative balance is a credit owed back to the customer, or due back from the supplier.
export const balance = (s: Store, t: Trade) =>
  isPosted(t) ? round(total(t) - returned(s, t.id) - paid(s, t)) : 0;
/** Settled advances and supplier account payments not matched to individual bills. */
export const unappliedAdvanceBalance = (s: Store, kind: "Customer" | "Supplier", id: string) => round(availableAdvancePayments(s, kind, id).reduce((sum, item) => sum + item.amount, 0));
export const availableAdvancePayments = (s: Store, kind: "Customer" | "Supplier", id: string) =>
  s.payments.filter(payment => payment.kind === kind && payment.contactId === id && payment.advance && !payment.tradeId && isSettledPayment(payment) && !(s.crossCheques || []).some(cheque => cheque.sourcePaymentId === payment.id))
    .map(payment => {
      const applied = s.payments.filter(item => item.advanceApplication && item.sourceAdvanceId === payment.id && isSettledPayment(item)).reduce((sum, item) => sum + item.amount, 0);
      return { payment, amount: round(payment.amount - applied) };
    }).filter(item => item.amount > 0);
export const advanceAppliedToTrade = (s: Store, tradeId: string) => round(s.payments.filter(payment => payment.advanceApplication && payment.tradeId === tradeId && isSettledPayment(payment)).reduce((sum, payment) => sum + payment.amount, 0));
export const forwardedSupplierChequeBalance = (s: Store, supplierId: string) => round(
  (s.crossCheques || []).filter(c => c.destinationKind === "Supplier" && c.destinationId === supplierId).reduce((sum, cheque) => {
    const source = s.payments.find(payment => payment.id === cheque.sourcePaymentId);
    const unallocated = Math.max(0, cheque.amount - (cheque.allocations || []).reduce((n, allocation) => n + allocation.amount, 0));
    return sum + (source?.method === "Cheque" ? chequeSettlements(s, source).reduce((settled, entry) => settled + entry.amount, 0) * (unallocated / Math.max(cheque.amount, 1)) : 0);
  }, 0),
);
export const unappliedCreditBalance = (s: Store, kind: "Customer" | "Supplier", id: string) => round(
  unappliedAdvanceBalance(s, kind, id) +
  s.payments.filter(p => p.kind === kind && p.contactId === id && p.accountLevel && !p.tradeId && isSettledPayment(p)).reduce((sum, p) => sum + p.amount, 0) +
  (kind === "Supplier" ? forwardedSupplierChequeBalance(s, id) : 0),
);
export const contactBalance = (
  s: Store,
  kind: "Customer" | "Supplier",
  id: string,
) =>
  round(
    (kind === "Customer" ? s.invoices : s.purchases)
      .filter((t) => t.contactId === id)
      .reduce((n, t) => n + balance(s, t), 0),
  ) + (() => { const contact = s[kind === "Customer" ? "customers" : "suppliers"].find(c => c.id === id); return contact?.openingBalanceDate && contact.openingBalanceDate > today() ? 0 : contact?.openingBalance || 0; })()
    - unappliedCreditBalance(s, kind, id);
export const supplierPayableBalance = (s: Store, supplierId: string) => {
  const balance = contactBalance(s, "Supplier", supplierId);
  const pending = s.payments.filter(p => p.kind === "Supplier" && p.contactId === supplierId && p.method === "Cheque" && (p.chequeStatus || "pending") === "pending" && !p.clearedDate);
  const pendingOutgoing = pending.reduce((sum, p) => sum + Math.max(p.amount, 0), 0);
  const pendingRefunds = pending.reduce((sum, p) => sum + Math.max(-p.amount, 0), 0);
  const pendingForwarded = (s.crossCheques || []).filter(c => c.destinationKind === "Supplier" && c.destinationId === supplierId && ["pending", "submitted"].includes(c.status)).reduce((sum, c) => {
    const source = s.payments.find(p => p.id === c.sourcePaymentId);
    return sum + (source?.kind === "Customer" && source.method === "Cheque" && source.amount > 0 && (source.chequeStatus || "pending") === "pending" && !source.clearedDate ? source.amount : 0);
  }, 0);
  if (balance > 0) return round(Math.max(0, balance - pendingOutgoing - pendingForwarded));
  if (balance < 0) return -round(Math.max(0, Math.abs(balance) - pendingRefunds));
  return 0;
};
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
  const key = kind === "Customer" ? "customers" : "suppliers";
  const previous = s[key].find(existing => existing.id === contact.id);
  const openingBalance = contact.openingBalance ?? 0;
  const openingBalanceDate = (contact.openingBalanceDate || "").trim();
  const c = {
    ...contact,
    name: contact.name.trim(),
    phone: (contact.phone || "").trim(),
    email: (contact.email || "").trim(),
    address: (contact.address || "").trim(),
    ntn: (contact.ntn || "").trim(),
  };
  assert(!!c.name, kind === "Customer" ? "Enter a customer or company name." : "Enter a supplier name.");
  assert(!c.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email), "Enter a valid email or leave it blank.");
  assert(Number.isFinite(openingBalance) && openingBalance >= 0 && round(openingBalance) === openingBalance, "Opening balance must be zero or more, with no more than two decimals.");
  assert(!openingBalanceDate || validDate(openingBalanceDate), "Enter a real calendar date for the opening balance.");
  assert(openingBalance === 0 || !!openingBalanceDate || previous?.openingBalance === openingBalance, "Enter the date when this opening balance took effect.");
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
              createdAt: Date.now(),
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
        createdAt: Date.now(),
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
  editingPurchaseDraft = false,
): Store {
  if (editingPurchaseDraft && kind === "Purchase" && t.status === "draft") assert(validDate(t.date), "Enter a valid date.");
  else requireOpenDate(s, t.date);
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
  assert(validNumber(t.paid) && round(t.paid) === t.paid && (t.status === "draft" || t.paid <= total(t)), "Paid amount cannot exceed the bill's net total.");
  assert(
    kind !== "Sale" || !!t.contactId || t.paid === total(t) || !!(t.walkInName?.trim() || t.walkInCompany?.trim() || t.walkInPhone?.trim()),
    "Enter a walk-in customer name, company, or contact number for a credit bill.",
  );
  const demand = new Map<string, number>();
  t.lines.forEach((l) => {
    const product = s.products.find(p => p.id === l.productId && p.active !== false);
    assert(!!product, "A selected product no longer exists.");
    validateTradeQuantity(l, product);
    assert(
      validNumber(l.qty, 0.5) && roundQty(l.qty) === l.qty && validNumber(l.price, 1) && validNumber(l.cost) && validNumber(l.discount || 0) && (l.discount || 0) <= l.qty * l.price,
      "Quantities must be at least 0.5 with up to three decimals, rates at least 1, and line discounts within the line subtotal.",
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
  const draftPrefix = kind === "Sale" ? "SL" : "PRO";
  const officialSequence = [...s.invoices, ...s.purchases].filter(old => old.status !== "draft");
  const maxOfficialNumber = officialSequence.reduce((max, old) => Math.max(max, Number(/^(?:INV|PUR)-(\d+)$/.exec(old.number)?.[1] || 0)), 0);
  const maxDraftNumber = list.reduce((max, old) => Math.max(max, Number(new RegExp("^" + draftPrefix + "-(\\d{5})$").exec(old.number)?.[1] || 0)), 0);
  const draftPattern = new RegExp("^" + draftPrefix + "-\\d{5}$");
  const number = t.status === "draft"
    ? draftPattern.test(t.number || "") ? t.number : draftPrefix + "-" + String(maxDraftNumber + 1).padStart(5, "0")
    : t.number?.startsWith(prefix + "-") ? t.number : prefix + "-" + String(maxOfficialNumber + 1).padStart(5, "0");
  assert(![...s.invoices, ...s.purchases].some(old => old.number === number), "This bill reference is already in use. Refresh the bill list and try again to get a new reference.");
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
    createdAt: trade.createdAt,
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
  if (p.accountLevel) {
    assert(p.kind === "Supplier" && !p.advance && !p.tradeId && !!p.contactId && s.suppliers.some(supplier => supplier.id === p.contactId), "Select a supplier account for this payment.");
    assert(Number.isFinite(p.amount) && p.amount !== 0 && round(p.amount) === p.amount, "Enter a valid supplier account payment amount.");
    const remaining = supplierPayableBalance(s, p.contactId);
    assert((remaining > 0 && p.amount > 0 && p.amount <= remaining) || (remaining < 0 && p.amount < 0 && Math.abs(p.amount) <= Math.abs(remaining)), "Payment exceeds the supplier’s remaining payable balance.");
    assert(s.heads.includes(p.head), "Select a valid account head.");
    assert(p.method === "Cash" || p.method === "Bank" || p.method === "Cheque" || (s.financialAccounts || []).some(a => a.name === p.method && a.active !== false), "Select a valid payment method.");
    if (p.method === "Cheque") {
      assert(!!p.chequeNumber?.trim() && !!p.chequeBank?.trim() && !!p.chequeDate, "Enter the cheque number, bank, and expected clearance date.");
      p.chequeStatus = "pending";
    }
    return { ...s, payments: [...s.payments, { ...p, financialAccountId: paymentAccountId(s, p.method), createdAt: Date.now() }] };
  }
  if (p.advanceApplication) {
    const source = s.payments.find(payment => payment.id === p.sourceAdvanceId && payment.advance && !payment.tradeId && payment.kind === p.kind && payment.contactId === p.contactId && isSettledPayment(payment));
    const used = s.payments.filter(payment => payment.advanceApplication && payment.sourceAdvanceId === p.sourceAdvanceId && isSettledPayment(payment)).reduce((sum, payment) => sum + payment.amount, 0);
    assert(!!source && !(s.crossCheques || []).some(cheque => cheque.sourcePaymentId === source!.id), "Choose an available, settled advance for this bill.");
    assert(p.method === "Credit adjustment" && !!t && isPosted(t) && t.contactId === p.contactId, "Advance applications must be linked to a posted bill for the same contact.");
    assert(Number.isFinite(p.amount) && p.amount > 0 && round(p.amount) === p.amount && p.amount <= source!.amount - used, "The applied amount exceeds the remaining advance balance.");
    assert(p.amount <= Math.max(0, balance(s, t!)), "The applied advance exceeds this bill's remaining balance.");
    assert(s.heads.includes(p.head), "Choose an existing account head from the list.");
    return { ...s, payments: [...s.payments, { ...p, createdAt: Date.now() }] };
  }
  if (p.advance) {
    assert(!p.tradeId && !!p.contactId, "Select a customer or supplier for the advance payment.");
    assert(Number.isFinite(p.amount) && p.amount >= 0.01 && round(p.amount) === p.amount, "Advance payment must be greater than zero.");
    assert(s.heads.includes(p.head), "Select a valid account head.");
    assert(p.method === "Cash" || p.method === "Bank" || p.method === "Cheque" || (s.financialAccounts || []).some(a => a.name === p.method && a.active !== false), "Select a valid payment method.");
    if (p.method === "Cheque") {
      assert(!!p.chequeNumber?.trim() && !!p.chequeBank?.trim() && !!p.chequeDate, "Enter the cheque number, bank, and expected clearance date.");
      p.chequeStatus = "pending";
    }
    return { ...s, payments: [...s.payments, { ...p, financialAccountId: paymentAccountId(s, p.method), createdAt: Date.now() }] };
  }
  if (p.allocations?.length) {
    assert(!p.tradeId && !p.accountLevel && !!p.contactId, "Choose a saved contact before allocating this payment to bills.");
    assert(p.allocations.every(allocation => Number.isFinite(allocation.amount) && allocation.amount > 0 && round(allocation.amount) === allocation.amount), "Every bill allocation must be a positive amount with up to two decimals.");
    assert(new Set(p.allocations.map(allocation => allocation.tradeId)).size === p.allocations.length, "A bill can only appear once in the payment allocations.");
    assert(round(p.allocations.reduce((sum, allocation) => sum + allocation.amount, 0)) === p.amount, "The payment amount must equal the total allocated across selected bills.");
    for (const allocation of p.allocations) {
      const allocatedTrade = (p.kind === "Customer" ? s.invoices : s.purchases).find(item => item.id === allocation.tradeId && item.contactId === p.contactId);
      assert(!!allocatedTrade && isPosted(allocatedTrade), "Select posted bills belonging to this contact.");
      const pending = s.payments.filter(payment => payment.chequeStatus === "pending" && (payment.tradeId === allocatedTrade!.id || payment.allocations?.some(item => item.tradeId === allocatedTrade!.id))).reduce((sum, payment) => sum + (payment.allocations?.find(item => item.tradeId === allocatedTrade!.id)?.amount || (payment.tradeId === allocatedTrade!.id ? Math.abs(payment.amount) : 0)), 0);
      const pendingForwarded = (s.crossCheques || []).filter(cheque => cheque.destinationKind === "Supplier" && cheque.destinationId === allocatedTrade!.contactId && ["pending", "submitted"].includes(cheque.status)).reduce((sum, cheque) => sum + (cheque.allocations || []).filter(item => item.tradeId === allocatedTrade!.id).reduce((n, item) => n + item.amount, 0), 0);
      assert(allocation.amount + pending + pendingForwarded <= Math.max(0, balance(s, allocatedTrade!)), "An allocation exceeds a selected bill's remaining balance after pending cheques.");
    }
    assert(s.heads.includes(p.head), "Choose an existing account head from the list.");
    assert(p.method === "Cash" || p.method === "Bank" || p.method === "Cheque" || (s.financialAccounts || []).some(account => account.name === p.method && account.active !== false), "Choose Cash, Bank, Cheque, or an active payment account from the list.");
    if (p.method === "Cheque") {
      assert(!!p.chequeNumber?.trim() && !!p.chequeBank?.trim() && !!p.chequeDate, "Enter the cheque number, bank, and expected clearance date.");
      p.chequeStatus = "pending";
    }
    return { ...s, payments: [...s.payments, { ...p, financialAccountId: paymentAccountId(s, p.method), createdAt: Date.now() }] };
  }
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
export function applyAdvanceToTrade(s: Store, trade: Trade, amount: number, date = trade.date): Store {
  assert(isPosted(trade) && !!trade.contactId, "Post a bill with a saved customer or supplier before applying an advance.");
  assert(Number.isFinite(amount) && amount > 0 && round(amount) === amount && amount <= balance(s, trade), "Enter an advance amount within this bill's remaining balance.");
  const kind = trade.number.startsWith("PUR") ? "Supplier" : "Customer";
  let next = s, remaining = amount;
  for (const source of availableAdvancePayments(next, kind, trade.contactId)) {
    if (remaining <= 0) break;
    const available = source.amount;
    const portion = round(Math.min(remaining, available));
    if (portion <= 0) continue;
    next = recordPayment(next, { id: uid(), date, kind, contactId: trade.contactId, tradeId: trade.id, advanceApplication: true, sourceAdvanceId: source.payment.id, amount: portion, method: "Credit adjustment", head: trade.head, notes: "Advance applied to " + trade.number });
    remaining = round(remaining - portion);
  }
  assert(remaining === 0, "The available advance changed before it could be applied. Refresh the bill and try again.");
  return next;
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
    assert(!!t && r.date >= t.date, "Return date cannot be earlier than the original transaction date.");
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
    number: r.number || `RTN-${String(Math.max(0, ...s.returns.map(item => Number(/^RTN-(\d+)$/.exec(item.number || "")?.[1] || 0))) + 1).padStart(5, "0")}`,
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
        createdAt: entry.createdAt,
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
  for (const movement of s.movements) {
    if (movement.type !== "Purchase deletion reversal" || movement.financialAmount === undefined) continue;
    const head = movement.financialHead || "Purchases";
    const contactId = movement.financialContactId || "";
    // Keep the original accrual and reverse it on the deletion date. The retained
    // supplier advance below represents the cash already paid separately.
    push(movement.originalPurchaseDate || movement.date, movement.reference, "Purchase", head, "Credit adjustment", -movement.financialAmount, 0, contactId);
    push(movement.date, movement.reference, "Purchase deletion reversal", head, "Credit adjustment", movement.financialAmount, 0, contactId);
  }
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
    if (p.advanceApplication) return;
    const settlements = p.method === "Cheque" ? chequeSettlements(s, p) : [{ date: p.date, amount: p.amount, accountId: p.financialAccountId, status: "paid" }];
    const forwarded = p.method === "Cheque" && (s.crossCheques || []).some(c => c.sourcePaymentId === p.id);
    const tradeList = p.kind === "Customer" ? s.invoices : s.purchases;
    const allocations = p.allocations?.length ? p.allocations.map(allocation => ({ reference: tradeList.find(trade => trade.id === allocation.tradeId)?.number || "", amount: allocation.amount })) : [{ reference: tradeList.find(trade => trade.id === p.tradeId)?.number || (p.accountLevel ? "Supplier account payment" : ""), amount: p.amount }];
    settlements.forEach(entry => allocations.forEach(allocation => {
      const amount = p.allocations?.length ? entry.amount * allocation.amount / p.amount : entry.amount;
      push(entry.date, allocation.reference, `${p.kind} payment${entry.status === "bounced" ? " reversal" : ""}`, p.head,
        forwarded ? "Credit adjustment" : entry.accountId === cashChequeSettlement ? "Cash" : p.method === "Cheque" && entry.accountId ? s.financialAccounts?.find(a => a.id === entry.accountId)?.name || "Cheque" : p.method,
        amount * (p.kind === "Customer" ? 1 : -1), amount * (p.kind === "Customer" ? 1 : -1), p.contactId, entry.accountId === cashChequeSettlement ? "" : entry.accountId);
    }));
  });
  (s.partners || []).forEach(p => {
    const contribution = p.kind === "Contribution";
    const amount = contribution ? p.amount : -p.amount;
    push(p.date, p.partner, `Partner ${p.kind.toLowerCase()}`, p.method === "Cash" ? "Cash" : p.method, p.method, amount, amount, "", p.financialAccountId);
    rows.at(-1)!.debit = contribution ? p.amount : 0;
    rows.at(-1)!.credit = contribution ? 0 : p.amount;
    push(p.date, p.partner, `Partner ${p.kind.toLowerCase()}`, `${contribution ? "Partner capital" : "Partner drawings"} · ${p.partner}`, "Journal adjustment", -amount, 0);
    rows.at(-1)!.debit = contribution ? 0 : p.amount;
    rows.at(-1)!.credit = contribution ? p.amount : 0;
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
  const postLines = (date: string, reference: string, type: string, lines: JournalVoucher["lines"], postedAt?: string) => {
    lines.forEach(line => {
      const account = s.accounts?.find(a => a.id === line.accountId);
      const legacyHead = line.accountId.startsWith("legacy:") ? line.accountId.slice("legacy:".length) : "";
      const head = account?.name || (s.heads.includes(legacyHead) ? legacyHead : "Unknown account");
      const linkedBanks = (s.financialAccounts || []).filter(a => a.ledgerAccountId === line.accountId && (!a.createdAt || !!postedAt && a.createdAt <= postedAt));
      const bank = line.financialAccountId
        ? s.financialAccounts?.find(a => a.id === line.financialAccountId)
        : linkedBanks.length === 1 ? linkedBanks[0] : undefined;
      const amount = round(line.debit - line.credit);
      rows.push({
        date, reference, type, head, method: bank?.name || "Journal adjustment",
        amount, debit: line.debit, credit: line.credit,
        cash: !bank && (account?.name === "Cash" && account.type === "Asset" || !account && legacyHead === "Cash" && s.heads.includes("Cash")) ? amount : 0,
        bank: bank || linkedBanks.length || head === "Bank" ? amount : 0, financialAccountId: bank?.id, contactId: "",
      });
    });
  };
  (s.journals || []).filter(v => v.status === "posted").forEach(v => postLines(v.date, v.number, "Journal", v.lines, v.postedAt));
  (s.bankVouchers || []).filter(v => v.status === "posted").forEach(v => postLines(v.date, v.number, `Bank ${v.kind.toLowerCase()}`, bankVoucherLines(s, v)));
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}
export function profit(s: Store, from = "", to = "") {
  const netSales = (trade: Trade) => subtotal(trade) - lineDiscount(trade) - trade.discount;
  const accountsById = new Map(chartAccounts(s).map(account => [account.id, account]));
  let otherIncome = 0, otherExpenses = 0;
  const addLedgerLines = (lines: { accountId: string; debit: number; credit: number }[]) => {
    for (const line of lines) {
      const account = accountsById.get(line.accountId);
      if (!account) continue;
      const normalBalanceChange = account.nature === "Credit" ? line.credit - line.debit : line.debit - line.credit;
      if (account.type === "Income") otherIncome += normalBalanceChange;
      if (account.type === "Expense") otherExpenses += normalBalanceChange;
    }
  };
  (s.journals || []).filter(v => v.status === "posted" && periodMatch(v.date, from, to)).forEach(v => addLedgerLines(v.lines));
  (s.bankVouchers || []).filter(v => v.status === "posted" && periodMatch(v.date, from, to)).forEach(v => addLedgerLines(bankVoucherLines(s, v)));
  const invoices = s.invoices.map(t => s.corrections?.find(c => c.tradeId === t.id)?.before || t).filter(isPosted).filter((t) => periodMatch(t.date, from, to));
  const salesCorrections = (s.corrections || []).filter(c => c.kind === "Sale" && periodMatch(c.date, from, to));
  const salesDelta = salesCorrections.reduce((n, c) => n + (isPosted(c.after) ? netSales(c.after) : 0) - netSales(c.before), 0);
  const costDelta = salesCorrections.reduce((n, c) => n + (isPosted(c.after) ? c.after.lines.reduce((x, l) => x + l.qty * l.cost, 0) : 0) - c.before.lines.reduce((x, l) => x + l.qty * l.cost, 0), 0);
  const sales = invoices.reduce((n, t) => n + netSales(t), 0);
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
    otherIncome: round(otherIncome),
    cogs: round(cogs + costDelta - returnCost),
    expenses: round(expenses),
    otherExpenses: round(otherExpenses),
    damage: round(damage),
    net: round(sales + salesDelta - returnRevenue + otherIncome - cogs - costDelta + returnCost - expenses - otherExpenses - damage),
  };
}

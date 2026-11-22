import { chartAccounts } from "./accounts";
import { balance, emptyStore, isPosted, isSettledPayment, recordPayment, recordReturn, recordTrade, returnNotesWithNumbers, saveContact, round, roundQty, stock, today, total, validateTradeQuantity, type Store, type Trade } from "./model";
import { bankVoucherLines } from "./bank-vouchers";
import { productionMovements, validateRecipe } from "./production";
import { cashChequeSettlement, cashStatement, cashFlow, changeCheque, check, closeDay, correctTrade, deletePaidPurchase, linkLegacyWalkIn, expenseDateAllowed, tradeDateAllowed, previousDate, requireOpenDate, validDate, type Actor } from "./operations";
export type ValidationContext = { actor: Actor; occurredAt: string; receivedAt?: string; allowLateExpense?: boolean; workspaceId?: string };
const clean = (value: any): any => Array.isArray(value) ? value.map(clean) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => [k, clean(value[k])])) : value;
export const same = (a: unknown, b: unknown) => JSON.stringify(clean(a)) === JSON.stringify(clean(b));
const without = (value: any, keys: string[]) => Object.fromEntries(Object.entries(value).filter(([k]) => !keys.includes(k)));
const additions = <T extends { id: string }>(before: T[], after: T[]) => { const ids = new Set(before.map(b => b.id)); return after.filter(a => !ids.has(a.id)); };
function immutable<T extends { id: string }>(before: T[], after: T[], label: string) { const next = new Map(after.map(record => [record.id, record])); for (const old of before) check(next.has(old.id) && same(old, next.get(old.id)), `${label} cannot be changed or deleted.`); }
const movementKey = (m: Store["movements"][number]) => JSON.stringify(clean(without(m, ["id", "createdAt"])));
export function validateStore(s: Store, before?: Store) {
  check(!!s && s.version === 1, "Unsupported store version.");
  for (const key of Object.keys(emptyStore())) if (key !== "version") check(Array.isArray((s as any)[key]), `Invalid collection: ${key}.`);
  for (const [key, value] of Object.entries(s)) {
    if (!Array.isArray(value) || ["heads", "categories", "expenseCategories", "units"].includes(key)) continue;
    const ids = new Set<string>();
    for (const record of value as any[]) { check(!!record && typeof record.id === "string" && !!record.id && !ids.has(record.id), `Invalid or duplicate ID in ${key}.`); ids.add(record.id); }
  }
  const productIds = new Set(s.products.map(p => p.id));
  const customerIds = new Set(s.customers.map(c => c.id));
  const supplierIds = new Set(s.suppliers.map(c => c.id));
  const invoiceIds = new Set(s.invoices.map(t => t.id));
  const tradeById = new Map([...s.invoices, ...s.purchases].map(t => [t.id, t]));
  const invoicesById = new Map(s.invoices.map(t => [t.id, t]));
  const purchasesById = new Map(s.purchases.map(t => [t.id, t]));
  const chequePaymentIds = new Set(s.payments.filter(p => p.method === "Cheque").map(p => p.id));
  for (const key of ["heads", "categories", "expenseCategories", "units"] as const) check((s[key] || []).every(v => typeof v === "string" && !!v.trim()), `Invalid ${key}.`);
  const skuOwners = new Map<string, string>();
  const barcodeOwners = new Map<string, string>();
  const skuByProduct = new Map<string, string>();
  const barcodeByProduct = new Map<string, string>();
  for (const product of s.products) {
    const sku = typeof product.sku === "string" ? product.sku.trim().toLowerCase() : "";
    const barcode = typeof product.barcode === "string" ? product.barcode.trim() : "";
    const barcodeKey = barcode.toLowerCase();
    check(typeof product.name === "string" && !!product.name.trim() && !!sku, "Product name and SKU are required.");
    check(!product.variantOf || (product.variantOf !== product.id && productIds.has(product.variantOf)), "Select a valid parent product for this variant.");
    check(!skuOwners.has(sku), "This SKU is already in use.");
    check(!barcode || !barcodeOwners.has(barcode), "This barcode is already assigned to a product.");
    check(!/[\x00-\x1f\x7f]/.test(barcode), "Barcode must not contain control characters.");
    check([product.cost, product.price, product.low].every(value => Number.isFinite(value) && value >= 0), "Prices and thresholds must be non-negative numbers.");
    skuOwners.set(sku, product.id);
    if (barcode) barcodeOwners.set(barcode, product.id);
    skuByProduct.set(product.id, sku);
    barcodeByProduct.set(product.id, barcodeKey);
  }
  for (const product of s.products) {
    const sku = skuByProduct.get(product.id)!;
    const barcode = barcodeByProduct.get(product.id)!;
    check(!barcode || !skuOwners.has(barcode) || skuOwners.get(barcode) === product.id, "A barcode cannot match another product's SKU.");
    const otherBarcodeOwner = barcodeOwners.get(sku);
    check(!otherBarcodeOwner || otherBarcodeOwner === product.id, "A barcode cannot match another product's SKU.");
  }
  for (const contact of s.customers) { check(typeof contact.name === "string" && typeof contact.phone === "string" && typeof contact.email === "string" && typeof contact.address === "string", "Invalid customer details."); saveContact(s, "Customer", contact); }
  for (const contact of s.suppliers) { check(typeof contact.name === "string" && typeof contact.phone === "string" && typeof contact.email === "string" && typeof contact.address === "string", "Invalid supplier details."); saveContact(s, "Supplier", contact); }
  for (const trade of [...s.invoices, ...s.purchases]) {
    check(validDate(trade.date) && typeof trade.number === "string" && !!trade.number && [undefined, "draft", "posted", "void"].includes(trade.status), "Invalid bill details.");
    check(Array.isArray(trade.lines) && trade.lines.length > 0 && trade.lines.every(l => productIds.has(l.productId) && [l.qty, l.price, l.cost].every(Number.isFinite) && l.qty > 0 && l.price >= 0 && l.cost >= 0), "Invalid bill lines.");
    const previous = before && [...before.invoices, ...before.purchases].find(old => old.id === trade.id);
    const unchangedLegacyOverpayment = previous && previous.paid === trade.paid && previous.discount === trade.discount && previous.tax === trade.tax && same(previous.lines, trade.lines) && (previous.status === trade.status || trade.status === "void");
    check(Number.isFinite(trade.paid) && trade.paid >= 0 && (trade.status === "draft" || trade.paid <= total(trade) || !!unchangedLegacyOverpayment) && Number.isFinite(trade.discount) && trade.discount >= 0 && trade.discount <= trade.lines.reduce((n, l) => n + l.price * l.qty, 0) && Number.isFinite(trade.tax) && trade.tax >= 0 && trade.tax <= 100, "Invalid bill amounts.");
    check(typeof trade.contactId === "string" && (!trade.contactId || (invoiceIds.has(trade.id) ? customerIds : supplierIds).has(trade.contactId)), "Bill references an unknown customer or supplier.");
    check(s.heads.includes(trade.head), "Bill references an unknown account head.");
  }
  check(new Set([...s.invoices, ...s.purchases].map(t => t.id)).size === s.invoices.length + s.purchases.length, "Duplicate bill IDs.");
  check(new Set([...s.invoices, ...s.purchases].map(t => t.number)).size === s.invoices.length + s.purchases.length, "Duplicate bill references.");
  for (const p of s.payments) {
    const trade = (p.kind === "Customer" ? invoicesById : purchasesById).get(p.tradeId);
    if (p.accountLevel) {
      check(p.kind === "Supplier" && !p.advance && !p.tradeId && s.suppliers.some(c => c.id === p.contactId) && validDate(p.date) && Number.isFinite(p.amount) && p.amount !== 0 && round(p.amount) === p.amount && s.heads.includes(p.head), "Invalid supplier account payment.");
      check(p.method === "Cash" || p.method === "Bank" || p.method === "Cheque" || !!s.financialAccounts?.some(a => a.name === p.method), "Invalid supplier payment method.");
      check(p.method !== "Cheque" || !!p.chequeNumber && !!p.chequeBank && validDate(p.chequeDate || "") && ["pending", "cleared", "bounced", "cancelled"].includes(p.chequeStatus || "pending"), "Invalid cheque details.");
      continue;
    }
    if (p.advance) {
      check(!p.tradeId && !!p.contactId && validDate(p.date) && Number.isFinite(p.amount) && p.amount !== 0 && round(p.amount) === p.amount && s.heads.includes(p.head), "Invalid advance payment.");
      continue;
    }
    if (p.advanceApplication) {
      const source = s.payments.find(payment => payment.id === p.sourceAdvanceId && payment.advance && !payment.tradeId && payment.kind === p.kind && payment.contactId === p.contactId);
      check(!p.advance && !p.accountLevel && !!p.tradeId && !!source && !!trade && isPosted(trade) && trade.contactId === p.contactId && p.method === "Credit adjustment" && validDate(p.date) && Number.isFinite(p.amount) && p.amount > 0 && round(p.amount) === p.amount && s.heads.includes(p.head), "Invalid advance application.");
      continue;
    }
    if (p.allocations?.length) {
      check(!p.tradeId && !p.accountLevel && validDate(p.date) && Number.isFinite(p.amount) && p.amount > 0 && round(p.amount) === p.amount && s.heads.includes(p.head) && p.allocations.every(allocation => Number.isFinite(allocation.amount) && allocation.amount > 0 && round(allocation.amount) === allocation.amount) && new Set(p.allocations.map(allocation => allocation.tradeId)).size === p.allocations.length && round(p.allocations.reduce((sum, allocation) => sum + allocation.amount, 0)) === p.amount, "Invalid payment allocations.");
      for (const allocation of p.allocations) {
        const allocatedTrade = (p.kind === "Customer" ? s.invoices : s.purchases).find(item => item.id === allocation.tradeId);
        check(!!allocatedTrade && isPosted(allocatedTrade) && allocatedTrade.contactId === p.contactId, "Payment allocations must link to posted bills belonging to the same contact.");
      }
      check(p.method === "Cash" || p.method === "Bank" || p.method === "Cheque" || !!s.financialAccounts?.some(account => account.name === p.method), "Invalid payment method.");
      check(p.method !== "Cheque" || !!p.chequeNumber && !!p.chequeBank && validDate(p.chequeDate || "") && ["pending", "cleared", "bounced", "cancelled"].includes(p.chequeStatus || "pending"), "Invalid cheque details.");
      continue;
    }
    check(!!trade && isPosted(trade) && trade.contactId === p.contactId && validDate(p.date) && Number.isFinite(p.amount) && p.amount !== 0 && round(p.amount) === p.amount && s.heads.includes(p.head), "Invalid payment link or amount.");
    check(p.method !== "Cheque" || !!p.chequeNumber && !!p.chequeBank && validDate(p.chequeDate || "") && ["pending", "cleared", "bounced", "cancelled"].includes(p.chequeStatus || "pending"), "Invalid cheque details.");
  }
  for (const source of s.payments.filter(payment => payment.advance && !payment.tradeId)) {
    const applied = s.payments.filter(payment => payment.advanceApplication && payment.sourceAdvanceId === source.id && isSettledPayment(payment)).reduce((sum, payment) => sum + payment.amount, 0);
    check(applied <= source.amount, "Advance applications exceed the available balance.");
  }
  for (const e of s.expenses) check(validDate(e.date) && Number.isFinite(e.amount) && e.amount > 0 && round(e.amount) === e.amount && s.heads.includes(e.head) && s.expenseCategories.includes(e.category), "Invalid expense.");
  for (const r of s.returns) check(validDate(r.date) && Number.isFinite(r.qty) && r.qty > 0 && Number.isFinite(r.amount) && r.amount >= 0 && (!r.number || /^RTN-\d{5,}$/.test(r.number)) && productIds.has(r.productId) && (r.kind === "Damaged stock" || (tradeById.has(r.tradeId) && isPosted(tradeById.get(r.tradeId)!))), "Invalid return.");
  check(new Set(s.returns.map(r => r.number).filter(Boolean)).size === s.returns.filter(r => r.number).length, "Return numbers must be unique.");
  for (const count of s.stockCounts || []) {
    check(!!count && validDate(count.date) && ["draft", "posted"].includes(count.status) && Number.isFinite(count.createdAt) && Array.isArray(count.lines) && count.lines.length > 0 && count.lines.every(line =>
      !!line && productIds.has(line.productId) && Number.isFinite(line.expected) && line.expected >= 0 && roundQty(line.expected) === line.expected &&
      (line.counted === undefined || Number.isFinite(line.counted) && line.counted >= 0 && roundQty(line.counted) === line.counted)), "Stock count must contain valid products and non-negative quantities.");
    check(count.status !== "draft" || count.postedAt === undefined && count.lines.every(line => line.counted === undefined), "Draft stock counts cannot contain posted values.");
    check(count.status !== "posted" || Number.isFinite(count.postedAt) && count.postedAt! >= count.createdAt && count.lines.every(line => line.counted !== undefined), "Posted stock counts require counted quantities and a posting time.");
    check(new Set(count.lines.map(line => line.productId)).size === count.lines.length, "A product can appear only once in a stock count.");
  }
  for (const m of s.movements) check(validDate(m.date) && Number.isFinite(m.qty) && productIds.has(m.productId), "Invalid stock movement.");
  for (const recipe of s.recipes || []) validateRecipe(s, recipe);
  check(new Set((s.recipes || []).map(recipe => recipe.id)).size === (s.recipes || []).length, "Duplicate recipe IDs.");
  check(new Set((s.productionRuns || []).map(run => run.id)).size === (s.productionRuns || []).length, "Duplicate production run IDs.");
  for (const run of s.productionRuns || []) check(validDate(run.date) && !!run.recipeId && !!run.recipeName && !!run.reference && Number.isInteger(run.batches) && run.batches > 0 && Number.isFinite(run.outputQuantity) && run.outputQuantity > 0 && Number.isFinite(run.outputUnitCost) && run.outputUnitCost >= 0 && Number.isFinite(run.materialCost) && run.materialCost >= 0 && !!run.actorId && s.products.some(product => product.id === run.outputProductId) && Array.isArray(run.ingredients) && run.ingredients.length > 0 && run.ingredients.every(item => s.products.some(product => product.id === item.productId) && item.productId !== run.outputProductId && Number.isFinite(item.quantity) && item.quantity > 0 && Number.isFinite(item.unitCost) && item.unitCost >= 0), "Invalid production run.");
  for (const c of s.corrections || []) check(validDate(c.date) && !!c.reason?.trim() && c.before.id === c.tradeId && c.after.id === c.tradeId, "Invalid bill correction history.");
  for (const e of s.chequeEvents || []) check(validDate(e.date) && !!e.reason?.trim() && chequePaymentIds.has(e.paymentId), "Invalid cheque history.");
  const stockByProduct = new Map<string, number>();
  for (const movement of s.movements) stockByProduct.set(movement.productId, (stockByProduct.get(movement.productId) || 0) + movement.qty);
  s.products.forEach(p => check(roundQty(stockByProduct.get(p.id) || 0) >= 0, "Invalid backup: stock cannot be negative."));
  for (const payment of s.payments.filter(p => p.method === "Cheque")) {
    const events = (s.chequeEvents || []).filter(e => e.paymentId === payment.id).sort((a, b) => a.date.localeCompare(b.date) || a.occurredAt.localeCompare(b.occurredAt));
    let status = events.length && events[0].status !== "cleared" && payment.clearedDate ? "cleared" : "pending";
    let lastDate = payment.date;
    for (const event of events) {
      check(event.date >= lastDate && Number.isFinite(Date.parse(event.occurredAt)) && !!event.actorId && (status === "pending" || status === "cleared" && event.status === "bounced"), "Invalid cheque action sequence.");
      if (event.status === "cleared") check(event.accountId === cashChequeSettlement && !!chartAccounts(s).find(a => a.name === "Cash" && a.type === "Asset") || !!s.financialAccounts?.some(a => a.id === event.accountId), "Unknown cheque settlement account.");
      status = event.status; lastDate = event.date;
    }
    if (events.length) check(status === payment.chequeStatus, "Cheque status does not match its action history.");
  }
  for (const c of s.dailyCloses || []) check(validDate(c.date) && ["closed", "reopened"].includes(c.status) && [c.expected, c.counted, c.variance].every(Number.isFinite) && c.counted >= 0 && round(c.counted - c.expected) === c.variance && !!c.actorId && Number.isFinite(Date.parse(c.closedAt)), "Invalid daily closing.");
}
export function validateOperations(before: Store, after: Store, module: string, context: ValidationContext) {
  validateStore(after, before);
  const actor = context.actor, received = context.receivedAt || new Date().toISOString();
  for (const key of ["customers", "suppliers"] as const) {
    const trades = key === "customers" ? before.invoices : before.purchases;
    for (const contact of after[key]) {
      const old = before[key].find(candidate => candidate.id === contact.id);
      const openingBalance = contact.openingBalance ?? 0;
      const openingDate = contact.openingBalanceDate || "";
      if (openingBalance > 0 && !openingDate) check(!!old && (old.openingBalance ?? 0) === openingBalance && !old.openingBalanceDate, "Enter the opening balance date.");
      const changed = (old?.openingBalance ?? 0) !== openingBalance || (old?.openingBalanceDate || "") !== openingDate;
      if (changed && (openingBalance > 0 || (old?.openingBalance ?? 0) > 0 || !!openingDate)) {
        check(actor.role === "owner", "Only the workspace owner can set or change a contact opening balance.");
        check(!trades.some(trade => trade.contactId === contact.id) && !before.payments.some(payment => payment.contactId === contact.id), "Contact opening balances are locked after transactions; use a payment or correction entry.");
        if (openingBalance > 0) requireOpenDate(before, openingDate);
      }
    }
  }
  for (const key of ["invoices", "purchases"] as const) for (const trade of after[key]) {
    const old = before[key].find(candidate => candidate.id === trade.id);
    if (!old || !same(old.lines, trade.lines)) {
      check(trade.lines.every(line => line.qty >= 0.5 && line.price >= 1), "Bill quantities must be at least 0.5 and rates at least 1.");
      for (const line of trade.lines) {
        validateTradeQuantity(line, after.products.find(product => product.id === line.productId));
      }
    }
  }
  check(Number.isFinite(Date.parse(context.occurredAt)) && Date.parse(context.occurredAt) <= Date.parse(received) + 300000, "Invalid creation time or device clock. Pending data has been preserved.");
  if (actor.role !== "owner") {
    for (const key of ["heads", "accounts", "financialAccounts"] as const) check(same(before[key] || [], after[key] || []), "Only the owner can create or edit account heads and payment accounts. Members may select existing heads.");
  }
  immutable(before.walkInLinks || [], after.walkInLinks || [], "Walk-in link history");
  const newLinks = additions(before.walkInLinks || [], after.walkInLinks || []);
  for (const link of newLinks) {
    check(link.actorId === actor.id && actor.role === "owner", "Only the owner can link historical walk-ins.");
    const replay = linkLegacyWalkIn({ ...before, customers: after.customers }, link.tradeId, link.customerId, link.reason, actor);
    check(same(replay.invoices.find(t => t.id === link.tradeId), after.invoices.find(t => t.id === link.tradeId)), "Historical linking cannot change bill amounts or details.");
    check(replay.payments.filter(p => p.tradeId === link.tradeId).every(p => same(p, after.payments.find(a => a.id === p.id))), "Historical linking must preserve payment identity and amounts.");
  }
  immutable(before.corrections || [], after.corrections || [], "Correction history");
  immutable(before.chequeEvents || [], after.chequeEvents || [], "Cheque history");
  immutable(before.movements, after.movements, "Stock movements");
  immutable(before.productionRuns || [], after.productionRuns || [], "Production runs");
  const oldCounts = before.stockCounts || [], newCounts = after.stockCounts || [];
  check(oldCounts.every(old => newCounts.some(next => next.id === old.id)), "Stock count history cannot be deleted.");
  const countPosts = new Set<string>();
  for (const old of oldCounts) {
    const next = newCounts.find(item => item.id === old.id);
    if (!next || same(old, next)) continue;
    check(module === "Inventory" && old.status === "draft" && next.status === "posted" &&
      old.date === next.date && old.createdAt === next.createdAt && old.lines.length === next.lines.length &&
      same(without(old, ["status", "postedAt", "lines"]), without(next, ["status", "postedAt", "lines"])) &&
      old.lines.every((line, index) => line.productId === next.lines[index].productId && line.expected === next.lines[index].expected &&
        Number.isFinite(next.lines[index].counted) && next.lines[index].counted! >= 0 && roundQty(next.lines[index].counted!) === next.lines[index].counted) &&
      Number.isFinite(next.postedAt), "Stock count history is locked except when posting a complete draft.");
    requireOpenDate(before, old.date);
    for (const line of old.lines) check(stock(before, line.productId) === line.expected, "Stock changed after this count began. Start a new count before posting.");
    countPosts.add(old.id);
  }
  const addedCounts = additions(oldCounts, newCounts);
  for (const count of addedCounts) {
    check(module === "Inventory" && count.status === "draft" && count.postedAt === undefined && count.lines.every(line => line.counted === undefined), "A stock count must be started as an unposted draft from Inventory.");
    requireOpenDate(before, count.date);
    check(same(count.lines.map(line => ({ productId: line.productId, expected: line.expected })),
      before.products.filter(product => product.active !== false).map(product => ({ productId: product.id, expected: stock(before, product.id) }))),
    "Stock count must snapshot every active product at its current quantity.");
  }
  const oldReturnIds = new Set(before.returns.map(item => item.id));
  check(before.returns.every(old => {
    const next = after.returns.find(item => item.id === old.id);
    if (!next) return false;
    if (same(old, next)) return true;
    return module === "Returns & Damage" && actor.role === "owner" && !old.number && !!next.number && same({ ...old, number: undefined }, { ...next, number: undefined });
  }), "Existing return details cannot be changed; only a missing return number may be assigned.");
  check(after.returns.filter(item => oldReturnIds.has(item.id)).length === before.returns.length, "Existing returns cannot be removed.");
  for (const old of before.expenses) {
    const next = after.expenses.find(expense => expense.id === old.id);
    check(!!next, "Expenses cannot be deleted.");
    if (!same(old, next)) {
      const { attachments: oldAttachments = [], ...oldDetails } = old;
      const { attachments: nextAttachments = [], ...nextDetails } = next!;
      check(Array.isArray(oldAttachments) && Array.isArray(nextAttachments) && nextAttachments.every(item => item && typeof item.id === "string" && typeof item.key === "string"), "Expense attachments have an invalid format.");
      const priorById = new Map(oldAttachments.map(item => [item.id, item]));
      const nextById = new Map(nextAttachments.map(item => [item.id, item]));
      check(nextById.size === nextAttachments.length, "Expense attachments cannot reuse an attachment ID.");
      const validAttachmentChanges = oldAttachments.every(prior => {
        const current = nextById.get(prior.id);
        if (!current) return actor.role === "owner";
        if (same(prior, current)) return true;
        if (typeof current.key !== "string") return false;
        const keyParts = current.key.split("/");
        return prior.status === "pending" && current.status === "uploaded" && prior.id === current.id && prior.name === current.name && prior.contentType === current.contentType && prior.size === current.size && keyParts.length === 4 && (!context.workspaceId || keyParts[0] === context.workspaceId) && keyParts[1] === "expense" && keyParts[2] === old.id;
      }) && nextAttachments.every(item => {
        if (priorById.has(item.id)) return true;
        const keyParts = item.key.split("/");
        return item.status === "pending" && item.key === `pending/${item.id}` || item.status === "uploaded" && keyParts.length === 4 && (!context.workspaceId || keyParts[0] === context.workspaceId) && keyParts[1] === "expense" && keyParts[2] === old.id;
      });
      check(actor.role === "owner" && next!.createdAt === old.createdAt && next!.createdBy === old.createdBy && next!.createdByName === old.createdByName && same(oldDetails, nextDetails) && validAttachmentChanges, "Only the owner can correct an expense. Attachments must keep their identity and workspace link, and pending files may only transition to uploaded.");
    }
  }
  const afterProducts = new Map(after.products.map(product => [product.id, product]));
  const manufacturingProducts = new Set<string>();
  for (const recipe of before.recipes || []) {
    manufacturingProducts.add(recipe.outputProductId);
    for (const ingredient of recipe.ingredients) manufacturingProducts.add(ingredient.productId);
  }
  for (const run of before.productionRuns || []) {
    manufacturingProducts.add(run.outputProductId);
    for (const ingredient of run.ingredients) manufacturingProducts.add(ingredient.productId);
  }
  for (const product of before.products) {
    const next = afterProducts.get(product.id);
    if (!next) continue;
    check(!manufacturingProducts.has(product.id) || product.unit === next.unit, "A product measurement unit cannot change after it is used by a recipe or production run.");
  }
  const expectedMovements: Store["movements"] = [];
  let expectedProducts = before.products;
  for (const correction of additions(before.corrections || [], after.corrections || [])) {
    check(actor.id === correction.actorId && actor.role === "owner", "Only the owner can record corrections.");
    const old = [...before.invoices, ...before.purchases].find(t => t.id === correction.tradeId);
    check(!!old && same(old, correction.before), "Correction before-history does not match the original bill.");
    const replay = correctTrade(before, correction.kind, correction.after, correction.reason, actor, correction.date);
    if (correction.kind === "Purchase") expectedProducts = replay.products;
    const computed = replay.corrections!.at(-1)!;
    check(same(computed.after, correction.after), "Invalid corrected bill.");
    expectedMovements.push(...replay.movements.slice(before.movements.length));
  }
  const replayedOpenings: Store["movements"] = [];
  if (module === "Purchases") {
    const newProducts = additions(before.products, after.products);
    expectedProducts = [...expectedProducts, ...newProducts.map(product => ({
      ...product,
      sku: product.sku.trim(),
      barcode: product.barcode.trim(),
      unit: (product.unit || "piece").trim(),
    }))];
    for (const product of newProducts) {
      const openingMovement = additions(before.movements, after.movements).find(movement => movement.productId === product.id && movement.type === "Opening stock");
      const opening = openingMovement?.qty || 0;
      requireOpenDate(before, openingMovement?.date || today());
      check(Number.isFinite(opening) && opening >= 0, "Prices, thresholds, and opening stock must be non-negative numbers.");
      if (openingMovement) {
        check(opening > 0, "Opening stock must be greater than zero.");
        replayedOpenings.push({
          ...openingMovement,
          productId: product.id,
          type: "Opening stock",
          qty: opening,
          reference: product.sku.trim(),
          reason: "Opening balance",
        });
      }
    }
  }
  expectedMovements.push(...replayedOpenings);
  if (module === "Production") {
    for (const recipe of after.recipes || []) validateRecipe(after, recipe);
    for (const run of additions(before.productionRuns || [], after.productionRuns || [])) {
      check(run.date === today(new Date(context.occurredAt)), "Production runs must use the business date when they are recorded so stock and material costs stay consistent.");
      requireOpenDate(before, run.date);
      const recipe = (after.recipes || []).find(candidate => candidate.id === run.recipeId);
      check(!!recipe && run.actorId === actor.id && run.actorName === (actor.name || "") && validDate(run.date) && Number.isInteger(run.batches) && run.batches > 0, "Production run must match a saved recipe and the signed-in operator.");
      const expectedIngredients = recipe!.ingredients.map(item => ({ productId: item.productId, quantity: item.quantity * run.batches, unitCost: expectedProducts.find(product => product.id === item.productId)?.cost }));
      const materialCost = round(expectedIngredients.reduce((sum, item) => sum + item.quantity * (item.unitCost || 0), 0));
      const outputQuantity = recipe!.outputQuantity * run.batches;
      const outputUnitCost = round(materialCost / outputQuantity);
      check(run.recipeName === recipe!.name && run.outputProductId === recipe!.outputProductId && run.outputQuantity === outputQuantity && same(run.ingredients, expectedIngredients) && run.materialCost === materialCost && run.outputUnitCost === outputUnitCost, "Production run does not match the saved recipe and current raw material costs.");
      for (const ingredient of run.ingredients) check(stock(before, ingredient.productId) + expectedMovements.filter(movement => movement.productId === ingredient.productId).reduce((sum, movement) => sum + movement.qty, 0) >= ingredient.quantity, "Production cannot consume more raw material than is in stock.");
      const priorMovements = expectedMovements.slice();
      expectedMovements.push(...productionMovements(run));
      const outputProduct = expectedProducts.find(product => product.id === run.outputProductId)!;
      const outputStock = stock({ ...before, movements: [...before.movements, ...priorMovements] }, run.outputProductId);
      const nextCost = round((outputStock * outputProduct.cost + outputQuantity * outputUnitCost) / (outputStock + outputQuantity));
      expectedProducts = expectedProducts.map(product => product.id === run.outputProductId ? { ...product, cost: nextCost } : product);
    }
  } else {
    check(same(before.recipes || [], after.recipes || []) && same(before.productionRuns || [], after.productionRuns || []), "Only the Production module can change recipes or production runs.");
  }
  for (const key of ["invoices", "purchases"] as const) {
    const kind = key === "invoices" ? "Sale" : "Purchase";
    for (const old of before[key]) {
      const next = after[key].find(t => t.id === old.id);
      if (!next) {
        if (key === "purchases" && isPosted(old) && actor.role === "owner") {
          const replay = deletePaidPurchase(before, old.id, actor);
          check(same(replay.payments, after.payments) && same(replay.products, after.products), "Purchase deletion must retain linked payments as supplier advances and restore product costs.");
          expectedProducts = replay.products;
          expectedMovements.push(...replay.movements.slice(before.movements.length));
          continue;
        }
        check(old.status === "draft" && old.paid === 0 && !before.payments.some(payment => payment.tradeId === old.id), "Only unpaid drafts can be deleted.");
        if (kind === "Sale") check(actor.role === "owner" || old.createdBy === actor.id, "Only the creator or workspace owner can delete this sales draft.");
        continue;
      }
      if (same(old, next) || newLinks.some(link => link.tradeId === old.id)) continue;
      const correction = additions(before.corrections || [], after.corrections || []).find(c => c.tradeId === old.id);
      if (isPosted(old)) { check(!!correction && same(correction.after, next), "Posted bills are locked. Use an owner correction with a reason."); continue; }
      check(old.status === "draft" && next!.status !== "void", "Voided bills are locked.");
      requireOpenDate(before, old.date);
      check(old.number === next!.number || old.status === "draft" && next!.status === "draft" && /^(?:SL|PRO)-\d{5}$/.test(next!.number) || old.status === "draft" && next!.status === "posted" && /^(?:INV|PUR)-\d+$/.test(next!.number), "Draft bill reference cannot change except when posting.");
    }
    for (const trade of after[key].filter(t => !before[key].some(old => old.id === t.id && same(old, t)) && !newLinks.some(link => link.tradeId === t.id) && !(after.corrections || []).some(c => c.tradeId === t.id && !before.corrections?.some(old => old.id === c.id)))) {
      requireOpenDate(before, trade.date);
      check(tradeDateAllowed(trade.date, actor, context.occurredAt, kind), kind === "Sale" ? "Staff can create sales only for today. Ask the owner to enter a historical sale." : "Staff can create purchases only for today or the previous two calendar days. Future dates are not allowed.");
      check((!trade.createdBy || trade.createdBy === actor.id) && (!trade.createdByName || !actor.name || trade.createdByName === actor.name), "Bill creator must match the signed-in user.");
      const base = { ...before, customers: after.customers, [key]: before[key].filter(t => t.id !== trade.id) };
      const replay = recordTrade(base, kind, trade);
      const computed = replay[key].find(t => t.id === trade.id)!;
      check(same(without(computed, ["createdAt", "postedAt"]), without(trade, ["createdAt", "postedAt"])), "Bill does not match valid posting calculations.");
      expectedMovements.push(...replay.movements.slice(before.movements.length));
      // Purchase posting changes only the latest unit cost, not product identity/details.
      if (kind === "Purchase" && isPosted(trade)) expectedProducts = replay.products;
      if (kind === "Purchase" && isPosted(trade)) for (const product of replay.products) {
        const next = after.products.find(p => p.id === product.id);
        check(!!next && same(product, next), "Purchase must update product cost consistently.");
      }
    }
  }
  if (module === "Billing") {
    immutable(before.customers, after.customers, "Existing customer profiles");
    for (const customer of additions(before.customers, after.customers)) {
      const trade = additions(before.invoices, after.invoices).find(t => t.contactId === customer.id) || before.invoices.find(t => newLinks.some(link => link.tradeId === t.id && link.customerId === customer.id));
      if (trade?.walkInPhone) check(!before.customers.some(c => c.phone.replace(/[^0-9+]/g, "") === trade.walkInPhone!.replace(/[^0-9+]/g, "")), "Use the existing customer matched by phone instead of creating a duplicate.");
      check(!!trade && customer.name === (trade.walkInName?.trim() || trade.walkInCompany?.trim() || `Walk-in ${trade.number}`) && customer.phone === (trade.walkInPhone?.trim() || "") && customer.address === (trade.walkInAddress?.trim() || "") && customer.company === (trade.walkInCompany?.trim() || "") && customer.email === "", "Billing can only add the walk-in customer on the new bill.");
    }
  }
  for (const event of additions(before.chequeEvents || [], after.chequeEvents || [])) {
    check(event.actorId === actor.id, "Cheque actor does not match the signed-in user.");
    const replay = changeCheque(before, event.paymentId, event.status, event.date, event.accountId, event.reason, actor);
    check(same(replay.payments.find(p => p.id === event.paymentId), after.payments.find(p => p.id === event.paymentId)), "Cheque status change does not match its audit event.");
  }
  const oldCrossCheques = before.crossCheques || [];
  const nextCrossCheques = after.crossCheques || [];
  for (const old of oldCrossCheques) {
    const next = nextCrossCheques.find(c => c.id === old.id);
    check(!!next, "Forwarded cheque history cannot be deleted.");
    if (!same(old, next)) {
      check(same(without(old, ["status"]), without(next, ["status"])), "Forwarded cheque details cannot be changed.");
      const event = additions(before.chequeEvents || [], after.chequeEvents || []).find(e => e.paymentId === old.sourcePaymentId);
      check(!!event, "Forwarded cheque status can only change through the cheque lifecycle.");
      const replay = changeCheque(before, event!.paymentId, event!.status, event!.date, event!.accountId, event!.reason, actor);
      check(same(replay.crossCheques?.find(c => c.id === old.id), next), "Forwarded cheque status does not match its audit event.");
    }
  }
  for (const crossCheque of additions(oldCrossCheques, nextCrossCheques)) {
    const source = after.payments.find(p => p.id === crossCheque.sourcePaymentId);
    const priorSource = before.payments.find(p => p.id === crossCheque.sourcePaymentId);
    check(nextCrossCheques.filter(c => c.sourcePaymentId === crossCheque.sourcePaymentId).length === 1, "A customer cheque can only be forwarded once.");
    check(!!source && source.kind === "Customer" && source.method === "Cheque" && source.amount > 0 && (source.chequeStatus || "pending") === "pending" && !source.clearedDate, "Only a positive pending customer cheque can be forwarded.");
    check(crossCheque.status === "pending" && validDate(crossCheque.date) && crossCheque.date >= source!.date && crossCheque.customerId === source!.contactId && crossCheque.amount === source!.amount, "Forwarded cheque details must match the source cheque.");
    check(!priorSource || (priorSource.kind === "Customer" && priorSource.method === "Cheque" && priorSource.amount > 0 && (priorSource.chequeStatus || "pending") === "pending" && !priorSource.clearedDate), "Only an unforwarded pending customer cheque can be forwarded.");
    if (crossCheque.destinationKind === "Supplier") {
      const supplier = after.suppliers.find(c => c.id === crossCheque.destinationId);
      check(!!supplier && crossCheque.destinationName === supplier.name, "Select an existing supplier as the forwarded cheque destination.");
    } else {
      check(crossCheque.destinationKind === "Partner" && typeof crossCheque.destinationId === "string" && !!crossCheque.destinationId.trim() && crossCheque.destinationName === crossCheque.destinationId, "Enter a valid partner as the forwarded cheque destination.");
    }
    check((crossCheque.allocations || []).every(allocation => Number.isFinite(allocation.amount) && allocation.amount > 0 && round(allocation.amount) === allocation.amount) && round((crossCheque.allocations || []).reduce((sum, allocation) => sum + allocation.amount, 0)) <= crossCheque.amount, "Invalid forwarded cheque allocations.");
    for (const allocation of crossCheque.allocations || []) {
      const trade = after.purchases.find(item => item.id === allocation.tradeId && item.contactId === crossCheque.destinationId);
      check(crossCheque.destinationKind === "Supplier" && !!trade && isPosted(trade), "Forwarded cheque allocations must link to posted purchases for the selected supplier.");
      const pendingPayments = after.payments.filter(payment => payment.chequeStatus === "pending" && (payment.tradeId === allocation.tradeId || payment.allocations?.some(item => item.tradeId === allocation.tradeId))).reduce((sum, payment) => sum + (payment.allocations?.find(item => item.tradeId === allocation.tradeId)?.amount || (payment.tradeId === allocation.tradeId ? Math.abs(payment.amount) : 0)), 0);
      const pendingForwarded = oldCrossCheques.filter(item => item.destinationKind === "Supplier" && item.destinationId === crossCheque.destinationId && ["pending", "submitted"].includes(item.status)).reduce((sum, item) => sum + (item.allocations || []).filter(row => row.tradeId === allocation.tradeId).reduce((n, row) => n + row.amount, 0), 0);
      check(allocation.amount + pendingPayments + pendingForwarded <= Math.max(0, balance(after, trade!)), "Forwarded cheque allocation exceeds the purchase balance after pending payments.");
    }
  }
  for (const p of before.payments) {
    const next = after.payments.find(a => a.id === p.id);
    check(!!next, "Payments cannot be deleted.");
    const detachedPurchasePayment = p.kind === "Supplier" && !!p.tradeId && !after.purchases.some(trade => trade.id === p.tradeId) && next!.tradeId === "" && next!.advance === true;
    if (!same(p, next) && !detachedPurchasePayment && !newLinks.some(link => link.tradeId === p.tradeId)) {
      const migratedNotes = { ...p, notes: returnNotesWithNumbers(p, after.returns) };
      const returnNoteMigration = module === "Payments" && actor.role === "owner" && same(migratedNotes, next);
      check(returnNoteMigration || additions(before.chequeEvents || [], after.chequeEvents || []).some(e => e.paymentId === p.id), "Payments are locked; use the cheque lifecycle or a refund.");
    }
  }
  let paymentBase = { ...before, invoices: after.invoices, purchases: after.purchases, customers: after.customers };
  for (const p of additions(before.payments, after.payments)) {
    requireOpenDate(before, p.date);
    const replay = recordPayment(paymentBase, p);
    check(same(without(replay.payments.at(-1), ["createdAt"]), without(p, ["createdAt"])), "Payment does not match the remaining bill balance.");
    paymentBase = { ...paymentBase, payments: [...paymentBase.payments, p] };
  }
  for (const expense of additions(before.expenses, after.expenses)) {
    check((!expense.createdBy || expense.createdBy === actor.id) && (!expense.createdByName || !actor.name || expense.createdByName === actor.name), "Expense creator must match the signed-in user.");
    requireOpenDate(before, expense.date);
    check(expense.date <= today(new Date(received)), "Future expense dates are not allowed by the server.");
    check(expenseDateAllowed(expense.date, actor, context.occurredAt), "Expense date is outside your allowed creation-date window.");
    check(expense.createdAt === context.occurredAt, "Expense creation time must match its queued change.");
    if (actor.role !== "owner" && !context.allowLateExpense && expense.date < previousDate(today(new Date(received)), 2)) throw Object.assign(new Error("Late offline expense needs owner review. Export pending changes; they remain saved on this device."), { status: 403 });
  }
  for (const r of additions(before.returns, after.returns)) {
    requireOpenDate(before, r.date);
    const replay = recordReturn(before, r);
    check(same(without(replay.returns.at(-1), ["createdAt"]), without(r, ["createdAt"])), "Return credit does not match the original bill.");
    expectedMovements.push(...replay.movements.slice(before.movements.length));
  }
  const addedMovements = additions(before.movements, after.movements);
  if (module === "Inventory") {
    const countMovements = addedMovements.filter(m => typeof m.reference === "string" && m.reference.startsWith("COUNT-"));
    const expectedCountMovements: Store["movements"] = [];
    for (const id of countPosts) {
      const count = after.stockCounts!.find(item => item.id === id)!;
      const previous = before.stockCounts!.find(item => item.id === id)!;
      for (let index = 0; index < count.lines.length; index++) {
        const line = count.lines[index];
        const delta = roundQty(line.counted! - previous.lines[index].expected);
        if (delta) expectedCountMovements.push({ id: "", productId: line.productId, qty: delta, date: count.date, type: delta > 0 ? "Stock in" : "Stock out", reference: `COUNT-${id}`, reason: "Physical stock count" });
      }
    }
    check(same(countMovements.map(movementKey).sort(), expectedCountMovements.map(movementKey).sort()), "Stock count adjustments must match the posted count quantities exactly.");
    addedMovements.forEach(m => {
      requireOpenDate(before, m.date);
      check(["Opening stock", "Stock in", "Stock out"].includes(m.type) && !!m.reason?.trim() &&
        (m.type !== "Opening stock" || m.qty > 0 && !before.products.some(p => p.id === m.productId)) &&
        (!(typeof m.reference === "string" && m.reference.startsWith("COUNT-")) || countMovements.includes(m)),
      "Use a valid stock adjustment with a reason.");
    });
  } else {
    const verifiedMovements = addedMovements;
    check(same(verifiedMovements.map(movementKey).sort(), expectedMovements.map(movementKey).sort()), "Stock movements do not match bills, returns, or corrections.");
    if (module === "Purchases") {
      const openingMovements = addedMovements.filter(movement => movement.type === "Opening stock");
      check(openingMovements.every(movement => additions(before.products, after.products).some(product => product.id === movement.productId)), "Opening stock from Purchases must belong to a newly added product.");
      const replayedOpeningMovements = expectedMovements.filter(movement => movement.type === "Opening stock");
      check(same(openingMovements.map(movementKey).sort(), replayedOpeningMovements.map(movementKey).sort()), "Opening stock must match the new product.");
    }
  }
  if (module === "Purchases") check(same(expectedProducts, after.products), "Purchase changes may update only the calculated product costs.");
  if (module === "Production") check(same(expectedProducts, after.products), "Production may update only finished-product costs calculated from the recipe.");
  const afterStock = new Map<string, number>();
  for (const movement of after.movements) afterStock.set(movement.productId, (afterStock.get(movement.productId) || 0) + movement.qty);
  after.products.forEach(p => check(roundQty(afterStock.get(p.id) || 0) >= 0, "This change would make stock negative."));
  for (const key of ["journals", "bankVouchers"] as const) for (const v of after[key] || []) {
    const old = before[key]?.find(a => a.id === v.id);
    if (!old || !same(old, v)) {
      requireOpenDate(before, v.date);
      if (module === "Closing" && key === "bankVouchers") {
        const bankVoucher = v as NonNullable<Store["bankVouchers"]>[number];
        const cash = chartAccounts(after).find(account => account.name === "Cash" && account.type === "Asset");
        check(!old && bankVoucher.kind === "Receipt" && !bankVoucher.reversalOf && bankVoucher.toAccountId === "" && !!cash && !chartAccounts(after).some(child => child.parentId === cash.id) && bankVoucher.counterAccountId === cash.id, "Closing access may only record a new bank receipt from the Cash asset account.");
      }
      if (v.reversalOf) {
        check(actor.role === "owner" && !!v.notes.trim(), "Only the owner can reverse vouchers, with a reason.");
        const original = before[key]?.find(a => a.id === v.reversalOf && a.status === "posted");
        check(!!original && v.status === "posted" && v.date >= original.date && v.date <= today() && !(before[key] || []).some(a => a.reversalOf === original.id) && (after[key] || []).filter(a => a.reversalOf === original.id).length === 1, "Invalid or duplicate reversal.");
        const oldLines = key === "journals" ? (original as any).lines : bankVoucherLines(before, original as any);
        const newLines = key === "journals" ? (v as any).lines : bankVoucherLines(after, v as any);
        const canonicalLines = (lines: any[], store: Store, postedAt: string, reverse: boolean) => lines.map((line: any) => {
          const linked = (store.financialAccounts || []).filter(bank => bank.ledgerAccountId === line.accountId && (!bank.createdAt || bank.createdAt <= postedAt));
          return { accountId: line.accountId, financialAccountId: line.financialAccountId || (linked.length === 1 ? linked[0].id : ""), debit: reverse ? line.credit : line.debit, credit: reverse ? line.debit : line.credit };
        }).sort((a, b) => a.accountId.localeCompare(b.accountId) || a.financialAccountId.localeCompare(b.financialAccountId) || a.debit - b.debit || a.credit - b.credit);
        check(same(canonicalLines(oldLines, before, original!.postedAt!, true), canonicalLines(newLines, after, v.postedAt!, false)), "Reversal must exactly reverse the original entries.");
      }
    }
  }
  for (const old of before.dailyCloses || []) {
    const next = after.dailyCloses?.find(c => c.id === old.id);
    check(!!next, "Closing records cannot be deleted.");
    if (!same(old, next)) {
      check(actor.role === "owner" && old.status === "closed" && next!.status === "reopened" && !!next!.reopenedBy && !!next!.reopenReason?.trim() && Number.isFinite(Date.parse(next!.reopenedAt || "")), "Only the owner can reopen a closing, with a reason.");
      check(same(without(old, ["status"]), without(next, ["status", "reopenedAt", "reopenedBy", "reopenReason"])), "Saved closing figures cannot change.");
      check(!before.dailyCloses?.some(c => c.status === "closed" && c.date > old.date), "Reopen later closings first.");
    }
  }
  for (const close of additions(before.dailyCloses || [], after.dailyCloses || [])) {
    const replay = closeDay(before, close.date, close.counted, close.explanation, actor).dailyCloses!.at(-1)!;
    check(close.actorId === actor.id && same(without(replay, ["id", "closedAt"]), without(close, ["id", "closedAt"])), "Closing figures must match the saved transaction history.");
  }
  // Closed periods also protect opening balances that would change a saved statement.
  for (const account of chartAccounts(after)) { const old = chartAccounts(before).find(a => a.id === account.id); if (account.openingBalance !== 0 && (!old || !same(old, account))) requireOpenDate(before, account.openingDate); }
  if (before.dailyCloses?.some(c => c.status === "closed")) for (const bank of before.financialAccounts || []) {
    check(!!after.financialAccounts?.some(next => next.id === bank.id && (next.ledgerAccountId || "") === (bank.ledgerAccountId || "")), "Reopen closed periods before changing bank ledger links.");
  }
  for (const bank of additions(before.financialAccounts || [], after.financialAccounts || [])) if (bank.ledgerAccountId || bank.openingBalance) {
    const ledger = chartAccounts(after).find(a => a.id === bank.ledgerAccountId);
    requireOpenDate(before, bank.openingDate || ledger?.openingDate || today());
  }
  if (before.dailyCloses?.some(c => c.status === "closed")) for (const account of chartAccounts(before)) {
    const next = chartAccounts(after).find(a => a.id === account.id);
    check(!!next && account.openingBalance === next.openingBalance && account.openingDate === next.openingDate && account.nature === next.nature && account.type === next.type, "Reopen closed periods before changing account opening balances or classification.");
  }
}

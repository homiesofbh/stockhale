import { chartAccounts } from "./accounts";
import { balance, emptyStore, isPosted, recordPayment, recordReturn, recordTrade, saveProduct, saveContact, round, stock, today, total, type Store, type Trade } from "./model";
import { bankVoucherLines } from "./bank-vouchers";
import { cashChequeSettlement, cashStatement, cashFlow, changeCheque, check, closeDay, correctTrade, linkLegacyWalkIn, expenseDateAllowed, tradeDateAllowed, previousDate, requireOpenDate, validDate, type Actor } from "./operations";
export type ValidationContext = { actor: Actor; occurredAt: string; receivedAt?: string; allowLateExpense?: boolean };
const clean = (value: any): any => Array.isArray(value) ? value.map(clean) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => [k, clean(value[k])])) : value;
export const same = (a: unknown, b: unknown) => JSON.stringify(clean(a)) === JSON.stringify(clean(b));
const without = (value: any, keys: string[]) => Object.fromEntries(Object.entries(value).filter(([k]) => !keys.includes(k)));
const additions = <T extends { id: string }>(before: T[], after: T[]) => after.filter(a => !before.some(b => b.id === a.id));
function immutable<T extends { id: string }>(before: T[], after: T[], label: string) { for (const old of before) check(after.some(next => next.id === old.id && same(old, next)), `${label} cannot be changed or deleted.`); }
const movementKey = (m: Store["movements"][number]) => JSON.stringify(clean(without(m, ["id"])));
export function validateStore(s: Store) {
  check(!!s && s.version === 1, "Unsupported store version.");
  for (const key of Object.keys(emptyStore())) if (key !== "version") check(Array.isArray((s as any)[key]), `Invalid collection: ${key}.`);
  for (const [key, value] of Object.entries(s)) {
    if (!Array.isArray(value) || ["heads", "categories", "expenseCategories", "units"].includes(key)) continue;
    const ids = new Set<string>();
    for (const record of value as any[]) { check(!!record && typeof record.id === "string" && !!record.id && !ids.has(record.id), `Invalid or duplicate ID in ${key}.`); ids.add(record.id); }
  }
  for (const key of ["heads", "categories", "expenseCategories", "units"] as const) check((s[key] || []).every(v => typeof v === "string" && !!v.trim()), `Invalid ${key}.`);
  let productCheck = emptyStore();
  for (const product of s.products) productCheck = saveProduct(productCheck, product);
  for (const contact of s.customers) { check(typeof contact.name === "string" && typeof contact.phone === "string" && typeof contact.email === "string" && typeof contact.address === "string", "Invalid customer details."); saveContact(s, "Customer", contact); }
  for (const contact of s.suppliers) { check(typeof contact.name === "string" && typeof contact.phone === "string" && typeof contact.email === "string" && typeof contact.address === "string", "Invalid supplier details."); saveContact(s, "Supplier", contact); }
  for (const trade of [...s.invoices, ...s.purchases]) {
    check(validDate(trade.date) && typeof trade.number === "string" && !!trade.number && [undefined, "draft", "posted", "void"].includes(trade.status), "Invalid bill details.");
    check(Array.isArray(trade.lines) && trade.lines.length > 0 && trade.lines.every(l => s.products.some(p => p.id === l.productId) && [l.qty, l.price, l.cost].every(Number.isFinite) && l.qty > 0 && l.price >= 0 && l.cost >= 0), "Invalid bill lines.");
    check(Number.isFinite(trade.paid) && trade.paid >= 0 && trade.paid <= total(trade) && Number.isFinite(trade.discount) && trade.discount >= 0 && trade.discount <= trade.lines.reduce((n, l) => n + l.price * l.qty, 0) && Number.isFinite(trade.tax) && trade.tax >= 0 && trade.tax <= 100, "Invalid bill amounts.");
    check(typeof trade.contactId === "string" && (!trade.contactId || (s.invoices.some(t => t.id === trade.id) ? s.customers : s.suppliers).some(c => c.id === trade.contactId)), "Bill references an unknown customer or supplier.");
    check(s.heads.includes(trade.head), "Bill references an unknown account head.");
  }
  check(new Set([...s.invoices, ...s.purchases].map(t => t.id)).size === s.invoices.length + s.purchases.length, "Duplicate bill IDs.");
  check(new Set([...s.invoices, ...s.purchases].map(t => t.number)).size === s.invoices.length + s.purchases.length, "Duplicate bill references.");
  for (const p of s.payments) {
    const trade = (p.kind === "Customer" ? s.invoices : s.purchases).find(t => t.id === p.tradeId);
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
    check(!!trade && isPosted(trade) && trade.contactId === p.contactId && validDate(p.date) && Number.isFinite(p.amount) && p.amount !== 0 && round(p.amount) === p.amount && s.heads.includes(p.head), "Invalid payment link or amount.");
    check(p.method !== "Cheque" || !!p.chequeNumber && !!p.chequeBank && validDate(p.chequeDate || "") && ["pending", "cleared", "bounced", "cancelled"].includes(p.chequeStatus || "pending"), "Invalid cheque details.");
  }
  for (const e of s.expenses) check(validDate(e.date) && Number.isFinite(e.amount) && e.amount > 0 && round(e.amount) === e.amount && s.heads.includes(e.head) && s.expenseCategories.includes(e.category), "Invalid expense.");
  for (const r of s.returns) check(validDate(r.date) && Number.isFinite(r.qty) && r.qty > 0 && Number.isFinite(r.amount) && r.amount >= 0 && s.products.some(p => p.id === r.productId) && (r.kind === "Damaged stock" || [...s.invoices, ...s.purchases].some(t => t.id === r.tradeId && isPosted(t))), "Invalid return.");
  for (const m of s.movements) check(validDate(m.date) && Number.isFinite(m.qty) && s.products.some(p => p.id === m.productId), "Invalid stock movement.");
  for (const c of s.corrections || []) check(validDate(c.date) && !!c.reason?.trim() && c.before.id === c.tradeId && c.after.id === c.tradeId, "Invalid bill correction history.");
  for (const e of s.chequeEvents || []) check(validDate(e.date) && !!e.reason?.trim() && s.payments.some(p => p.id === e.paymentId && p.method === "Cheque"), "Invalid cheque history.");
  s.products.forEach(p => check(stock(s, p.id) >= 0, "Invalid backup: stock cannot be negative."));
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
  validateStore(after);
  const actor = context.actor, received = context.receivedAt || new Date().toISOString();
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
  immutable(before.returns, after.returns, "Returns");
  immutable(before.expenses, after.expenses, "Expenses");
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
  for (const key of ["invoices", "purchases"] as const) {
    const kind = key === "invoices" ? "Sale" : "Purchase";
    for (const old of before[key]) {
      const next = after[key].find(t => t.id === old.id);
      check(!!next, "Bills cannot be deleted. Reverse a posted bill or keep the draft.");
      if (same(old, next) || newLinks.some(link => link.tradeId === old.id)) continue;
      const correction = additions(before.corrections || [], after.corrections || []).find(c => c.tradeId === old.id);
      if (isPosted(old)) { check(!!correction && same(correction.after, next), "Posted bills are locked. Use an owner correction with a reason."); continue; }
      check(old.status === "draft" && next!.status !== "void", "Voided bills are locked.");
      requireOpenDate(before, old.date);
      check(old.number === next!.number, "Draft bill reference cannot change.");
    }
    for (const trade of after[key].filter(t => !before[key].some(old => old.id === t.id && same(old, t)) && !newLinks.some(link => link.tradeId === t.id) && !(after.corrections || []).some(c => c.tradeId === t.id && !before.corrections?.some(old => old.id === c.id)))) {
      requireOpenDate(before, trade.date);
      check(tradeDateAllowed(trade.date, actor, context.occurredAt, kind), kind === "Sale" ? "Staff can create sales only for today. Ask the owner to enter a historical sale." : "Staff can create purchases only for today or the previous two calendar days. Future dates are not allowed.");
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
  for (const p of before.payments) {
    const next = after.payments.find(a => a.id === p.id);
    check(!!next, "Payments cannot be deleted.");
    if (!same(p, next) && !newLinks.some(link => link.tradeId === p.tradeId)) check(additions(before.chequeEvents || [], after.chequeEvents || []).some(e => e.paymentId === p.id), "Payments are locked; use the cheque lifecycle or a refund.");
  }
  let paymentBase = { ...before, invoices: after.invoices, purchases: after.purchases, customers: after.customers };
  for (const p of additions(before.payments, after.payments)) {
    requireOpenDate(before, p.date);
    const replay = recordPayment(paymentBase, p);
    check(same(without(replay.payments.at(-1), ["createdAt"]), without(p, ["createdAt"])), "Payment does not match the remaining bill balance.");
    paymentBase = { ...paymentBase, payments: [...paymentBase.payments, p] };
  }
  for (const expense of additions(before.expenses, after.expenses)) {
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
    addedMovements.forEach(m => { requireOpenDate(before, m.date); check(["Opening stock", "Stock in", "Stock out"].includes(m.type) && !!m.reason?.trim() && (m.type !== "Opening stock" || m.qty > 0 && !before.products.some(p => p.id === m.productId)), "Use a valid stock adjustment with a reason."); });
  } else check(same(addedMovements.map(movementKey).sort(), expectedMovements.map(movementKey).sort()), "Stock movements do not match bills, returns, or corrections.");
  if (module === "Purchases") check(same(expectedProducts, after.products), "Purchase changes may update only the calculated product costs.");
  after.products.forEach(p => check(stock(after, p.id) >= 0, "This change would make stock negative."));
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

import { balance, financialRows, isPosted, recordTrade, round, roundQty, stock, today, total, uid, type Expense, type Payment, type Store, type Trade } from "./model";
import { chartAccounts } from "./accounts";
import { bankStatement, saveBankVoucher } from "./bank-vouchers";
import { saveJournal } from "./journals";
export type Actor = { id: string; name?: string; role: "owner" | "member"; modules?: string[] };
export type TradeCorrection = { id: string; tradeId: string; kind: "Sale" | "Purchase"; date: string; reason: string; actorId: string; occurredAt: string; before: Trade; after: Trade };
export type ChequeEvent = { id: string; paymentId: string; date: string; status: "cleared" | "bounced" | "cancelled"; accountId: string; reason: string; actorId: string; occurredAt: string };
export const cashChequeSettlement = "cash";
export type DailyClose = { actorName?: string; summary?: { sales: number; purchases: number; expenses: number; openingCash: number; cashReceipts: number; cashPayments: number; bankClosing: number; bankBalances: { id: string; name: string; closing: number }[] }; id: string; date: string; status: "closed" | "reopened"; expected: number; counted: number; variance: number; explanation: string; actorId: string; closedAt: string; reopenedAt?: string; reopenedBy?: string; reopenReason?: string };
export const check = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };
export function validDate(date: string) { return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date; }
export function previousDate(date: string, days = 1) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - days); return d.toISOString().slice(0, 10); }
export function requireOpenDate(s: Store, date: string) { check(validDate(date), "Enter a valid date."); check(!(s.dailyCloses || []).some(c => c.status === "closed" && date <= c.date), "This date is closed. The owner must reopen the affected closing first."); }
export function expenseDateAllowed(date: string, actor: Actor, occurredAt = new Date().toISOString()) {
  const businessDate = today(new Date(occurredAt));
  return validDate(date) && date <= businessDate && (actor.role === "owner" || date >= previousDate(businessDate, 2));
}
export function saveExpense(s: Store, expense: Expense, actor: Actor, occurredAt = new Date().toISOString()): Store {
  check(expenseDateAllowed(expense.date, actor, occurredAt), "Expense date must be today or within the previous two calendar days; only the owner may backdate further. Future dates are not allowed.");
  requireOpenDate(s, expense.date);
  check(Number.isFinite(expense.amount) && expense.amount > 0 && round(expense.amount) === expense.amount, "Enter a positive expense amount with at most two decimals.");
  check(s.heads.includes(expense.head) && s.expenseCategories.includes(expense.category), "Select a valid expense head and category.");
  check(expense.method === "Cash" || (s.financialAccounts || []).some(a => a.name === expense.method && a.active !== false), "Select an active payment account.");
  const old = s.expenses.find(e => e.id === expense.id);
  check(!old || actor.role === "owner", "Only the owner can correct an expense.");
  check(!old, "Recorded expenses are locked; enter a journal correction with a reason.");
  return { ...s, expenses: [...s.expenses, { ...expense, createdAt: occurredAt }] };
}
export function postTrade(s: Store, kind: "Sale" | "Purchase", id: string): Store {
  const key = kind === "Sale" ? "invoices" : "purchases", trade = s[key].find(t => t.id === id);
  check(!!trade && trade.status === "draft", "Only a draft can be posted.");
  requireOpenDate(s, trade!.date);
  return recordTrade({ ...s, [key]: s[key].filter(t => t.id !== id) }, kind, { ...trade!, status: "posted", postedAt: new Date().toISOString() });
}
export function tradeDateAllowed(date: string, actor: Actor, occurredAt = new Date().toISOString(), kind: "Sale" | "Purchase" = "Sale") {
  const businessDate = today(new Date(occurredAt));
  return validDate(date) && date <= businessDate && (actor.role === "owner" || (kind === "Sale" ? date === businessDate : date >= previousDate(businessDate, 2)));
}
export function correctTrade(s: Store, kind: "Sale" | "Purchase", replacement: Trade, reason: string, actor: Actor, date = today()): Store {
  check(actor.role === "owner", "Only the workspace owner can correct posted bills.");
  check(!!reason.trim(), "A correction reason is required.");
  const key = kind === "Sale" ? "invoices" : "purchases", old = s[key].find(t => t.id === replacement.id);
  check(!!old && isPosted(old), "Select a posted bill.");
  check(!s.payments.some(p => p.tradeId === old!.id) && !s.returns.some(r => r.tradeId === old!.id), "Bills with linked payments, cheques, or returns are locked. Use linked returns/refunds or separate adjustment vouchers instead of rewriting them.");
  requireOpenDate(s, old!.date); requireOpenDate(s, date);
  check(date >= old!.date && date <= today(), "Correction date must be on or after the bill date and no later than today.");
  check(["id", "number", "date", "contactId", "method", "financialAccountId", "createdAt", "postedAt", "replacementOf"].every(k => (old as any)[k] === (replacement as any)[k]), "Bill identity, date, customer/supplier, and payment account cannot change after posting.");
  check(replacement.status === "void" || replacement.status === "posted" || !replacement.status, "Invalid correction status.");
  const normalized = kind === "Purchase" ? { ...replacement, lines: replacement.lines.map(l => ({ ...l, cost: l.price })), costBefore: Object.fromEntries(replacement.lines.map(l => [l.productId, old!.costBefore?.[l.productId] ?? s.products.find(p => p.id === l.productId)?.cost ?? l.cost])) } : replacement;
  const after = { ...(replacement.status === "void" ? old! : normalized), status: replacement.status === "void" ? "void" as const : "posted" as const };
  const oldQty = new Map<string, number>(), newQty = new Map<string, number>();
  old!.lines.forEach(l => oldQty.set(l.productId, (oldQty.get(l.productId) || 0) + l.qty));
  if (isPosted(after)) after.lines.forEach(l => newQty.set(l.productId, (newQty.get(l.productId) || 0) + l.qty));
  const moves = [...new Set([...oldQty.keys(), ...newQty.keys()])].map(productId => ({ id: uid(), productId, date, type: "Bill correction", reference: old!.number, reason: reason.trim(), qty: roundQty(((newQty.get(productId) || 0) - (oldQty.get(productId) || 0)) * (kind === "Sale" ? -1 : 1)) })).filter(m => m.qty !== 0);
  moves.forEach(m => check(stock(s, m.productId) + m.qty >= 0, "This correction would make stock negative."));
  const candidate = { ...s, [key]: s[key].filter(t => t.id !== old!.id), movements: [...s.movements, ...moves] };
  // Validate corrected amounts and lines using the normal bill rules, without a second stock deduction.
  if (isPosted(after)) recordTrade({ ...candidate, movements: [...candidate.movements, ...after.lines.map(l => ({ id: uid(), productId: l.productId, date, type: "Validation", reference: "", reason: "", qty: kind === "Sale" ? l.qty : 0 }))] }, kind, after);
  const nextPurchases = kind === "Purchase" ? s.purchases.map(t => t.id === old!.id ? after : t) : s.purchases;
  const products = kind === "Purchase" ? s.products.map(p => {
    if (!oldQty.has(p.id) && !newQty.has(p.id)) return p;
    const latest = nextPurchases.filter(isPosted).filter(t => t.lines.some(l => l.productId === p.id)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
    const lines = latest?.lines.filter(l => l.productId === p.id);
    const cost = lines?.length ? round(lines.reduce((n, l) => n + l.qty * l.price, 0) / lines.reduce((n, l) => n + l.qty, 0)) : old!.costBefore?.[p.id] ?? p.cost;
    return { ...p, cost };
  }) : s.products;
  const correction: TradeCorrection = { id: uid(), tradeId: old!.id, kind, date, reason: reason.trim(), actorId: actor.id, occurredAt: new Date().toISOString(), before: old!, after };
  return { ...s, [key]: s[key].map(t => t.id === old!.id ? after : t), products, movements: [...s.movements, ...moves], corrections: [...(s.corrections || []), correction] };
}
export function tradeAt(s: Store, trade: Trade, through = ""): Trade {
  if (!through) return trade;
  return (s.corrections || []).filter(c => c.tradeId === trade.id && c.date > through).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).reduce((t, c) => c.before, trade);
}
export function chequeSettlements(s: Store, p: Payment): { date: string; amount: number; accountId?: string; status: string }[] {
  const events = (s.chequeEvents || []).filter(e => e.paymentId === p.id).sort((a, b) => a.date.localeCompare(b.date) || a.occurredAt.localeCompare(b.occurredAt));
  if (!events.length) return p.chequeStatus === "cleared" ? [{ date: p.clearedDate || p.date, amount: p.amount, accountId: p.financialAccountId, status: "cleared" }] : [];
  const entries: { date: string; amount: number; accountId?: string; status: string }[] = [];
  let status = "pending", accountId = p.financialAccountId;
  // Existing legacy clearances may be followed by a new bounce event.
  if (p.clearedDate && events[0].status !== "cleared") { status = "cleared"; entries.push({ date: p.clearedDate, amount: p.amount, accountId, status }); }
  for (const event of events) {
    if (event.status === "cleared") { accountId = event.accountId; entries.push({ date: event.date, amount: p.amount, accountId, status: event.status }); }
    else if (status === "cleared") entries.push({ date: event.date, amount: -p.amount, accountId, status: event.status });
    status = event.status;
  }
  return entries;
}
export function paymentAt(s: Store, p: Payment, through: string): Payment {
  if (p.method !== "Cheque" || !through) return p;
  const events = chequeSettlements(s, p).filter(e => e.date <= through);
  const amount = round(events.reduce((n, e) => n + e.amount, 0));
  return { ...p, chequeStatus: amount !== 0 ? "cleared" : "pending", clearedDate: events.at(-1)?.date || p.date };
}
export function changeCheque(s: Store, paymentId: string, status: ChequeEvent["status"], date: string, accountId: string, reason: string, actor: Actor): Store {
  const p = s.payments.find(p => p.id === paymentId && p.method === "Cheque");
  const forwarded = (s.crossCheques || []).find(c => c.sourcePaymentId === paymentId);
  check(!!p && ((!p.chequeStatus || p.chequeStatus === "pending") || p.chequeStatus === "cleared" && status === "bounced"), "This cheque cannot make that transition.");
  check(validDate(date) && date >= p!.date && date >= (p!.clearedDate || p!.date) && date <= today(), "Cheque action date must follow receipt/clearance and cannot be in the future.");
  requireOpenDate(s, date);
  check(!!reason.trim(), "Enter the cheque action reason.");
  if (status === "cleared") {
    if (!forwarded) check(accountId === cashChequeSettlement
      ? !!chartAccounts(s).find(a => a.name === "Cash" && a.type === "Asset")
      : !!s.financialAccounts?.find(a => a.id === accountId && a.active !== false), "Select Cash in hand or an active bank / wallet for cheque settlement.");
    const trade = [...s.invoices, ...s.purchases].find(t => t.id === p!.tradeId);
    if (trade) {
      check(isPosted(trade), "Cheque must belong to a posted bill.");
      const due = balance(s, trade);
      check(p!.amount > 0 ? p!.amount <= due : p!.amount >= due, "Cheque exceeds the remaining bill balance.");
    } else check(!!p!.advance || !!p!.accountLevel, "A cheque without a bill must be an advance or account-level payment.");
  }
  const event: ChequeEvent = { id: uid(), paymentId, status, date, accountId: status === "cleared" ? accountId : p!.financialAccountId || "", reason: reason.trim(), actorId: actor.id, occurredAt: new Date().toISOString() };
  return { ...s, payments: s.payments.map(payment => payment.id === paymentId ? { ...payment, chequeStatus: status, ...(status === "cleared" ? { clearedDate: date, ...(accountId && accountId !== cashChequeSettlement ? { financialAccountId: accountId } : { financialAccountId: undefined }) } : p!.chequeStatus === "cleared" ? { clearedDate: p!.clearedDate || p!.date } : {}) } : payment), crossCheques: forwarded ? (s.crossCheques || []).map(c => c.id === forwarded.id ? { ...c, status: status === "cleared" ? "cleared" : status === "bounced" ? "bounced" : c.status } : c) : s.crossCheques, chequeEvents: [...(s.chequeEvents || []), event] };
}
export function cashStatement(s: Store, from = "", to = today()) {
  const cash = chartAccounts(s).find(a => a.name === "Cash" && a.type === "Asset");
  const base = cash && (!to || !cash.openingDate || cash.openingDate <= to) ? cash.openingBalance * (cash.nature === "Debit" ? 1 : -1) : 0;
  const rows = financialRows(s).filter(r => (!to || r.date <= to) && (!cash?.openingDate || r.date >= cash.openingDate));
  const before = from ? rows.filter(r => r.date < from).reduce((n, r) => n + r.cash, 0) : 0;
  const adjustment = from && cash?.openingDate && cash.openingDate >= from ? base : 0;
  const period = rows.filter(r => (!from || r.date >= from) && (!to || r.date <= to));
  const receipts = round(period.reduce((n, r) => n + Math.max(0, r.cash), 0)), payments = round(period.reduce((n, r) => n + Math.max(0, -r.cash), 0));
  const opening = round(base - adjustment + before);
  return { opening, openingAdjustment: adjustment, receipts, payments, closing: round(opening + adjustment + receipts - payments) };
}
export function cashFlow(s: Store, from = "", to = today()) {
  const cashAccount = chartAccounts(s).find(a => a.name === "Cash" && a.type === "Asset");
  const cash = cashStatement(s, from, to), banks = (s.financialAccounts || []).map(a => bankStatement(s, a, from, to));
  const unassigned = financialRows(s).filter(r => !r.financialAccountId && (!to || r.date <= to));
  const opening = round(cash.opening + banks.reduce((n, b) => n + b.opening, 0) + (from ? unassigned.filter(r => r.date < from).reduce((n, r) => n + r.bank, 0) : 0));
  const flows: number[] = [], grouped = new Map<string, number>();
  for (const row of financialRows(s).filter(r => (!from || r.date >= from) && (!to || r.date <= to))) {
    const bankAccount = (s.financialAccounts || []).find(a => a.id === row.financialAccountId);
    const bankLedger = chartAccounts(s).find(a => a.id === bankAccount?.ledgerAccountId);
    const bankOpeningDate = bankAccount?.openingBalance !== undefined ? bankAccount.openingDate : bankLedger?.openingDate;
    const amount = round((cashAccount?.openingDate && row.date < cashAccount.openingDate ? 0 : row.cash) + (bankOpeningDate && row.date < bankOpeningDate ? 0 : row.bank));
    if (row.type === "Journal" || row.type.startsWith("Bank ")) { const key = `${row.date}:${row.reference}`; grouped.set(key, round((grouped.get(key) || 0) + amount)); }
    else flows.push(amount);
  }
  flows.push(...grouped.values());
  const receipts = round(flows.reduce((n, f) => n + Math.max(0, f), 0)), payments = round(flows.reduce((n, f) => n + Math.max(0, -f), 0));
  const adjustment = round(cash.openingAdjustment + banks.reduce((n, b) => n + b.openingAdjustment, 0));
  return { opening, openingAdjustment: adjustment, receipts, payments, net: round(receipts - payments), closing: round(opening + adjustment + receipts - payments) };
}
export function closeDay(s: Store, date: string, counted: number, explanation: string, actor: Actor): Store {
  check(actor.role === "owner" || !!actor.modules?.includes("Closing"), "You do not have permission for Closing.");
  requireOpenDate(s, date);
  check(date <= today(), "Future dates cannot be closed.");
  check(Number.isFinite(counted) && counted >= 0 && round(counted) === counted, "Enter counted cash with at most two decimals.");
  const expected = cashStatement(s, "", date).closing, variance = round(counted - expected);
  check(variance === 0 || !!explanation.trim(), "Explain the cash variance before closing.");
  const rows = financialRows(s).filter(r => r.date === date), cash = cashStatement(s, date, date);
  const summary = {
    sales: round(rows.filter(r => r.reference.startsWith("INV") && ["Sale", "Sales return", "Bill correction", "Bill correction reversal"].includes(r.type)).reduce((n, r) => n + r.amount, 0)),
    purchases: round(-rows.filter(r => r.reference.startsWith("PUR") && ["Purchase", "Purchase return", "Bill correction", "Bill correction reversal"].includes(r.type)).reduce((n, r) => n + r.amount, 0)),
    expenses: round(-rows.filter(r => r.type === "Expense").reduce((n, r) => n + r.amount, 0)),
    openingCash: round(cash.opening + cash.openingAdjustment), cashReceipts: cash.receipts, cashPayments: cash.payments,
    bankClosing: round(cashFlow(s, "", date).closing - expected),
    bankBalances: (s.financialAccounts || []).map(a => ({ id: a.id, name: a.name, closing: bankStatement(s, a, "", date).closing })),
  };
  const close: DailyClose = { id: uid(), date, status: "closed", expected, counted, variance, summary, explanation: explanation.trim(), actorId: actor.id, ...(actor.name ? { actorName: actor.name } : {}), closedAt: new Date().toISOString() };
  return { ...s, dailyCloses: [...(s.dailyCloses || []), close] };
}
export function reopenDay(s: Store, id: string, reason: string, actor: Actor): Store {
  check(actor.role === "owner" && !!reason.trim(), "Only the owner may reopen a day, with a reason.");
  const close = s.dailyCloses?.find(c => c.id === id);
  check(!!close && close.status === "closed", "Select a closed day.");
  check(!s.dailyCloses?.some(c => c.status === "closed" && c.date > close!.date), "Reopen later closings first.");
  return { ...s, dailyCloses: s.dailyCloses!.map(c => c.id === id ? { ...c, status: "reopened", reopenedAt: new Date().toISOString(), reopenedBy: actor.id, reopenReason: reason.trim() } : c) };
}
export function reverseVoucher(s: Store, type: "Journal" | "Bank", id: string, date: string, reason: string, actor: Actor): Store {
  check(actor.role === "owner" && !!reason.trim(), "Only the owner can reverse vouchers, with a reason."); requireOpenDate(s, date);
  if (type === "Journal") {
    const v = s.journals?.find(v => v.id === id && v.status === "posted");
    check(!!v && !s.journals?.some(r => r.reversalOf === id), "Select a posted journal that has not been reversed."); check(date >= v!.date && date <= today(), "Invalid reversal date.");
    return saveJournal(s, { ...v!, id: uid(), number: "", date, reversalOf: id, reference: v!.number, notes: reason.trim(), lines: v!.lines.map(l => {
      const linked = (s.financialAccounts || []).filter(bank => bank.ledgerAccountId === l.accountId && (!bank.createdAt || bank.createdAt <= v!.postedAt!));
      return { ...l, financialAccountId: l.financialAccountId || (linked.length === 1 ? linked[0].id : undefined), id: uid(), debit: l.credit, credit: l.debit };
    }) }, true);
  }
  const v = s.bankVouchers?.find(v => v.id === id && v.status === "posted");
  check(!!v && !s.bankVouchers?.some(r => r.reversalOf === id), "Select a posted bank voucher that has not been reversed."); check(date >= v!.date && date <= today(), "Invalid reversal date.");
  return saveBankVoucher(s, { ...v!, id: uid(), number: "", date, reversalOf: id, reference: v!.number, notes: reason.trim(), kind: v!.kind === "Receipt" ? "Payment" : v!.kind === "Payment" ? "Receipt" : "Transfer", ...(v!.kind === "Transfer" ? { accountId: v!.toAccountId, toAccountId: v!.accountId, ledgerAccountId: v!.toLedgerAccountId || s.financialAccounts?.find(a => a.id === v!.toAccountId)?.ledgerAccountId, toLedgerAccountId: v!.ledgerAccountId || s.financialAccounts?.find(a => a.id === v!.accountId)?.ledgerAccountId } : {}) }, true);
}

export function updateDraft(s: Store, kind: "Sale" | "Purchase", replacement: Trade): Store {
  const key = kind === "Sale" ? "invoices" : "purchases", old = s[key].find(t => t.id === replacement.id);
  check(!!old && old.status === "draft", "Only drafts can be edited directly.");
  requireOpenDate(s, old!.date);
  return recordTrade({ ...s, [key]: s[key].filter(t => t.id !== replacement.id) }, kind, { ...replacement, number: old!.number, status: "draft" });
}

export type WalkInLink = { id: string; tradeId: string; customerId: string; reason: string; actorId: string; occurredAt: string };
export function linkLegacyWalkIn(s: Store, tradeId: string, customerId: string, reason: string, actor: Actor): Store {
  check(actor.role === "owner" && !!reason.trim(), "Only the owner can link a historical walk-in, with a review reason.");
  const trade = s.invoices.find(t => t.id === tradeId && !t.contactId && isPosted(t));
  check(!!trade, "Select an unlinked historical walk-in bill.");
  const phone = (trade!.walkInPhone || "").replace(/[^0-9+]/g, "");
  const matches = phone ? s.customers.filter(c => c.phone.replace(/[^0-9+]/g, "") === phone) : [];
  check(!!customerId || matches.length <= 1, "Multiple customers share this phone. Select the customer explicitly.");
  const customer = customerId ? s.customers.find(c => c.id === customerId) : matches[0] || { id: uid(), name: trade!.walkInName?.trim() || trade!.walkInCompany?.trim() || `Walk-in ${trade!.number}`, company: trade!.walkInCompany?.trim() || "", phone: trade!.walkInPhone?.trim() || "", email: "", address: trade!.walkInAddress?.trim() || "" };
  check(!!customer, "Select an existing customer.");
  const link: WalkInLink = { id: uid(), tradeId, customerId: customer!.id, reason: reason.trim(), actorId: actor.id, occurredAt: new Date().toISOString() };
  return { ...s, customers: s.customers.some(c => c.id === customer!.id) ? s.customers : [...s.customers, customer!], invoices: s.invoices.map(t => t.id === tradeId ? { ...t, contactId: customer!.id } : t), payments: s.payments.map(p => p.tradeId === tradeId ? { ...p, contactId: customer!.id } : p), walkInLinks: [...(s.walkInLinks || []), link] };
}

export function unpostTrade(s: Store, kind: "Sale" | "Purchase", replacement: Trade, reason: string, actor: Actor, date = today()): Store {
  const reversed = correctTrade(s, kind, { ...replacement, status: "void" }, reason, actor, date);
  return recordTrade(reversed, kind, { ...replacement, id: uid(), number: "", date, status: "draft", postedAt: undefined, replacementOf: replacement.id });
}

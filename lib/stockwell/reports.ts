import { cashFlow, cashStatement, chequeSettlements, paymentAt, tradeAt } from "./operations";
import { bankBalanceSummary, bankStatement } from "./bank-vouchers";
import { chartAccounts } from "./accounts";
import { journalAccountBalance } from "./journals";
import {
  balance,
  isPosted,
  today,
  financialRows,
  paid,
  isSettledPayment,
  paymentDate,
  periodMatch,
  profit,
  returned,
  round,
  roundQty,
  stock,
  subtotal,
  total,
  unappliedCreditBalance,
  type Store,
} from "./model";
import {
  filterTrades,
  matchesQuery,
  type RecordFilters,
} from "./record-selectors";

export type ReportData = { columns: string[]; rows: unknown[][]; customerIds?: string[]; contactSummary?: { business: number; payments: number; outstanding: number } };

export function createReportData(
  s: Store,
  options: RecordFilters & { report: string; reportContact: string; reportProduct?: string; manufacturer?: boolean },
): ReportData {
  const { report, reportContact, reportProduct = "", from, to, query, manufacturer = false } = options;
  // The start date selects bills; all settlements through the end date count,
  // including those before the start date. Status filtering uses that same snapshot.
  const asOf: Store = to ? {
    ...s,
    invoices: s.invoices.map(t => tradeAt(s, t, to)),
    purchases: s.purchases.map(t => tradeAt(s, t, to)),
    payments: s.payments.map(p => paymentAt(s, p, to)).filter((p) => paymentDate(p) <= to),
    returns: s.returns.filter((r) => r.date <= to),
    chequeEvents: (s.chequeEvents || []).filter(event => event.date <= to),
    crossCheques: (s.crossCheques || []).filter(crossCheque => crossCheque.date <= to),
  } : s;
  const invoices = filterTrades(asOf, asOf.invoices, options);
  const purchases = filterTrades(asOf, asOf.purchases, options, true);
  const accounting = financialRows(s);
  const matches = (...values: unknown[]) => matchesQuery(query, ...values);
  const inRange = (date: string) => periodMatch(date, from, to);
  const pName = (id: string) =>
    s.products.find((p) => p.id === id)?.name || "Unknown item";
  const cName = (id: string, supplier = false, trade?: { walkInName?: string; walkInCompany?: string; walkInPhone?: string }) => {
    const contact = (supplier ? s.suppliers : s.customers).find((c) => c.id === id);
    if (contact) return [contact.name, contact.company, contact.phone].filter(Boolean).join(" · ");
    return [trade?.walkInName, trade?.walkInCompany, trade?.walkInPhone].filter(Boolean).join(" · ") || "Walk-in customer";
  };
  if (report === "Customer business report") {
    const groups = new Map<string, typeof invoices>();
    invoices.filter(t => isPosted(t) && t.contactId && (!reportContact || t.contactId === reportContact)).forEach(t => {
      groups.set(t.contactId, [...(groups.get(t.contactId) || []), t]);
    });
    const customerIds = [...groups.keys()].sort((a, b) => cName(a).localeCompare(cName(b), undefined, { sensitivity: "base" }));
    return {
      columns: ["Customer", "Bills", "Billed total", "Return credit", "Total business", "Paid", "Outstanding on these bills"],
      customerIds,
      rows: customerIds.map(id => {
        const bills = groups.get(id)!;
        const billed = round(bills.reduce((n, t) => n + total(t), 0));
        const credits = round(bills.reduce((n, t) => n + returned(asOf, t.id), 0));
        return [cName(id), bills.length, billed, credits, round(billed - credits), round(bills.reduce((n, t) => n + paid(asOf, t), 0)), round(bills.reduce((n, t) => n + balance(asOf, t), 0))];
      }),
    };
  }
  if (
    [
      "Billing report",
      "Sales report",
      "Cash-sale report",
      "Credit-sale report",
      "Purchase report",
      "Receivables report",
      "Payables report",
    ].includes(report)
  ) {
    const supplier =
      report === "Purchase report" || report === "Payables report";
    let list = (supplier ? purchases : invoices).filter(isPosted);
    if (report === "Cash-sale report") list = list.filter(t => t.method === "Cash" && balance(asOf, t) === 0);
    if (report === "Credit-sale report") list = list.filter(t => balance(asOf, t) > 0);
    if (report === "Receivables report" || report === "Payables report")
      list = list.filter((t) => balance(asOf, t) !== 0);
    const tradeRows = list.map((t) => [t.number, t.date, cName(t.contactId, supplier, t), subtotal(t), t.discount, t.tax, total(t), returned(asOf, t.id), paid(asOf, t), balance(asOf, t)]).filter(row => inRange(String(row[1])) && matches(row[0], row[1], row[2]));
    const advanceRows = report === "Receivables report" || report === "Payables report"
      ? asOf.payments.filter(p => p.kind === (supplier ? "Supplier" : "Customer") && (p.advance || p.accountLevel) && !p.tradeId && isSettledPayment(p) && inRange(p.date))
          .filter(p => (!reportContact || p.contactId === reportContact) && matches(p.date, cName(p.contactId, supplier), p.accountLevel ? "Supplier account payment" : "Unapplied advance", p.method, p.head, p.notes))
          .map(p => [p.accountLevel ? "ACCOUNT PAYMENT" : "ADVANCE", p.date, cName(p.contactId, supplier), 0, 0, 0, 0, 0, p.amount, -p.amount])
      : [];
    const forwardedChequeRows = supplier && report === "Payables report"
      ? (asOf.crossCheques || []).filter(c => c.destinationKind === "Supplier" && (!reportContact || c.destinationId === reportContact)).flatMap(c => {
          const source = asOf.payments.find(p => p.id === c.sourcePaymentId);
          return source ? chequeSettlements(asOf, source).filter(entry => (entry.status === "cleared" || entry.status === "bounced") && inRange(entry.date))
            .filter(entry => matches(entry.date, c.destinationName, "Forwarded customer cheque", source.chequeNumber, source.chequeBank))
            .map(entry => ["FORWARDED CHEQUE", entry.date, c.destinationName, 0, 0, 0, 0, 0, entry.amount, -entry.amount]) : [];
        })
      : [];
    return {
      columns: [
        "Reference",
        "Date",
        supplier ? "Supplier" : "Customer",
        "Subtotal",
        "Discount",
        "Tax %",
        "Original total",
        "Return credit",
        "Paid",
        ...(report === "Cash-sale report" ? [] : ["Balance"]),
      ],
      rows: [...tradeRows, ...advanceRows, ...forwardedChequeRows].map(row => report === "Cash-sale report" ? row.slice(0, 9) : row),
    };
  }
  if (report === "Payment report") {
    const rows = s.payments.filter(p => inRange(p.date) && matches(p.date, p.kind, p.method, p.head, p.notes, p.chequeNumber, p.chequeBank)).map(p => [p.date, p.kind, p.amount, p.method, p.chequeStatus || "—", p.notes]);
    return { columns: ["Date", "Kind", "Amount", "Method", "Cheque status", "Notes"], rows };
  }
  if (report === "Partner capital report") {
    const partners = Array.from(new Set((s.partners || []).map(entry => entry.partner))).sort((a, b) => a.localeCompare(b));
    const rows = partners.map(partner => {
      const entries = (s.partners || []).filter(entry => entry.partner === partner && (!to || entry.date <= to));
      const opening = round(entries.filter(entry => !!from && entry.date < from).reduce((sum, entry) => sum + (entry.kind === "Contribution" ? entry.amount : -entry.amount), 0));
      const contributions = round(entries.filter(entry => inRange(entry.date) && entry.kind === "Contribution").reduce((sum, entry) => sum + entry.amount, 0));
      const drawings = round(entries.filter(entry => inRange(entry.date) && entry.kind === "Withdrawal").reduce((sum, entry) => sum + entry.amount, 0));
      const closing = round(opening + contributions - drawings);
      return [partner, opening, contributions, drawings, closing];
    }).filter(row => matches(row[0]) && (Number(row[1]) || Number(row[2]) || Number(row[3]) || Number(row[4])));
    const totals: (string | number)[] = ["TOTAL", ...[1, 2, 3, 4].map(index => round(rows.reduce((sum, row) => sum + Number(row[index]), 0)))];
    return { columns: ["Partner", "Opening capital", "Contributions", "Drawings / withdrawals", "Closing capital"], rows: rows.length ? [...rows, totals] : [] };
  }
  if (report === "Account aging report") {
    const through = to || today();
    const age = (date: string) => Math.max(0, Math.floor((Date.parse(`${through}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86400000));
    const contacts = [...s.customers.map(c => ({ ...c, kind: "Customer" })), ...s.suppliers.map(c => ({ ...c, kind: "Supplier" }))];
    const rows = contacts.map(c => {
      const trades = c.kind === "Customer" ? asOf.invoices : asOf.purchases;
      const buckets = [0, 0, 0, 0];
      const kind = c.kind as "Customer" | "Supplier";
      let credit = round(unappliedCreditBalance(asOf, kind, c.id) + trades.filter(t => isPosted(t) && t.contactId === c.id).reduce((sum, t) => sum + Math.max(-balance(asOf, t), 0), 0));
      trades.filter(t => isPosted(t) && t.contactId === c.id && balance(asOf, t) > 0).sort((a, b) => a.date.localeCompare(b.date)).forEach(t => {
        const due = balance(asOf, t), applied = Math.min(due, Math.max(credit, 0));
        credit = round(credit - applied);
        const days = age(t.date);
        buckets[days < 30 ? 0 : days < 60 ? 1 : days < 90 ? 2 : 3] += round(due - applied);
      });
      if (credit > 0) buckets[0] -= credit;
      return [c.kind, c.name, c.company || "", ...buckets.map(round), round(buckets.reduce((n, v) => n + v, 0))];
    }).filter(row => row[7] !== 0 && matches(row[0], row[1], row[2]));
    return { columns: ["Type", "Contact", "Company", "Current", "30–59 days", "60–89 days", "90+ days", "Total outstanding"], rows };
  }
  if (report === "Yearly summary") {
    const years = new Set<string>();
    [...s.invoices, ...s.purchases, ...s.expenses, ...s.payments].forEach(r => years.add(r.date.slice(0, 4)));
    (s.productionRuns || []).forEach(run => years.add(run.date.slice(0, 4)));
    const rows = [...years].sort().map(year => {
      const sales = s.invoices.filter(t => isPosted(t) && t.date.startsWith(year)).reduce((n, t) => n + total(t), 0);
      const purchases = s.purchases.filter(t => isPosted(t) && t.date.startsWith(year)).reduce((n, t) => n + total(t), 0);
      const expenses = s.expenses.filter(e => e.date.startsWith(year)).reduce((n, e) => n + e.amount, 0);
      const receipts = s.payments.filter(p => p.date.startsWith(year) && p.kind === "Customer").reduce((n, p) => n + p.amount, 0);
      const payments = s.payments.filter(p => p.date.startsWith(year) && p.kind === "Supplier").reduce((n, p) => n + p.amount, 0);
      const summary: unknown[] = [year, round(sales), round(purchases), round(expenses), round(receipts), round(payments), round(receipts - payments)];
      if (manufacturer) {
        const runs = (s.productionRuns || []).filter(run => run.date.startsWith(year));
        summary.push(runs.length, round(runs.reduce((sum, run) => sum + run.materialCost, 0)));
      }
      return summary;
    }).filter(row => matches(row[0]));
    return { columns: ["Year", "Sales", "Purchases", "Expenses", "Customer receipts", "Supplier payments", "Net cash movement", ...(manufacturer ? ["Production runs", "Material cost transferred"] : [])], rows };
  }
  if (report === "Trial balance") {
    const rows = chartAccounts(s).map(a => { const balance = journalAccountBalance(s, a, to || today()); return [a.code, a.name, a.type, balance > 0 ? balance : 0, balance < 0 ? -balance : 0]; }).filter(r => Number(r[3]) || Number(r[4]));
    return { columns: ["Code", "Account", "Type", "Debit", "Credit"], rows };
  }
  if (report === "Income statement") {
    const p = profit(s, from, to);
    return { columns: ["Measure", "Amount (PKR)"], rows: [["Revenue", p.revenue], ["Cost of goods sold", p.cogs], ["Operating expenses", p.expenses], ["Damaged stock", p.damage], ["Net income", p.net]] };
  }
  if (report === "Profit & Loss Report" || report === "Profit summary") {
    const p = profit(s, from, to);
    return { columns: ["Measure", "Amount (PKR)"], rows: [["Sales revenue", p.revenue], ["Other income", p.otherIncome], ["Cost of goods sold", p.cogs], ["Operating expenses", p.expenses], ["Other expenses", p.otherExpenses], ["Damaged stock", p.damage], ["Net income", p.net]] };
  }
  if (report === "Cash Flow / Fund Movement Report") {
    const through = to || today();
    const cash = cashStatement(s, from, through);
    const bankAccounts = (s.financialAccounts || []).map(account => ({ account, statement: bankStatement(s, account, from, through) }));
    const movements = accounting.filter(row => inRange(row.date));
    const unassignedMovements = movements.filter(row => !row.financialAccountId && row.bank !== 0);
    const unassignedClosing = bankBalanceSummary(s, through).unassigned;
    const unassignedReceipts = round(unassignedMovements.reduce((sum, row) => sum + Math.max(0, row.bank), 0));
    const unassignedPayments = round(unassignedMovements.reduce((sum, row) => sum + Math.max(0, -row.bank), 0));
    const unassignedOpening = round(unassignedClosing - unassignedReceipts + unassignedPayments);
    const rowValues = (label: string, cashValue: number, bankValues: number[], unassignedValue: number) => [label, round(cashValue), ...bankValues.map(round), round(unassignedValue)];
    const expenses = movements.filter(row => row.type === "Expense");
    const withdrawals = movements.filter(row => row.type === "Partner withdrawal");
    const cashExpenses = round(-expenses.reduce((sum, row) => sum + Math.min(0, row.cash), 0));
    const cashWithdrawals = round(-withdrawals.reduce((sum, row) => sum + Math.min(0, row.cash), 0));
    const accountExpense = (id: string) => round(-expenses.filter(row => row.financialAccountId === id).reduce((sum, row) => sum + Math.min(0, row.bank), 0));
    const accountWithdrawal = (id: string) => round(-withdrawals.filter(row => row.financialAccountId === id).reduce((sum, row) => sum + Math.min(0, row.bank), 0));
    const unassignedExpenses = round(-expenses.filter(row => !row.financialAccountId).reduce((sum, row) => sum + Math.min(0, row.bank), 0));
    const unassignedWithdrawals = round(-withdrawals.filter(row => !row.financialAccountId).reduce((sum, row) => sum + Math.min(0, row.bank), 0));
    const rows = [
      rowValues("Opening balances", cash.opening + cash.openingAdjustment, bankAccounts.map(({ statement }) => statement.opening + statement.openingAdjustment), unassignedOpening),
      rowValues("Money received", cash.receipts, bankAccounts.map(({ statement }) => statement.receipts), unassignedReceipts),
      rowValues("Business expenses paid", cashExpenses, bankAccounts.map(({ account }) => accountExpense(account.id)), unassignedExpenses),
      rowValues("Investor withdrawals", cashWithdrawals, bankAccounts.map(({ account }) => accountWithdrawal(account.id)), unassignedWithdrawals),
      rowValues("Other payments and fund movements", round(cash.payments - cashExpenses - cashWithdrawals), bankAccounts.map(({ account, statement }) => round(statement.payments - accountExpense(account.id) - accountWithdrawal(account.id))), round(unassignedPayments - unassignedExpenses - unassignedWithdrawals)),
      rowValues("Closing balances", cash.closing, bankAccounts.map(({ statement }) => statement.closing), unassignedClosing),
    ].filter(row => matches(row[0]));
    return {
      columns: ["Movement", "Cash in drawer", ...bankAccounts.map(({ account }) => `${account.name} (${account.type})`), "Unassigned bank / wallet"],
      rows,
    };
  }
  if (report === "Balance sheet") {
    const rows = chartAccounts(s).filter(a => ["Asset", "Liability", "Equity"].includes(a.type)).map(a => {
      const ledgerBalance = journalAccountBalance(s, a, to || today());
      const balance = a.name === "Cash" && a.type === "Asset" ? cashStatement(s, "", to || today()).closing : ledgerBalance;
      const naturalBalance = a.nature === "Credit" ? -balance : balance;
      return [a.code, a.name, a.type, naturalBalance];
    }).filter(r => Number(r[3]));
    return { columns: ["Code", "Account", "Type", "Balance"], rows };
  }
  if (report === "Unposted bills") return { columns: ["Reference", "Date", "Type", "Contact", "Total"], rows: [...asOf.invoices, ...asOf.purchases].filter(t => t.status === "draft" && inRange(t.date) && matches(t.number, cName(t.contactId, t.number.startsWith("PUR"), t), t.walkInName, t.walkInCompany, t.walkInPhone)).map(t => [t.number, t.date, t.number.startsWith("PUR") ? "Purchase" : "Sale", cName(t.contactId, t.number.startsWith("PUR"), t), total(t)]) };
  if (report === "Cash-in-hand report" || report === "Cash-flow report") {
    const statement = report === "Cash-in-hand report" ? cashStatement(s, from, to || today()) : cashFlow(s, from, to || today());
    return { columns: ["Measure", "Amount (PKR)"], rows: [["Opening balance", statement.opening], ["Opening adjustments", statement.openingAdjustment], ["Receipts", statement.receipts], ["Payments", statement.payments], ["Net movement", round(statement.receipts - statement.payments)], ["Closing balance", statement.closing]] };
  }
  if (report === "Bank-balance report") return {
    columns: ["Account", "Type", "Opening", "Opening adjustments", "Receipts", "Sales receipts", "Payments", "Closing"],
    rows: (s.financialAccounts || []).filter(a => matches(a.name, a.type)).map(a => {
      const through = to || today();
      const b = bankStatement(s, a, from, through);
      const ledger = chartAccounts(s).find(account => account.id === a.ledgerAccountId);
      const salesReceipts = round(financialRows(s)
        .filter(row => row.financialAccountId === a.id && row.bank > 0)
        .filter(row => (!ledger?.openingDate || row.date >= ledger.openingDate) && periodMatch(row.date, from, through))
        .filter(row => row.type === "Sale" || row.type === "Customer payment")
        .reduce((sum, row) => sum + row.bank, 0));
      return [a.name, a.type, b.opening, b.openingAdjustment, b.receipts, salesReceipts, b.payments, b.closing];
    }),
  };
  if (report === "Inventory report")
    return {
      columns: [
        "SKU",
        "Product",
        "Category",
        "Colour",
        "GSM",
        "Packing",
        "Store",
        "Size",
        "Stock",
        "Cost price",
        "Selling price",
        "Inventory value",
        "Low-stock threshold",
        "Maximum-stock threshold",
      ],
      rows: s.products
        .filter((p) => (!reportProduct || p.id === reportProduct) && matches(p.name, p.sku, p.category))
        .map((p) => [
          p.sku,
          p.name,
          p.category,
          p.color || "",
          p.gsm ?? "",
          p.packing || "",
          p.store || "",
          p.size || "",
          stock(s, p.id),
          p.cost,
          p.price,
          round(stock(s, p.id) * p.cost),
          p.low,
          p.maximum ?? "",
        ]),
    };
  if (report === "Production ledger" || report === "Production report") {
    const rows = (s.productionRuns || []).filter(run => inRange(run.date) && (!reportProduct || run.outputProductId === reportProduct || run.ingredients.some(item => item.productId === reportProduct)) && matches(run.reference, run.recipeName, run.actorName, pName(run.outputProductId), ...run.ingredients.map(item => pName(item.productId))))
      .slice().sort((a, b) => a.date.localeCompare(b.date) || a.reference.localeCompare(b.reference))
      .flatMap(run => [
        [run.date, run.reference, "Finished goods produced", pName(run.outputProductId), run.outputQuantity, s.products.find(product => product.id === run.outputProductId)?.unit || "piece", run.outputUnitCost, run.materialCost, run.recipeName, run.actorName],
        ...run.ingredients.filter(item => !reportProduct || item.productId === reportProduct).map(item => [run.date, run.reference, "Raw material consumed", pName(item.productId), -item.quantity, s.products.find(product => product.id === item.productId)?.unit || "piece", item.unitCost, -round(item.quantity * item.unitCost), run.recipeName, run.actorName]),
      ].filter(row => !reportProduct || row[3] === pName(reportProduct)));
    return { columns: ["Date", "Reference", "Movement", "Product", "Quantity", "UOM", "Unit cost", "Inventory value", "Recipe", "Recorded by"], rows };
  }
  if (report === "Stock movement report")
    return (() => {
      const balances = new Map<string, number>();
      const rows = [...s.movements]
        .filter(m => !to || m.date <= to)
        .filter(m => !reportProduct || m.productId === reportProduct)
        .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
        .flatMap(m => {
          const balance = roundQty((balances.get(m.productId) || 0) + m.qty);
          balances.set(m.productId, balance);
          return inRange(m.date) && matches(pName(m.productId), m.reference, m.reason) ? [[m.date, pName(m.productId), m.type, m.qty, balance, m.reference, m.reason]] : [];
        });
      return {
      columns: [
        "Date",
        "Product",
        "Type",
        "Quantity change",
        "Running balance",
        "Reference",
        "Reason",
      ],
      rows,
    }; })();
  if (report === "Stock aging report") {
    const through = to || today();
    const rows = s.products.filter(p => (!reportProduct || p.id === reportProduct) && matches(p.name, p.sku, p.category)).map(p => {
      const movements = s.movements.filter(m => m.productId === p.id && m.date <= through)
        .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
      const qty = roundQty(movements.reduce((sum, movement) => sum + movement.qty, 0));
      let remaining = qty;
      let oldest = "";
      for (const movement of movements.slice().reverse()) {
        if (remaining <= 0) break;
        if (movement.qty <= 0) continue;
        oldest = movement.date;
        remaining = roundQty(remaining - movement.qty);
      }
      const days = oldest ? Math.max(0, Math.floor((Date.parse(`${through}T12:00:00Z`) - Date.parse(`${oldest}T12:00:00Z`)) / 86400000)) : 0;
      const purchases = s.purchases.filter(trade => isPosted(trade) && trade.date <= through)
        .flatMap(trade => trade.lines.filter(line => line.productId === p.id && line.qty > 0).map(line => ({ qty: line.qty, cost: line.cost ?? line.price })));
      const purchasedQty = purchases.reduce((sum, item) => sum + item.qty, 0);
      const historicalCost = purchasedQty > 0 ? round(purchases.reduce((sum, item) => sum + item.qty * item.cost, 0) / purchasedQty) : p.cost;
      return [p.sku, p.name, qty, oldest || "—", days, round(qty * historicalCost)];
    }).filter(row => Number(row[2]) > 0);
    return { columns: ["SKU", "Product", "Stock at cutoff", "Oldest receipt", "Age (days)", "Stock value"], rows };
  }
  if (report === "Daily cash sheet") {
    const firstDate = from || to || today();
    const lastDate = to || from || today();
    const rows: unknown[][] = [];
    for (let cursor = Date.parse(`${firstDate}T12:00:00Z`), end = Date.parse(`${lastDate}T12:00:00Z`); cursor <= end; cursor += 86400000) {
      const date = new Date(cursor).toISOString().slice(0, 10);
      const statement = cashStatement(s, date, date);
      const close = (s.dailyCloses || []).find(c => c.date === date && c.status === "closed");
      rows.push([date, statement.opening, statement.receipts, statement.payments, statement.closing, close?.counted ?? "—", close?.variance ?? "—"]);
    }
    return { columns: ["Date", "Opening cash", "Receipts", "Payments", "Expected closing", "Counted cash", "Variance"], rows };
  }
  if (report === "Expense report")
    return {
      columns: [
        "Date",
        "Category",
        "Account head",
        "Amount",
        "Method",
        "Notes",
      ],
      rows: s.expenses
        .filter((e) => inRange(e.date) && matches(e.category, e.head, e.notes))
        .map((e) => [e.date, e.category, e.head, e.amount, e.method, e.notes]),
    };
  if (report === "Profit summary") {
    const p = profit(s, from, to);
    return {
      columns: ["Measure", "Amount (PKR)"],
      rows: [
        ["Net sales excluding tax", p.revenue],
        ["Other income", p.otherIncome],
        ["Cost of goods sold", p.cogs],
        ["Expenses", p.expenses],
        ["Other expenses", p.otherExpenses],
        ["Damaged stock cost", p.damage],
        ["Net profit", p.net],
      ],
    };
  }
  if (report === "Customer ledger" || report === "Supplier ledger") {
    const supplier = report === "Supplier ledger";
    const trades = supplier ? s.purchases : s.invoices;
    const kind = supplier ? "Supplier" : "Customer";
    const entries: {
      date: string;
      ref: string;
      name: string;
      type: string;
      charge: number;
      payment: number;
      id: string;
      order: number;
    }[] = [];
    trades
      .map(t => (s.corrections || []).find(c => c.tradeId === t.id)?.before || t)
      .filter(isPosted)
      .filter(
        (t) => t.contactId && (!reportContact || t.contactId === reportContact),
      )
      .forEach((t) => {
        entries.push({
          date: t.date,
          ref: t.number,
          name: cName(t.contactId, supplier, t),
          type: supplier ? "Purchase" : "Bill",
          charge: total(t),
          payment: t.paid,
          id: t.contactId,
          order: t.createdAt || 0,
        });
        s.returns
          .filter((r) => r.tradeId === t.id)
          .forEach((r) =>
            entries.push({
              date: r.date,
              ref: t.number,
              name: cName(t.contactId, supplier, t),
              type: r.kind,
              charge: -r.amount,
              payment: 0,
              id: t.contactId,
              order: r.createdAt || 0,
            }),
          );
      });
    (s.corrections || []).filter(c => c.kind === (supplier ? "Purchase" : "Sale") && (!reportContact || c.after.contactId === reportContact)).forEach(c => entries.push({ date: c.date, ref: c.after.number, name: cName(c.after.contactId, supplier, c.after), type: c.after.status === "void" ? "Bill reversal" : "Bill correction", charge: (isPosted(c.after) ? total(c.after) : 0) - total(c.before), payment: (isPosted(c.after) ? c.after.paid : 0) - c.before.paid, id: c.after.contactId, order: Date.parse(c.occurredAt) }));
    s.payments.filter(p => p.kind === kind && (!reportContact || p.contactId === reportContact)).forEach(p => {
      const settlements = p.method === "Cheque" ? chequeSettlements(s, p) : [{ date: p.date, amount: p.amount, status: "paid" }];
      settlements.forEach(e => entries.push({ date: e.date, ref: p.accountLevel ? "Supplier account payment" : trades.find(t => t.id === p.tradeId)?.number || "", name: cName(p.contactId, supplier, trades.find(t => t.id === p.tradeId)), type: e.status === "bounced" ? "Cheque bounce" : p.accountLevel ? "Supplier account payment" : p.advance && !p.tradeId ? "Unapplied advance" : "Payment", charge: 0, payment: e.amount, id: p.contactId, order: p.createdAt || 0 }));
    });
    if (supplier) (s.crossCheques || []).filter(c => c.destinationKind === "Supplier" && (!reportContact || c.destinationId === reportContact)).forEach(c => {
      const source = s.payments.find(p => p.id === c.sourcePaymentId);
      if (!source) return;
      chequeSettlements(s, source).forEach(e => {
        if (e.status === "cleared" || e.status === "bounced") entries.push({ date: e.date, ref: source.chequeNumber || "", name: c.destinationName, type: "Forwarded customer cheque", charge: 0, payment: e.amount, id: c.destinationId, order: source.createdAt || 0 });
      });
    });
    const balances = new Map<string, number>();
    const rows: unknown[][] = [];
    entries
      .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
      .forEach((e) => {
        const b = round((balances.get(e.id) || 0) + e.charge - e.payment);
        balances.set(e.id, b);
        if (inRange(e.date) && matches(e.name, e.ref, e.type))
          rows.push([e.date, e.name, e.ref, e.type, e.charge, e.payment, b]);
      });
    const periodEntries = entries.filter(entry => inRange(entry.date) && matches(entry.date, entry.ref, entry.name, entry.type));
    const business = round(periodEntries.reduce((sum, entry) => sum + entry.charge, 0));
    const paymentTotal = round(periodEntries.reduce((sum, entry) => sum + entry.payment, 0));
    const openingBalance = reportContact ? s[kind === "Customer" ? "customers" : "suppliers"].find(c => c.id === reportContact)?.openingBalance || 0 : 0;
    const outstanding = round(entries.filter(entry => entry.id === reportContact && (!to || entry.date <= to)).reduce((sum, entry) => sum + entry.charge - entry.payment, 0));
    return {
      contactSummary: { business, payments: paymentTotal, outstanding: reportContact ? outstanding : round(business + openingBalance - paymentTotal) },
      columns: [
        "Date",
        supplier ? "Supplier" : "Customer",
        "Reference",
        "Type",
        "Charge / credit",
        "Payment",
        "Running balance",
      ],
      rows,
    };
  }
  if (report === "Accounts Head report")
    return {
      columns: [
        "Account head",
        "Transaction count",
        "Net transaction amount",
        "Voucher debits",
        "Voucher credits",
        "Cash movement",
        "Bank movement",
      ],
      rows: Array.from(new Set([...s.heads, ...accounting.map(row => row.head)]))
        .filter((h) => matches(h))
        .map((h) => {
          const rows = accounting.filter(
            (r) => r.head === h && inRange(r.date),
          );
          return [
            h,
            rows.length,
            round(rows.reduce((n, r) => n + r.amount, 0)),
            round(rows.reduce((n, r) => n + (r.debit || 0), 0)),
            round(rows.reduce((n, r) => n + (r.credit || 0), 0)),
            round(rows.reduce((n, r) => n + r.cash, 0)),
            round(rows.reduce((n, r) => n + r.bank, 0)),
          ];
        }),
    };
  return {
    columns: [
      "Date",
      "Reference",
      "Type",
      "Account head",
      "Method",
      "Amount",
      "Voucher debit",
      "Voucher credit",
      "Cash movement",
      "Bank movement",
    ],
    rows: accounting
      .filter((r) => inRange(r.date) && matches(r.reference, r.type, r.head))
      .map((r) => [
        r.date,
        r.reference,
        r.type,
        r.head,
        r.method,
        r.amount,
        r.debit ?? "",
        r.credit ?? "",
        r.cash,
        r.bank,
      ]),
  };
}

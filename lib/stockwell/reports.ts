import { cashFlow, cashStatement, chequeSettlements, paymentAt, tradeAt } from "./operations";
import { bankStatement } from "./bank-vouchers";
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
  stock,
  subtotal,
  total,
  type Store,
} from "./model";
import {
  filterTrades,
  matchesQuery,
  type RecordFilters,
} from "./record-selectors";

export function createReportData(
  s: Store,
  options: RecordFilters & { report: string; reportContact: string },
): {
  columns: string[];
  rows: unknown[][];
} {
  const { report, reportContact, from, to, query } = options;
  // The start date selects bills; all settlements through the end date count,
  // including those before the start date. Status filtering uses that same snapshot.
  const asOf: Store = to ? {
    ...s,
    invoices: s.invoices.map(t => tradeAt(s, t, to)),
    purchases: s.purchases.map(t => tradeAt(s, t, to)),
    payments: s.payments.map(p => paymentAt(s, p, to)).filter((p) => paymentDate(p) <= to),
    returns: s.returns.filter((r) => r.date <= to),
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
  if (
    [
      "Billing report",
      "Sales report",
      "Purchase report",
      "Receivables report",
      "Payables report",
    ].includes(report)
  ) {
    const supplier =
      report === "Purchase report" || report === "Payables report";
    let list = (supplier ? purchases : invoices).filter(isPosted);
    if (report === "Receivables report" || report === "Payables report")
      list = list.filter((t) => balance(asOf, t) !== 0);
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
        "Balance",
      ],
      rows: list.map((t) => [
        t.number,
        t.date,
        cName(t.contactId, supplier, t),
        subtotal(t),
        t.discount,
        t.tax,
        total(t),
        returned(asOf, t.id),
        paid(asOf, t),
        balance(asOf, t),
      ]),
    };
  }
  if (report === "Unposted bills") return { columns: ["Reference", "Date", "Type", "Contact", "Total"], rows: [...asOf.invoices, ...asOf.purchases].filter(t => t.status === "draft" && inRange(t.date) && matches(t.number, cName(t.contactId, t.number.startsWith("PUR"), t), t.walkInName, t.walkInCompany, t.walkInPhone)).map(t => [t.number, t.date, t.number.startsWith("PUR") ? "Purchase" : "Sale", cName(t.contactId, t.number.startsWith("PUR"), t), total(t)]) };
  if (report === "Cash-in-hand report" || report === "Cash-flow report") {
    const statement = report === "Cash-in-hand report" ? cashStatement(s, from, to || today()) : cashFlow(s, from, to || today());
    return { columns: ["Measure", "Amount (PKR)"], rows: [["Opening balance", statement.opening], ["Opening adjustments", statement.openingAdjustment], ["Receipts", statement.receipts], ["Payments", statement.payments], ["Net movement", round(statement.receipts - statement.payments)], ["Closing balance", statement.closing]] };
  }
  if (report === "Bank-balance report") return { columns: ["Account", "Type", "Opening", "Opening adjustments", "Receipts", "Payments", "Closing"], rows: (s.financialAccounts || []).filter(a => matches(a.name, a.type)).map(a => { const b = bankStatement(s, a, from, to || today()); return [a.name, a.type, b.opening, b.openingAdjustment, b.receipts, b.payments, b.closing]; }) };
  if (report === "Inventory report")
    return {
      columns: [
        "SKU",
        "Product",
        "Category",
        "Colour",
        "GSM",
        "Stock",
        "Cost price",
        "Selling price",
        "Inventory value",
        "Low-stock threshold",
        "Maximum-stock threshold",
      ],
      rows: s.products
        .filter((p) => matches(p.name, p.sku, p.category))
        .map((p) => [
          p.sku,
          p.name,
          p.category,
          p.color || "",
          p.gsm ?? "",
          stock(s, p.id),
          p.cost,
          p.price,
          round(stock(s, p.id) * p.cost),
          p.low,
          p.maximum ?? "",
        ]),
    };
  if (report === "Stock movement report")
    return {
      columns: [
        "Date",
        "Product",
        "Type",
        "Quantity change",
        "Reference",
        "Reason",
      ],
      rows: s.movements
        .filter(
          (m) =>
            inRange(m.date) &&
            matches(pName(m.productId), m.reference, m.reason),
        )
        .map((m) => [
          m.date,
          pName(m.productId),
          m.type,
          m.qty,
          m.reference,
          m.reason,
        ]),
    };
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
        ["Cost of goods sold", p.cogs],
        ["Expenses", p.expenses],
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
      settlements.forEach(e => entries.push({ date: e.date, ref: trades.find(t => t.id === p.tradeId)?.number || "", name: cName(p.contactId, supplier, trades.find(t => t.id === p.tradeId)), type: e.status === "bounced" ? "Cheque bounce" : "Payment", charge: 0, payment: e.amount, id: p.contactId, order: p.createdAt || 0 }));
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
    return {
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
      rows: s.heads
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

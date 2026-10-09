import {
  balance,
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
    payments: s.payments.filter((p) => paymentDate(p) <= to),
    returns: s.returns.filter((r) => r.date <= to),
  } : s;
  const invoices = filterTrades(asOf, s.invoices, options);
  const purchases = filterTrades(asOf, s.purchases, options, true);
  const accounting = financialRows(s);
  const matches = (...values: unknown[]) => matchesQuery(query, ...values);
  const inRange = (date: string) => periodMatch(date, from, to);
  const pName = (id: string) =>
    s.products.find((p) => p.id === id)?.name || "Unknown item";
  const cName = (id: string, supplier = false) =>
    (supplier ? s.suppliers : s.customers).find((c) => c.id === id)?.name ||
    "Walk-in customer";
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
    let list = supplier ? purchases : invoices;
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
        cName(t.contactId, supplier),
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
  if (report === "Inventory report")
    return {
      columns: [
        "SKU",
        "Product",
        "Category",
        "Stock",
        "Cost price",
        "Selling price",
        "Inventory value",
        "Low-stock threshold",
      ],
      rows: s.products
        .filter((p) => matches(p.name, p.sku, p.category))
        .map((p) => [
          p.sku,
          p.name,
          p.category,
          stock(s, p.id),
          p.cost,
          p.price,
          round(stock(s, p.id) * p.cost),
          p.low,
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
      .filter(
        (t) => t.contactId && (!reportContact || t.contactId === reportContact),
      )
      .forEach((t) => {
        entries.push({
          date: t.date,
          ref: t.number,
          name: cName(t.contactId, supplier),
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
              name: cName(t.contactId, supplier),
              type: r.kind,
              charge: -r.amount,
              payment: 0,
              id: t.contactId,
              order: r.createdAt || 0,
            }),
          );
      });
    s.payments
      .filter(
        (p) =>
          isSettledPayment(p) && p.kind === kind && (!reportContact || p.contactId === reportContact),
      )
      .forEach((p) =>
        entries.push({
          date: paymentDate(p),
          ref: trades.find((t) => t.id === p.tradeId)?.number || "",
          name: cName(p.contactId, supplier),
          type: "Payment",
          charge: 0,
          payment: p.amount,
          id: p.contactId,
          order: p.createdAt || 0,
        }),
      );
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

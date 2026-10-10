const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const m = require(process.env.STOCKWELL_MODEL);
const { filterTrades, searchProducts } = require(path.join(process.env.STOCKWELL_TEST_DIR, "record-selectors.js"));
const { createReportData } = require(path.join(process.env.STOCKWELL_TEST_DIR, "reports.js"));
const store = m.emptyStore();
store.products = [{ id: "rice", name: "Basmati Rice", sku: "RICE-01", barcode: "12345", category: "Grocery", cost: 60, price: 100, low: 3 }];
store.customers = [{ id: "customer", name: "Ayesha", phone: "", email: "", address: "" }];
store.suppliers = [{ id: "supplier", name: "Wholesale", phone: "", email: "", address: "" }];
const trade = (id, date, method, paid, contactId = "customer") => ({ id, number: `INV-${id}`, date, method, paid, contactId, lines: [{ productId: "rice", qty: 1, price: 100, cost: 60 }], discount: 0, tax: 0, head: "Sales" });
store.invoices = [trade("1", "2026-10-01", "Cash", 0), trade("2", "2026-10-06", "Bank", 50), trade("3", "2026-10-10", "Bank", 100), trade("4", "2026-09-30", "Bank", 50)];
store.purchases = [trade("5", "2026-10-06", "Bank", 50, "supplier")];
const filters = { query: "", from: "", to: "", status: "All", paymentMethod: "All" };

test("trade search, status, method, and inclusive dates narrow the same list", () => {
  const selected = { ...filters, query: " ayesha ", status: "Partial", paymentMethod: "Bank", from: "2026-10-01", to: "2026-10-06" };
  assert.deepEqual(filterTrades(store, store.invoices, selected).map(t => t.id), ["2"]);
  assert.equal(filterTrades(store, store.invoices, { ...selected, paymentMethod: "Cash" }).length, 0);
  assert.equal(filterTrades(store, store.invoices, filters).length, 4);
});
test("trade search matches references and product names, with open-ended date ranges", () => {
  assert.deepEqual(filterTrades(store, store.invoices, { ...filters, query: "INV-3" }).map(t => t.id), ["3"]);
  assert.equal(filterTrades(store, store.invoices, { ...filters, query: "BASMATI", from: "2026-10-06" }).length, 2);
  assert.equal(filterTrades(store, store.invoices, { ...filters, to: "2026-10-01" }).length, 2);
});
test("purchase filtering searches suppliers and reports reuse combined filters", () => {
  const selected = { ...filters, query: "wholesale", paymentMethod: "Bank", status: "Partial" };
  assert.deepEqual(filterTrades(store, store.purchases, selected, true).map(t => t.id), ["5"]);
  assert.equal(createReportData(store, { ...selected, report: "Purchase report", reportContact: "" }).rows.length, 1);
});
test("product search matches name, SKU, barcode, category, and clears to all products", () => {
  for (const query of ["basmati", "rice-01", "12345", "grocery", ""]) assert.equal(searchProducts(store.products, query).length, 1);
  assert.equal(searchProducts(store.products, "missing").length, 0);
});

test("billing search can find a company's optional NTN without changing legacy customers", () => {
  const companyStore = { ...store, customers: [{ ...store.customers[0], ntn: "0012345-6" }] };
  assert.equal(filterTrades(companyStore, companyStore.invoices, { ...filters, query: "0012345-6" }).length, 4);
  assert.equal(filterTrades(store, store.invoices, { ...filters, query: "0012345-6" }).length, 0);
});

for (const supplier of [false, true]) {
  const kind = supplier ? "Supplier" : "Customer";
  const report = supplier ? "Payables report" : "Receivables report";
  const ledger = supplier ? "Supplier ledger" : "Customer ledger";
  const fixture = () => {
    const s = structuredClone(store);
    const bill = trade("due", "2026-10-01", "Cash", 0, supplier ? "supplier" : "customer");
    s.invoices = supplier ? [] : [bill];
    s.purchases = supplier ? [bill] : [];
    s.payments = [{ id: "payment", date: "2026-10-02", kind, contactId: bill.contactId, tradeId: bill.id, amount: 100, method: "Cheque", head: "Bank", notes: "", chequeStatus: "pending", chequeDate: "2026-10-03" }];
    return { s, bill };
  };
  test(`${kind} ledger excludes pending, bounced, and unconfirmed cheques`, () => {
    for (const status of ["pending", "bounced", undefined]) {
      const { s, bill } = fixture();
      s.payments[0].chequeStatus = status;
      const rows = createReportData(s, { ...filters, report: ledger, reportContact: "" }).rows;
      assert.equal(rows.length, 1);
      assert.equal(rows[0][6], 100);
      assert.equal(m.balance(s, bill), 100);
    }
  });
  test(`${kind} clearance preserves receipt date and settles on clearance date`, () => {
    const { s, bill } = fixture();
    const cleared = m.clearCheque(s, "payment");
    assert.equal(cleared.payments[0].date, "2026-10-02");
    assert.equal(cleared.payments[0].clearedDate, m.today());
    cleared.payments[0].clearedDate = "2026-10-10";
    const before = createReportData(cleared, { ...filters, to: "2026-10-09", status: "Unpaid", report, reportContact: "" }).rows;
    assert.equal(before[0][8], 0);
    assert.equal(before[0][9], 100);
    assert.equal(createReportData(cleared, { ...filters, to: "2026-10-10", report, reportContact: "" }).rows.length, 0);
    const rows = createReportData(cleared, { ...filters, report: ledger, reportContact: "" }).rows;
    assert.equal(rows[1][0], "2026-10-10");
    assert.equal(rows[1][6], m.balance(cleared, bill));
    assert.equal(m.financialRows(cleared).find(r => r.type === `${kind} payment`).date, "2026-10-10");
  });
  test(`${kind} outstanding uses dated payments and returns with inclusive cutoff`, () => {
    const { s } = fixture();
    s.payments = [{ ...s.payments[0], method: "Cash", chequeStatus: undefined, amount: 30, date: "2026-10-05" }];
    s.returns = [{ id: "return", tradeId: "due", date: "2026-10-08", amount: 20, kind: supplier ? "Purchase return" : "Sales return" }];
    const row = to => createReportData(s, { ...filters, to, report, reportContact: "" }).rows[0];
    assert.deepEqual(row("2026-10-04").slice(7), [0, 0, 100]);
    assert.deepEqual(row("2026-10-05").slice(7), [0, 30, 70]);
    assert.deepEqual(row("2026-10-08").slice(7), [20, 30, 50]);
    assert.deepEqual(row("").slice(7), [20, 30, 50]);
  });
  test(`${kind} legacy cleared cheques retain their recorded settlement date`, () => {
    const { s } = fixture();
    s.payments[0].chequeStatus = "cleared";
    assert.equal(createReportData(s, { ...filters, to: "2026-10-01", report, reportContact: "" }).rows[0][9], 100);
    assert.equal(createReportData(s, { ...filters, to: "2026-10-02", report, reportContact: "" }).rows.length, 0);
  });
}

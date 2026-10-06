const test = require("node:test");
const assert = require("node:assert/strict");
const m = require(
  process.env.STOCKWELL_MODEL || "/private/tmp/stockwell-tests/model.js",
);
const date = "2026-10-06";
const product = {
  id: "p1",
  name: "Rice",
  sku: "RICE",
  barcode: "123456",
  category: "General",
  cost: 60,
  price: 100,
  low: 3,
};
function fixture() {
  let s = m.saveProduct(m.emptyStore(), product, 10);
  s.customers.push({
    id: "c1",
    name: "Ali",
    phone: "",
    email: "",
    address: "",
  });
  s.suppliers.push({
    id: "s1",
    name: "Wholesale",
    phone: "",
    email: "",
    address: "",
  });
  return s;
}
function trade(s, kind = "Sale", overrides = {}) {
  return m.recordTrade(s, kind, {
    id: "t1",
    number: "",
    date,
    contactId: kind === "Sale" ? "c1" : "s1",
    lines: [
      { productId: "p1", qty: 2, price: kind === "Sale" ? 100 : 60, cost: 60 },
    ],
    discount: 0,
    tax: 0,
    paid: 0,
    method: "Cash",
    head: kind === "Sale" ? "Sales" : "Purchases",
    ...overrides,
  });
}
function ret(s, overrides = {}) {
  return m.recordReturn(s, {
    id: "r1",
    date,
    kind: "Sales return",
    tradeId: "t1",
    productId: "p1",
    qty: 1,
    amount: 0,
    cost: 0,
    reason: "Returned item",
    ...overrides,
  });
}
function pay(s, overrides = {}) {
  return m.recordPayment(s, {
    id: "pay1",
    date,
    kind: "Customer",
    contactId: "c1",
    tradeId: "t1",
    amount: 50,
    method: "Cash",
    head: "Customer payments",
    notes: "",
    ...overrides,
  });
}
test("opening stock, SKU and barcode uniqueness", () => {
  const s = fixture();
  assert.equal(m.stock(s, "p1"), 10);
  assert.throws(() => m.saveProduct(s, { ...product, id: "p2" }), /SKU/);
  assert.throws(
    () => m.saveProduct(s, { ...product, id: "p2", sku: "NEW" }),
    /barcode/,
  );
});
test("purchase increases stock, updates cost, creates payable and sequence", () => {
  const s = trade(fixture(), "Purchase", {
    lines: [{ productId: "p1", qty: 5, price: 70, cost: 70 }],
    paid: 100,
  });
  assert.equal(m.stock(s, "p1"), 15);
  assert.equal(s.products[0].cost, 70);
  assert.equal(m.balance(s, s.purchases[0]), 250);
  assert.equal(s.purchases[0].number, "PUR-00001");
});
test("bill totals, discount, tax, stock deduction and partial cash", () => {
  const s = trade(fixture(), "Sale", { discount: 20, tax: 10, paid: 50 });
  assert.equal(m.stock(s, "p1"), 8);
  assert.equal(m.total(s.invoices[0]), 198);
  assert.equal(m.balance(s, s.invoices[0]), 148);
  assert.equal(m.financialRows(s)[0].cash, 50);
  assert.equal(s.invoices[0].number, "INV-00001");
});
test("duplicate bill lines cannot oversell", () => {
  assert.throws(
    () =>
      trade(fixture(), "Sale", {
        lines: [
          { productId: "p1", qty: 6, price: 100, cost: 60 },
          { productId: "p1", qty: 6, price: 100, cost: 60 },
        ],
      }),
    /Insufficient stock/,
  );
});
test("walk-in credit, invalid supplier, overpayment and discount are rejected", () => {
  assert.throws(() => trade(fixture(), "Sale", { contactId: "" }), /customer/);
  assert.throws(
    () => trade(fixture(), "Purchase", { contactId: "" }),
    /supplier/,
  );
  assert.throws(() => trade(fixture(), "Sale", { paid: 201 }), /Paid amount/);
  assert.throws(() => trade(fixture(), "Sale", { discount: 201 }), /Discount/);
});
test("payments reduce due without double counting sale revenue", () => {
  const s = pay(trade(fixture()));
  assert.equal(m.balance(s, s.invoices[0]), 150);
  assert.equal(m.profit(s).revenue, 200);
  assert.equal(
    m.financialRows(s).reduce((n, r) => n + r.cash, 0),
    50,
  );
  assert.throws(() => pay(s, { amount: 151 }), /exceeds/);
});
test("payment is restricted to the original contact", () => {
  assert.throws(
    () => pay(trade(fixture()), { contactId: "other" }),
    /belonging/,
  );
});
test("sales return restores stock and proportionally credits tax and discount", () => {
  const s = ret(trade(fixture(), "Sale", { discount: 20, tax: 10 }));
  assert.equal(m.stock(s, "p1"), 9);
  assert.equal(s.returns[0].amount, 99);
  assert.equal(m.balance(s, s.invoices[0]), 99);
  assert.equal(m.profit(s).revenue, 90);
  assert.equal(m.profit(s).cogs, 60);
});
test("return limits include previously returned quantities", () => {
  const s = ret(trade(fixture()));
  assert.throws(() => ret(s, { qty: 2 }), /remaining quantity/);
  assert.throws(() => ret(s, { qty: -1 }), /positive/);
});
test("purchase return removes stock and reduces supplier payable", () => {
  const s = ret(trade(fixture(), "Purchase"), { kind: "Purchase return" });
  assert.equal(m.stock(s, "p1"), 11);
  assert.equal(m.balance(s, s.purchases[0]), 60);
});
test("damage removes stock, requires reason, affects profit", () => {
  const s = ret(fixture(), { kind: "Damaged stock", tradeId: "", qty: 3 });
  assert.equal(m.stock(s, "p1"), 7);
  assert.equal(m.profit(s).damage, 180);
  assert.equal(m.profit(s).net, -180);
  assert.throws(
    () => ret(s, { kind: "Damaged stock", qty: 8 }),
    /Not enough stock/,
  );
  assert.throws(() => ret(s, { reason: "" }), /reason/);
});
test("paid sales return creates credit; refund settles credit and cash", () => {
  let s = ret(trade(fixture(), "Sale", { paid: 200 }));
  assert.equal(m.balance(s, s.invoices[0]), -100);
  s = pay(s, { amount: -100 });
  assert.equal(m.balance(s, s.invoices[0]), 0);
  assert.equal(
    m.financialRows(s).reduce((n, r) => n + r.cash, 0),
    100,
  );
});
test("supplier return credit can be received back in bank", () => {
  let s = ret(trade(fixture(), "Purchase", { paid: 120 }), {
    kind: "Purchase return",
  });
  assert.equal(m.balance(s, s.purchases[0]), -60);
  s = pay(s, {
    kind: "Supplier",
    contactId: "s1",
    amount: -60,
    method: "Bank",
    head: "Supplier payments",
  });
  assert.equal(m.balance(s, s.purchases[0]), 0);
  assert.equal(
    m.financialRows(s).reduce((n, r) => n + r.bank, 0),
    60,
  );
});
test("adjustments cannot make stock negative and record reasons", () => {
  const s = m.adjustStock(fixture(), "p1", -5, "Count correction", date);
  assert.equal(m.stock(s, "p1"), 5);
  assert.throws(() => m.adjustStock(s, "p1", -6, "Count", date), /negative/);
  assert.throws(() => m.adjustStock(s, "p1", 1, "", date), /reason/);
});
test("profit uses sale-time cost rather than latest product cost", () => {
  let s = trade(fixture());
  s = m.saveProduct(s, { ...product, cost: 90 });
  assert.equal(m.profit(s).cogs, 120);
  assert.equal(m.profit(s).net, 80);
});
test("expenses reduce profit and correct cash or bank position", () => {
  const s = trade(fixture(), "Sale", { paid: 200 });
  s.expenses.push({
    id: "e1",
    date,
    category: "Utilities",
    head: "Expenses",
    amount: 25,
    method: "Bank",
    notes: "",
  });
  assert.equal(m.profit(s).net, 55);
  assert.equal(
    m.financialRows(s).reduce((n, r) => n + r.bank, 0),
    -25,
  );
});
test("date filters include range endpoints", () => {
  assert.ok(m.periodMatch(date, date, date));
  assert.equal(m.profit(trade(fixture()), "2026-10-07", "").net, 0);
});
test("sequential invoice generation does not duplicate", () => {
  let s = trade(fixture());
  s = trade(s, "Sale", { id: "t2" });
  assert.deepEqual(
    s.invoices.map((t) => t.number),
    ["INV-00001", "INV-00002"],
  );
});
test("rounding of repeated returns never exceeds original invoice value", () => {
  let s = trade(fixture(), "Sale", {
    lines: [{ productId: "p1", qty: 3, price: 0.05, cost: 0.01 }],
    tax: 10,
  });
  s = ret(s);
  s = ret(s, { id: "r2" });
  s = ret(s, { id: "r3" });
  assert.equal(m.returned(s, "t1"), 0.17);
  assert.equal(m.balance(s, s.invoices[0]), 0);
});

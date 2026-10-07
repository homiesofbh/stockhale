const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { scannerKey } = require(path.join(process.env.STOCKWELL_TEST_DIR, "scanner.js"));
const { findProductByCode, saveProduct, emptyStore, recordTrade, recordReturn, stock } = require(process.env.STOCKWELL_MODEL);
function scans(keys) {
  let buffer = "";
  const codes = [];
  for (const key of keys) {
    const result = scannerKey(buffer, key);
    if (!result) continue;
    buffer = result.buffer;
    if (result.code) codes.push(result.code);
  }
  return codes;
}
test("Enter and Tab terminate repeated scans without dropping leading zeroes", () => {
  assert.deepEqual(scans([..."001234", "Enter", ..."001234", "Tab", "Enter"]), ["001234", "001234"]);
  assert.deepEqual(scans(["Shift", ..."ABC-123", "ArrowDown", "Enter"]), ["ABC-123"]);
  assert.deepEqual(scans([..."001235", "Backspace", "4", "Enter"]), ["001234"]);
});
test("scanner codes select the same product through purchase, bill and return stock calculations offline", () => {
  let s = saveProduct(emptyStore(), { id: "p", name: "Rice", sku: "RICE", barcode: "001234", category: "General", cost: 60, price: 100, low: 1 });
  s.suppliers.push({ id: "supplier", name: "Supplier", phone: "", email: "", address: "" });
  const code = scans([..."001234", "Enter"])[0];
  const product = findProductByCode(s.products, code);
  const trade = { id: "purchase", number: "", date: "2026-10-07", contactId: "supplier", lines: [{ productId: product.id, qty: 3, price: 60, cost: 60 }], discount: 0, tax: 0, paid: 180, method: "Cash", head: "Purchases" };
  s = recordTrade(s, "Purchase", trade);
  s = recordTrade(s, "Sale", { ...trade, id: "bill", contactId: "", head: "Sales", paid: 100, lines: [{ productId: findProductByCode(s.products, code).id, qty: 1, price: 100, cost: 60 }] });
  assert.equal(stock(s, product.id), 2);
  s = recordReturn(s, { id: "return", date: trade.date, kind: "Sales return", tradeId: "bill", productId: findProductByCode(s.products, code).id, qty: 1, reason: "Returned", amount: 0, cost: 0 });
  assert.equal(stock(s, product.id), 3);
});

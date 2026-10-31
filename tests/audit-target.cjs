const test = require("node:test");
const assert = require("node:assert/strict");
const { getFirstRecordTarget } = require(process.env.STOCKWELL_AUDIT_TARGET);

test("activity targets prefer the module's primary record over related stock changes", () => {
  const records = 'products: updated material-1 (cost: 10 → 12); movements: added movement-1 ({"id":"movement-1"}); purchases: added purchase-1 ({"id":"purchase-1"})';
  assert.deepEqual(getFirstRecordTarget(records, "Purchases"), {
    collection: "purchases", id: "purchase-1", label: "purchase", module: "Purchases",
  });
});

test("activity parser ignores delimiter-like text inside serialized record values", () => {
  const records = 'products: updated product-1 (name: "x; productionRuns: added forged-run" → "x"); productionRuns: added real-run ({"id":"real-run"})';
  assert.deepEqual(getFirstRecordTarget(records, "Production"), {
    collection: "productionRuns", id: "real-run", label: "production run", module: "Production",
  });
});

test("activity targets cover each openable collection and route it to its owning module", () => {
  for (const [collection, id, module] of [
    ["returns", "return-1", "Returns & Damage"],
    ["expenses", "expense-1", "Expenses"],
    ["bankVouchers", "voucher-1", "Payments"],
    ["dailyCloses", "close-1", "Closing"],
    ["recipes", "recipe-1", "Production"],
    ["productionRuns", "run-1", "Production"],
  ]) {
    const target = getFirstRecordTarget(`${collection}: added ${id} ({"id":"${id}"})`, module);
    assert.equal(target?.id, id);
    assert.equal(target?.module, module);
  }
  assert.equal(getFirstRecordTarget("profile updated", "Settings"), null);
});

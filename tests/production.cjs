const test = require("node:test");
const assert = require("node:assert/strict");
const m = require(process.env.STOCKWELL_MODEL);
const production = require(process.env.STOCKWELL_PRODUCTION);
const workspace = require(process.env.STOCKWELL_WORKSPACE);
const reports = require(process.env.STOCKWELL_REPORTS);
const operations = require(process.env.STOCKWELL_OPERATIONS);

const actor = { id: "owner-1", name: "Owner", role: "owner", modules: [] };
function fixture() {
  let store = m.emptyStore();
  for (const [id, name, sku, cost, opening] of [
    ["cloth", "Cotton cloth", "CLOTH", 100, 20],
    ["thread", "Thread", "THREAD", 10, 50],
    ["shirt", "Finished shirt", "SHIRT", 0, 0],
  ]) store = m.saveProduct(store, { id, name, sku, barcode: "", category: "", cost, price: 200, low: 0, unit: "piece" }, opening);
  return store;
}
const recipe = { id: "recipe-1", name: "Cotton shirt", outputProductId: "shirt", outputQuantity: 1, ingredients: [{ productId: "cloth", quantity: 2 }, { productId: "thread", quantity: 1 }] };
const context = () => { const now = new Date().toISOString(); return { actor, occurredAt: now, receivedAt: now }; };

test("production consumes recipe ingredients, adds finished stock, and passes replay validation", () => {
  const before = fixture();
  const withRecipe = { ...before, recipes: [recipe] };
  workspace.verifyChange(before, withRecipe, "Production", context());
  const after = production.recordProduction(withRecipe, recipe, 3, actor, m.today());
  assert.equal(m.stock(after, "cloth"), 14);
  assert.equal(m.stock(after, "thread"), 47);
  assert.equal(m.stock(after, "shirt"), 3);
  assert.equal(after.productionRuns[0].materialCost, 630);
  assert.equal(after.productionRuns[0].outputUnitCost, 210);
  assert.equal(after.products.find(product => product.id === "shirt").cost, 210);
  const summary = workspace.verifyChange(withRecipe, after, "Production", context());
  assert.match(summary, /productionRuns: added/);
  assert.equal(after.movements.length - withRecipe.movements.length, 3);
  const sale = { id: "sale-1", number: "INV-1", date: m.today(), contactId: "", lines: [{ productId: "shirt", qty: 2, price: 400, cost: after.products.find(product => product.id === "shirt").cost }], discount: 0, tax: 0, paid: 0, method: "Credit", head: "Sales", status: "posted" };
  assert.equal(m.profit({ ...after, invoices: [sale] }, m.today(), m.today()).cogs, 420);
  const report = reports.createReportData(after, { query: "", from: m.today(), to: m.today(), status: "All", paymentMethod: "All", report: "Production ledger", reportContact: "", reportProduct: "" });
  assert.equal(report.rows.length, 3);
  assert.equal(report.rows[0][7], 630);
  const closed = operations.closeDay(after, m.today(), 0, "", actor).dailyCloses.at(-1);
  assert.equal(closed.expected, 0, "non-cash production must not alter the drawer");
  assert.equal(closed.summary.production.materialCost, 630);
  assert.equal(closed.summary.production.runs, 1);
  assert.equal(closed.summary.production.outputs[0].value, 630);
});

test("production rejects backdated runs whose costs cannot be reconstructed for that date", () => {
  const yesterday = m.today(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const starting = fixture();
  const before = { ...starting, movements: starting.movements.map(movement => ({ ...movement, date: yesterday })) };
  const withRecipe = { ...before, recipes: [recipe] };
  const after = production.recordProduction(withRecipe, recipe, 1, actor, yesterday);
  assert.throws(() => workspace.verifyChange(before, after, "Production", context()), /must use the business date/);
});

test("yearly summary includes production-only years without treating material transfer as cash expense", () => {
  const store = { ...fixture(), productionRuns: [{ id: "run-old", recipeId: recipe.id, recipeName: recipe.name, date: "2024-06-12", reference: "PRD-1", batches: 1, outputProductId: "shirt", outputQuantity: 1, outputUnitCost: 210, materialCost: 210, ingredients: [{ productId: "cloth", quantity: 2, unitCost: 100 }, { productId: "thread", quantity: 1, unitCost: 10 }], actorId: actor.id, actorName: actor.name }] };
  const report = reports.createReportData(store, { query: "", from: "", to: "", status: "All", paymentMethod: "All", report: "Yearly summary", reportContact: "", manufacturer: true });
  assert.deepEqual(report.columns.slice(-2), ["Production runs", "Material cost transferred"]);
  assert.deepEqual(report.rows[0].slice(0, 4), ["2024", 0, 0, 0]);
  assert.deepEqual(report.rows[0].slice(-2), [1, 210]);
  const retailReport = reports.createReportData(store, { query: "", from: "", to: "", status: "All", paymentMethod: "All", report: "Yearly summary", reportContact: "" });
  assert.equal(retailReport.columns.length, 7);
  assert.equal(retailReport.rows[0].length, 7);
});

test("production rejects a batch that exceeds raw material stock", () => {
  const store = { ...fixture(), recipes: [recipe] };
  assert.throws(() => production.recordProduction(store, recipe, 11, actor, m.today()), /Not enough Cotton cloth/);
});

test("recipe edits do not rewrite or invalidate historical production records", () => {
  const withRecipe = { ...fixture(), recipes: [recipe] };
  const produced = production.recordProduction(withRecipe, recipe, 1, actor, m.today());
  const edited = { ...produced, recipes: [{ ...recipe, outputQuantity: 2 }] };
  assert.doesNotThrow(() => workspace.verifyChange(produced, edited, "Production", context()));
  assert.equal(produced.productionRuns[0].outputQuantity, 1);
});

test("recipe validation rejects output products used as their own ingredient", () => {
  const store = fixture();
  assert.throws(() => production.validateRecipe(store, { ...recipe, ingredients: [{ productId: "shirt", quantity: 1 }] }), /different product/);
});

test("product measurement units stay fixed after recipe or production use", () => {
  const before = { ...fixture(), recipes: [recipe] };
  const cloth = before.products.find(product => product.id === "cloth");
  const after = m.saveProduct(before, { ...cloth, unit: "gram" });
  assert.throws(() => workspace.verifyChange(before, after, "Inventory", context()), /measurement unit cannot change/);
});

test("older production records gain cost snapshots from current product costs when normalized", () => {
  const store = { ...fixture(), recipes: [recipe] };
  const old = production.recordProduction(store, recipe, 1, actor, m.today());
  const oldRun = { ...old.productionRuns[0], materialCost: undefined, outputUnitCost: undefined, ingredients: old.productionRuns[0].ingredients.map(({ productId, quantity }) => ({ productId, quantity })) };
  const normalized = m.normalizeStore({ ...old, productionRuns: [oldRun] });
  assert.equal(normalized.productionRuns[0].materialCost, 210);
  assert.equal(normalized.productionRuns[0].outputUnitCost, 210);
  assert.equal(normalized.productionRuns[0].ingredients[0].unitCost, 100);
});

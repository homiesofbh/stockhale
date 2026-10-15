const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const m = require(process.env.STOCKWELL_MODEL);
const a = require(path.join(process.env.STOCKWELL_TEST_DIR, "accounts.js"));
const w = require(path.join(process.env.STOCKWELL_TEST_DIR, "workspace.js"));
const root = () => ({ id: "assets", code: "1000", name: "Assets", parentId: "", type: "Asset", nature: "Debit", openingBalance: 500, openingDate: "2026-10-01", description: "Opening assets" });
const child = () => ({ ...root(), id: "petty", code: "1000.01", name: "Petty cash", parentId: "assets", openingBalance: 100 });

test("legacy chart classifies standard heads while preserving unknown heads and zero openings", () => {
  const s = m.emptyStore();
  assert.deepEqual(a.chartAccounts(s), a.chartAccounts(structuredClone(s)));
  assert.ok(a.chartAccounts(s).every(x => x.openingBalance === 0));
  assert.equal(a.chartAccounts(s).find(x => x.name === "Sales").type, "Income");
  assert.equal(a.chartAccounts(s).find(x => x.name === "Sales").nature, "Credit");
  assert.equal(a.chartAccounts(s).find(x => x.name === "Expenses").type, "Expense");
  assert.equal(a.chartAccounts({ ...s, heads: [...s.heads, "Custom head"] }).find(x => x.name === "Custom head").type, "Unclassified");
  const old = a.chartAccounts(s)[0];
  const next = a.saveAccount(s, { ...old, code: "4000", type: "Income", nature: "Credit" });
  assert.deepEqual(next.heads, s.heads);
  assert.equal(a.chartAccounts(next).filter(x => x.name === old.name).length, 1);
  assert.ok(w.verifyChange(s, next, "Accounts Heads").includes("accounts:"));
});

test("accounts preserve hierarchy, opening details, and name-based transaction links", () => {
  let s = a.saveAccount(m.emptyStore(), root());
  const before = s;
  s = a.saveAccount(s, child());
  assert.equal(a.accountPath(a.chartAccounts(s), child()), "Assets / Petty cash");
  assert.ok(s.heads.includes("Petty cash"));
  assert.equal(s.accounts.find(x => x.id === "petty").openingBalance, 100);
  assert.throws(() => w.verifyChange(before, s, "Billing"), /cannot change/);
  assert.throws(() => a.saveAccount(s, { ...root(), name: "Renamed" }));
});

test("invalid codes, parent types, cycles, dates and amounts are rejected", () => {
  const s = a.saveAccount(m.emptyStore(), root());
  for (const patch of [
    { code: "1000" }, { name: "assets" }, { code: "bad code" }, { parentId: "missing" },
    { type: "Liability" }, { code: "2000.01" }, { openingBalance: -1 },
    { openingBalance: Infinity }, { openingBalance: 0.001 }, { openingDate: "2026-02-30" },
    { openingDate: "" }, { nature: "Invalid" },
  ]) assert.throws(() => a.saveAccount(s, { ...child(), ...patch }));
  const withChild = a.saveAccount(s, child());
  assert.throws(() => a.saveAccount(withChild, { ...root(), parentId: "petty", code: "1000.01.01" }));
});

test("server change validation rejects direct malformed edits and removal", () => {
  const s = a.saveAccount(m.emptyStore(), root());
  const broken = structuredClone(s);
  broken.accounts.find(x => x.id === "assets").openingBalance = -100;
  assert.throws(() => w.verifyChange(s, broken, "Accounts Heads"), /Opening balance/);
  const removed = { ...s, accounts: s.accounts.filter(x => x.id !== "assets") };
  assert.throws(() => w.verifyChange(s, removed, "Accounts Heads"), /removed/);
  const legacy = s.accounts.find(x => x.id.startsWith("legacy:"));
  assert.throws(() => w.verifyChange(s, { ...s, accounts: s.accounts.filter(x => x.id !== legacy.id) }, "Accounts Heads"), /removed/);
});

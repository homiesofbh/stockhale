const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const m = require(process.env.STOCKWELL_MODEL);
const a = require(path.join(process.env.STOCKWELL_TEST_DIR, "accounts.js"));
const j = require(path.join(process.env.STOCKWELL_TEST_DIR, "journals.js"));
const w = require(path.join(process.env.STOCKWELL_TEST_DIR, "workspace.js"));
function fixture() {
  let s = m.emptyStore();
  const asset = { id: "asset", code: "1000", name: "Equipment", parentId: "", type: "Asset", nature: "Debit", openingBalance: 50, openingDate: "2026-10-01", description: "" };
  const equity = { ...asset, id: "equity", code: "3000", name: "Capital", type: "Equity", nature: "Credit" };
  s = a.saveAccount(a.saveAccount(s, asset), equity);
  const voucher = { id: "journal", number: "ignored", date: "2026-10-09", reference: "Asset contribution", notes: "", status: "draft", createdAt: 1, lines: [
    { id: "debit1", accountId: "asset", debit: 0.1, credit: 0, description: "First contribution" },
    { id: "debit2", accountId: "asset", debit: 0.2, credit: 0, description: "Second contribution" },
    { id: "credit", accountId: "equity", debit: 0, credit: 0.3, description: "Capital contribution" },
  ] };
  return { s, asset, equity, voucher };
}

test("unbalanced drafts have no financial effect and can be edited before posting", () => {
  const { s, asset, voucher } = fixture();
  voucher.lines[2].credit = 0.1;
  const draft = j.saveJournal(s, voucher);
  assert.equal(draft.journals[0].status, "draft");
  assert.equal(j.journalAccountBalance(draft, asset), 50);
  assert.deepEqual(m.financialRows(draft), []);
  assert.throws(() => j.saveJournal(draft, draft.journals[0], true), /balance/);
  const fixed = { ...draft.journals[0], lines: voucher.lines.map(l => l.id === "credit" ? { ...l, credit: 0.3 } : l) };
  const posted = j.saveJournal(draft, fixed, true);
  assert.equal(posted.journals.length, 1);
  assert.equal(posted.journals[0].number, draft.journals[0].number);
  assert.equal(posted.journals[0].createdAt, draft.journals[0].createdAt);
  assert.ok(w.verifyChange(draft, posted, "Accounts Heads").includes("journals:"));
});

test("multi-line posting balances exact cents and applies opening balances as of date", () => {
  const { s, asset, equity, voucher } = fixture();
  const posted = j.saveJournal(s, voucher, true);
  assert.deepEqual(j.journalTotals(posted.journals[0].lines), { debit: 0.3, credit: 0.3, difference: 0 });
  assert.equal(j.journalAccountBalance(posted, asset, "2026-09-30"), 0);
  assert.equal(j.journalAccountBalance(posted, asset, "2026-10-08"), 50);
  assert.equal(j.journalAccountBalance(posted, asset, "2026-10-09"), 50.3);
  assert.equal(j.journalAccountBalance(posted, equity), -50.3);
  const rows = m.financialRows(posted);
  assert.equal(rows.length, 3);
  assert.ok(rows.every(r => r.type === "Journal" && r.reference === "JV-00001" && r.cash === 0 && r.bank === 0));
  assert.equal(rows[2].credit, 0.3);
});

test("server rejects posted journal edits, unposting, deletion and foreign-module writes", () => {
  const { s, voucher } = fixture();
  const posted = j.saveJournal(s, voucher, true);
  for (const patch of [{ reference: "altered" }, { status: "draft", postedAt: undefined }, { date: "2026-10-10" }]) {
    const changed = { ...posted, journals: [{ ...posted.journals[0], ...patch }] };
    assert.throws(() => w.verifyChange(posted, changed, "Accounts Heads"));
  }
  assert.throws(() => w.verifyChange(posted, { ...posted, journals: [] }, "Accounts Heads"), /deleted/);
  assert.throws(() => w.verifyChange(s, posted, "Billing"), /cannot change/);
  assert.throws(() => j.saveJournal(posted, posted.journals[0]), /cannot be edited/);
});

test("posting rejects unclassified, parent, missing and pre-opening accounts", () => {
  const { s, asset, voucher } = fixture();
  const legacy = a.chartAccounts(s).find(x => x.type === "Unclassified");
  for (const accountId of [legacy.id, "missing"]) {
    const bad = structuredClone(voucher); bad.lines[0].accountId = accountId;
    assert.throws(() => j.saveJournal(s, bad, true));
  }
  const child = { ...asset, id: "child", code: "1000.01", name: "Tools", parentId: "asset" };
  assert.throws(() => j.saveJournal(a.saveAccount(s, child), voucher, true), /parent/);
  assert.throws(() => j.saveJournal(s, { ...voucher, date: "2026-09-30" }, true), /opening date/);
});

test("server rejects malformed lines and duplicate voucher identities", () => {
  const { s, voucher } = fixture();
  for (const patch of [{ debit: -1 }, { debit: NaN }, { debit: 0.001 }, { credit: 0.1 }, { debit: 0 }, { id: "credit" }]) {
    const bad = structuredClone(voucher); bad.lines[0] = { ...bad.lines[0], ...patch };
    assert.throws(() => j.saveJournal(s, bad, true));
  }
  assert.throws(() => j.saveJournal(s, { ...voucher, date: "2026-02-30" }, true), /valid journal date/);
  const posted = j.saveJournal(s, voucher, true);
  assert.throws(() => w.verifyChange(posted, { ...posted, journals: [...posted.journals, { ...posted.journals[0], id: "duplicate" }] }, "Accounts Heads"), /numbers/);
});

test("accounts with posted journals protect opening balances and classification", () => {
  const { s, asset, voucher } = fixture();
  const posted = j.saveJournal(s, voucher, true);
  for (const patch of [{ openingBalance: 60 }, { openingDate: "2026-10-02" }, { nature: "Credit" }, { type: "Expense" }]) {
    assert.throws(() => a.saveAccount(posted, { ...asset, ...patch }), /locked/);
    const changed = { ...posted, accounts: posted.accounts.map(x => x.id === asset.id ? { ...x, ...patch } : x) };
    assert.throws(() => w.verifyChange(posted, changed, "Accounts Heads"), /locked/);
  }
  assert.doesNotThrow(() => a.saveAccount(posted, { ...asset, description: "Reviewed" }));
});

test("voucher numbers remain distinct across drafts, posting and later entries", () => {
  const { s, voucher } = fixture();
  const first = j.saveJournal(s, voucher);
  const second = j.saveJournal(first, { ...voucher, id: "second" }, true);
  assert.deepEqual(second.journals.map(v => v.number), ["JV-00001", "JV-00002"]);
  assert.equal(j.nextJournalNumber(second), "JV-00003");
});

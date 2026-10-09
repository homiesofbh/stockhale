const test = require("node:test"), assert = require("node:assert/strict"), path = require("node:path");
const m = require(process.env.STOCKWELL_MODEL);
const a = require(path.join(process.env.STOCKWELL_TEST_DIR, "accounts.js"));
const j = require(path.join(process.env.STOCKWELL_TEST_DIR, "journals.js"));
const b = require(path.join(process.env.STOCKWELL_TEST_DIR, "bank-vouchers.js"));
const w = require(path.join(process.env.STOCKWELL_TEST_DIR, "workspace.js"));
function fixture() {
  let s = m.emptyStore();
  const ledger = { id: "ledger1", name: "HBL ledger", code: "1000", parentId: "", type: "Asset", nature: "Debit", openingBalance: 100, openingDate: "2026-10-01", description: "" };
  const ledger2 = { ...ledger, id: "ledger2", name: "Wallet ledger", code: "1001", openingBalance: 50 };
  const offset = { ...ledger, id: "income", name: "Contributions", code: "4000", type: "Income", nature: "Credit", openingBalance: 0 };
  for (const account of [ledger, ledger2, offset]) s = a.saveAccount(s, account);
  s = b.saveFinancialAccount(s, { id: "bank1", name: "HBL", type: "Bank", ledgerAccountId: ledger.id });
  s = b.saveFinancialAccount(s, { id: "wallet1", name: "Business wallet", type: "Wallet", ledgerAccountId: ledger2.id });
  const voucher = { id: "voucher", number: "", date: "2026-10-09", kind: "Receipt", accountId: "bank1", toAccountId: "", counterAccountId: "income", amount: 25, reference: "Contribution", notes: "", status: "draft", createdAt: 1 };
  return { s, ledger, ledger2, voucher };
}
const bank = (s, id) => s.financialAccounts.find(a => a.id === id);
test("bank receipts and payments post balanced entries once; drafts have no effect", () => {
  const { s, ledger, voucher } = fixture();
  const draft = b.saveBankVoucher(s, voucher);
  assert.equal(b.bankStatement(draft, bank(s, "bank1")).closing, 100);
  assert.equal(m.financialRows(draft).length, 0);
  const posted = b.saveBankVoucher(draft, draft.bankVouchers[0], true);
  assert.equal(b.bankStatement(posted, bank(s, "bank1")).closing, 125);
  assert.equal(j.journalAccountBalance(posted, ledger), 125);
  assert.deepEqual(j.journalTotals(b.bankVoucherLines(posted, posted.bankVouchers[0])), { debit: 25, credit: 25, difference: 0 });
  const payment = b.saveBankVoucher(posted, { ...voucher, id: "payment", kind: "Payment", amount: 10 }, true);
  const statement = b.bankStatement(payment, bank(s, "bank1"));
  assert.equal(statement.receipts, 25); assert.equal(statement.payments, 10); assert.equal(statement.closing, 115);
  assert.ok(w.verifyChange(draft, posted, "Payments").includes("bankVouchers"));
});
test("bank-to-wallet transfers keep combined bank movement zero", () => {
  const { s, voucher } = fixture();
  const posted = b.saveBankVoucher(s, { ...voucher, kind: "Transfer", toAccountId: "wallet1", counterAccountId: "", amount: 30 }, true);
  assert.equal(b.bankStatement(posted, bank(s, "bank1")).closing, 70);
  assert.equal(b.bankStatement(posted, bank(s, "wallet1")).closing, 80);
  assert.equal(m.financialRows(posted).reduce((n, r) => n + r.bank, 0), 0);
  assert.equal(m.financialRows(posted).reduce((n, r) => n + r.cash, 0), 0);
});
test("bank statements respect cutoff, opening date, and earlier movements", () => {
  const { s, voucher } = fixture();
  const posted = b.saveBankVoucher(s, voucher, true);
  assert.equal(b.bankStatement(posted, bank(s, "bank1"), "", "2026-09-30").closing, 0);
  assert.equal(b.bankStatement(posted, bank(s, "bank1"), "", "2026-10-08").closing, 100);
  assert.equal(b.bankStatement(posted, bank(s, "bank1"), "", "2026-10-09").closing, 125);
  assert.equal(b.bankStatement(posted, bank(s, "bank1"), "2026-10-10", "2026-10-11").opening, 125);
});
test("server rejects posted changes, deletion, relinking, and wrong-module writes", () => {
  const { s, voucher, ledger } = fixture();
  const posted = b.saveBankVoucher(s, voucher, true);
  assert.throws(() => b.saveBankVoucher(posted, posted.bankVouchers[0]), /cannot be edited/);
  const edited = { ...posted, bankVouchers: [{ ...posted.bankVouchers[0], amount: 40 }] };
  assert.throws(() => w.verifyChange(posted, edited, "Payments"), /locked/);
  assert.throws(() => w.verifyChange(posted, { ...posted, bankVouchers: [] }, "Payments"), /deleted/);
  assert.throws(() => w.verifyChange(s, posted, "Billing"), /cannot change/);
  assert.throws(() => b.saveFinancialAccount(posted, { ...bank(posted, "bank1"), ledgerAccountId: undefined }));
  assert.throws(() => a.saveAccount(posted, { ...ledger, openingBalance: 500 }), /locked/);
});
test("deactivated banks preserve history and reject new vouchers", () => {
  const { s, voucher } = fixture();
  const posted = b.saveBankVoucher(s, voucher, true);
  const inactive = b.saveFinancialAccount(posted, { ...bank(posted, "bank1"), active: false });
  assert.equal(b.bankStatement(inactive, bank(inactive, "bank1")).closing, 125);
  assert.throws(() => b.saveBankVoucher(inactive, { ...voucher, id: "new" }, true), /Inactive/);
  assert.throws(() => w.verifyChange(posted, { ...posted, financialAccounts: posted.financialAccounts.filter(a => a.id !== "bank1") }, "Accounts Heads"));
  const reactivated = b.saveFinancialAccount(inactive, { ...bank(inactive, "bank1"), active: true });
  assert.doesNotThrow(() => b.saveBankVoucher(reactivated, { ...voucher, id: "new" }, true));
});
test("posting validates links, distinct transfer accounts, amounts, and dates", () => {
  const { s, voucher } = fixture();
  for (const patch of [{ amount: 0 }, { amount: -1 }, { amount: 0.001 }, { date: "2026-02-30" }, { date: "2026-09-30" }, { accountId: "missing" }, { counterAccountId: "ledger2" }]) assert.throws(() => b.saveBankVoucher(s, { ...voucher, ...patch }, true));
  assert.throws(() => b.saveBankVoucher(s, { ...voucher, kind: "Transfer", toAccountId: "bank1", counterAccountId: "" }, true), /different/);
  assert.throws(() => b.saveBankVoucher(s, { ...voucher, accountId: "jazzcash" }, true), /Link/);
  assert.throws(() => b.saveFinancialAccount(s, { id: "other", name: "Other bank", type: "Bank", ledgerAccountId: "ledger1" }), /own ledger/);
});
test("manual journals against linked bank accounts affect separate balances", () => {
  const { s, voucher } = fixture();
  const journal = { id: "journal", number: "", date: voucher.date, reference: "Adjustment", notes: "", status: "draft", createdAt: 1, lines: b.bankVoucherLines(s, voucher) };
  const posted = j.saveJournal(s, journal, true);
  assert.equal(b.bankStatement(posted, bank(s, "bank1")).closing, 125);
  assert.equal(m.financialRows(posted).reduce((n, r) => n + r.bank, 0), 25);
});
test("bill payments record stable bank IDs while legacy generic Bank stays unassigned", () => {
  let { s } = fixture();
  const p = { id: "p", name: "Item", sku: "ITEM", barcode: "", category: "General", cost: 5, price: 10, low: 0 };
  s = m.saveProduct(s, p, 10);
  const trade = { id: "sale", date: "2026-10-09", contactId: "", lines: [{ productId: "p", qty: 1, price: 10, cost: 5 }], discount: 0, tax: 0, paid: 10, method: "HBL", head: "Sales" };
  s = m.recordTrade(s, "Sale", trade);
  assert.equal(s.invoices[0].financialAccountId, "bank1");
  assert.equal(b.bankStatement(s, bank(s, "bank1")).closing, 110);
  s = m.recordTrade(s, "Sale", { ...trade, id: "generic", method: "Bank" });
  assert.equal(b.bankStatement(s, bank(s, "bank1")).closing, 110);
  assert.equal(m.financialRows(s).filter(r => r.bank && !r.financialAccountId).reduce((n, r) => n + r.bank, 0), 10);
});

test("legacy Bank labels remain unassigned even if a payment account has that name", () => {
  const { s } = fixture();
  s.financialAccounts.push({ id: "old-bank", name: "Bank", type: "Bank" });
  s.expenses.push({ id: "legacy", date: "2026-10-09", category: "General", head: "Expenses", amount: 10, method: "Bank", notes: "" });
  assert.equal(m.paymentAccountId(s, "Bank"), undefined);
  assert.equal(m.financialRows(s)[0].financialAccountId, undefined);
  assert.equal(b.bankStatement(s, bank(s, "old-bank")).closing, 0);
  assert.doesNotThrow(() => b.validateBanks(s, s));
  assert.throws(() => b.saveFinancialAccount(s, { id: "new-cheque", name: "Cheque", type: "Bank" }), /specific/);
});

test("dated bank opening snapshots replace older movements and survive inactive imports", () => {
  const { s, voucher } = fixture();
  s.expenses.push({ id: "older", date: "2026-09-30", category: "General", head: "Expenses", amount: 20, method: "HBL", notes: "" });
  const posted = b.saveBankVoucher(s, voucher, true);
  assert.equal(b.bankStatement(posted, bank(s, "bank1")).closing, 125);
  const inactive = b.saveFinancialAccount(posted, { ...bank(posted, "bank1"), active: false });
  assert.doesNotThrow(() => b.validateBanks(inactive));
});

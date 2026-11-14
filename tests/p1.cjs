const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const m = require(process.env.STOCKWELL_MODEL);
const o = require(path.join(process.env.STOCKWELL_TEST_DIR, 'operations.js'));
const w = require(path.join(process.env.STOCKWELL_TEST_DIR, 'workspace.js'));
const a = require(path.join(process.env.STOCKWELL_TEST_DIR, 'accounts.js'));
const j = require(path.join(process.env.STOCKWELL_TEST_DIR, 'journals.js'));
const b = require(path.join(process.env.STOCKWELL_TEST_DIR, 'bank-vouchers.js'));
const r = require(path.join(process.env.STOCKWELL_TEST_DIR, 'reports.js'));
const recovery = require(path.join(process.env.STOCKWELL_TEST_DIR, 'recovery.js'));
const owner = { id: 'owner', role: 'owner' }, clerk = { id: 'clerk', role: 'member' };
const day = m.today(), yesterday = o.previousDate(day), before = o.previousDate(day, 2);
const context = actor => ({ actor, occurredAt: new Date().toISOString() });
function fixture() {
 let s = m.saveProduct(m.emptyStore(), { id: 'p', name: 'Cloth', sku: 'P1', barcode: '', category: 'General', cost: 5, price: 10, low: 0 }, 20);
 s.customers.push({ id: 'customer', name: 'Buyer', phone: '+92 300-123', address: '', email: '' });
 s.suppliers.push({ id: 'supplier', name: 'Supplier', phone: '', address: '', email: '' });
 return s;
}
const bill = patch => ({ id: 'bill', number: '', date: before, contactId: 'customer', lines: [{ productId: 'p', qty: 2, price: 10, cost: 5 }], discount: 0, tax: 0, paid: 0, method: 'Cash', head: 'Sales', ...patch });
const opts = (report, to = '', from = '') => ({ report, to, from, query: '', status: 'All', paymentMethod: 'All', reportContact: '' });
test('supplier advances reduce cash and negative advances are rejected', () => {
 const s = fixture();
 const payment = { id: 'advance', date: day, kind: 'Supplier', contactId: 'supplier', tradeId: '', advance: true, amount: 25, method: 'Cash', head: 'Purchases', notes: '' };
 const next = m.recordPayment(s, payment);
 assert.equal(m.financialRows(next).filter(row => row.type === 'Supplier payment').reduce((sum, row) => sum + row.cash, 0), -25);
 assert.throws(() => m.recordPayment(s, { ...payment, amount: -25 }), /greater than zero/);
});
test('payments allocate once across customer and supplier bills', () => {
 const s = fixture();
 let sales = m.recordTrade(s, 'Sale', bill({ id: 'sale-a', contactId: 'customer' }));
 sales = m.recordTrade(sales, 'Sale', bill({ id: 'sale-b', contactId: 'customer' }));
 const customerPayment = m.recordPayment(sales, { id: 'customer-multi', date: day, kind: 'Customer', contactId: 'customer', tradeId: '', allocations: [{ tradeId: 'sale-a', amount: 10 }, { tradeId: 'sale-b', amount: 10 }], amount: 20, method: 'Cash', head: 'Customer payments', notes: '' });
 assert.equal(m.balance(customerPayment, customerPayment.invoices.find(t => t.id === 'sale-a')), 10);
 assert.equal(m.balance(customerPayment, customerPayment.invoices.find(t => t.id === 'sale-b')), 10);
 w.verifyChange(sales, customerPayment, 'Payments', context(clerk));
 let purchases = m.recordTrade(s, 'Purchase', bill({ id: 'purchase-a', contactId: 'supplier', head: 'Purchases' }));
 purchases = m.recordTrade(purchases, 'Purchase', bill({ id: 'purchase-b', contactId: 'supplier', head: 'Purchases' }));
 const supplierPayment = m.recordPayment(purchases, { id: 'supplier-multi', date: day, kind: 'Supplier', contactId: 'supplier', tradeId: '', allocations: [{ tradeId: 'purchase-a', amount: 10 }, { tradeId: 'purchase-b', amount: 10 }], amount: 20, method: 'Cash', head: 'Supplier payments', notes: '' });
 assert.equal(m.balance(supplierPayment, supplierPayment.purchases.find(t => t.id === 'purchase-a')), 10);
 assert.equal(m.balance(supplierPayment, supplierPayment.purchases.find(t => t.id === 'purchase-b')), 10);
 w.verifyChange(purchases, supplierPayment, 'Payments', context(clerk));
});
test('allocated payments lock bill corrections and allocated cheques validate each bill before clearing', () => {
 const base = fixture();
 let sales = m.recordTrade(base, 'Sale', bill({ id: 'sale-a', contactId: 'customer' }));
 sales = m.recordTrade(sales, 'Sale', bill({ id: 'sale-b', contactId: 'customer' }));
 const allocated = m.recordPayment(sales, { id: 'allocated-cheque', date: day, kind: 'Customer', contactId: 'customer', tradeId: '', allocations: [{ tradeId: 'sale-a', amount: 10 }, { tradeId: 'sale-b', amount: 10 }], amount: 20, method: 'Cheque', head: 'Customer payments', notes: '', chequeNumber: 'A1', chequeBank: 'HBL', chequeDate: day });
 assert.throws(() => o.correctTrade(allocated, 'Sale', allocated.invoices[0], 'Edit', owner), /linked payments/);
 const lowerBalance = { ...allocated, invoices: allocated.invoices.map(trade => trade.id === 'sale-a' ? { ...trade, paid: 15 } : trade) };
 assert.throws(() => o.changeCheque(lowerBalance, 'allocated-cheque', 'cleared', day, 'cash', 'Clear', clerk), /allocation exceeds/);
});
test('sync collisions preserve posted references and assign independent draft references', () => {
 const base = fixture();
 const server = m.recordTrade(m.recordTrade(base, 'Sale', bill({ id: 'server-posted', date: day })), 'Sale', bill({ id: 'server-draft', date: day, status: 'draft' }));
 const local = m.recordTrade(m.recordTrade(base, 'Sale', bill({ id: 'local-posted', date: day })), 'Sale', bill({ id: 'local-draft', date: day, status: 'draft' }));
 const candidate = { ...server, invoices: [...server.invoices, ...local.invoices], movements: [...server.movements, ...local.movements] };
 const resolved = w.resolveTradeReferenceCollisions(server, candidate);
 assert.equal(resolved.invoices.find(item => item.id === 'server-posted').number, 'INV-00001');
 assert.equal(resolved.invoices.find(item => item.id === 'local-posted').number, 'INV-00002');
 assert.equal(resolved.invoices.find(item => item.id === 'server-draft').number, 'SL-00001');
 assert.equal(resolved.invoices.find(item => item.id === 'local-draft').number, 'SL-00002');
 const movement = resolved.movements.find(item => item.reference === 'INV-00002' && item.type === 'Sale');
 assert.ok(movement);
});
test('owner expense correction preserves original creator and creation time', () => {
 const s = fixture();
 const expense = o.saveExpense(s, { id: 'expense-edit', date: day, category: 'General', head: 'Expenses', amount: 5, method: 'Cash', notes: 'First' }, clerk, new Date().toISOString());
 const edited = o.saveExpense(expense, { ...expense.expenses[0], amount: 8, notes: 'Corrected' }, owner, new Date().toISOString());
 assert.equal(edited.expenses[0].amount, 8);
 assert.equal(edited.expenses[0].createdBy, clerk.id);
 assert.equal(edited.expenses[0].createdAt, expense.expenses[0].createdAt);
 assert.throws(() => o.saveExpense(expense, { ...expense.expenses[0], amount: 9 }, clerk), /Only the owner/);
 const activeAccount = { ...s, financialAccounts: [{ id: 'inactive', name: 'Closed bank', type: 'Bank', active: true }] };
 const historical = o.saveExpense(activeAccount, { id: 'old-bank-expense', date: day, category: 'General', head: 'Expenses', amount: 4, method: 'Closed bank', notes: '' }, owner);
 const deactivated = { ...historical, financialAccounts: historical.financialAccounts.map(account => ({ ...account, active: false })) };
 assert.doesNotThrow(() => o.saveExpense(deactivated, { ...historical.expenses[0], amount: 6 }, owner));
});
test('contact opening balances require owner authorization and remain locked after transactions', () => {
 const s = fixture();
 const opened = m.saveContact(s, 'Customer', { id: 'opening', name: 'Opening customer', phone: '', email: '', address: '', openingBalance: 5, openingBalanceDate: day });
 const added = { ...s, customers: [...s.customers, opened.customers.find(contact => contact.id === 'opening')] };
 assert.throws(() => w.verifyChange(s, added, 'Customers', context(clerk)), /workspace owner/);
 const withTrade = m.recordTrade(opened, 'Sale', bill({ id: 'opening-sale', date: day, contactId: 'opening' }));
 const changed = { ...withTrade, customers: withTrade.customers.map(contact => contact.id === 'opening' ? { ...contact, openingBalance: 6 } : contact) };
 assert.throws(() => w.verifyChange(withTrade, changed, 'Customers', context(owner)), /locked after transactions/);
});
test('receivables and payables reports filter unapplied advances by selected contact', () => {
 const s = fixture();
 let withAdvances = m.recordPayment(s, { id: 'customer-advance', date: day, kind: 'Customer', contactId: 'customer', tradeId: '', advance: true, amount: 5, method: 'Cash', head: 'Customer payments', notes: '' });
 withAdvances = m.recordPayment(withAdvances, { id: 'supplier-advance', date: day, kind: 'Supplier', contactId: 'supplier', tradeId: '', advance: true, amount: 7, method: 'Cash', head: 'Supplier payments', notes: '' });
 const customerRows = r.createReportData(withAdvances, { ...opts('Receivables report'), reportContact: 'customer' }).rows;
 const supplierRows = r.createReportData(withAdvances, { ...opts('Payables report'), reportContact: 'supplier' }).rows;
 assert.deepEqual(customerRows.map(row => row[0]), ['ADVANCE']);
 assert.deepEqual(supplierRows.map(row => row[0]), ['ADVANCE']);
});
test('sync recovery preserves independent edits and rejects overlapping edits', () => {
 const base = fixture();
 const local = { ...base, customers: [...base.customers, { id: 'local', name: 'Local', phone: '', address: '', email: '' }] };
 const remote = { ...base, customers: [...base.customers, { id: 'remote', name: 'Remote', phone: '', address: '', email: '' }] };
 const member = { ...owner, modules: [], name: 'Owner', email: '' };
 const server = { id: 'workspace', revision: 2, store: remote, member };
 const change = { id: 'change', actorId: owner.id, module: 'Customers', action: 'Add customer', occurredAt: new Date().toISOString(), store: local };
 const cache = { workspace: { ...server, store: local }, revision: 1, baseStore: base, queue: [change] };
 const recovered = w.recoverPendingQueue(cache, server);
 assert.deepEqual(recovered.workspace.store.customers.map(c => c.id), ['customer', 'remote', 'local']);
 assert.equal(recovered.queue.length, 1);
 const editedLocal = { ...base, customers: base.customers.map(c => ({ ...c, name: 'Local edit' })) };
 const editedRemote = { ...base, customers: base.customers.map(c => ({ ...c, name: 'Remote edit' })) };
 assert.throws(() => w.recoverPendingQueue({ ...cache, queue: [{ ...change, store: editedLocal }] }, { ...server, store: editedRemote }), /Both this device/);
 assert.equal(cache.queue.length, 1);
});
function posted() { return m.recordTrade(fixture(), 'Sale', bill()); }
function linked(s) {
 s = a.saveAccount(s, { id: 'ledger', name: 'HBL ledger', code: '1000', parentId: '', type: 'Asset', nature: 'Debit', openingBalance: 0, openingDate: before, description: '' });
 return b.saveFinancialAccount(s, { id: 'hbl', name: 'HBL', type: 'Bank', ledgerAccountId: 'ledger' });
}
test('draft bills have no stock, cash, balance or profit effect; posting applies once', () => {
 const s = fixture(), draft = m.recordTrade(s, 'Sale', bill({ date: day, status: 'draft', paid: 20 }));
 assert.equal(m.stock(draft, 'p'), 20); assert.equal(m.balance(draft, draft.invoices[0]), 0);
 assert.equal(m.financialRows(draft).length, 0); assert.equal(m.profit(draft).revenue, 0);
 assert.equal(r.createReportData(draft, opts('Receivables report')).rows.length, 0);
 assert.equal(r.createReportData(draft, opts('Unposted bills')).rows.length, 1);
 w.verifyChange(s, draft, 'Billing', context(clerk));
 const post = o.postTrade(draft, 'Sale', 'bill');
 assert.equal(m.stock(post, 'p'), 18); assert.equal(m.financialRows(post)[0].cash, 20);
 w.verifyChange(draft, post, 'Billing', context(clerk));
 assert.throws(() => o.postTrade(post, 'Sale', 'bill'), /draft/);
});
test('sales drafts can be deleted by their creator or owner only', () => {
 const s = fixture(), draft = m.recordTrade(s, 'Sale', bill({ date: day, status: 'draft', createdBy: clerk.id }));
 const deleted = o.deleteDraft(draft, 'Sale', 'bill');
 w.verifyChange(draft, deleted, 'Billing', context(clerk));
 w.verifyChange(draft, deleted, 'Billing', context(owner));
 assert.throws(() => w.verifyChange(draft, deleted, 'Billing', context({ ...clerk, id: 'other' })), /creator or workspace owner/);
 const paidDraft = m.recordTrade(fixture(), 'Sale', bill({ id: 'paid-draft', date: day, status: 'draft', paid: 5, createdBy: owner.id }));
 assert.throws(() => o.deleteDraft(paidDraft, 'Sale', 'paid-draft'), /Only unpaid drafts/);
 assert.throws(() => w.verifyChange(paidDraft, { ...paidDraft, invoices: [] }, 'Billing', context(owner)), /Only unpaid drafts/);
});
test('legacy bill lines below new minimums do not block unrelated updates', () => {
 const s = m.recordTrade(fixture(), 'Sale', bill());
 const legacy = { ...s, invoices: s.invoices.map(trade => ({ ...trade, lines: trade.lines.map(line => ({ ...line, qty: 0.25, price: 0.5 })) })) };
 const changed = { ...legacy, customers: [...legacy.customers, { id: 'new-customer', name: 'New customer', phone: '', email: '', address: '' }] };
 assert.doesNotThrow(() => w.verifyChange(legacy, changed, 'Customers', context(owner)));
});
test('owners can delete paid purchases while retaining advances and reversing stock', () => {
 const s = fixture();
 const purchase = m.recordTrade(s, 'Purchase', bill({ id: 'paid-purchase', date: day, contactId: 'supplier', head: 'Purchases', paid: 4, lines: [{ productId: 'p', qty: 2, price: 8, cost: 8 }] }));
 assert.throws(() => o.deletePaidPurchase(purchase, 'paid-purchase', clerk), /workspace owner/);
 const deleted = o.deletePaidPurchase(purchase, 'paid-purchase', owner);
 assert.equal(deleted.purchases.some(item => item.id === 'paid-purchase'), false);
 assert.equal(m.stock(deleted, 'p'), 20);
 assert.equal(m.unappliedAdvanceBalance(deleted, 'Supplier', 'supplier'), 4);
 const deletionRows = m.financialRows(deleted).filter(row => row.reference === 'PUR-00001' && ['Purchase', 'Purchase deletion reversal'].includes(row.type));
 assert.equal(deletionRows.filter(row => row.type === 'Purchase').reduce((sum, row) => sum + row.amount, 0), -16);
 assert.equal(deletionRows.filter(row => row.type === 'Purchase deletion reversal').reduce((sum, row) => sum + row.amount, 0), 16);
 assert.doesNotThrow(() => w.verifyChange(purchase, deleted, 'Purchases', context(owner)));
});
test('purchase drafts preserve costs; posting updates only the cost and stock', () => {
 const s = fixture(), draft = m.recordTrade(s, 'Purchase', bill({ status: 'draft', contactId: 'supplier', head: 'Purchases', lines: [{ productId: 'p', qty: 2, price: 8, cost: 8 }] }));
 assert.equal(draft.products[0].cost, 5);
 w.verifyChange(s, draft, 'Purchases', context(clerk));
 const post = o.postTrade(draft, 'Purchase', 'bill');
 assert.equal(m.stock(post, 'p'), 22); assert.equal(post.products[0].cost, 8);
 w.verifyChange(draft, post, 'Purchases', context(clerk));
});
test('walk-ins match unique normalized phone; names alone and anonymous visits remain separate', () => {
 const s = fixture();
 const matched = m.recordTrade(s, 'Sale', bill({ date: day, contactId: '', paid: 20, walkInName: 'Buyer', walkInPhone: '+92300123' }));
 assert.equal(matched.customers.length, 1); assert.equal(matched.invoices[0].contactId, 'customer');
 const separate = m.recordTrade(s, 'Sale', bill({ date: day, contactId: '', paid: 20, walkInName: 'Buyer' }));
 assert.equal(separate.customers.length, 2); assert.notEqual(separate.invoices[0].contactId, 'customer');
 w.verifyChange(s, separate, 'Billing', context(clerk));
 const anonymous = m.recordTrade(s, 'Sale', bill({ date: day, contactId: '', paid: 20 }));
 w.verifyChange(s, anonymous, 'Billing', context(clerk));
 assert.equal(anonymous.customers[1].name, `Walk-in ${anonymous.invoices[0].number}`);
 const ambiguous = structuredClone(s); ambiguous.customers.push({ ...s.customers[0], id: 'duplicate' });
 assert.throws(() => m.recordTrade(ambiguous, 'Sale', bill({ date: day, contactId: '', paid: 20, walkInPhone: '+92300123' })), /multiple/);
});
test('owner corrections update stock and preserve historical reports and audit snapshots', () => {
 const s = posted(), original = s.invoices[0];
 const corrected = o.correctTrade(s, 'Sale', { ...original, lines: [{ ...original.lines[0], qty: 3 }] }, 'Wrong quantity', owner, yesterday);
 assert.equal(m.stock(corrected, 'p'), 17); assert.equal(m.balance(corrected, corrected.invoices[0]), 30);
 assert.equal(r.createReportData(corrected, opts('Receivables report', before)).rows[0][9], 20);
 assert.equal(r.createReportData(corrected, opts('Receivables report', yesterday)).rows[0][9], 30);
 assert.equal(m.profit(corrected, before, before).revenue, 20);
 assert.equal(m.profit(corrected, yesterday, yesterday).revenue, 10);
 w.verifyChange(s, corrected, 'Billing', context(owner));
 assert.equal(corrected.corrections[0].before.lines[0].qty, 2);
 assert.throws(() => o.correctTrade(s, 'Sale', original, 'Reason', clerk), /owner/);
 const forged = { ...s, invoices: [{ ...original, paid: 20 }] };
 assert.throws(() => w.verifyChange(s, forged, 'Billing', context(owner)), /locked/);
});
test('bill correction excess paid is retained as a customer advance', () => {
 const s = m.recordTrade(fixture(), 'Sale', bill({ id: 'excess-correction', date: day, paid: 20 }));
 const corrected = o.correctTrade(s, 'Sale', { ...s.invoices[0], lines: [{ ...s.invoices[0].lines[0], qty: 0.5 }] }, 'Correct quantity', owner, day);
 assert.equal(corrected.invoices[0].paid, 5);
 assert.equal(m.unappliedAdvanceBalance(corrected, 'Customer', 'customer'), 15);
 assert.equal(m.balance(corrected, corrected.invoices[0]), 0);
 w.verifyChange(s, corrected, 'Billing', context(owner));
});
test('bill reversals preserve historical cash and restore stock without deleting originals', () => {
 const s = m.recordTrade(fixture(), 'Sale', bill({ paid: 20 }));
 const reversed = o.correctTrade(s, 'Sale', { ...s.invoices[0], status: 'void' }, 'Wrong bill', owner, yesterday);
 assert.equal(m.stock(reversed, 'p'), 20); assert.equal(m.balance(reversed, reversed.invoices[0]), 0);
 assert.equal(o.cashStatement(reversed, '', before).closing, 20);
 assert.equal(o.cashStatement(reversed, '', yesterday).closing, 0);
 w.verifyChange(s, reversed, 'Billing', context(owner));
});
test('linked payments and returns block uncontrolled bill correction', () => {
 let s = posted(); s = m.recordPayment(s, { id: 'pay', date: yesterday, kind: 'Customer', contactId: 'customer', tradeId: 'bill', amount: 5, method: 'Cash', head: 'Customer payments', notes: '' });
 assert.throws(() => o.correctTrade(s, 'Sale', s.invoices[0], 'Edit', owner), /linked/);
});
test('expense policy uses Karachi calendar dates, rejects future dates and preserves late offline review', () => {
 const time = `${day}T08:00:00Z`, actor = context(clerk), s = fixture();
 assert.equal(o.expenseDateAllowed(before, clerk, time), true); assert.equal(o.expenseDateAllowed(o.previousDate(day, 3), clerk, time), false);
 assert.equal(o.expenseDateAllowed(o.previousDate(day, -1), owner, time), false);
 assert.equal(o.expenseDateAllowed(o.previousDate(day, 10), owner, time), true);
 const dateAtMidnight = '2026-10-08T20:30:00Z';
 assert.equal(o.expenseDateAllowed('2026-10-07', clerk, dateAtMidnight), true);
 assert.equal(o.expenseDateAllowed('2026-10-06', clerk, dateAtMidnight), false);
 const occurredAt = new Date().toISOString(), expense = { id: 'expense', date: day, category: 'General', head: 'Expenses', amount: 5, method: 'Cash', notes: '' };
 const next = o.saveExpense(s, expense, clerk, occurredAt);
 w.verifyChange(s, next, 'Expenses', { actor: clerk, occurredAt });
 assert.throws(() => w.verifyChange(s, next, 'Expenses', { actor: clerk, occurredAt, receivedAt: `${o.previousDate(day, -5)}T08:00:00Z` }), /owner review/);
 w.verifyChange(s, next, 'Expenses', { actor: clerk, occurredAt, receivedAt: `${o.previousDate(day, -5)}T08:00:00Z`, allowLateExpense: true });
});
test('members may select heads but cannot create or alter them through API snapshots', () => {
 const s = fixture(), changed = { ...s, heads: [...s.heads, 'Private head'] };
 assert.throws(() => w.verifyChange(s, changed, 'Accounts Heads', context(clerk)), /owner/);
 w.verifyChange(s, changed, 'Accounts Heads', context(owner));
});
function pendingCheque() {
 const s = linked(posted());
 return m.recordPayment(s, { id: 'cheque', date: before, kind: 'Customer', contactId: 'customer', tradeId: 'bill', amount: 20, method: 'Cheque', head: 'Customer payments', notes: '', chequeNumber: '000001', chequeBank: 'HBL', chequeDate: o.previousDate(day, -4) });
}
test('expected cheque date never settles bills; clearance and bounce use separate dated effects', () => {
 const s = pendingCheque(); assert.equal(m.balance(s, s.invoices[0]), 20);
 const clear = o.changeCheque(s, 'cheque', 'cleared', yesterday, 'hbl', 'Bank confirmed', clerk);
 w.verifyChange(s, clear, 'Payments', context(clerk));
 assert.equal(m.balance(clear, clear.invoices[0]), 0); assert.equal(b.bankStatement(clear, clear.financialAccounts.find(a => a.id === 'hbl')).closing, 20);
 const bounce = o.changeCheque(clear, 'cheque', 'bounced', day, '', 'Insufficient funds', clerk);
 w.verifyChange(clear, bounce, 'Payments', context(clerk));
 assert.equal(m.balance(bounce, bounce.invoices[0]), 20);
 assert.equal(b.bankStatement(bounce, bounce.financialAccounts.find(a => a.id === 'hbl'), '', yesterday).closing, 20);
 assert.equal(b.bankStatement(bounce, bounce.financialAccounts.find(a => a.id === 'hbl'), '', day).closing, 0);
 assert.equal(r.createReportData(bounce, opts('Receivables report', yesterday)).rows.length, 0);
 assert.equal(r.createReportData(bounce, opts('Receivables report', day)).rows[0][9], 20);
 const ledger = r.createReportData(bounce, opts('Customer ledger')).rows;
 assert.equal(ledger.at(-1)[6], 20);
 assert.throws(() => o.changeCheque(bounce, 'cheque', 'cleared', day, 'hbl', 'Retry', clerk), /transition/);
});
test('pending cheque cancellation leaves bill due and immutable history rejects direct status edits', () => {
 const s = pendingCheque(), cancel = o.changeCheque(s, 'cheque', 'cancelled', yesterday, '', 'Cancelled by customer', owner);
 w.verifyChange(s, cancel, 'Payments', context(owner)); assert.equal(m.balance(cancel, cancel.invoices[0]), 20);
 const direct = { ...s, payments: s.payments.map(p => ({ ...p, chequeStatus: 'cleared', clearedDate: yesterday })) };
 assert.throws(() => w.verifyChange(s, direct, 'Payments', context(owner)), /locked/);
});
test('cancelling a forwarded cheque updates both lifecycle records', () => {
 const s = pendingCheque();
 const forwarded = { ...s, crossCheques: [{ id: 'forwarded', sourcePaymentId: 'cheque', date: before, customerId: 'customer', destinationKind: 'Supplier', destinationId: 'supplier', destinationName: 'Supplier', amount: 20, status: 'pending', notes: '' }] };
 const cancelled = o.changeCheque(forwarded, 'cheque', 'cancelled', yesterday, '', 'Supplier declined cheque', owner);
 assert.equal(cancelled.payments.find(payment => payment.id === 'cheque').chequeStatus, 'cancelled');
 assert.equal(cancelled.crossCheques[0].status, 'cancelled');
 w.verifyChange(forwarded, cancelled, 'Payments', context(owner));
});
test('cash flow excludes bank transfers while bank statements retain both sides', () => {
 let s = linked(fixture());
 s = a.saveAccount(s, { id: 'other-ledger', name: 'Wallet ledger', code: '1001', parentId: '', type: 'Asset', nature: 'Debit', openingBalance: 0, openingDate: before, description: '' });
 s = b.saveFinancialAccount(s, { id: 'wallet', name: 'Business wallet', type: 'Wallet', ledgerAccountId: 'other-ledger' });
 s = b.saveBankVoucher(s, { id: 'transfer', number: '', date: day, kind: 'Transfer', accountId: 'hbl', toAccountId: 'wallet', counterAccountId: '', amount: 10, reference: '', notes: '', status: 'draft', createdAt: 1 }, true);
 const flow = o.cashFlow(s, day, day); assert.equal(flow.receipts, 0); assert.equal(flow.payments, 0); assert.equal(flow.net, 0);
});
test('daily close saves counted cash and variance; closed dates lock entries until owner reopening', () => {
 const s = m.recordTrade(fixture(), 'Sale', bill({ date: day, paid: 20 }));
 assert.throws(() => o.closeDay(s, day, 19, '', owner), /Explain/);
 assert.throws(() => o.closeDay(s, day, 20, '', clerk), /permission/);
 const closed = o.closeDay(s, day, 19, 'Drawer short', owner);
 w.verifyChange(s, closed, 'Reports', context(owner)); assert.equal(closed.dailyCloses[0].variance, -1);
 assert.throws(() => m.recordTrade(closed, 'Sale', bill({ id: 'new', date: day })), /closed/);
 assert.throws(() => o.correctTrade(closed, 'Sale', closed.invoices[0], 'Edit', owner), /closed/);
 const reopened = o.reopenDay(closed, closed.dailyCloses[0].id, 'Review receipt', owner);
 w.verifyChange(closed, reopened, 'Reports', context(owner));
 assert.equal(reopened.dailyCloses[0].expected, 20); assert.equal(reopened.dailyCloses[0].counted, 19);
 assert.doesNotThrow(() => m.recordTrade(reopened, 'Sale', bill({ id: 'new', date: day })));
});
test('forged closing figures and changes to stock movements are rejected', () => {
 const s = posted(), close = o.closeDay(s, day, 0, '', owner);
 const bad = { ...close, dailyCloses: close.dailyCloses.map(c => ({ ...c, expected: 10, variance: -10 })) };
 assert.throws(() => w.verifyChange(s, bad, 'Reports', context(owner)), /figures/);
 const moved = structuredClone(s); moved.movements[0].qty = 100;
 assert.throws(() => w.verifyChange(s, moved, 'Inventory', context(owner)), /cannot be changed/);
});
test('historical walk-in linking needs reviewed owner action and preserves stock and financial amounts', () => {
 const s = posted(); s.invoices[0].contactId = ''; s.invoices[0].walkInName = 'Legacy buyer';
 const linked = o.linkLegacyWalkIn(s, 'bill', 'customer', 'Reviewed by owner', owner);
 w.verifyChange(s, linked, 'Billing', context(owner));
 assert.equal(m.stock(linked, 'p'), m.stock(s, 'p')); assert.equal(m.balance(linked, linked.invoices[0]), 20);
 assert.equal(linked.invoices[0].contactId, 'customer');
 assert.throws(() => o.linkLegacyWalkIn(s, 'bill', 'customer', 'Review', clerk), /owner/);
});
test('complete backup checksum validates full audit history and rejects corrupt or cross-workspace files', async () => {
 const store = posted(), audit = Array.from({ length: 350 }, (_, i) => ({ id: String(i), actor: 'Owner', module: 'Billing', action: 'Post', records: '{}', occurredAt: new Date().toISOString(), receivedAt: new Date().toISOString(), emailStatus: 'sent' }));
 const backup = { format: 'stockwell-backup', version: 1, workspaceId: 'workspace', workspaceName: 'Shop', revision: 1, exportedAt: new Date().toISOString(), store, audit, checksum: '' };
 backup.checksum = await recovery.backupChecksum(backup);
 assert.equal((await recovery.validateRecoveryBackup(backup, 'workspace')).audit.length, 350);
 await assert.rejects(recovery.validateRecoveryBackup(backup, 'other'), /workspace/);
 const corrupt = structuredClone(backup); corrupt.store.invoices[0].paid = 20;
 await assert.rejects(recovery.validateRecoveryBackup(corrupt, 'workspace'), /checksum/);
});

test('purchase corrections and reversals keep the latest item cost consistent', () => {
 const base = fixture();
 const s = m.recordTrade(base, 'Purchase', bill({ contactId: 'supplier', head: 'Purchases', lines: [{ productId: 'p', qty: 2, price: 8, cost: 8 }] }));
 const corrected = o.correctTrade(s, 'Purchase', { ...s.purchases[0], lines: [{ productId: 'p', qty: 2, price: 9, cost: 9 }] }, 'Incorrect supplier rate', owner, yesterday);
 assert.equal(corrected.products[0].cost, 9); w.verifyChange(s, corrected, 'Purchases', context(owner));
 const reversed = o.correctTrade(corrected, 'Purchase', { ...corrected.purchases[0], status: 'void' }, 'Cancelled purchase', owner, day);
 assert.equal(reversed.products[0].cost, 5); w.verifyChange(corrected, reversed, 'Purchases', context(owner));
});
test('legacy cleared cheques preserve their original settlement when a later bounce is recorded', () => {
 const s = pendingCheque(); s.payments[0] = { ...s.payments[0], chequeStatus: 'cleared', date: yesterday };
 const bounced = o.changeCheque(s, 'cheque', 'bounced', day, '', 'Legacy cheque bounced', owner);
 assert.equal(r.createReportData(bounced, opts('Receivables report', yesterday)).rows.length, 0);
 assert.equal(r.createReportData(bounced, opts('Receivables report', day)).rows[0][9], 20);
 w.verifyChange(s, bounced, 'Payments', context(owner));
});
test('voucher reversals exactly reverse original entries, retain history, and reject duplicates', () => {
 let s = linked(fixture());
 s = a.saveAccount(s, { id: 'equity', name: 'Capital', code: '3000', parentId: '', type: 'Equity', nature: 'Credit', openingBalance: 0, openingDate: before, description: '' });
 const original = j.saveJournal(s, { id: 'journal', number: '', date: before, reference: '', notes: '', status: 'draft', createdAt: 1, lines: [{ id: 'debit', accountId: 'ledger', debit: 5, credit: 0, description: '' }, { id: 'credit', accountId: 'equity', debit: 0, credit: 5, description: '' }] }, true);
 const reversed = o.reverseVoucher(original, 'Journal', 'journal', yesterday, 'Wrong journal', owner);
 w.verifyChange(original, reversed, 'Accounts Heads', context(owner));
 assert.equal(j.journalAccountBalance(reversed, reversed.accounts.find(a => a.id === 'ledger')), 0);
 assert.equal(reversed.journals[0].status, 'posted'); assert.equal(reversed.journals[1].reversalOf, 'journal');
 assert.throws(() => o.reverseVoucher(reversed, 'Journal', 'journal', day, 'Again', owner), /reversed/);
 assert.throws(() => o.reverseVoucher(original, 'Journal', 'journal', yesterday, 'Wrong', clerk), /owner/);
});

test('unposting retains a reversal and a replacement draft without duplicate stock or cash', () => {
 const s = m.recordTrade(fixture(), 'Sale', bill({ paid: 20 }));
 const unposted = o.unpostTrade(s, 'Sale', s.invoices[0], 'Re-enter bill', owner, yesterday);
 w.verifyChange(s, unposted, 'Billing', context(owner));
 assert.equal(unposted.invoices[0].status, 'void'); assert.equal(unposted.invoices[1].status, 'draft');
 assert.equal(unposted.invoices[1].replacementOf, 'bill');
 assert.equal(m.stock(unposted, 'p'), 20); assert.equal(o.cashStatement(unposted, '', day).closing, 0);
 const reposted = o.postTrade(unposted, 'Sale', unposted.invoices[1].id);
 w.verifyChange(unposted, reposted, 'Billing', context(owner));
 assert.equal(m.stock(reposted, 'p'), 18); assert.equal(o.cashStatement(reposted, '', day).closing, 0);
});

test('new Excel backups contain a complete validated JSON recovery snapshot', async () => {
 const { createBackupWorkbook } = require(path.join(process.env.STOCKWELL_TEST_DIR, 'backup.js'));
 const store = posted(), now = new Date().toISOString();
 const backup = { format: 'stockwell-backup', version: 1, workspaceId: 'workspace', workspaceName: 'Shop', revision: 1, exportedAt: now, store, audit: [], checksum: '' };
 backup.checksum = await recovery.backupChecksum(backup);
 const cache = { workspace: { id: 'workspace', name: 'Shop', revision: 1, store, member: { ...owner, name: 'Owner', email: 'owner@example.test', modules: [] }, members: [], audit: [], image: '', emailConfigured: false }, queue: [], revision: 1, recovery: backup };
 const bytes = await createBackupWorkbook(cache);
 const parsed = await recovery.readRecoveryFile(new File([bytes], 'backup.xlsx'), 'workspace');
 assert.deepEqual(parsed, JSON.parse(JSON.stringify(backup)));
});

test('server rejects future expense dates even within allowed device-clock drift', () => {
 const base = fixture();
 const occurredAt = '2026-10-08T19:01:00Z', receivedAt = '2026-10-08T18:59:00Z';
 const next = { ...base, expenses: [{ id: 'future', date: '2026-10-09', category: 'General', head: 'Expenses', amount: 1, method: 'Cash', notes: '', createdAt: occurredAt }] };
 assert.throws(() => w.verifyChange(base, next, 'Expenses', { actor: clerk, occurredAt, receivedAt }), /Future expense/);
});
test('future bills may be planned as drafts but cannot affect stock before their date', () => {
 const base = fixture(), future = o.previousDate(day, -1);
 assert.throws(() => m.recordTrade(base, 'Sale', bill({ date: future })), /Future bills/);
 const draft = m.recordTrade(base, 'Sale', bill({ date: future, status: 'draft' }));
 assert.equal(m.stock(draft, 'p'), m.stock(base, 'p'));
 assert.throws(() => o.postTrade(draft, 'Sale', 'bill'), /Future bills/);
});

test('new sale costs come from the product at posting and forged line costs are rejected', () => {
 const base = fixture(), created = m.recordTrade(base, 'Sale', bill({ date: day, lines: [{ productId: 'p', qty: 2, price: 10, cost: 0 }] }));
 assert.equal(created.invoices[0].lines[0].cost, 5);
 const forged = structuredClone(created); forged.invoices[0].lines[0].cost = 0;
 assert.throws(() => w.verifyChange(base, forged, 'Billing', context(clerk)), /posting calculations/);
});
test('financial reports reconcile to the canonical ledger fixture', () => {
 const s = m.recordTrade(fixture(), 'Sale', bill({ paid: 20 }));
 const purchase = m.recordTrade(s, 'Purchase', bill({ id: 'purchase', number: '', contactId: 'supplier', head: 'Purchases', lines: [{ productId: 'p', qty: 2, price: 8, cost: 8 }], paid: 16 }));
 const expense = { id: 'expense', date: day, category: 'General', head: 'Expenses', amount: 3, method: 'Cash', notes: '' };
 const final = { ...purchase, expenses: [...purchase.expenses, expense] };
 const income = r.createReportData(final, opts('Income statement')).rows;
 assert.deepEqual(income, [['Revenue', 20], ['Cost of goods sold', 10], ['Operating expenses', 3], ['Damaged stock', 0], ['Net income', 7]]);
 const cash = r.createReportData(final, opts('Cash-in-hand report', day, '')).rows;
 assert.equal(cash.find(row => row[0] === 'Receipts')[1], 20);
 assert.equal(cash.find(row => row[0] === 'Payments')[1], 19);
 const aging = r.createReportData(final, opts('Account aging report', day, day)).rows;
 assert.equal(aging.some(row => row[1] === 'Buyer'), false);
});

test('fractional stock corrections preserve thousandths and duplicate lines do not oversell', () => {
 const base = fixture(), fractional = m.recordTrade(base, 'Sale', bill({ lines: [{ productId: 'p', qty: 1.001, price: 10, cost: 5 }] }));
 assert.equal(m.stock(fractional, 'p'), 18.999);
 const corrected = o.correctTrade(fractional, 'Sale', { ...fractional.invoices[0], lines: [{ productId: 'p', qty: 1.002, price: 10, cost: 5 }] }, 'Small quantity adjustment', owner, yesterday);
 assert.equal(m.stock(corrected, 'p'), 18.998);
 w.verifyChange(fractional, corrected, 'Billing', context(owner));
 const small = { ...base, movements: [{ id: 'small-stock', productId: 'p', qty: 0.3, date: before, type: 'Opening stock', reference: 'P1', reason: 'Opening' }] };
 assert.throws(() => m.recordTrade(small, 'Sale', bill({ lines: [{ productId: 'p', qty: 0.5, price: 10, cost: 5 }, { productId: 'p', qty: 0.5, price: 10, cost: 5 }] })), /Insufficient stock/);
});
test('drafts cannot be issued as invoice PDFs', () => {
 const pdf = require(path.join(process.env.STOCKWELL_TEST_DIR, 'invoice-pdf.js'));
 const draft = m.recordTrade(fixture(), 'Sale', bill({ status: 'draft' }));
 assert.throws(() => pdf.createInvoicePdf(draft, draft.invoices[0], 'A4'), /Post the bill/);
});

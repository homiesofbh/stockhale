const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { backupDue, BACKUP_WEEK, createBackupWorkbook } = require(path.join(process.env.STOCKWELL_TEST_DIR, 'backup.js'));
const { emptyStore } = require(process.env.STOCKWELL_MODEL);
const { Workbook } = require('exceljs');

test('weekly backup stays due after snooze expires and resets after download', () => {
  const now = BACKUP_WEEK * 3;
  assert.equal(backupDue(null, null, now), true);
  assert.equal(backupDue(String(now - BACKUP_WEEK + 1), null, now), false);
  assert.equal(backupDue(String(now - BACKUP_WEEK), null, now), true);
  assert.equal(backupDue(null, String(now + 1000), now), false);
  assert.equal(backupDue(null, String(now), now), true);
  assert.equal(backupDue('invalid', null, now), true);
});

test('Excel preserves collections, literal strings and a lossless large snapshot', async () => {
  const store = emptyStore();
  store.categories = ['=1+1', 'اردو', 'x'.repeat(40000)];
  store.bankVouchers = [{ id: 'bank-voucher', number: 'BV-00001', date: '2026-10-09', kind: 'Receipt', accountId: 'jazzcash', toAccountId: '', counterAccountId: 'account', amount: 10, reference: 'Preserve voucher', notes: '', status: 'draft', createdAt: 1 }];
  store.accounts = [{ id: 'account', code: '1000', name: 'Cash', parentId: '', type: 'Asset', nature: 'Debit', openingBalance: 25, openingDate: '2026-10-01', description: '' }];
  store.journals = [{ id: 'journal', number: 'JV-00001', date: '2026-10-09', status: 'draft', reference: '=literal reference', notes: 'Backup journal', createdAt: 1, lines: [{ id: 'line', accountId: 'account', debit: 10, credit: 0, description: 'Preserve line' }] }];
  const member = { id: 'owner', name: 'Owner', email: 'owner@example.test', role: 'owner', modules: [] };
  const cache = { workspace: { id: 'test', name: 'Store', revision: 1, store, member, members: [member], audit: [], image: '', emailConfigured: false }, queue: [{ id: 'pending', store }], revision: 1 };
  const data = await createBackupWorkbook(cache);
  const book = new Workbook();
  await book.xlsx.load(data);
  for (const key of Object.keys(store)) if (Array.isArray(store[key])) assert.ok(book.getWorksheet(key));
  assert.equal(book.getWorksheet('categories').getCell('A2').value, '=1+1');
  assert.equal(book.getWorksheet('categories').getCell('A3').value, 'اردو');
  const snapshot = book.getWorksheet('Backup snapshot');
  let raw = '';
  snapshot.eachRow((row, number) => { if (number > 1) raw += row.getCell(2).value; });
  assert.deepEqual(JSON.parse(raw), cache);
  assert.equal(book.getWorksheet('Pending changes').rowCount, 2);
});

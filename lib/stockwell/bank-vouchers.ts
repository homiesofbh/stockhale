import { chartAccounts } from "./accounts";
import { financialRows, round, today, type FinancialAccount, type Store } from "./model";
import type { JournalLine } from "./journals";
export type BankVoucher = {
  reversalOf?: string;
  ledgerAccountId?: string;
  toLedgerAccountId?: string;
  id: string; number: string; date: string; kind: "Receipt" | "Payment" | "Transfer";
  accountId: string; toAccountId: string; counterAccountId: string; amount: number;
  reference: string; notes: string; status: "draft" | "posted"; createdAt: number; postedAt?: string;
};
const check = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };
export function sharedBankLedger(s: Store) {
  return chartAccounts(s).find(account => account.name.trim().toLowerCase() === "bank" && account.type === "Asset" && !account.parentId) ||
    chartAccounts(s).find(account => account.code === "L0005" && account.type === "Asset");
}
export function nextBankVoucherNumber(s: Store) {
  const max = (s.bankVouchers || []).reduce((n, v) => Math.max(n, Number(/^BV-(\d+)$/.exec(v.number)?.[1] || 0)), 0);
  return `BV-${String(max + 1).padStart(5, "0")}`;
}
export function bankVoucherLines(s: Store, v: BankVoucher): JournalLine[] {
  const fromAccount = s.financialAccounts?.find(a => a.id === v.accountId);
  const toAccount = s.financialAccounts?.find(a => a.id === v.toAccountId);
  const from = v.ledgerAccountId || fromAccount?.ledgerAccountId || sharedBankLedger(s)?.id || "";
  const to = v.kind === "Transfer" ? (v.toLedgerAccountId || toAccount?.ledgerAccountId || sharedBankLedger(s)?.id || from) : v.counterAccountId;
  const receipt = v.kind === "Receipt";
  return [
    { id: `${v.id}:bank`, accountId: from, financialAccountId: fromAccount?.id, debit: receipt ? v.amount : 0, credit: receipt ? 0 : v.amount, description: v.notes },
    { id: `${v.id}:counter`, accountId: to, financialAccountId: v.kind === "Transfer" ? toAccount?.id : undefined, debit: receipt ? 0 : v.amount, credit: receipt ? v.amount : 0, description: v.notes },
  ];
}
export function validateBanks(s: Store, before?: Store) {
  const chart = chartAccounts(s), banks = s.financialAccounts || [];
  const ids = new Set(), names = new Set(), links = new Set();
  for (const bank of banks) {
    check(typeof bank.id === "string" && !!bank.id && !ids.has(bank.id), "Payment account IDs must be unique."); ids.add(bank.id);
    check(typeof bank.name === "string" && !!bank.name.trim() && bank.name === bank.name.trim() && !names.has(bank.name.toLowerCase()), "Enter a unique bank or wallet name."); names.add(bank.name.toLowerCase());
    if (bank.createdAt !== undefined) check(typeof bank.createdAt === "string" && Number.isFinite(Date.parse(bank.createdAt)), "Invalid bank creation time.");
    if (before && !(before.financialAccounts || []).some(a => a.id === bank.id)) {
      check(!!bank.createdAt && (before.journals || []).filter(v => v.status === "posted").every(v => Date.parse(bank.createdAt!) > Date.parse(v.postedAt!)), "New banks must retain creation time after existing journals.");
      check(!["cash", "bank", "cheque", "credit adjustment", "journal adjustment"].includes(bank.name.toLowerCase()), "Use a specific bank or wallet name.");
    }
    check(["Bank", "Wallet"].includes(bank.type) && (bank.active === undefined || typeof bank.active === "boolean"), "Invalid payment account.");
    if (bank.openingBalance !== undefined) {
      check(Number.isFinite(bank.openingBalance) && Number.isSafeInteger(Math.round(bank.openingBalance * 100)) && bank.openingBalance >= 0 && round(bank.openingBalance) === bank.openingBalance, "Invalid bank opening balance.");
      check(bank.openingBalance === 0 && !bank.openingDate || !!bank.openingDate && /^\d{4}-\d{2}-\d{2}$/.test(bank.openingDate) && Number.isFinite(Date.parse(bank.openingDate)) && new Date(bank.openingDate).toISOString().slice(0, 10) === bank.openingDate, "Enter a valid bank opening balance date.");
    }
    if (bank.ledgerAccountId) {
      const account = chart.find(a => a.id === bank.ledgerAccountId);
      check(!!account && account.type === "Asset" && !chart.some(a => a.parentId === account.id), "Link the bank to a classified Asset subaccount.");
      check(bank.ledgerAccountId === sharedBankLedger(s)?.id || !links.has(bank.ledgerAccountId), "Each bank needs its own ledger account unless using the shared Bank ledger."); links.add(bank.ledgerAccountId);
    }
  }
  const voucherIds = new Set(), numbers = new Set();
  for (const v of s.bankVouchers || []) {
    check(typeof v.id === "string" && !!v.id && !voucherIds.has(v.id), "Bank voucher IDs must be unique."); voucherIds.add(v.id);
    check(typeof v.number === "string" && /^BV-\d+$/.test(v.number) && !numbers.has(v.number), "Bank voucher numbers must be unique."); numbers.add(v.number);
    check(typeof v.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.date) && Number.isFinite(Date.parse(v.date)) && new Date(v.date).toISOString().slice(0, 10) === v.date, "Enter a valid voucher date.");
    check(["Receipt", "Payment", "Transfer"].includes(v.kind) && ["draft", "posted"].includes(v.status), "Invalid bank voucher type or status.");
    check(Number.isFinite(v.amount) && v.amount > 0 && Number.isSafeInteger(Math.round(v.amount * 100)) && round(v.amount) === v.amount, "Amount must be positive with at most two decimals.");
    check(Number.isFinite(v.createdAt) && v.createdAt > 0 && typeof v.reference === "string" && v.reference.length <= 200 && typeof v.notes === "string" && v.notes.length <= 2000, "Invalid voucher details.");
    const bank = banks.find(a => a.id === v.accountId);
    check(!!bank, "Select an existing bank or wallet.");
    const destination = banks.find(a => a.id === v.toAccountId);
    if (v.kind === "Transfer") check(!!destination && destination.id !== bank!.id && v.counterAccountId === "", "Transfers need two different accounts.");
    else check(v.toAccountId === "" && !!chart.find(a => a.id === v.counterAccountId) && (!banks.some(a => a.ledgerAccountId === v.counterAccountId) || v.counterAccountId === chart.find(a => a.name === "Cash" && a.type === "Asset")?.id), "Select a counter-account; use Transfer for another bank or wallet.");
    const old = before?.bankVouchers?.find(a => a.id === v.id);
    if (before && (!old || JSON.stringify(old) !== JSON.stringify(v))) check(bank!.active !== false && (v.kind !== "Transfer" || destination!.active !== false), "Inactive payment accounts cannot be used for new vouchers.");
    if (v.status === "posted") {
      for (const target of [bank!, ...(v.kind === "Transfer" ? [destination!] : [])]) {
        check(!target.openingDate || v.date >= target.openingDate, "Voucher date cannot precede the bank opening balance date.");
      }
      if (v.ledgerAccountId && (!old || old.status !== "posted")) check(v.ledgerAccountId === (bank!.ledgerAccountId || sharedBankLedger(s)?.id), "Voucher ledger must match its bank account.");
      if (v.toLedgerAccountId && v.kind === "Transfer" && (!old || old.status !== "posted")) check(v.toLedgerAccountId === (destination!.ledgerAccountId || sharedBankLedger(s)?.id), "Destination ledger must match its bank account.");
      check(!!sharedBankLedger(s) || !!bank!.ledgerAccountId, "Create or classify the shared Bank account under Assets before posting.");
      for (const line of bankVoucherLines(s, v)) {
        const account = chart.find(a => a.id === line.accountId);
        check(!!account && account.type !== "Unclassified" && !chart.some(a => a.parentId === account.id), "Post to classified subaccounts.");
        check(!account!.openingDate || v.date >= account!.openingDate, "Voucher date cannot precede the opening balance date.");
      }
      check(typeof v.postedAt === "string" && Number.isFinite(Date.parse(v.postedAt)), "Missing posting time.");
    } else check(v.postedAt === undefined, "Draft vouchers cannot have a posting time.");
  }
  if (before) {
    for (const old of before.bankVouchers || []) {
      const next = s.bankVouchers?.find(v => v.id === old.id);
      check(!!next, "Bank vouchers cannot be deleted.");
      check(next!.number === old.number && next!.createdAt === old.createdAt, "Voucher identity cannot change.");
      if (old.status === "posted") check(JSON.stringify(next) === JSON.stringify(old), "Posted bank vouchers are locked.");
    }
    for (const old of before.financialAccounts || []) {
      const next = banks.find(a => a.id === old.id);
      check(!!next && next.name === old.name && next.type === old.type, "Keep historical payment accounts; deactivate them instead of removing or renaming them.");
      const used = (before.bankVouchers || []).some(v => v.status === "posted" && (v.accountId === old.id || v.toAccountId === old.id)) ||
        (before.journals || []).some(v => v.status === "posted" && v.lines.some(l => l.accountId === old.ledgerAccountId));
      if (used) check(next!.ledgerAccountId === old.ledgerAccountId, "The ledger link is locked after posting.");
      check(next!.createdAt === old.createdAt, "Bank creation time is immutable.");
      check(next!.openingBalance === old.openingBalance && next!.openingDate === old.openingDate, "Bank opening balances are locked after account creation; use a dated voucher to adjust balances.");
    }
    const usedAccounts = new Set((before.bankVouchers || []).filter(v => v.status === "posted").flatMap(v => bankVoucherLines(before, v).map(l => l.accountId)));
    for (const id of usedAccounts) {
      const old = chartAccounts(before).find(a => a.id === id), next = chart.find(a => a.id === id);
      check(!!old && !!next && old.type === next.type && old.nature === next.nature && old.openingBalance === next.openingBalance && old.openingDate === next.openingDate, "Opening balance and classification are locked for accounts with posted bank vouchers.");
    }
  }
  for (const voucher of s.journals || []) {
    const old = before?.journals?.find(v => v.id === voucher.id);
    if (before && voucher.status === "posted" && (!old || JSON.stringify(old) !== JSON.stringify(voucher))) {
      for (const line of voucher.lines) {
        const linked = banks.filter(a => a.ledgerAccountId === line.accountId);
        const bank = line.financialAccountId ? banks.find(a => a.id === line.financialAccountId) : linked.length === 1 ? linked[0] : undefined;
        check(!line.financialAccountId || !!bank && bank.ledgerAccountId === line.accountId, "Invalid bank sub-ledger reference.");
        check(linked.length === 0 || !!line.financialAccountId, "Select the bank or wallet for a shared Bank journal line.");
        check(!bank || bank.active !== false, "Inactive banks cannot receive new journal entries.");
        check(!bank?.openingDate || voucher.date >= bank.openingDate, "Journal date cannot precede the bank opening balance date.");
      }
    }
  }
  for (const key of ["invoices", "purchases", "payments", "expenses"] as const) {
    for (const record of s[key]) {
      const bank = banks.find(a => a.id === record.financialAccountId);
      if (record.financialAccountId) check(!!bank && (bank.name === record.method || record.method === "Cheque"), "Invalid payment account reference.");
      const named = bank || banks.find(a => a.name === record.method);
      const old = before?.[key].find(a => a.id === record.id);
      if (before && (!old || JSON.stringify(old) !== JSON.stringify(record)) && named) check(named.active !== false, "Inactive payment accounts cannot be used for new transactions.");
    }
  }
}
export function saveBankVoucher(s: Store, voucher: BankVoucher, post = false): Store {
  const previous = s.bankVouchers?.find(v => v.id === voucher.id);
  check(!previous || previous.status === "draft", "Posted bank vouchers cannot be edited.");
  const saved = { ...voucher, ledgerAccountId: voucher.ledgerAccountId || s.financialAccounts?.find(a => a.id === voucher.accountId)?.ledgerAccountId || sharedBankLedger(s)?.id, toLedgerAccountId: voucher.kind === "Transfer" ? voucher.toLedgerAccountId || s.financialAccounts?.find(a => a.id === voucher.toAccountId)?.ledgerAccountId || sharedBankLedger(s)?.id : undefined, number: previous?.number || nextBankVoucherNumber(s), createdAt: previous?.createdAt || Date.now(), status: post ? "posted" as const : "draft" as const, postedAt: post ? new Date().toISOString() : undefined };
  const next = { ...s, bankVouchers: previous ? s.bankVouchers!.map(v => v.id === saved.id ? saved : v) : [...(s.bankVouchers || []), saved] };
  validateBanks(next, s);
  return next;
}
export function saveFinancialAccount(s: Store, account: FinancialAccount): Store {
  const shared = sharedBankLedger(s);
  const previous = s.financialAccounts?.find(a => a.id === account.id);
  const normalized = previous ? { ...account } : {
    ...account,
    createdAt: new Date((s.journals || []).filter(v => v.status === "posted").reduce((time, v) => Math.max(time, Date.parse(v.postedAt!) + 1), Date.now())).toISOString(),
    ledgerAccountId: account.ledgerAccountId || shared?.id,
    ...(account.ledgerAccountId ? {} : { openingBalance: account.openingBalance ?? 0, openingDate: account.openingDate ?? "" }),
  };
  const next = { ...s, financialAccounts: s.financialAccounts?.some(a => a.id === account.id) ? s.financialAccounts.map(a => a.id === account.id ? normalized : a) : [...(s.financialAccounts || []), normalized] };
  validateBanks(next, s);
  return next;
}
export function bankStatement(s: Store, account: FinancialAccount, from = "", to = "") {
  const ledger = chartAccounts(s).find(a => a.id === account.ledgerAccountId);
  const openingDate = account.openingBalance !== undefined ? account.openingDate || "" : ledger?.openingDate || "";
  const sharedOpening = !!ledger && ledger.id === sharedBankLedger(s)?.id && (s.financialAccounts || []).filter(bank => bank.ledgerAccountId === ledger.id && bank.openingBalance === undefined).length > 1;
  const openingAmount = account.openingBalance ?? (sharedOpening ? 0 : ledger?.openingBalance) ?? 0;
  const opening = (!to || !openingDate || openingDate <= to) ? openingAmount * (account.openingBalance === undefined && ledger?.nature === "Credit" ? -1 : 1) : 0;
  const rows = financialRows(s).filter(r => r.financialAccountId === account.id && (!to || r.date <= to) && (!openingDate || r.date >= openingDate));
  const before = from ? rows.filter(r => r.date < from).reduce((n, r) => n + r.bank, 0) : 0;
  const period = rows.filter(r => !from || r.date >= from);
  const receipts = round(period.reduce((n, r) => n + Math.max(0, r.bank), 0));
  const payments = round(period.reduce((n, r) => n + Math.max(0, -r.bank), 0));
  const openingAdjustment = from && openingDate && openingDate >= from ? opening : 0;
  const beginning = round(opening - openingAdjustment + before);
  return { opening: beginning, openingAdjustment, receipts, payments, closing: round(beginning + openingAdjustment + receipts - payments) };
}

/** All accounts, including inactive balances, plus explicitly unassigned bank movements. */
export function bankBalanceSummary(s: Store, through = today()) {
  const balances = (s.financialAccounts || []).map(account => ({ ...account, balance: bankStatement(s, account, "", through).closing }));
  const ledger = sharedBankLedger(s);
  const inherited = (s.financialAccounts || []).filter(bank => bank.ledgerAccountId === ledger?.id && bank.openingBalance === undefined);
  const unallocatedOpening = ledger && inherited.length !== 1 && (!ledger.openingDate || (!through || ledger.openingDate <= through)) ? ledger.openingBalance * (ledger.nature === "Debit" ? 1 : -1) : 0;
  const unassigned = round(unallocatedOpening + financialRows(s).filter(row => !row.financialAccountId && (!through || row.date <= through)).reduce((sum, row) => sum + row.bank, 0));
  return { balances, unassigned, total: round(balances.reduce((sum, account) => sum + account.balance, 0) + unassigned) };
}

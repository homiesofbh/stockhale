import { bankVoucherLines, validateBanks } from "./bank-vouchers";
import { chartAccounts, type Account } from "./accounts";
import { round, type Store } from "./model";

export type JournalLine = { id: string; accountId: string; debit: number; credit: number; description: string };
export type JournalVoucher = {
  reversalOf?: string;
  id: string;
  number: string;
  date: string;
  reference: string;
  notes: string;
  status: "draft" | "posted";
  createdAt: number;
  postedAt?: string;
  lines: JournalLine[];
};
const check = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };
const cents = (amount: number) => Math.round(amount * 100);
const validAmount = (amount: number) => Number.isFinite(amount) && amount >= 0 && Number.isSafeInteger(cents(amount)) && round(amount) === amount;
export function journalTotals(lines: JournalLine[]) {
  const debit = lines.reduce((n, line) => n + cents(line.debit), 0);
  const credit = lines.reduce((n, line) => n + cents(line.credit), 0);
  return { debit: debit / 100, credit: credit / 100, difference: (debit - credit) / 100 };
}
export function nextJournalNumber(s: Store) {
  const maximum = (s.journals || []).reduce((max, journal) => {
    const match = /^JV-(\d+)$/.exec(journal.number);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `JV-${String(maximum + 1).padStart(5, "0")}`;
}

export function validateJournals(s: Store, before?: Store) {
  const accounts = chartAccounts(s);
  const ids = new Set<string>(), numbers = new Set<string>();
  for (const voucher of s.journals || []) {
    check(typeof voucher.id === "string" && !!voucher.id && !ids.has(voucher.id), "Journal IDs must be unique."); ids.add(voucher.id);
    check(typeof voucher.number === "string" && /^JV-\d+$/.test(voucher.number) && !numbers.has(voucher.number), "Journal numbers must be unique."); numbers.add(voucher.number);
    check(typeof voucher.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(voucher.date) && Number.isFinite(Date.parse(voucher.date)) && new Date(voucher.date).toISOString().slice(0, 10) === voucher.date, "Enter a valid journal date.");
    check(["draft", "posted"].includes(voucher.status), "Invalid journal status.");
    check(Number.isFinite(voucher.createdAt) && voucher.createdAt > 0, "Invalid journal creation time.");
    check(typeof voucher.reference === "string" && voucher.reference.length <= 200 && typeof voucher.notes === "string" && voucher.notes.length <= 2000, "Invalid journal reference or notes.");
    check(Array.isArray(voucher.lines) && voucher.lines.length >= 2 && voucher.lines.length <= 100, "A journal needs between 2 and 100 lines.");
    const lineIds = new Set<string>();
    for (const line of voucher.lines) {
      check(typeof line.id === "string" && !!line.id && !lineIds.has(line.id), "Journal line IDs must be unique."); lineIds.add(line.id);
      const account = accounts.find(a => a.id === line.accountId);
      check(!!account, "Select an existing account for every journal line.");
      check(validAmount(line.debit) && validAmount(line.credit) && !(line.debit > 0 && line.credit > 0), "Each line must have a debit or credit, with at most two decimal places.");
      check(typeof line.description === "string" && line.description.length <= 500, "Line description is too long.");
      if (voucher.status === "posted") {
        check(line.debit > 0 || line.credit > 0, "Every posted line must have an amount.");
        check(account!.type !== "Unclassified", "Classify every account before posting a journal.");
        check(!accounts.some(a => a.parentId === account!.id), "Post to a subaccount rather than its parent account.");
        check(!account!.openingDate || voucher.date >= account!.openingDate, "Journal date cannot precede the account opening date.");
      }
    }
    const totals = journalTotals(voucher.lines);
    check(Number.isSafeInteger(cents(totals.debit)) && Number.isSafeInteger(cents(totals.credit)), "Journal total is too large.");
    if (voucher.status === "posted") {
      check(totals.debit > 0 && totals.difference === 0, "Debits and credits must balance before posting.");
      check(typeof voucher.postedAt === "string" && Number.isFinite(Date.parse(voucher.postedAt)), "Missing journal posting time.");
    } else check(voucher.postedAt === undefined, "A draft cannot have a posting time.");
  }
  if (before) {
    for (const previous of before.journals || []) {
      const next = s.journals?.find(v => v.id === previous.id);
      check(!!next, "Journal vouchers cannot be deleted.");
      check(next!.number === previous.number && next!.createdAt === previous.createdAt, "Journal identity cannot be changed.");
      if (previous.status === "posted") check(JSON.stringify(next) === JSON.stringify(previous), "Posted journals are locked. Use a correction voucher.");
    }
    for (const oldAccount of chartAccounts(before)) {
      const used = (before.journals || []).some(v => v.status === "posted" && v.lines.some(l => l.accountId === oldAccount.id));
      if (!used) continue;
      const next = accounts.find(a => a.id === oldAccount.id);
      check(!!next && next.type === oldAccount.type && next.nature === oldAccount.nature && next.openingBalance === oldAccount.openingBalance && next.openingDate === oldAccount.openingDate, "Type, nature, and opening balance are locked for accounts with posted journals.");
    }
  }
}

export function saveJournal(s: Store, voucher: JournalVoucher, post = false): Store {
  const previous = s.journals?.find(v => v.id === voucher.id);
  check(!previous || previous.status === "draft", "Posted journals cannot be edited.");
  const journal: JournalVoucher = {
    ...voucher, number: previous?.number || nextJournalNumber(s), createdAt: previous?.createdAt || Date.now(),
    status: post ? "posted" : "draft", postedAt: post ? new Date().toISOString() : undefined,
  };
  const next = { ...s, journals: previous ? s.journals!.map(v => v.id === journal.id ? journal : v) : [...(s.journals || []), journal] };
  validateJournals(next, s);
  validateBanks(next, s);
  return next;
}

/** Journal balances are debit-positive; a negative value is a credit balance. */
export function journalAccountBalance(s: Store, account: Account, through = "") {
  const opening = (!through || !account.openingDate || account.openingDate <= through)
    ? cents(account.openingBalance) * (account.nature === "Debit" ? 1 : -1) : 0;
  const bankLines = (s.bankVouchers || []).filter(v => v.status === "posted" && (!through || v.date <= through)).flatMap(v => bankVoucherLines(s, v));
  const movements = [...(s.journals || []).filter(v => v.status === "posted" && (!through || v.date <= through))
    .flatMap(v => v.lines), ...bankLines].filter(l => l.accountId === account.id)
    .reduce((n, l) => n + cents(l.debit) - cents(l.credit), 0);
  return (opening + movements) / 100;
}

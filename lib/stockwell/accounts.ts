import { validateBanks } from "./bank-vouchers";
import { validateJournals } from "./journals";
import { round, type Store } from "./model";

export const accountTypes = ["Asset", "Liability", "Equity", "Income", "Expense", "Unclassified"] as const;
export type Account = {
  id: string;
  code: string;
  name: string;
  parentId: string;
  type: (typeof accountTypes)[number];
  nature: "Debit" | "Credit";
  openingBalance: number;
  openingDate: string;
  description: string;
};

const legacyAccountDefaults: Record<string, Account["type"]> = {
  sales: "Income", purchases: "Expense", expenses: "Expense",
  cash: "Asset", bank: "Asset", receivables: "Asset", payables: "Liability",
  "supplier payments": "Liability", "customer payments": "Asset",
  "other income": "Income", "other expenses": "Expense",
};

/** Stable legacy IDs preserve name-based transaction links without a data rewrite. */
export function chartAccounts(s: Store): Account[] {
  const records = s.accounts || [];
  return [...records, ...s.heads.map((name, i): Account => ({
    id: `legacy:${name}`, code: `L${String(i + 1).padStart(4, "0")}`, name,
    parentId: "", type: legacyAccountDefaults[name.trim().toLocaleLowerCase()] || "Unclassified",
    nature: ["Liability", "Equity", "Income"].includes(legacyAccountDefaults[name.trim().toLocaleLowerCase()] || "Unclassified") ? "Credit" : "Debit", openingBalance: 0,
    openingDate: "", description: "",
  })).filter(a => !records.some(record => record.name === a.name))];
}

const fail = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };
export function validateAccounts(s: Store, before?: Store) {
  const accounts = chartAccounts(s);
  const ids = new Set<string>(), codes = new Set<string>(), names = new Set<string>();
  for (const a of accounts) {
    fail(typeof a.id === "string" && !!a.id.trim() && !ids.has(a.id), "Account IDs must be unique."); ids.add(a.id);
    fail(typeof a.code === "string" && /^[A-Za-z0-9]+([.-][A-Za-z0-9]+)*$/.test(a.code) && !codes.has(a.code.toLowerCase()), "Enter a unique account code using letters, numbers, dots, or hyphens."); codes.add(a.code.toLowerCase());
    fail(typeof a.name === "string" && !!a.name.trim() && a.name === a.name.trim() && !names.has(a.name.toLowerCase()), "Enter a unique account name."); names.add(a.name.toLowerCase());
    fail(accountTypes.includes(a.type) && ["Debit", "Credit"].includes(a.nature), "Select an account type and balance nature.");
    fail(Number.isFinite(a.openingBalance) && a.openingBalance >= 0 && round(a.openingBalance) === a.openingBalance, "Opening balance must be a nonnegative amount with at most two decimals.");
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(a.openingDate) && !Number.isNaN(Date.parse(a.openingDate)) && new Date(a.openingDate).toISOString().slice(0, 10) === a.openingDate;
    fail((!a.openingDate && a.openingBalance === 0) || validDate, "Enter a valid opening balance date.");
    fail(typeof a.description === "string" && a.description.length <= 2000 && typeof a.parentId === "string", "Invalid account details.");
    if (a.parentId) {
      const parent = accounts.find(p => p.id === a.parentId);
      fail(!!parent && parent.id !== a.id, "Select a valid parent account.");
      fail(parent!.type === a.type, "A child account must have the same type as its parent.");
      fail(a.code.startsWith(`${parent!.code}.`) || a.code.startsWith(`${parent!.code}-`), "Child code must start with its parent code followed by a dot or hyphen.");
    }
    const seen = new Set([a.id]);
    let parentId = a.parentId;
    while (parentId) {
      fail(!seen.has(parentId), "Account hierarchy cannot contain a cycle."); seen.add(parentId);
      parentId = accounts.find(p => p.id === parentId)?.parentId || "";
    }
  }
  if (s.accounts) {
    fail(s.accounts.every(a => s.heads.includes(a.name)), "Every account must have a matching account head.");
  }
  if (before) {
    for (const old of before.accounts || []) {
      fail(!!s.accounts?.some(a => a.id === old.id), "Existing account records cannot be removed.");
    }
    for (const old of chartAccounts(before)) {
      const next = accounts.find(a => a.id === old.id);
      fail(!!next && next.name === old.name, "Existing accounts cannot be removed or renamed; historical head links must be preserved.");
    }
  }
}

export function saveAccount(s: Store, account: Account): Store {
  const accounts = chartAccounts(s);
  const existing = accounts.find(a => a.id === account.id);
  const next: Store = {
    ...s,
    heads: existing ? s.heads : [...s.heads, account.name.trim()],
    accounts: existing ? accounts.map(a => a.id === account.id ? { ...account, name: account.name.trim() } : a) : [...accounts, { ...account, name: account.name.trim() }],
  };
  validateAccounts(next, s);
  validateJournals(next, s);
  validateBanks(next, s);
  return next;
}

export function accountPath(accounts: Account[], account: Account): string {
  const names = [account.name], seen = new Set([account.id]);
  let parent = accounts.find(a => a.id === account.parentId);
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id); names.unshift(parent.name);
    parent = accounts.find(a => a.id === parent!.parentId);
  }
  return names.join(" / ");
}

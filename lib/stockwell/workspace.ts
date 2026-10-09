import { validateOperations, type ValidationContext } from "./operation-validation";
import { validateBanks } from "./bank-vouchers";
import { validateJournals } from "./journals";
import { validateAccounts } from "./accounts";
import type { Store } from "./model";
export const modules = [
  "Dashboard",
  "Inventory",
  "Purchases",
  "Billing",
  "Sales",
  "Accounts Heads",
  "Expenses",
  "Payments",
  "Suppliers",
  "Customers",
  "Returns & Damage",
  "Reports",
] as const;
export type Member = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "member";
  modules: string[];
};
export function canAccessModule(member: Member, module: string) {
  if (module === "Settings" || module === "Notifications") return member.role === "owner";
  return modules.includes(module as (typeof modules)[number]) &&
    (member.role === "owner" || member.modules.includes(module));
}
/** Resolve before rendering, including the initial load and permission changes. */
export function accessibleModule(member: Member, requested: string): string | null {
  if (canAccessModule(member, requested)) return requested;
  return modules.find((module) => canAccessModule(member, module)) || null;
}
export type Audit = {
  id: string;
  actor: string;
  module: string;
  action: string;
  records: string;
  occurredAt: string;
  receivedAt: string;
  emailStatus: string;
};
export type Workspace = {
  id: string;
  name: string;
  image: string;
  revision: number;
  store: Store;
  member: Member;
  members: Member[];
  audit: Audit[];
  readEvent?: string;
  emailConfigured: boolean;
};
export type Change = {
  actorId: string;
  id: string;
  module: string;
  action: string;
  occurredAt: string;
  store: Store;
};
export type Cache = { workspace: Workspace; queue: Change[]; revision: number };
export const cacheKey = (id: string) => `stockwell.workspace.${id}`;
export const collectionModules: Record<string, string[]> = {
  products: ["Inventory", "Purchases"],
  categories: ["Inventory"],
  units: ["Inventory"],
  movements: ["Inventory", "Purchases", "Billing", "Returns & Damage"],
  customers: ["Customers", "Billing"],
  suppliers: ["Suppliers"],
  heads: ["Accounts Heads"],
  accounts: ["Accounts Heads"],
  journals: ["Accounts Heads"],
  bankVouchers: ["Payments"],
  corrections: ["Billing", "Purchases"],
  walkInLinks: ["Billing"],
  chequeEvents: ["Payments"],
  dailyCloses: ["Reports"],
  financialAccounts: ["Accounts Heads", "Payments", "Billing", "Purchases", "Expenses"],
  expenseCategories: ["Expenses"],
  purchases: ["Purchases"],
  invoices: ["Billing"],
  payments: ["Payments", "Billing", "Purchases"],
  expenses: ["Expenses"],
  returns: ["Returns & Damage"],
  partners: ["Accounts Heads"],
};
export function changesBetween(before: Store, after: Store) {
  return Object.keys(collectionModules).filter(
    (k) =>
      JSON.stringify(before[k as keyof Store] ?? []) !==
      JSON.stringify(after[k as keyof Store] ?? []),
  );
}
export function verifyChange(before: Store, after: Store, module: string, context?: ValidationContext) {
  if (!modules.includes(module as (typeof modules)[number]))
    throw new Error("Unknown module.");
  if (
    !after ||
    after.version !== 1 ||
    Object.keys(after).some((k) => k !== "version" && !collectionModules[k])
  )
    throw new Error("Invalid records.");
  for (const key of Object.keys(collectionModules))
    if (after[key as keyof Store] !== undefined && !Array.isArray(after[key as keyof Store]))
      throw new Error("Invalid record collection.");
  const changed = changesBetween(before, after);
  if (!changed.length) throw new Error("No records changed.");
  if (changed.some((k) => !collectionModules[k].includes(module)))
    throw new Error("This module cannot change those records.");
  if (changed.includes("accounts") || changed.includes("heads")) validateAccounts(after, before);
  if (changed.includes("journals") || changed.includes("accounts") || changed.includes("heads")) validateJournals(after, before);
  validateBanks(after, before);
  if (context) validateOperations(before, after, module, context);
  return changed
    .map(
      (k) =>
        `${k}: ${JSON.stringify(after[k as keyof Store]) === JSON.stringify(before[k as keyof Store]) ? "unchanged" : recordDiff((before[k as keyof Store] ?? []) as unknown[], (after[k as keyof Store] ?? []) as unknown[])}`,
    )
    .join("; ");
}
function recordDiff(a: unknown[], b: unknown[]) {
  const ids = (items: unknown[]) =>
    new Map(
      items.map((v) => [
        typeof v === "object" && v !== null && "id" in v
          ? String(v.id)
          : String(v),
        JSON.stringify(v),
      ]),
    );
  const old = ids(a),
    next = ids(b);
  return [...new Set([...old.keys(), ...next.keys()])]
    .filter((id) => old.get(id) !== next.get(id))
    .map(
      (id) =>
        `${!old.has(id) ? "added" : !next.has(id) ? "removed" : "updated"} ${id}${old.has(id) && next.has(id) ? fieldDiff(old.get(id)!, next.get(id)!) : ` (${next.get(id) || old.get(id)})`}`,
    )
    .join(", ");
}

function fieldDiff(a: string, b: string) {
  const before = JSON.parse(a),
    after = JSON.parse(b);
  if (
    typeof before !== "object" ||
    before === null ||
    typeof after !== "object" ||
    after === null
  )
    return ` (${a} → ${b})`;
  return (
    " (" +
    [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      .map(
        (k) =>
          `${k}: ${JSON.stringify(before[k])} → ${JSON.stringify(after[k])}`,
      )
      .join(", ") +
    ")"
  );
}

function recordLabel(raw:string){const value=JSON.parse(raw);if(typeof value!=="object"||!value)return "";const fields=["name","number","date","productId","tradeId","qty","amount","reason","notes"].filter(k=>value[k]!==undefined&&value[k]!=="");return fields.length?" ("+fields.map(k=>`${k}: ${String(value[k]).slice(0,100)}`).join(", ")+")":"";}

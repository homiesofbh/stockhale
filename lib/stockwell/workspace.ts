import { validateOperations, type ValidationContext } from "./operation-validation";
import { validateBanks } from "./bank-vouchers";
import { validateJournals } from "./journals";
import { validateAccounts } from "./accounts";
import { normalizeStore, type Store } from "./model";
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
  "Closing",
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
  // Closing can lock a day and prevent new or corrected entries before that date.
  // It is deliberately separate from the read-only reporting permission.
  if (module === "Closing") return member.role === "owner";
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
  /** Browser-provided, approximate coordinates at the time of the action. */
  location?: string;
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
  trial?: { startedAt: string | null; endsAt: string | null; active: boolean; planActive: boolean };
  locked?: boolean;
};
export type Change = {
  actorId: string;
  id: string;
  module: string;
  action: string;
  occurredAt: string;
  location?: string;
  store: Store;
};
export type Cache = { workspace: Workspace; queue: Change[]; revision: number; baseStore?: Store; version?: number };
export const cacheKey = (id: string) => `stockwell.workspace.${id}`;
export function prepareSyncChange(before: Store, change: Change, context: ValidationContext) {
  const store = normalizeStore(change.store);
  const records = verifyChange(normalizeStore(before), store, change.module, context);
  return { store, records };
}
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
  dailyCloses: ["Reports", "Closing"],
  financialAccounts: ["Accounts Heads", "Payments", "Billing", "Purchases", "Expenses"],
  expenseCategories: ["Expenses"],
  purchases: ["Purchases"],
  invoices: ["Billing"],
  // A return can create an automatic refund payment for the linked bill.
  payments: ["Payments", "Billing", "Purchases", "Returns & Damage"],
  expenses: ["Expenses"],
  returns: ["Returns & Damage"],
  // Payments owns this workflow. Accounts Heads remains accepted only so an
  // already-queued entry from the previous screen can sync safely.
  partners: ["Payments", "Accounts Heads"],
  partnerNames: ["Payments", "Accounts Heads"],
  crossCheques: ["Payments"],
};
export const recordCollectionLabels: Record<string, string> = {
  products: "products", categories: "product categories", units: "units",
  movements: "stock movements", customers: "customers", suppliers: "suppliers",
  heads: "account heads", accounts: "accounts", journals: "journal vouchers",
  bankVouchers: "bank vouchers", corrections: "bill corrections",
  walkInLinks: "customer links", chequeEvents: "cheque history",
  dailyCloses: "daily closings", financialAccounts: "bank and payment accounts",
  expenseCategories: "expense categories", purchases: "purchase bills",
  invoices: "sales bills", payments: "payments", expenses: "expenses",
  returns: "returns", partners: "partner capital movements", crossCheques: "forwarded cheques",
  partnerNames: "partner names",
};
/** Replay device edits over the latest server snapshot without overwriting concurrent edits. */
export function recoverPendingQueue(cache: Cache, server: Workspace): Cache {
  if (cache.workspace.id !== server.id) throw new Error("Sign in to the workspace that created these changes.");
  let merged = normalizeStore(server.store);
  let previous = cache.baseStore ? normalizeStore(cache.baseStore) : null;
  const queue: Change[] = [];
  for (const change of cache.queue) {
    if (change.actorId !== server.member.id) throw new Error("Sign in as the person who saved these changes.");
    if (!canAccessModule(server.member, change.module)) throw new Error(`Ask the owner to restore your ${change.module} permission.`);
    const local = normalizeStore(change.store);
    const next = { ...merged };
    type MergeRecord = string | { id: string };
    const recordKey = (record: MergeRecord) => typeof record === "string" ? record : record.id;
    for (const key of Object.keys(collectionModules) as (keyof Store)[]) {
      // Legacy caches lack a baseline. Only recover additions in the first
      // change's module; never infer deletions or overwrite existing records.
      if (!previous && !collectionModules[key].includes(change.module)) {
        const records = (local[key] || []) as MergeRecord[];
        const remote = new Map(((merged[key] || []) as MergeRecord[]).map(record => [recordKey(record), record]));
        if (records.some(record => JSON.stringify(record) !== JSON.stringify(remote.get(recordKey(record)))))
          throw new Error(`The original server snapshot is unavailable and ${recordCollectionLabels[key] || key} differ outside ${change.module}. Export the queue for review; your pending changes have been preserved.`);
        continue;
      }
      const before = new Map(((previous?.[key] || []) as MergeRecord[]).map(record => [recordKey(record), record]));
      const after = new Map(((local[key] || []) as MergeRecord[]).map(record => [recordKey(record), record]));
      const remote = new Map(((merged[key] || []) as MergeRecord[]).map(record => [recordKey(record), record]));
      if (!previous && [...remote.keys()].some(id => !after.has(id)))
        throw new Error(`The original server snapshot is unavailable, so missing ${recordCollectionLabels[key] || key} cannot be distinguished from local deletions. Export the queue for review; your pending changes have been preserved.`);
      for (const id of new Set([...before.keys(), ...after.keys()])) {
        const old = before.get(id), edited = after.get(id), current = remote.get(id);
        if (JSON.stringify(old) === JSON.stringify(edited)) continue;
        if (JSON.stringify(current) === JSON.stringify(edited)) continue;
        if (JSON.stringify(current) !== JSON.stringify(old))
          throw new Error(`Both this device and the server have different ${recordCollectionLabels[key] || key} (${id}). Export the pending changes to review this record. Your queue has been preserved.`);
        if (edited) remote.set(id, edited); else remote.delete(id);
      }
      Object.assign(next, { [key]: [...remote.values()] });
    }
    if (changesBetween(merged, next).length) {
      verifyChange(merged, next, change.module, { actor: server.member, occurredAt: change.occurredAt, receivedAt: new Date().toISOString() });
      queue.push({ ...change, store: next });
    }
    merged = next;
    previous = local;
  }
  return { workspace: { ...server, store: merged }, queue, revision: server.revision, baseStore: normalizeStore(server.store) };
}
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
  const forbidden = changed.filter((k) => !collectionModules[k].includes(module));
  if (forbidden.length)
    throw new Error(`This module cannot change those records. ${module} cannot update ${forbidden.map(key => recordCollectionLabels[key] || key).join(", ")}. Review the pending change's module before retrying.`);
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

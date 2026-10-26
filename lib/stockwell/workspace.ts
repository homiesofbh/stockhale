import { validateOperations, type ValidationContext } from "./operation-validation";
import { validateBanks } from "./bank-vouchers";
import { validateJournals } from "./journals";
import { validateAccounts } from "./accounts";
import { normalizeStore, type Store } from "./model";

/* ==========================================================================
 * 1. MODULES & PERMISSIONS
 * Which app modules exist, and who may open them.
 * ========================================================================== */

/** Every module a member can be granted access to (Settings/Notifications are owner-only and handled separately). */
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
  /** Modules this member was explicitly granted (ignored for owners). */
  modules: string[];
};

/**
 * Permission check for a single module.
 * - Settings & Notifications: owner only.
 * - Any other known module: owners always, members only if granted.
 * - Unknown module names are always denied.
 */
export function canAccessModule(member: Member, module: string) {
  if (module === "Settings" || module === "Notifications") return member.role === "owner";
  return modules.includes(module as (typeof modules)[number]) &&
    (member.role === "owner" || member.modules.includes(module));
}

/**
 * Resolve before rendering, including the initial load and permission changes.
 * Returns the requested module if allowed, otherwise the first module the
 * member can open, or null if they can open none.
 */
export function accessibleModule(member: Member, requested: string): string | null {
  if (canAccessModule(member, requested)) return requested;
  return modules.find((module) => canAccessModule(member, module)) || null;
}

/* ==========================================================================
 * 2. TYPES
 * Shapes of the audit log, workspace snapshot, offline change, and local cache.
 * ========================================================================== */

/** One audit-log entry describing who changed what, and when. */
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

/** Full workspace snapshot as returned by the server. */
export type Workspace = {
  id: string;
  name: string;
  image: string;
  timeZone: string;
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

/** A single edit made by a member: the module used and the full resulting store. */
export type Change = {
  actorId: string;
  id: string;
  module: string;
  action: string;
  occurredAt: string;
  location?: string;
  store: Store;
};

/**
 * What the device keeps locally: the last server snapshot, the queue of
 * unsynced changes, and baseStore (the server store those changes were made on,
 * used later as the merge baseline).
 */
export type Cache = {
  workspace: Workspace;
  queue: Change[];
  /** Queue entries known to have a record-level conflict on the latest server snapshot. */
  blockedChangeIds?: string[];
  revision: number;
  baseStore?: Store;
  version?: number;
};

/** localStorage key for a workspace's cache. */
export const cacheKey = (id: string) => `stockhale.workspace.${id}`;

/* ==========================================================================
 * 3. SYNC ENTRY POINT
 * ========================================================================== */

/**
 * Validates an incoming change against the previous store.
 * Returns the normalized new store and a human-readable summary of the record
 * differences (used for the audit log).
 */
export function prepareSyncChange(before: Store, change: Change, context: ValidationContext) {
  // Resolve a bill-reference collision against the authoritative snapshot
  // before validation. This also handles clients that submit a colliding
  // reference directly instead of first receiving a revision-mismatch and
  // running client-side queue recovery.
  const store = resolveTradeReferenceCollisions(
    normalizeStore(before),
    normalizeStore(change.store),
  );
  const records = verifyChange(normalizeStore(before), store, change.module, context);
  const renumbered = (["invoices", "purchases"] as const).flatMap(key =>
    store[key].flatMap(trade => {
      const old = before[key].find(item => item.id === trade.id);
      const newAliases = (trade.previousNumbers || []).filter(number => !old?.previousNumbers?.includes(number));
      return newAliases.map(number => `${key === "invoices" ? "Invoice" : "Purchase"} reference reassigned ${number} → ${trade.number} because the original reference was already in use.`);
    }),
  );
  return { store, records: renumbered.length ? `${records}; ${renumbered.join("; ")}` : records };
}

/* ==========================================================================
 * 4. COLLECTION RULES
 * Which module(s) may modify each record collection, plus display labels.
 * ========================================================================== */

/** Collection name -> modules allowed to change it. Used to reject out-of-scope edits. */
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
  corrections: ["Billing", "Purchases"],
  walkInLinks: ["Billing"],
  chequeEvents: ["Payments"],
  dailyCloses: ["Reports", "Closing"],
  bankVouchers: ["Payments", "Closing"],
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

/** Collection name -> friendly label used in error messages. */
export const recordCollectionLabels: Record<string, string> = {
  products: "products",
  categories: "product categories",
  units: "units",
  movements: "stock movements",
  customers: "customers",
  suppliers: "suppliers",
  heads: "account heads",
  accounts: "accounts",
  journals: "journal vouchers",
  bankVouchers: "bank vouchers",
  corrections: "bill corrections",
  walkInLinks: "customer links",
  chequeEvents: "cheque history",
  dailyCloses: "daily closings",
  financialAccounts: "bank and payment accounts",
  expenseCategories: "expense categories",
  purchases: "purchase bills",
  invoices: "sales bills",
  payments: "payments",
  expenses: "expenses",
  returns: "returns",
  partners: "partner capital movements",
  crossCheques: "forwarded cheques",
  partnerNames: "partner names",
};

/* ==========================================================================
 * 5. BILL NUMBER COLLISION HANDLING
 * ========================================================================== */

/**
 * Give a rebased offline bill a new reference when another device already used it.
 *
 * Example: two devices offline both create "INV-00012". The first to sync wins;
 * when the second is rebased onto the server, its bill is renumbered (e.g.
 * "INV-00013") and its stock movements are updated to point at the new number.
 */
export function resolveTradeReferenceCollisions(server: Store, candidate: Store): Store {
  // Work on shallow copies so the candidate store is never mutated.
  let result = {
    ...candidate,
    invoices: [...candidate.invoices],
    purchases: [...candidate.purchases],
    movements: [...candidate.movements],
  };

  // Ids of bills the server already has (these are never renumbered).
  const serverIds = new Set([
    ...server.invoices.map((trade) => trade.id),
    ...server.purchases.map((trade) => trade.id),
  ]);

  // Stock movements created on this device only; only these may have their reference rewritten.
  const localMovementIds = new Set(
    candidate.movements
      .filter((movement) => !server.movements.some((old) => old.id === movement.id))
      .map((movement) => movement.id),
  );

  // All bill numbers in use, and the highest numeric part ("INV-00012" -> 12) to continue from.
  const used = new Set([...result.invoices, ...result.purchases].map((trade) => trade.number));
  // Invoice and purchase references share one uniqueness constraint.
  const seen = new Set([...server.invoices, ...server.purchases].map((trade) => trade.number));
  let nextNumber = (number: string) => Number(number.split("-")[1]) || 0;
  let sequence = Math.max(...Array.from(used, nextNumber), 0);

  for (const key of ["invoices", "purchases"] as const) {
    const prefix = key === "invoices" ? "INV" : "PUR";
    result[key] = result[key].map((trade) => {
      // Keep the bill if the server already has it, or its number is free.
      if (serverIds.has(trade.id) || !seen.has(trade.number)) {
        seen.add(trade.number);
        return trade;
      }

      // Collision: allocate the next unused number, e.g. INV-00013.
      const oldNumber = trade.number;
      let number = "";
      do {
        sequence += 1;
        number = `${prefix}-${String(sequence).padStart(5, "0")}`;
      } while (used.has(number));
      used.add(number);
      seen.add(number);

      // Re-point this device's stock movements from the old number to the new one.
      result.movements = result.movements.map((movement) =>
        localMovementIds.has(movement.id) &&
        movement.type === (key === "invoices" ? "Sale" : "Purchase") &&
        movement.reference === oldNumber
          ? { ...movement, reference: number }
          : movement,
      );
      return {
        ...trade,
        number,
        previousNumbers: [...new Set([...(trade.previousNumbers || []), oldNumber])],
      };
    });
  }
  return result;
}

/* ==========================================================================
 * 6. OFFLINE QUEUE RECOVERY (three-way merge)
 * ========================================================================== */

/**
 * Replay device edits over the latest server snapshot without overwriting concurrent edits.
 *
 * For every queued change it does a per-record three-way merge:
 *   old     = record in the baseline (what the device started from)
 *   edited  = record in the device's change
 *   current = record on the server now
 * and either applies the edit, skips it, or throws if both sides changed the same record.
 * Duplicate bill numbers are then fixed with resolveTradeReferenceCollisions.
 */
export function recoverPendingQueue(
  cache: Cache,
  server: Workspace,
  // useOccurredAt: skip the "late sync" clock rules during this local rebase only.
  // The server still enforces them when a change is actually sent.
  options: { useOccurredAt?: boolean } = {},
): Cache {
  // Guard: the cache must belong to this workspace and this signed-in member.
  if (cache.workspace.id !== server.id) throw new Error("Sign in to the workspace that created these changes.");

  let merged = normalizeStore(server.store); // running result, starts from the server
  let previous = cache.baseStore ? normalizeStore(cache.baseStore) : null; // merge baseline
  const queue: Change[] = []; // changes that still need syncing after the merge

  // These collections are append-only and are rejected by validateOperations
  // if a queued change tries to remove or edit an existing entry. When a
  // legacy cache has no baseStore, a record present on the server but absent
  // from the queued snapshot is therefore a server-side addition, not a
  // deletion made by this device. Preserve it so stale offline bill queues
  // can still be rebased safely.
  const appendOnlyCollections = new Set<keyof Store>([
    "invoices",
    "purchases",
    "payments",
    "movements",
    "returns",
    "expenses",
    "corrections",
    "chequeEvents",
    "partners",
    "dailyCloses",
  ]);

  for (const change of cache.queue) {
    if (change.actorId !== server.member.id) throw new Error("Sign in as the person who saved these changes.");
    if (!canAccessModule(server.member, change.module)) throw new Error(`Ask the owner to restore your ${change.module} permission.`);

    const local = normalizeStore(change.store);
    const next = { ...merged };

    type MergeRecord = string | { id: string };
    const recordKey = (record: MergeRecord) => (typeof record === "string" ? record : record.id);

    for (const key of Object.keys(collectionModules) as (keyof Store)[]) {
      // Legacy caches lack a baseline. Only recover additions in the first
      // change's module; never infer deletions or overwrite existing records.
      if (!previous && !collectionModules[key].includes(change.module)) {
        const records = (local[key] || []) as MergeRecord[];
        const remote = new Map(((merged[key] || []) as MergeRecord[]).map((record) => [recordKey(record), record]));
        if (records.some((record) => JSON.stringify(record) !== JSON.stringify(remote.get(recordKey(record)))))
          throw new Error(`The original server snapshot is unavailable and ${recordCollectionLabels[key] || key} differ outside ${change.module}. Export the queue for review; your pending changes have been preserved.`);
        continue;
      }

      // Index each version of this collection by record id.
      const before = new Map(((previous?.[key] || []) as MergeRecord[]).map((record) => [recordKey(record), record]));
      const after = new Map(((local[key] || []) as MergeRecord[]).map((record) => [recordKey(record), record]));
      const remote = new Map(((merged[key] || []) as MergeRecord[]).map((record) => [recordKey(record), record]));

      // Without a baseline, a server record missing locally could be a local delete or a new server record.
      // Append-only collections can't have deletes, so they are exempt (see appendOnlyCollections).
      if (!previous && !appendOnlyCollections.has(key) && [...remote.keys()].some((id) => !after.has(id)))
        throw new Error(`The original server snapshot is unavailable, so missing ${recordCollectionLabels[key] || key} cannot be distinguished from local deletions. Export the queue for review; your pending changes have been preserved.`);

      for (const id of new Set([...before.keys(), ...after.keys()])) {
        const old = before.get(id),
          edited = after.get(id),
          current = remote.get(id);
        if (JSON.stringify(old) === JSON.stringify(edited)) continue; // device didn't touch it
        if (JSON.stringify(current) === JSON.stringify(edited)) continue; // server already has this edit
        if (JSON.stringify(current) !== JSON.stringify(old))
          // Both sides changed the same record differently -> conflict.
          throw new Error(`Both this device and the server have different ${recordCollectionLabels[key] || key} (${id}). Export the pending changes to review this record. Your queue has been preserved.`);
        // Only the device changed it: apply the edit (or the deletion).
        if (edited) remote.set(id, edited);
        else remote.delete(id);
      }
      Object.assign(next, { [key]: [...remote.values()] });
    }

    // Renumber any bills whose reference clashes with one already on the server.
    const rebased = resolveTradeReferenceCollisions(merged, next);

    // Re-validate the merged result and keep the change only if it still changes something.
    if (changesBetween(merged, next).length) {
      verifyChange(merged, rebased, change.module, {
        actor: server.member,
        occurredAt: change.occurredAt,
        receivedAt: options.useOccurredAt ? change.occurredAt : new Date().toISOString(),
      });
      queue.push({ ...change, store: rebased });
    }
    merged = rebased;
    previous = local; // the next queued change was made on top of this one
  }

  return {
    workspace: { ...server, store: merged },
    queue,
    revision: server.revision,
    baseStore: normalizeStore(server.store),
  };
}

/**
 * Rebase every queued change independently and move only changes that can be
 * safely replayed ahead of blocked changes. Each sendable snapshot is rebuilt
 * from its own three-way delta, never copied from a later full-store snapshot.
 * Blocked snapshots remain local and carry the accepted/sendable edits so the
 * queue can continue from the confirmed server baseline after partial sync.
 */
export function recoverIndependentPendingQueue(cache: Cache, server: Workspace): Cache {
  if (cache.workspace.id !== server.id) throw new Error("Sign in to the workspace that created these changes.");
  if (!cache.baseStore || cache.queue.length < 2) {
    try { return { ...recoverPendingQueue(cache, server), blockedChangeIds: [] }; }
    catch { return { ...cache, blockedChangeIds: cache.queue.map(change => change.id) }; }
  }

  type RecordValue = string | { id: string };
  const keyOf = (value: RecordValue) => typeof value === "string" ? value : value.id;
  const overlayDelta = (target: Store, before: Store, edited: Store): Store => {
    let result = { ...target };
    for (const key of Object.keys(collectionModules) as (keyof Store)[]) {
      const baseRecords = (before[key] || []) as RecordValue[];
      const editedRecords = (edited[key] || []) as RecordValue[];
      const targetRecords = (result[key] || []) as RecordValue[];
      const base = new Map(baseRecords.map(record => [keyOf(record), record]));
      const after = new Map(editedRecords.map(record => [keyOf(record), record]));
      const merged = new Map(targetRecords.map(record => [keyOf(record), record]));
      for (const id of new Set([...base.keys(), ...after.keys()])) {
        if (JSON.stringify(base.get(id)) === JSON.stringify(after.get(id))) continue;
        const record = after.get(id);
        if (record === undefined) merged.delete(id);
        else merged.set(id, record);
      }
      Object.assign(result, { [key]: [...merged.values()] });
    }
    return normalizeStore(result);
  };

  let previous = normalizeStore(cache.baseStore);
  let merged = normalizeStore(server.store);
  const sendable: Change[] = [];
  const blocked: Array<{ change: Change; before: Store }> = [];
  const blockedRecordIds = new Set<string>();
  const referencesBlockedRecord = (before: Store, after: Store) => {
    const referenceFields = new Set(["productId", "contactId", "customerId", "supplierId", "tradeId", "sourcePaymentId", "paymentId", "financialAccountId", "accountId", "ledgerAccountId", "reversalOf", "variantOf", "parentId"]);
    const references = new Set<string>();
    const visit = (value: unknown) => {
      if (Array.isArray(value)) { value.forEach(visit); return; }
      if (!value || typeof value !== "object") return;
      for (const [key, item] of Object.entries(value)) {
        if (referenceFields.has(key) && typeof item === "string") references.add(item);
        else visit(item);
      }
    };
    for (const key of Object.keys(collectionModules) as (keyof Store)[]) {
      const oldRows = (before[key] || []) as RecordValue[];
      const newRows = (after[key] || []) as RecordValue[];
      const oldMap = new Map(oldRows.map(record => [keyOf(record), record]));
      const newMap = new Map(newRows.map(record => [keyOf(record), record]));
      for (const id of new Set([...oldMap.keys(), ...newMap.keys()])) {
        if (JSON.stringify(oldMap.get(id)) === JSON.stringify(newMap.get(id))) continue;
        const row = newMap.get(id);
        if (row && typeof row !== "string") visit(row);
      }
    }
    return [...references].some(id => blockedRecordIds.has(id));
  };
  const rememberBlockedRecords = (before: Store, after: Store) => {
    for (const key of Object.keys(collectionModules) as (keyof Store)[]) {
      const oldRows = (before[key] || []) as RecordValue[];
      const newRows = (after[key] || []) as RecordValue[];
      const oldMap = new Map(oldRows.map(record => [keyOf(record), record]));
      const newMap = new Map(newRows.map(record => [keyOf(record), record]));
      for (const id of new Set([...oldMap.keys(), ...newMap.keys()]))
        if (JSON.stringify(oldMap.get(id)) !== JSON.stringify(newMap.get(id))) blockedRecordIds.add(id);
    }
  };
  for (const change of cache.queue) {
    const before = previous;
    const local = normalizeStore(change.store);
    if (referencesBlockedRecord(before, local)) {
      blocked.push({ change, before });
      rememberBlockedRecords(before, local);
      previous = local;
      continue;
    }
    try {
      const recovered = recoverPendingQueue(
        { ...cache, workspace: { ...server, store: local }, queue: [change], baseStore: before },
        { ...server, store: merged },
      );
      if (recovered.queue[0]) {
        sendable.push(recovered.queue[0]);
        merged = normalizeStore(recovered.workspace.store);
      }
    } catch {
      blocked.push({ change, before });
      rememberBlockedRecords(before, local);
    }
    previous = local;
  }

  // Keep blocked work visible locally, but ensure each outgoing sendable item
  // above contains only its own delta and the already-rebased sendable prefix.
  const blockedQueue: Change[] = [];
  let blockedView = merged;
  for (const { change, before } of blocked) {
    blockedView = overlayDelta(blockedView, before, normalizeStore(change.store));
    blockedQueue.push({ ...change, store: blockedView });
  }

  return {
    ...cache,
    workspace: { ...server, store: cache.workspace.store },
    queue: [...sendable, ...blockedQueue],
    blockedChangeIds: blocked.map(({ change }) => change.id),
    revision: server.revision,
    baseStore: normalizeStore(server.store),
  };
}

/**
 * Plan dropping the first queued change when it can never be saved (for example
 * the server rejects it) and is blocking everything behind it.
 *
 * Each queued change is a full snapshot built on the one before it, so later
 * changes may depend on the dropped one. This drops the first change plus only
 * those later changes that cannot be replayed without it; every independent
 * change is rebased onto the server's records and kept.
 */
export function planHeadDrop(cache: Cache, server: Workspace): { cache: Cache; dropped: Change[] } {
  if (cache.workspace.id !== server.id) throw new Error("Sign in to the workspace that created these changes.");
  const [head, ...rest] = cache.queue;
  if (!head) throw new Error("There are no saved changes to drop.");
  if (head.actorId !== server.member.id) throw new Error("Sign in as the person who saved these changes.");

  const serverStore = normalizeStore(server.store);
  const dropped: Change[] = [head];
  const kept: Change[] = [];
  let merged = serverStore;
  // The baseline for each change is the previous change's own result,
  // whether or not that previous change is kept.
  let previous = normalizeStore(head.store);
  for (const change of rest) {
    try {
      const result = recoverPendingQueue(
        { ...cache, queue: [change], baseStore: previous },
        { ...server, store: merged },
        { useOccurredAt: true },
      );
      merged = normalizeStore(result.workspace.store);
      kept.push(...result.queue); // empty when the server already has this change
    } catch {
      dropped.push(change); // depends on a dropped change, or conflicts with the server
    }
    previous = normalizeStore(change.store);
  }
  return {
    cache: { workspace: { ...server, store: merged }, queue: kept, revision: server.revision, baseStore: serverStore },
    dropped,
  };
}

/* ==========================================================================
 * 7. CHANGE DETECTION & VALIDATION
 * ========================================================================== */

/** Names of the collections whose contents differ between two stores. */
export function changesBetween(before: Store, after: Store) {
  return Object.keys(collectionModules).filter(
    (k) =>
      JSON.stringify(before[k as keyof Store] ?? []) !==
      JSON.stringify(after[k as keyof Store] ?? []),
  );
}

/**
 * Full validation of a change. Throws on the first problem; otherwise returns
 * a readable summary of what changed. Checks, in order:
 *   1. module is known
 *   2. store has version 1, only known collections, all arrays
 *   3. something actually changed
 *   4. the module is allowed to edit every changed collection
 *   5. accounting rules (accounts, journals, bank vouchers)
 *   6. operation rules (only when a context is supplied)
 */
export function verifyChange(before: Store, after: Store, module: string, context?: ValidationContext) {
  if (!modules.includes(module as (typeof modules)[number]))
    throw new Error("Unknown module.");

  // Structure checks.
  if (
    !after ||
    after.version !== 1 ||
    Object.keys(after).some((k) => k !== "version" && !collectionModules[k])
  )
    throw new Error("Invalid records.");
  for (const key of Object.keys(collectionModules))
    if (after[key as keyof Store] !== undefined && !Array.isArray(after[key as keyof Store]))
      throw new Error("Invalid record collection.");

  // Must change something.
  const changed = changesBetween(before, after);
  if (!changed.length) throw new Error("No records changed.");

  // Module may only touch the collections it owns.
  const forbidden = changed.filter((k) => !collectionModules[k].includes(module));
  if (forbidden.length)
    throw new Error(`This module cannot change those records. ${module} cannot update ${forbidden.map((key) => recordCollectionLabels[key] || key).join(", ")}. Review the pending change's module before retrying.`);

  // Domain validators.
  if (changed.includes("accounts") || changed.includes("heads")) validateAccounts(after, before);
  if (changed.includes("journals") || changed.includes("accounts") || changed.includes("heads")) validateJournals(after, before);
  validateBanks(after, before);
  if (context) validateOperations(before, after, module, context);

  // Summary string, e.g. "invoices: added inv1 (...); payments: updated p2 (amount: 10 → 20)".
  return changed
    .map(
      (k) =>
        `${k}: ${
          JSON.stringify(after[k as keyof Store]) === JSON.stringify(before[k as keyof Store])
            ? "unchanged"
            : recordDiff((before[k as keyof Store] ?? []) as unknown[], (after[k as keyof Store] ?? []) as unknown[])
        }`,
    )
    .join("; ");
}

/* ==========================================================================
 * 8. DIFF HELPERS (produce the text stored in the audit log)
 * ========================================================================== */

/** Compares two record arrays by id and lists records as added / removed / updated. */
function recordDiff(a: unknown[], b: unknown[]) {
  // Map of record id -> serialized record (plain values use themselves as the id).
  const ids = (items: unknown[]) =>
    new Map(
      items.map((v) => [
        typeof v === "object" && v !== null && "id" in v ? String(v.id) : String(v),
        JSON.stringify(v),
      ]),
    );
  const old = ids(a),
    next = ids(b);

  return [...new Set([...old.keys(), ...next.keys()])]
    .filter((id) => old.get(id) !== next.get(id))
    .map(
      (id) =>
        `${!old.has(id) ? "added" : !next.has(id) ? "removed" : "updated"} ${id}${
          old.has(id) && next.has(id)
            ? fieldDiff(old.get(id)!, next.get(id)!) // updated: show field-level changes
            : ` (${next.get(id) || old.get(id)})` // added/removed: show the whole record
        }`,
    )
    .join(", ");
}

/** Field-by-field diff of two serialized records, e.g. " (amount: 10 → 20)". */
function fieldDiff(a: string, b: string) {
  const before = JSON.parse(a),
    after = JSON.parse(b);
  // Non-object values: just show old → new.
  if (typeof before !== "object" || before === null || typeof after !== "object" || after === null)
    return ` (${a} → ${b})`;
  return (
    " (" +
    [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      .map((k) => `${k}: ${JSON.stringify(before[k])} → ${JSON.stringify(after[k])}`)
      .join(", ") +
    ")"
  );
}

/**
 * Builds a short label like " (name: X, amount: 50)" from a serialized record.
 * NOTE: not called anywhere in this file; it may be used elsewhere or be dead code.
 */
function recordLabel(raw: string) {
  const value = JSON.parse(raw);
  if (typeof value !== "object" || !value) return "";
  const fields = ["name", "number", "date", "productId", "tradeId", "qty", "amount", "reason", "notes"].filter(
    (k) => value[k] !== undefined && value[k] !== "",
  );
  return fields.length ? " (" + fields.map((k) => `${k}: ${String(value[k]).slice(0, 100)}`).join(", ") + ")" : "";
}

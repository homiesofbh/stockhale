import { backupChecksum, validateRecoveryBackup, type RecoveryBackup } from "./recovery";
import { validateStore } from "./operation-validation";
import { validateBanks } from "./bank-vouchers";
import { accountPath, chartAccounts, validateAccounts } from "./accounts";
import { validateJournals } from "./journals";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { verifyPassword } from "better-auth/crypto";
import { isIP } from "node:net";
import { getAuth, passwordResetDeliveryConfigured } from "./auth";
import { query, transaction } from "./database";
import { balance, contactBalance, emptyStore, financialRows, normalizeStore, profit, round, total, type Store } from "./model";
import { modules, verifyChange, prepareSyncChange, applyStoreDelta, createStoreDelta, type Member, type StoreDelta } from "./workspace";
import { reopenDay } from "./operations";
import { filterTrades, matchesQuery } from "./record-selectors";
import { createReportData } from "./reports";
export { db } from "./database";
type Row = Record<string, any>;
const row = async (sql: string, ...args: unknown[]) =>
  (await query(sql, args)).rows[0] as Row | undefined;
const all = async (sql: string, ...args: unknown[]) =>
  (await query(sql, args)).rows as Row[];
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
function trustedClientIp(request: Request) {
  const header =
    process.env.STOCKHALE_TRUSTED_CLIENT_IP_HEADER || "cf-connecting-ip";
  if (!/^[a-z0-9-]+$/i.test(header)) return undefined;
  const value = request.headers.get(header)?.trim();
  return value && isIP(value) ? value : undefined;
}
async function consumeLimit(key: string, maximum: number, windowMs: number) {
  const now = Date.now();
  // Expiry is stored as data in Postgres, so clean old keys during normal use.
  await query("DELETE FROM limits WHERE expires <= $1", [now]);
  const limit = await row(
    `INSERT INTO limits(key,count,expires) VALUES($1,1,$2)
     ON CONFLICT(key) DO UPDATE SET
       count=CASE WHEN limits.expires <= $3 THEN 1 ELSE limits.count+1 END,
       expires=CASE WHEN limits.expires <= $3 THEN $2 ELSE limits.expires END
     RETURNING count`,
    key,
    now + windowMs,
    now,
  );
  if (limit!.count > maximum)
    throw Object.assign(new Error("Too many attempts. Try again later."), {
      status: 429,
    });
}
function required(value: unknown, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error("Required field is missing or too long.");
  return value.trim();
}
function validTimeZone(value: unknown) {
  if (typeof value !== "string" || value.length > 100) throw new Error("Choose a valid time zone.");
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); }
  catch { throw new Error("Choose a valid time zone."); }
  return value;
}
function email(value: unknown) {
  const s = required(value).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    throw new Error("Enter a valid email.");
  return s;
}
export async function authorize(request: Request) {
  const { response, headers } = await getAuth().api.getSession({
    headers: request.headers,
    returnHeaders: true,
    query: { disableCookieCache: true },
  });
  if (!response)
    throw Object.assign(new Error("Sign in to continue."), { status: 401 });
  return { user: response.user, headers };
}
async function workspace(user: Row, lock = false) {
  const w = await row(
    'SELECT workspaces.* FROM workspaces JOIN members ON members.workspace=workspaces.id WHERE members."user"=$1' +
      (lock ? " FOR UPDATE OF workspaces" : ""),
    user.id,
  );
  if (!w) throw new Error("Workspace unavailable.");
  return w;
}
// Load the normalized representation for ordinary workspace operations. The
// The JSON column is only the legacy seed; current backups use these records.
async function loadWorkspaceStore(w: Row) {
  if (!w.records_ready) return normalizeStore(JSON.parse(w.store));
  const records = await all(
    'SELECT collection,record_id,ordinal,record FROM workspace_records WHERE workspace=$1 ORDER BY collection,ordinal',
    w.id,
  );
  const store: Row = { version: 1 };
  // An absent row means an empty collection, including configurable lists.
  // Applying emptyStore defaults here would resurrect deleted categories,
  // heads or units after a reload.
  for (const [key, value] of Object.entries(normalizeStore(emptyStore()))) {
    if (Array.isArray(value)) store[key] = [];
  }
  for (const item of records) {
    (store[item.collection] ||= []).push(item.record);
  }
  return normalizeStore(store as Store);
}
async function persistWorkspaceStore(w: Row, before: Store, store: Store, revision: number) {
  const entries: { collection: string; id: string; ordinal: number; record: unknown }[] = [];
  const removed: { collection: string; id: string }[] = [];
  // Seed every record on the first write, including unchanged default lists.
  const baseline = w.records_ready ? before : { version: 1 } as Store;
  const collections = new Set([...Object.keys(baseline), ...Object.keys(store)]);
  const recordsById = (records: unknown) => {
    const result = new Map<string, { record: unknown; ordinal: number }>();
    if (!Array.isArray(records)) return result;
    records.forEach((record: any, ordinal) => {
      const base = String(record?.id ?? record?.name ?? `#${ordinal}`);
      const id = result.has(base) ? `${base}#${ordinal}` : base;
      result.set(id, { record, ordinal });
    });
    return result;
  };
  for (const collection of collections) {
    const beforeRecords = recordsById((baseline as any)[collection]);
    const nextRecords = recordsById((store as any)[collection]);
    for (const [id] of beforeRecords) if (!nextRecords.has(id)) removed.push({ collection, id });
    for (const [id, next] of nextRecords) {
      const prior = beforeRecords.get(id);
      if (!prior || prior.ordinal !== next.ordinal || JSON.stringify(prior.record) !== JSON.stringify(next.record)) {
        entries.push({ collection, id, ordinal: next.ordinal, record: next.record });
      }
    }
  }
  for (const entry of removed) await query('DELETE FROM workspace_records WHERE workspace=$1 AND collection=$2 AND record_id=$3', [w.id, entry.collection, entry.id]);
  if (entries.length) {
    await query(`INSERT INTO workspace_records(workspace,collection,record_id,ordinal,record)
      SELECT $1,e.collection,e.record_id,e.ordinal,e.record FROM json_to_recordset($2::json)
      AS e(collection text,record_id text,ordinal integer,record json)
      ON CONFLICT(workspace,collection,record_id) DO UPDATE SET ordinal=EXCLUDED.ordinal,record=EXCLUDED.record
      WHERE workspace_records.ordinal IS DISTINCT FROM EXCLUDED.ordinal OR workspace_records.record::text IS DISTINCT FROM EXCLUDED.record::text`,
      [w.id, JSON.stringify(entries.map(({ collection, id, ordinal, record }) => ({ collection, record_id: id, ordinal, record })))]);
  }
  await query('UPDATE workspaces SET revision=$1,records_ready=TRUE WHERE id=$2', [revision, w.id]);
}
function requireWorkspaceAccess(w: Row) {
  if (trialAccess(w).locked)
    throw Object.assign(new Error(accessExpiredMessage(w)), { status: 402, code: "PLAN_EXPIRED" });
}
function accessExpiredMessage(w: Row) {
  return w.plan_expires_at && Date.now() >= new Date(w.plan_expires_at).getTime()
    ? "Your plan has expired. Contact the StockHale team for further assistance."
    : "Your trial has expired. Contact the StockHale team for further assistance.";
}
async function member(w: Row, u: Row): Promise<Member> {
  const m = await row(
    'SELECT modules FROM members WHERE workspace=$1 AND "user"=$2',
    w.id,
    u.id,
  );
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: w.owner === u.id ? "owner" : "member",
    modules: JSON.parse(m?.modules || "[]"),
  };
}
function owner(w: Row, u: Row) {
  if (w.owner !== u.id)
    throw Object.assign(new Error("Only the workspace owner can do this."), {
      status: 403,
    });
}
async function event(
  w: Row,
  u: Row,
  module: string,
  action: string,
  records: string,
  id: string = randomUUID(),
  occurredAt = new Date().toISOString(),
) {
  await query(
    'INSERT INTO events(id,workspace,actor,module,action,records,"occurredAt","receivedAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [
      id,
      w.id,
      `${u.name} <${u.email}>`,
      module,
      action,
      records,
      occurredAt,
      new Date().toISOString(),
    ],
  );
}
export async function recordAudit(user: Row, module: string, action: string, records: string) {
  const w = await workspace(user);
  await event(w, user, module, action, records);
}
export async function snapshot(user: Row, options: { details?: boolean } = {}) {
  return transaction(async () => {
    await query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const w = await workspace(user);
    const access = trialAccess(w);
    if (!access.locked) return readSnapshot(user, w, options.details !== false);
    return {
      ...access, id: w.id, name: w.name, businessType: w.business_type || null, image: "", revision: 0,
      store: emptyStore(), member: await member(w, user), members: [], audit: [],
      readEvent: "", emailConfigured: false,
    };
  });
}
export async function workspaceRevision(user: Row) {
  const w = await row(
    'SELECT w.id,w.revision,w.plan_active,w.plan_expires_at,w.trial_started_at,w.access_revoked_at FROM workspaces w JOIN members m ON m.workspace=w.id WHERE m."user"=$1',
    user.id,
  );
  if (!w) throw new Error("Workspace unavailable.");
  return { id: w.id, revision: Number(w.revision), locked: trialAccess(w).locked };
}
export async function workspaceDetails(user: Row) {
  return transaction(async () => {
    const w = await row('SELECT id,owner FROM workspaces JOIN members ON members.workspace=workspaces.id WHERE members."user"=$1', user.id);
    if (!w) throw new Error("Workspace unavailable.");
    const m = await member(w, user);
    if (m.role !== "owner") return { members: [], audit: [] };
    const [members, audit] = await Promise.all([
      all('SELECT users.id,users.name,users.email,members.modules FROM users JOIN members ON members."user"=users.id WHERE members.workspace=$1', w.id),
      all('SELECT id,actor,module,action,records,"occurredAt","receivedAt","emailStatus" FROM events WHERE workspace=$1 ORDER BY "receivedAt" DESC LIMIT 300', w.id),
    ]);
    return {
      members: members.map((item): Member => ({ id: item.id, name: item.name, email: item.email, role: w.owner === item.id ? "owner" : "member", modules: JSON.parse(item.modules) })),
      audit,
    };
  });
}
const COLLECTIONS = new Set([
  "products", "customers", "suppliers", "purchases", "invoices", "movements",
  "payments", "expenses", "returns", "partners", "bankVouchers", "journals", "chequeEvents",
  "productionRuns", "recipes", "dailyCloses", "accounts", "financialAccounts", "accountDirectory", "paymentHistory", "chequeRegister", "partnerLedger", "activityLog", "financialTransactions", "walkInReview", "dashboardSummary",
]);
const COLLECTION_SEARCH: Record<string, string[]> = {
  products: ["id", "name", "sku", "barcode", "category", "color", "gsm", "packing", "store", "size", "unit"],
  customers: ["name", "company", "phone", "mobile", "email", "address", "ntn", "contactPerson", "salesTaxNumber", "description"],
  suppliers: ["name", "company", "phone", "mobile", "email", "address", "ntn", "contactPerson", "salesTaxNumber", "description"],
  purchases: ["number", "reference", "date", "method", "status", "walkInName", "walkInCompany", "walkInPhone"],
  invoices: ["number", "reference", "date", "method", "status", "walkInName", "walkInCompany", "walkInPhone"],
  movements: ["id", "date", "type", "reference", "reason"],
  walkInReview: ["number", "date", "walkInName", "walkInCompany", "walkInPhone"],
  payments: ["id", "date", "kind", "method", "notes", "chequeNumber", "chequeBank"],
  expenses: ["id", "date", "category", "head", "method", "notes"],
  returns: ["id", "date", "kind", "reason", "notes"],
  partners: ["id", "date", "partner", "kind", "method", "notes"],
  bankVouchers: ["id", "date", "number", "reference", "notes", "kind", "status"],
  journals: ["id", "date", "number", "reference", "description"],
  productionRuns: ["id", "date", "reference", "recipeName"],
  recipes: ["id", "name", "outputProductId"],
  dailyCloses: ["id", "date", "actorName", "status"],
  accounts: ["id", "name", "code", "type", "description"],
  financialAccounts: ["id", "name", "type", "accountNumber", "description"],
};
export async function workspaceCollection(user: Row, options: { collection: string; module?: string; actor?: string; moduleFilter?: string; query?: string; secondaryQuery?: string; productId?: string; productIds?: string[]; productRole?: string; contactId?: string; postedOnly?: boolean; noContactOnly?: boolean; unpaidOnly?: boolean; tradeId?: string; forwardableOnly?: boolean; week?: string; accountId?: string; bankOnly?: boolean; from?: string; to?: string; secondaryFrom?: string; secondaryTo?: string; category?: string; status?: string; paymentMethod?: string; page?: number; pageSize?: number }) {
  if (!COLLECTIONS.has(options.collection)) throw Object.assign(new Error("Invalid collection."), { status: 400 });
  return transaction(async () => {
    await query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const w = await workspace(user);
    requireWorkspaceAccess(w);
    const memberRecord = await member(w, user);
    const moduleForCollection: Record<string, string> = { products: "Inventory", customers: "Customers", suppliers: "Suppliers", purchases: "Purchases", invoices: "Sales", movements: "Inventory", walkInReview: "Billing", dashboardSummary: "Billing", payments: "Payments", chequeEvents: "Payments", chequeRegister: "Payments", paymentHistory: "Payments", expenses: "Expenses", returns: "Returns & Damage", partners: "Payments", partnerLedger: "Payments", bankVouchers: "Accounts Heads", journals: "Accounts Heads", productionRuns: "Production", recipes: "Production", dailyCloses: "Closing", accounts: "Accounts Heads", financialAccounts: "Accounts Heads", accountDirectory: "Accounts Heads", activityLog: "Notifications", financialTransactions: "Accounts Heads" };
    const allowedModules = options.collection === "dashboardSummary" ? [options.module === "Purchases" ? "Purchases" : "Billing"] : options.collection === "invoices" ? [options.module === "Billing" ? "Billing" : options.module === "Inventory" ? "Inventory" : "Sales"] : [options.collection === "purchases" && options.module === "Inventory" || options.collection === "productionRuns" && options.module === "Inventory" ? "Inventory" : moduleForCollection[options.collection]];
    if (memberRecord.role !== "owner" && !allowedModules.some(name => memberRecord.modules.includes(name)))
      throw Object.assign(new Error("You do not have permission to view this collection."), { status: 403 });
    const conditions = ["workspace=$1", "collection=$2"];
    const args: unknown[] = [w.id, options.collection];
    const fields = COLLECTION_SEARCH[options.collection] || [];
    const term = (options.query || "").trim().slice(0, 160);
    if (term && fields.length) {
      args.push(term);
      conditions.push(`(${fields.map(field => `COALESCE(record->>'${field}', '') ILIKE '%' || $${args.length} || '%'`).join(" OR ")})`);
    }
    for (const [field, value, op] of [["date", options.from, ">="], ["date", options.to, "<="]] as const) {
      if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) { args.push(value); conditions.push(`record->>'${field}' ${op} $${args.length}`); }
    }
    if (options.category && options.category !== "All" && ["products", "expenses", "partners"].includes(options.collection)) {
      args.push(options.category); conditions.push(`record->>'category'=$${args.length}`);
    }
    if (options.status && options.status !== "All" && ["invoices", "purchases", "payments", "bankVouchers", "dailyCloses"].includes(options.collection)) {
      const statusField = options.collection === "payments" ? "chequeStatus" : "status";
      args.push(options.collection === "dailyCloses" ? options.status.toLowerCase() : options.status); conditions.push(`record->>'${statusField}'=$${args.length}`);
    }
    if (options.productId && options.collection === "movements") { args.push(options.productId); conditions.push(`record->>'productId'=$${args.length}`); }
    if (options.contactId && ["invoices", "purchases", "payments"].includes(options.collection)) { args.push(options.contactId); conditions.push(`record->>'contactId'=$${args.length}`); }
    if (options.productIds?.length && options.collection === "products") { args.push(options.productIds); conditions.push(`record->>'id'=ANY($${args.length}::text[])`); }
    if (options.postedOnly && ["invoices", "purchases"].includes(options.collection)) conditions.push("record->>'status' NOT IN ('draft','void')");
    if (options.noContactOnly && ["invoices", "purchases"].includes(options.collection)) conditions.push("COALESCE(record->>'contactId','')=''");
    if (options.paymentMethod && options.paymentMethod !== "All" && ["invoices", "purchases", "payments", "expenses"].includes(options.collection)) {
      args.push(options.paymentMethod); conditions.push(`record->>'method'=$${args.length}`);
    }
    if (options.collection === "payments" && options.module === "Payments" && options.status === "pending") conditions.push("COALESCE(record->>'chequeStatus','pending')='pending'");
    const pageSize = Math.max(1, Math.min(100, Math.floor(options.pageSize || 25)));
    const page = Math.max(1, Math.floor(options.page || 1));
    const offset = (page - 1) * pageSize;
    const where = conditions.join(" AND ");
    if (options.collection === "products") {
      const status = options.status?.toLowerCase();
      const quantity = "COALESCE(stock.qty,0)";
      const threshold = "COALESCE((record->>'low')::numeric,0)";
      const stockFilter = status === "out of stock" ? `${quantity}=0`
        : status === "low stock" ? `${quantity}>0 AND ${quantity}<=${threshold}`
        : status === "in stock" ? `${quantity}>${threshold}`
        : status === "active" ? "record->>'active' IS DISTINCT FROM 'false'"
        : "TRUE";
      const source = `FROM (
        SELECT record, ordinal, record_id
        FROM workspace_records WHERE ${where}
      ) products
      LEFT JOIN LATERAL (
        SELECT ROUND(SUM((m.record->>'qty')::numeric),2) AS qty
        FROM workspace_records m
        WHERE m.workspace=$1 AND m.collection='movements'
          AND m.record->>'productId'=products.record->>'id'
      ) stock ON TRUE
      WHERE ${stockFilter}`;
      const aggregate = await row(`SELECT COUNT(*)::int AS count,
        SUM(COALESCE((record->>'cost')::numeric,0)*${quantity}) AS stock_value,
        SUM(${quantity}) AS stock_units,
        COUNT(*) FILTER (WHERE ${quantity}>0 AND ${quantity}<=${threshold})::int AS low_stock
        ${source}`, ...args);
      const records = await all(`SELECT record, ${quantity} AS qty ${source}
        ORDER BY ordinal, record_id LIMIT $${args.length + 1} OFFSET $${args.length + 2}`, ...args, pageSize, offset);
      const lowStock = Number(aggregate?.low_stock || 0);
      return {
        records: records.map(item => ({ ...item.record, currentStock: Number(item.qty) })),
        count: Number(aggregate?.count || 0),
        page,
        pageSize,
        aggregates: { stockValue: Number(aggregate?.stock_value || 0), stockUnits: Number(aggregate?.stock_units || 0), lowStock },
        meta: { lowStockCount: lowStock },
      };
    }
    const count = Number((await row(`SELECT COUNT(*)::int AS count FROM workspace_records WHERE ${where}`, ...args))?.count || 0);
    let aggregates: Record<string, number> | undefined;
    if (options.collection === "expenses") {
      const aggregate = await row(`SELECT COALESCE(SUM((record->>'amount')::numeric),0) AS total FROM workspace_records WHERE ${where}`, ...args);
      aggregates = { total: Number(aggregate?.total || 0) };
    }
    if (options.collection === "dashboardSummary") {
      const store = await loadWorkspaceStore(w);
      const invoices = store.invoices.filter(trade => trade.status !== "draft" && trade.status !== "void" && (!options.from || trade.date >= options.from) && (!options.to || trade.date <= options.to));
      const purchases = store.purchases.filter(trade => trade.status !== "draft" && trade.status !== "void" && (!options.from || trade.date >= options.from) && (!options.to || trade.date <= options.to));
      const trades = options.module === "Purchases" ? purchases : invoices;
      const balanceAmount = options.module === "Purchases"
        ? store.suppliers.reduce((sum, contact) => sum + Math.max(contactBalance(store, "Supplier", contact.id), 0), 0) + purchases.filter(trade => !trade.contactId || !store.suppliers.some(contact => contact.id === trade.contactId)).reduce((sum, trade) => sum + Math.max(balance(store, trade), 0), 0)
        : store.customers.reduce((sum, contact) => sum + Math.max(contactBalance(store, "Customer", contact.id), 0), 0) + invoices.filter(trade => !trade.contactId || !store.customers.some(contact => contact.id === trade.contactId)).reduce((sum, trade) => sum + Math.max(balance(store, trade), 0), 0);
      return { records: trades.slice(offset, offset + pageSize), count: trades.length, page, pageSize, aggregates: { balance: balanceAmount, profit: profit(store, options.from || "", options.to || ""), invoiceCount: invoices.length } };
    }
    if (options.collection === "financialTransactions") {
      const store = await loadWorkspaceStore(w);
      const transactions = financialRows(store).filter(item => (!options.from || item.date >= options.from) && (!options.to || item.date <= options.to) && (!options.secondaryFrom || item.date >= options.secondaryFrom) && (!options.secondaryTo || item.date <= options.secondaryTo) && (!options.accountId || item.financialAccountId === options.accountId) && (!options.bankOnly || (!!item.financialAccountId && item.bank !== 0)) && matchesQuery(options.query || "", item.head, item.reference, item.type, item.contactId, item.method, item.bank)).sort((a, b) => b.date.localeCompare(a.date));
      const weekStart = (date: string) => { const day = new Date(`${date}T00:00:00Z`); day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7); return day.toISOString().slice(0, 10); };
      const weeks = [...new Set(transactions.map(item => weekStart(item.date)))].sort().reverse();
      const activeWeek = options.week && weeks.includes(options.week) ? options.week : weeks[0] || "";
      const weekly = transactions.filter(item => weekStart(item.date) === activeWeek);
      const accounts = chartAccounts(store);
      const accountSummaries = accounts.map(account => {
        const rows = transactions.filter(item => item.head === account.name);
        return { id: account.id, transactionCount: rows.length, transactionTotal: round(rows.reduce((sum, item) => sum + item.amount, 0)) };
      });
      const unassigned = transactions.filter(item => !item.financialAccountId && item.bank !== 0);
      return { records: weekly.slice(offset, offset + pageSize), count: weekly.length, page, pageSize, aggregates: { unassignedCount: unassigned.length, unassignedBank: round(unassigned.reduce((sum, item) => sum + item.bank, 0)) }, meta: { weeks, activeWeek, accountSummaries } };
    }
    if (options.collection === "productionRuns") {
      const conditions = ["workspace=$1", "collection='productionRuns'"];
      const runArgs: unknown[] = [w.id];
      for (const [value, op] of [[options.from, ">="], [options.to, "<="]] as const) {
        if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) { runArgs.push(value); conditions.push(`record->>'date' ${op} $${runArgs.length}`); }
      }
      if (options.productId) {
        if (options.productRole === "output") conditions.push(`record->>'outputProductId'=$${(runArgs.push(options.productId), runArgs.length)}`);
        else if (options.productRole === "use") {
          runArgs.push(options.productId);
          conditions.push(`EXISTS (SELECT 1 FROM json_array_elements(record->'ingredients') ingredient WHERE ingredient->>'productId'=$${runArgs.length})`);
        } else {
          runArgs.push(options.productId);
          conditions.push(`(record->>'outputProductId'=$${runArgs.length} OR EXISTS (SELECT 1 FROM json_array_elements(record->'ingredients') ingredient WHERE ingredient->>'productId'=$${runArgs.length}))`);
        }
      }
      if (term) { runArgs.push(term); conditions.push(`(record->>'id' ILIKE '%' || $${runArgs.length} || '%' OR record->>'reference' ILIKE '%' || $${runArgs.length} || '%' OR record->>'recipeName' ILIKE '%' || $${runArgs.length} || '%')`); }
      const runWhere = conditions.join(" AND ");
      const runCount = Number((await row(`SELECT COUNT(*)::int AS count FROM workspace_records WHERE ${runWhere}`, ...runArgs))?.count || 0);
      const totals = await row(`SELECT COALESCE(SUM((record->>'materialCost')::numeric),0) AS material_cost FROM workspace_records WHERE ${runWhere}`, ...runArgs);
      const records = await all(`SELECT record FROM workspace_records WHERE ${runWhere} ORDER BY record->>'date' DESC,record_id DESC LIMIT $${runArgs.length + 1} OFFSET $${runArgs.length + 2}`, ...runArgs, pageSize, offset);
      return { records: records.map(item => item.record), count: runCount, page, pageSize, aggregates: { materialCost: Number(totals?.material_cost || 0) } };
    }
    if (options.collection === "walkInReview") {
      if (memberRecord.role !== "owner") throw Object.assign(new Error("Only the workspace owner can review historical walk-ins."), { status: 403 });
      const conditions = ["workspace=$1", "collection='invoices'", "COALESCE(record->>'contactId','')=''", "record->>'status' NOT IN ('draft','void')"];
      const walkArgs: unknown[] = [w.id];
      if (term) { walkArgs.push(term); conditions.push(`concat_ws(' ',record->>'id',record->>'number',record->>'date',record->>'walkInName',record->>'walkInCompany',record->>'walkInPhone') ILIKE '%' || $${walkArgs.length} || '%'`); }
      const walkWhere = conditions.join(" AND ");
      const walkCount = Number((await row(`SELECT COUNT(*)::int AS count FROM workspace_records WHERE ${walkWhere}`, ...walkArgs))?.count || 0);
      const records = await all(`SELECT record FROM workspace_records WHERE ${walkWhere} ORDER BY record->>'date' DESC,record->>'number' DESC LIMIT $${walkArgs.length + 1} OFFSET $${walkArgs.length + 2}`, ...walkArgs, pageSize, offset);
      return { records: records.map(item => item.record), count: walkCount, page, pageSize };
    }
    if (options.collection === "chequeEvents") {
      const eventArgs: unknown[] = [w.id];
      let eventWhere = "workspace=$1 AND collection='chequeEvents'";
      if (options.contactId) { eventArgs.push(options.contactId); eventWhere += ` AND record->>'paymentId'=$${eventArgs.length}`; }
      const eventCount = Number((await row(`SELECT COUNT(*)::int AS count FROM workspace_records WHERE ${eventWhere}`, ...eventArgs))?.count || 0);
      const records = await all(`SELECT record FROM workspace_records WHERE ${eventWhere} ORDER BY record->>'date' DESC,record_id DESC LIMIT $${eventArgs.length + 1} OFFSET $${eventArgs.length + 2}`, ...eventArgs, pageSize, offset);
      return { records: records.map(item => item.record), count: eventCount, page, pageSize };
    }
    if (options.collection === "activityLog") {
      if (memberRecord.role !== "owner") throw Object.assign(new Error("Only the workspace owner can view activity logs."), { status: 403 });
      const conditions = ["workspace=$1"];
      const args: unknown[] = [w.id];
      for (const [value, op] of [[options.from, ">="], [options.to, "<="]] as const) {
        if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) { args.push(value); conditions.push(`LEFT("occurredAt"::text,10) ${op} $${args.length}`); }
      }
      if (options.actor) { args.push(options.actor); conditions.push(`actor=$${args.length}`); }
      if (options.moduleFilter) { args.push(options.moduleFilter); conditions.push(`module=$${args.length}`); }
      const term = (options.query || "").trim().slice(0, 160);
      if (term) { args.push(term); conditions.push(`(actor ILIKE '%' || $${args.length} || '%' OR module ILIKE '%' || $${args.length} || '%' OR action ILIKE '%' || $${args.length} || '%' OR records ILIKE '%' || $${args.length} || '%')`); }
      const where = conditions.join(" AND ");
      const activityCount = Number((await row(`SELECT COUNT(*)::int AS count FROM events WHERE ${where}`, ...args))?.count || 0);
      const records = await all(`SELECT id,actor,module,action,records,"occurredAt","receivedAt","emailStatus" FROM events WHERE ${where} ORDER BY "receivedAt" DESC,id DESC LIMIT $${args.length + 1} OFFSET $${args.length + 2}`, ...args, pageSize, offset);
      const [actors, modules] = await Promise.all([
        all('SELECT DISTINCT actor FROM events WHERE workspace=$1 ORDER BY actor', w.id),
        all('SELECT DISTINCT module FROM events WHERE workspace=$1 ORDER BY module', w.id),
      ]);
      return { records, count: activityCount, page, pageSize, meta: { actors: actors.map(item => item.actor), modules: modules.map(item => item.module) } };
    }
    if (options.collection === "accountDirectory") {
      const store = await loadWorkspaceStore(w);
      const accounts = chartAccounts(store).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
      const term = (options.query || "").trim().toLowerCase();
      const visible = new Set(accounts.filter(account => !term || [account.id, account.code, accountPath(accounts, account), account.type, account.description].join(" ").toLowerCase().includes(term)).map(account => account.id));
      for (const account of accounts.filter(item => visible.has(item.id))) {
        let parentId = account.parentId;
        const seen = new Set([account.id]);
        while (parentId && !seen.has(parentId)) {
          seen.add(parentId); visible.add(parentId);
          parentId = accounts.find(item => item.id === parentId)?.parentId || "";
        }
      }
      const roots = accounts.filter(account => !account.parentId || !accounts.some(parent => parent.id === account.parentId)).filter(account => visible.has(account.id));
      return { records: roots.slice(offset, offset + pageSize), count: roots.length, page, pageSize, meta: { visibleIds: [...visible], visibleCount: visible.size, accountCount: accounts.length } };
    }
    if (options.collection === "accounts") {
      const store = await loadWorkspaceStore(w);
      const accounts = chartAccounts(store);
      const transactions = financialRows(store).filter(item => (!options.from || item.date >= options.from) && (!options.to || item.date <= options.to));
      const byHead = new Map<string, { transactionTotal: number; transactionCount: number }>();
      for (const item of transactions) {
        const entry = byHead.get(item.head) || { transactionTotal: 0, transactionCount: 0 };
        entry.transactionTotal = round(entry.transactionTotal + item.amount);
        entry.transactionCount++;
        byHead.set(item.head, entry);
      }
      const term = (options.query || "").trim().toLowerCase();
      const filtered = accounts.filter(account => !term || [account.id, account.code, account.name, account.type, account.description].join(" ").toLowerCase().includes(term))
        .map(account => ({ ...account, ...(byHead.get(account.name) || { transactionTotal: 0, transactionCount: 0 }) }))
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
      return { records: filtered.slice(offset, offset + pageSize), count: filtered.length, page, pageSize };
    }
    if (options.collection === "returns") {
      const returnArgs: unknown[] = [w.id];
      const conditions = ["r.workspace=$1", "r.collection='returns'"];
      for (const [value, op] of [[options.from, ">="], [options.to, "<="]] as const) {
        if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) { returnArgs.push(value); conditions.push(`r.record->>'date' ${op} $${returnArgs.length}`); }
      }
      if (options.tradeId) { returnArgs.push(options.tradeId); conditions.push(`r.record->>'tradeId'=$${returnArgs.length}`); }
      const searchParts: string[] = [];
      for (const termValue of [options.query, options.secondaryQuery].filter(Boolean)) {
        returnArgs.push(`%${termValue!.trim()}%`);
        searchParts.push(`(r.record->>'id' ILIKE $${returnArgs.length} OR r.record->>'kind' ILIKE $${returnArgs.length} OR r.record->>'reason' ILIKE $${returnArgs.length} OR r.record->>'date' ILIKE $${returnArgs.length} OR EXISTS (SELECT 1 FROM workspace_records p WHERE p.workspace=r.workspace AND p.collection='products' AND p.record->>'id'=r.record->>'productId' AND concat_ws(' ',p.record->>'name',p.record->>'unit',p.record->>'sku') ILIKE $${returnArgs.length}) OR EXISTS (SELECT 1 FROM workspace_records t WHERE t.workspace=r.workspace AND t.collection IN ('invoices','purchases') AND t.record->>'id'=r.record->>'tradeId' AND t.record->>'number' ILIKE $${returnArgs.length}))`);
      }
      conditions.push(...searchParts);
      const returnWhere = conditions.join(" AND ");
      const returnCount = Number((await row(`SELECT COUNT(*)::int AS count FROM workspace_records r WHERE ${returnWhere}`, ...returnArgs))?.count || 0);
      const returnedByProduct = options.tradeId
        ? Object.fromEntries((await all(`SELECT record->>'productId' AS product_id,COALESCE(SUM((record->>'qty')::numeric),0) AS qty FROM workspace_records WHERE workspace=$1 AND collection='returns' AND record->>'tradeId'=$2 GROUP BY record->>'productId'`, w.id, options.tradeId)).map(item => [item.product_id, Number(item.qty || 0)]))
        : {};
      const records = await all(`SELECT r.record FROM workspace_records r WHERE ${returnWhere} ORDER BY r.ordinal DESC LIMIT $${returnArgs.length + 1} OFFSET $${returnArgs.length + 2}`, ...returnArgs, pageSize, offset);
      return { records: records.map(item => item.record), count: returnCount, page, pageSize, meta: { returnedByProduct } };
    }
    if (options.collection === "chequeRegister") {
      const conditions = ["workspace=$1", "collection='payments'", "record->>'method'='Cheque'"];
      if (options.forwardableOnly) {
        conditions.push("record->>'kind'='Customer'", "(record->>'amount')::numeric>0");
        conditions.push(`NOT EXISTS (
          SELECT 1 FROM workspace_records forwarded
          WHERE forwarded.workspace=workspace_records.workspace
            AND forwarded.collection='crossCheques'
            AND forwarded.record->>'sourcePaymentId'=workspace_records.record->>'id'
        )`);
      }
      const chequeArgs: unknown[] = [w.id];
      const status = options.status || "All";
      if (status !== "All") {
        if (status === "pending") conditions.push("COALESCE(record->>'chequeStatus','pending')='pending'");
        else { chequeArgs.push(status); conditions.push(`record->>'chequeStatus'=$${chequeArgs.length}`); }
      }
      if (term) { chequeArgs.push(term); conditions.push(`(record->>'chequeNumber' ILIKE '%' || $${chequeArgs.length} || '%' OR record->>'chequeBank' ILIKE '%' || $${chequeArgs.length} || '%' OR record->>'id' ILIKE '%' || $${chequeArgs.length} || '%' OR EXISTS (SELECT 1 FROM workspace_records c WHERE c.workspace=workspace_records.workspace AND c.collection IN ('customers','suppliers') AND c.record->>'id'=workspace_records.record->>'contactId' AND (c.record->>'name' ILIKE '%' || $${chequeArgs.length} || '%' OR c.record->>'company' ILIKE '%' || $${chequeArgs.length} || '%')) OR EXISTS (SELECT 1 FROM workspace_records x WHERE x.workspace=workspace_records.workspace AND x.collection='crossCheques' AND x.record->>'sourcePaymentId'=workspace_records.record->>'id' AND (x.record->>'id' ILIKE '%' || $${chequeArgs.length} || '%' OR x.record->>'destinationName' ILIKE '%' || $${chequeArgs.length} || '%')))`); }
      const chequeWhere = conditions.join(" AND ");
      const chequeCount = Number((await row(`SELECT COUNT(*)::int AS count FROM workspace_records WHERE ${chequeWhere}`, ...chequeArgs))?.count || 0);
      const rows = await all(`SELECT record FROM workspace_records WHERE ${chequeWhere} ORDER BY COALESCE(record->>'chequeDate',record->>'date') ASC,record_id ASC LIMIT $${chequeArgs.length + 1} OFFSET $${chequeArgs.length + 2}`, ...chequeArgs, pageSize, offset);
      return { records: rows.map(item => item.record), count: chequeCount, page, pageSize };
    }
    if (options.collection === "bankVouchers") {
      const voucherArgs: unknown[] = [w.id];
      const conditions = ["workspace=$1", "collection='bankVouchers'"];
      if (options.from) { voucherArgs.push(options.from); conditions.push(`record->>'date'>=$${voucherArgs.length}`); }
      if (options.to) { voucherArgs.push(options.to); conditions.push(`record->>'date'<=$${voucherArgs.length}`); }
      if (term) { voucherArgs.push(`%${term}%`); conditions.push(`concat_ws(' ',record->>'id',record->>'number',record->>'reference',record->>'notes',record->>'kind',record->>'status') ILIKE $${voucherArgs.length}`); }
      const voucherWhere = conditions.join(" AND ");
      const voucherCount = Number((await row(`SELECT COUNT(*)::int AS count FROM workspace_records WHERE ${voucherWhere}`, ...voucherArgs))?.count || 0);
      const records = await all(`SELECT record FROM workspace_records WHERE ${voucherWhere} ORDER BY record->>'date' DESC,COALESCE((record->>'createdAt')::bigint,0) DESC LIMIT $${voucherArgs.length + 1} OFFSET $${voucherArgs.length + 2}`, ...voucherArgs, pageSize, offset);
      return { records: records.map(item => item.record), count: voucherCount, page, pageSize };
    }
    if (options.collection === "partnerLedger") {
      const store = await loadWorkspaceStore(w);
      const entries = (store.partners || []).filter(entry => !options.category || options.category === "All" || entry.partner === options.category)
        .slice().sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
      const balances = new Map<string, number>();
      let contributions = 0, withdrawals = 0;
      const withBalances = entries.map(entry => {
        const delta = entry.kind === "Contribution" ? entry.amount : -entry.amount;
        const runningBalance = (balances.get(entry.partner) || 0) + delta;
        balances.set(entry.partner, runningBalance);
        if (entry.kind === "Contribution") contributions += entry.amount; else withdrawals += entry.amount;
        return { ...entry, runningBalance };
      }).reverse();
      return { records: withBalances.slice(offset, offset + pageSize), count: withBalances.length, page, pageSize, aggregates: { contributions, withdrawals } };
    }
    if (options.collection === "journals") {
      const journalArgs: unknown[] = [w.id];
      const conditions = ["j.workspace=$1", "j.collection='journals'"];
      if (options.from) { journalArgs.push(options.from); conditions.push(`j.record->>'date'>=$${journalArgs.length}`); }
      if (options.to) { journalArgs.push(options.to); conditions.push(`j.record->>'date'<=$${journalArgs.length}`); }
      if (term) { journalArgs.push(`%${term}%`); conditions.push(`(concat_ws(' ',j.record->>'id',j.record->>'number',j.record->>'reference',j.record->>'notes',j.record->>'status') ILIKE $${journalArgs.length} OR EXISTS (SELECT 1 FROM json_array_elements(j.record->'lines') line WHERE concat_ws(' ',line->>'description',line->>'accountId') ILIKE $${journalArgs.length}))`); }
      const journalWhere = conditions.join(" AND ");
      const journalCount = Number((await row(`SELECT COUNT(*)::int AS count FROM workspace_records j WHERE ${journalWhere}`, ...journalArgs))?.count || 0);
      const records = await all(`SELECT j.record FROM workspace_records j WHERE ${journalWhere} ORDER BY j.record->>'date' DESC,COALESCE((j.record->>'createdAt')::bigint,0) DESC LIMIT $${journalArgs.length + 1} OFFSET $${journalArgs.length + 2}`, ...journalArgs, pageSize, offset);
      return { records: records.map(item => item.record), count: journalCount, page, pageSize };
    }
    if (options.collection === "paymentHistory") {
      const unionArgs: unknown[] = [w.id];
      const datePredicates = (alias: string) => {
        const predicates: string[] = [];
        if (options.from) { unionArgs.push(options.from); predicates.push(`${alias}.record->>'date'>=$${unionArgs.length}`); }
        if (options.to) { unionArgs.push(options.to); predicates.push(`${alias}.record->>'date'<=$${unionArgs.length}`); }
        return predicates.length ? ` AND ${predicates.join(" AND ")}` : "";
      };
      const invoiceDate = datePredicates("i"), purchaseDate = datePredicates("p"), paymentDate = datePredicates("pm"), partnerDate = datePredicates("pe");
      const invoiceTerm = term ? (unionArgs.push(`%${term}%`), ` AND concat_ws(' ',i.record->>'id',i.record->>'number',i.record->>'method',i.record->>'head',c.record->>'name',c.record->>'company',i.record->>'walkInName',i.record->>'walkInCompany',i.record->>'walkInPhone') ILIKE $${unionArgs.length}`) : "";
      const purchaseTerm = term ? (unionArgs.push(`%${term}%`), ` AND concat_ws(' ',p.record->>'id',p.record->>'number',p.record->>'method',p.record->>'head',c.record->>'name',c.record->>'company') ILIKE $${unionArgs.length}`) : "";
      const paymentTerm = term ? (unionArgs.push(`%${term}%`), ` AND concat_ws(' ',pm.record->>'id',pm.record->>'method',pm.record->>'head',pm.record->>'notes',pm.record->>'chequeNumber',pm.record->>'chequeBank',c.record->>'name',c.record->>'company',t.record->>'number') ILIKE $${unionArgs.length}`) : "";
      const partnerTerm = term ? (unionArgs.push(`%${term}%`), ` AND concat_ws(' ',pe.record->>'id',pe.record->>'partner',pe.record->>'notes',pe.record->>'method') ILIKE $${unionArgs.length}`) : "";
      const historyUnion = `SELECT i.record->>'id' id,i.record->>'date' date,COALESCE(NULLIF(concat_ws(' · ',NULLIF(c.record->>'name',''),NULLIF(c.record->>'company','')),''),NULLIF(concat_ws(' · ',NULLIF(i.record->>'walkInName',''),NULLIF(i.record->>'walkInCompany',''),NULLIF(i.record->>'walkInPhone','')),''),'Walk-in customer') contact,i.record->>'number' reference,'Customer' kind,(i.record->>'paid')::numeric amount,i.record->'balanceAfter' balanceAfter,i.record->>'method' method,'' cheque,NULL::text chequeStatus,i.record->>'head' head FROM workspace_records i LEFT JOIN workspace_records c ON c.workspace=i.workspace AND c.collection='customers' AND c.record->>'id'=i.record->>'contactId' WHERE i.workspace=$1 AND i.collection='invoices' AND i.record->>'status' NOT IN ('draft','void') AND COALESCE((i.record->>'paid')::numeric,0)>0${invoiceDate}${invoiceTerm}
        UNION ALL SELECT p.record->>'id',p.record->>'date',COALESCE(c.record->>'name','Walk-in customer'),p.record->>'number','Supplier',(p.record->>'paid')::numeric,p.record->'balanceAfter',p.record->>'method','',NULL::text,p.record->>'head' FROM workspace_records p LEFT JOIN workspace_records c ON c.workspace=p.workspace AND c.collection='suppliers' AND c.record->>'id'=p.record->>'contactId' WHERE p.workspace=$1 AND p.collection='purchases' AND p.record->>'status' NOT IN ('draft','void') AND COALESCE((p.record->>'paid')::numeric,0)>0${purchaseDate}${purchaseTerm}
        UNION ALL SELECT pm.record->>'id',pm.record->>'date',COALESCE(c.record->>'name','Walk-in customer'),CASE WHEN pm.record->>'accountLevel'='true' THEN 'Supplier account payment' WHEN pm.record->>'advance'='true' AND COALESCE(pm.record->>'tradeId','')='' THEN 'Unapplied advance' ELSE COALESCE(t.record->>'number','') END,pm.record->>'kind',(pm.record->>'amount')::numeric,pm.record->'balanceAfter',CASE WHEN pm.record->>'chequeStatus' IS NOT NULL THEN 'Cheque ' || (pm.record->>'chequeStatus') ELSE pm.record->>'method' END,CASE WHEN COALESCE(pm.record->>'chequeNumber','')<>'' THEN concat_ws(' · ',pm.record->>'chequeNumber',pm.record->>'chequeBank','due ' || (pm.record->>'chequeDate'),CASE WHEN pm.record->>'clearedDate' IS NOT NULL THEN 'cleared ' || (pm.record->>'clearedDate') END) ELSE '' END,pm.record->>'chequeStatus',pm.record->>'head' FROM workspace_records pm LEFT JOIN workspace_records c ON c.workspace=pm.workspace AND c.collection=CASE WHEN pm.record->>'kind'='Supplier' THEN 'suppliers' ELSE 'customers' END AND c.record->>'id'=pm.record->>'contactId' LEFT JOIN workspace_records t ON t.workspace=pm.workspace AND t.collection=CASE WHEN pm.record->>'kind'='Supplier' THEN 'purchases' ELSE 'invoices' END AND t.record->>'id'=pm.record->>'tradeId' WHERE pm.workspace=$1 AND pm.collection='payments'${paymentDate}${paymentTerm}
        UNION ALL SELECT pe.record->>'id',pe.record->>'date',pe.record->>'partner',COALESCE(pe.record->>'notes',''),'Partner ' || (pe.record->>'kind'),CASE WHEN pe.record->>'kind'='Contribution' THEN (pe.record->>'amount')::numeric ELSE -(pe.record->>'amount')::numeric END,pe.record->'balanceAfter',pe.record->>'method','',NULL::text,'Partner capital' FROM workspace_records pe WHERE pe.workspace=$1 AND pe.collection='partners'${partnerDate}${partnerTerm}`;
      const filteredUnion = term ? `SELECT * FROM (${historyUnion}) h WHERE concat_ws(' ',h.id,h.date,h.contact,h.reference,h.kind,h.method,h.cheque,h.head) ILIKE $${unionArgs.push(`%${term}%`)}` : historyUnion;
      const countResult = await row(`SELECT COUNT(*)::int AS count FROM (${filteredUnion}) history`, ...unionArgs);
      const records = await all(`SELECT * FROM (${filteredUnion}) history ORDER BY date DESC,id DESC LIMIT $${unionArgs.length + 1} OFFSET $${unionArgs.length + 2}`, ...unionArgs, pageSize, offset);
      return { records: records.map(item => ({ ...item, amount: Number(item.amount || 0) })), count: Number(countResult?.count || 0), page, pageSize };
    }
    if (["invoices", "purchases"].includes(options.collection)) {
      const store = await loadWorkspaceStore(w);
      const trades = options.collection === "invoices" ? store.invoices : store.purchases;
      let filtered = filterTrades(store, trades, { query: options.query || "", from: options.from || "", to: options.to || "", status: options.status || "All", paymentMethod: options.paymentMethod || "All" }, options.collection === "purchases");
      if (options.tradeId) filtered = filtered.filter(trade => trade.id === options.tradeId);
      if (options.contactId) filtered = filtered.filter(trade => trade.contactId === options.contactId);
      if (options.postedOnly) filtered = filtered.filter(trade => trade.status !== "draft" && trade.status !== "void");
      if (options.noContactOnly) filtered = filtered.filter(trade => !trade.contactId);
      if (options.unpaidOnly) filtered = filtered.filter(trade => balance(store, trade) !== 0);
      if (options.collection === "invoices" && options.module === "Payments" && options.paymentMethod === "Cheque") filtered = filtered.filter(trade => !trade.contactId);
      if (options.module === "Sales" || options.module === "Inventory") filtered = filtered.filter(trade => trade.status !== "draft" && trade.status !== "void");
      if (options.productId) filtered = filtered.filter(trade => trade.lines.some(line => line.productId === options.productId));
      const sorted = filtered.slice().sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number, undefined, { numeric: true }));
      const records = sorted.slice(offset, offset + pageSize).map(trade => options.productId ? { ...trade, lines: trade.lines.filter(line => line.productId === options.productId) } : trade);
      return { records, count: sorted.length, page, pageSize, aggregates: options.module === "Sales" ? { quantity: sorted.reduce((sum, trade) => sum + trade.lines.filter(line => !options.productId || line.productId === options.productId).reduce((n, line) => n + line.qty, 0), 0), revenue: profit(store, options.from || "", options.to || "").revenue } : options.module === "Billing" ? { total: sorted.reduce((sum, trade) => sum + total(trade), 0) } : undefined };
    }
    const orderBy = options.collection === "dailyCloses" ? "record->>'date' DESC, record->>'closedAt' DESC" : options.collection === "movements" ? "record->>'date' DESC, COALESCE((record->>'createdAt')::bigint,0) DESC,record_id DESC" : "ordinal DESC";
    const records = await all(`SELECT record_id,ordinal,record FROM workspace_records WHERE ${where} ORDER BY ${orderBy} LIMIT $${args.length + 1} OFFSET $${args.length + 2}`, ...args, pageSize, offset);
    const meta = options.collection === "customers" || options.collection === "suppliers" ? await contactBillCounts(w, options.collection, records.map(item => item.record.id)) : undefined;
    return { records: records.map(item => item.record), count, page, pageSize, aggregates, ...(meta ? { meta } : {}) };
  });
}
async function contactBillCounts(w: Row, collection: "customers" | "suppliers", ids: string[]) {
  if (!ids.length) return { billCounts: {} as Record<string, number>, billBalances: {} as Record<string, number> };
  const tradeCollection = collection === "customers" ? "invoices" : "purchases";
  const store = await loadWorkspaceStore(w);
  const tradeRows = await all(`SELECT record FROM workspace_records WHERE workspace=$1 AND collection=$2 AND record->>'contactId'=ANY($3::text[]) AND record->>'status' NOT IN ('draft','void')`, w.id, tradeCollection, ids);
  const rows = new Map<string, { count: number }>();
  for (const entry of tradeRows) {
    const trade = entry.record;
    const prior = rows.get(trade.contactId) || { count: 0 };
    prior.count++;
    rows.set(trade.contactId, prior);
  }
  return {
    billCounts: Object.fromEntries([...rows].map(([id, item]) => [id, item.count])) as Record<string, number>,
    billBalances: Object.fromEntries(ids.map(id => [id, contactBalance(store, collection === "customers" ? "Customer" : "Supplier", id)])) as Record<string, number>,
  };
}
export async function workspaceReport(user: Row, options: { query?: string; from?: string; to?: string; status?: string; paymentMethod?: string; report: string; reportContact?: string; reportProduct?: string; manufacturer?: boolean; page?: number; pageSize?: number; all?: boolean }) {
  return transaction(async () => {
    await query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const w = await workspace(user);
    requireWorkspaceAccess(w);
    const memberRecord = await member(w, user);
    if (memberRecord.role !== "owner" && !memberRecord.modules.includes("Reports"))
      throw Object.assign(new Error("You do not have permission to view Reports."), { status: 403 });
    const store = await loadWorkspaceStore(w);
    const data = createReportData(store, {
      query: options.query || "", from: options.from || "", to: options.to || "",
      status: options.status || "All", paymentMethod: options.paymentMethod || "All",
      report: options.report, reportContact: options.reportContact || "",
      reportProduct: options.reportProduct || "", manufacturer: !!options.manufacturer && w.business_type === "manufacturer",
    });
    const count = data.rows.length;
    const pageSize = Math.max(1, Math.min(100, Math.floor(options.pageSize || 25)));
    const page = Math.max(1, Math.floor(options.page || 1));
    if (options.all) return { ...data, count, page: 1, pageSize: count || 1 };
    const offset = (page - 1) * pageSize;
    return { ...data, rows: data.rows.slice(offset, offset + pageSize), customerIds: data.customerIds?.slice(offset, offset + pageSize), count, page, pageSize };
  });
}
function trialAccess(w: Row) {
  const startedAt = w.trial_started_at ? new Date(w.trial_started_at).toISOString() : null;
  const endsAt = startedAt ? new Date(Date.parse(startedAt) + 72 * 60 * 60 * 1000).toISOString() : null;
  const revoked = !!w.access_revoked_at;
  const expired = !!endsAt && Date.now() >= Date.parse(endsAt);
  const planExpired = !!w.plan_expires_at && Date.now() >= new Date(w.plan_expires_at).getTime();
  const locked = revoked || expired && !w.plan_active || planExpired;
  return { trial: { startedAt, endsAt, active: !locked && !w.plan_active, planActive: !!w.plan_active, planExpiresAt: w.plan_expires_at ? new Date(w.plan_expires_at).toISOString() : null }, locked };
}

const ADMIN_EMAIL = "homiesbridge@gmail.com";
const ADMIN_PLANS = ["Free", "Starter", "Growth", "Business", "Pro", "Enterprise"] as const;

function signupCountry(request: Request) {
  const country = (request.headers.get("cf-ipcountry") || request.headers.get("x-vercel-ip-country") || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(country) ? country : null;
}

function planPrice(country: string | null, subscription: string) {
  const prices: Record<string, [number, number]> = {
    Starter: [999, 9990], Growth: [2499, 24990], Business: [5999, 59990],
    Pro: [5999, 59990], Enterprise: [0, 0],
  };
  const [pkrMonthly, pkrYearly] = prices[subscription] || [0, 0];
  const isPakistan = country === "PK";
  return {
    currency: isPakistan ? "PKR" : "USD",
    monthly: isPakistan ? pkrMonthly : ({ Starter: 12, Growth: 29, Business: 69, Pro: 69 }[subscription] || 0),
    yearly: isPakistan ? pkrYearly : ({ Starter: 120, Growth: 290, Business: 690, Pro: 690 }[subscription] || 0),
  };
}

function requireAdmin(user: Row) {
  if (String(user.email || "").trim().toLowerCase() !== ADMIN_EMAIL)
    throw Object.assign(new Error("Admin access is restricted."), { status: 403 });
}

export async function adminOverview(user: Row, options: { query?: string; subscription?: string; sort?: string; direction?: string; page?: number; pageSize?: number } = {}) {
  requireAdmin(user);
  return transaction(async () => {
    await query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const term = (options.query || "").trim().slice(0, 160);
    const subscription = options.subscription || "All";
    const sortColumns: Record<string, string> = {
      alphabetical: "w.name",
      accountCreated: 'u."createdAt"',
      planActivated: "w.plan_activated_at",
      planExpires: "w.plan_expires_at",
      subscription: "w.subscription",
    };
    const sortColumn = sortColumns[options.sort || "alphabetical"] || "w.name";
    const direction = options.direction === "desc" ? "DESC" : "ASC";
    const pageSize = Math.max(1, Math.min(50, Math.floor(options.pageSize || 10)));
    const page = Math.max(1, Math.floor(options.page || 1));
    const predicates = ["($1 = '' OR w.name ILIKE '%' || $1 || '%' OR u.name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%' OR w.id ILIKE '%' || $1 || '%')", "($2 = 'All' OR w.subscription = $2)"];
    const params = [term, subscription];
    const where = predicates.join(" AND ");
    const count = Number((await row(`SELECT COUNT(*)::int AS count FROM workspaces w JOIN users u ON u.id=w.owner WHERE ${where}`, ...params))?.count || 0);
    const offset = (page - 1) * pageSize;
    const workspaces = await all(
      `SELECT w.id, w.name, w.subscription, w.revision, w.trial_started_at, w.plan_active, w.plan_activated_at, w.plan_expires_at, w.country_code, w.access_revoked_at, u.id AS owner_id, u.name AS owner_name, u.email AS owner_email, u."createdAt" AS owner_created_at,
        (SELECT COUNT(*)::int FROM workspace_records r WHERE r.workspace=w.id AND r.collection='products') AS product_count,
        (SELECT COUNT(*)::int FROM workspace_records r WHERE r.workspace=w.id AND r.collection='purchases') AS purchase_count,
        (SELECT COUNT(*)::int FROM workspace_records r WHERE r.workspace=w.id AND r.collection='customers') AS customer_count,
        (SELECT COUNT(*)::int FROM workspace_records r WHERE r.workspace=w.id AND r.collection='suppliers') AS supplier_count,
        (SELECT COUNT(*)::int FROM members m WHERE m.workspace=w.id) AS member_count,
        (SELECT COUNT(*)::int FROM users workforce JOIN members wm ON wm."user"=workforce.id WHERE wm.workspace=w.id AND wm."user"<>w.owner AND workforce.email <> '') AS workforce_email_count,
        (SELECT COUNT(*)::int FROM events e WHERE e.workspace=w.id) AS activity_count,
        (SELECT MAX(e."receivedAt") FROM events e WHERE e.workspace=w.id AND COALESCE(e.action,'') <> 'Plan renewal reminder') AS last_activity_at,
        (SELECT COUNT(*)::int FROM events e WHERE e.workspace=w.id AND e.action ILIKE '%sale%') AS sales_count
       FROM workspaces w JOIN users u ON u.id=w.owner WHERE ${where} ORDER BY ${sortColumn} ${direction} NULLS LAST, w.id ${direction} LIMIT $3 OFFSET $4`,
      ...params, pageSize, offset,
    );
    return {
      plans: ADMIN_PLANS,
      totals: {
        users: (await row("SELECT COUNT(*)::int AS count FROM users"))?.count || 0,
        workspaces: Number((await row("SELECT COUNT(*)::int AS count FROM workspaces"))?.count || 0),
        workforceEmails: Number((await row("SELECT COUNT(*)::int AS count FROM users workforce JOIN members wm ON wm.\"user\"=workforce.id JOIN workspaces w ON w.id=wm.workspace WHERE wm.\"user\"<>w.owner AND workforce.email <> ''"))?.count || 0),
      },
      filteredCount: count,
      page,
      pageSize,
      workspaces: workspaces.map((item) => {
        return {
          id: item.id,
          name: item.name,
          owner: { id: item.owner_id, name: item.owner_name, email: item.owner_email },
          subscription: item.subscription,
          accountCreatedAt: item.owner_created_at,
          trialStartedAt: item.trial_started_at,
          planActive: !!item.plan_active,
          planActivatedAt: item.plan_activated_at,
          planExpiresAt: item.plan_expires_at,
          accessRevokedAt: item.access_revoked_at,
          locked: trialAccess(item).locked,
          trialEndsAt: item.trial_started_at ? new Date(new Date(item.trial_started_at).getTime() + 72 * 60 * 60 * 1000).toISOString() : null,
          countryCode: item.country_code?.trim() || null,
          price: planPrice(item.country_code?.trim() || null, item.subscription),
          memberCount: Number(item.member_count),
          workforceEmailCount: Number(item.workforce_email_count),
          usage: {
            products: Number(item.product_count),
            sales: Number(item.sales_count),
            purchases: Number(item.purchase_count),
            customers: Number(item.customer_count),
            suppliers: Number(item.supplier_count),
            activity: Number(item.activity_count),
            revision: Number(item.revision),
          },
          lastActivityAt: item.last_activity_at,
        };
      }),
    };
  });
}

export async function updateAdminSubscription(user: Row, body: Row) {
  requireAdmin(user);
  const workspaceId = required(body.workspaceId, 200);
  const subscription = required(body.subscription, 40);
  if (!(ADMIN_PLANS as readonly string[]).includes(subscription))
    throw new Error("Choose a valid subscription.");
  const term = body.term === "monthly" || body.term === "yearly" ? body.term : null;
  if (subscription !== "Free" && !term) throw new Error("Choose a monthly or yearly plan term.");
  const current = await row("SELECT subscription, plan_active FROM workspaces WHERE id=$1", workspaceId);
  if (!current) throw Object.assign(new Error("Workspace not found."), { status: 404 });
  if (subscription !== "Free" && current.plan_active && subscription !== current.subscription)
    throw Object.assign(new Error("Cancel the active plan before changing its plan."), { status: 409 });
  const result = await query(
    `UPDATE workspaces
     SET subscription=$1,
         plan_active=($1 <> 'Free'),
         plan_activated_at=CASE WHEN $1='Free' THEN NULL ELSE COALESCE(plan_activated_at,NOW()) END,
         plan_expires_at=CASE WHEN $1='Free' THEN NULL ELSE CASE WHEN plan_active AND plan_expires_at > NOW() THEN plan_expires_at ELSE NOW() + CASE WHEN $3='yearly' THEN INTERVAL '1 year' ELSE INTERVAL '1 month' END END END,
         access_revoked_at=CASE WHEN $1='Free' THEN NOW() ELSE NULL END
     WHERE id=$2
     RETURNING id, subscription, plan_active, plan_expires_at`,
    [subscription, workspaceId, term],
  );
  if (!result.rowCount) throw Object.assign(new Error("Workspace not found."), { status: 404 });
  await query(
    `DELETE FROM events
     WHERE workspace=$1 AND action='Plan renewal reminder' AND "emailStatus" <> 'sent'`,
    [workspaceId],
  );
  const activated = result.rows[0].plan_active && result.rows[0].plan_expires_at;
  if (activated) {
    const expiresAt = new Date(result.rows[0].plan_expires_at);
    await query(
      `INSERT INTO events(id,workspace,actor,module,action,records,"occurredAt","receivedAt","emailStatus","nextAttempt")
       VALUES($1,$2,$3,$4,$5,$6,$7,$7,'queued',$8)`,
      [
        randomUUID(),
        workspaceId,
        "StockHale <alerts@stockhale.app>",
        "Billing",
        "Plan renewal reminder",
        `${result.rows[0].subscription} plan expires at ${expiresAt.toISOString()}. Renew your plan to keep access active.`,
        new Date().toISOString(),
        Math.max(0, expiresAt.getTime() - 24 * 60 * 60 * 1000),
      ],
    );
  }
  return { ok: true, workspaceId, subscription: result.rows[0].subscription, planActive: !!result.rows[0].plan_active, planExpiresAt: result.rows[0].plan_expires_at, appliedAt: new Date().toISOString() };
}

export async function renewAdminSubscription(user: Row, body: Row) {
  requireAdmin(user);
  const workspaceId = required(body.workspaceId, 200);
  const term = body.term === "monthly" || body.term === "yearly" ? body.term : null;
  if (!term) throw new Error("Choose a monthly or yearly renewal term.");
  const result = await query(
    `UPDATE workspaces
     SET plan_active=TRUE,
         plan_activated_at=COALESCE(plan_activated_at,NOW()),
         plan_expires_at=NOW() + CASE WHEN $2='yearly' THEN INTERVAL '1 year' ELSE INTERVAL '1 month' END,
         access_revoked_at=NULL
     WHERE id=$1 AND subscription <> 'Free' AND plan_active=FALSE
     RETURNING id, subscription, plan_expires_at`,
    [workspaceId, term],
  );
  if (!result.rowCount) throw Object.assign(new Error("This plan is active already or no paid plan is selected."), { status: 409 });
  const expiresAt = new Date(result.rows[0].plan_expires_at);
  await query(`DELETE FROM events WHERE workspace=$1 AND action='Plan renewal reminder' AND "emailStatus" <> 'sent'`, [workspaceId]);
  await query(
    `INSERT INTO events(id,workspace,actor,module,action,records,"occurredAt","receivedAt","emailStatus","nextAttempt")
     VALUES($1,$2,$3,'Billing','Plan renewal reminder',$4,$5,$5,'queued',$6)`,
    [randomUUID(), workspaceId, "StockHale <alerts@stockhale.app>", `${result.rows[0].subscription} plan expires at ${expiresAt.toISOString()}. Renew your plan to keep access active.`, new Date().toISOString(), Math.max(0, expiresAt.getTime() - 24 * 60 * 60 * 1000)],
  );
  return { ok: true, workspaceId, subscription: result.rows[0].subscription, planActive: true, planExpiresAt: expiresAt.toISOString() };
}

export async function cancelAdminSubscription(user: Row, body: Row) {
  requireAdmin(user);
  const workspaceId = required(body.workspaceId, 200);
  const result = await query(
    "UPDATE workspaces SET subscription='Free', plan_active=FALSE, plan_expires_at=NOW(), access_revoked_at=NOW() WHERE id=$1 AND plan_active=TRUE RETURNING id",
    [workspaceId],
  );
  if (!result.rowCount) throw Object.assign(new Error("No active plan found for this workspace."), { status: 409 });
  return { ok: true, workspaceId, subscription: "Free", planActive: false, appliedAt: new Date().toISOString() };
}

export async function publicTestimonials() {
  const testimonials = await all(
    `SELECT id, name, business, quote, rating FROM testimonials WHERE status='approved' ORDER BY "reviewedAt" DESC, "createdAt" DESC LIMIT 12`,
  );
  return { testimonials };
}

export async function submitTestimonial(user: Row, body: Row) {
  const quote = required(body.quote, 1200);
  const name = required(body.name, 120);
  const business = typeof body.business === "string" ? body.business.trim().slice(0, 160) : "";
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    throw new Error("Choose a rating from 1 to 5.");
  const w = await workspace(user);
  requireWorkspaceAccess(w);
  owner(w, user);
  await query(
    `INSERT INTO testimonials(id, workspace, owner, name, business, quote, rating, status) VALUES($1,$2,$3,$4,$5,$6,$7,'pending')`,
    [randomUUID(), w.id, user.id, name, business, quote, rating],
  );
  return { ok: true };
}

export async function adminTestimonials(user: Row) {
  requireAdmin(user);
  return { testimonials: await all(`SELECT t.id, t.name, t.business, t.quote, t.rating, t.status, t."createdAt", w.name AS "workspaceName", u.email AS "ownerEmail" FROM testimonials t JOIN workspaces w ON w.id=t.workspace JOIN users u ON u.id=t.owner ORDER BY CASE WHEN t.status='pending' THEN 0 ELSE 1 END, t."createdAt" DESC`) };
}

export async function reviewTestimonial(user: Row, body: Row) {
  requireAdmin(user);
  const id = required(body.id, 100);
  const status = required(body.status, 20);
  if (status !== "approved" && status !== "denied") throw new Error("Choose approve or deny.");
  const result = await query(`UPDATE testimonials SET status=$1, "reviewedAt"=NOW(), "reviewedBy"=$2 WHERE id=$3 AND status='pending' RETURNING id`, [status, user.id, id]);
  if (!result.rowCount) throw Object.assign(new Error("This testimonial is no longer pending."), { status: 409 });
  return { ok: true };
}
async function readSnapshot(user: Row, existingWorkspace?: Row, details = true) {
  const w = existingWorkspace || await workspace(user);
  const m = await member(w, user);
  return {
    id: w.id,
    name: w.name,
    businessType: w.business_type || null,
    image: w.image,
    timeZone: w.time_zone || "UTC",
    revision: w.revision,
    store: await loadWorkspaceStore(w),
    member: m,
    members:
      details && m.role === "owner"
        ? (await all(
            'SELECT users.id,users.name,users.email,members.modules FROM users JOIN members ON members."user"=users.id WHERE members.workspace=$1',
            w.id,
          )).map((u): Member => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: w.owner === u.id ? "owner" : "member",
            modules: JSON.parse(u.modules),
          }))
        : [],
    audit:
      details && m.role === "owner"
        ? await all(
            'SELECT id,actor,module,action,records,"occurredAt","receivedAt","emailStatus" FROM events WHERE workspace=$1 ORDER BY "receivedAt" DESC LIMIT 300',
            w.id,
          )
        : [],
    readEvent:
      (
        await row(
          'SELECT event FROM reads WHERE workspace=$1 AND "user"=$2',
          w.id,
          user.id,
        )
      )?.event || "",
    emailConfigured: !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM),
    ...trialAccess(w),
  };
}
export async function authenticate(body: Row, request: Request) {
  const publicSignupDisabled =
    process.env.DISABLE_PUBLIC_SIGNUP === "true";
  if (body.action === "signup" && publicSignupDisabled)
    throw Object.assign(new Error("New account signup is currently unavailable."), {
      status: 403,
    });
  const mail = email(body.email);
  if (
    typeof body.password !== "string" ||
    !body.password ||
    body.password.length > 128
  )
    throw new Error("Enter a password of at most 128 characters.");
  const password = body.password;
  const clientIp = trustedClientIp(request);
  if (!clientIp && process.env.NODE_ENV === "production")
    throw Object.assign(
      new Error("Sign-in protection is unavailable for this request."),
      { status: 503 },
    );
  // Use the trusted edge address in production so an attacker cannot exhaust
  // another user's sign-in bucket by supplying only the victim's email.
  const key = clientIp
    ? "auth-ip:" + digest(clientIp)
    : "auth:" + mail;
  await consumeLimit(key, clientIp ? 100 : 20, 900_000);
  return transaction(async (client) => {
    const auth = getAuth(client, body.action === "team-signup");
    if (body.action !== "signup" && body.action !== "team-signup") {
      const result = await auth.api.signInEmail({
        body: { email: mail, password },
        headers: request.headers,
        returnHeaders: true,
      });
      const countryCode = signupCountry(request);
      if (countryCode)
        await query("UPDATE workspaces SET country_code=COALESCE(country_code,$1) WHERE owner=$2", [countryCode, result.response.user.id]);
      await query("DELETE FROM limits WHERE key=$1", [key]);
      return { user: result.response.user, headers: result.headers };
    }
    if (body.action === "team-signup" && !body.invite)
      throw new Error("Open the signup link provided by your workspace owner.");
    const name = required(body.name);
    const storeName = body.invite ? "" : required(body.storeName);
    const invite = body.invite
      ? await row(
          "SELECT * FROM invites WHERE token=$1 AND email=$2 AND expires>$3 FOR UPDATE",
          digest(required(body.invite)),
          mail,
          Date.now(),
        )
      : undefined;
    if (body.invite && !invite)
      throw new Error("Invitation expired or does not match your email.");
    const result = await auth.api.signUpEmail({
      body: { email: mail, password, name },
      headers: request.headers,
      returnHeaders: true,
    });
    const user = result.response.user;
    if (invite) {
      await query(
        'INSERT INTO members(workspace,"user",modules) VALUES($1,$2,$3)',
        [invite.workspace, user.id, invite.modules],
      );
      await query("DELETE FROM invites WHERE token=$1", [invite.token]);
    } else {
      const wid = randomUUID();
      await query(
        "INSERT INTO workspaces(id,name,owner,store,trial_started_at,subscription,plan_active,country_code) VALUES($1,$2,$3,$4,NOW(),'Growth',FALSE,$5)",
        [wid, storeName, user.id, JSON.stringify(emptyStore()), signupCountry(request)],
      );
      await query(
        'INSERT INTO members(workspace,"user",modules) VALUES($1,$2,$3)',
        [wid, user.id, JSON.stringify(modules)],
      );
    }
    await query("DELETE FROM limits WHERE key=$1", [key]);
    return { user, headers: result.headers };
  });
}
export async function requestPasswordReset(body: Row, request: Request) {
  if (!passwordResetDeliveryConfigured())
    throw Object.assign(
      new Error("Password reset is unavailable until RESEND_API_KEY and RESEND_FROM are configured."),
      { status: 503 },
    );
  const mail = email(body.email);
  const clientIp = trustedClientIp(request);
  if (!clientIp && process.env.NODE_ENV === "production")
    throw Object.assign(
      new Error("Password reset protection is unavailable for this request."),
      { status: 503 },
    );
  if (clientIp)
    await consumeLimit("reset-ip:" + digest(clientIp), 20, 900_000);
  await consumeLimit("reset-email:" + digest(mail), 5, 3_600_000);
  await getAuth().api.requestPasswordReset({
    body: { email: mail },
    headers: request.headers,
  });
  // Do not reveal whether this address belongs to an account.
  return { ok: true };
}
export async function resetPassword(body: Row, request: Request) {
  if (typeof body.password !== "string" || body.password.length > 128)
    throw new Error("Enter a password of at most 128 characters.");
  await getAuth().api.resetPassword({
    body: { newPassword: body.password, token: required(body.token, 500) },
    headers: request.headers,
  });
  return { ok: true };
}
export async function mutate(user: Row, body: Row) {
  return transaction(async () => {
    const w = await workspace(user, true);
    if (body.action !== "business-setup") requireWorkspaceAccess(w);
    if (body.action === "sync") {
      const m = await member(w, user);
      // The browser submits one ordered change at a time so every accepted
      // revision can be acknowledged before later snapshots are attempted.
      if (!Array.isArray(body.changes) || body.changes.length > 1)
        throw new Error("Invalid sync batch.");
      const beforeStore = await loadWorkspaceStore(w);
      let store = beforeStore,
        revision = w.revision;
      const accepted: string[] = [];
      let canonicalDelta: StoreDelta = {};
      let needsSnapshot = false;
      for (const c of body.changes) {
        if (c.actorId !== user.id)
          throw Object.assign(
            new Error("Sign in as the user who created these pending changes."),
            { status: 403 },
          );
        if (
          await row(
            "SELECT id FROM events WHERE id=$1 AND workspace=$2",
            c.id,
            w.id,
          )
        ) {
          accepted.push(c.id);
          needsSnapshot = true;
          continue;
        }
        if (body.revision + accepted.length !== revision)
          throw Object.assign(
            new Error(
              "Records changed on the server. Export pending changes, then resolve the conflict before retrying.",
            ),
            { status: 409 },
          );
        if (m.role !== "owner" && !m.modules.includes(c.module))
          throw Object.assign(
            new Error(
              "Module permission was revoked. Pending records are preserved.",
            ),
            { status: 403 },
          );
        if (c.module === "Production" && w.business_type !== "manufacturer")
          throw Object.assign(new Error("Production is available only in manufacturer workspaces."), { status: 403 });
        required(c.id);
        required(c.action, 300);
        if (!Number.isFinite(Date.parse(c.occurredAt)))
          throw new Error("Invalid event time.");
        const submittedStore = c.delta && typeof c.delta === "object" && !Array.isArray(c.delta)
          ? applyStoreDelta(store, c.delta)
          : c.store ? normalizeStore(c.store) : (() => { throw new Error("Invalid sync change."); })();
        const validationStartedAt = Date.now();
        const { store: nextStore, records } = prepareSyncChange(store, { ...c, store: submittedStore }, { actor: m, occurredAt: c.occurredAt, receivedAt: new Date().toISOString() });
        console.info("Workspace sync validation timing", { validationMs: Date.now() - validationStartedAt });
        canonicalDelta = createStoreDelta(submittedStore, nextStore);
        await event(w, user, c.module, c.action, records, c.id, c.occurredAt);
        store = nextStore;
        revision++;
        accepted.push(c.id);
      }
      const writeStartedAt = Date.now();
      await persistWorkspaceStore(w, beforeStore, store, revision);
      console.info("Workspace sync write timing", { writeMs: Date.now() - writeStartedAt });
      return { accepted, revision, canonicalDelta, workspaceId: w.id, needsSnapshot };
    }
    if (body.action === "reopen-day") {
      const m = await member(w, user);
      if (m.role !== "owner" && !m.modules.includes("Closing"))
        throw Object.assign(new Error("You do not have permission for Closing."), { status: 403 });
      const password = required(body.password, 128);
      await consumeLimit(`reopen-owner:${digest(w.owner)}:${digest(user.id)}`, 5, 900_000);
      const account = await row(
        'SELECT password FROM auth_accounts WHERE "userId"=$1 AND "providerId"=$2 LIMIT 1',
        w.owner,
        "credential",
      );
      if (!account?.password) throw new Error("The workspace owner has no password credential.");
      const hash = String(account.password);
      const legacy = /^stockwell-legacy:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(hash);
      const matches = legacy
        ? timingSafeEqual(scryptSync(password, legacy[1], 64), Buffer.from(legacy[2], "hex"))
        : await verifyPassword({ hash, password });
      if (!matches) throw new Error("Owner password is incorrect.");
      const reason = required(body.reason, 2000);
      const before = await loadWorkspaceStore(w);
      const after = reopenDay(before, required(body.closingId), reason, { id: w.owner, role: "owner" });
      const occurredAt = new Date().toISOString();
      const records = verifyChange(before, after, "Closing", { actor: { id: w.owner, role: "owner", modules: [] }, occurredAt, receivedAt: occurredAt });
      const updated = await query("UPDATE workspaces SET revision=revision+1 WHERE id=$1 AND revision=$2", [w.id, w.revision]);
      if (!updated.rowCount) throw Object.assign(new Error("Workspace changed. Reload and try again."), { status: 409 });
      await persistWorkspaceStore(w, before, after, Number(w.revision) + 1);
      await event(w, user, "Closing", "Daily close reopened with workspace owner password approval", records, randomUUID(), occurredAt);
      return readSnapshot(user);
    }
    if (body.action === "development-reset") {
      if (process.env.NODE_ENV !== "development")
        throw Object.assign(new Error("Development cleanup is available only on the development server."), { status: 403 });
      const m = await member(w, user);
      if (m.role !== "owner")
        throw Object.assign(new Error("Only the workspace owner can clear development records."), { status: 403 });
      if (Array.isArray(body.confirmation) || typeof body.confirmation !== "string" || body.confirmation.length > 200 || body.confirmation !== w.name)
        throw new Error("Type the exact workspace name to confirm development cleanup.");
      if (body.revision !== w.revision)
        throw Object.assign(new Error("Workspace changed. Reload and review cleanup again."), { status: 409 });
      const before = await loadWorkspaceStore(w);
      const removed = Object.fromEntries(Object.entries(before).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0]));
      const reason = `Development workspace records cleared by ${user.name} <${user.email}>.`;
      await event(w, user, "Settings", "Development cleanup pre-reset snapshot", JSON.stringify({ store: before, revision: w.revision, savedAt: new Date().toISOString(), reason }));
      await persistWorkspaceStore(w, before, emptyStore(), Number(w.revision) + 1);
      await event(w, user, "Settings", "Development workspace records cleared", JSON.stringify({ removed, reason }));
      return readSnapshot(user);
    }
    owner(w, user);
    if (body.action === "backup" || body.action === "backup-recovery") {
      const audit = await all('SELECT id,actor,module,action,records,"occurredAt","receivedAt","emailStatus" FROM events WHERE workspace=$1 ORDER BY "receivedAt" DESC,id DESC', w.id);
      const beforeStore = await loadWorkspaceStore(w);
      let store = beforeStore;
      if (body.action === "backup-recovery") {
        const point = await row("SELECT records FROM events WHERE id=$1 AND workspace=$2 AND action=ANY($3::text[])", required(body.eventId), w.id, ["Pre-restore safety snapshot", "Development cleanup pre-reset snapshot"]);
        if (!point) throw new Error("Recovery point not found.");
        store = JSON.parse(point.records).store;
      }
      const backup = { format: "stockwell-backup" as const, version: 1 as const, workspaceId: w.id, workspaceName: w.name, revision: w.revision, exportedAt: new Date().toISOString(), store, audit: audit as any, checksum: "" };
      backup.checksum = await backupChecksum(backup);
      return { backup };
    }
    if (body.action === "restore") {
      if (body.revision !== w.revision) throw Object.assign(new Error("Workspace changed. Reload and review the restore again."), { status: 409 });
      if (body.confirmation !== w.name) throw new Error("Type the exact workspace name to confirm restore.");
      const reason = required(body.reason, 2000), backup = await validateRecoveryBackup(body.backup, w.id);
      const beforeStore = await loadWorkspaceStore(w);
      await event(w, user, "Settings", "Pre-restore safety snapshot", JSON.stringify({ store: beforeStore, revision: w.revision, savedAt: new Date().toISOString(), reason }));
      const existingAudit = await all("SELECT id,workspace FROM events WHERE id=ANY($1::text[])", backup.audit.map(a => a.id));
      if (existingAudit.some(a => a.workspace !== w.id)) throw new Error("Backup audit ID belongs to another workspace.");
      const existingIds = new Set(existingAudit.map(a => a.id)), missing = backup.audit.filter(a => !existingIds.has(a.id));
      for (let offset = 0; offset < missing.length; offset += 500) {
        await query(`INSERT INTO events(id,workspace,actor,module,action,records,"occurredAt","receivedAt","emailStatus")
          SELECT e.id,$1,e.actor,e.module,e.action,e.records,e."occurredAt",e."receivedAt",'sent'
          FROM jsonb_to_recordset($2::jsonb) AS e(id text,actor text,module text,action text,records text,"occurredAt" text,"receivedAt" text)`, [w.id, JSON.stringify(missing.slice(offset, offset + 500))]);
      }
      await persistWorkspaceStore(w, beforeStore, backup.store, Number(w.revision) + 1);
      await event(w, user, "Settings", "Backup restored", JSON.stringify({ reason, exportedAt: backup.exportedAt, restoredRevision: backup.revision, previousRevision: w.revision }));
      return {};
    }
    if (body.action === "approve-offline-expense") {
      if (body.revision !== w.revision) throw Object.assign(new Error("Workspace changed before approval. Reload and review again."), { status: 409 });
      const c = body.change, reason = required(body.reason, 2000);
      if (!c || c.module !== "Expenses" || !await row('SELECT "user" FROM members WHERE workspace=$1 AND "user"=$2', w.id, c.actorId)) throw new Error("Choose a pending expense from a current workspace member.");
      if (await row("SELECT id FROM events WHERE id=$1 AND workspace=$2", c.id, w.id)) throw new Error("This change was already accepted.");
      const records = verifyChange(await loadWorkspaceStore(w), c.store, c.module, { actor: { id: c.actorId, role: "member" }, occurredAt: c.occurredAt, receivedAt: new Date().toISOString(), allowLateExpense: true });
      await event(w, user, "Expenses", "Approved offline expense", JSON.stringify({ originalActor: c.actorId, reason, records }), required(c.id), c.occurredAt);
      await persistWorkspaceStore(w, await loadWorkspaceStore(w), c.store, Number(w.revision) + 1);
      return {};
    }
    if (body.action === "import") {
      if (w.revision !== 0)
        throw new Error("Import is available only for a new empty workspace.");
      const store = body.store;
      if (
        !store ||
        store.version !== 1 ||
        Object.keys(emptyStore()).some(
          (k) => k !== "version" && !Array.isArray(store[k]),
        )
      )
        throw new Error("Invalid legacy records.");
      if (store.accounts !== undefined && !Array.isArray(store.accounts)) throw new Error("Invalid account records.");
      if (store.journals !== undefined && !Array.isArray(store.journals)) throw new Error("Invalid journal records.");
      validateStore(store);
      validateAccounts(store);
      validateJournals(store);
      if (store.bankVouchers !== undefined && !Array.isArray(store.bankVouchers)) throw new Error("Invalid bank voucher records.");
      validateBanks(store);
      await persistWorkspaceStore(w, await loadWorkspaceStore(w), store, 1);
      await event(
        w,
        user,
        "Settings",
        "Imported previous browser records",
        "Legacy retail records imported",
      );
    } else if (body.action === "settings") {
      const name = required(body.name);
      const image = body.image || "";
      const timeZone = body.timeZone === undefined ? (w.time_zone || "UTC") : validTimeZone(body.timeZone);
      if (
        typeof image !== "string" ||
        image.length > 700000 ||
        (image &&
          !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image))
      )
        throw new Error("Choose a PNG, JPEG or WebP image under 500 KB.");
      await query("UPDATE workspaces SET name=$1,image=$2,time_zone=$3 WHERE id=$4", [
        name,
        image,
        timeZone,
        w.id,
      ]);
      await event(
        w,
        user,
        "Settings",
        "Store profile updated",
        `Store name: ${name}; image ${image ? "set" : "removed"}; daily digest time zone: ${timeZone}`,
      );
    } else if (body.action === "business-setup") {
      if (user.id !== w.owner) throw Object.assign(new Error("Only the workspace owner can complete business setup."), { status: 403 });
      if (w.business_type) throw new Error("Business type has already been selected.");
      if (body.businessType !== "retail" && body.businessType !== "manufacturer") throw new Error("Choose retail or manufacturer.");
      await query("UPDATE workspaces SET business_type=$1 WHERE id=$2 AND business_type IS NULL", [body.businessType, w.id]);
      await event(w, user, "Settings", "Business type selected", body.businessType === "manufacturer" ? "Manufacturer" : "Retail / other business");
      return await readSnapshot(user, { ...w, business_type: body.businessType });
    } else if (["invite", "add-member"].includes(body.action)) {
      const mail = email(body.email);
      const allowed = validateModules(body.modules);
      if (!allowed.length) throw new Error("Select at least one module for the team member.");
      const existing = await row("SELECT * FROM users WHERE email=$1", mail);
      if (existing)
        throw new Error(
          "This email already has an account. Use a new email for this team member.",
        );
      const token = randomBytes(32).toString("hex");
      await query("DELETE FROM invites WHERE workspace=$1 AND email=$2", [w.id, mail]);
      await query("INSERT INTO invites VALUES($1,$2,$3,$4,$5)", [
        digest(token),
        w.id,
        mail,
        JSON.stringify(allowed),
        Date.now() + 7 * 86400000,
      ]);
      await event(
        w,
        user,
        "Settings",
        "Team member added",
        `${mail}: ${allowed.join(", ")}`,
      );
      return { invite: token };
    } else if (body.action === "permissions") {
      if (body.user === w.owner)
        throw new Error("Owner access cannot be removed.");
      const allowed = validateModules(body.modules);
      const result = await query(
        'UPDATE members SET modules=$1 WHERE workspace=$2 AND "user"=$3',
        [JSON.stringify(allowed), w.id, body.user],
      );
      if (!result.rowCount) throw new Error("Member not found.");
      await event(
        w,
        user,
        "Settings",
        "Module permissions updated",
        `${body.user}: ${allowed.join(", ")}`,
      );
    } else if (body.action === "read") {
      await query(
        'INSERT INTO reads VALUES($1,$2,$3) ON CONFLICT(workspace,"user") DO UPDATE SET event=EXCLUDED.event',
        [w.id, user.id, String(body.event || "")],
      );
    } else if (body.action !== "retry-email")
      throw new Error("Unknown action.");
    return {};
  });
}
function validateModules(value: unknown) {
  if (!Array.isArray(value) || value.some((m) => !modules.includes(m)))
    throw new Error("Invalid permissions.");
  return [...new Set(value)];
}
export async function logout(request: Request) {
  const result = await getAuth().api.signOut({
    headers: request.headers,
    returnHeaders: true,
  });
  return result.headers;
}
export function activityDigestDue(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "00";
  const localDate = `${part("year")}-${part("month")}-${part("day")}`;
  return {
    date: localDate,
    due: Number(part("hour")) * 60 + Number(part("minute")) >= 23 * 60 + 58,
  };
}
let delivering = false;
export async function deliverEmails() {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM)
    return;
  if (delivering) return;
  delivering = true;
  try {
    // Non-digest messages (currently plan reminders) retain immediate delivery.
    for (const e of await all(
      `WITH due AS (
         SELECT id FROM events WHERE "emailStatus" <> 'sent' AND "nextAttempt" <= $1
           AND action='Plan renewal reminder' ORDER BY "receivedAt" LIMIT 10 FOR UPDATE SKIP LOCKED
       ), claimed AS (
         UPDATE events SET "nextAttempt"=$2 FROM due WHERE events.id=due.id RETURNING events.*
       )
       SELECT claimed.*, users.email, workspaces.name FROM claimed
       JOIN workspaces ON claimed.workspace=workspaces.id JOIN users ON workspaces.owner=users.id`,
      Date.now(), Date.now() + 120000,
    )) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `stockwell/${e.id}` },
          body: JSON.stringify({ from: process.env.RESEND_FROM, to: [e.email], subject: `${e.name}: ${e.action}`, text: `${e.actor}\n${e.module}: ${e.action}\nRecords: ${e.records}\nAction time: ${e.occurredAt}\nSynced: ${e.receivedAt}` }),
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error("Email provider rejected delivery");
        await query('UPDATE events SET "emailStatus"=\'sent\' WHERE id=$1', [e.id]);
      } catch {
        await query('UPDATE events SET "emailStatus"=\'retrying\',attempts=attempts+1,"nextAttempt"=$1 WHERE id=$2', [Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(e.attempts, 7)), e.id]);
      }
    }

    const workspaces = await all(
      `SELECT w.id,w.name,w.owner,w.time_zone,w."digestDate",u.email
       FROM workspaces w JOIN users u ON w.owner=u.id
       WHERE w."digestLease" <= $1 AND EXISTS (SELECT 1 FROM events e WHERE e.workspace=w.id AND e."emailStatus" <> 'sent' AND e."nextAttempt" <= $1 AND e.action NOT IN ('Plan renewal reminder','Pre-restore safety snapshot'))
       ORDER BY w.id LIMIT 20`,
      Date.now(),
    );
    for (const w of workspaces) {
      const claimed = await row('UPDATE workspaces SET "digestLease"=$1 WHERE id=$2 AND "digestLease" <= $3 RETURNING id', Date.now() + 120000, w.id, Date.now());
      if (!claimed) continue;
      const { date: today, due } = activityDigestDue(new Date(), w.time_zone || "UTC");
      const dueDate = w.digestDate ? String(w.digestDate).slice(0, 10) : null;
      // Keep the 23:58 due window open through local midnight, and send each
      // date only once. A delayed scheduled tick must not lose the digest.
      if (!due || dueDate === today) {
        await query('UPDATE workspaces SET "digestLease"=0 WHERE id=$1', [w.id]);
        continue;
      }
      const events = await all(
        `SELECT id,actor,module,action,records,"occurredAt","receivedAt",attempts FROM events
         WHERE workspace=$1 AND "emailStatus" <> 'sent' AND "nextAttempt" <= $2 AND action NOT IN ('Plan renewal reminder','Pre-restore safety snapshot')
         ORDER BY "receivedAt",id LIMIT 500`, w.id, Date.now(),
      );
      if (!events.length) { await query('UPDATE workspaces SET "digestLease"=0 WHERE id=$1', [w.id]); continue; }
      const ids = events.map((e) => e.id);
      const digestKey = `stockwell/digest/${w.id}/${today}`;
      try {
        const rows = events.map((e) => `• ${e.actor}\n  ${e.module}: ${e.action}\n  Records: ${e.records}\n  Action time: ${e.occurredAt}\n  Synced: ${e.receivedAt}`).join("\n\n");
        const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": digestKey,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM,
          to: [w.email],
          subject: `${w.name}: daily activity summary (${today})`,
          text: `Activity for ${today} (${w.time_zone || "UTC"})\n\n${rows}`,
        }),
        signal: AbortSignal.timeout(8000),
      });
        if (!response.ok) throw new Error("Email provider rejected delivery");
        await query('UPDATE events SET "emailStatus"=\'sent\' WHERE id=ANY($1::text[])', [ids]);
        await query('UPDATE workspaces SET "digestDate"=$1,"digestLease"=0 WHERE id=$2', [today, w.id]);
      } catch {
        const attempts = Math.max(...events.map((e) => Number(e.attempts || 0)));
        await query('UPDATE events SET "emailStatus"=\'retrying\',attempts=attempts+1,"nextAttempt"=$1 WHERE id=ANY($2::text[])', [Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(attempts, 7)), ids]);
        await query('UPDATE workspaces SET "digestLease"=0 WHERE id=$1', [w.id]);
      }
    }
  } finally {
    delivering = false;
  }
}

export async function runScheduledEmailDrain() {
  return deliverEmails();
}

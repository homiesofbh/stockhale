import { backupChecksum, validateRecoveryBackup, type RecoveryBackup } from "./recovery";
import { validateStore } from "./operation-validation";
import { validateBanks } from "./bank-vouchers";
import { validateAccounts } from "./accounts";
import { validateJournals } from "./journals";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { verifyPassword } from "better-auth/crypto";
import { isIP } from "node:net";
import { getAuth, passwordResetDeliveryConfigured } from "./auth";
import { query, transaction } from "./database";
import { emptyStore, normalizeStore, type Store } from "./model";
import { modules, verifyChange, prepareSyncChange, applyStoreDelta, createStoreDelta, type Member, type StoreDelta } from "./workspace";
import { reopenDay } from "./operations";
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
    throw Object.assign(new Error("Your 3-day trial has ended. Choose a plan to continue using StockHale."), { status: 402, code: "TRIAL_EXPIRED" });
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
    'SELECT w.id,w.revision,w.plan_active,w.trial_started_at,w.access_revoked_at FROM workspaces w JOIN members m ON m.workspace=w.id WHERE m."user"=$1',
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
function trialAccess(w: Row) {
  const startedAt = w.trial_started_at ? new Date(w.trial_started_at).toISOString() : null;
  const endsAt = startedAt ? new Date(Date.parse(startedAt) + 72 * 60 * 60 * 1000).toISOString() : null;
  const revoked = !!w.access_revoked_at;
  const expired = !!endsAt && Date.now() >= Date.parse(endsAt);
  const locked = !w.plan_active && (revoked || expired);
  return { trial: { startedAt, endsAt, active: !locked && !w.plan_active, planActive: !!w.plan_active }, locked };
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

export async function adminOverview(user: Row) {
  requireAdmin(user);
  return transaction(async () => {
    await query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
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
       FROM workspaces w JOIN users u ON u.id=w.owner ORDER BY w.name, w.id`,
    );
    return {
      plans: ADMIN_PLANS,
      totals: {
        users: (await row("SELECT COUNT(*)::int AS count FROM users"))?.count || 0,
        workspaces: workspaces.length,
        workforceEmails: workspaces.reduce((sum, item) => sum + Number(item.workforce_email_count), 0),
      },
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
  const result = await query(
    `UPDATE workspaces
     SET subscription=$1,
         plan_active=($1 <> 'Free'),
         plan_activated_at=CASE WHEN $1='Free' THEN NULL ELSE COALESCE(plan_activated_at,NOW()) END,
         plan_expires_at=CASE WHEN $1='Free' THEN NULL ELSE CASE WHEN plan_expires_at > NOW() THEN plan_expires_at ELSE NOW() + INTERVAL '30 days' END END,
         access_revoked_at=CASE WHEN $1='Free' THEN NOW() ELSE NULL END
     WHERE id=$2
     RETURNING id, subscription, plan_active, plan_expires_at`,
    [subscription, workspaceId],
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
  return { ok: true, workspaceId, subscription: result.rows[0].subscription, planActive: !!result.rows[0].plan_active, appliedAt: new Date().toISOString() };
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
    owner(w, user);
    if (body.action === "backup" || body.action === "backup-recovery") {
      const audit = await all('SELECT id,actor,module,action,records,"occurredAt","receivedAt","emailStatus" FROM events WHERE workspace=$1 ORDER BY "receivedAt" DESC,id DESC', w.id);
      const beforeStore = await loadWorkspaceStore(w);
      let store = beforeStore;
      if (body.action === "backup-recovery") {
        const point = await row("SELECT records FROM events WHERE id=$1 AND workspace=$2 AND action=$3", required(body.eventId), w.id, "Pre-restore safety snapshot");
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

import { backupChecksum, validateRecoveryBackup, type RecoveryBackup } from "./recovery";
import { validateStore } from "./operation-validation";
import { validateBanks } from "./bank-vouchers";
import { validateAccounts } from "./accounts";
import { validateJournals } from "./journals";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getAuth, passwordResetDeliveryConfigured } from "./auth";
import { query, transaction } from "./database";
import { emptyStore, normalizeStore } from "./model";
import { modules, verifyChange, type Member } from "./workspace";
export { db } from "./database";
type Row = Record<string, any>;
const row = async (sql: string, ...args: unknown[]) =>
  (await query(sql, args)).rows[0] as Row | undefined;
const all = async (sql: string, ...args: unknown[]) =>
  (await query(sql, args)).rows as Row[];
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
function required(value: unknown, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error("Required field is missing or too long.");
  return value.trim();
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
export async function snapshot(user: Row) {
  return transaction(async () => {
    await query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    return readSnapshot(user);
  });
}
async function readSnapshot(user: Row) {
  const w = await workspace(user),
    m = await member(w, user);
  return {
    id: w.id,
    name: w.name,
    image: w.image,
    revision: w.revision,
    store: normalizeStore(JSON.parse(w.store)),
    member: m,
    members:
      m.role === "owner"
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
      m.role === "owner"
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
  const key = "auth:" + mail;
  const now = Date.now();
  const limit = await row(
    `INSERT INTO limits(key,count,expires) VALUES($1,1,$2)
     ON CONFLICT(key) DO UPDATE SET
       count=CASE WHEN limits.expires <= $3 THEN 1 ELSE limits.count+1 END,
       expires=CASE WHEN limits.expires <= $3 THEN $2 ELSE limits.expires END
     RETURNING count`,
    key,
    now + 900000,
    now,
  );
  if (limit!.count > 20)
    throw Object.assign(
      new Error("Too many attempts. Try again in 15 minutes."),
      { status: 429 },
    );
  return transaction(async (client) => {
    const auth = getAuth(client, body.action === "team-signup");
    if (body.action !== "signup" && body.action !== "team-signup") {
      const result = await auth.api.signInEmail({
        body: { email: mail, password },
        headers: request.headers,
        returnHeaders: true,
      });
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
        "INSERT INTO workspaces(id,name,owner,store) VALUES($1,$2,$3,$4)",
        [wid, storeName, user.id, JSON.stringify(emptyStore())],
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
  await getAuth().api.requestPasswordReset({
    body: { email: email(body.email) },
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
    if (body.action === "sync") {
      const m = await member(w, user);
      if (!Array.isArray(body.changes) || body.changes.length > 100)
        throw new Error("Invalid sync batch.");
      let store = JSON.parse(w.store),
        revision = w.revision;
      const accepted: string[] = [];
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
        required(c.id);
        required(c.action, 300);
        if (!Number.isFinite(Date.parse(c.occurredAt)))
          throw new Error("Invalid event time.");
        const records = verifyChange(store, c.store, c.module, { actor: m, occurredAt: c.occurredAt, receivedAt: new Date().toISOString() });
        await event(w, user, c.module, c.action, records, c.id, c.occurredAt);
        store = c.store;
        revision++;
        accepted.push(c.id);
      }
      await query("UPDATE workspaces SET store=$1,revision=$2 WHERE id=$3", [
        JSON.stringify(store),
        revision,
        w.id,
      ]);
      return { accepted };
    }
    owner(w, user);
    if (body.action === "backup" || body.action === "backup-recovery") {
      const audit = await all('SELECT id,actor,module,action,records,"occurredAt","receivedAt","emailStatus" FROM events WHERE workspace=$1 ORDER BY "receivedAt" DESC,id DESC', w.id);
      let store = JSON.parse(w.store);
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
      await event(w, user, "Settings", "Pre-restore safety snapshot", JSON.stringify({ store: JSON.parse(w.store), revision: w.revision, savedAt: new Date().toISOString(), reason }));
      const existingAudit = await all("SELECT id,workspace FROM events WHERE id=ANY($1::text[])", backup.audit.map(a => a.id));
      if (existingAudit.some(a => a.workspace !== w.id)) throw new Error("Backup audit ID belongs to another workspace.");
      const existingIds = new Set(existingAudit.map(a => a.id)), missing = backup.audit.filter(a => !existingIds.has(a.id));
      for (let offset = 0; offset < missing.length; offset += 500) {
        await query(`INSERT INTO events(id,workspace,actor,module,action,records,"occurredAt","receivedAt","emailStatus")
          SELECT e.id,$1,e.actor,e.module,e.action,e.records,e."occurredAt",e."receivedAt",'sent'
          FROM jsonb_to_recordset($2::jsonb) AS e(id text,actor text,module text,action text,records text,"occurredAt" text,"receivedAt" text)`, [w.id, JSON.stringify(missing.slice(offset, offset + 500))]);
      }
      await query("UPDATE workspaces SET store=$1,revision=revision+1 WHERE id=$2", [JSON.stringify(backup.store), w.id]);
      await event(w, user, "Settings", "Backup restored", JSON.stringify({ reason, exportedAt: backup.exportedAt, restoredRevision: backup.revision, previousRevision: w.revision }));
      return {};
    }
    if (body.action === "approve-offline-expense") {
      if (body.revision !== w.revision) throw Object.assign(new Error("Workspace changed before approval. Reload and review again."), { status: 409 });
      const c = body.change, reason = required(body.reason, 2000);
      if (!c || c.module !== "Expenses" || !await row('SELECT "user" FROM members WHERE workspace=$1 AND "user"=$2', w.id, c.actorId)) throw new Error("Choose a pending expense from a current workspace member.");
      if (await row("SELECT id FROM events WHERE id=$1 AND workspace=$2", c.id, w.id)) throw new Error("This change was already accepted.");
      const records = verifyChange(JSON.parse(w.store), c.store, c.module, { actor: { id: c.actorId, role: "member" }, occurredAt: c.occurredAt, receivedAt: new Date().toISOString(), allowLateExpense: true });
      await event(w, user, "Expenses", "Approved offline expense", JSON.stringify({ originalActor: c.actorId, reason, records }), required(c.id), c.occurredAt);
      await query("UPDATE workspaces SET store=$1,revision=revision+1 WHERE id=$2", [JSON.stringify(c.store), w.id]);
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
      await query("UPDATE workspaces SET store=$1,revision=1 WHERE id=$2", [
        JSON.stringify(store),
        w.id,
      ]);
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
      if (
        typeof image !== "string" ||
        image.length > 700000 ||
        (image &&
          !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image))
      )
        throw new Error("Choose a PNG, JPEG or WebP image under 500 KB.");
      await query("UPDATE workspaces SET name=$1,image=$2 WHERE id=$3", [
        name,
        image,
        w.id,
      ]);
      await event(
        w,
        user,
        "Settings",
        "Store profile updated",
        `Store name: ${name}; image ${image ? "set" : "removed"}`,
      );
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
let delivering = false;
export async function deliverEmails() {
  if (delivering || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM)
    return;
  delivering = true;
  try {
    for (const e of await all(
      `WITH due AS (
         SELECT id FROM events WHERE "emailStatus" <> $1 AND "nextAttempt" <= $2 AND action <> 'Pre-restore safety snapshot'
         ORDER BY "receivedAt" LIMIT 10 FOR UPDATE SKIP LOCKED
       ), claimed AS (
         UPDATE events SET "nextAttempt"=$3 FROM due WHERE events.id=due.id RETURNING events.*
       )
       SELECT claimed.*,users.email,workspaces.name FROM claimed
       JOIN workspaces ON claimed.workspace=workspaces.id JOIN users ON workspaces.owner=users.id`,
      "sent",
      Date.now(),
      Date.now() + 120000,
    )) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `stockwell/${e.id}`,
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM,
            to: [e.email],
            subject: `${e.name}: ${e.action}`,
            text: `${e.actor}\n${e.module}: ${e.action}\nRecords: ${e.records}\nAction time: ${e.occurredAt}\nSynced: ${e.receivedAt}`,
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error("Email provider rejected delivery");
        await query("UPDATE events SET \"emailStatus\"='sent' WHERE id=$1", [
          e.id,
        ]);
      } catch {
        await query(
          'UPDATE events SET "emailStatus"=\'retrying\',attempts=attempts+1,"nextAttempt"=$1 WHERE id=$2',
          [
            Date.now() +
              Math.min(3600000, 30000 * 2 ** Math.min(e.attempts, 7)),
            e.id,
          ],
        );
      }
    }
  } finally {
    delivering = false;
  }
}

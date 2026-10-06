import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  randomUUID,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { emptyStore } from "./model";
import { verifyChange, modules, type Member } from "./workspace";
let database: DatabaseSync;
export function db() {
  if (!database) {
    const dir =
      process.env.STOCKWELL_DATA_DIR || path.join(process.cwd(), ".stockwell");
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    database = new DatabaseSync(path.join(dir, "workspace.sqlite"));
    database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE,name TEXT,password TEXT);
CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY,name TEXT,image TEXT DEFAULT '',owner TEXT,revision INTEGER DEFAULT 0,store TEXT);
CREATE TABLE IF NOT EXISTS members(workspace TEXT,user TEXT,modules TEXT,PRIMARY KEY(workspace,user));
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user TEXT,expires INTEGER);
CREATE TABLE IF NOT EXISTS invites(token TEXT PRIMARY KEY,workspace TEXT,email TEXT,modules TEXT,expires INTEGER);
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,workspace TEXT,actor TEXT,module TEXT,action TEXT,records TEXT,occurredAt TEXT,receivedAt TEXT,emailStatus TEXT DEFAULT 'queued',attempts INTEGER DEFAULT 0,nextAttempt INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS reads(workspace TEXT,user TEXT,event TEXT,PRIMARY KEY(workspace,user));
CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER,expires INTEGER);`);
  }
  return database;
}
type Row = Record<string, any>;
const row = (sql: string, ...args: any[]) =>
  db()
    .prepare(sql)
    .get(...args) as Row | undefined;
const all = (sql: string, ...args: any[]) =>
  db()
    .prepare(sql)
    .all(...args) as Row[];
function transaction<T>(fn: () => T): T {
  db().exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db().exec("COMMIT");
    return result;
  } catch (e) {
    db().exec("ROLLBACK");
    throw e;
  }
}
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function passwordMatches(password: string, hash: string) {
  const [salt, key] = hash.split(":");
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(key, "hex");
  return (
    expected.length === candidate.length && timingSafeEqual(expected, candidate)
  );
}
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
export function session(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("stockwell_session="))
    ?.slice(18);
  return token
    ? row(
        "SELECT users.* FROM sessions JOIN users ON sessions.user=users.id WHERE token=? AND expires>?",
        digest(token),
        Date.now(),
      )
    : undefined;
}
export function authorize(request: Request) {
  const user = session(request);
  if (!user)
    throw Object.assign(new Error("Sign in to continue."), { status: 401 });
  return user;
}
function workspace(user: Row) {
  const w = row(
    "SELECT workspaces.* FROM workspaces JOIN members ON members.workspace=workspaces.id WHERE members.user=?",
    user.id,
  );
  if (!w) throw new Error("Workspace unavailable.");
  return w;
}
function member(w: Row, u: Row): Member {
  const m = row(
    "SELECT modules FROM members WHERE workspace=? AND user=?",
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
function event(
  w: Row,
  u: Row,
  module: string,
  action: string,
  records: string,
  id = randomUUID(),
  occurredAt = new Date().toISOString(),
) {
  db()
    .prepare(
      "INSERT INTO events(id,workspace,actor,module,action,records,occurredAt,receivedAt) VALUES(?,?,?,?,?,?,?,?)",
    )
    .run(
      id,
      w.id,
      `${u.name} <${u.email}>`,
      module,
      action,
      records,
      occurredAt,
      new Date().toISOString(),
    );
}
export function snapshot(user: Row) {
  const w = workspace(user),
    m = member(w, user);
  return {
    id: w.id,
    name: w.name,
    image: w.image,
    revision: w.revision,
    store: JSON.parse(w.store),
    member: m,
    members:
      m.role === "owner"
        ? all(
            "SELECT users.* FROM users JOIN members ON members.user=users.id WHERE members.workspace=?",
            w.id,
          ).map((u) => member(w, u))
        : [],
    audit:
      m.role === "owner"
        ? all(
            "SELECT id,actor,module,action,records,occurredAt,receivedAt,emailStatus FROM events WHERE workspace=? ORDER BY receivedAt DESC LIMIT 300",
            w.id,
          )
        : [],
    readEvent:
      row("SELECT event FROM reads WHERE workspace=? AND user=?", w.id, user.id)
        ?.event || "",
    emailConfigured: !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM),
  };
}
export function authenticate(body: Row, request: Request) {
  const mail = email(body.email);
  const key = "auth:" + mail;
  transaction(() => {
    let limit = row("SELECT * FROM limits WHERE key=?", key);
    if (!limit || limit.expires < Date.now()) {
      db()
        .prepare("INSERT OR REPLACE INTO limits VALUES(?,0,?)")
        .run(key, Date.now() + 900000);
      limit = { count: 0 };
    }
    if (limit.count >= 20)
      throw new Error("Too many attempts. Try again in 15 minutes.");
    db().prepare("UPDATE limits SET count=count+1 WHERE key=?").run(key);
  });
  const password = required(body.password, 128);
  let user = row("SELECT * FROM users WHERE email=?", mail);
  if (body.action === "signup") {
    if (password.length < 12)
      throw new Error("Use a password of at least 12 characters.");
    if (user) throw new Error("Account already exists. Sign in instead.");
    const name = required(body.name);
    const invite = body.invite
      ? row(
          "SELECT * FROM invites WHERE token=? AND email=? AND expires>?",
          digest(body.invite),
          mail,
          Date.now(),
        )
      : undefined;
    if (body.invite && !invite)
      throw new Error("Invitation expired or does not match your email.");
    const id = randomUUID();
    transaction(() => {
      db()
        .prepare("INSERT INTO users VALUES(?,?,?,?)")
        .run(id, mail, name, passwordHash(password));
      if (invite) {
        db()
          .prepare("INSERT INTO members VALUES(?,?,?)")
          .run(invite.workspace, id, invite.modules);
        db().prepare("DELETE FROM invites WHERE token=?").run(invite.token);
      } else {
        const wid = randomUUID();
        db()
          .prepare(
            "INSERT INTO workspaces(id,name,owner,store) VALUES(?,?,?,?)",
          )
          .run(wid, required(body.storeName), id, JSON.stringify(emptyStore()));
        db()
          .prepare("INSERT INTO members VALUES(?,?,?)")
          .run(wid, id, JSON.stringify(modules));
      }
    });
    user = row("SELECT * FROM users WHERE id=?", id);
  } else if (!user || !passwordMatches(password, user.password))
    throw new Error("Email or password is incorrect.");
  const token = randomBytes(32).toString("hex");
  db()
    .prepare("INSERT INTO sessions VALUES(?,?,?)")
    .run(digest(token), user!.id, Date.now() + 7 * 86400000);
  db().prepare("DELETE FROM limits WHERE key=?").run(key);
  return { token, user: user! };
}
export function mutate(user: Row, body: Row) {
  const w = workspace(user);
  return transaction(() => {
    if (body.action === "sync") {
      const m = member(w, user);
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
          row("SELECT id FROM events WHERE id=? AND workspace=?", c.id, w.id)
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
        const records = verifyChange(store, c.store, c.module);
        event(w, user, c.module, c.action, records, c.id, c.occurredAt);
        store = c.store;
        revision++;
        accepted.push(c.id);
      }
      db()
        .prepare("UPDATE workspaces SET store=?,revision=? WHERE id=?")
        .run(JSON.stringify(store), revision, w.id);
      return { accepted };
    }
    owner(w, user);
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
      db()
        .prepare("UPDATE workspaces SET store=?,revision=1 WHERE id=?")
        .run(JSON.stringify(store), w.id);
      event(
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
      db()
        .prepare("UPDATE workspaces SET name=?,image=? WHERE id=?")
        .run(name, image, w.id);
      event(
        w,
        user,
        "Settings",
        "Store profile updated",
        `Store name: ${name}; image ${image ? "set" : "removed"}`,
      );
    } else if (body.action === "invite") {
      const mail = email(body.email);
      const allowed = validateModules(body.modules);
      const existing = row("SELECT * FROM users WHERE email=?", mail);
      if (existing)
        throw new Error(
          "This email already has an account. Use a new email for this workspace invitation.",
        );
      const token = randomBytes(32).toString("hex");
      db()
        .prepare("INSERT INTO invites VALUES(?,?,?,?,?)")
        .run(
          digest(token),
          w.id,
          mail,
          JSON.stringify(allowed),
          Date.now() + 7 * 86400000,
        );
      event(
        w,
        user,
        "Settings",
        "Member invited",
        `${mail}: ${allowed.join(", ")}`,
      );
      return { invite: token };
    } else if (body.action === "permissions") {
      if (body.user === w.owner)
        throw new Error("Owner access cannot be removed.");
      const allowed = validateModules(body.modules);
      const result = db()
        .prepare("UPDATE members SET modules=? WHERE workspace=? AND user=?")
        .run(JSON.stringify(allowed), w.id, body.user);
      if (!result.changes) throw new Error("Member not found.");
      event(
        w,
        user,
        "Settings",
        "Module permissions updated",
        `${body.user}: ${allowed.join(", ")}`,
      );
    } else if (body.action === "read") {
      db()
        .prepare("INSERT OR REPLACE INTO reads VALUES(?,?,?)")
        .run(w.id, user.id, String(body.event || ""));
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
export function logout(request: Request) {
  const cookie = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)stockwell_session=([^;]+)/)?.[1];
  if (cookie)
    db().prepare("DELETE FROM sessions WHERE token=?").run(digest(cookie));
}
let delivering = false;
export async function deliverEmails() {
  if (delivering || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM)
    return;
  delivering = true;
  try {
    for (const e of all(
      "SELECT events.*,users.email,workspaces.name FROM events JOIN workspaces ON events.workspace=workspaces.id JOIN users ON workspaces.owner=users.id WHERE emailStatus!=? AND nextAttempt<=? ORDER BY receivedAt LIMIT 10",
      "sent",
      Date.now(),
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
        db()
          .prepare("UPDATE events SET emailStatus='sent' WHERE id=?")
          .run(e.id);
      } catch {
        db()
          .prepare(
            "UPDATE events SET emailStatus='retrying',attempts=attempts+1,nextAttempt=? WHERE id=?",
          )
          .run(
            Date.now() +
              Math.min(3600000, 30000 * 2 ** Math.min(e.attempts, 7)),
            e.id,
          );
      }
    }
  } finally {
    delivering = false;
  }
}

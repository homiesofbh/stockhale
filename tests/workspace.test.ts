import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import { emptyStore, saveProduct } from "../lib/stockwell/model";

test("Postgres and Better Auth workspace integration", async (t) => {
  // Always use a newly created database, never tables from an existing database.
  const adminURL =
    process.env.STOCKWELL_TEST_DATABASE_URL ||
    "postgresql://localhost/postgres";
  const admin = new Client({ connectionString: adminURL });
  const name = `stockwell_test_${randomUUID().replaceAll("-", "")}`;
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(adminURL);
  url.pathname = `/${name}`;
  process.env.DATABASE_URL = url.toString();
  process.env.BETTER_AUTH_SECRET =
    "stockwell-integration-test-secret-32-characters";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
  const server = await import("../lib/stockwell/server");
  const { migrate } = await import("../scripts/migrate");
  const { closeDatabase, query } = await import("../lib/stockwell/database");
  const route = await import("../app/api/workspace/route");
  const request = (
    cookie = "",
    body?: unknown,
    origin = "http://localhost:3000",
  ) =>
    new Request("http://localhost:3000/api/workspace", {
      method: body ? "POST" : "GET",
      headers: { cookie, origin, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  const cookies = (headers: Headers) =>
    headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
  let owner: any,
    member: any,
    ownerCookie = "",
    change: any;
  const password = "a-long-test-password";
  try {
    await t.test("schema migrations are repeatable", async () => {
      await migrate();
      const before = Number((await query("SELECT COUNT(*)::int AS count FROM stockwell_migrations")).rows[0].count);
      await migrate();
      const after = Number((await query("SELECT COUNT(*)::int AS count FROM stockwell_migrations")).rows[0].count);
      assert.ok(before > 0);
      assert.equal(after, before);
    });
    await t.test(
      "signup returns real Better Auth cookies and persists hashed credentials",
      async () => {
        const res = await route.POST(
          request("", {
            action: "signup",
            email: "owner@example.test",
            name: "Owner",
            storeName: "QA Store",
            password,
          }),
        );
        assert.equal(res.status, 200, await res.clone().text());
        ownerCookie = cookies(res.headers);
        assert.match(ownerCookie, /stockwell\.session_token=/);
        assert.match(res.headers.get("set-cookie")!, /HttpOnly/i);
        assert.match(res.headers.get("set-cookie")!, /SameSite=Strict/i);
        assert.equal(res.headers.get("cache-control"), "no-store");
        owner = (await server.authorize(request(ownerCookie))).user;
        assert.equal((await server.snapshot(owner)).member.role, "owner");
        const account = (
          await query('SELECT password FROM auth_accounts WHERE "userId"=$1', [
            owner.id,
          ])
        ).rows[0];
        assert.notEqual(account.password, password);
        assert.equal((await route.GET(request(ownerCookie))).status, 200);
      },
    );
    await t.test("owner selects manufacturer workspace type once after signup", async () => {
      assert.equal((await server.snapshot(owner)).businessType, null);
      const selected = await route.POST(request(ownerCookie, { action: "business-setup", businessType: "manufacturer" }));
      assert.equal(selected.status, 200, await selected.clone().text());
      assert.equal((await selected.json()).businessType, "manufacturer");
      const changed = await route.POST(request(ownerCookie, { action: "business-setup", businessType: "retail" }));
      assert.equal(changed.status, 400);
    });
    await t.test(
      "wrong password rejected and signin succeeds with the existing form payload",
      async () => {
        const bad = await route.POST(
          request("", {
            action: "signin",
            email: owner.email,
            password: "wrong-password",
          }),
        );
        assert.equal(bad.status, 401);
        const good = await route.POST(
          request("", {
            action: "signin",
            email: owner.email,
            password,
            invite: "",
          }),
        );
        assert.equal(good.status, 200, await good.clone().text());
        assert.equal(
          (await server.authorize(request(cookies(good.headers)))).user.id,
          owner.id,
        );
      },
    );
    await t.test(
      "auth failures are persisted across server instances",
      async () => {
        for (let i = 0; i < 20; i++) {
          await assert.rejects(
            server.authenticate(
              { action: "signin", email: "limited@example.test", password },
              request(),
            ),
          );
        }
        await assert.rejects(
          server.authenticate(
            { action: "signin", email: "limited@example.test", password },
            request(),
          ),
          (e: any) => e.status === 429,
        );
        assert.equal(
          (
            await query("SELECT count FROM limits WHERE key=$1", [
              "auth:limited@example.test",
            ])
          ).rows[0].count,
          21,
        );
      },
    );
    await t.test(
      "origin checks reject cross-site writes before auth",
      async () => {
        const bad = await route.POST(
          request(
            ownerCookie,
            { action: "settings", name: "Bad" },
            "https://evil.example",
          ),
        );
        assert.equal(bad.status, 403);
        assert.equal((await server.snapshot(owner)).name, "QA Store");
      },
    );
    await t.test(
      "failed workspace creation rolls back the Better Auth account, credential and session",
      async () => {
        await query(
          "CREATE FUNCTION reject_workspace() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name='Reject' THEN RAISE EXCEPTION 'test failure'; END IF; RETURN NEW; END $$",
        );
        await query(
          "CREATE TRIGGER reject_workspace BEFORE INSERT ON workspaces FOR EACH ROW EXECUTE FUNCTION reject_workspace()",
        );
        try {
          await assert.rejects(
            server.authenticate(
              {
                action: "signup",
                email: "rollback@example.test",
                name: "Rollback",
                storeName: "Reject",
                password,
              },
              request(),
            ),
          );
          assert.equal(
            (
              await query("SELECT id FROM users WHERE email=$1", [
                "rollback@example.test",
              ])
            ).rowCount,
            0,
          );
          assert.equal(
            (await query("SELECT id FROM auth_accounts")).rowCount,
            1,
          );
          assert.equal(
            (await query("SELECT id FROM auth_sessions")).rowCount,
            2,
          );
        } finally {
          await query(
            "DROP TRIGGER reject_workspace ON workspaces; DROP FUNCTION reject_workspace()",
          );
        }
      },
    );
    await t.test(
      "added team members set their own password and receive only assigned modules",
      async () => {
        await assert.rejects(server.authenticate({ action: "team-signup", email: "clerk@example.test", name: "Clerk", password }, request()), /signup link/);
        await assert.rejects(server.mutate(owner, { action: "add-member", email: "clerk@example.test", modules: [] }), /at least one module/);
        const result = await server.mutate(owner, {
          action: "add-member",
          email: "clerk@example.test",
          modules: ["Inventory"],
        });
        const invite = "invite" in result ? result.invite : "";
        await assert.rejects(
          server.authenticate(
            {
              action: "team-signup",
              email: "wrong@example.test",
              name: "Wrong",
              invite,
              password,
            },
            request(),
          ),
          /Invitation expired/,
        );
        member = (
          await server.authenticate(
            {
              action: "team-signup",
              email: "clerk@example.test",
              name: "Clerk",
              invite,
              password: "clerk-own-password-2026",
            },
            request(),
          )
        ).user;
        const signedIn = await server.authenticate({ action: "signin", email: member.email, password: "clerk-own-password-2026" }, request());
        assert.equal(signedIn.user.id, member.id);
        assert.deepEqual((await server.snapshot(member)).member.modules, [
          "Inventory",
        ]);
        await assert.rejects(
          server.authenticate(
            {
              action: "team-signup",
              email: member.email,
              name: "Clerk",
              invite,
              password,
            },
            request(),
          ),
          /Invitation expired/,
        );
        await assert.rejects(
          server.mutate(member, {
            action: "settings",
            name: "Hijack",
            image: "",
          }),
          (e: any) => e.status === 403,
        );
      },
    );
    await t.test(
      "sync persists records and audit attribution; retry is idempotent",
      async () => {
        const store = saveProduct(
          emptyStore(),
          {
            id: "rice",
            name: "Rice",
            sku: "RICE",
            barcode: "",
            category: "General",
            cost: 10,
            price: 20,
            low: 2,
          },
          5,
        );
        change = {
          actorId: member.id,
          id: "qa-event",
          module: "Inventory",
          action: "Product saved",
          occurredAt: new Date().toISOString(),
          store,
        };
        await server.mutate(member, {
          action: "sync",
          revision: 0,
          changes: [change],
        });
        await server.mutate(member, {
          action: "sync",
          revision: 0,
          changes: [change],
        });
        const w = await server.snapshot(owner);
        assert.equal(w.revision, 1);
        assert.equal(w.store.products.length, 1);
        assert.deepEqual(w.store.heads, store.heads);
        assert.deepEqual(w.store.units, store.units);
        const normalized = await query("SELECT record,ordinal FROM workspace_records WHERE workspace=$1 AND collection='products' AND record_id='rice'", [w.id]);
        assert.equal(normalized.rowCount, 1);
        assert.equal(normalized.rows[0].record.id, "rice");
        const compatibilityStore = await query("SELECT store,records_ready FROM workspaces WHERE id=$1", [w.id]);
        assert.equal(compatibilityStore.rows[0].records_ready, true);
        assert.equal(JSON.parse(compatibilityStore.rows[0].store).products.length, 0);
        assert.equal(w.audit.filter((a) => a.id === change.id).length, 1);
        assert.match(w.audit.find((a) => a.id === change.id)!.actor, /Clerk/);
        assert.match(w.audit.find((a) => a.id === change.id)!.records, /rice/);
      },
    );
    await t.test(
      "stale sync conflicts; revoked permission and wrong actor cannot write",
      async () => {
        const next = { ...change, id: "stale" };
        await assert.rejects(
          server.mutate(member, {
            action: "sync",
            revision: 0,
            changes: [next],
          }),
          (e: any) => e.status === 409,
        );
        await server.mutate(owner, {
          action: "permissions",
          user: member.id,
          modules: [],
        });
        await assert.rejects(
          server.mutate(member, {
            action: "sync",
            revision: 1,
            changes: [next],
          }),
          (e: any) => e.status === 403,
        );
        await assert.rejects(
          server.mutate(owner, {
            action: "sync",
            revision: 1,
            changes: [next],
          }),
          (e: any) => e.status === 403,
        );
        assert.equal((await server.snapshot(owner)).revision, 1);
      },
    );
    await t.test(
      "cross-module mutation and owner access removal are rejected",
      async () => {
        await server.mutate(owner, {
          action: "permissions",
          user: member.id,
          modules: ["Inventory"],
        });
        const store = {
          ...(await server.snapshot(owner)).store,
          customers: [
            { id: "x", name: "Other", phone: "", email: "", address: "" },
          ],
        };
        await assert.rejects(
          server.mutate(member, {
            action: "sync",
            revision: 1,
            changes: [{ ...change, id: "cross", store }],
          }),
          /cannot change/,
        );
        await assert.rejects(
          server.mutate(owner, {
            action: "permissions",
            user: owner.id,
            modules: [],
          }),
        );
      },
    );
    await t.test(
      "concurrent distinct edits from the same revision cannot overwrite each other",
      async () => {
        const makeChange = (id: string, price: number) => ({
          ...change,
          id,
          store: {
            ...change.store,
            products: change.store.products.map((p: any) => ({ ...p, price })),
          },
        });
        const results = await Promise.allSettled([
          server.mutate(member, {
            action: "sync",
            revision: 1,
            changes: [makeChange("parallel-a", 21)],
          }),
          server.mutate(member, {
            action: "sync",
            revision: 1,
            changes: [makeChange("parallel-b", 22)],
          }),
        ]);
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        assert.equal(
          results.filter(
            (r) => r.status === "rejected" && r.reason.status === 409,
          ).length,
          1,
        );
        assert.equal((await server.snapshot(owner)).revision, 2);
      },
    );
    await t.test("profile, read marker and email outbox persist", async () => {
      await server.mutate(owner, {
        action: "settings",
        name: "Renamed store",
        image: "",
      });
      await server.mutate(owner, { action: "read", event: "qa-event" });
      await server.mutate(owner, { action: "read", event: "new-marker" });
      const w = await server.snapshot(owner);
      assert.equal(w.name, "Renamed store");
      assert.equal(w.readEvent, "new-marker");
      assert.ok(
        w.audit.some(
          (a) =>
            a.action === "Store profile updated" && a.emailStatus === "queued",
        ),
      );
    });
    await t.test(
      "email provider failures retry with stable idempotency keys",
      async () => {
        process.env.RESEND_API_KEY = "test-key";
        process.env.RESEND_FROM = "alerts@example.test";
        const original = global.fetch;
        const OriginalDate = global.Date;
        const digestTime = "2026-01-01T23:59:00.000Z";
        global.Date = class extends OriginalDate {
          constructor(...args: any[]) {
            if (args.length) super(args[0]);
            else super(digestTime);
          }
          static now() { return new OriginalDate(digestTime).getTime(); }
        } as DateConstructor;
        let fail = true;
        const failedKeys: string[] = [],
          sentKeys: string[] = [];
        global.fetch = async (url, options) => {
          assert.equal(url, "https://api.resend.com/emails");
          const body = JSON.parse(options!.body as string);
          assert.deepEqual(body.to, [owner.email]);
          const key = (options!.headers as Record<string, string>)[
            "Idempotency-Key"
          ];
          (fail ? failedKeys : sentKeys).push(key);
          return new Response("{}", { status: fail ? 503 : 200 });
        };
        try {
          await server.deliverEmails();
          assert.ok(
            (await server.snapshot(owner)).audit.every(
              (a) => a.emailStatus === "retrying",
            ),
          );
          await query('UPDATE events SET "nextAttempt"=0');
          fail = false;
          await server.deliverEmails();
          assert.ok(
            (await server.snapshot(owner)).audit.every(
              (a) => a.emailStatus === "sent",
            ),
          );
          assert.deepEqual(failedKeys.sort(), sentKeys.sort());
        } finally {
          global.fetch = original;
          global.Date = OriginalDate;
          delete process.env.RESEND_API_KEY;
          delete process.env.RESEND_FROM;
        }
      },
    );
    await t.test(
      "legacy SQLite import preserves user IDs, passwords, records and audit history",
      async () => {
        const dir = mkdtempSync(path.join(tmpdir(), "stockwell-legacy-"));
        const file = path.join(dir, "workspace.sqlite");
        const { DatabaseSync } = await import("node:sqlite");
        const sqlite = new DatabaseSync(file);
        const salt = randomBytes(16).toString("hex");
        const hash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
        sqlite.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,name TEXT,password TEXT);
        CREATE TABLE workspaces(id TEXT PRIMARY KEY,name TEXT,image TEXT,owner TEXT,revision INTEGER,store TEXT);
        CREATE TABLE members(workspace TEXT,user TEXT,modules TEXT);
        CREATE TABLE invites(token TEXT,workspace TEXT,email TEXT,modules TEXT,expires INTEGER);
        CREATE TABLE events(id TEXT,workspace TEXT,actor TEXT,module TEXT,action TEXT,records TEXT,occurredAt TEXT,receivedAt TEXT,emailStatus TEXT,attempts INTEGER,nextAttempt INTEGER);
        CREATE TABLE reads(workspace TEXT,user TEXT,event TEXT);`);
        sqlite
          .prepare("INSERT INTO users VALUES(?,?,?,?)")
          .run("legacy-user", "legacy@example.test", "Legacy", hash);
        sqlite
          .prepare("INSERT INTO workspaces VALUES(?,?,?,?,?,?)")
          .run(
            "legacy-workspace",
            "Old Store",
            "",
            "legacy-user",
            7,
            JSON.stringify(change.store),
          );
        sqlite
          .prepare("INSERT INTO members VALUES(?,?,?)")
          .run(
            "legacy-workspace",
            "legacy-user",
            JSON.stringify(["Inventory"]),
          );
        sqlite
          .prepare("INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?,?,?)")
          .run(
            "legacy-event",
            "legacy-workspace",
            "Legacy",
            "Inventory",
            "Product saved",
            "rice",
            new Date().toISOString(),
            new Date().toISOString(),
            "queued",
            0,
            0,
          );
        sqlite.close();
        try {
          const { importSqlite } = await import("../scripts/import-sqlite");
          await importSqlite(file);
          const result = await server.authenticate(
            { action: "signin", email: "legacy@example.test", password },
            request(),
          );
          assert.equal(result.user.id, "legacy-user");
          const w = await server.snapshot(result.user);
          assert.equal(w.id, "legacy-workspace");
          assert.equal(w.revision, 7);
          assert.equal(w.store.products[0].id, "rice");
          assert.equal(w.audit[0].id, "legacy-event");
          await assert.rejects(importSqlite(file));
          assert.equal(
            (await query("SELECT id FROM users WHERE id='legacy-user'"))
              .rowCount,
            1,
          );
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      },
    );
    await t.test(
      "session refresh headers reach the browser and forged cookies are rejected",
      async () => {
        await query(
          'UPDATE auth_sessions SET "updatedAt"=NOW()-INTERVAL \'2 days\', "expiresAt"=NOW()+INTERVAL \'1 day\' WHERE "userId"=$1',
          [owner.id],
        );
        const res = await route.GET(request(ownerCookie));
        assert.equal(res.status, 200);
        assert.match(cookies(res.headers), /stockwell\.session_token=/);
        const refreshed = (
          await query(
            'SELECT "expiresAt" FROM auth_sessions WHERE "userId"=$1',
            [owner.id],
          )
        ).rows;
        assert.ok(
          refreshed.some(
            (r) => r.expiresAt.getTime() > Date.now() + 6 * 86400000,
          ),
        );
        await assert.rejects(
          server.authorize(request("stockwell.session_token=forged")),
          (e: any) => e.status === 401,
        );
      },
    );
    await t.test("HTTPS deployments issue Secure session cookies", async () => {
      const previous = process.env.BETTER_AUTH_URL;
      process.env.BETTER_AUTH_URL = "https://stockwell.example.test";
      try {
        const result = await server.authenticate(
          { action: "signin", email: owner.email, password },
          request("", undefined, "https://stockwell.example.test"),
        );
        assert.match(result.headers.get("set-cookie")!, /Secure/i);
        assert.match(result.headers.get("set-cookie")!, /HttpOnly/i);
      } finally {
        process.env.BETTER_AUTH_URL = previous;
      }
    });
    await t.test(
      "expired sessions reject authorization; signout clears and revokes the cookie",
      async () => {
        const result = await server.authenticate(
          { action: "signin", email: member.email, password: "clerk-own-password-2026" },
          request(),
        );
        await query(
          'UPDATE auth_sessions SET "expiresAt"=NOW()-INTERVAL \'1 second\' WHERE "userId"=$1',
          [member.id],
        );
        await assert.rejects(
          server.authorize(request(cookies(result.headers))),
          (e: any) => e.status === 401,
        );
        const res = await route.POST(
          request(ownerCookie, { action: "signout" }),
        );
        assert.equal(res.status, 200);
        assert.match(res.headers.get("set-cookie")!, /Max-Age=0/i);
        await assert.rejects(
          server.authorize(request(ownerCookie)),
          (e: any) => e.status === 401,
        );
      },
    );
    await t.test(
      "missing database configuration returns 503 without attempting local filesystem writes",
      async () => {
        await closeDatabase();
        const previous = process.env.DATABASE_URL;
        delete process.env.DATABASE_URL;
        try {
          const res = await route.POST(
            request("", { action: "signin", email: owner.email, password }),
          );
          assert.equal(res.status, 503);
          assert.match((await res.json()).error, /DATABASE_URL/);
        } finally {
          process.env.DATABASE_URL = previous;
        }
      },
    );
    await t.test("record migration backfills a legacy JSON workspace", async () => {
      const current = await server.snapshot(owner);
      const legacyStore = saveProduct(emptyStore(), {
        id: "legacy-product",
        name: "Legacy rice",
        sku: "LEGACY-RICE",
        barcode: "",
        category: "General",
        cost: 10,
        price: 20,
        low: 2,
      }, 3);
      legacyStore.categories = [];
      await query("DELETE FROM workspace_records WHERE workspace=$1", [current.id]);
      await query("UPDATE workspaces SET store=$1,records_ready=FALSE WHERE id=$2", [JSON.stringify(legacyStore), current.id]);
      const migration = await readFile(new URL("../migrations/011-workspace-records.sql", import.meta.url), "utf8");
      await query(migration);
      const backfilled = await server.snapshot(owner);
      assert.equal(backfilled.store.products[0].id, "legacy-product");
      assert.equal(backfilled.store.products[0].sku, "LEGACY-RICE");
      assert.deepEqual(backfilled.store.categories, []);
    });
  } finally {
    await closeDatabase();
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
});

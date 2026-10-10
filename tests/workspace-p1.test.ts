import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { recordTrade, today, type Store } from "../lib/stockwell/model";
import { correctTrade, closeDay, previousDate, saveExpense } from "../lib/stockwell/operations";
import { validateRecoveryBackup } from "../lib/stockwell/recovery";

test("P1 API controls and recoverable backup/restore", async t => {
  const adminURL = process.env.STOCKWELL_TEST_DATABASE_URL || "postgresql://localhost/postgres";
  const admin = new Client({ connectionString: adminURL });
  const name = `stockwell_p1_${randomUUID().replaceAll("-", "")}`;
  await admin.connect(); await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(adminURL); url.pathname = `/${name}`;
  process.env.DATABASE_URL = url.toString(); process.env.BETTER_AUTH_SECRET = "stockwell-p1-local-test-secret-at-least-32-characters"; process.env.BETTER_AUTH_URL = "http://localhost:3000";
  delete process.env.RESEND_API_KEY; delete process.env.RESEND_FROM; delete process.env.DISABLE_PUBLIC_SIGNUP;
  const server = await import("../lib/stockwell/server"), { migrate } = await import("../scripts/migrate"), { query, closeDatabase } = await import("../lib/stockwell/database");
  const { saveProduct } = await import("../lib/stockwell/model");
  const request = () => new Request("http://localhost:3000/api/workspace", { headers: { Origin: "http://localhost:3000" } });
  let owner: any, clerk: any, identity: any;
  const sync = async (user: any, store: Store, module: string, occurredAt = new Date().toISOString()) => {
    const current = await server.snapshot(owner);
    const change = { id: randomUUID(), actorId: user.id, occurredAt, module, action: `P1 ${module} change`, store };
    await server.mutate(user, { action: "sync", revision: current.revision, changes: [change] }); return change;
  };
  try {
    await migrate();
    owner = (await server.authenticate({ action: "signup", email: "p1-owner@example.test", password: "p1-owner-test-password", name: "Owner", storeName: "P1 Test Shop" }, request())).user;
    const invite = await server.mutate(owner, { action: "invite", email: "p1-clerk@example.test", modules: ["Inventory", "Billing", "Purchases", "Payments", "Expenses", "Reports", "Accounts Heads"] });
    clerk = (await server.authenticate({ action: "team-signup", email: "p1-clerk@example.test", password: "p1-clerk-test-password", name: "Clerk", invite: invite.invite }, request())).user;
    const w = await server.snapshot(owner); identity = w.id;
    const stocked = saveProduct(w.store, { id: "product", name: "Cloth", sku: "CLOTH", barcode: "", category: "General", cost: 5, price: 10, low: 0 }, 20);
    await sync(owner, stocked, "Inventory");
    await t.test("members cannot edit heads even when Accounts Heads is enabled", async () => {
      const before = await server.snapshot(owner);
      await assert.rejects(sync(clerk, { ...before.store, heads: [...before.store.heads, "Forged head"] }, "Accounts Heads"), /owner/);
      assert.equal((await server.snapshot(owner)).revision, before.revision);
    });
    await t.test("draft posting creates a walk-in and applies stock once", async () => {
      const before = await server.snapshot(owner);
      const draft = recordTrade(before.store, "Sale", { id: "bill", number: "", date: today(), contactId: "", lines: [{ productId: "product", qty: 2, price: 10, cost: 5 }], paid: 20, method: "Cash", head: "Sales", discount: 0, tax: 0, status: "draft", walkInName: "Walk-in Buyer", walkInPhone: "03001234567" });
      await sync(clerk, draft, "Billing");
      const { postTrade } = await import("../lib/stockwell/operations");
      const posted = postTrade((await server.snapshot(owner)).store, "Sale", "bill");
      const change = await sync(clerk, posted, "Billing");
      const current = await server.snapshot(owner);
      assert.equal(current.store.customers.length, 1); assert.equal(current.store.movements.length, 2);
      await server.mutate(clerk, { action: "sync", revision: current.revision - 1, changes: [change] });
      assert.equal((await server.snapshot(owner)).store.movements.length, 2);
    });
    await t.test("direct bill edits reject; owner corrections retain complete before/after history", async () => {
      const before = await server.snapshot(owner), bill = before.store.invoices[0];
      await assert.rejects(sync(clerk, { ...before.store, invoices: [{ ...bill, paid: 0 }] }, "Billing"), /locked/);
      const corrected = correctTrade(before.store, "Sale", { ...bill, paid: 10 }, "Wrong paid amount", { id: owner.id, role: "owner" });
      await sync(owner, corrected, "Billing");
      const current = await server.snapshot(owner);
      assert.equal((current.store.corrections || []).length, 1);
      assert.ok(current.audit[0].records.includes('"before"'));
      assert.ok(current.audit[0].records.includes('"after"'));
    });
    await t.test("late offline expense stays rejected until owner reviews the original pending change", async () => {
      const before = await server.snapshot(owner), occurredAt = new Date(Date.now() - 5 * 86400000).toISOString();
      const store = saveExpense(before.store, { id: "offline-expense", date: today(new Date(occurredAt)), category: "General", head: "Expenses", amount: 1, method: "Cash", notes: "Created offline" }, { id: clerk.id, role: "member" }, occurredAt);
      const change = { id: randomUUID(), actorId: clerk.id, occurredAt, module: "Expenses", action: "Offline expense", store };
      await assert.rejects(server.mutate(clerk, { action: "sync", revision: before.revision, changes: [change] }), /owner review/);
      assert.equal((await server.snapshot(owner)).store.expenses.length, 0);
      await server.mutate(owner, { action: "approve-offline-expense", revision: before.revision, change, reason: "Reviewed original receipt" });
      await server.mutate(clerk, { action: "sync", revision: before.revision, changes: [change] });
      assert.equal((await server.snapshot(owner)).store.expenses.length, 1);
    });
    await t.test("daily close locks new writes and forged closing figures", async () => {
      const before = await server.snapshot(owner);
      const close = closeDay(before.store, today(), 9, "", { id: owner.id, role: "owner", name: owner.name });
      await sync(owner, close, "Reports");
      await assert.rejects(sync(clerk, { ...close, expenses: [...close.expenses, { id: "blocked", date: today(), category: "General", head: "Expenses", amount: 1, method: "Cash", notes: "", createdAt: new Date().toISOString() }] }, "Expenses"), /closed/);
      const { reopenDay } = await import("../lib/stockwell/operations");
      await sync(owner, reopenDay(close, close.dailyCloses![0].id, "QA reopening", { id: owner.id, role: "owner" }), "Reports");
    });
    await t.test("complete backup exceeds the UI audit limit; restore is owner-only and creates recovery points", async () => {
      await query(`INSERT INTO events(id,workspace,actor,module,action,records,"occurredAt","receivedAt","emailStatus") SELECT 'qa-p1-'||n::text,$1,'QA','Billing','QA event','{}',$2,$2,'sent' FROM generate_series(1,325) n`, [identity, new Date().toISOString()]);
      const snapshot = await server.snapshot(owner); assert.equal(snapshot.audit.length, 300);
      const { backup } = await server.mutate(owner, { action: "backup" }); assert.ok(backup); assert.ok(backup.audit.length > 325);
      await validateRecoveryBackup(backup, identity);
      await assert.rejects(server.mutate(clerk, { action: "backup" }), /owner/);
      await assert.rejects(server.mutate(clerk, { action: "restore", revision: snapshot.revision, backup, confirmation: snapshot.name, reason: "Test" }), /owner/);
      await assert.rejects(server.mutate(owner, { action: "restore", revision: snapshot.revision - 1, backup, confirmation: snapshot.name, reason: "Test" }), /changed/);
      await assert.rejects(server.mutate(owner, { action: "restore", revision: snapshot.revision, backup, confirmation: "wrong", reason: "Test" }), /exact/);
      const current = await server.snapshot(owner), expense = saveExpense(current.store, { id: "new-expense", date: today(), category: "General", head: "Expenses", amount: 1, method: "Cash", notes: "After backup" }, { id: owner.id, role: "owner" });
      await sync(owner, expense, "Expenses", expense.expenses.at(-1)!.createdAt!);
      const revision = (await server.snapshot(owner)).revision;
      await query("DELETE FROM events WHERE workspace=$1 AND id=$2", [identity, "qa-p1-1"]);
      await server.mutate(owner, { action: "restore", revision, backup, confirmation: snapshot.name, reason: "QA restore" });
      const restored = await server.snapshot(owner);
      assert.equal(restored.store.expenses.length, backup.store.expenses.length);
      assert.equal(restored.revision, revision + 1);
      const full = (await server.mutate(owner, { action: "backup" })).backup; assert.ok(full);
      assert.ok(full.audit.length > backup.audit.length);
      assert.ok(full.audit.some((a: any) => a.id === "qa-p1-1" && a.emailStatus === "sent"));
      const point = full.audit.find((event: any) => event.action === "Pre-restore safety snapshot");
      assert.ok(point); assert.equal(JSON.parse(point.records).store.expenses.length, expense.expenses.length);
      const recovered = (await server.mutate(owner, { action: "backup-recovery", eventId: point.id })).backup; assert.ok(recovered);
      assert.equal(recovered.store.expenses.length, expense.expenses.length);
      await validateRecoveryBackup(recovered, identity);
    });
  } finally { await closeDatabase(); await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`); await admin.end(); }
});

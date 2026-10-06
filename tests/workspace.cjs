const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
process.env.STOCKWELL_DATA_DIR = mkdtempSync(
  path.join(tmpdir(), "stockwell-db-"),
);
const server = require(process.env.STOCKWELL_SERVER),
  { emptyStore, saveProduct } = require(process.env.STOCKWELL_MODEL);
const request = (token) =>
  new Request("http://localhost/api/workspace", {
    headers: { cookie: `stockwell_session=${token}` },
  });
let owner, ownerToken, member;
test("sign up creates owner workspace with a hashed password and authenticated session", () => {
  const result = server.authenticate(
    {
      action: "signup",
      email: "owner@example.test",
      name: "Owner",
      storeName: "QA Store",
      password: "a-long-test-password",
    },
    request(""),
  );
  owner = result.user;
  ownerToken = result.token;
  assert.notEqual(owner.password, "a-long-test-password");
  assert.equal(server.authorize(request(ownerToken)).id, owner.id);
  assert.equal(server.snapshot(owner).member.role, "owner");
});
test("wrong password rejected, sign in succeeds", () => {
  assert.throws(() =>
    server.authenticate(
      { action: "signin", email: owner.email, password: "wrong-password" },
      request(""),
    ),
  );
  assert.equal(
    server.authenticate(
      {
        action: "signin",
        email: owner.email,
        password: "a-long-test-password",
      },
      request(""),
    ).user.id,
    owner.id,
  );
});
test("owner invites module-restricted member, invite is single use", () => {
  const { invite } = server.mutate(owner, {
    action: "invite",
    email: "clerk@example.test",
    modules: ["Inventory"],
  });
  member = server.authenticate(
    {
      action: "signup",
      email: "clerk@example.test",
      name: "Clerk",
      password: "another-long-password",
      invite,
    },
    request(""),
  ).user;
  assert.deepEqual(server.snapshot(member).member.modules, ["Inventory"]);
  assert.throws(() =>
    server.mutate(member, { action: "settings", name: "Hijack", image: "" }),
  );
});
let change;
test("sync persists records, attributes actor and changed record, retry is idempotent", () => {
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
    id: "qa-event",
    module: "Inventory",
    action: "Product saved",
    occurredAt: new Date().toISOString(),
    store,
  };
  server.mutate(member, { action: "sync", revision: 0, changes: [change] });
  server.mutate(member, { action: "sync", revision: 0, changes: [change] });
  const w = server.snapshot(owner);
  assert.equal(w.revision, 1);
  assert.equal(w.store.products.length, 1);
  assert.equal(w.audit.filter((a) => a.id === "qa-event").length, 1);
  assert.match(w.audit.find((a) => a.id === "qa-event").actor, /Clerk/);
  assert.match(w.audit.find((a) => a.id === "qa-event").records, /rice/);
});
test("stale sync conflicts without overwriting and revoked permission rejected", () => {
  const next = { ...change, id: "stale" };
  assert.throws(
    () =>
      server.mutate(member, { action: "sync", revision: 0, changes: [next] }),
    (e) => e.status === 409,
  );
  server.mutate(owner, { action: "permissions", user: member.id, modules: [] });
  assert.throws(
    () =>
      server.mutate(member, { action: "sync", revision: 1, changes: [next] }),
    (e) => e.status === 403,
  );
  assert.equal(server.snapshot(owner).revision, 1);
});
test("cross-module mutation rejected and owner cannot revoke own authority", () => {
  server.mutate(owner, {
    action: "permissions",
    user: member.id,
    modules: ["Inventory"],
  });
  const store = {
    ...server.snapshot(owner).store,
    customers: [{ id: "x", name: "Other", phone: "", email: "", address: "" }],
  };
  assert.throws(
    () =>
      server.mutate(member, {
        action: "sync",
        revision: 1,
        changes: [{ ...change, id: "cross", store }],
      }),
    /cannot change/,
  );
  assert.throws(() =>
    server.mutate(owner, {
      action: "permissions",
      user: owner.id,
      modules: [],
    }),
  );
});
test("profile persists, audit and email outbox retained without Resend configuration", () => {
  server.mutate(owner, {
    action: "settings",
    name: "Renamed store",
    image: "",
  });
  assert.equal(server.snapshot(owner).name, "Renamed store");
  assert.ok(
    server
      .snapshot(owner)
      .audit.some(
        (a) =>
          a.action === "Store profile updated" && a.emailStatus === "queued",
      ),
  );
});
test("Resend failures stay queued and retry with stable idempotency keys", async()=>{
 process.env.RESEND_API_KEY="test-key";process.env.RESEND_FROM="alerts@example.test";
 const original=global.fetch;let fail=true;const keys=[];
 global.fetch=async(url,options)=>{assert.equal(url,"https://api.resend.com/emails");const body=JSON.parse(options.body);assert.deepEqual(body.to,[owner.email]);keys.push(options.headers["Idempotency-Key"]);return new Response("{}",{status:fail?503:200});};
 try{await server.deliverEmails();assert.ok(server.snapshot(owner).audit.some(a=>a.emailStatus==="retrying"));server.db().exec("UPDATE events SET nextAttempt=0");fail=false;await server.deliverEmails();assert.ok(server.snapshot(owner).audit.every(a=>a.emailStatus==="sent"));assert.ok(keys.length>0);assert.equal(keys[0],keys[keys.length/2]);}finally{global.fetch=original;delete process.env.RESEND_API_KEY;delete process.env.RESEND_FROM;}
});
test("logout revokes the server session", () => {
  server.logout(request(ownerToken));
  assert.throws(
    () => server.authorize(request(ownerToken)),
    (e) => e.status === 401,
  );
  rmSync(process.env.STOCKWELL_DATA_DIR, { recursive: true, force: true });
});

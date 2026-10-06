const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const vm = require("node:vm");
const { developmentWorker, productionWorker } = require(path.join(process.env.STOCKWELL_TEST_DIR, "service-worker.js"));
function worker(source) {
  const handlers = {}, removed = [];
  const context = { self: { addEventListener: (type, handler) => handlers[type] = handler, skipWaiting: async () => {}, registration: { unregister: async () => removed.push("registration") }, clients: { claim: async () => {} } }, caches: { keys: async () => ["stockwell-offline-v2", "unrelated"], delete: async (key) => removed.push(key) }, URL, location: { origin: "http://localhost:3001" }, fetch: async () => ({ ok: true }) };
  vm.runInNewContext(source, context);
  return { handlers, removed };
}
test("development worker retires old caches without intercepting chunks", async () => {
  const { handlers, removed } = worker(developmentWorker);
  assert.equal(handlers.fetch, undefined);
  let completion;
  handlers.activate({ waitUntil: promise => completion = promise });
  await completion;
  assert.deepEqual(removed, ["stockwell-offline-v2", "registration"]);
});
test("production worker retains offline routes and bypasses API requests", () => {
  const { handlers } = worker(productionWorker);
  assert.equal(typeof handlers.fetch, "function");
  let intercepted = false;
  handlers.fetch({ request: { method: "GET", url: "http://localhost:3001/api/workspace" }, respondWith: () => intercepted = true });
  assert.equal(intercepted, false);
});

const { configureServiceWorker } = require(path.join(process.env.STOCKWELL_TEST_DIR, "service-worker-client.js"));
async function withBrowser(environment, callback) {
  const oldEnvironment = process.env.NODE_ENV;
  const descriptors = Object.fromEntries(["navigator", "window", "caches"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const calls = [];
  const caches = { keys: async () => ["stockwell-offline-v2", "another-app"], delete: async key => calls.push(key) };
  const serviceWorker = {
    register: async (...args) => calls.push(args),
    getRegistrations: async () => [
      { active: { scriptURL: "http://localhost/sw.js" }, unregister: async () => calls.push("stockwell-worker") },
      { active: { scriptURL: "http://localhost/other-worker.js" }, unregister: async () => calls.push("other-worker") },
    ],
  };
  try {
    process.env.NODE_ENV = environment;
    for (const [key, value] of Object.entries({ navigator: { serviceWorker }, window: { caches }, caches })) Object.defineProperty(globalThis, key, { value, configurable: true });
    await callback(calls);
  } finally {
    if (oldEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldEnvironment;
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}
test("development setup removes only Stockwell offline assets and registrations", async () => {
  await withBrowser("development", async calls => {
    await configureServiceWorker();
    assert.deepEqual(calls, ["stockwell-worker", "stockwell-offline-v2"]);
  });
});
test("production setup registers the offline worker without using cached worker scripts", async () => {
  await withBrowser("production", async calls => {
    await configureServiceWorker();
    assert.deepEqual(calls, [["/sw.js", { updateViaCache: "none" }]]);
  });
});

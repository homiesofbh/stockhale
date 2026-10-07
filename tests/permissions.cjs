const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { modules, accessibleModule, canAccessModule } = require(path.join(process.env.STOCKWELL_TEST_DIR, "workspace.js"));
const member = { id: "clerk", name: "Clerk", email: "clerk@example.test", role: "member", modules: ["Billing"] };
test("a billing-only member lands in Billing before any Dashboard render", () => {
  assert.equal(accessibleModule(member, "Dashboard"), "Billing");
  assert.equal(accessibleModule(member, "Settings"), "Billing");
  assert.equal(accessibleModule(member, "Notifications"), "Billing");
  assert.deepEqual(modules.filter(module => canAccessModule(member, module)), ["Billing"]);
});
test("revoked modules redirect immediately and zero access has no portal module", () => {
  assert.equal(accessibleModule({ ...member, modules: ["Inventory"] }, "Billing"), "Inventory");
  assert.equal(accessibleModule({ ...member, modules: [] }, "Billing"), null);
  assert.equal(canAccessModule({ ...member, modules: ["Settings", "Notifications"] }, "Settings"), false);
});
test("owners retain every module plus settings and notifications", () => {
  const owner = { ...member, role: "owner", modules: [] };
  assert.ok(modules.every(module => canAccessModule(owner, module)));
  assert.equal(accessibleModule(owner, "Settings"), "Settings");
  assert.equal(canAccessModule(owner, "Notifications"), true);
  assert.equal(canAccessModule(owner, "unknown"), false);
});

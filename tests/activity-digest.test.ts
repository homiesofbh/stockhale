import assert from "node:assert/strict";
import test from "node:test";
import { activityDigestDue } from "../lib/stockwell/server";

test("activity digest is due at 11:58 PM in the workspace timezone", () => {
  const atKarachi1158pm = new Date("2026-10-31T18:58:00.000Z");
  assert.deepEqual(activityDigestDue(atKarachi1158pm, "Asia/Karachi"), {
    date: "2026-10-31",
    due: true,
  });
  assert.equal(activityDigestDue(new Date("2026-10-31T18:57:00.000Z"), "Asia/Karachi").due, false);
  assert.equal(activityDigestDue(new Date("2026-10-31T18:59:00.000Z"), "Asia/Karachi").due, true);
});

test("activity digest local date follows timezone offsets and daylight changes", () => {
  const utcDate = new Date("2026-11-02T07:58:00.000Z");
  assert.deepEqual(activityDigestDue(utcDate, "America/Los_Angeles"), {
    date: "2026-11-01",
    due: true,
  });
});

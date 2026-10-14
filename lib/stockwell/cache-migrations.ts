import type { Cache } from "./workspace";

/** Increment when queued device data needs a compatibility migration. */
export const CACHE_VERSION = 2;

type Migration = (cache: Cache) => Cache;

function renameModules(cache: Cache, renames: Record<string, string>): Cache {
  const queue = cache.queue.map((change) =>
    renames[change.module] ? { ...change, module: renames[change.module] } : change,
  );
  return queue.some((change, index) => change !== cache.queue[index])
    ? { ...cache, queue }
    : cache;
}

const migrations: Record<number, Migration> = {
  1: (cache) => renameModules(cache, { Settings: "Accounts Heads", Reports: "Closing" }),
};

export function migrateCache(cache: Cache): Cache {
  let version = cache.version ?? 1;
  if (!Number.isInteger(version) || version < 1)
    throw new Error("Device cache version is invalid.");
  if (version > CACHE_VERSION)
    throw new Error("This device cache was created by a newer StockHale version. Update this app before syncing so its pending changes are preserved.");
  let result = cache;
  while (version < CACHE_VERSION) {
    const migration = migrations[version];
    if (!migration) throw new Error(`No device cache migration is available for version ${version}.`);
    result = migration(result);
    version++;
  }
  return { ...result, version: CACHE_VERSION };
}

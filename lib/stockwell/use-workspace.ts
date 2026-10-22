"use client";
import { useEffect, useRef, useState } from "react";
import { verifyChange, changesBetween, modules, canAccessModule, cacheKey, recoverPendingQueue, recoverIndependentPendingQueue, planHeadDrop, type Cache, type Workspace } from "./workspace";
import { normalizeStore, type Store } from "./model";
import { configureServiceWorker } from "./service-worker-client";
import { CACHE_VERSION, migrateCache } from "./cache-migrations";
export async function workspaceRequest(body?: unknown) {
  const res = await fetch("/api/workspace", {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    // A hung request (captive portal, dead Wi-Fi) would pin busy=true and stall
    // sync forever. Safe to abort: the server dedupes sync changes by id.
    signal: AbortSignal.timeout(20_000),
  });
  const value = await res.json();
  if (!res.ok)
    throw Object.assign(new Error(value.error || "Server unavailable"), {
      status: res.status,
      reason: value.reason,
      serverRevision: value.serverRevision,
    });
  return value;
}
function failureStatus(status: number | undefined, message: string) {
  if (status === 409) return "Conflict · pending changes preserved";
  if (status === 403) return message === "Invalid request origin." ? "Request blocked · check the site address" : "Permission changed · pending changes preserved";
  if (status === 507) return "Device storage full · pending changes preserved";
  if (status === 400) return "Review needed · click to resolve";
  return navigator.onLine ? "Server unavailable · retrying automatically" : "Offline · changes saved on this device";
}
function reconcileCanonicalBillNumbers(snapshot: Store, submitted: Store, authoritative: Store): Store {
  const result: Store = { ...snapshot, invoices: [...snapshot.invoices], purchases: [...snapshot.purchases], movements: [...snapshot.movements] };
  for (const key of ["invoices", "purchases"] as const) {
    const movementType = key === "invoices" ? "Sale" : "Purchase";
    for (const original of submitted[key]) {
      const canonical = authoritative[key].find(trade => trade.id === original.id);
      if (!canonical || canonical.number === original.number) continue;
      result[key] = result[key].map(trade => trade.id === original.id
        ? { ...trade, number: canonical.number, previousNumbers: canonical.previousNumbers }
        : trade);
      result.movements = result.movements.map(movement =>
        movement.type === movementType && movement.reference === original.number
          ? { ...movement, reference: canonical.number }
          : movement,
      );
    }
  }
  return normalizeStore(result);
}
function hasCanonicalBillNumberChanges(submitted: Store, authoritative: Store) {
  return (["invoices", "purchases"] as const).some(key =>
    submitted[key].some(trade => authoritative[key].some(saved => saved.id === trade.id && saved.number !== trade.number)),
  );
}
// Saving a record must never wait on GPS. Reuse a recent fix, give a fresh
// lookup at most ~2.5s, and after a failure skip the lookup for 30s so every
// save in a row does not pay the timeout again (GPS is often unavailable in
// some regions/networks).
const LOCATION_FRESH_MS = 5 * 60_000;
const LOCATION_RETRY_MS = 30_000;
let lastLocation = "Unavailable";
let lastLocationAt = 0;
async function liveLocation() {
  if (!window.isSecureContext || !navigator.geolocation) return "Unavailable";
  if (Date.now() - lastLocationAt < LOCATION_FRESH_MS) return lastLocation;
  try {
    // getCurrentPosition's own timeout does not cover the permission prompt,
    // so race it against a hard timer.
    const position = await Promise.race([
      new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          maximumAge: LOCATION_FRESH_MS,
          timeout: 2_000,
        }),
      ),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("location timeout")), 2_500)),
    ]);
    const { latitude, longitude, accuracy } = position.coords;
    // Keep enough precision to identify the visit location without storing an
    // unnecessarily exact GPS trace.
    lastLocation = `${latitude.toFixed(4)}, ${longitude.toFixed(4)} (±${Math.round(accuracy)} m)`;
    lastLocationAt = Date.now();
  } catch {
    // Keep the last known fix (if any) and retry in LOCATION_RETRY_MS.
    lastLocationAt = Date.now() - (LOCATION_FRESH_MS - LOCATION_RETRY_MS);
  }
  return lastLocation;
}
export function useWorkspace() {
  const [cache, setCache] = useState<Cache | null>(null),
    [ready, setReady] = useState(false),
    [syncStatus, setSyncStatus] = useState("Connecting…"),
    [syncError, setSyncError] = useState(""),
    [syncNotice, setSyncNotice] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [review, setReview] = useState<{ changeId: string; collections: string[]; candidates: string[]; message: string; conflict?: boolean; canRecover?: boolean } | null>(null);
  const current = useRef<Cache | null>(null), cacheLoadBlocked = useRef(false),
    busy = useRef(false), actionBusy = useRef(false), syncRequested = useRef(false), blockedConflictId = useRef("");
  async function withCacheLock<T>(fn: () => T | Promise<T>): Promise<T> {
    // Web Locks serialize localStorage read/modify/write across tabs in this
    // browser profile. Other browsers/devices are serialized by the DB lock.
    return navigator.locks?.request
      ? navigator.locks.request("stockhale-workspace-cache", fn)
      : fn();
  }
  function save(value: Cache, preserveExternal = false) {
    const key = cacheKey(value.workspace.id);
    if (!preserveExternal && current.current) {
      const raw = localStorage.getItem(key), own = JSON.stringify(current.current);
      if (raw && raw !== own) {
        try {
          // A second tab may have committed while a request was in flight.
          // Keep its queue intact and let the next sync fetch the server's
          // acknowledgement instead of overwriting it with an older snapshot.
          value = JSON.parse(raw) as Cache;
          queueMicrotask(() => void sync());
        } catch {
          // The existing in-memory value remains usable if storage is corrupt.
        }
      }
    }
    value = { ...value, version: CACHE_VERSION, workspace: { ...value.workspace, store: normalizeStore(value.workspace.store) } };
    try {
      localStorage.setItem(key, JSON.stringify(value));
      localStorage.setItem("stockhale.active", value.workspace.id);
    } catch {
      throw Object.assign(new Error("This device is out of storage space, so the last change was NOT saved. Sync or export your pending changes, then free up browser storage and try again."), { status: 507 });
    }
    current.current = value;
    setCache(value);
  }
  function readSharedCache(cache: Cache) {
    const raw = localStorage.getItem(cacheKey(cache.workspace.id));
    if (!raw || raw === JSON.stringify(cache)) return cache;
    try {
      return JSON.parse(raw) as Cache;
    } catch {
      return cache;
    }
  }
  function appendTabChange(cache: Cache, store: Store, module: string, action: string, occurredAt: string, location: string) {
    const shared = readSharedCache(cache);
    if (shared === cache) return {
      ...cache,
      workspace: { ...cache.workspace, store },
      queue: [...cache.queue, { actorId: cache.workspace.member.id, id: crypto.randomUUID(), module, action, occurredAt, location, store }],
      baseStore: cache.queue.length ? cache.baseStore : cache.workspace.store,
    };
    // Rebase this tab's edit on the cache written by the other tab. This
    // preserves independent edits and rejects only a genuine same-record
    // conflict; it no longer treats every second tab as an error.
    const rebased = recoverPendingQueue(
      {
        ...cache,
        workspace: { ...cache.workspace, store },
        queue: [{ actorId: cache.workspace.member.id, id: crypto.randomUUID(), module, action, occurredAt, location, store }],
        baseStore: cache.workspace.store,
      },
      shared.workspace,
    );
    return {
      ...shared,
      workspace: { ...shared.workspace, store: rebased.workspace.store },
      queue: [...shared.queue, ...rebased.queue],
      revision: shared.revision,
      baseStore: shared.queue.length ? shared.baseStore : shared.workspace.store,
    };
  }
  // Send the head of the queue (or just fetch when empty). Up to 3 automatic
  // 409 recoveries (with backoff) keep users out of the conflict flow when other
  // devices are writing or a slow network lets the revision drift; after that
  // the 409 surfaces with the server's real message.
  const MAX_409_RECOVERIES = 3;
  async function submit(c: Cache | null) {
    for (let attempt = 0; ; attempt++) {
      try {
        const w: Workspace & { accepted?: string[] } = await workspaceRequest(c?.queue.length
          ? { action: "sync", revision: c.revision, changes: c.queue.slice(0, 1) }
          : undefined);
        return { c, w };
      } catch (e) {
        const conflict = e as { status?: number; reason?: string };
        if (conflict.status !== 409 || (conflict.reason && conflict.reason !== "revision-mismatch") || attempt >= MAX_409_RECOVERIES || !current.current?.queue.length) throw e;
        const pending = current.current;
        setSyncStatus(attempt ? `Saving your changes… (retry ${attempt + 1})` : "Saving your changes…");
        if (attempt) await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt + Math.random() * 300));
        const server: Workspace = await workspaceRequest();
        if (current.current !== pending) throw new Error("Changes updated while saving. They are safe on this device; try again.");
        const recovered = recoverIndependentPendingQueue(pending, server);
        save(recovered);
        c = current.current;
        if (recovered.queue.length && recovered.blockedChangeIds?.includes(recovered.queue[0].id))
          throw Object.assign(new Error("This saved change overlaps records changed on the server. It and dependent changes remain saved for review."), { status: 409, reason: "merge-conflict" });
      }
    }
  }
  async function sync(force = false) {
    if (cacheLoadBlocked.current) return;
    if (!force && (blockedConflictId.current === current.current?.queue[0]?.id || current.current?.blockedChangeIds?.includes(current.current?.queue[0]?.id || ""))) return;
    if (force) blockedConflictId.current = "";
    if (busy.current || actionBusy.current) { syncRequested.current = true; return; }
    syncRequested.current = false;
    // Do not start a request while the browser is offline. Apart from being
    // wasted work, a failed fetch can keep the single-flight lock occupied
    // until its timeout and make the reconnect event look as if it was lost.
    if (!navigator.onLine) {
      setSyncStatus("Offline · changes saved on this device");
      setSyncing(false);
      setReady(true);
      return;
    }
    busy.current = true;
    setSyncing(true);
    setSyncStatus(current.current?.queue.length ? "Syncing changes…" : "Checking sync…");
    try {
      const migrated = current.current && migrateCache(current.current);
      const start = migrated || current.current;
      if (start && start !== current.current) save(start, true);
      const { c, w } = await submit(start);
      const latest = current.current;
      if (c && w.id !== c.workspace.id)
        throw Object.assign(new Error("Sign in to the workspace that created these pending changes."), { status: 403 });
      if (c?.queue.length && (!w.accepted?.includes(c.queue[0].id) || w.revision < c.revision + 1))
        throw Object.assign(new Error("Server records changed during retry."), {
          status: 409,
        });
      // A scan/save can happen while a request is in flight. Acknowledge only
      // the submitted change, keeping every newer local snapshot queued.
      let remaining = c?.queue.length
        ? (latest?.queue || c.queue).filter((change) => change.id !== c.queue[0].id)
        : latest?.queue || [];
      let localStore = latest?.workspace.store;
      let nextRevision = remaining.length && c?.queue.length ? c.revision + 1 : w.revision;
      let rebasedRemaining = false;
      let blockedChangeIds = (latest?.blockedChangeIds || c?.blockedChangeIds || []).filter(id => remaining.some(change => change.id === id));
      if (c?.queue.length && remaining.length && hasCanonicalBillNumberChanges(c.queue[0].store, w.store)) {
        const submitted = c.queue[0].store;
        const acceptedBase = reconcileCanonicalBillNumbers(submitted, submitted, w.store);
        const pendingStore = reconcileCanonicalBillNumbers(latest!.workspace.store, submitted, w.store);
        const pendingQueue = remaining.map(change => ({
          ...change,
          store: reconcileCanonicalBillNumbers(change.store, submitted, w.store),
        }));
        const rebased = recoverIndependentPendingQueue({
          ...latest!,
          workspace: { ...latest!.workspace, store: pendingStore },
          queue: pendingQueue,
          revision: w.revision,
          baseStore: acceptedBase,
        }, w);
        remaining = rebased.queue;
        localStore = rebased.workspace.store;
        nextRevision = rebased.revision;
        blockedChangeIds = rebased.blockedChangeIds || [];
        rebasedRemaining = true;
      }
      save({
        workspace: remaining.length ? { ...w, store: localStore! } : w,
        queue: remaining,
        blockedChangeIds,
        revision: nextRevision,
        // Only the server response confirms records. A submitted snapshot may
        // still differ from the authoritative store after a concurrent edit.
        baseStore: remaining.length ? normalizeStore(w.store) : undefined,
      });
      setReview(null);
      blockedConflictId.current = "";
      setSyncError(blockedChangeIds.length ? "Independent changes synced. Other saved changes still need review." : "");
      if (c?.queue.length) {
        const reassigned = (["invoices", "purchases"] as const).flatMap(key =>
          c.queue[0].store[key].flatMap(trade => {
            const saved = w.store[key].find(item => item.id === trade.id);
            const previous = c.baseStore?.[key].find(item => item.id === trade.id)?.previousNumbers || [];
            const newAliases = (saved?.previousNumbers || []).filter(number => !previous.includes(number));
            return saved ? newAliases.map(number => `${key === "invoices" ? "Invoice" : "Purchase"} ${number} was renumbered to ${saved.number} after sync because the original number was already in use. Reprint or share the corrected record.`) : [];
          }),
        );
        if (reassigned.length) setSyncNotice(reassigned.join(" "));
      }
      setSyncStatus(blockedChangeIds.length ? "Conflict · other changes need review" : remaining.length && c && w.revision > c.revision + 1 && !rebasedRemaining ? "Conflict · newer queued changes preserved" : remaining.length ? "Pending sync" : "Synced");
      if (remaining.length && (rebasedRemaining || !c || w.revision === c.revision + 1)) setTimeout(() => void sync(), 100);
    } catch (e) {
      const status = (e as { status?: number }).status;
      const reason = (e as { reason?: string }).reason;
      const message = e instanceof Error ? e.message : "Pending change rejected";
      setSyncError(message);
      if (reason === "merge-conflict" && current.current?.queue[0]) blockedConflictId.current = current.current.queue[0].id;
      if (status === 401) {
        setSyncStatus("Session expired · sign in to sync");
        if (!current.current) window.location.replace("/sign-in");
      }
      else setSyncStatus(failureStatus(status, message));
    } finally {
      busy.current = false;
      setSyncing(false);
      setReady(true);
      if (syncRequested.current) queueMicrotask(() => void sync());
    }
  }
  useEffect(() => {
    try {
      const id = localStorage.getItem("stockhale.active"),
        raw = id && localStorage.getItem(cacheKey(id));
      if (raw) {
        const parsed = JSON.parse(raw) as Cache;
        const migrated = migrateCache(parsed);
        save(migrated, true);
        setReady(true);
      }
    } catch (error) {
      cacheLoadBlocked.current = true;
      try {
        const id = localStorage.getItem("stockhale.active"), raw = id && localStorage.getItem(cacheKey(id));
        if (raw) {
          const readable = JSON.parse(raw) as Cache;
          current.current = readable;
          setCache(readable);
        }
      } catch {
        // Preserve the raw browser value and pause; never replace an unreadable queue.
      }
      const storageFailure = error instanceof Error && error.message.includes("out of storage");
      setSyncError(storageFailure
        ? "The device could not save the cache migration because browser storage is full. Pending changes remain in browser storage; export them and free space before retrying."
        : "Device cache could not be read or migrated. Pending changes remain in browser storage; export the cache before clearing site data, then update or repair this app.");
      setSyncStatus(storageFailure ? "Device storage full · sync paused" : "Device cache needs recovery · sync paused");
      setReady(true);
    }
    if (!cacheLoadBlocked.current) void sync();
    const timer = setInterval(() => {
      if (!document.hidden) void sync();
    }, 15000);
    const online = () => void sync();
    const offline = () => {
      setSyncing(false);
      setSyncStatus("Offline · changes saved on this device");
    };
    const visible = () => {
      if (!document.hidden) void sync();
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", online);
    const onStorage = (event: StorageEvent) => {
      const active = current.current;
      if (!active || event.key !== cacheKey(active.workspace.id) || !event.newValue) return;
      if (busy.current || actionBusy.current) {
        // The active request may be acknowledging an older snapshot. Ask it to
        // re-read the shared cache before the next queue submission.
        syncRequested.current = true;
        return;
      }
      try {
        const incoming = JSON.parse(event.newValue) as Cache;
        if (JSON.stringify(incoming) === JSON.stringify(active)) return;
        current.current = incoming;
        setCache(incoming);
        setSyncError("");
        setSyncStatus(incoming.queue.length ? "Pending sync" : "Synced");
        if (incoming.queue.length) void sync();
      } catch {
        // Ignore malformed cross-tab notifications; the writing tab remains authoritative.
      }
    };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", visible);
    void configureServiceWorker().catch(() => {
      // Workspace records still persist locally if offline asset setup fails.
    });
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", online);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  async function commit(store: Store, module: string, action: string) {
    if (actionBusy.current) throw new Error("Wait for the current workspace action to finish before saving records.");
    const c = current.current;
    if (!c) throw new Error("Sign in before saving records.");
    if (
      c.workspace.member.role !== "owner" &&
      !c.workspace.member.modules.includes(module)
    )
      throw new Error("You do not have permission for this module.");
    const occurredAt = store.expenses.find(e => !c.workspace.store.expenses.some(old => old.id === e.id))?.createdAt || new Date().toISOString();
    verifyChange(c.workspace.store, store, module, { actor: c.workspace.member, occurredAt });
    const location = await liveLocation();
    await withCacheLock(() => {
      // Read the latest shared state inside the lock. This protects rapid
      // edits made in two tabs from racing between localStorage read and write.
      const latest = current.current || c;
      const next = appendTabChange(latest, store, module, action, occurredAt, location);
      save(next, true);
    });
    setReview(null);
    setSyncStatus("Pending sync");
    // Try to sync online while keeping the durable device queue as the source
    // of truth. The "online" listener drains it after reconnects and timeouts.
    if (navigator.onLine) {
      // The change is already safe in the local queue. Keep the form responsive
      // on slow connections while sync continues in the background.
      await Promise.race([
        sync(),
        new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
      ]);
    }
    return { synced: !current.current?.queue.length };
  }
  async function action(body: unknown) {
    if (current.current?.queue.length)
      throw new Error(
        "Sync pending records before changing workspace settings.",
      );
    if (busy.current || actionBusy.current) throw new Error("Wait for the current sync or workspace action to finish.");
    actionBusy.current = true;
    try {
      const actionName = body && typeof body === "object" && !Array.isArray(body)
        ? (body as { action?: unknown }).action
        : undefined;
      const location = ["read", "backup", "backup-recovery", "retry-email"].includes(actionName as string)
        ? "Unavailable"
        : await liveLocation();
      const request = body && typeof body === "object" && !Array.isArray(body)
        ? { ...body as Record<string, unknown>, location }
        : body;
      const w = await workspaceRequest(request);
      save({ workspace: w, queue: [], revision: w.revision });
      return w;
    } finally {
      actionBusy.current = false;
      if (syncRequested.current) void sync();
    }
  }
  async function inspectPending() {
    if (busy.current || actionBusy.current)
      throw new Error("Wait for the current sync to finish, then open the review again.");
    // Reviewing must use a stable queue snapshot. Without this lock, the
    // interval/online handlers can acknowledge or rebase the queue between
    // the server read below and the current-cache check, producing the
    // misleading "pending changes updated during review" loop.
    actionBusy.current = true;
    setReview(null);
    try {
      const c = current.current;
      const change = c?.queue[0];
      if (!c || !change) return;
      const server: Workspace = await workspaceRequest();
      if (current.current !== c) throw new Error("Pending changes updated during review. Open the review again.");
      if (server.id !== c.workspace.id) throw new Error("Sign in to the workspace that created these changes.");
      if (server.revision !== c.revision) {
        let message = "", canRecover = false;
        try {
          recoverPendingQueue(c, server);
          canRecover = true;
          message = "Your pending changes can be merged with the latest server records. Merge and sync to continue; records added on the server will be kept.";
        } catch (e) {
          const independent = recoverIndependentPendingQueue(c, server);
          canRecover = !!independent.queue.length && !independent.blockedChangeIds?.includes(independent.queue[0].id);
          message = canRecover
            ? "Some changes overlap server records. Independent changes can sync now; the conflicting change and its dependents will stay saved for review."
            : e instanceof Error ? e.message : "These changes need a record review before merging.";
        }
        setReview({ changeId: change.id, collections: [], candidates: [], message, conflict: true, canRecover });
        return;
      }
      const before = normalizeStore(server.store), after = normalizeStore(change.store);
      const collections = changesBetween(before, after);
      const candidates = change.actorId === server.member.id ? modules.filter(module => {
        if (!canAccessModule(server.member, module)) return false;
        try {
          verifyChange(before, after, module, { actor: server.member, occurredAt: change.occurredAt, receivedAt: new Date().toISOString() });
          return true;
        } catch { return false; }
      }) : [];
      let message = "";
      try {
        if (change.actorId !== server.member.id) throw new Error("Sign in as the person who saved this change to sync it.");
        if (!canAccessModule(server.member, change.module)) throw new Error(`Ask the owner to restore your ${change.module} permission, then retry sync.`);
        verifyChange(before, after, change.module, { actor: server.member, occurredAt: change.occurredAt, receivedAt: new Date().toISOString() });
        message = "This change passes record checks. Retry sync to submit it and continue with the rest of the queue.";
      } catch (e) { message = e instanceof Error ? e.message : "This change needs review."; }
      setReview({ changeId: change.id, collections, candidates, message });
    } finally {
      actionBusy.current = false;
      if (syncRequested.current) queueMicrotask(() => void sync());
    }
  }
  async function resolvePending(module: string) {
    if (busy.current || actionBusy.current) throw new Error("Wait for the current sync to finish.");
    const c = current.current;
    if (!c || !review || review.changeId !== c.queue[0]?.id || !review.candidates.includes(module))
      throw new Error("Review this pending change again before correcting its module.");
    save({ ...c, queue: c.queue.map((change, index) => index === 0 ? { ...change, module } : change) });
    setReview(null);
    await sync();
  }
  async function recoverPending() {
    if (busy.current || actionBusy.current) throw new Error("Wait for the current sync to finish.");
    const c = current.current;
    if (!c?.queue.length) return;
    actionBusy.current = true;
    try {
      const server: Workspace = await workspaceRequest();
      if (current.current !== c) throw new Error("Pending changes updated during recovery. Check again.");
      save(recoverIndependentPendingQueue(c, server));
      setReview(null);
      setSyncError("");
      blockedConflictId.current = current.current?.blockedChangeIds?.includes(current.current?.queue[0]?.id || "") ? current.current.queue[0].id : "";
      setSyncStatus(current.current?.queue.length ? "Pending sync" : "Synced");
    } finally { actionBusy.current = false; }
    await sync();
  }
  // Drop the first pending change (the one blocking the queue) plus only the
  // later changes that cannot exist without it. Everything else stays queued.
  // A full copy of the queue is downloaded before anything is removed.
  async function dropHeadChange() {
    if (busy.current || actionBusy.current) throw new Error("Wait for the current sync to finish.");
    const c = current.current;
    if (!c?.queue.length) throw new Error("There are no saved changes to drop.");
    actionBusy.current = true;
    try {
      const server: Workspace = await workspaceRequest();
      if (current.current !== c) throw new Error("Pending changes updated. Review them again before dropping.");
      const { cache: next, dropped } = planHeadDrop(c, server);
      const list = dropped
        .slice(0, 5)
        .map((change) => `• ${change.action || "Record change"} (${change.module}, ${new Date(change.occurredAt).toLocaleString("en-PK")})`)
        .join("\n");
      const more = dropped.length > 5 ? `\n…and ${dropped.length - 5} more` : "";
      if (!window.confirm(
        `Drop ${dropped.length} saved change${dropped.length === 1 ? "" : "s"}?\n\n${list}${more}\n\n` +
        `${next.queue.length} other change${next.queue.length === 1 ? "" : "s"} stay saved on this device. A copy of everything is downloaded first.`,
      )) return;
      exportPending();
      save(next);
      setReview(null);
      setSyncError("");
      setSyncStatus(next.queue.length ? "Pending sync" : "Synced");
    } finally { actionBusy.current = false; }
    await sync();
  }
  async function signout() {
    const c = current.current;
    const raw = c && localStorage.getItem(cacheKey(c.workspace.id));
    if (c?.queue.length || (raw && JSON.parse(raw).queue?.length))
      throw new Error(
        "Sync pending records before signing out. They remain saved on this device.",
      );
    await workspaceRequest({ action: "signout" });
    const id = current.current?.workspace.id;
    if (id) localStorage.removeItem(cacheKey(id));
    localStorage.removeItem("stockhale.active");
    window.location.assign("/sign-in");
  }
  function exportPending() {
    const c = current.current;
    if (!c) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(c, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "stockhale-device-changes.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function useServer() {
    if (busy.current || actionBusy.current) throw new Error("Wait for the current sync to finish.");
    if (
      !window.confirm(
        "Pending changes will be removed from this device. Export them first. Load server records?",
      )
    )
      return;
    const c = current.current;
    actionBusy.current = true;
    try {
      const w = await workspaceRequest();
      if (c && w.id !== c.workspace.id) throw new Error("Sign in to the workspace that created these changes.");
      if (current.current !== c) throw new Error("Pending changes updated. Review them again before discarding.");
      save({ workspace: w, queue: [], revision: w.revision });
      setSyncStatus("Synced");
      setSyncError("");
      setReview(null);
    } finally { actionBusy.current = false; }
  }
  return {
    cache,
    ready,
    syncStatus,
    syncError,
    syncNotice,
    clearSyncNotice: () => setSyncNotice(""),
    syncing,
    review,
    inspectPending,
    resolvePending,
    recoverPending,
    dropHeadChange,
    commit,
    sync,
    action,
    signout,
    exportPending,
    useServer,
  };
}

"use client";
import { useEffect, useRef, useState } from "react";
import { verifyChange, changesBetween, modules, canAccessModule, cacheKey, recoverPendingQueue, type Cache, type Workspace } from "./workspace";
import { normalizeStore, type Store } from "./model";
import { configureServiceWorker } from "./service-worker-client";
import { CACHE_VERSION, migrateCache } from "./cache-migrations";
export async function workspaceRequest(body?: unknown) {
  const isRestore =
    !!body &&
    typeof body === "object" &&
    (body as { action?: unknown }).action === "restore";
  const res = await fetch("/api/workspace", {
    method: body ? "POST" : "GET",
    headers: body
      ? {
          "Content-Type": "application/json",
          ...(isRestore ? { "X-StockHale-Action": "restore" } : {}),
        }
      : undefined,
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
      code: value.code,
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
export function useWorkspace() {
  const [cache, setCache] = useState<Cache | null>(null),
    [ready, setReady] = useState(false),
    [syncStatus, setSyncStatus] = useState("Connecting…"),
    [syncError, setSyncError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [review, setReview] = useState<{ changeId: string; collections: string[]; candidates: string[]; message: string; conflict?: boolean; canRecover?: boolean } | null>(null);
  const current = useRef<Cache | null>(null), cacheLoadBlocked = useRef(false),
    busy = useRef(false), actionBusy = useRef(false), syncRequested = useRef(false);
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
      localStorage.setItem("stockwell.active", value.workspace.id);
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
      baseStore: shared.baseStore || shared.workspace.store,
    };
  }
  // Send the head of the queue (or just fetch when empty). One automatic
  // 409 recovery keeps users out of the conflict flow; a second 409 surfaces.
  async function submit(c: Cache | null) {
    for (let attempt = 0; ; attempt++) {
      try {
        const w: Workspace & { accepted?: string[] } = await workspaceRequest(c?.queue.length
          ? { action: "sync", revision: c.revision, changes: c.queue.slice(0, 1) }
          : undefined);
        return { c, w };
      } catch (e) {
        if ((e as { status?: number }).status !== 409 || attempt > 0 || !current.current?.queue.length) throw e;
        const pending = current.current;
        setSyncStatus("Saving your changes…");
        const server: Workspace = await workspaceRequest();
        if (current.current !== pending) throw new Error("Changes updated while saving. They are safe on this device; try again.");
        let recovered: Cache;
        try { recovered = recoverPendingQueue(pending, server); }
        catch (recoveryError) { throw Object.assign(recoveryError as Error, { status: 409 }); }
        save(recovered);
        c = current.current;
      }
    }
  }
  async function sync() {
    if (cacheLoadBlocked.current) return;
    if (busy.current || actionBusy.current) { syncRequested.current = true; return; }
    syncRequested.current = false;
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
      const remaining = c?.queue.length
        ? (latest?.queue || c.queue).filter((change) => change.id !== c.queue[0].id)
        : latest?.queue || [];
      save({
        workspace: remaining.length ? { ...w, store: latest!.workspace.store } : w,
        queue: remaining,
        revision: remaining.length && c?.queue.length ? c.revision + 1 : w.revision,
        baseStore: remaining.length && c?.queue.length ? normalizeStore(c.queue[0].store) : undefined,
      });
      setSyncError("");
      setReview(null);
      setSyncStatus(remaining.length && c && w.revision > c.revision + 1 ? "Conflict · newer queued changes preserved" : remaining.length ? "Pending sync" : "Synced");
      if (remaining.length && (!c || w.revision === c.revision + 1)) setTimeout(() => void sync(), 100);
    } catch (e) {
      const status = (e as { status?: number }).status;
      const code = (e as { code?: string }).code;
      const message = e instanceof Error ? e.message : "Pending change rejected";
      if (code === "TRIAL_EXPIRED" && current.current) {
        const active = current.current;
        save({ ...active, workspace: { ...active.workspace, locked: true, trial: { startedAt: active.workspace.trial?.startedAt || null, endsAt: active.workspace.trial?.endsAt || null, active: false, planActive: false } } });
      }
      setSyncError(message);
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
      const id = localStorage.getItem("stockwell.active"),
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
        const id = localStorage.getItem("stockwell.active"), raw = id && localStorage.getItem(cacheKey(id));
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
    const visible = () => {
      if (!document.hidden) void sync();
    };
    window.addEventListener("online", online);
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
      window.removeEventListener("focus", online);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  function commit(store: Store, module: string, action: string) {
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
    // Forms publish success only after the local write succeeds. Preserve this
    // synchronous contract so storage/validation errors reach their catch blocks.
    const next = appendTabChange(c, store, module, action, occurredAt, "Unavailable");
    save({ ...next, baseStore: next.baseStore || c.workspace.store }, true);
    setReview(null);
    setSyncStatus("Pending sync");
    // Online: write through to the server now and wait for it. Offline: stay
    // queued; the "online" listener drains the queue on reconnect.
    // ponytail: queue is a write-ahead buffer so a dead tab/flaky network never loses data.
    if (navigator.onLine) void sync();
  }
  async function action(body: unknown) {
    if (current.current?.queue.length)
      throw new Error(
        "Sync pending records before changing workspace settings.",
      );
    if (busy.current || actionBusy.current) throw new Error("Wait for the current sync or workspace action to finish.");
    actionBusy.current = true;
    try {
      const w = await workspaceRequest(body);
      save({ workspace: w, queue: [], revision: w.revision });
      return w;
    } finally {
      actionBusy.current = false;
      if (syncRequested.current) void sync();
    }
  }
  async function inspectPending() {
    setReview(null);
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
      } catch (e) { message = e instanceof Error ? e.message : "These changes need a record review before merging."; }
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
      save(recoverPendingQueue(c, server));
      setReview(null);
      setSyncError("");
      setSyncStatus(current.current?.queue.length ? "Pending sync" : "Synced");
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
    localStorage.removeItem("stockwell.active");
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
    a.download = "stockhale-pending-changes.json";
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
    syncing,
    review,
    inspectPending,
    resolvePending,
    recoverPending,
    commit,
    sync,
    action,
    signout,
    exportPending,
    useServer,
  };
}

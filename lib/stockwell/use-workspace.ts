"use client";
import { useEffect, useRef, useState } from "react";
import { verifyChange, cacheKey, type Cache, type Workspace } from "./workspace";
import { normalizeStore, type Store } from "./model";
import { configureServiceWorker } from "./service-worker-client";
export async function workspaceRequest(body?: unknown) {
  const res = await fetch("/api/workspace", {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const value = await res.json();
  if (!res.ok)
    throw Object.assign(new Error(value.error || "Server unavailable"), {
      status: res.status,
    });
  return value;
}
export function useWorkspace() {
  const [cache, setCache] = useState<Cache | null>(null),
    [ready, setReady] = useState(false),
    [syncStatus, setSyncStatus] = useState("Connecting…");
  const current = useRef<Cache | null>(null),
    busy = useRef(false), actionBusy = useRef(false);
  function save(value: Cache) {
    const key = cacheKey(value.workspace.id);
    const previous = current.current;
    if (previous && localStorage.getItem(key) !== JSON.stringify(previous))
      throw new Error(
        "Workspace changed in another tab. Reload to preserve pending records.",
      );
    value = { ...value, workspace: { ...value.workspace, store: normalizeStore(value.workspace.store) } };
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem("stockwell.active", value.workspace.id);
    current.current = value;
    setCache(value);
  }
  async function sync() {
    if (busy.current || actionBusy.current) return;
    busy.current = true;
    try {
      const c = current.current;
      const w: Workspace & { accepted?: string[] } = await workspaceRequest(
        c?.queue.length
          ? {
              action: "sync",
              revision: c.revision,
              changes: c.queue.slice(0, 1),
            }
          : undefined,
      );
      const latest = current.current;
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
      });
      setSyncStatus(remaining.length && c && w.revision > c.revision + 1 ? "Conflict · newer queued changes preserved" : remaining.length ? "Pending sync" : "Synced");
      if (remaining.length && (!c || w.revision === c.revision + 1)) setTimeout(() => void sync(), 100);
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 401) {
        setSyncStatus("Session expired · sign in to sync");
        if (!current.current) window.location.replace("/sign-in");
      } else if (e instanceof Error && e.message.includes("another tab"))
        setSyncStatus("Reload required · another tab changed records");
      else
        setSyncStatus(
          status === 409
            ? "Conflict · pending changes preserved"
            : status === 403
              ? "Permission changed · pending changes preserved"
              : status === 400
                ? `Review needed · ${e instanceof Error ? e.message : "Pending change rejected"} · changes preserved`
                : "Offline · changes saved on this device",
        );
    } finally {
      busy.current = false;
      setReady(true);
    }
  }
  useEffect(() => {
    try {
      const id = localStorage.getItem("stockwell.active"),
        raw = id && localStorage.getItem(cacheKey(id));
      if (raw) {
        const c = JSON.parse(raw) as Cache;
        c.workspace.store = normalizeStore(c.workspace.store);
        current.current = c;
        setCache(c);
        setReady(true);
      }
    } catch {
      setSyncStatus("Device cache could not be loaded");
    }
    void sync();
    const timer = setInterval(() => {
      if (!document.hidden) void sync();
    }, 15000);
    const online = () => void sync();
    const visible = () => {
      if (!document.hidden) void sync();
    };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    void configureServiceWorker().catch(() => {
      // Workspace records still persist locally if offline asset setup fails.
    });
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", online);
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
    const next = {
      ...c,
      workspace: { ...c.workspace, store },
      queue: [
        ...c.queue,
        {
          actorId: c.workspace.member.id,
          id: crypto.randomUUID(),
          module,
          action,
          occurredAt,
          store,
        },
      ],
    };
    const raw = localStorage.getItem(cacheKey(c.workspace.id));
    if (raw && JSON.stringify(JSON.parse(raw)) !== JSON.stringify(c))
      throw new Error("Records changed in another tab. Reload before saving.");
    save(next);
    setSyncStatus("Pending sync");
    void sync();
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
    } finally { actionBusy.current = false; }
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
    if (
      !window.confirm(
        "Pending changes will be removed from this device. Export them first. Load server records?",
      )
    )
      return;
    const w = await workspaceRequest();
    save({ workspace: w, queue: [], revision: w.revision });
    setSyncStatus("Synced");
  }
  return {
    cache,
    ready,
    syncStatus,
    commit,
    sync,
    action,
    signout,
    exportPending,
    useServer,
  };
}

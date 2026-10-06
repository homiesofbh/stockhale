"use client";
import { useEffect, useRef, useState } from "react";
import { cacheKey, type Cache, type Workspace } from "./workspace";
import type { Store } from "./model";
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
    busy = useRef(false);
  function save(value: Cache) {
    const key = cacheKey(value.workspace.id);
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem("stockwell.active", value.workspace.id);
    current.current = value;
    setCache(value);
  }
  async function sync() {
    if (busy.current) return;
    busy.current = true;
    try {
      const c = current.current;
      const w: Workspace = await workspaceRequest(
        c?.queue.length
          ? { action: "sync", revision: c.revision, changes: c.queue }
          : undefined,
      );
      const latest = current.current;
      if (latest && latest !== c) {
        setSyncStatus("Pending changes");
        return;
      }
      save({ workspace: w, queue: [], revision: w.revision });
      setSyncStatus("Synced");
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 401) {
        setSyncStatus("Session expired · sign in to sync");
        if (!current.current) window.location.replace("/sign-in");
      } else
        setSyncStatus(
          status === 409
            ? "Conflict · pending changes preserved"
            : status === 403
              ? "Permission changed · pending changes preserved"
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
        current.current = c;
        setCache(c);
        setReady(true);
      }
    } catch {
      setSyncStatus("Device cache could not be loaded");
    }
    void sync();
    const timer = setInterval(() => void sync(), 15000);
    const online = () => void sync();
    window.addEventListener("online", online);
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js");
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", online);
    };
  }, []);
  function commit(store: Store, module: string, action: string) {
    const c = current.current;
    if (!c) throw new Error("Sign in before saving records.");
    if (
      c.workspace.member.role !== "owner" &&
      !c.workspace.member.modules.includes(module)
    )
      throw new Error("You do not have permission for this module.");
    const next = {
      ...c,
      workspace: { ...c.workspace, store },
      queue: [
        ...c.queue,
        {
          id: crypto.randomUUID(),
          module,
          action,
          occurredAt: new Date().toISOString(),
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
    const w = await workspaceRequest(body);
    save({ workspace: w, queue: [], revision: w.revision });
    return w;
  }
  async function signout() {
    if (current.current?.queue.length)
      throw new Error("Sync or export pending records before signing out.");
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
    a.download = "stockwell-pending-changes.json";
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

"use client";
import { useEffect, useRef, useState } from "react";
import { cacheKey, type Cache, type Workspace } from "./workspace";
import type { Store } from "./model";
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
    busy = useRef(false);
  function save(value: Cache) {
    const key = cacheKey(value.workspace.id);
    const previous = current.current;
    if (previous && localStorage.getItem(key) !== JSON.stringify(previous))
      throw new Error(
        "Workspace changed in another tab. Reload to preserve pending records.",
      );
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
          ? {
              action: "sync",
              revision: c.revision,
              changes: c.queue.slice(0, 1),
            }
          : undefined,
      );
      const latest = current.current;
      if (latest && latest !== c) {
        setSyncStatus("Pending changes");
        return;
      }
      if (c?.queue.length && w.revision !== c.revision + 1)
        throw Object.assign(new Error("Server records changed during retry."), {
          status: 409,
        });
      const remaining = c?.queue.slice(1) || [];
      save({
        workspace: remaining.length ? { ...w, store: c!.workspace.store } : w,
        queue: remaining,
        revision: w.revision,
      });
      setSyncStatus(remaining.length ? "Pending sync" : "Synced");
      if (remaining.length) setTimeout(() => void sync(), 100);
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
          actorId: c.workspace.member.id,
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

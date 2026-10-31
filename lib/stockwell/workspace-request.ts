export async function workspaceRequest(body?: unknown, signal?: AbortSignal) {
  const res = await fetch("/api/workspace", {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    // A hung request (captive portal, dead Wi-Fi) would pin busy=true and stall
    // sync forever. Safe to abort: the server dedupes sync changes by id.
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
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

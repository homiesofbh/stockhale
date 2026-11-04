export async function workspaceRequest(body?: unknown, signal?: AbortSignal, query?: { revision: number; workspaceId: string } | { details: true }) {
  const params = new URLSearchParams();
  if (query && "revision" in query) { params.set("revision", String(query.revision)); params.set("workspaceId", query.workspaceId); }
  if (query && "details" in query) params.set("details", "1");
  const suffix = params.size ? `?${params}` : "";
  const url = `/api/workspace${suffix}`;
  const res = await fetch(url, {
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

import {
  authorize,
  authenticate,
  requestPasswordReset,
  resetPassword,
  snapshot,
  mutate,
  logout,
  deliverEmails,
  adminOverview,
  adminTestimonials,
  publicTestimonials,
  reviewTestimonial,
  submitTestimonial,
  updateAdminSubscription,
  cancelAdminSubscription,
  renewAdminSubscription,
  workspaceRevision,
  workspaceDetails,
  workspaceCollection,
  workspaceReport,
} from "@/lib/stockwell/server";
import { withDatabase } from "@/lib/stockwell/database";
import { readJsonBody } from "@/lib/stockwell/request-body";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
function failure(e: unknown) {
  const error = e as { status?: number; statusCode?: number; code?: string };
  // PostgreSQL errors are infrastructure failures, not invalid credentials.
  const infrastructure = !!error.code && !error.statusCode;
  if (infrastructure)
    console.error("Workspace database request failed:", error.code);
  return Response.json(
    {
      error: infrastructure
        ? "Database unavailable. Check the database configuration and migrations."
        : e instanceof Error
          ? e.message
          : "Request failed.",
      code: error.code === "PLAN_EXPIRED" ? error.code : undefined,
    },
    {
      status: infrastructure ? 503 : error.statusCode || error.status || 400,
      headers,
    },
  );
}
function sessionHeaders(authHeaders: Headers) {
  const result = new Headers(headers);
  for (const cookie of authHeaders.getSetCookie())
    result.append("Set-Cookie", cookie);
  return result;
}
export async function GET(request: Request) {
  const requestStartedAt = Date.now();
  try {
    return await withDatabase(async () => {
      if (new URL(request.url).searchParams.get("testimonials") === "public")
        return Response.json(await publicTestimonials(), { headers });
      const authStartedAt = Date.now();
      const { user, headers: authHeaders } = await authorize(request);
      console.info("Workspace request auth timing", { authMs: Date.now() - authStartedAt });
      if (new URL(request.url).searchParams.get("details") === "1")
        return Response.json(await workspaceDetails(user), { headers: sessionHeaders(authHeaders) });
      const collection = new URL(request.url).searchParams.get("collection");
      if (collection) {
        const params = new URL(request.url).searchParams;
        return Response.json(await workspaceCollection(user, {
          collection,
          module: params.get("module") || "",
          query: params.get("q") || "",
          secondaryQuery: params.get("q2") || "",
          productId: params.get("productId") || "",
          productRole: params.get("productRole") || "",
          actor: params.get("actor") || "",
          moduleFilter: params.get("moduleFilter") || "",
          week: params.get("week") || "",
          accountId: params.get("accountId") || "",
          bankOnly: params.get("bankOnly") === "1",
          secondaryFrom: params.get("from2") || "",
          secondaryTo: params.get("to2") || "",
          from: params.get("from") || "",
          to: params.get("to") || "",
          category: params.get("category") || "All",
          status: params.get("status") || "All",
          paymentMethod: params.get("paymentMethod") || "All",
          contactId: params.get("contactId") || "",
          postedOnly: params.get("postedOnly") === "1",
          noContactOnly: params.get("noContactOnly") === "1",
          unpaidOnly: params.get("unpaidOnly") === "1",
          forwardableOnly: params.get("forwardableOnly") === "1",
          tradeId: params.get("tradeId") || "",
          productIds: (params.get("productIds") || "").split(",").filter(Boolean).slice(0, 5000),
          page: Number(params.get("page") || 1),
          pageSize: Number(params.get("pageSize") || 25),
        }), { headers: sessionHeaders(authHeaders) });
      }
      if (new URL(request.url).searchParams.get("report") === "1") {
        const params = new URL(request.url).searchParams;
        return Response.json(await workspaceReport(user, {
          query: params.get("q") || "", from: params.get("from") || "", to: params.get("to") || "",
          status: params.get("status") || "All", paymentMethod: params.get("paymentMethod") || "All",
          report: params.get("name") || "Billing report", reportContact: params.get("contact") || "",
          reportProduct: params.get("product") || "", manufacturer: params.get("manufacturer") === "1",
          page: Number(params.get("page") || 1), pageSize: Number(params.get("pageSize") || 25), all: params.get("all") === "1",
        }), { headers: sessionHeaders(authHeaders) });
      }
      if (new URL(request.url).searchParams.get("admin") === "overview") {
        const params = new URL(request.url).searchParams;
        return Response.json(await adminOverview(user, {
          query: params.get("q") || "",
          subscription: params.get("subscription") || "All",
          sort: params.get("sort") || "alphabetical",
          direction: params.get("direction") || "asc",
          page: Number(params.get("page") || 1),
          pageSize: Number(params.get("pageSize") || 10),
        }), { headers: sessionHeaders(authHeaders) });
      }
      if (new URL(request.url).searchParams.get("admin") === "testimonials")
        return Response.json(await adminTestimonials(user), { headers: sessionHeaders(authHeaders) });
      const params = new URL(request.url).searchParams;
      const knownRevision = params.get("revision"), knownWorkspace = params.get("workspaceId");
      if (knownRevision !== null && knownWorkspace) {
        const current = await workspaceRevision(user);
        if (current.locked) return Response.json({ error: "Your plan has expired. Contact the StockHale team for further assistance.", code: "PLAN_EXPIRED" }, { status: 402, headers: sessionHeaders(authHeaders) });
        if (current.id === knownWorkspace && current.revision === Number(knownRevision))
          return Response.json({ unchanged: true, revision: current.revision }, { headers: sessionHeaders(authHeaders) });
      }
      const snapshotStartedAt = Date.now();
      const overview = await snapshot(user, { details: false });
      console.info("Workspace startup snapshot timing", { snapshotMs: Date.now() - snapshotStartedAt, totalMs: Date.now() - requestStartedAt });
      if (overview.locked) return Response.json({ error: "Your plan has expired. Contact the StockHale team for further assistance.", code: "PLAN_EXPIRED" }, { status: 402, headers: sessionHeaders(authHeaders) });
      return Response.json(overview, {
        headers: sessionHeaders(authHeaders),
      });
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  try {
    const origin = request.headers.get("origin");
    const canonicalURL =
      process.env.BETTER_AUTH_URL || process.env.STOCKWELL_ORIGIN;
    if (!canonicalURL)
      throw Object.assign(
        new Error("Set BETTER_AUTH_URL to this deployment's origin."),
        { status: 503 },
      );
    if (!origin || origin !== new URL(canonicalURL).origin)
      return Response.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );

    const restoreRequested =
      request.headers.get("x-stockhale-action") === "restore";
    return await withDatabase(async () => {
      // Large restore payloads are authorized before any body bytes are read.
      const restoreAuthorization = restoreRequested
        ? await authorize(request)
        : undefined;
      if (restoreAuthorization) {
        const current = await snapshot(restoreAuthorization.user);
        if (current.member.role !== "owner")
          throw Object.assign(
            new Error("Only the workspace owner can restore a backup."),
            { status: 403 },
          );
      }
      const body = await readJsonBody(
        request,
        restoreRequested ? 50_000_000 : 8_000_000,
      );
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw Object.assign(new Error("Invalid request body."), {
          status: 400,
        });
      const payload = body as Record<string, any>;
      if (payload.action === "restore" && !restoreRequested)
        throw Object.assign(
          new Error("Restore requests must use the restore request mode."),
          { status: 400 },
        );
      if (restoreRequested && payload.action !== "restore")
        throw Object.assign(new Error("Invalid restore request."), {
          status: 400,
        });
      if (payload.action === "request-password-reset")
        return Response.json(await requestPasswordReset(payload, request), { headers });
      if (payload.action === "reset-password")
        return Response.json(await resetPassword(payload, request), { headers });
      if (["signin", "signup", "team-signup"].includes(payload.action)) {
        const authStartedAt = Date.now();
        const { user, headers: authHeaders } = await authenticate(payload, request);
        console.info("Workspace auth timing", { action: payload.action, authMs: Date.now() - authStartedAt });
        const overview = await snapshot(user, { details: false, includeStore: payload.compactAuth !== true });
        if (payload.compactAuth === true && !overview.locked) {
          const { store, members, audit, ...identity } = overview;
          return Response.json({ ...identity, compactAuth: true }, { headers: sessionHeaders(authHeaders) });
        }
        return Response.json(overview, {
          headers: sessionHeaders(authHeaders),
        });
      }
      if (payload.action === "signout") {
        const authHeaders = await logout(request);
        return Response.json(
          { ok: true },
          {
            headers: sessionHeaders(authHeaders),
          },
        );
      }
      const { user, headers: authHeaders } =
        restoreAuthorization || (await authorize(request));
      if (payload.action === "testimonial-submit")
        return Response.json(await submitTestimonial(user, payload), { headers: sessionHeaders(authHeaders) });
      if (payload.action === "testimonial-review")
        return Response.json(await reviewTestimonial(user, payload), { headers: sessionHeaders(authHeaders) });
      if (payload.action === "admin-subscription") {
        const result = await updateAdminSubscription(user, payload);
        return Response.json(result, { headers: sessionHeaders(authHeaders) });
      }
      if (payload.action === "admin-cancel-subscription") {
        return Response.json(await cancelAdminSubscription(user, payload), { headers: sessionHeaders(authHeaders) });
      }
      if (payload.action === "admin-renew-subscription") {
        return Response.json(await renewAdminSubscription(user, payload), { headers: sessionHeaders(authHeaders) });
      }
      const result = await mutate(user, payload);
      console.info("Workspace mutation timing", { action: payload.action || "sync", mutationMs: Date.now() - requestStartedAt });
      if (payload.action === "retry-email") {
        await deliverEmails();
        return Response.json(result, { headers: sessionHeaders(authHeaders) });
      }
      if (payload.action === "backup" || payload.action === "backup-recovery") {
        return Response.json(result, { headers: sessionHeaders(authHeaders) });
      }
      if (payload.action === "sync" && payload.compactSync === true && !(result as { needsSnapshot?: boolean }).needsSnapshot) {
        console.info("Workspace compact sync response timing", { totalMs: Date.now() - requestStartedAt });
        return Response.json({ compactSync: true, ...result }, { headers: sessionHeaders(authHeaders) });
      }
      const snapshotStartedAt = Date.now();
      const overview = await snapshot(user, { details: false });
      console.info("Workspace response snapshot timing", { action: payload.action || "sync", snapshotMs: Date.now() - snapshotStartedAt, totalMs: Date.now() - requestStartedAt });
      return Response.json(
        { ...overview, ...result },
        { headers: sessionHeaders(authHeaders) },
      );
    });
  } catch (e) {
    return failure(e);
  }
}

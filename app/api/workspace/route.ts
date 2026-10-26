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
      code: error.code === "TRIAL_EXPIRED" ? error.code : undefined,
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
  try {
    return await withDatabase(async () => {
      if (new URL(request.url).searchParams.get("testimonials") === "public")
        return Response.json(await publicTestimonials(), { headers });
      const { user, headers: authHeaders } = await authorize(request);
      if (new URL(request.url).searchParams.get("admin") === "overview")
        return Response.json(await adminOverview(user), { headers: sessionHeaders(authHeaders) });
      if (new URL(request.url).searchParams.get("admin") === "testimonials")
        return Response.json(await adminTestimonials(user), { headers: sessionHeaders(authHeaders) });
      const overview = await snapshot(user);
      if (overview.locked) return Response.json({ error: "Your trial has expired.", code: "TRIAL_EXPIRED" }, { status: 402, headers: sessionHeaders(authHeaders) });
      await deliverEmails();
      return Response.json(overview, {
        headers: sessionHeaders(authHeaders),
      });
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
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
        const { user, headers: authHeaders } = await authenticate(payload, request);
        const overview = await snapshot(user, { details: false });
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
        await deliverEmails();
        return Response.json(result, { headers: sessionHeaders(authHeaders) });
      }
      if (payload.action === "admin-cancel-subscription") {
        return Response.json(await cancelAdminSubscription(user, payload), { headers: sessionHeaders(authHeaders) });
      }
      const result = await mutate(user, payload);
      await deliverEmails();
      return Response.json(
        { ...(await snapshot(user)), ...result },
        { headers: sessionHeaders(authHeaders) },
      );
    });
  } catch (e) {
    return failure(e);
  }
}

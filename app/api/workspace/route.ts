import {
  authorize,
  authenticate,
  snapshot,
  mutate,
  logout,
  deliverEmails,
} from "@/lib/stockwell/server";
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
    const { user, headers: authHeaders } = await authorize(request);
    await deliverEmails();
    return Response.json(await snapshot(user), {
      headers: sessionHeaders(authHeaders),
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
    const text = await request.text();
    if (text.length > 8_000_000) throw new Error("Request too large.");
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error("Invalid request body.");
    if (["signin", "signup"].includes(body.action)) {
      const { user, headers: authHeaders } = await authenticate(body, request);
      return Response.json(await snapshot(user), {
        headers: sessionHeaders(authHeaders),
      });
    }
    if (body.action === "signout") {
      const authHeaders = await logout(request);
      return Response.json(
        { ok: true },
        {
          headers: sessionHeaders(authHeaders),
        },
      );
    }
    const { user, headers: authHeaders } = await authorize(request);
    const result = await mutate(user, body);
    await deliverEmails();
    return Response.json(
      { ...(await snapshot(user)), ...result },
      { headers: sessionHeaders(authHeaders) },
    );
  } catch (e) {
    return failure(e);
  }
}

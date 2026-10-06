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
  return Response.json(
    { error: e instanceof Error ? e.message : "Request failed." },
    { status: (e as { status?: number }).status || 400, headers },
  );
}
export async function GET(request: Request) {
  try {
    const user = authorize(request);
    await deliverEmails();
    return Response.json(snapshot(user), { headers });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (
      !origin ||
      (process.env.STOCKWELL_ORIGIN
        ? origin !== process.env.STOCKWELL_ORIGIN
        : new URL(origin).host !== request.headers.get("host"))
    )
      return Response.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    const text = await request.text();
    if (text.length > 8_000_000) throw new Error("Request too large.");
    const body = JSON.parse(text);
    if (["signin", "signup"].includes(body.action)) {
      const { token, user } = authenticate(body, request);
      return Response.json(snapshot(user), {
        headers: {
          ...headers,
          "Set-Cookie": `stockwell_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.NODE_ENV === "production" && new URL(origin!).protocol === "https:" ? "; Secure" : ""}`,
        },
      });
    }
    if (body.action === "signout") {
      logout(request);
      return Response.json(
        { ok: true },
        {
          headers: {
            ...headers,
            "Set-Cookie":
              "stockwell_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
          },
        },
      );
    }
    const user = authorize(request);
    const result = mutate(user, body);
    await deliverEmails();
    return Response.json({ ...snapshot(user), ...result }, { headers });
  } catch (e) {
    return failure(e);
  }
}

import { runScheduledEmailDrain } from "@/lib/stockwell/server";
import { withDatabase } from "@/lib/stockwell/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expected = process.env.EMAIL_DRAIN_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`)
    return new Response(null, { status: 404 });
  try {
    await withDatabase(runScheduledEmailDrain);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Scheduled email drain failed:", error);
    return Response.json({ error: "Email drain failed." }, { status: 503 });
  }
}

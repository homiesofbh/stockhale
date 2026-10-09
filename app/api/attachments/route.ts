import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { authorize, snapshot, recordAudit } from "@/lib/stockwell/server";
import { ATTACHMENT_BUCKET, ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES, attachmentKey } from "@/lib/stockwell/attachments";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function s3() { return new S3Client({ forcePathStyle: true }); }
function allowed(member: { role: string; modules: string[] }, module: string) {
  return member.role === "owner" || member.modules.includes(module);
}
function policy(body: any) {
  if (!body || !["expense", "purchase"].includes(body.recordType) || typeof body.recordId !== "string" || !body.recordId || typeof body.name !== "string" || typeof body.contentType !== "string" || !Number.isInteger(body.size) || body.size <= 0 || body.size > MAX_ATTACHMENT_BYTES || !(ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(body.contentType)) throw new Error("Invalid attachment. Use a PDF, JPG, PNG, or WEBP file up to 5 MB.");
}
export async function POST(request: Request) {
  try {
    const { user } = await authorize(request);
    const body = await request.json(); policy(body);
    const snap = await snapshot(user);
    const module = body.recordType === "expense" ? "Expenses" : "Purchases";
    if (!allowed(snap.member, module)) return Response.json({ error: "You do not have access to this module." }, { status: 403 });
    const id = randomUUID(), key = attachmentKey(snap.id, body.recordType, body.recordId, id);
    const uploadUrl = await getSignedUrl(s3(), new PutObjectCommand({ Bucket: ATTACHMENT_BUCKET, Key: key, ContentType: body.contentType, ContentLength: body.size }), { expiresIn: 900 });
    return Response.json({ id, key, uploadUrl, expiresIn: 900 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Attachment upload unavailable." }, { status: 400 }); }
}
export async function GET(request: Request) {
  try {
    const { user } = await authorize(request);
    const url = new URL(request.url), key = url.searchParams.get("key") || "";
    const snap = await snapshot(user);
    if (!key.startsWith(`${snap.id}/`)) return Response.json({ error: "Invalid attachment scope." }, { status: 403 });
    const downloadUrl = await getSignedUrl(s3(), new GetObjectCommand({ Bucket: ATTACHMENT_BUCKET, Key: key }), { expiresIn: 900 });
    return Response.json({ downloadUrl, expiresIn: 900 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Attachment download unavailable." }, { status: 400 }); }
}
export async function DELETE(request: Request) {
  try {
    const { user } = await authorize(request);
    const body = await request.json();
    const snap = await snapshot(user);
    if (snap.member.role !== "owner") return Response.json({ error: "Only the workspace owner can delete attachments." }, { status: 403 });
    if (typeof body?.key !== "string" || !body.key.startsWith(`${snap.id}/`)) return Response.json({ error: "Invalid attachment scope." }, { status: 403 });
    await s3().send(new DeleteObjectCommand({ Bucket: ATTACHMENT_BUCKET, Key: body.key }));
    await recordAudit(user, body.module === "Purchases" ? "Purchases" : "Expenses", "Attachment deleted", body.key);
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Attachment deletion unavailable." }, { status: 400 }); }
}

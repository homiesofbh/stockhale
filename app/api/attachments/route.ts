import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { authorize, snapshot, recordAudit } from "@/lib/stockwell/server";
import { ATTACHMENT_BUCKET, ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES, attachmentKey } from "@/lib/stockwell/attachments";
import { randomUUID } from "node:crypto";
import { readJsonBody } from "@/lib/stockwell/request-body";
import { withDatabase, transaction } from "@/lib/stockwell/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const WORKSPACE_ATTACHMENT_QUOTA_BYTES = 100_000_000;
const RESERVATION_TTL_MS = 20 * 60 * 1000;

function s3() { return new S3Client({ forcePathStyle: true }); }
function allowed(member: { role: string; modules: string[] }, module: string) {
  return member.role === "owner" || member.modules.includes(module);
}
function policy(body: any) {
  if (!body || !["expense", "purchase"].includes(body.recordType) || typeof body.recordId !== "string" || !body.recordId || body.recordId.length > 128 || typeof body.name !== "string" || body.name.length > 255 || typeof body.contentType !== "string" || !Number.isInteger(body.size) || body.size <= 0 || body.size > MAX_ATTACHMENT_BYTES || !(ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(body.contentType)) throw new Error("Invalid attachment. Use a PDF, JPG, PNG, or WEBP file up to 5 MB.");
}
export async function POST(request: Request) {
  try {
    return await withDatabase(async () => {
      const { user } = await authorize(request);
      const body = await readJsonBody(request, 32_768) as Record<string, any>; policy(body);
      const snap = await snapshot(user);
      const module = body.recordType === "expense" ? "Expenses" : "Purchases";
      if (!allowed(snap.member, module)) return Response.json({ error: "You do not have access to this module." }, { status: 403 });
      const id = randomUUID(), key = attachmentKey(snap.id, body.recordType, body.recordId, id);
      const client = s3();
      const result = await transaction(async (db) => {
        await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`stockwell:attachment-quota:${snap.id}`]);
        await db.query("DELETE FROM attachment_upload_reservations WHERE expires <= $1", [Date.now()]);
        let storedBytes = 0, continuationToken: string | undefined;
        do {
          const page = await client.send(new ListObjectsV2Command({ Bucket: ATTACHMENT_BUCKET, Prefix: `${snap.id}/`, ContinuationToken: continuationToken }));
          storedBytes += (page.Contents || []).reduce((sum, object) => sum + (object.Size || 0), 0);
          continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
        } while (continuationToken);
        const reserved = await db.query("SELECT COALESCE(SUM(size), 0)::bigint AS bytes FROM attachment_upload_reservations WHERE workspace=$1", [snap.id]);
        if (storedBytes + Number(reserved.rows[0].bytes) + body.size > WORKSPACE_ATTACHMENT_QUOTA_BYTES)
          throw Object.assign(new Error("Workspace attachment storage limit reached (100 MB). Delete an existing attachment before uploading another."), { statusCode: 413 });
        await db.query("INSERT INTO attachment_upload_reservations(workspace, object_key, size, expires) VALUES($1,$2,$3,$4)", [snap.id, key, body.size, Date.now() + RESERVATION_TTL_MS]);
        const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: ATTACHMENT_BUCKET, Key: key, ContentType: body.contentType, ContentLength: body.size }), { expiresIn: 900 });
        return { id, key, uploadUrl, expiresIn: 900 };
      });
      return Response.json(result);
    });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Attachment upload unavailable." }, { status: Number((error as { statusCode?: number })?.statusCode) || 400 }); }
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
    const body = await readJsonBody(request, 32_768) as Record<string, any>;
    const snap = await snapshot(user);
    if (snap.member.role !== "owner") return Response.json({ error: "Only the workspace owner can delete attachments." }, { status: 403 });
    if (typeof body?.key !== "string" || !body.key.startsWith(`${snap.id}/`)) return Response.json({ error: "Invalid attachment scope." }, { status: 403 });
    await s3().send(new DeleteObjectCommand({ Bucket: ATTACHMENT_BUCKET, Key: body.key }));
    await recordAudit(user, body.module === "Purchases" ? "Purchases" : "Expenses", "Attachment deleted", body.key);
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Attachment deletion unavailable." }, { status: Number((error as { statusCode?: number })?.statusCode) || 400 }); }
}

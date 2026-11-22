import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { authorize, workspaceRevision, recordAudit } from "@/lib/stockwell/server";
import { ATTACHMENT_BUCKET, ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES, attachmentKey } from "@/lib/stockwell/attachments";
import { randomUUID } from "node:crypto";
import { readJsonBody } from "@/lib/stockwell/request-body";
import { withDatabase, transaction, query } from "@/lib/stockwell/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const WORKSPACE_ATTACHMENT_QUOTA_BYTES = 100_000_000;
const RESERVATION_TTL_MS = 20 * 60 * 1000;

function s3() { return new S3Client({ forcePathStyle: true }); }
async function attachmentMember(workspaceId: string, user: { id: string }) {
  const result = await query('SELECT w.owner,m.modules FROM workspaces w JOIN members m ON m.workspace=w.id WHERE w.id=$1 AND m."user"=$2', [workspaceId, user.id]);
  if (!result.rows[0]) throw new Error("Workspace unavailable.");
  return { role: result.rows[0].owner === user.id ? "owner" : "member", modules: JSON.parse(result.rows[0].modules) as string[] };
}
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
      const access = await workspaceRevision(user);
      if (typeof body.workspaceId !== "string" || body.workspaceId !== access.id) return Response.json({ error: "The active workspace changed. Select it again before uploading this attachment." }, { status: 409 });
      if (body.actorId !== undefined && body.actorId !== user.id) return Response.json({ error: "Sign in to the workspace member who created this attachment." }, { status: 403 });
      if (access.locked) return Response.json({ error: "Your 3-day trial has ended. Choose a plan to continue." }, { status: 402 });
      const { modules, role } = await attachmentMember(access.id, user);
      const module = body.recordType === "expense" ? "Expenses" : "Purchases";
      if (!allowed({ role, modules }, module)) return Response.json({ error: "You do not have access to this module." }, { status: 403 });
      if (body.attachmentId !== undefined && (typeof body.attachmentId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.attachmentId))) throw new Error("The attachment could not be identified. Choose the file again and retry.");
      const id = body.attachmentId || randomUUID(), key = attachmentKey(access.id, body.recordType, body.recordId, id);
      if (await attachedKey(access.id, key, modules, role)) return Response.json({ error: "This attachment is already saved. Choose the file again." }, { status: 409 });
      const client = s3();
      const result = await transaction(async (db) => {
        await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`stockwell:attachment-quota:${access.id}`]);
        await db.query("DELETE FROM attachment_upload_reservations WHERE expires <= $1", [Date.now()]);
        let storedBytes = 0;
        let alreadyStored = false;
        let continuationToken: string | undefined;
        try {
          do {
            const page = await client.send(new ListObjectsV2Command({ Bucket: ATTACHMENT_BUCKET, Prefix: `${access.id}/`, ContinuationToken: continuationToken }));
            for (const object of page.Contents || []) {
              if (object.Key === key) alreadyStored = true;
              storedBytes += object.Size || 0;
            }
            continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
          } while (continuationToken);
        } catch {
          throw new Error("Could not verify workspace attachment storage. Please retry.");
        }
        if (alreadyStored) throw Object.assign(new Error("This attachment is already saved. Choose the file again."), { statusCode: 409 });
        const reserved = await db.query("SELECT COALESCE(SUM(size) FILTER (WHERE object_key<>$2), 0)::bigint AS bytes, COALESCE(MAX(size) FILTER (WHERE object_key=$2), 0)::bigint AS previous_size FROM attachment_upload_reservations WHERE workspace=$1", [access.id, key]);
        if (storedBytes + Number(reserved.rows[0].bytes) + Math.max(body.size, Number(reserved.rows[0].previous_size)) > WORKSPACE_ATTACHMENT_QUOTA_BYTES)
          throw Object.assign(new Error("Workspace attachment storage limit reached (100 MB). Delete an existing attachment before uploading another."), { statusCode: 413 });
        await db.query("INSERT INTO attachment_upload_reservations(workspace, object_key, size, expires) VALUES($1,$2,$3,$4) ON CONFLICT(object_key) DO UPDATE SET size=GREATEST(attachment_upload_reservations.size, EXCLUDED.size), expires=EXCLUDED.expires", [access.id, key, body.size, Date.now() + RESERVATION_TTL_MS]);
        const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: ATTACHMENT_BUCKET, Key: key, ContentType: body.contentType, ContentLength: body.size, IfNoneMatch: "*" }), { expiresIn: 900 });
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
    const access = await workspaceRevision(user);
    if (access.locked) return Response.json({ error: "Your 3-day trial has ended. Choose a plan to continue." }, { status: 402 });
    const { role, modules } = await attachmentMember(access.id, user);
    if (!await attachedKey(access.id, key, modules, role)) return Response.json({ error: "You do not have access to this attachment." }, { status: 403 });
    const downloadUrl = await getSignedUrl(s3(), new GetObjectCommand({ Bucket: ATTACHMENT_BUCKET, Key: key }), { expiresIn: 900 });
    return Response.json({ downloadUrl, expiresIn: 900 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Attachment download unavailable." }, { status: 400 }); }
}
export async function DELETE(request: Request) {
  try {
    const { user } = await authorize(request);
    const body = await readJsonBody(request, 32_768) as Record<string, any>;
    const access = await workspaceRevision(user);
    if (access.locked) return Response.json({ error: "Your 3-day trial has ended. Choose a plan to continue." }, { status: 402 });
    const { role, modules } = await attachmentMember(access.id, user);
    if (typeof body?.key !== "string") return Response.json({ error: "You cannot delete this attachment. Check your module access and whether the file is already attached to a saved record." }, { status: 403 });
    const referenced = await attachedKey(access.id, body.key, modules, role);
    if (referenced && body.unreferencedOnly) return Response.json({ error: "This attachment is already referenced by a saved record." }, { status: 409 });
    if (!await canDeleteKey(access.id, body.key, modules, role)) return Response.json({ error: "You cannot delete this attachment. Check your module access and whether the file is already attached to a saved record." }, { status: 403 });
    await s3().send(new DeleteObjectCommand({ Bucket: ATTACHMENT_BUCKET, Key: body.key }));
    await recordAudit(user, body.module === "Purchases" ? "Purchases" : "Expenses", "Attachment deleted", body.key);
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Attachment deletion unavailable." }, { status: Number((error as { statusCode?: number })?.statusCode) || 400 }); }
}
async function attachedKey(workspaceId: string, key: string, modules: string[], role: string) {
  const parts = key.split("/");
  if (parts.length !== 4 || parts[0] !== workspaceId || !parts.every(Boolean)) return false;
  const { collection, module } = attachmentType(parts[1]);
  if (!collection || (role !== "owner" && !modules.includes(module))) return false;
  const result = await query("SELECT 1 FROM workspace_records WHERE workspace=$1 AND collection=$2 AND record_id=$3 AND record->'attachments' @> $4::jsonb LIMIT 1", [workspaceId, collection, parts[2], JSON.stringify([{ key }])]);
  return !!result.rowCount;
}
async function canDeleteKey(workspaceId: string, key: string, modules: string[], role: string) {
  const parts = key.split("/");
  if (parts.length !== 4 || parts[0] !== workspaceId || !parts.every(Boolean)) return false;
  const { collection, module } = attachmentType(parts[1]);
  if (!collection || (role !== "owner" && !modules.includes(module))) return false;
  const record = await query("SELECT record->'attachments' AS attachments FROM workspace_records WHERE workspace=$1 AND collection=$2 AND record_id=$3", [workspaceId, collection, parts[2]]);
  const attachmentExists = Array.isArray(record.rows[0]?.attachments) && record.rows[0].attachments.some((item: { key?: string }) => item.key === key);
  return !attachmentExists || role === "owner";
}
function attachmentType(type: string) {
  if (type === "expense") return { collection: "expenses", module: "Expenses" };
  if (type === "purchase") return { collection: "purchases", module: "Purchases" };
  return { collection: "", module: "" };
}

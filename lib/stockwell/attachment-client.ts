"use client";

import { validateAttachment } from "./attachments";
import type { Attachment } from "./model";

type RecordType = "expense" | "purchase";
type PendingAttachment = Attachment & {
  recordType: RecordType;
  recordId: string;
  pendingId: string;
  workspaceId: string;
  actorId?: string;
};
type QueueEntry = {
  pendingId: string;
  workspaceId: string;
  actorId?: string;
  recordType: RecordType;
  recordId: string;
  attachment: Attachment;
  uploaded?: Attachment;
  file: File;
};

const queueKey = "stockhale.pending-attachments";
const deletionQueueKey = "stockhale.pending-attachment-deletions";
const dbName = "stockhale-attachments";
const storeName = "files";
const activeRetries = new Map<string, Promise<PendingAttachment[]>>();
let queueMutationTail: Promise<void> = Promise.resolve();

function mutateQueue<T>(operation: () => T | Promise<T>): Promise<T> {
  const run = () => navigator.locks?.request
    ? navigator.locks.request("stockhale-attachment-queue", operation)
    : operation();
  const pending = queueMutationTail.then(run, run);
  queueMutationTail = pending.then(() => undefined, () => undefined);
  return pending;
}

function readQueue(): Omit<QueueEntry, "file">[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(queueKey) || "[]");
    if (!Array.isArray(value)) throw new Error("Offline attachment queue is invalid.");
    return value as Omit<QueueEntry, "file">[];
  } catch {
    throw new Error("Offline attachment queue could not be read. Preserve browser data and contact support before clearing site storage.");
  }
}

function writeQueue(queue: Omit<QueueEntry, "file">[]) {
  localStorage.setItem(queueKey, JSON.stringify(queue));
}

function withQueueLock<T>(operation: () => T | Promise<T>): Promise<T> {
  return mutateQueue(operation);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Attachment storage unavailable."));
  });
}

async function storeFile(id: string, file: File) {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(file, id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not save attachment offline."));
      transaction.onabort = () => reject(transaction.error || new Error("Could not save attachment offline."));
    });
  } finally { db.close(); }
}

async function readFile(id: string): Promise<File> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).get(id);
    request.onsuccess = () => {
      db.close();
      if (request.result instanceof File) resolve(request.result);
      else reject(new Error("Offline attachment file is unavailable."));
    };
    request.onerror = () => { db.close(); reject(request.error || new Error("Could not read attachment.")); };
  });
}

async function removeFile(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(storeName, "readwrite").objectStore(storeName).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Could not remove attachment."));
  });
  db.close();
}

async function uploadNow(file: File, recordType: RecordType, recordId: string, workspaceId: string, attachmentId?: string, actorId?: string): Promise<Attachment> {
  validateAttachment(file);
  const metadata = await fetch("/api/attachments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId, actorId, recordType, recordId, name: file.name, contentType: file.type, size: file.size, attachmentId }),
  });
  const policy = await metadata.json();
  if (!metadata.ok) throw new Error(policy.error || "Could not prepare attachment upload.");
  const upload = await fetch(policy.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type, "If-None-Match": "*" }, body: file });
  if (!upload.ok) throw new Error("Could not upload attachment.");
  return { id: attachmentId || policy.id, key: policy.key, name: file.name, contentType: file.type, size: file.size, status: "uploaded", uploadedAt: new Date().toISOString() };
}

export async function uploadAttachment(file: File, recordType: RecordType, recordId: string, identity: { workspaceId: string; actorId: string }): Promise<Attachment> {
  const { workspaceId, actorId } = identity;
  if (!workspaceId) throw new Error("Select a workspace before attaching a file.");
  validateAttachment(file);
  if (navigator.onLine) return uploadNow(file, recordType, recordId, workspaceId, undefined, actorId);

  const pendingId = crypto.randomUUID();
  const attachment: Attachment = { id: pendingId, key: `pending/${pendingId}`, name: file.name, contentType: file.type, size: file.size, status: "pending" };
  await storeFile(pendingId, file);
  try {
    await withQueueLock(() => writeQueue([...readQueue(), { pendingId, workspaceId, actorId, recordType, recordId, attachment }]));
  } catch (error) {
    await removeFile(pendingId);
    throw error;
  }
  return attachment;
}

export async function uploadAndSaveAttachment(file: File, recordType: RecordType, recordId: string, save: (attachment?: Attachment) => Promise<void>, identity: { workspaceId: string; actorId: string }) {
  const attachment = await uploadAttachment(file, recordType, recordId, identity);
  try {
    await save(attachment);
    return attachment;
  } catch (error) {
    if (attachment.status === "uploaded") {
      if (!(error instanceof TypeError)) await deleteAttachment(attachment.key, true).catch(() => undefined);
    } else await acknowledgeAttachmentQueue([attachment.id]).catch(() => undefined);
    throw error;
  }
}

async function retryAttachmentQueueOnce(workspaceId: string, actorId: string): Promise<PendingAttachment[]> {
  if (!navigator.onLine) return [];
  const queue = readQueue();
  const completed: PendingAttachment[] = [];
  for (const entry of queue.filter(item => item.workspaceId === workspaceId && item.actorId === actorId)) {
    try {
      let attachment = entry.uploaded;
      if (!attachment) {
        const file = await readFile(entry.pendingId);
        attachment = await uploadNow(file, entry.recordType, entry.recordId, entry.workspaceId, entry.pendingId, entry.actorId);
        // Persist the uploaded key before handing it to the workspace save. If
        // that save fails, the next retry can reuse the object instead of
        // uploading another copy.
        await withQueueLock(() => writeQueue(readQueue().map(item => item.pendingId === entry.pendingId ? { ...item, uploaded: attachment } : item)));
      }
      completed.push({ ...attachment, recordType: entry.recordType, recordId: entry.recordId, pendingId: entry.pendingId, workspaceId: entry.workspaceId, actorId: entry.actorId });
    } catch {
      // Keep failed entries queued for the next online event or page load.
    }
  }
  return completed;
}

export async function discardOrphanedAttachments(identity: { workspaceId: string; actorId: string }, hasPendingRecord: (item: { recordType: RecordType; recordId: string; pendingId: string }) => boolean) {
  const run = async () => {
    const queue = await withQueueLock(() => readQueue());
    const discarded: string[] = [];
    for (const entry of queue) {
      if (entry.workspaceId !== identity.workspaceId || entry.actorId !== identity.actorId || hasPendingRecord(entry)) continue;
      if (entry.uploaded) {
        try { await deleteAttachment(entry.uploaded.key, true); }
        catch { continue; }
      }
      discarded.push(entry.pendingId);
    }
    if (!discarded.length) return;
    const ids = new Set(discarded);
    await Promise.all(discarded.map(removeFile));
    await withQueueLock(() => writeQueue(readQueue().filter(entry => !ids.has(entry.pendingId))));
  };
  return navigator.locks?.request ? navigator.locks.request("stockhale-attachment-retry", run) : run();
}

export function retryAttachmentQueue(identity: { workspaceId: string; actorId: string }, onCompleted?: (completed: PendingAttachment[]) => Promise<void>): Promise<PendingAttachment[]> {
  const { workspaceId, actorId } = identity;
  if (!workspaceId) return Promise.resolve([]);
  const scope = `${workspaceId}:${actorId}`;
  const activeRetry = activeRetries.get(scope);
  if (activeRetry) return activeRetry;
  const run = async () => {
    const completed = await retryAttachmentQueueOnce(workspaceId, actorId);
    if (completed.length && onCompleted) await onCompleted(completed);
    return completed;
  };
  const coordinated = typeof navigator.locks?.request === "function"
    ? navigator.locks.request("stockhale-attachment-retry", run)
    : run();
  const tracked = coordinated.finally(() => { activeRetries.delete(scope); });
  activeRetries.set(scope, tracked);
  return tracked;
}

/** Remove local copies only after their uploaded metadata has been saved to the workspace cache. */
export async function acknowledgeAttachmentQueue(pendingIds: string[]) {
  const ids = new Set(pendingIds);
  await Promise.all(pendingIds.map(removeFile));
  await withQueueLock(() => writeQueue(readQueue().filter(entry => !ids.has(entry.pendingId))));
}

type PendingDeletion = { workspaceId: string; actorId: string; key: string };

export function scheduleAttachmentDeletion(item: PendingDeletion) {
  return withQueueLock(() => {
    const raw = localStorage.getItem(deletionQueueKey);
    const queue: PendingDeletion[] = raw ? JSON.parse(raw) : [];
    if (!queue.some(entry => entry.workspaceId === item.workspaceId && entry.actorId === item.actorId && entry.key === item.key)) {
      localStorage.setItem(deletionQueueKey, JSON.stringify([...queue, item]));
    }
  });
}

export async function retryAttachmentDeletions(identity: { workspaceId: string; actorId: string }) {
  let queue: PendingDeletion[];
  try {
    queue = JSON.parse(localStorage.getItem(deletionQueueKey) || "[]");
    if (!Array.isArray(queue)) throw new Error("Invalid deletion queue");
  } catch {
    throw new Error("Saved attachment cleanup could not be read. Preserve this device’s data and contact support.");
  }
  const matches = queue.filter(item => item.workspaceId === identity.workspaceId && item.actorId === identity.actorId);
  const deleted = new Set<string>();
  for (const item of matches) {
    try {
      await deleteAttachment(item.key, true);
      deleted.add(item.key);
    } catch {
      // A still-referenced file or a network failure stays queued for retry.
    }
  }
  if (deleted.size) {
    await withQueueLock(() => {
      const latest: PendingDeletion[] = JSON.parse(localStorage.getItem(deletionQueueKey) || "[]");
      localStorage.setItem(deletionQueueKey, JSON.stringify(latest.filter(item => !deleted.has(item.key) || item.workspaceId !== identity.workspaceId || item.actorId !== identity.actorId)));
    });
  }
}

export async function attachmentDownloadUrl(key: string): Promise<string> {
  const response = await fetch(`/api/attachments?key=${encodeURIComponent(key)}`);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Could not open attachment.");
  return body.downloadUrl;
}

export async function deleteAttachment(key: string, unreferencedOnly = false) {
  const response = await fetch("/api/attachments", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, unreferencedOnly, module: key.includes("/purchase/") ? "Purchases" : "Expenses" }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Could not delete attachment.");
}

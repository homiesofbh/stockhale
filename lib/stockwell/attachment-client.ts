"use client";

import { validateAttachment } from "./attachments";
import type { Attachment } from "./model";

type RecordType = "expense" | "purchase";
type PendingAttachment = Attachment & {
  recordType: RecordType;
  recordId: string;
  pendingId: string;
};
type QueueEntry = {
  pendingId: string;
  recordType: RecordType;
  recordId: string;
  attachment: Attachment;
  file: File;
};

const queueKey = "stockwell.pending-attachments";
const dbName = "stockwell-attachments";
const storeName = "files";

function readQueue(): Omit<QueueEntry, "file">[] {
  try {
    return JSON.parse(localStorage.getItem(queueKey) || "[]");
  } catch {
    return [];
  }
}

function writeQueue(queue: Omit<QueueEntry, "file">[]) {
  localStorage.setItem(queueKey, JSON.stringify(queue));
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
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(storeName, "readwrite").objectStore(storeName).put(file, id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Could not save attachment offline."));
  });
  db.close();
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

async function uploadNow(file: File, recordType: RecordType, recordId: string, attachmentId?: string): Promise<Attachment> {
  validateAttachment(file);
  const metadata = await fetch("/api/attachments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recordType, recordId, name: file.name, contentType: file.type, size: file.size }),
  });
  const policy = await metadata.json();
  if (!metadata.ok) throw new Error(policy.error || "Could not prepare attachment upload.");
  const upload = await fetch(policy.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!upload.ok) throw new Error("Could not upload attachment.");
  return { id: attachmentId || policy.id, key: policy.key, name: file.name, contentType: file.type, size: file.size, status: "uploaded", uploadedAt: new Date().toISOString() };
}

export async function uploadAttachment(file: File, recordType: RecordType, recordId: string): Promise<Attachment> {
  validateAttachment(file);
  if (navigator.onLine) return uploadNow(file, recordType, recordId);

  const pendingId = crypto.randomUUID();
  const attachment: Attachment = { id: pendingId, key: `pending/${pendingId}`, name: file.name, contentType: file.type, size: file.size, status: "pending" };
  await storeFile(pendingId, file);
  const queue = readQueue();
  writeQueue([...queue, { pendingId, recordType, recordId, attachment }]);
  return attachment;
}

export async function retryAttachmentQueue(): Promise<PendingAttachment[]> {
  if (!navigator.onLine) return [];
  const queue = readQueue();
  const completed: PendingAttachment[] = [];
  const remaining = [...queue];
  for (const entry of queue) {
    try {
      const file = await readFile(entry.pendingId);
      const attachment = await uploadNow(file, entry.recordType, entry.recordId, entry.pendingId);
      completed.push({ ...attachment, recordType: entry.recordType, recordId: entry.recordId, pendingId: entry.pendingId });
      const index = remaining.findIndex(item => item.pendingId === entry.pendingId);
      if (index >= 0) remaining.splice(index, 1);
      await removeFile(entry.pendingId);
    } catch {
      // Keep failed entries queued for the next online event or page load.
    }
  }
  writeQueue(remaining);
  return completed;
}

export async function attachmentDownloadUrl(key: string): Promise<string> {
  const response = await fetch(`/api/attachments?key=${encodeURIComponent(key)}`);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Could not open attachment.");
  return body.downloadUrl;
}

export async function deleteAttachment(key: string) {
  const response = await fetch("/api/attachments", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, module: key.includes("/purchase/") ? "Purchases" : "Expenses" }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Could not delete attachment.");
}

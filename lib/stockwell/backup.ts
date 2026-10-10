import { validateRecoveryBackup, type RecoveryBackup } from "./recovery";
import type { Cache } from "./workspace";

export const BACKUP_WEEK = 7 * 24 * 60 * 60 * 1000;
export const BACKUP_REMINDER = 60 * 60 * 1000;
export const backupKey = (workspace: string, user: string) =>
  `stockwell.backup.${workspace}.${user}`;

/** A missing or invalid timestamp means a first backup is due. */
export function backupDue(last: string | null, snoozed: string | null, now = Date.now()) {
  const downloaded = Number(last);
  const postponed = Number(snoozed);
  return (!last || !Number.isFinite(downloaded) || now - downloaded >= BACKUP_WEEK) &&
    (!snoozed || !Number.isFinite(postponed) || now >= postponed);
}

export async function createBackupWorkbook(cache: Cache) {
  const { Workbook } = await import("exceljs");
  const book = new Workbook();
  book.creator = "StockHale";
  book.created = new Date();
  const add = (name: string, records: unknown[]) => {
    const rows = records.map((record) => typeof record === "object" && record !== null
      ? record as Record<string, unknown> : { value: record });
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const sheet = book.addWorksheet(name);
    sheet.addRow(columns.length ? columns : ["No records"]);
    for (const row of rows) sheet.addRow(columns.map((column) => {
      const value = row[column];
      // Strings remain literal cells, never formulas. Nested fields are also preserved.
      const cell = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : value as string | number | boolean;
      return typeof cell === "string" && cell.length > 32767
        ? cell.slice(0, 32600) + "… (complete value in Backup snapshot sheet)" : cell;
    }));
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.columns.forEach((column) => { column.width = 24; });
  };
  add("Workspace", [{ id: cache.workspace.id, name: cache.workspace.name,
    revision: cache.revision, version: cache.workspace.store.version,
    exportedAt: new Date().toISOString(), pendingChanges: cache.queue.length }]);
  for (const [name, records] of Object.entries(cache.workspace.store)) {
    if (Array.isArray(records)) add(name, records);
  }
  add("Purchase lines", cache.workspace.store.purchases.flatMap((trade) =>
    trade.lines.map((line) => ({ tradeId: trade.id, ...line }))));
  add("Invoice lines", cache.workspace.store.invoices.flatMap((trade) =>
    trade.lines.map((line) => ({ tradeId: trade.id, ...line }))));
  add("Team", cache.workspace.members);
  add("Audit", cache.workspace.audit);
  add("Pending changes", cache.queue);
  // Lossless, chunked snapshot avoids Excel's 32,767-character cell limit.
  const raw = JSON.stringify(cache);
  const chunks = [];
  for (let offset = 0; offset < raw.length; offset += 30000)
    chunks.push({ part: chunks.length + 1, json: raw.slice(offset, offset + 30000) });
  add("Backup snapshot", chunks);
  return book.xlsx.writeBuffer();
}

export async function completeBackup(cache: Cache): Promise<RecoveryBackup> {
  if (cache.workspace.member.role !== "owner") throw new Error("Only the workspace owner can export all data.");
  if (cache.queue.length) throw new Error("Sync pending changes before creating a complete restorable backup. Export pending changes separately if sync needs review.");
  const response = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "backup" }), cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Backup failed.");
  if (data.backup.revision !== cache.revision) throw new Error("Workspace changed. Sync and retry backup.");
  return validateRecoveryBackup(data.backup, cache.workspace.id);
}
export function downloadRecovery(backup: RecoveryBackup) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = `stockhale-backup-${backup.workspaceId}-${backup.exportedAt.replace(/[:.]/g, "-")}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function downloadBackup(cache: Cache) {
  if (cache.workspace.member.role !== "owner") throw new Error("Only the workspace owner can export all data.");
  const recovery = await completeBackup(cache);
  const data = await createBackupWorkbook({ ...cache, workspace: { ...cache.workspace, store: recovery.store, audit: recovery.audit }, recovery } as Cache);
  const url = URL.createObjectURL(new Blob([new Uint8Array(data)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `stockhale-${cache.workspace.id}-${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

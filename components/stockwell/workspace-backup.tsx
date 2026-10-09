"use client";
import { useEffect, useState } from "react";
import { readRecoveryFile, type RecoveryBackup } from "@/lib/stockwell/recovery";
import type { Change } from "@/lib/stockwell/workspace";
import type { Cache } from "@/lib/stockwell/workspace";
import { BACKUP_REMINDER, backupDue, backupKey, completeBackup, downloadRecovery, downloadBackup } from "@/lib/stockwell/backup";
import { Modal } from "./ui";

export function WorkspaceBackup({ cache, settings, action }: { cache: Cache; settings: boolean; action: (body: unknown) => Promise<any> }) {
  const [restore, setRestore] = useState<RecoveryBackup | null>(null);
  const [confirmation, setConfirmation] = useState(""), [reason, setReason] = useState("");
  const [pending, setPending] = useState<{ change: Change; revision: number } | null>(null), [approvalReason, setApprovalReason] = useState("");
  const [points, setPoints] = useState(cache.workspace.audit.filter(a => a.action === "Pre-restore safety snapshot"));
  const [due, setDue] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const key = backupKey(cache.workspace.id, cache.workspace.member.id);
  useEffect(() => {
    const check = () => {
      try { setDue(backupDue(localStorage.getItem(key), localStorage.getItem(`${key}.snooze`))); }
      catch { setDue(true); }
    };
    check();
    const timer = window.setInterval(check, 60000);
    window.addEventListener("focus", check);
    window.addEventListener("storage", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
      window.removeEventListener("storage", check);
    };
  }, [key]);
  function postpone() {
    if (busy) return;
    try { localStorage.setItem(`${key}.snooze`, String(Date.now() + BACKUP_REMINDER)); }
    catch { /* Remind again on the next check if storage is unavailable. */ }
    setDue(false);
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await downloadBackup(cache);
      setDue(false);
      setNotice("Excel download requested. Check your Downloads folder and keep the file safe.");
      try {
        localStorage.setItem(key, String(Date.now()));
        localStorage.removeItem(`${key}.snooze`);
      } catch { setNotice("Download requested. This browser could not save the reminder date."); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backup failed. Please try again.");
    } finally { setBusy(false); }
  }
  const controls = <div className="backup-controls">
    <div className="backup-copy">
      <p>Download all synced business records, team details, and the complete server audit history. The Excel workbook includes a lossless restore snapshot; JSON is also available. Account passwords and sessions are not exported or restored.</p>
      <p>Weekly reminders run while this app is open on this browser. If postponed, we remind you again in one hour until you request a download.</p>
      {cache.queue.length > 0 && <p>Sync {cache.queue.length} pending changes first. If blocked, export pending changes from the sync controls; they stay on this device.</p>}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="backup-actions">
      <button className="primary" disabled={busy} onClick={() => void save()}>{busy ? "Preparing Excel…" : "Download all data (.xlsx)"}</button>
      <button className="secondary-button" disabled={busy || !!cache.queue.length} onClick={async () => { setBusy(true); setError(""); try { downloadRecovery(await completeBackup(cache)); setNotice("Restorable JSON backup download requested."); } catch (e) { setError(e instanceof Error ? e.message : "Backup failed."); } finally { setBusy(false); } }}>Download restorable JSON</button>
    </div>
  </div>;
  return <>
    {settings && <div className="backup-settings-shell"><section className="panel backup-panel"><div className="backup-panel-head"><div><h2>Excel export & weekly backup</h2><p>Keep a complete, restorable copy of your workspace.</p></div><span className="backup-status">Weekly</span></div>{controls}{notice && <p className="backup-notice" role="status">{notice}</p>}</section>
    {settings && <section className="panel"><h2>Validated restore</h2><p>Review a backup before restoring. Restoring replaces business records, retains audit history, and saves the current records as a recovery point. Team permissions and login accounts remain unchanged.</p>
      <label className="field mb-2"><span>Choose a JSON or new Excel backup</span><input type="file" accept=".json,.xlsx" disabled={busy} onChange={async e => { const file = e.target.files?.[0]; setRestore(null); setConfirmation(""); setError(""); if (!file) return; setBusy(true); try { setRestore(await readRecoveryFile(file, cache.workspace.id)); } catch (err) { setError(err instanceof Error ? err.message : "Invalid backup."); } finally { setBusy(false); } }} /></label>
      {restore && <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try { await action({ action: "restore", revision: cache.revision, backup: restore, confirmation, reason }); setRestore(null); setNotice("Backup restored. Previous records retained in a recovery point."); } catch (err) { setError(err instanceof Error ? err.message : "Restore failed."); } finally { setBusy(false); } }}>
        <p>Backup from {restore.exportedAt} · revision {restore.revision} · {restore.store.invoices.length} bills · {restore.store.purchases.length} purchases · {restore.audit.length} audit events.</p>
        <label className="field"><span>Type workspace name: {cache.workspace.name}</span><input value={confirmation} onChange={e => setConfirmation(e.target.value)} required /></label><label className="field"><span>Restore reason</span><textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} required /></label><button className="primary" disabled={busy || !!cache.queue.length || confirmation !== cache.workspace.name || !reason.trim()}>Restore reviewed backup</button>
      </form>}
      {error && <p className="form-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      <h3 >Pre-restore recovery points</h3><button className="secondary mt-2" disabled={busy} onClick={async () => { setBusy(true); try { const data = await action({ action: "backup" }); setPoints(data.backup.audit.filter((a: any) => a.action === "Pre-restore safety snapshot")); } catch (e) { setError(e instanceof Error ? e.message : "Could not load recovery points."); } finally { setBusy(false); } }}>Load all recovery points</button>
      {points.map(point => <div key={point.id}><span>{point.receivedAt}</span><button className="link" disabled={busy} onClick={async () => { setBusy(true); try { const data = await action({ action: "backup-recovery", eventId: point.id }); downloadRecovery(data.backup); } catch (e) { setError(e instanceof Error ? e.message : "Could not export recovery point."); } finally { setBusy(false); } }}>Download recovery point</button></div>)}
    </section>}
    <section className="panel"><h2>Review late offline expenses</h2><p>Staff can export a preserved pending-change file. Review its first expense change and approve it only when its revision matches current records.</p><input type="file" accept=".json" disabled={busy} onChange={async e => { setPending(null); const file = e.target.files?.[0]; if (!file) return; try { const data = JSON.parse(await file.text()); if (data.workspace?.id !== cache.workspace.id || data.queue?.[0]?.module !== "Expenses") throw new Error("Choose a pending expense file for this workspace."); setPending({ change: data.queue[0], revision: data.revision }); } catch (err) { setError(err instanceof Error ? err.message : "Invalid pending-change file."); } }} />
      {pending && <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try { await action({ action: "approve-offline-expense", revision: pending.revision, change: pending.change, reason: approvalReason }); setPending(null); setNotice("Offline expense approved. Staff can retry sync to acknowledge the preserved change."); } catch (err) { setError(err instanceof Error ? err.message : "Approval failed."); } finally { setBusy(false); } }}><p>Original actor {pending.change.actorId} · created {pending.change.occurredAt} · revision {pending.revision}</p><pre className="audit-details">{JSON.stringify(pending.change.store.expenses.filter(e => !cache.workspace.store.expenses.some(old => old.id === e.id)), null, 2)}</pre><label className="field"><span>Approval reason</span><textarea value={approvalReason} onChange={e => setApprovalReason(e.target.value)} required maxLength={2000} /></label><button className="primary" disabled={busy || pending.revision !== cache.revision || !approvalReason.trim()}>Approve reviewed expense</button></form>}
    </section></div>}
    {due && <Modal eyebrow="STOCKHALE / BACKUP" title="Your weekly backup is due" close={postpone}>
      {controls}
      <div className="backup-reminder-footer">
        <button className="secondary-button" disabled={busy} onClick={postpone}>Remind me in one hour</button>
        <p>The browser may ask where to save the file. If you cancel the download, use the export button in Settings to try again.</p>
      </div>
    </Modal>}
  </>;
}

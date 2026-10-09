"use client";
import { CheckCircle2, Download, FileSpreadsheet, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Cache } from "@/lib/stockwell/workspace";
import { BACKUP_REMINDER, backupDue, backupKey, downloadBackup } from "@/lib/stockwell/backup";
import { Modal } from "./ui";

export function WorkspaceBackup({ cache, settings }: { cache: Cache; settings: boolean }) {
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
    setNotice("");
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
  const contents = <div className="backup-contents">
    <span className="backup-file-icon"><FileSpreadsheet size={26} strokeWidth={1.6} aria-hidden="true" /></span>
    <div><strong>One workbook. All your records.</strong><p>Store records, team details, audit history and pending device changes.</p><span className="backup-format">Excel workbook · .xlsx</span></div>
  </div>;
  const download = <button type="button" className="primary backup-download" disabled={busy} onClick={() => void save()}><Download size={17} aria-hidden="true" />{busy ? "Preparing Excel…" : "Download all data"}</button>;
  const feedback = <>
    {cache.queue.length > 0 && <p className="backup-pending">Includes {cache.queue.length} pending changes saved on this device.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </>;
  return <>
    {settings && <section className="backup-panel" aria-labelledby="backup-title">
      <div className="backup-heading"><div><span className="eyebrow">DATA & BACKUP</span><h2 id="backup-title">Excel export & weekly backup</h2><p>Keep a downloadable copy of your workspace.</p></div>{download}</div>
      {contents}
      <p className="backup-reminder"><Clock3 size={16} aria-hidden="true" /><span>Weekly reminders appear while this app is open. Postpone for one hour when you need more time.</span></p>
      {feedback}
      {notice && <p className="backup-notice" role="status"><CheckCircle2 size={18} aria-hidden="true" /><span>{notice}</span></p>}
    </section>}
    {due && <Modal title="Your weekly backup is due" eyebrow="STOCKHALE / DATA & BACKUP" className="backup-modal" close={postpone}>
      <div className="backup-modal-body"><p className="backup-intro">Save a copy of your workspace to keep your business records close at hand.</p>{contents}{feedback}
        <p className="backup-save-hint">Choose where to save your file and keep it somewhere safe. If the download is cancelled or blocked, try again from Settings.</p>
        <div className="backup-actions"><button type="button" className="secondary-button" disabled={busy} onClick={postpone}>Remind me in one hour</button>{download}</div>
      </div>
    </Modal>}
  </>;
}

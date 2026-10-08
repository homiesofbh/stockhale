"use client";
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
  const controls = <>
    <p>Download all store records, team details, audit history and pending changes in one Excel workbook.</p>
    <p>Weekly reminders run while this app is open on this browser. If postponed, we remind you again in one hour until you request a download.</p>
    {cache.queue.length > 0 && <p>Includes {cache.queue.length} pending changes saved on this device.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary" disabled={busy} onClick={() => void save()}>{busy ? "Preparing Excel…" : "Download all data (.xlsx)"}</button>
  </>;
  return <>
    {settings && <section className="panel"><h2>Excel export & weekly backup</h2>{controls}{notice && <p role="status">{notice}</p>}</section>}
    {due && <Modal title="Your weekly backup is due" close={postpone}>
      {controls}
      <button disabled={busy} onClick={postpone}>Remind me in one hour</button>
      <p>The browser may ask where to save the file. If you cancel the download, use the export button in Settings to try again.</p>
    </Modal>}
  </>;
}

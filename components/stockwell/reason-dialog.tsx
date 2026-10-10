"use client";
import { useState, type FormEvent } from "react";
import { Field, Modal } from "./ui";
import { today } from "@/lib/stockwell/model";
export function ReasonDialog({ title, close, confirm, withDate = true }: { title: string; close: () => void; confirm: (reason: string, date: string) => void; withDate?: boolean }) {
  const [error, setError] = useState("");
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); try { confirm(String(f.get("reason") || "").trim(), String(f.get("date") || today())); close(); } catch (e) { setError(e instanceof Error ? e.message : "Action failed."); } }
  return <Modal title={title} close={close}><form onSubmit={submit}><p>This action will retain the original record and add an audit entry.</p><div className="form-grid">{withDate && <Field label="Action date"><input type="date" name="date" defaultValue={today()} max={today()} required /></Field>}<Field label="Reason"><textarea name="reason" maxLength={2000} required /></Field></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-foot"><button className="primary">Confirm</button></div></form></Modal>;
}

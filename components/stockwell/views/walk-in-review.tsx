"use client";
import { useState } from "react";
import { linkLegacyWalkIn, type Actor } from "@/lib/stockwell/operations";
import { isPosted, money, balance, type Store } from "@/lib/stockwell/model";
import { Field, Modal, Table } from "../ui";
import { GlassSelect } from "../glass-select";
export function WalkInReview({ s, actor, commit }: { s: Store; actor: Actor; commit: (s: Store, message: string) => void }) {
  const [reviewing, setReviewing] = useState(""), [error, setError] = useState("");
  const unlinked = s.invoices.filter(t => isPosted(t) && !t.contactId), trade = unlinked.find(t => t.id === reviewing);
  if (actor.role !== "owner" || !unlinked.length) return null;
  return <section className="card walk-in-review"><div className="section-head"><div><h2>Review historical walk-ins</h2><p>Review one bill at a time before linking it. Stock and bill amounts remain unchanged. Automatic matching uses a unique phone number; names alone are never merged.</p></div></div><Table headers={["Bill", "Name / company", "Phone", "Outstanding", "Action"]} rows={unlinked.map(t => [t.number, [t.walkInName, t.walkInCompany].filter(Boolean).join(" · ") || "Anonymous walk-in", t.walkInPhone || "—", money(balance(s, t)), <button className="link" onClick={() => { setReviewing(t.id); setError(""); }}>Review link</button>])} />{trade && <Modal title={`Link ${trade.number}`} close={() => setReviewing("")}><form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); try { commit(linkLegacyWalkIn(s, trade.id, String(f.get("customer") || ""), String(f.get("reason") || ""), actor), "Historical walk-in linked with review history."); setReviewing(""); } catch (e) { setError(e instanceof Error ? e.message : "Could not link customer."); } }}><p>{trade.walkInName} · {trade.walkInCompany} · {trade.walkInPhone} · outstanding {money(balance(s, trade))}</p><Field label="Customer"><GlassSelect name="customer"><option value="">Match unique phone or create a separate customer</option>{s.customers.map(c => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}</GlassSelect></Field><Field label="Review reason"><textarea name="reason" maxLength={2000} required /></Field>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-foot"><button className="primary">Confirm reviewed link</button></div></form></Modal>}</section>;
}

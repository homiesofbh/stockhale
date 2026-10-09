"use client";
import { useState, type FormEvent } from "react";
import { chartAccounts } from "@/lib/stockwell/accounts";
import { journalTotals, nextJournalNumber, saveJournal, type JournalLine, type JournalVoucher } from "@/lib/stockwell/journals";
import { money, today, uid, type Store } from "@/lib/stockwell/model";
import { Field } from "@/components/stockwell/ui";
import { GlassSelect } from "@/components/stockwell/glass-select";

export function JournalForm({ s, voucher, commit }: { s: Store; voucher?: JournalVoucher; commit: (s: Store, message: string) => void }) {
  const blankLine = (): JournalLine => ({ id: uid(), accountId: "", debit: 0, credit: 0, description: "" });
  const [lines, setLines] = useState<JournalLine[]>(() => voucher?.lines.map(l => ({ ...l })) || [blankLine(), blankLine()]);
  const [error, setError] = useState("");
  const chart = chartAccounts(s);
  const accounts = chart.filter(a => !chart.some(child => child.parentId === a.id));
  const totals = journalTotals(lines);
  function update(id: string, patch: Partial<JournalLine>) { setLines(previous => previous.map(l => l.id === id ? { ...l, ...patch } : l)); }
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const action = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    const post = action === "post";
    try {
      const next = saveJournal(s, {
        id: voucher?.id || uid(), number: voucher?.number || nextJournalNumber(s), date: String(f.get("date") || ""),
        reference: String(f.get("reference") || "").trim(), notes: String(f.get("notes") || "").trim(),
        status: "draft", createdAt: voucher?.createdAt || Date.now(), lines,
      }, post);
      commit(next, post ? "Journal posted. Debit and credit entries recorded." : "Journal draft saved.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save journal."); }
  }
  return <form onSubmit={save}>
    <p>Drafts have no account effect. Posting requires classified subaccounts and equal debit and credit totals. Posted vouchers are locked.</p>
    <div className="form-grid">
      <Field label="Voucher number"><input value={voucher?.number || nextJournalNumber(s)} readOnly /></Field>
      <Field label="Date"><input name="date" type="date" defaultValue={voucher?.date || today()} required /></Field>
      <Field label="Reference"><input name="reference" maxLength={200} defaultValue={voucher?.reference || ""} /></Field>
      <Field label="Notes"><textarea name="notes" maxLength={2000} defaultValue={voucher?.notes || ""} /></Field>
    </div>
    <div className="journal-lines">
      {lines.map((line, index) => <div className="journal-line" key={line.id}>
        <span className="journal-line-number">Line {index + 1}</span>
        <Field label={`Account for line ${index + 1}`}><GlassSelect value={line.accountId} onValueChange={value => update(line.id, { accountId: value })}><option value="">Select account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}{a.type === "Unclassified" ? " (unclassified)" : ""}</option>)}</GlassSelect></Field>
        <Field label={`Debit for line ${index + 1}`}><input type="number" min="0" step="0.01" value={line.debit || ""} onChange={e => update(line.id, { debit: Number(e.target.value), ...(Number(e.target.value) > 0 ? { credit: 0 } : {}) })} /></Field>
        <Field label={`Credit for line ${index + 1}`}><input type="number" min="0" step="0.01" value={line.credit || ""} onChange={e => update(line.id, { credit: Number(e.target.value), ...(Number(e.target.value) > 0 ? { debit: 0 } : {}) })} /></Field>
        <Field label={`Description for line ${index + 1}`}><input maxLength={500} value={line.description} onChange={e => update(line.id, { description: e.target.value })} /></Field>
        <button type="button" className="link" disabled={lines.length <= 2} onClick={() => setLines(previous => previous.filter(l => l.id !== line.id))} aria-label={`Remove line ${index + 1}`}>Remove</button>
      </div>)}
    </div>
    <button type="button" className="secondary" disabled={lines.length >= 100} onClick={() => setLines(previous => [...previous, blankLine()])}>Add line</button>
    <div className="journal-totals" aria-live="polite"><span>Debit <b>{money(totals.debit)}</b></span><span>Credit <b>{money(totals.credit)}</b></span><span>Difference <b>{money(totals.difference)}</b></span></div>
    {error && <p role="alert">{error}</p>}
    <div className="form-foot"><button className="secondary" name="action" value="draft">Save draft</button><button className="primary" name="action" value="post" disabled={totals.debit <= 0 || totals.difference !== 0}>Post journal</button></div>
  </form>;
}

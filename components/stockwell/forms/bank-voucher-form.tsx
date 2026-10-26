"use client";
import { useState, type FormEvent } from "react";
import { chartAccounts } from "@/lib/stockwell/accounts";
import { nextBankVoucherNumber, saveBankVoucher, type BankVoucher } from "@/lib/stockwell/bank-vouchers";
import { today, uid, type Store } from "@/lib/stockwell/model";
import { Field } from "@/components/stockwell/ui";
import { GlassSelect } from "@/components/stockwell/glass-select";
export function BankVoucherForm({ s, voucher, commit, depositOnly = false }: { s: Store; voucher?: BankVoucher; commit: (s: Store, message: string) => void; depositOnly?: boolean }) {
  const [kind, setKind] = useState<BankVoucher["kind"]>(voucher?.kind || "Receipt");
  const [accountId, setAccountId] = useState(voucher?.accountId || "");
  const [error, setError] = useState("");
  const banks = (s.financialAccounts || []).filter(a => a.active !== false);
  const chart = chartAccounts(s);
  const cashAccount = chart.find(a => a.name === "Cash" && a.type === "Asset" && !chart.some(child => child.parentId === a.id));
  const counterAccounts = chart.filter(a => a.type !== "Unclassified" && !chart.some(child => child.parentId === a.id) && (!(s.financialAccounts || []).some(bank => bank.ledgerAccountId === a.id) || a.name === "Cash" && a.type === "Asset"));
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (key: string) => String(f.get(key) || "").trim();
    const post = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "post";
    try {
      const next = saveBankVoucher(s, { id: voucher?.id || uid(), number: voucher?.number || nextBankVoucherNumber(s), createdAt: voucher?.createdAt || Date.now(),
        date: text("date"), kind: depositOnly ? "Receipt" : kind, accountId, toAccountId: depositOnly ? "" : kind === "Transfer" ? text("toAccountId") : "", counterAccountId: depositOnly ? cashAccount?.id || "" : kind !== "Transfer" ? text("counterAccountId") : "",
        amount: Number(text("amount")), reference: text("reference"), notes: text("notes"), status: "draft",
      }, post);
      commit(next, post ? "Bank voucher posted. Account balances updated." : "Bank voucher draft saved.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save voucher."); }
  }
  return <form onSubmit={save}>
    <p>{depositOnly ? "Record cash physically deposited from the drawer into a bank or wallet. This reduces cash in hand and increases the selected account balance." : "Use these vouchers for other receipts, payments, and transfers. To deposit drawer cash, record a Receipt voucher with Cash as the counter-account. For income received, select the income account as the counter-account. Settle customer or supplier bills through Record payment. Drafts have no balance effect."}</p>
    <div className="form-grid">
      <Field label="Voucher number"><input value={voucher?.number || nextBankVoucherNumber(s)} readOnly /></Field>
      {!depositOnly && <Field label="Voucher type"><GlassSelect value={kind} onValueChange={value => setKind(value as BankVoucher["kind"])}><option>Receipt</option><option>Payment</option><option>Transfer</option></GlassSelect></Field>}
      <Field label="Date"><input name="date" type="date" defaultValue={voucher?.date || today()} required /></Field>
      <Field label={!depositOnly && kind === "Transfer" ? "From account" : "Bank / wallet"}><GlassSelect value={accountId} onValueChange={setAccountId}><option value="">Select account</option>{banks.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</GlassSelect></Field>
      {depositOnly ? <Field label="Counter-account"><input value={cashAccount ? `${cashAccount.code} · ${cashAccount.name}` : "Cash asset account is not configured"} readOnly /></Field> : kind === "Transfer" ? <Field label="To account"><GlassSelect key="destination" name="toAccountId" defaultValue={voucher?.toAccountId || ""}><option value="">Select destination</option>{banks.filter(a => a.id !== accountId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</GlassSelect></Field> : <Field label="Counter-account"><GlassSelect key="counter" name="counterAccountId" defaultValue={voucher?.counterAccountId || ""}><option value="">Select account</option>{counterAccounts.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</GlassSelect></Field>}
      <Field label="Amount (PKR)"><input name="amount" type="number" min="0.01" step="0.01" defaultValue={voucher?.amount} required /></Field>
      <Field label="Reference"><input name="reference" defaultValue={voucher?.reference || ""} maxLength={200} /></Field>
      <Field label="Notes"><textarea name="notes" defaultValue={voucher?.notes || ""} maxLength={2000} /></Field>
    </div>
    {error && <p role="alert">{error}</p>}
    <div className="form-foot"><button className="secondary" value="draft">Save draft</button><button className="primary" value="post">Post voucher</button></div>
  </form>;
}

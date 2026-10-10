"use client";
import { useState, type FormEvent } from "react";
import { bankVoucherLines } from "@/lib/stockwell/bank-vouchers";
import { accountTypes, chartAccounts, saveAccount, type Account } from "@/lib/stockwell/accounts";
import { today, uid, type Store } from "@/lib/stockwell/model";
import { Field } from "@/components/stockwell/ui";
import { GlassSelect } from "@/components/stockwell/glass-select";

export function AccountForm({ s, account, commit }: { s: Store; account?: Account; commit: (next: Store, message: string) => void }) {
  const [error, setError] = useState("");
  const accounts = chartAccounts(s);
  const locked = !!account && (s.journals || []).some(v => v.status === "posted" && v.lines.some(l => l.accountId === account.id)) || (!!account && (s.bankVouchers || []).some(v => v.status === "posted" && bankVoucherLines(s, v).some(l => l.accountId === account.id)));
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (key: string) => String(f.get(key) || "").trim();
    try {
      const next = saveAccount(s, {
        id: account?.id || uid(), name: account?.name || text("name"), code: text("code"), parentId: text("parentId"),
        type: locked ? account!.type : text("type") as Account["type"], nature: locked ? account!.nature : text("nature") as Account["nature"],
        openingBalance: locked ? account!.openingBalance : Number(text("openingBalance")), openingDate: locked ? account!.openingDate : text("openingDate"), description: text("description"),
      });
      commit(next, account ? "Account updated." : "Account added.");
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save account."); }
  }
  return <form onSubmit={save}>
    <p>Use parent codes for subaccounts, for example 1000.01 under 1000. Existing names stay fixed to preserve transaction history.</p>
    {locked && <p>Classification and opening balance are locked because this account has posted vouchers.</p>}
    <div className="form-grid">
      <Field label="Account code"><input name="code" defaultValue={account?.code} required autoFocus /></Field>
      <Field label="Account name"><input name="name" defaultValue={account?.name} readOnly={!!account} required /></Field>
      <Field label="Parent account"><GlassSelect name="parentId" defaultValue={account?.parentId || ""}><option value="">Root account</option>{accounts.filter(a => a.id !== account?.id).map(a => <option value={a.id} key={a.id}>{a.code} · {a.name}</option>)}</GlassSelect></Field>
      <Field label="Account type"><GlassSelect disabled={locked} name="type" defaultValue={account?.type || "Asset"}>{accountTypes.map(type => <option key={type}>{type}</option>)}</GlassSelect></Field>
      <Field label="Balance nature"><GlassSelect disabled={locked} name="nature" defaultValue={account?.nature || "Debit"}><option>Debit</option><option>Credit</option></GlassSelect></Field>
      <Field label="Opening balance (PKR)"><input readOnly={locked} name="openingBalance" type="number" min="0" step="0.01" defaultValue={account?.openingBalance || 0} required /></Field>
      <Field label="Opening balance date"><input readOnly={locked} name="openingDate" type="date" defaultValue={account?.openingDate || today()} required /></Field>
      <Field label="Description"><textarea name="description" maxLength={2000} defaultValue={account?.description || ""} /></Field>
    </div>
    {error && <p role="alert">{error}</p>}
    <div className="form-foot"><button className="primary">{account ? "Save account" : "Add account"}</button></div>
  </form>;
}

"use client";
import { useState } from "react";
import { bankStatement, bankVoucherLines, type BankVoucher } from "@/lib/stockwell/bank-vouchers";
import { chartAccounts } from "@/lib/stockwell/accounts";
import { financialRows, money, today, type Store } from "@/lib/stockwell/model";
import { Badge, Field, Modal, Table } from "@/components/stockwell/ui";
import { BankVoucherForm } from "@/components/stockwell/forms/bank-voucher-form";
export function BankVouchersView({ s, matches, inRange, commit }: { s: Store; matches: (...values: unknown[]) => boolean; inRange: (date: string) => boolean; commit: (s: Store, message: string) => void }) {
  const [editor, setEditor] = useState<BankVoucher | "new" | null>(null);
  const [details, setDetails] = useState<BankVoucher | null>(null);
  const [through, setThrough] = useState(today());
  const banks = s.financialAccounts || [], chart = chartAccounts(s);
  const name = (id: string) => banks.find(a => a.id === id)?.name || "—";
  const vouchers = [...(s.bankVouchers || [])].filter(v => inRange(v.date) && matches(v.number, v.reference, v.notes, v.kind, v.status, name(v.accountId), name(v.toAccountId))).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const unassignedRows = financialRows(s).filter(r => r.bank !== 0 && !r.financialAccountId && (!through || r.date <= through));
  const unassigned = unassignedRows.reduce((n, r) => n + r.bank, 0);
  return <>
    <section className="card">
      <div className="section-head"><div><h2>Bank and wallet balances</h2><p>Opening balances and movements through the selected date. Link each bank to an Asset ledger account in Settings. Opening balances replace movements before their opening date.</p></div><Field label="Balances through"><input type="date" value={through} onChange={e => setThrough(e.target.value)} /></Field></div>
      <Table headers={["Account", "Type", "Opening date", "Opening balance", "Receipts", "Payments", "Closing balance", "Status"]} rows={banks.filter(a => matches(a.name, a.type)).map(a => {
        const statement = bankStatement(s, a, "", through), ledger = chart.find(l => l.id === a.ledgerAccountId);
        return [a.name, a.type, ledger?.openingDate || "—", money(statement.opening), money(statement.receipts), money(statement.payments), money(statement.closing), <Badge>{a.active === false ? "Inactive" : a.ledgerAccountId ? "Linked" : "No ledger link"}</Badge>];
      })} />
      <p className="bank-balance-note">{unassignedRows.length} unassigned legacy bank / cheque entries · net movement {money(unassigned)}. These entries are excluded from individual account balances.</p>
    </section>
    <section className="card">
      <div className="section-head"><div><h2>Bank vouchers</h2><p>Receipts, payments, and transfers. Posted vouchers are locked.</p></div><div className="journal-register-actions"><Badge>{vouchers.length} vouchers</Badge><button className="primary" onClick={() => setEditor("new")}>New bank voucher</button></div></div>
      <Table headers={["Date", "Voucher", "Type", "Bank / wallet", "Counter-account / destination", "Reference", "Amount", "Status", "Action"]} empty="No matching bank vouchers" rows={vouchers.map(v => [
        v.date, v.number, v.kind, name(v.accountId), v.kind === "Transfer" ? name(v.toAccountId) : chart.find(a => a.id === v.counterAccountId)?.name || "—",
        <div className="journal-register-reference"><span>{v.reference || "—"}</span>{v.notes && <small>{v.notes}</small>}</div>, money(v.amount),
        <Badge tone={v.status === "posted" ? "green" : "amber"}>{v.status === "posted" ? "Posted" : "Draft"}</Badge>,
        <button className="link" onClick={() => v.status === "draft" ? setEditor(v) : setDetails(v)} aria-label={`${v.status === "draft" ? "Edit" : "View"} ${v.number}`}>{v.status === "draft" ? "Edit / post" : "View entries"}</button>,
      ])} />
    </section>
    {editor && <Modal title={editor === "new" ? "New bank voucher" : editor.number} close={() => setEditor(null)}><BankVoucherForm s={s} voucher={editor === "new" ? undefined : editor} commit={(next, message) => { commit(next, message); setEditor(null); }} /></Modal>}
    {details && <Modal title={details.number} close={() => setDetails(null)}><p>{details.date} · {details.kind} · {details.reference}</p><p>{details.notes}</p><Table headers={["Account", "Debit", "Credit"]} rows={bankVoucherLines(s, details).map(l => [chart.find(a => a.id === l.accountId)?.name || "—", money(l.debit), money(l.credit)])} /><p>Posted {details.postedAt ? new Date(details.postedAt).toLocaleString("en-PK") : ""} · Locked</p></Modal>}
  </>;
}

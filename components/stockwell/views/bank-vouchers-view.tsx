"use client";
import { ReasonDialog } from "../reason-dialog";
import { reverseVoucher, type Actor } from "@/lib/stockwell/operations";
import { useEffect, useState } from "react";
import { bankStatement, bankVoucherLines, type BankVoucher } from "@/lib/stockwell/bank-vouchers";
import { chartAccounts } from "@/lib/stockwell/accounts";
import { money, today, type FinancialRow, type Store } from "@/lib/stockwell/model";
import { Badge, Field, Modal, ServerPagination, Table } from "@/components/stockwell/ui";
import { BankVoucherForm } from "@/components/stockwell/forms/bank-voucher-form";
import { useServerCollection } from "@/lib/stockwell/use-server-collection";
export function BankVouchersView({ s, matches, inRange, commit, actor, query = "", from = "", to = "" }: { actor: Actor; s: Store; matches: (...values: unknown[]) => boolean; inRange: (date: string) => boolean; commit: (s: Store, message: string) => void; query?: string; from?: string; to?: string }) {
  const [balanceQuery, setBalanceQuery] = useState("");
  const [reversing, setReversing] = useState("");
  const [editor, setEditor] = useState<BankVoucher | "new" | null>(null);
  const [details, setDetails] = useState<BankVoucher | null>(null);
  const [through, setThrough] = useState(today());
  const banks = s.financialAccounts || [], chart = chartAccounts(s);
  const name = (id: string) => banks.find(a => a.id === id)?.name || "—";
  const voucherPage = useServerCollection<BankVoucher>({ collection: "bankVouchers", query, from, to, pageSize: 25 });
  const vouchers = voucherPage.records;
  useEffect(() => {
    const target = (s.bankVouchers || []).find(voucher => voucher.id === query);
    if (!target) return;
    if (target.status === "draft") setEditor(target);
    else setDetails(target);
  }, [query, s.bankVouchers]);
  const unassignedPage = useServerCollection<FinancialRow>({ collection: "financialTransactions", query: balanceQuery, to: through, bankOnly: true, pageSize: 25 });
  const bankAccountsPage = useServerCollection<any>({ collection: "financialAccounts", query: balanceQuery, pageSize: 25 });
  const unassigned = unassignedPage.aggregates?.unassignedBank || 0;
  const filteredBanks = bankAccountsPage.records;
  return <>
    <section className="card mt-8">
      <div className="section-head"><div><h2>Bank and wallet balances</h2><p>Opening balances and movements through the selected date. Link each bank to an Asset ledger account in Settings. Opening balances replace movements before their opening date.</p></div><Field label="Search accounts"><input type="search" value={balanceQuery} onChange={e => setBalanceQuery(e.target.value)} placeholder="Account name or type" /></Field><Field label="Balances through"><input type="date" value={through} onChange={e => setThrough(e.target.value)} /></Field></div>
      <Table headers={["Account", "Type", "Opening date", "Opening balance", "Receipts", "Payments", "Closing balance", "Status"]} rows={filteredBanks.map(a => {
        const statement = bankStatement(s, a, "", through), ledger = chart.find(l => l.id === a.ledgerAccountId);
        return [a.name, a.type, ledger?.openingDate || "—", money(statement.opening), money(statement.receipts), money(statement.payments), money(statement.closing), <Badge>{a.active === false ? "Inactive" : a.ledgerAccountId ? "Linked" : "No ledger link"}</Badge>];
      })} />
      <ServerPagination page={bankAccountsPage.page} pageCount={bankAccountsPage.pageCount} count={bankAccountsPage.count} pageSize={bankAccountsPage.pageSize} setPage={bankAccountsPage.setPage} />
      <p className="bank-balance-note">{unassignedPage.aggregates?.unassignedCount || 0} unassigned legacy bank / cheque entries · net movement {money(unassigned)}. These entries are excluded from individual account balances.</p>
      <ServerPagination page={unassignedPage.page} pageCount={unassignedPage.pageCount} count={unassignedPage.count} pageSize={unassignedPage.pageSize} setPage={unassignedPage.setPage} />
    </section>
    <section className="card mt-8">
      <div className="section-head"><div><h2>Bank vouchers</h2><p>Receipts, payments, and transfers. Posted vouchers are locked.</p></div><div className="journal-register-actions"><Badge>{voucherPage.count} vouchers</Badge><button className="primary" onClick={() => setEditor("new")}>New bank voucher</button></div></div>
      <Table headers={["Date", "Voucher", "Type", "Bank / wallet", "Counter-account / destination", "Reference", "Amount", "Status", "Action"]} empty="No matching bank vouchers" rows={vouchers.map(v => [
        v.date, v.number, v.kind, name(v.accountId), v.kind === "Transfer" ? name(v.toAccountId) : chart.find(a => a.id === v.counterAccountId)?.name || "—",
        <div className="journal-register-reference"><span>{v.reference || "—"}</span>{v.notes && <small>{v.notes}</small>}</div>, money(v.amount),
        <Badge tone={v.status === "posted" ? "green" : "amber"}>{v.status === "posted" ? "Posted" : "Draft"}</Badge>,
        <button className="link" onClick={() => v.status === "draft" ? setEditor(v) : setDetails(v)} aria-label={`${v.status === "draft" ? "Edit" : "View"} ${v.number}`}>{v.status === "draft" ? "Edit / post" : "View entries"}</button>,
      ])} />
      {voucherPage.error && <p className="form-error" role="alert">{voucherPage.error}</p>}<ServerPagination page={voucherPage.page} pageCount={voucherPage.pageCount} count={voucherPage.count} pageSize={voucherPage.pageSize} setPage={voucherPage.setPage} />
    </section>
    {editor && <Modal title={editor === "new" ? "New bank voucher" : editor.number} close={() => setEditor(null)}><BankVoucherForm s={s} voucher={editor === "new" ? undefined : editor} commit={(next, message) => { commit(next, message); setEditor(null); }} /></Modal>}
    {details && <Modal title={details.number} close={() => setDetails(null)}><p>{details.date} · {details.kind} · {details.reference}</p><p>{details.notes}</p><Table headers={["Account", "Debit", "Credit"]} rows={bankVoucherLines(s, details).map(l => [chart.find(a => a.id === l.accountId)?.name || "—", money(l.debit), money(l.credit)])} />{actor.role === "owner" && !s.bankVouchers?.some(v => v.reversalOf === details.id) && <button className="secondary" onClick={() => { setReversing(details.id); setDetails(null); }}>Reverse voucher</button>}<p>Posted {details.postedAt ? new Date(details.postedAt).toLocaleString("en-PK") : ""} · Locked</p></Modal>}
    {reversing && <ReasonDialog title="Reverse bank voucher" close={() => setReversing("")} confirm={(reason, date) => commit(reverseVoucher(s, "Bank", reversing, date, reason, actor), "Bank reversal posted. Original retained.")} />}
  </>;
}

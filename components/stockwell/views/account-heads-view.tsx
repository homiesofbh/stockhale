"use client";
import { ReasonDialog } from "../reason-dialog";
import { reverseVoucher, type Actor } from "@/lib/stockwell/operations";
import { useState } from "react";
import { chartAccounts, type Account } from "@/lib/stockwell/accounts";
import { JournalForm } from "@/components/stockwell/forms/journal-form";
import { journalTotals, journalAccountBalance, type JournalVoucher } from "@/lib/stockwell/journals";
import { AccountForm } from "@/components/stockwell/forms/account-form";
import type { FinancialRow } from "@/lib/stockwell/model";
import { Badge, Table, Modal, Empty, ServerPagination } from "@/components/stockwell/ui";
import { money, round, today, type Store } from "@/lib/stockwell/model";
import { bankBalanceSummary, sharedBankLedger } from "@/lib/stockwell/bank-vouchers";
import { useServerCollection } from "@/lib/stockwell/use-server-collection";
function weekLabel(start: string) {
  const first = new Date(`${start}T00:00:00Z`);
  const last = new Date(first);
  last.setUTCDate(last.getUTCDate() + 6);
  const format = new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${format.format(first)} – ${format.format(last)}`;
}
type Props = {
  actor: Actor;
  s: Store;
  commit: (next: Store, message: string) => void;
  matches: (...values: unknown[]) => boolean;
  query: string;
  from: string;
  to: string;
  accounting: FinancialRow[];
  inRange: (date: string) => boolean;
};
export function AccountHeadsView({ s, matches, query, from, to, accounting, inRange, commit, actor }: Props) {
  const [reversing, setReversing] = useState("");
  const [editing, setEditing] = useState<Account | null>(null);
  const [journalEditor, setJournalEditor] = useState<JournalVoucher | "new" | null>(null);
  const [journalDetails, setJournalDetails] = useState<JournalVoucher | null>(null);
  const [selectedWeek, setSelectedWeek] = useState("");
  const accountDirectory = useServerCollection<Account>({ collection: "accountDirectory", query, from, to, pageSize: 25 });
  const journalPage = useServerCollection<JournalVoucher>({ collection: "journals", query, from, to, pageSize: 20 });
  const transactionPage = useServerCollection<FinancialRow>({ collection: "financialTransactions", query, from, to, week: selectedWeek, pageSize: 25 });
  const accountSummaries = (transactionPage.meta?.accountSummaries as Array<{ id: string; transactionCount: number; transactionTotal: number }> | undefined) || [];
  const weeks = (transactionPage.meta?.weeks as string[] | undefined) || [];
  const weekIndex = Math.max(0, weeks.indexOf(selectedWeek));
  const activeWeek = (transactionPage.meta?.activeWeek as string | undefined) || "";
  const weeklyTransactions = transactionPage.records;
  const accounts = chartAccounts(s);
  const bankSummary = bankBalanceSummary(s);
  const sharedBank = sharedBankLedger(s);
  const sorted = [...accounts].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const visible = new Set((accountDirectory.meta?.visibleIds as string[] | undefined) || []);
  const visibleRoots = accountDirectory.records;
  function renderAccount(account: Account, ancestors: string[] = []) {
    if (!visible.has(account.id) || ancestors.includes(account.id)) return null;
    const children = sorted.filter(a => a.parentId === account.id && visible.has(a.id));
    const journalBalance = journalAccountBalance(s, account, today());
    const isBankLedger = account.id === sharedBank?.id || (s.financialAccounts || []).some(bank => bank.ledgerAccountId === account.id);
    const summary = accountSummaries.find(item => item.id === account.id);
    const count = Number(summary?.transactionCount || 0);
    const transactionTotal = Number(summary?.transactionTotal || 0);
    return <li className="account-branch" key={account.id}>
      <article className="chart-account-card" aria-label={`Account ${account.name}`}>
        <div className="chart-account-top"><span className="chart-account-code">{account.code}</span><Badge>{account.type}</Badge></div>
        <h3>{account.name}</h3>
        {account.parentId && <p className="chart-account-parent">Under {accounts.find(a => a.id === account.parentId)?.name}</p>}
        <dl className="chart-account-balance"><div><dt>Opening balance</dt><dd>{money(account.openingBalance)}</dd></div><div><dt>Nature</dt><dd>{account.nature}</dd></div></dl>
        <p className="chart-account-date">{account.openingDate ? `As of ${account.openingDate}` : "No opening date recorded"}</p>
        <p className="chart-account-activity">Net transaction amount <b>{money(transactionTotal)}</b><small>Selected period · includes sales, purchases, expenses and posted entries</small></p>
        <p className="chart-account-journal-balance">{isBankLedger ? "Current bank ledger balance" : "Opening + posted vouchers"} <b>{money(Math.abs(journalBalance))} {journalBalance < 0 ? "Cr" : "Dr"}</b></p>
        {account.description && <p className="chart-account-description">{account.description}</p>}
        <div className="chart-account-footer"><span>{count} {count === 1 ? "transaction" : "transactions"}</span>{actor.role === "owner" && <button className="link" onClick={() => setEditing(account)} aria-label={`Edit ${account.name}`}>Edit account</button>}</div>
      </article>
      {!!children.length && <ul className="chart-account-children">{children.map(child => renderAccount(child, [...ancestors, account.id]))}</ul>}
    </li>;
  }
  return (
    <>
      <section className="card" aria-label="Bank and wallet balances">
        <div className="section-head"><div><span>ASSETS · BANK AND WALLETS</span><h2>Total Bank Balance</h2><strong>{money(bankSummary.total)}</strong></div><Badge>{bankSummary.balances.length} accounts</Badge></div>
        <Table headers={["Bank / wallet", "Type", "Current balance"]} rows={bankSummary.balances.map(account => [account.name, `${account.type}${account.active === false ? " · Inactive" : ""}`, money(account.balance)])} empty="No bank or wallet accounts yet" />
        {bankSummary.unassigned !== 0 && <p>Unassigned bank entries: <strong>{money(bankSummary.unassigned)}</strong></p>}
      </section>
      <section className="chart-accounts-section" aria-labelledby="chart-accounts-title">
        <div className="section-head mt-4"><div><h2 id="chart-accounts-title">Chart of accounts</h2><p>Browse account details and opening balances. Subaccounts are grouped under their parent.</p></div><Badge>{Number(accountDirectory.meta?.visibleCount || 0)} of {Number(accountDirectory.meta?.accountCount || 0)} accounts</Badge></div>
        {visible.size ? <>
          <ul className="chart-accounts-grid">{visibleRoots.map(account => renderAccount(account))}</ul>
          <ServerPagination page={accountDirectory.page} pageCount={accountDirectory.pageCount} count={accountDirectory.count} pageSize={accountDirectory.pageSize} setPage={accountDirectory.setPage} />
        </> : <Empty title="No matching accounts">Try another account name, code, or type.</Empty>}
      </section>
      {editing && <Modal title="Edit account" close={() => setEditing(null)}><AccountForm s={s} account={editing} commit={(next, message) => { commit(next, message); setEditing(null); }} /></Modal>}
      <section className="card" aria-labelledby="journal-register-title">
        <div className="section-head">
          <div><h2 id="journal-register-title">Journal vouchers</h2><p>Drafts can be edited. Posted vouchers record balanced account entries.</p></div>
          <div className="journal-register-actions"><Badge>{journalPage.count} vouchers</Badge><button className="primary" onClick={() => setJournalEditor("new")}>New journal</button></div>
        </div>
        <Table
          headers={["Date", "Voucher", "Reference / notes", "Status", "Debit", "Credit", "Balance check", "Action"]}
          empty="No matching journal vouchers"
          rows={journalPage.records.map(v => {
            const totals = journalTotals(v.lines);
            return [
              v.date,
              <div className="journal-register-reference"><span>{v.number}</span><small>{v.lines.length} lines</small></div>,
              <div className="journal-register-reference"><span>{v.reference || "—"}</span>{v.notes && <small>{v.notes}</small>}</div>,
              <Badge tone={v.status === "posted" ? "green" : "amber"}>{v.status === "posted" ? "Posted" : "Draft"}</Badge>,
              money(totals.debit),
              money(totals.credit),
              <Badge tone={totals.difference === 0 ? "green" : "amber"}>{totals.difference === 0 ? "Balanced" : `Difference ${money(totals.difference)}`}</Badge>,
              <button className="link" onClick={() => v.status === "draft" ? setJournalEditor(v) : setJournalDetails(v)} aria-label={`${v.status === "draft" ? "Edit" : "View"} ${v.number}`}>{v.status === "draft" ? "Edit / post" : "View entries"}</button>,
            ];
          })}
        />
        {journalPage.error && <p className="form-error" role="alert">{journalPage.error}</p>}
        <ServerPagination page={journalPage.page} pageCount={journalPage.pageCount} count={journalPage.count} pageSize={journalPage.pageSize} setPage={journalPage.setPage} />
      </section>
      {journalEditor && <Modal title={journalEditor === "new" ? "New journal voucher" : `Edit ${journalEditor.number}`} close={() => setJournalEditor(null)}><JournalForm s={s} voucher={journalEditor === "new" ? undefined : journalEditor} commit={(next, message) => { commit(next, message); setJournalEditor(null); }} /></Modal>}
      {journalDetails && <Modal title={journalDetails.number} close={() => setJournalDetails(null)}>
        <p>{journalDetails.date} · {journalDetails.reference || "No external reference"}</p><p>{journalDetails.notes}</p>
        <Table headers={["Account", "Description", "Debit", "Credit"]} rows={journalDetails.lines.map(l => [accounts.find(a => a.id === l.accountId)?.name || "Unknown account", l.description, money(l.debit), money(l.credit)])} />
        {actor.role === "owner" && !s.journals?.some(v => v.reversalOf === journalDetails.id) && <button className="secondary" onClick={() => { setReversing(journalDetails.id); setJournalDetails(null); }}>Reverse journal</button>}
        <p>Debit {money(journalTotals(journalDetails.lines).debit)} · Credit {money(journalTotals(journalDetails.lines).credit)}</p><p>Posted {journalDetails.postedAt ? new Date(journalDetails.postedAt).toLocaleString("en-PK") : ""} · Locked</p>
      </Modal>}
      <section className="card mt-8">
        <div className="section-head">
          <div><h2>Transactions by account head</h2><p>Monday–Sunday · {activeWeek ? weekLabel(activeWeek) : "No matching transactions"}</p></div>
          <Badge>{weeklyTransactions.length} transactions</Badge>
        </div>
        {!!weeks.length && <nav className="account-week-pagination" aria-label="Transaction history weeks">
          <button className="secondary" disabled={weekIndex >= weeks.length - 1} onClick={() => setSelectedWeek(weeks[weekIndex + 1])}>← Older week</button>
          <span aria-live="polite">Week {weekIndex + 1} of {weeks.length} with transactions</span>
          <button className="secondary" disabled={weekIndex === 0} onClick={() => setSelectedWeek(weeks[weekIndex - 1])}>Newer week →</button>
        </nav>}
        <Table
          headers={[
            "Date",
            "Reference",
            "Type",
            "Account head",
            "Amount",
            "Voucher debit",
            "Voucher credit",
            "Payment method",
          ]}
          empty="No matching transactions"
          rows={weeklyTransactions.map((r) => [
            r.date,
            r.reference,
            r.type,
            <Badge>{r.head}</Badge>,
            money(r.amount),
            r.debit === undefined ? "—" : money(r.debit),
            r.credit === undefined ? "—" : money(r.credit),
            r.method,
          ])}
        />
        {transactionPage.error && <p className="form-error" role="alert">{transactionPage.error}</p>}
        <ServerPagination page={transactionPage.page} pageCount={transactionPage.pageCount} count={transactionPage.count} pageSize={transactionPage.pageSize} setPage={transactionPage.setPage} />
      </section>
    </>
  );
}

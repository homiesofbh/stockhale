"use client";
import { ReasonDialog } from "../reason-dialog";
import { reverseVoucher, type Actor } from "@/lib/stockwell/operations";
import { useState } from "react";
import { accountPath, chartAccounts, type Account } from "@/lib/stockwell/accounts";
import { JournalForm } from "@/components/stockwell/forms/journal-form";
import { journalTotals, journalAccountBalance, type JournalVoucher } from "@/lib/stockwell/journals";
import { AccountForm } from "@/components/stockwell/forms/account-form";
import type { FinancialRow } from "@/lib/stockwell/model";
import { Badge, Table, Modal, Empty } from "@/components/stockwell/ui";
import { money, today, uid, type Store } from "@/lib/stockwell/model";
// Parse record dates in UTC so week boundaries do not shift with device timezone.
function transactionWeek(date: string) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
}
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
  accounting: FinancialRow[];
  inRange: (date: string) => boolean;
};
export function AccountHeadsView({ s, matches, accounting, inRange, commit, actor }: Props) {
  const [reversing, setReversing] = useState("");
  const [editing, setEditing] = useState<Account | null>(null);
  const [journalEditor, setJournalEditor] = useState<JournalVoucher | "new" | null>(null);
  const [journalDetails, setJournalDetails] = useState<JournalVoucher | null>(null);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [partner, setPartner] = useState("");
  const [partnerKind, setPartnerKind] = useState<"Contribution" | "Withdrawal">("Withdrawal");
  const [partnerAmount, setPartnerAmount] = useState("");
  const [partnerMethod, setPartnerMethod] = useState("Cash");
  const transactions = accounting
    .filter(r => inRange(r.date) && matches(r.head, r.reference, r.type))
    .sort((a, b) => b.date.localeCompare(a.date));
  const weeks = [...new Set(transactions.map(r => transactionWeek(r.date)))].sort().reverse();
  const weekIndex = Math.max(0, weeks.indexOf(selectedWeek));
  const activeWeek = weeks[weekIndex];
  const weeklyTransactions = transactions.filter(r => transactionWeek(r.date) === activeWeek);
  const accounts = chartAccounts(s);
  const sorted = [...accounts].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const visible = new Set(sorted.filter(a => matches(a.code, accountPath(accounts, a), a.type, a.description)).map(a => a.id));
  // Retain parents as context when a search only matches a child.
  for (const account of sorted.filter(a => visible.has(a.id))) {
    let parentId = account.parentId;
    const seen = new Set([account.id]);
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId); visible.add(parentId);
      parentId = accounts.find(a => a.id === parentId)?.parentId || "";
    }
  }
  const journals = [...(s.journals || [])].filter(v => inRange(v.date) && matches(
    v.number, v.reference, v.notes, v.status,
    ...v.lines.flatMap(l => [accounts.find(a => a.id === l.accountId)?.name, l.description]),
  )).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const roots = sorted.filter(a => !a.parentId || !accounts.some(parent => parent.id === a.parentId));
  function renderAccount(account: Account, ancestors: string[] = []) {
    if (!visible.has(account.id) || ancestors.includes(account.id)) return null;
    const children = sorted.filter(a => a.parentId === account.id && visible.has(a.id));
    const journalBalance = journalAccountBalance(s, account);
    const count = accounting.filter(r => r.head === account.name && inRange(r.date)).length;
    return <li className="account-branch" key={account.id}>
      <article className="chart-account-card" aria-label={`Account ${account.name}`}>
        <div className="chart-account-top"><span className="chart-account-code">{account.code}</span><Badge>{account.type}</Badge></div>
        <h3>{account.name}</h3>
        {account.parentId && <p className="chart-account-parent">Under {accounts.find(a => a.id === account.parentId)?.name}</p>}
        <dl className="chart-account-balance"><div><dt>Opening balance</dt><dd>{money(account.openingBalance)}</dd></div><div><dt>Nature</dt><dd>{account.nature}</dd></div></dl>
        <p className="chart-account-date">{account.openingDate ? `As of ${account.openingDate}` : "No opening date recorded"}</p>
        <p className="chart-account-journal-balance">Opening + posted vouchers <b>{money(Math.abs(journalBalance))} {journalBalance < 0 ? "Cr" : "Dr"}</b></p>
        {account.description && <p className="chart-account-description">{account.description}</p>}
        <div className="chart-account-footer"><span>{count} {count === 1 ? "transaction" : "transactions"}</span>{actor.role === "owner" && <button className="link" onClick={() => setEditing(account)} aria-label={`Edit ${account.name}`}>Edit account</button>}</div>
      </article>
      {!!children.length && <ul className="chart-account-children">{children.map(child => renderAccount(child, [...ancestors, account.id]))}</ul>}
    </li>;
  }
  return (
    <>
      <section className="card">
        <div className="section-head"><div><h2>Partner contributions and withdrawals</h2><p>Record money introduced by or taken by a business partner.</p></div></div>
        <div className="form-grid">
          <input aria-label="Partner name" placeholder="Partner name" value={partner} onChange={e => setPartner(e.target.value)} />
          <select aria-label="Partner entry type" value={partnerKind} onChange={e => setPartnerKind(e.target.value as typeof partnerKind)}><option>Withdrawal</option><option>Contribution</option></select>
          <input aria-label="Partner amount" type="number" min="0.01" step="0.01" placeholder="Amount (PKR)" value={partnerAmount} onChange={e => setPartnerAmount(e.target.value)} />
          <input aria-label="Partner payment method" placeholder="Method" value={partnerMethod} onChange={e => setPartnerMethod(e.target.value)} />
          <button className="primary" onClick={() => { const amount = Number(partnerAmount); if (!partner.trim() || !Number.isFinite(amount) || amount <= 0) return; commit({ ...s, partners: [...(s.partners || []), { id: uid(), date: today(), partner: partner.trim(), kind: partnerKind, amount, method: partnerMethod.trim() || "Cash", notes: "" }] }, "Partner entry recorded."); setPartner(""); setPartnerAmount(""); }}>Record entry</button>
        </div>
        <Table headers={["Date", "Partner", "Type", "Amount", "Method"]} rows={(s.partners || []).slice().reverse().map(p => [p.date, p.partner, p.kind, money(p.amount), p.method])} empty="No partner entries" />
      </section>
      <section className="chart-accounts-section" aria-labelledby="chart-accounts-title">
        <div className="section-head"><div><h2 id="chart-accounts-title">Chart of accounts</h2><p>Browse account details and opening balances. Subaccounts are grouped under their parent.</p></div><Badge>{visible.size} of {accounts.length} accounts</Badge></div>
        {visible.size ? <ul className="chart-accounts-grid">{roots.map(account => renderAccount(account))}</ul> : <Empty title="No matching accounts">Try another account name, code, or type.</Empty>}
      </section>
      {editing && <Modal title="Edit account" close={() => setEditing(null)}><AccountForm s={s} account={editing} commit={(next, message) => { commit(next, message); setEditing(null); }} /></Modal>}
      <section className="card" aria-labelledby="journal-register-title">
        <div className="section-head">
          <div><h2 id="journal-register-title">Journal vouchers</h2><p>Drafts can be edited. Posted vouchers record balanced account entries.</p></div>
          <div className="journal-register-actions"><Badge>{journals.length} vouchers</Badge><button className="primary" onClick={() => setJournalEditor("new")}>New journal</button></div>
        </div>
        <Table
          headers={["Date", "Voucher", "Reference / notes", "Status", "Debit", "Credit", "Balance check", "Action"]}
          empty="No matching journal vouchers"
          rows={journals.map(v => {
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
      </section>
    </>
  );
}

"use client";
import { useState } from "react";
import { ChequeRegister } from "./cheque-register";
import type { Actor } from "@/lib/stockwell/operations";
import { BankVouchersView } from "./bank-vouchers-view";
import { Badge, Field, Modal, Stat, Table } from "@/components/stockwell/ui";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { saveFinancialAccount, sharedBankLedger } from "@/lib/stockwell/bank-vouchers";
import { financialRows, money, round, today, uid, type Store } from "@/lib/stockwell/model";
type Props = {
  actor: Actor;
  receivables: number;
  payables: number;
  cash: number;
  bank: number;
  s: Store;
  cName: (id: string, supplier?: boolean) => string;
  inRange: (date: string) => boolean;
  matches: (...values: unknown[]) => boolean;
  commit: (next: Store, message: string) => void;
};
export function PaymentsView({
  actor,
  receivables,
  payables,
  cash,
  bank,
  s,
  cName,
  inRange,
  matches,
  commit,
}: Props) {
  const [partner, setPartner] = useState("");
  const [partnerDraft, setPartnerDraft] = useState("");
  const [partnerKind, setPartnerKind] = useState<"Contribution" | "Withdrawal">("Withdrawal");
  const [partnerMethod, setPartnerMethod] = useState("Cash");
  const [partnerError, setPartnerError] = useState("");
  const [ledgerPartner, setLedgerPartner] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumberInput, setAccountNumberInput] = useState("");
  const [accountType, setAccountType] = useState<"Bank" | "Wallet">("Bank");
  const [accountOpeningBalance, setAccountOpeningBalance] = useState("0");
  const [accountOpeningDate, setAccountOpeningDate] = useState("");
  const [accountError, setAccountError] = useState("");
  const [historyAccountId, setHistoryAccountId] = useState("");
  const [accountHistoryFrom, setAccountHistoryFrom] = useState("");
  const [accountHistoryTo, setAccountHistoryTo] = useState("");
  const [bankHistoryFrom, setBankHistoryFrom] = useState("");
  const [bankHistoryTo, setBankHistoryTo] = useState("");
  const [paymentHistoryPage, setPaymentHistoryPage] = useState(0);
  const partnerNames = Array.from(new Set([...(s.partnerNames || []), ...(s.partners || []).map(entry => entry.partner)].map(name => name.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const partnerAccounts = (s.financialAccounts || []).filter(account => account.active !== false);
  const partnerLedgerEntries = (s.partners || [])
    .filter(entry => !ledgerPartner || entry.partner === ledgerPartner)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const partnerBalances = new Map<string, number>();
  const partnerRunningBalances = new Map<string, number>();
  let ledgerContributions = 0;
  let ledgerWithdrawals = 0;
  for (const entry of partnerLedgerEntries) {
    const delta = entry.kind === "Contribution" ? entry.amount : -entry.amount;
    const balance = (partnerBalances.get(entry.partner) || 0) + delta;
    partnerBalances.set(entry.partner, balance);
    partnerRunningBalances.set(entry.id, balance);
    if (entry.kind === "Contribution") ledgerContributions += entry.amount;
    else ledgerWithdrawals += entry.amount;
  }
  const partnerLedgerRows = partnerLedgerEntries.slice().reverse();
  const sharedLedger = sharedBankLedger(s);
  const trades = [...s.invoices, ...s.purchases];
  const bankHistory = financialRows(s)
    .filter((row) => row.financialAccountId && row.bank !== 0)
    .filter((row) => (!bankHistoryFrom || row.date >= bankHistoryFrom) && (!bankHistoryTo || row.date <= bankHistoryTo))
    .filter((row) => inRange(row.date) && matches(row.date, row.reference, row.type, row.head, row.method, row.contactId, row.bank))
    .map((row) => {
      const account = (s.financialAccounts || []).find((candidate) => candidate.id === row.financialAccountId);
      const trade = trades.find((candidate) => candidate.number === row.reference);
      const contact = trade
        ? cName(trade.contactId, trade.number.startsWith("PUR"))
        : row.contactId
          ? cName(row.contactId, row.type.toLowerCase().includes("supplier"))
          : "—";
      return { row, account, trade, contact };
    })
    .sort((a, b) => b.row.date.localeCompare(a.row.date));
  const historyAccount = (s.financialAccounts || []).find(account => account.id === historyAccountId);
  const accountHistory = historyAccount ? financialRows(s)
    .filter(row => row.financialAccountId === historyAccount.id && row.bank !== 0)
    .filter(row => (!accountHistoryFrom || row.date >= accountHistoryFrom) && (!accountHistoryTo || row.date <= accountHistoryTo))
    .sort((a, b) => b.date.localeCompare(a.date)) : [];
  const paymentHistoryEntries = [
    ...s.invoices
      .filter(t => t.status !== "draft" && t.status !== "void" && t.paid > 0)
      .map(t => ({
        date: t.date,
        contact: t.contactId ? cName(t.contactId) : [t.walkInName, t.walkInCompany, t.walkInPhone].filter(Boolean).join(" · ") || "Walk-in customer",
        reference: t.number,
        kind: "Customer",
        amount: t.paid,
        method: t.method,
        cheque: "",
        chequeStatus: undefined as string | undefined,
        head: t.head,
      })),
    ...s.purchases
      .filter(t => t.status !== "draft" && t.status !== "void" && t.paid > 0)
      .map(t => ({
        date: t.date, contact: cName(t.contactId, true), reference: t.number,
        kind: "Supplier", amount: t.paid, method: t.method, cheque: "",
        chequeStatus: undefined as string | undefined, head: t.head,
      })),
    ...s.payments.map(p => ({
      date: p.date, contact: cName(p.contactId, p.kind === "Supplier"),
      reference: p.accountLevel ? "Supplier account payment" : p.advance && !p.tradeId ? "Unapplied advance" : [...s.invoices, ...s.purchases].find(t => t.id === p.tradeId)?.number || "",
      kind: p.kind, amount: p.amount,
      method: p.chequeStatus ? `Cheque ${p.chequeStatus}` : p.method,
      cheque: p.chequeNumber ? `${p.chequeNumber} · ${p.chequeBank} · due ${p.chequeDate}${p.clearedDate ? ` · cleared ${p.clearedDate}` : ""}` : "",
      chequeStatus: p.chequeStatus, head: p.head,
    })),
    ...(s.partners || []).map(entry => ({
      date: entry.date, contact: entry.partner, reference: entry.notes || "",
      kind: `Partner ${entry.kind}`,
      amount: entry.kind === "Contribution" ? entry.amount : -entry.amount,
      method: entry.method, cheque: "", chequeStatus: undefined as string | undefined,
      head: "Partner capital",
    })),
  ].filter(p => inRange(p.date) && matches(p.contact, p.reference, p.kind, p.head, p.cheque, p.method))
    .sort((a, b) => b.date.localeCompare(a.date));
  const paymentHistoryPageSize = 15;
  const paymentHistoryPageCount = Math.ceil(paymentHistoryEntries.length / paymentHistoryPageSize);
  const currentPaymentHistoryPage = Math.min(paymentHistoryPage, Math.max(0, paymentHistoryPageCount - 1));
  const visiblePaymentHistory = paymentHistoryEntries.slice(
    currentPaymentHistoryPage * paymentHistoryPageSize,
    (currentPaymentHistoryPage + 1) * paymentHistoryPageSize,
  );
  return (
    <>
      <div className="stats-grid three">
        <Stat
          label="Customer receivables"
          value={money(receivables)}
          detail="Net of settled customer credits"
          accent
        />
        <Stat
          label="Supplier payables"
          value={money(payables)}
          detail="Net of settled supplier credits"
        />
        <Stat
          label="Cash / Bank"
          value={money(cash)}
          detail={`Bank ${money(bank)}`}
        />
      </div>
      <ChequeRegister s={s} actor={actor} matches={matches} commit={commit} />
      {historyAccount && <Modal title={`${historyAccount.name} history`} close={() => setHistoryAccountId("")}>
        <p>Bill receipts, deposits, supplier payments, expenses, cheque settlements, and vouchers recorded against this account.</p>
        <div className="form-grid">
          <Field label="From date"><input type="date" value={accountHistoryFrom} onChange={event => setAccountHistoryFrom(event.target.value)} /></Field>
          <Field label="To date"><input type="date" value={accountHistoryTo} onChange={event => setAccountHistoryTo(event.target.value)} /></Field>
        </div>
        <Table headers={["Date", "Movement", "Bill / voucher", "Contact", "Amount", "Account head"]} empty="No transactions have been recorded for this account" rows={accountHistory.map(row => {
          const trade = trades.find(candidate => candidate.number === row.reference);
          const contact = trade ? cName(trade.contactId, trade.number.startsWith("PUR")) : row.contactId ? cName(row.contactId, row.type.toLowerCase().includes("supplier")) : "—";
          return [row.date, <Badge tone={row.bank > 0 ? "green" : "amber"}>{row.bank > 0 ? "Received / deposited" : "Paid"}</Badge>, <div className="journal-register-reference"><span>{row.reference || "—"}</span><small>{trade ? (trade.number.startsWith("PUR") ? "Purchase" : "Sale") : row.type}</small></div>, contact, money(Math.abs(row.bank)), row.head || "—"];
        })} />
      </Modal>}
      <section className="card mt-8 partner-ledger-card">
        <div className="section-head">
          <div><h2>Partner ledger</h2><p>Review each partner’s complete contribution and withdrawal history with a running capital balance.</p></div>
          <Badge>{partnerLedgerRows.length} entries</Badge>
        </div>
        <div className="form-grid">
          <Field label="Partner"><GlassSelect value={ledgerPartner} onValueChange={setLedgerPartner}><option value="">All partners</option>{partnerNames.map(name => <option key={name} value={name}>{name}</option>)}</GlassSelect></Field>
        </div>
        <div className="stats-grid three mt-8">
          <Stat label="Contributions" value={money(ledgerContributions)} detail={ledgerPartner || "All partners"} accent />
          <Stat label="Withdrawals" value={money(ledgerWithdrawals)} detail={ledgerPartner || "All partners"} />
          <Stat label="Net capital balance" value={money(ledgerContributions - ledgerWithdrawals)} detail={ledgerPartner || "All partners"} />
        </div>
        <Table
          headers={["Date", "Partner", "Movement", "Contribution", "Withdrawal", "Cash / bank account", "Reference / notes", "Running balance"]}
          empty={ledgerPartner ? "No capital movements for this partner" : "No partner capital movements recorded"}
          rows={partnerLedgerRows.map(entry => [
            entry.date,
            entry.partner,
            <Badge tone={entry.kind === "Contribution" ? "green" : "amber"}>{entry.kind}</Badge>,
            entry.kind === "Contribution" ? money(entry.amount) : "—",
            entry.kind === "Withdrawal" ? money(entry.amount) : "—",
            entry.method,
            entry.notes || "—",
            money(partnerRunningBalances.get(entry.id) || 0),
          ])}
        />
      </section>
      <section className="card mt-8">
        <div className="section-head">
          <div><h2>Partner capital movements</h2><p>Record cash or bank money introduced by a partner or taken from the business.</p></div>
        </div>
        <form className="partner-entry-form" onSubmit={event => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const name = partner.trim();
          const amount = Number(form.get("partnerAmount"));
          const date = String(form.get("partnerDate") || "");
          const notes = String(form.get("partnerNotes") || "").trim();
          if (!name) { setPartnerError("Enter the partner name."); return; }
          if (!Number.isFinite(amount) || amount <= 0) { setPartnerError("Enter an amount greater than zero."); return; }
          const account = partnerAccounts.find(candidate => candidate.name === partnerMethod);
          const canonicalName = partnerNames.find(existing => existing.localeCompare(name, undefined, { sensitivity: "base" }) === 0) || name;
          commit({
            ...s,
            partnerNames: partnerNames.some(existing => existing.localeCompare(name, undefined, { sensitivity: "base" }) === 0) ? s.partnerNames || [] : [...(s.partnerNames || []), name],
            partners: [...(s.partners || []), { id: uid(), date, partner: canonicalName, kind: partnerKind, amount: round(amount), method: partnerMethod, financialAccountId: account?.id, notes }],
          }, `Partner ${partnerKind.toLowerCase()} recorded.`);
          setPartner("");
          setPartnerError("");
          event.currentTarget.reset();
          setPartnerMethod("Cash");
          setPartnerKind("Withdrawal");
        }}>
          <div className="form-grid partner-form">
            <Field label="Partner"><div className="partner-add-field"><GlassSelect value={partner} onValueChange={value => { setPartner(value); if (partnerError) setPartnerError(""); }} searchable searchPlaceholder="Search partners…" aria-label="Partner"><option value="">Select partner</option>{partnerNames.map(name => <option key={name} value={name}>{name}</option>)}</GlassSelect><div className="partner-add"><input value={partnerDraft} onChange={event => setPartnerDraft(event.target.value)} placeholder="New partner name" maxLength={120} aria-label="New partner name" /><button className="secondary" type="button" disabled={!partnerDraft.trim() || partnerNames.some(name => name.localeCompare(partnerDraft.trim(), undefined, { sensitivity: "base" }) === 0)} onClick={() => {
              const name = partnerDraft.trim();
              if (!name || partnerNames.some(existing => existing.localeCompare(name, undefined, { sensitivity: "base" }) === 0)) return;
              commit({ ...s, partnerNames: [...(s.partnerNames || []), name] }, "Partner added.");
              setPartner(name);
              setPartnerDraft("");
              setPartnerError("");
            }}>Add partner</button></div></div></Field>
            <Field label="Movement"><GlassSelect value={partnerKind} onValueChange={value => setPartnerKind(value as typeof partnerKind)}><option>Contribution</option><option>Withdrawal</option></GlassSelect></Field>
            <Field label="Cash / bank account"><GlassSelect value={partnerMethod} onValueChange={setPartnerMethod}><option value="Cash">Cash</option>{partnerAccounts.map(account => <option key={account.id} value={account.name}>{account.name} · {account.type}</option>)}</GlassSelect></Field>
            <Field label="Amount (PKR)"><input name="partnerAmount" type="number" min="0.01" step="0.01" placeholder="0.00" required onChange={() => { if (partnerError) setPartnerError(""); }} /></Field>
            <Field label="Date"><input name="partnerDate" type="date" required defaultValue={today()} /></Field>
            <Field label="Notes"><input name="partnerNotes" maxLength={500} placeholder="Optional reference or note" /></Field>
          </div>
          <div className="partner-form-actions">
            <div><p className="form-hint">{partnerKind === "Contribution" ? "Increases the business cash or bank balance." : "Reduces the business cash or bank balance."}</p>{partnerError && <p className="form-error" id="partner-name-error" role="alert">{partnerError}</p>}</div>
            <button className="primary" type="submit">Record {partnerKind.toLowerCase()}</button>
          </div>
        </form>
        <Table headers={["Date", "Partner", "Movement", "Amount", "Cash / bank account", "Notes"]} rows={(s.partners || []).filter(entry => inRange(entry.date) && matches(entry.partner, entry.kind, entry.method, entry.notes)).slice().sort((a, b) => b.date.localeCompare(a.date)).map(entry => [entry.date, entry.partner, <Badge tone={entry.kind === "Contribution" ? "green" : "amber"}>{entry.kind}</Badge>, money(entry.amount), entry.method, entry.notes || "—"])} empty="No partner capital movements in this period" />
      </section>
      <section className="card mt-8">
        <div className="section-head"><div><h2>Bank and wallet accounts</h2><p>All accounts share the Bank asset ledger while keeping separate balances and transaction histories.</p></div></div>
        {accountError && <p className="form-error" role="alert">{accountError}</p>}
        {actor.role === "owner" && <form className="form-grid account-form" onSubmit={event => {
          event.preventDefault();
          const name = accountName.trim();
          if (!name) return;
          if ((s.financialAccounts || []).some(account => account.name.toLowerCase() === name.toLowerCase())) { setAccountError("That payment account already exists."); return; }
          try {
            const openingBalance = Number(accountOpeningBalance || 0);
            if (!Number.isFinite(openingBalance) || openingBalance < 0 || round(openingBalance) !== openingBalance || openingBalance > 0 && !accountOpeningDate) { setAccountError("Enter a valid opening balance and its date."); return; }
            commit(saveFinancialAccount(s, { id: uid(), name, accountNumber: accountNumberInput.trim() || undefined, type: accountType, active: true, openingBalance, openingDate: accountOpeningDate }), "Payment account added.");
            setAccountName(""); setAccountNumberInput(""); setAccountOpeningBalance("0"); setAccountOpeningDate(""); setAccountError("");
          } catch (error) { setAccountError(error instanceof Error ? error.message : "Could not add account."); }
        }}>
          <Field label="Account name"><input value={accountName} onChange={event => setAccountName(event.target.value)} placeholder="e.g. HBL Business Account" maxLength={120} required /></Field>
          <Field label="Account number (optional)"><input value={accountNumberInput} onChange={event => setAccountNumberInput(event.target.value)} placeholder="e.g. IBAN or account number" maxLength={80} /></Field>
          <Field label="Account type"><GlassSelect value={accountType} onValueChange={value => setAccountType(value as "Bank" | "Wallet")}><option>Bank</option><option>Wallet</option></GlassSelect></Field>
          <Field label="Opening balance"><input type="number" min="0" step="0.01" value={accountOpeningBalance} onChange={event => setAccountOpeningBalance(event.target.value)} /></Field>
          <Field label="Opening balance date"><input type="date" value={accountOpeningDate} onChange={event => setAccountOpeningDate(event.target.value)} /></Field>
          <button className="primary" type="submit">Add account</button>
        </form>}
        <div className="permission-grid account-list">{(s.financialAccounts || []).map(account => <div key={account.id}>
          <b>{account.name} · {account.type}{account.accountNumber ? ` · ${account.accountNumber}` : ""}</b>
          <button type="button" className="link" onClick={() => setHistoryAccountId(account.id)}>View account history</button>
          <Field label="Shared Asset ledger"><div><input value={sharedLedger ? `${sharedLedger.code} · ${sharedLedger.name}` : "Bank asset head not configured"} readOnly /><small className="field-help">New accounts use the shared Bank ledger. Each account keeps its opening balance and statement.</small></div></Field>
          {actor.role === "owner" && <button type="button" className="link" onClick={() => { try { commit(saveFinancialAccount(s, { ...account, active: account.active === false }), `${account.name} ${account.active === false ? "reactivated" : "deactivated"}.`); setAccountError(""); } catch (error) { setAccountError(error instanceof Error ? error.message : "Could not update account."); } }}>{account.active === false ? "Reactivate" : "Deactivate"}</button>}
        </div>)}</div>
      </section>
      <section className="card mt-8">
        <div className="section-head">
          <div>
            <h2>Bank / wallet account history</h2>
            <p>Every bill receipt, supplier payment, expense, cheque settlement, and bank voucher posted to a named account.</p>
          </div>
          <Badge>{bankHistory.length} entries</Badge>
        </div>
        <div className="form-grid">
          <Field label="From date"><input type="date" value={bankHistoryFrom} max={bankHistoryTo || undefined} onChange={event => setBankHistoryFrom(event.target.value)} /></Field>
          <Field label="To date"><input type="date" value={bankHistoryTo} min={bankHistoryFrom || undefined} onChange={event => setBankHistoryTo(event.target.value)} /></Field>
        </div>
        <Table
          headers={["Date", "Bank / wallet", "Movement", "Bill / voucher", "Contact", "Amount", "Account head"]}
          empty="No bank-linked history in this period"
          rows={bankHistory.map(({ row, account, trade, contact }) => [
            row.date,
            account?.name || "Unknown account",
            <Badge tone={row.bank > 0 ? "green" : "amber"}>
              {row.bank > 0 ? "Received" : "Paid"}
            </Badge>,
            <div className="journal-register-reference">
              <span>{row.reference || "—"}</span>
              <small>{trade ? (trade.number.startsWith("PUR") ? "Purchase" : "Sale") : row.type}</small>
            </div>,
            contact,
            money(Math.abs(row.bank)),
            row.head || "—",
          ])}
        />
      </section>
      <BankVouchersView actor={actor} s={s} matches={matches} inRange={inRange} commit={commit} />
      <section className="card mt-8">
        <div className="section-head">
          <h2>Payment history</h2>
          <p>Includes payments collected when a transaction was created.</p>
        </div>
        <Table
          headers={[
            "Date",
            "Contact",
            "Reference",
            "Type",
            "Amount",
            "Method",
            "Cheque details",
            "Account head",
            "Action",
          ]}
          rows={visiblePaymentHistory.map((p) => [
              p.date,
              p.contact,
              p.reference,
              <Badge tone={p.kind === "Customer" || p.kind === "Partner Contribution" ? "green" : "amber"}>
                {p.kind}
              </Badge>,
              money(p.amount),
              p.method,
              p.cheque,
              p.head,
              p.chequeStatus === "pending" ? "Use cheque register" : "",
            ])}
        />
        {paymentHistoryPageCount > 1 && <nav className="account-week-pagination" aria-label="Payment history pages">
          <button className="secondary" disabled={currentPaymentHistoryPage === 0} onClick={() => setPaymentHistoryPage(currentPaymentHistoryPage - 1)}>← Previous</button>
          <span aria-live="polite">Showing {currentPaymentHistoryPage * paymentHistoryPageSize + 1}–{Math.min((currentPaymentHistoryPage + 1) * paymentHistoryPageSize, paymentHistoryEntries.length)} of {paymentHistoryEntries.length} payments · Page {currentPaymentHistoryPage + 1} of {paymentHistoryPageCount}</span>
          <button className="secondary" disabled={currentPaymentHistoryPage >= paymentHistoryPageCount - 1} onClick={() => setPaymentHistoryPage(currentPaymentHistoryPage + 1)}>Next →</button>
        </nav>}
      </section>
    </>
  );
}

"use client";
import { useEffect, useState } from "react";
import { ChequeRegister } from "./cheque-register";
import type { Actor } from "@/lib/stockwell/operations";
import { financialBalanceSnapshot } from "@/lib/stockwell/operations";
import { BankVouchersView } from "./bank-vouchers-view";
import { Badge, Field, Modal, ServerPagination, Stat, Table } from "@/components/stockwell/ui";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { saveFinancialAccount, sharedBankLedger } from "@/lib/stockwell/bank-vouchers";
import { money, round, today, uid, type FinancialRow, type PartnerEntry, type Store } from "@/lib/stockwell/model";
import { useServerCollection } from "@/lib/stockwell/use-server-collection";
type Props = {
  actor: Actor;
  cash: number;
  bank: number;
  s: Store;
  cName: (id: string, supplier?: boolean) => string;
  inRange: (date: string) => boolean;
  matches: (...values: unknown[]) => boolean;
  commit: (next: Store, message: string) => void;
  query?: string;
  from?: string;
  to?: string;
};
export function PaymentsView({
  actor,
  cash,
  bank,
  s,
  cName,
  inRange,
  matches,
  commit,
  query = "",
  from = "",
  to = "",
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
  const paymentHistory = useServerCollection<any>({ collection: "paymentHistory", query, from, to, pageSize: 15 });
  const receivableStats = useServerCollection<any>({ collection: "dashboardSummary", module: "Billing", pageSize: 1 });
  const payableStats = useServerCollection<any>({ collection: "dashboardSummary", module: "Purchases", pageSize: 1 });
  const partnerLedger = useServerCollection<any>({ collection: "partnerLedger", category: ledgerPartner, pageSize: 20 });
  const partnerMovements = useServerCollection<PartnerEntry>({ collection: "partners", query, from, to, pageSize: 20 });
  const bankHistoryPage = useServerCollection<FinancialRow>({ collection: "financialTransactions", query, from, to, secondaryFrom: bankHistoryFrom, secondaryTo: bankHistoryTo, bankOnly: true, pageSize: 25 });
  const accountHistoryPage = useServerCollection<FinancialRow>({ collection: "financialTransactions", accountId: historyAccountId, bankOnly: true, from: accountHistoryFrom, to: accountHistoryTo, pageSize: 25, enabled: !!historyAccountId });
  useEffect(() => {
    if ((s.financialAccounts || []).some(account => account.id === query)) setHistoryAccountId(query);
  }, [query, s.financialAccounts]);
  const partnerNames = Array.from(new Set([...(s.partnerNames || []), ...(s.partners || []).map(entry => entry.partner)].map(name => name.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const partnerAccounts = (s.financialAccounts || []).filter(account => account.active !== false);
  const partnerLedgerRows = partnerLedger.records;
  const ledgerContributions = partnerLedger.aggregates?.contributions || 0;
  const ledgerWithdrawals = partnerLedger.aggregates?.withdrawals || 0;
  const sharedLedger = sharedBankLedger(s);
  const trades = [...s.invoices, ...s.purchases];
  const bankHistory = bankHistoryPage.records.map((row) => {
      const account = (s.financialAccounts || []).find((candidate) => candidate.id === row.financialAccountId);
      const trade = trades.find((candidate) => candidate.number === row.reference);
      const contact = trade
        ? cName(trade.contactId, trade.number.startsWith("PUR"))
        : row.contactId
          ? cName(row.contactId, row.type.toLowerCase().includes("supplier"))
          : "—";
      return { row, account, trade, contact };
    });
  const historyAccount = (s.financialAccounts || []).find(account => account.id === historyAccountId);
  const accountHistory = accountHistoryPage.records;
  const visiblePaymentHistory = paymentHistory.records;
  const paymentHistorySection = <section className="card mt-8">
    <div className="section-head"><div><h2>Payment history</h2><p>Saved cash and bank balances immediately after each recorded transaction.</p></div></div>
    <Table headers={["Date", "Contact", "Reference", "Type", "Amount", "Method", "Cash after", "Bank after", ...(s.financialAccounts || []).map(account => `${account.name} after`), "Account head", "Cheque details"]} rows={visiblePaymentHistory.map(payment => [payment.date, payment.contact, payment.reference, <Badge tone={payment.kind === "Customer" || payment.kind === "Partner Contribution" ? "green" : "amber"}>{payment.kind}</Badge>, money(payment.amount), payment.method, payment.balanceAfter ? money(payment.balanceAfter.cash) : "Not recorded", payment.balanceAfter ? money(payment.balanceAfter.bank) : "Not recorded", ...(s.financialAccounts || []).map(account => { const snapshot = payment.balanceAfter?.bankAccounts?.find((entry: { id: string; balance: number }) => entry.id === account.id); return !payment.balanceAfter?.bankAccounts ? "Not recorded" : snapshot ? money(snapshot.balance) : "Not configured"; }), payment.head || "—", payment.cheque || "—"])} />
    <ServerPagination page={paymentHistory.page} pageCount={paymentHistory.pageCount} count={paymentHistory.count} pageSize={paymentHistory.pageSize} setPage={paymentHistory.setPage} />
  </section>;
  return (
    <>
      {paymentHistorySection}
      <div className="stats-grid three">
        <Stat
          label="Customer receivables"
          value={money(receivableStats.aggregates?.balance || 0)}
          detail="Net of settled customer credits"
          accent
        />
        <Stat
          label="Supplier payables"
          value={money(payableStats.aggregates?.balance || 0)}
          detail="Net of settled supplier credits"
        />
        <Stat
          label="Cash / Bank"
          value={money(cash)}
          detail={`Bank ${money(bank)}`}
        />
      </div>
      <ChequeRegister s={s} actor={actor} commit={commit} query={query} />
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
        <ServerPagination page={accountHistoryPage.page} pageCount={accountHistoryPage.pageCount} count={accountHistoryPage.count} pageSize={accountHistoryPage.pageSize} setPage={accountHistoryPage.setPage} />
      </Modal>}
      <section className="card mt-8 partner-ledger-card">
        <div className="section-head">
          <div><h2>Partner ledger</h2><p>Review each partner’s complete contribution and withdrawal history with a running capital balance.</p></div>
          <Badge>{partnerLedger.count} entries</Badge>
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
            money(entry.runningBalance),
          ])}
        />
        {partnerLedger.error && <p className="form-error" role="alert">{partnerLedger.error}</p>}<ServerPagination page={partnerLedger.page} pageCount={partnerLedger.pageCount} count={partnerLedger.count} pageSize={partnerLedger.pageSize} setPage={partnerLedger.setPage} />
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
          const recorded = {
            ...s,
            partnerNames: partnerNames.some(existing => existing.localeCompare(name, undefined, { sensitivity: "base" }) === 0) ? s.partnerNames || [] : [...(s.partnerNames || []), name],
            partners: [...(s.partners || []), { id: uid(), createdAt: Date.now(), date, partner: canonicalName, kind: partnerKind, amount: round(amount), method: partnerMethod, financialAccountId: account?.id, notes }],
          };
          const entry = recorded.partners.at(-1)!;
          const snapshot = financialBalanceSnapshot(recorded);
          const next = { ...recorded, partners: recorded.partners.map(item => item.id === entry.id ? { ...item, balanceAfter: snapshot } : item) };
          commit(next, `Partner ${partnerKind.toLowerCase()} recorded.`);
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
        <Table headers={["Date", "Partner", "Movement", "Amount", "Cash / bank account", "Notes"]} rows={partnerMovements.records.map(entry => [entry.date, entry.partner, <Badge tone={entry.kind === "Contribution" ? "green" : "amber"}>{entry.kind}</Badge>, money(entry.amount), entry.method, entry.notes || "—"])} empty="No partner capital movements in this period" />
        {partnerMovements.error && <p className="form-error" role="alert">{partnerMovements.error}</p>}<ServerPagination page={partnerMovements.page} pageCount={partnerMovements.pageCount} count={partnerMovements.count} pageSize={partnerMovements.pageSize} setPage={partnerMovements.setPage} />
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
          <Badge>{bankHistoryPage.count} entries</Badge>
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
        {bankHistoryPage.error && <p className="form-error" role="alert">{bankHistoryPage.error}</p>}
        <ServerPagination page={bankHistoryPage.page} pageCount={bankHistoryPage.pageCount} count={bankHistoryPage.count} pageSize={bankHistoryPage.pageSize} setPage={bankHistoryPage.setPage} />
      </section>
      <BankVouchersView actor={actor} s={s} matches={matches} inRange={inRange} commit={commit} query={query} from={from} to={to} />
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
        <ServerPagination page={paymentHistory.page} pageCount={paymentHistory.pageCount} count={paymentHistory.count} pageSize={paymentHistory.pageSize} setPage={paymentHistory.setPage} />
      </section>
    </>
  );
}

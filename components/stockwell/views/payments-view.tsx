"use client";
import { useState } from "react";
import { ChequeRegister } from "./cheque-register";
import type { Actor } from "@/lib/stockwell/operations";
import { BankVouchersView } from "./bank-vouchers-view";
import { Badge, Field, Stat, Table } from "@/components/stockwell/ui";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { clearCheque, money, round, today, uid, type Store } from "@/lib/stockwell/model";
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
  const [partnerKind, setPartnerKind] = useState<"Contribution" | "Withdrawal">("Withdrawal");
  const [partnerMethod, setPartnerMethod] = useState("Cash");
  const [partnerError, setPartnerError] = useState("");
  const partnerNames = Array.from(new Set([...(s.partnerNames || []), ...(s.partners || []).map(entry => entry.partner)].filter(Boolean))).sort();
  const partnerAccounts = (s.financialAccounts || []).filter(account => account.active !== false);
  return (
    <>
      <div className="stats-grid three">
        <Stat
          label="Customer receivables"
          value={money(receivables)}
          detail="Outstanding bills"
          accent
        />
        <Stat
          label="Supplier payables"
          value={money(payables)}
          detail="Outstanding purchases"
        />
        <Stat
          label="Cash / Bank"
          value={money(cash)}
          detail={`Bank ${money(bank)}`}
        />
      </div>
      <ChequeRegister s={s} actor={actor} matches={matches} commit={commit} />
      <BankVouchersView actor={actor} s={s} matches={matches} inRange={inRange} commit={commit} />
      <section className="card mt-8"><div className="section-head"><div><h2>Partner capital movements</h2><p>Record money introduced by a partner or taken from the business.</p></div></div>
        <form className="partner-entry-form" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); const name = partner.trim(); const amount = Number(form.get("partnerAmount")); if (!name) { setPartnerError("Enter the partner name."); return; } if (!Number.isFinite(amount) || amount <= 0) { setPartnerError("Enter an amount greater than zero."); return; } const account = partnerAccounts.find(candidate => candidate.name === partnerMethod); const existing = partnerNames.find(value => value.toLowerCase() === name.toLowerCase()); commit({ ...s, partnerNames: existing ? s.partnerNames || [] : [...(s.partnerNames || []), name], partners: [...(s.partners || []), { id: uid(), date: String(form.get("partnerDate") || today()), partner: existing || name, kind: partnerKind, amount: round(amount), method: partnerMethod, financialAccountId: account?.id, notes: String(form.get("partnerNotes") || "").trim() }] }, `Partner ${partnerKind.toLowerCase()} recorded.`); setPartner(""); setPartnerError(""); event.currentTarget.reset(); setPartnerMethod("Cash"); setPartnerKind("Withdrawal"); }}>
          <div className="form-grid"><Field label="Partner"><div><input list="partner-names" value={partner} onChange={event => { setPartner(event.target.value); setPartnerError(""); }} placeholder="Partner name" required /><datalist id="partner-names">{partnerNames.map(name => <option key={name} value={name} />)}</datalist></div></Field><Field label="Movement"><GlassSelect value={partnerKind} onValueChange={value => setPartnerKind(value as typeof partnerKind)}><option>Contribution</option><option>Withdrawal</option></GlassSelect></Field><Field label="Cash / bank account"><GlassSelect value={partnerMethod} onValueChange={setPartnerMethod}><option>Cash</option>{partnerAccounts.map(account => <option key={account.id}>{account.name}</option>)}</GlassSelect></Field><Field label="Amount (PKR)"><input name="partnerAmount" type="number" min="0.01" step="0.01" required /></Field><Field label="Date"><input name="partnerDate" type="date" defaultValue={today()} required /></Field><Field label="Notes"><input name="partnerNotes" maxLength={500} /></Field></div>
          {partnerError && <p className="form-error" role="alert">{partnerError}</p>}<button className="primary" type="submit">Record {partnerKind.toLowerCase()}</button>
        </form>
        <Table headers={["Date", "Partner", "Movement", "Amount", "Cash / bank account", "Notes"]} rows={(s.partners || []).filter(entry => inRange(entry.date) && matches(entry.partner, entry.kind, entry.method, entry.notes)).slice().sort((a, b) => b.date.localeCompare(a.date)).map(entry => [entry.date, entry.partner, <Badge tone={entry.kind === "Contribution" ? "green" : "amber"}>{entry.kind}</Badge>, money(entry.amount), entry.method, entry.notes || "—"])} empty="No partner capital movements in this period" />
      </section>
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
          rows={[
            ...s.invoices
              .filter((t) => t.status !== "draft" && t.status !== "void" && t.paid > 0)
              .map((t) => ({
                date: t.date,
                contact: t.contactId ? cName(t.contactId) : [t.walkInName, t.walkInCompany, t.walkInPhone].filter(Boolean).join(" · ") || "Walk-in customer",
                reference: t.number,
                kind: "Customer",
                amount: t.paid,
                method: t.method,
                cheque: "",
                chequeStatus: undefined,
                paymentId: "",
                head: t.head,
              })),
            ...s.purchases
              .filter((t) => t.status !== "draft" && t.status !== "void" && t.paid > 0)
              .map((t) => ({
                date: t.date,
                contact: cName(t.contactId, true),
                reference: t.number,
                kind: "Supplier",
                amount: t.paid,
                method: t.method,
                cheque: "",
                chequeStatus: undefined,
                paymentId: "",
                head: t.head,
              })),
            ...s.payments.map((p) => ({
              date: p.date,
              contact: cName(p.contactId, p.kind === "Supplier"),
              reference:
                [...s.invoices, ...s.purchases].find((t) => t.id === p.tradeId)
                  ?.number || "",
              kind: p.kind,
              amount: p.amount,
              method: p.chequeStatus ? `Cheque ${p.chequeStatus}` : p.method,
              cheque: p.chequeNumber ? `${p.chequeNumber} · ${p.chequeBank} · due ${p.chequeDate}${p.clearedDate ? ` · cleared ${p.clearedDate}` : ""}` : "",
              chequeStatus: p.chequeStatus,
              paymentId: p.id,
              head: p.head,
            })),
            ...(s.partners || []).map((p) => ({
              date: p.date, contact: p.partner, reference: p.notes || "", kind: `Partner ${p.kind}`, amount: p.kind === "Contribution" ? p.amount : -p.amount,
              method: p.method, cheque: "", chequeStatus: undefined, paymentId: "", head: "Partner capital",
            })),
          ]
            .filter(
              (p) =>
                inRange(p.date) &&
                matches(p.contact, p.reference, p.kind, p.head, p.cheque, p.method),
            )
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((p) => [
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
      </section>
    </>
  );
}

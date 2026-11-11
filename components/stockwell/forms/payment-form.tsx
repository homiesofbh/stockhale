"use client";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { Field } from "@/components/stockwell/ui";
import {
  balance,
  contactBalance,
  money,
  unappliedCreditBalance,
  recordPayment,
  round,
  supplierPayableBalance,
  today,
  uid,
  type Store,
} from "@/lib/stockwell/model";
import { financialBalanceSnapshot } from "@/lib/stockwell/operations";
import { useServerCollection } from "@/lib/stockwell/use-server-collection";
import type { Dispatch, SetStateAction } from "react";
import { type FormEvent } from "react";
import { useState } from "react";
type Props = {
  submit: (e: FormEvent<HTMLFormElement>, fn: (data: FormData) => void) => void;
  commit: (next: Store, message: string) => void;
  s: Store;
  text: (f: FormData, key: string) => string;
  paymentKind: string;
  selectedContact: string;
  num: (f: FormData, key: string) => number;
  selectedTrade: string;
  setPaymentKind: Dispatch<SetStateAction<string>>;
  setSelectedContact: Dispatch<SetStateAction<string>>;
  setSelectedTrade: Dispatch<SetStateAction<string>>;
};
export function PaymentForm({
  submit,
  commit,
  s,
  text,
  paymentKind,
  selectedContact,
  num,
  selectedTrade,
  setPaymentKind,
  setSelectedContact,
  setSelectedTrade,
}: Props) {
  const [method, setMethod] = useState("Cash");
  const [advance, setAdvance] = useState(false);
  const [forwardCheque, setForwardCheque] = useState(false);
  const [existingChequeId, setExistingChequeId] = useState("");
  const [destinationKind, setDestinationKind] = useState<"Supplier" | "Partner">("Supplier");
  const [contactQuery, setContactQuery] = useState("");
  const [tradeQuery, setTradeQuery] = useState("");
  const [walkInQuery, setWalkInQuery] = useState("");
  const [chequeQuery, setChequeQuery] = useState("");
  const selectedContactId = selectedContact.startsWith("walkin:") ? "" : selectedContact;
  const contacts = useServerCollection<any>({ collection: paymentKind === "Customer" ? "customers" : "suppliers", module: paymentKind === "Customer" ? "Customers" : "Suppliers", query: contactQuery, pageSize: 15 });
  const trades = useServerCollection<any>({ collection: paymentKind === "Customer" ? "invoices" : "purchases", module: paymentKind === "Customer" ? "Billing" : "Purchases", query: tradeQuery, contactId: selectedContactId, noContactOnly: selectedContact.startsWith("walkin:"), postedOnly: true, unpaidOnly: true, pageSize: 15, enabled: !advance && !!selectedContact });
  const walkInTrades = useServerCollection<any>({ collection: "invoices", module: "Billing", query: walkInQuery, postedOnly: true, noContactOnly: true, unpaidOnly: true, pageSize: 10, enabled: paymentKind === "Customer" });
  const pendingCheques = useServerCollection<any>({ collection: "chequeRegister", module: "Payments", query: chequeQuery, status: "pending", forwardableOnly: true, pageSize: 10, enabled: forwardCheque && paymentKind === "Customer" });
  const receivedCustomerCheques = pendingCheques.records;
  const contactKind = paymentKind === "Customer" ? "Customer" : "Supplier";
  const unappliedForContact = selectedContactId ? unappliedCreditBalance(s, contactKind, selectedContactId) : 0;
  const negativeAdvanceTotal = selectedContactId
    ? s.payments.filter(p => p.kind === contactKind && p.contactId === selectedContactId && p.advance && !p.tradeId && p.amount < 0 && (!p.chequeStatus || p.chequeStatus === "cleared")).reduce((sum, p) => sum + Math.abs(p.amount), 0)
    : 0;
  const selectedTradeRecord = selectedTrade && paymentKind === "Customer" ? s.invoices.find(t => t.id === selectedTrade && t.contactId === selectedContactId) : undefined;
  const supplierRemainingPayable = selectedContactId ? supplierPayableBalance(s, selectedContactId) : 0;
  return (
    <form
      onSubmit={(e) =>
        submit(e, (f) => {
          if (forwardCheque && existingChequeId) {
            const source = s.payments.find((payment) => payment.id === existingChequeId);
            const destinationId = text(f, "destination");
            const destinationName = destinationKind === "Supplier" ? s.suppliers.find(c => c.id === destinationId)?.name || "" : destinationId;
            const alreadyForwarded = (s.crossCheques || []).some(crossCheque => crossCheque.sourcePaymentId === existingChequeId);
            if (!source || source.kind !== "Customer" || source.method !== "Cheque" || source.amount <= 0 || (source.chequeStatus || "pending") !== "pending" || source.clearedDate || alreadyForwarded || !destinationName) throw new Error("Select an unforwarded positive pending customer cheque and its destination.");
            commit({ ...s, crossCheques: [...(s.crossCheques || []), { id: uid(), sourcePaymentId: source.id, date: text(f, "date"), customerId: source.contactId, destinationKind, destinationId, destinationName, amount: Math.abs(source.amount), status: "pending", notes: text(f, "destinationNotes") }] }, "Existing customer cheque submitted for forwarding.");
            return;
          }
          const accountLevel = paymentKind === "Supplier" && !advance;
          const linkedTrade = (paymentKind === "Customer" ? s.invoices : s.purchases).find(t => t.id === selectedTrade);
          const amountDirection = advance ? 1 : accountLevel ? supplierRemainingPayable < 0 ? -1 : 1 : balance(s, linkedTrade!) < 0 ? -1 : 1;
          const payment = {
              id: uid(),
              date: text(f, "date"),
              kind: paymentKind as "Customer" | "Supplier",
              contactId: selectedContact.startsWith("walkin:") ? "" : selectedContact,
              tradeId: advance || accountLevel ? "" : text(f, "trade"),
              advance,
              accountLevel,
              amount: round(num(f, "amount")) * amountDirection,
              method: text(f, "method") as "Cash" | "Bank",
              head: text(f, "head"),
              notes: text(f, "notes"),
              chequeNumber: text(f, "chequeNumber"),
              chequeBank: text(f, "chequeBank"),
              chequeDate: text(f, "chequeDate"),
            };
          let next = recordPayment(s, payment);
          if (forwardCheque && paymentKind === "Customer" && method === "Cheque") {
            const destinationId = text(f, "destination");
            const destinationName = destinationKind === "Supplier"
              ? s.suppliers.find(c => c.id === destinationId)?.name || ""
              : destinationId;
            if (!destinationName) throw new Error("Select the supplier or enter the partner name receiving this cheque.");
            next = { ...next, crossCheques: [...(next.crossCheques || []), { id: uid(), sourcePaymentId: payment.id, date: payment.date, customerId: payment.contactId, destinationKind, destinationId, destinationName, amount: Math.abs(payment.amount), status: "pending", notes: text(f, "destinationNotes") }] };
          }
          const snapshot = financialBalanceSnapshot(next);
          next = { ...next, payments: next.payments.map(item => item.id === payment.id ? { ...item, balanceAfter: snapshot } : item) };
          commit(next, forwardCheque ? "Customer cheque recorded for submission." : "Payment recorded. Balance updated.");
        })
      }
    >
      <div className="form-grid">
        <Field label="Payment type">
          <GlassSelect
            value={paymentKind}
            onValueChange={(e) => {
              setPaymentKind(e);
              setSelectedContact("");
              setSelectedTrade("");
              setExistingChequeId("");
            }}
          >
            <option>Customer</option>
            <option>Supplier</option>
          </GlassSelect>
        </Field>
        <Field label={paymentKind}><div className="server-select-field">
          <GlassSelect
            value={selectedContact}
            onValueChange={(e) => {
              setSelectedContact(e);
              setSelectedTrade("");
            }}
          >
            <option value="">Select contact</option>
            {contacts.records.map(
              (c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ),
            )}
            {paymentKind === "Customer" && walkInTrades.records.map((t) => <option key={t.id} value={`walkin:${t.id}`}>Walk-in · {t.number} · {[t.walkInName, t.walkInCompany, t.walkInPhone].filter(Boolean).join(" / ") || "No details"}</option>)}
          </GlassSelect>
          <input type="search" aria-label={`Search ${paymentKind.toLowerCase()} contacts`} placeholder="Search contacts…" value={contactQuery} onChange={event => setContactQuery(event.target.value)} />
          <button type="button" className="secondary-button" disabled={contacts.page <= 1} onClick={() => contacts.setPage(contacts.page - 1)}>Previous contacts</button><span>{contacts.page}/{contacts.pageCount}</span><button type="button" className="secondary-button" disabled={contacts.page >= contacts.pageCount} onClick={() => contacts.setPage(contacts.page + 1)}>More contacts</button>
          {paymentKind === "Customer" && <><input type="search" aria-label="Search walk-in bills" placeholder="Search walk-in bills…" value={walkInQuery} onChange={event => setWalkInQuery(event.target.value)} /><button type="button" className="secondary-button" disabled={walkInTrades.page >= walkInTrades.pageCount} onClick={() => walkInTrades.setPage(walkInTrades.page + 1)}>More walk-ins</button></>}
        </div></Field>
        <label className="checkbox-row payment-advance-toggle"><input type="checkbox" checked={advance} onChange={e => { setAdvance(e.target.checked); setSelectedTrade(""); }} /> {paymentKind === "Supplier" ? "Supplier advance (prepayment beyond current payable)" : "Advance payment (not linked to a bill yet)"}</label>
        {advance && <p className="field-help payment-advance-help">
          {paymentKind === "Supplier"
            ? "A supplier advance is money paid now. It reduces cash or bank and appears as a credit on the supplier ledger until matched to a purchase."
            : "A customer advance is money received now. It increases cash or bank and appears as a credit on the customer ledger until matched to a sale."}
        </p>}
        {paymentKind === "Customer" && <Field label="Bill with a pending balance or credit"><div className="server-select-field">
          <GlassSelect
            name="trade"
            required={!advance}
            value={selectedTrade}
            onValueChange={(e) => setSelectedTrade(e)}
          >
            <option value="">{advance ? "No bill — unapplied advance" : "Select transaction"}</option>
            {trades.records.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.number} · {money(Math.abs(balance(s, t)))}{" "}
                  {balance(s, t) < 0 ? "return credit" : "due"}
                </option>
              ))}
          </GlassSelect>
          <input type="search" aria-label="Search bills" placeholder="Search bills…" value={tradeQuery} onChange={event => setTradeQuery(event.target.value)} />
          <button type="button" className="secondary-button" disabled={trades.page <= 1} onClick={() => trades.setPage(trades.page - 1)}>Previous bills</button><span>{trades.page}/{trades.pageCount}</span><button type="button" className="secondary-button" disabled={trades.page >= trades.pageCount} onClick={() => trades.setPage(trades.page + 1)}>More bills</button>
        </div></Field>}
        {paymentKind === "Supplier" && !advance && <div className="payment-balance-summary" aria-live="polite"><div>
          <span>{supplierRemainingPayable < 0 ? "Supplier credit to collect" : "Remaining payable for this supplier"}</span>
          <strong>{money(Math.abs(supplierRemainingPayable))}</strong>
          <p className="field-help">{selectedContactId ? supplierRemainingPayable < 0 ? "This supplier owes you a credit. The amount entered will be recorded as money received." : "This is the maximum you can pay now. Pending supplier cheques and forwarded customer cheques are deducted." : "Select a supplier to see the amount due across the whole account."}</p>
        </div></div>}
        {negativeAdvanceTotal > 0 && <p className="field-help payment-match-warning payment-sign-warning">This contact has {money(negativeAdvanceTotal)} in older advances recorded with a negative sign. New advances are validated as positive amounts; review and correct these legacy entries before relying on the balance.</p>}
        {paymentKind === "Customer" && !advance && selectedTradeRecord && <div className="payment-balance-summary" aria-live="polite">
          <div><span>This bill’s remaining balance</span><strong>{money(Math.abs(balance(s, selectedTradeRecord)))}</strong></div>
          {selectedContactId && <div><span>Overall contact balance</span><strong>{money(Math.abs(contactBalance(s, contactKind, selectedContactId)))} {contactBalance(s, contactKind, selectedContactId) < 0 ? "net credit" : "net due"}</strong></div>}
          {unappliedForContact > 0 && <div><span>Unapplied credits</span><strong>{money(unappliedForContact)}</strong></div>}
        </div>}
        {paymentKind === "Customer" && !advance && unappliedForContact > 0 && <p className="field-help payment-match-warning">{money(unappliedForContact)} in credits is already reducing this contact’s net balance. These credits are not attached to this bill, so the bill balance above remains unchanged. Check before recording another payment to avoid paying twice.</p>}
        <Field label={paymentKind === "Supplier" ? "Amount to settle (PKR)" : "Amount (PKR)"}>
          <input name="amount" type="number" step="0.01" min="0.01" max={paymentKind === "Supplier" && !advance ? Math.abs(supplierRemainingPayable) : undefined} disabled={paymentKind === "Supplier" && !advance && (!selectedContactId || supplierRemainingPayable === 0)} required />
        </Field>
        <Field label="Date">
          <input type="date" name="date" required defaultValue={today()} />
        </Field>
        <Field label="Payment method">
          <GlassSelect name="method" value={method} onValueChange={setMethod}>
            <option>Cash</option>
            {(s.financialAccounts || []).filter(a => a.active !== false).map((account) => <option key={account.id}>{account.name}</option>)}
            <option>Cheque</option>
          </GlassSelect>
        </Field>
        {method === "Cheque" && <>
          <Field label="Cheque number"><input name="chequeNumber" required maxLength={80} /></Field>
          <Field label="Cheque bank"><input name="chequeBank" required maxLength={120} /></Field>
          <Field label="Expected clearance date"><input name="chequeDate" type="date" required /></Field>
          {paymentKind === "Customer" && <>
            <label className="checkbox-row"><input type="checkbox" checked={forwardCheque} onChange={e => setForwardCheque(e.target.checked)} /> Submit this cheque to a supplier or partner</label>
            {forwardCheque && <>
              <Field label="Received customer cheque (optional)"><div className="server-select-field"><GlassSelect value={existingChequeId} onValueChange={setExistingChequeId}><option value="">Forward the new cheque being recorded</option>{receivedCustomerCheques.map(payment => <option key={payment.id} value={payment.id}>{payment.chequeNumber} · {payment.chequeBank} · {money(Math.abs(payment.amount))}</option>)}</GlassSelect><input type="search" aria-label="Search pending cheques" placeholder="Search pending cheques…" value={chequeQuery} onChange={event => setChequeQuery(event.target.value)} /><button type="button" className="secondary-button" disabled={pendingCheques.page >= pendingCheques.pageCount} onClick={() => pendingCheques.setPage(pendingCheques.page + 1)}>More cheques</button></div></Field>
              <Field label="Submit to"><GlassSelect name="destinationKind" value={destinationKind} onValueChange={value => setDestinationKind(value as typeof destinationKind)}><option>Supplier</option><option>Partner</option></GlassSelect></Field>
              {destinationKind === "Supplier" ? <Field label="Supplier"><GlassSelect name="destination"><option value="">Select supplier</option>{s.suppliers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</GlassSelect></Field> : <Field label="Partner name"><input name="destination" placeholder="Partner name" required /></Field>}
              <Field label="Submission notes"><input name="destinationNotes" /></Field>
            </>}
          </>}
        </>}
        <Field label="Account head">
          <GlassSelect
            name="head"
            key={paymentKind}
            defaultValue={
              paymentKind === "Customer"
                ? "Customer payments"
                : "Supplier payments"
            }
          >
            {s.heads.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </GlassSelect>
        </Field>
        <Field label="Notes">
          <input name="notes" />
        </Field>
      </div>
      <p className="form-hint">
        {paymentKind === "Supplier" && !advance
          ? "Supplier payments are recorded against the whole account, with the amount capped at the remaining payable. Individual purchase bills stay available in the supplier ledger. Cheques remain pending until cleared."
          : "Selecting a return credit records a customer refund or money received back from a supplier. Enter a positive amount; StockHale applies the correct direction. Cheque payments stay pending until marked cleared in Payments."}
      </p>
      <div className="form-foot">
        <button className="primary">Record payment</button>
      </div>
    </form>
  );
}

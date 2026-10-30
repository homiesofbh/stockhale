"use client";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { Field } from "@/components/stockwell/ui";
import {
  balance,
  compareTradeNumbersNewestFirst,
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
  const receivedCustomerCheques = s.payments.filter((payment) => payment.kind === "Customer" && payment.method === "Cheque" && payment.amount > 0 && (payment.chequeStatus || "pending") === "pending" && !(s.crossCheques || []).some((crossCheque) => crossCheque.sourcePaymentId === payment.id));
  const selectedContactId = selectedContact.startsWith("walkin:") ? "" : selectedContact;
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
            if (!source || source.kind !== "Customer" || source.method !== "Cheque" || !destinationName) throw new Error("Select an unforwarded pending customer cheque and its destination.");
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
        <Field label={paymentKind}>
          <GlassSelect
            value={selectedContact}
            onValueChange={(e) => {
              setSelectedContact(e);
              setSelectedTrade("");
            }}
          >
            <option value="">Select contact</option>
            {(paymentKind === "Customer" ? s.customers : s.suppliers).map(
              (c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ),
            )}
            {paymentKind === "Customer" && s.invoices.filter((t) => !t.contactId && balance(s, t) !== 0).slice().sort(compareTradeNumbersNewestFirst).map((t) => <option key={t.id} value={`walkin:${t.id}`}>Walk-in · {t.number} · {[t.walkInName, t.walkInCompany, t.walkInPhone].filter(Boolean).join(" / ") || "No details"}</option>)}
          </GlassSelect>
        </Field>
        <label className="checkbox-row payment-advance-toggle"><input type="checkbox" checked={advance} onChange={e => { setAdvance(e.target.checked); setSelectedTrade(""); }} /> {paymentKind === "Supplier" ? "Supplier advance (prepayment beyond current payable)" : "Advance payment (not linked to a bill yet)"}</label>
        {advance && <p className="field-help payment-advance-help">
          {paymentKind === "Supplier"
            ? "A supplier advance is money paid now. It reduces cash or bank and appears as a credit on the supplier ledger until matched to a purchase."
            : "A customer advance is money received now. It increases cash or bank and appears as a credit on the customer ledger until matched to a sale."}
        </p>}
        {paymentKind === "Customer" && <Field label="Bill with a pending balance or credit">
          <GlassSelect
            name="trade"
            required={!advance}
            value={selectedTrade}
            onValueChange={(e) => setSelectedTrade(e)}
          >
            <option value="">{advance ? "No bill — unapplied advance" : "Select transaction"}</option>
            {(paymentKind === "Customer" ? s.invoices : s.purchases)
              .filter(
                (t) => (selectedContact.startsWith("walkin:") ? `walkin:${t.id}` === selectedContact : t.contactId === selectedContact) && balance(s, t) !== 0,
              )
              .slice()
              .sort(compareTradeNumbersNewestFirst)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.number} · {money(Math.abs(balance(s, t)))}{" "}
                  {balance(s, t) < 0 ? "return credit" : "due"}
                </option>
              ))}
          </GlassSelect>
        </Field>}
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
              <Field label="Received customer cheque (optional)"><GlassSelect value={existingChequeId} onValueChange={setExistingChequeId}><option value="">Forward the new cheque being recorded</option>{receivedCustomerCheques.map(payment => <option key={payment.id} value={payment.id}>{payment.chequeNumber} · {payment.chequeBank} · {money(Math.abs(payment.amount))}</option>)}</GlassSelect></Field>
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

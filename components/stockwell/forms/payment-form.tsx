"use client";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { Field } from "@/components/stockwell/ui";
import {
  balance,
  money,
  recordPayment,
  round,
  today,
  uid,
  type Store,
} from "@/lib/stockwell/model";
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
  const [destinationKind, setDestinationKind] = useState<"Supplier" | "Partner">("Supplier");
  return (
    <form
      onSubmit={(e) =>
        submit(e, (f) => {
          const payment = {
              id: uid(),
              date: text(f, "date"),
              kind: paymentKind as "Customer" | "Supplier",
              contactId: selectedContact.startsWith("walkin:") ? "" : selectedContact,
              tradeId: advance ? "" : text(f, "trade"),
              advance,
              amount:
                round(num(f, "amount")) *
                (advance
                  ? paymentKind === "Customer" ? 1 : -1
                  : balance(
                      s,
                      (paymentKind === "Customer" ? s.invoices : s.purchases).find(
                        (t) => t.id === selectedTrade,
                      )!,
                    ) < 0 ? -1 : 1),
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
            {paymentKind === "Customer" && s.invoices.filter((t) => !t.contactId && balance(s, t) !== 0).map((t) => <option key={t.id} value={`walkin:${t.id}`}>Walk-in · {t.number} · {[t.walkInName, t.walkInCompany, t.walkInPhone].filter(Boolean).join(" / ") || "No details"}</option>)}
          </GlassSelect>
        </Field>
        <label className="checkbox-row payment-advance-toggle"><input type="checkbox" checked={advance} onChange={e => { setAdvance(e.target.checked); setSelectedTrade(""); }} /> Advance payment (not linked to a bill yet)</label>
        <Field label="Bill / purchase with a pending balance or credit">
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
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.number} · {money(Math.abs(balance(s, t)))}{" "}
                  {balance(s, t) < 0 ? "return credit" : "due"}
                </option>
              ))}
          </GlassSelect>
        </Field>
        <Field label="Amount (PKR)">
          <input name="amount" type="number" step="0.01" min="0.01" required />
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
        Selecting a return credit records a customer refund or money received
        back from a supplier. Enter a positive amount; StockHale applies the
        correct direction. Cheque payments stay pending until marked cleared in Payments.
      </p>
      <div className="form-foot">
        <button className="primary">Record payment</button>
      </div>
    </form>
  );
}

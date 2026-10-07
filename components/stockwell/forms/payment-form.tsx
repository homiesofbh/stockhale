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
  return (
    <form
      onSubmit={(e) =>
        submit(e, (f) =>
          commit(
            recordPayment(s, {
              id: uid(),
              date: text(f, "date"),
              kind: paymentKind as "Customer" | "Supplier",
              contactId: selectedContact,
              tradeId: text(f, "trade"),
              amount:
                round(num(f, "amount")) *
                (balance(
                  s,
                  (paymentKind === "Customer" ? s.invoices : s.purchases).find(
                    (t) => t.id === selectedTrade,
                  )!,
                ) < 0
                  ? -1
                  : 1),
              method: text(f, "method") as "Cash" | "Bank",
              head: text(f, "head"),
              notes: text(f, "notes"),
            }),
            "Payment recorded. Balance updated.",
          ),
        )
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
            required
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
          </GlassSelect>
        </Field>
        <Field label="Bill / purchase with a pending balance or credit">
          <GlassSelect
            name="trade"
            required
            value={selectedTrade}
            onValueChange={(e) => setSelectedTrade(e)}
          >
            <option value="">Select transaction</option>
            {(paymentKind === "Customer" ? s.invoices : s.purchases)
              .filter(
                (t) => t.contactId === selectedContact && balance(s, t) !== 0,
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
          <GlassSelect name="method">
            <option>Cash</option>
            <option>Bank</option>
          </GlassSelect>
        </Field>
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
        correct direction.
      </p>
      <div className="form-foot">
        <button className="primary">Record payment</button>
      </div>
    </form>
  );
}

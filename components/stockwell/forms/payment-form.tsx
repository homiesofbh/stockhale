"use client";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { Field } from "@/components/stockwell/ui";
import {
  balance,
  compareTradeNumbersNewestFirst,
  contactBalance,
  isPosted,
  money,
  unappliedCreditBalance,
  supplierPayableBalance,
  recordPayment,
  round,
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
  setPaymentKind,
  setSelectedContact,
  setSelectedTrade,
}: Props) {
  const [method, setMethod] = useState("Cash");
  const [advance, setAdvance] = useState(false);
  const [forwardCheque, setForwardCheque] = useState(false);
  const [existingChequeId, setExistingChequeId] = useState("");
  const [destinationKind, setDestinationKind] = useState<"Supplier" | "Partner">("Supplier");
  const [destinationId, setDestinationId] = useState("");
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
  const [selectedForwardBillIds, setSelectedForwardBillIds] = useState<string[]>([]);
  const [supplierAccountLevel, setSupplierAccountLevel] = useState(false);
  const receivedCustomerCheques = s.payments.filter((payment) =>
    payment.kind === "Customer" && payment.method === "Cheque" && payment.amount > 0 &&
    (payment.chequeStatus || "pending") === "pending" &&
    !(s.crossCheques || []).some((crossCheque) => crossCheque.sourcePaymentId === payment.id),
  );
  const selectedContactId = selectedContact.startsWith("walkin:") ? "" : selectedContact;
  const walkInCustomer = paymentKind === "Customer" && selectedContact.startsWith("walkin:");
  const customerLedgerPayment = paymentKind === "Customer" && !!selectedContactId;
  const contactKind = paymentKind === "Customer" ? "Customer" : "Supplier";
  const unappliedForContact = selectedContactId
    ? unappliedCreditBalance(s, contactKind, selectedContactId)
    : 0;
  const negativeAdvanceTotal = selectedContactId
    ? s.payments
        .filter((payment) => payment.kind === contactKind && payment.contactId === selectedContactId && payment.advance && !payment.tradeId && payment.amount < 0 && (!payment.chequeStatus || payment.chequeStatus === "cleared"))
        .reduce((sum, payment) => sum + Math.abs(payment.amount), 0)
    : 0;
  const supplierRemainingPayable = selectedContactId
    ? supplierPayableBalance(s, selectedContactId)
    : 0;
  const eligibleBills = (paymentKind === "Customer" ? s.invoices : s.purchases)
    .filter(trade => isPosted(trade) && (walkInCustomer ? `walkin:${trade.id}` === selectedContact : trade.contactId === selectedContactId) && balance(s, trade) > 0)
    .slice().sort(compareTradeNumbersNewestFirst);
  const billAvailable = (tradeId: string) => {
    const trade = (paymentKind === "Customer" ? s.invoices : s.purchases).find(item => item.id === tradeId);
    if (!trade) return 0;
    const pendingPayments = s.payments.filter(payment => payment.chequeStatus === "pending" && (payment.tradeId === tradeId || payment.allocations?.some(allocation => allocation.tradeId === tradeId)))
      .reduce((sum, payment) => sum + (payment.allocations?.find(allocation => allocation.tradeId === tradeId)?.amount || (payment.tradeId === tradeId ? Math.abs(payment.amount) : 0)), 0);
    const pendingForwarded = (s.crossCheques || []).filter(cheque => cheque.destinationKind === "Supplier" && cheque.destinationId === trade.contactId && ["pending", "submitted"].includes(cheque.status))
      .reduce((sum, cheque) => sum + (cheque.allocations || []).filter(allocation => allocation.tradeId === tradeId).reduce((n, allocation) => n + allocation.amount, 0), 0);
    return Math.max(0, round(balance(s, trade) - pendingPayments - pendingForwarded));
  };
  const selectedBillTotal = round(selectedBillIds.reduce((sum, id) => sum + billAvailable(id), 0));
  const customerRemainingForPayment = selectedBillTotal;
  return (
    <form
      onSubmit={(e) =>
        submit(e, (f) => {
          if (forwardCheque) {
            const sourcePayment = s.payments.find((payment) => payment.id === existingChequeId);
            if (!sourcePayment || sourcePayment.kind !== "Customer" || sourcePayment.method !== "Cheque" || sourcePayment.amount <= 0 || (sourcePayment.chequeStatus || "pending") !== "pending" || (s.crossCheques || []).some((crossCheque) => crossCheque.sourcePaymentId === sourcePayment.id)) {
              throw new Error("Select an unforwarded pending customer cheque.");
            }
            const destinationId = text(f, "destination");
            const destinationName = destinationKind === "Supplier"
              ? s.suppliers.find(c => c.id === destinationId)?.name || ""
              : destinationId;
            if (!destinationName) throw new Error("Select the supplier or enter the partner name receiving this cheque.");
            const allocations: { tradeId: string; amount: number }[] = [];
            if (destinationKind === "Supplier") {
              let remaining = round(Math.abs(sourcePayment.amount));
              for (const tradeId of selectedForwardBillIds) {
                const trade = s.purchases.find(item => item.id === tradeId && item.contactId === destinationId && isPosted(item));
                if (!trade) continue;
                const pendingPayments = s.payments.filter(payment => payment.chequeStatus === "pending" && (payment.tradeId === tradeId || payment.allocations?.some(allocation => allocation.tradeId === tradeId)))
                  .reduce((sum, payment) => sum + (payment.allocations?.find(allocation => allocation.tradeId === tradeId)?.amount || (payment.tradeId === tradeId ? Math.abs(payment.amount) : 0)), 0);
                const pendingForwarded = (s.crossCheques || []).filter(cheque => cheque.destinationKind === "Supplier" && cheque.destinationId === destinationId && ["pending", "submitted"].includes(cheque.status))
                  .reduce((sum, cheque) => sum + (cheque.allocations || []).filter(allocation => allocation.tradeId === tradeId).reduce((n, allocation) => n + allocation.amount, 0), 0);
                const available = Math.max(0, round(balance(s, trade) - pendingPayments - pendingForwarded));
                const amount = round(Math.min(remaining, available));
                if (amount > 0) { allocations.push({ tradeId, amount }); remaining = round(remaining - amount); }
              }
              if (selectedForwardBillIds.length && !allocations.length) throw new Error("The selected purchase bills no longer have an available balance for this cheque.");
            }
            const next = {
              ...s,
              crossCheques: [...(s.crossCheques || []), {
                id: uid(),
                sourcePaymentId: sourcePayment.id,
                date: text(f, "date"),
                customerId: sourcePayment.contactId,
                destinationKind,
                destinationId,
                destinationName,
                amount: Math.abs(sourcePayment.amount),
                allocations,
                status: "pending" as const,
                notes: text(f, "destinationNotes"),
              }],
            };
            commit(next, allocations.length ? `Customer cheque submitted to ${destinationName} and allocated across ${allocations.length} purchase bill${allocations.length === 1 ? "" : "s"}.` : "Existing customer cheque submitted for forwarding.");
            return;
          }
          if (!selectedContact) throw new Error(`Select a ${paymentKind.toLowerCase()} before recording this payment.`);
          const accountLevel = paymentKind === "Supplier" && !advance && supplierAccountLevel;
          const useAdvance = advance;
          if ((useAdvance || accountLevel) && !selectedContactId) throw new Error("Select a saved customer or supplier for an account payment or advance.");
          if (!useAdvance && !accountLevel && !selectedBillIds.length) throw new Error("Select one or more unpaid bills before recording this payment.");
          const selectedBills = selectedBillIds.map(id => (paymentKind === "Customer" ? s.invoices : s.purchases).find(trade => trade.id === id)).filter((trade): trade is NonNullable<typeof trade> => !!trade);
          if (!useAdvance && !accountLevel && selectedBills.length !== selectedBillIds.length) throw new Error("One or more selected bills are no longer available. Refresh and select bills again.");
          const requestedAmount = round(num(f, "amount"));
          let remaining = requestedAmount;
          const allocations = selectedBills.map(trade => {
            const portion = round(Math.min(remaining, billAvailable(trade.id)));
            remaining = round(remaining - portion);
            return { tradeId: trade.id, amount: portion };
          }).filter(allocation => allocation.amount > 0);
          if (!useAdvance && !accountLevel && remaining > 0) throw new Error("The amount exceeds the selected bills’ available balances. Reduce the amount or select more bills.");
          if (!useAdvance && !accountLevel && !allocations.length) throw new Error("The selected bills have no remaining balance.");
          const linkedTrade = selectedBills[0];
          const amountDirection = useAdvance
            ? 1
            : accountLevel
              ? supplierRemainingPayable < 0 ? -1 : 1
              : 1;
          const payment = {
              id: uid(),
              date: text(f, "date"),
              kind: paymentKind as "Customer" | "Supplier",
              contactId: selectedContact.startsWith("walkin:") ? linkedTrade?.contactId || "" : selectedContact,
              tradeId: "",
              allocations: !useAdvance && !accountLevel ? allocations : undefined,
              advance: useAdvance,
              accountLevel,
              amount: round((allocations.reduce((sum, allocation) => sum + allocation.amount, 0) || requestedAmount) * amountDirection),
              method: text(f, "method") as "Cash" | "Bank",
              head: text(f, "head"),
              notes: text(f, "notes"),
              chequeNumber: text(f, "chequeNumber"),
              chequeBank: text(f, "chequeBank"),
              chequeDate: text(f, "chequeDate"),
            };
          const recorded = recordPayment(s, payment);
          const savedPayment = recorded.payments.at(-1)!;
          const snapshot = financialBalanceSnapshot(recorded);
          const next = { ...recorded, payments: recorded.payments.map(item => item.id === savedPayment.id ? { ...item, balanceAfter: snapshot } : item) };
          commit(next, "Payment recorded. Balance updated.");
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
              setSelectedBillIds([]);
              setAdvance(false);
              setForwardCheque(false);
              setExistingChequeId("");
              setSupplierAccountLevel(false);
            }}
          >
            <option>Customer</option>
            <option>Supplier</option>
          </GlassSelect>
        </Field>
        {!forwardCheque && <Field label={`${paymentKind} (required)`}>
          <GlassSelect searchable searchPlaceholder={`Search ${paymentKind.toLowerCase()}s…`}
            value={selectedContact}
            aria-required={true}
            onValueChange={(e) => {
              setSelectedContact(e);
              setSelectedTrade("");
              setSelectedBillIds([]);
              setAdvance(false);
              setSupplierAccountLevel(false);
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
        </Field>}
        <label className="checkbox-row payment-advance-toggle"><input type="checkbox" checked={forwardCheque} onChange={e => { setForwardCheque(e.target.checked); setExistingChequeId(""); setDestinationId(""); setSelectedBillIds([]); setSelectedForwardBillIds([]); setSupplierAccountLevel(false); setSelectedTrade(""); }} /> {paymentKind === "Supplier" ? "Pay supplier with a received customer cheque" : "Forward an existing received customer cheque"}</label>
        {forwardCheque ? <>
          <Field label="Received customer cheque">
            <div>
              <GlassSelect name="existingCheque" searchable searchPlaceholder="Search cheque number or customer…" required value={existingChequeId} onValueChange={value => { setExistingChequeId(value); setSelectedForwardBillIds([]); }}>
                <option value="">Select received cheque</option>
                {receivedCustomerCheques.map((payment) => <option key={payment.id} value={payment.id}>
                  {payment.chequeNumber} · {payment.chequeBank} · {money(Math.abs(payment.amount))} · {s.customers.find(c => c.id === payment.contactId)?.name || "Walk-in customer"}
                </option>)}
              </GlassSelect>
              {!receivedCustomerCheques.length && <p className="field-help">No unforwarded pending customer cheques are available.</p>}
            </div>
          </Field>
          <Field label="Submission date"><input name="date" type="date" required defaultValue={today()} /></Field>
        </> : <>
        {paymentKind === "Supplier" && <>
          <label className="checkbox-row payment-advance-toggle"><input type="checkbox" checked={advance} onChange={e => { setAdvance(e.target.checked); setSupplierAccountLevel(false); setSelectedBillIds([]); setSelectedTrade(""); }} /> Supplier advance (prepayment beyond current payable)</label>
          <label className="checkbox-row payment-advance-toggle"><input type="checkbox" checked={supplierAccountLevel} onChange={e => { setSupplierAccountLevel(e.target.checked); setSelectedBillIds([]); setAdvance(false); setSelectedTrade(""); }} /> Record on supplier account without allocating to bills</label>
        </>}
        {paymentKind === "Customer" && customerLedgerPayment && <label className="checkbox-row payment-advance-toggle"><input type="checkbox" checked={advance} onChange={e => { setAdvance(e.target.checked); setSelectedBillIds([]); setSelectedTrade(""); }} /> Customer advance (not linked to a bill)</label>}
        {advance && <p className="field-help payment-advance-help">
          {paymentKind === "Supplier"
            ? "A supplier advance is money paid now. It reduces cash or bank and appears as a credit on the supplier ledger until matched to a purchase."
            : "A customer advance is money received now. It increases cash or bank and appears as a credit on the customer ledger until matched to a sale."}
        </p>}
        {!forwardCheque && !advance && !supplierAccountLevel && <div className="payment-bill-picker">
          <span className="field-label">Unpaid or partially paid bills · select one or more</span>
          {!eligibleBills.length ? <p className="field-help">No unpaid bills are available for this contact.</p> : eligibleBills.map(trade => <label className="checkbox-row" key={trade.id}>
            <input type="checkbox" checked={selectedBillIds.includes(trade.id)} onChange={event => setSelectedBillIds(current => event.target.checked ? [...current, trade.id] : current.filter(id => id !== trade.id))} />
            <span>{trade.number} · {money(billAvailable(trade.id))} due</span>
          </label>)}
          {!!selectedBillIds.length && <p className="field-help">Selected bill balances: {money(selectedBillTotal)}. The payment is allocated in the order shown.</p>}
        </div>}
        {paymentKind === "Supplier" && !advance && (
          <div className="payment-balance-summary" aria-live="polite">
            <div>
              <span>{supplierRemainingPayable < 0 ? "Supplier credit to collect" : "Remaining payable for this supplier"}</span>
              <strong>{money(Math.abs(supplierRemainingPayable))}</strong>
              <p className="field-help">{selectedContactId
                ? supplierRemainingPayable < 0
                  ? "This supplier owes you a credit. The amount entered will be recorded as money received."
                  : "This is the maximum you can pay now. Pending supplier cheques and forwarded customer cheques are deducted."
                : "Select a supplier to see the amount due across the whole account."}</p>
            </div>
          </div>
        )}
        {negativeAdvanceTotal > 0 && (
          <p className="field-help payment-match-warning payment-sign-warning">
            This contact has {money(negativeAdvanceTotal)} in older advances recorded with a negative sign. New advances are validated as positive amounts; review and correct these legacy entries before relying on the balance.
          </p>
        )}
        {customerLedgerPayment && !advance && (
          <div className="payment-balance-summary" aria-live="polite">
            <div><span>Customer ledger balance</span><strong>{money(Math.abs(contactBalance(s, "Customer", selectedContactId)))} {contactBalance(s, "Customer", selectedContactId) < 0 ? "net credit" : "net due"}</strong></div>
          </div>
        )}
        {walkInCustomer && selectedBillIds.length > 0 && (
          <div className="payment-balance-summary" aria-live="polite">
            <div><span>Selected walk-in bill balances</span><strong>{money(selectedBillTotal)}</strong></div>
            {unappliedForContact > 0 && <div><span>Unapplied credits</span><strong>{money(unappliedForContact)}</strong></div>}
          </div>
        )}
        <Field label={paymentKind === "Supplier" ? "Amount to settle (PKR)" : "Amount (PKR)"}>
          <input name="amount" type="number" step="0.01" min="0.01" max={paymentKind === "Supplier" && !advance && supplierAccountLevel ? Math.abs(supplierRemainingPayable) : !advance && !supplierAccountLevel ? customerRemainingForPayment : undefined} disabled={!advance && !supplierAccountLevel && customerRemainingForPayment === 0 || paymentKind === "Supplier" && supplierAccountLevel && (!selectedContactId || supplierRemainingPayable === 0)} required />
        </Field>
        <Field label="Date">
          <input type="date" name="date" required defaultValue={today()} />
        </Field>
        <Field label="Payment method">
          <GlassSelect name="method" value={method} onValueChange={setMethod} required>
            <option>Cash</option>
            {(s.financialAccounts || []).filter(a => a.active !== false).map((account) => <option key={account.id}>{account.name}</option>)}
            <option>Cheque</option>
          </GlassSelect>
        </Field>
        {method === "Cheque" && <>
          <Field label="Cheque number"><input name="chequeNumber" required maxLength={80} /></Field>
          <Field label="Cheque bank"><input name="chequeBank" required maxLength={120} /></Field>
          <Field label="Expected clearance date"><input name="chequeDate" type="date" required /></Field>
        </>}
        <Field label="Account head">
          <GlassSelect
            name="head"
            required
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
        </>}
        {forwardCheque && <>
          <Field label="Submit to"><GlassSelect name="destinationKind" value={destinationKind} onValueChange={value => setDestinationKind(value as typeof destinationKind)}><option>Supplier</option><option>Partner</option></GlassSelect></Field>
          {destinationKind === "Supplier" ? <>
            <Field label="Supplier"><GlassSelect name="destination" required value={destinationId} onValueChange={value => { setDestinationId(value); setSelectedForwardBillIds([]); }}><option value="">Select supplier</option>{s.suppliers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</GlassSelect></Field>
            {!!destinationId && <div className="payment-bill-picker"><span className="field-label">Unpaid or partially paid purchase bills · select one or more</span>
              {s.purchases.filter(trade => trade.contactId === destinationId && isPosted(trade) && billAvailable(trade.id) > 0).slice().sort(compareTradeNumbersNewestFirst).map(trade => <label className="checkbox-row" key={trade.id}><input type="checkbox" checked={selectedForwardBillIds.includes(trade.id)} onChange={event => setSelectedForwardBillIds(current => event.target.checked ? [...current, trade.id] : current.filter(id => id !== trade.id))} /><span>{trade.number} · {money(billAvailable(trade.id))} due</span></label>)}
              <p className="field-help">The cheque is allocated in selection order. Any amount left after the selected bills is recorded as supplier credit when the cheque clears.</p>
            </div>}
          </> : <Field label="Partner name"><input name="destination" placeholder="Partner name" required /></Field>}
          <Field label="Submission notes"><input name="destinationNotes" /></Field>
        </>}
      </div>
      <p className="form-hint">
        {forwardCheque
          ? "Select a received pending customer cheque. Its customer, cheque details, and amount are reused; no duplicate payment is created."
          : paymentKind === "Customer" && advance
            ? "This payment is recorded on the customer's account without reducing an individual bill."
          : paymentKind === "Customer"
              ? "This payment is allocated across the selected bills. Each bill’s paid amount and remaining balance update in Billing."
          : paymentKind === "Supplier" && !advance
            ? supplierAccountLevel ? "This payment is recorded against the supplier account without bill allocations." : "This payment is allocated across the selected purchase bills. Cheques remain pending until cleared."
            : "Selecting a return credit records a customer refund or money received back from a supplier. Enter a positive amount; Sialkot Fabrics applies the correct direction. Cheque payments stay pending until marked cleared in Payments."}
      </p>
      <div className="form-foot">
        <button className="primary">{forwardCheque ? "Submit existing cheque" : "Record payment"}</button>
      </div>
    </form>
  );
}

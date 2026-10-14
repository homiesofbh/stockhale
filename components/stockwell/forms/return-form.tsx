"use client";
import { BarcodeInput } from "@/components/stockwell/barcode-input";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { Field } from "@/components/stockwell/ui";
import { balance, findProductByCode, isPosted, money, paid, recordPayment, recordReturn, roundQty, subtotal, today, total, uid, type Store } from "@/lib/stockwell/model";
import type { Dispatch, SetStateAction } from "react";
import { useState, type FormEvent } from "react";

type Props = {
  submit: (e: FormEvent<HTMLFormElement>, fn: (data: FormData) => void) => void;
  commit: (next: Store, message: string) => void;
  s: Store;
  text: (f: FormData, key: string) => string;
  returnKind: string;
  selectedTrade: string;
  setReturnKind: Dispatch<SetStateAction<string>>;
  setSelectedTrade: Dispatch<SetStateAction<string>>;
};

type RefundMode = "Refund payment" | "Adjust in ledger";
type ReturnLineDraft = { id: string; productId: string; qty: string };

export function ReturnForm({
  submit,
  commit,
  s,
  text,
  returnKind,
  selectedTrade,
  setReturnKind,
  setSelectedTrade,
}: Props) {
  const [returnLines, setReturnLines] = useState<ReturnLineDraft[]>([
    { id: uid(), productId: "", qty: "" },
  ]);
  const [scan, setScan] = useState("");
  const [scanError, setScanError] = useState("");
  const [refundMode, setRefundMode] = useState<RefundMode>("Refund payment");

  const trades = returnKind === "Sales return" ? s.invoices : s.purchases;
  const selectedOriginal = trades.find((t) => t.id === selectedTrade);
  const eligible = s.products.filter((p) => {
    if (returnKind === "Damaged stock") return true;
    if (!selectedOriginal) return false;
    const originalQty = selectedOriginal.lines
      .filter((line) => line.productId === p.id)
      .reduce((sum, line) => sum + line.qty, 0);
    const returnedQty = s.returns
      .filter((entry) => entry.tradeId === selectedTrade && entry.productId === p.id)
      .reduce((sum, entry) => sum + entry.qty, 0);
    return originalQty > roundQty(returnedQty);
  });
  const selectedLineProducts = new Set(returnLines.map((line) => line.productId).filter(Boolean));
  const availableProducts = (lineProductId: string) =>
    eligible.filter((p) => p.id === lineProductId || !selectedLineProducts.has(p.id));
  const originalParty = selectedOriginal?.contactId
    ? (returnKind === "Sales return" ? s.customers : s.suppliers).find((contact) => contact.id === selectedOriginal.contactId)?.name
    : "Walk-in customer";
  const hasLinkedParty = returnKind !== "Damaged stock" && !!selectedOriginal?.contactId;

  function scanProduct(code = scan) {
    try {
      const match = findProductByCode(s.products, code);
      if (!eligible.some((p) => p.id === match.id))
        throw new Error("Select an original transaction containing this product first.");
      if (returnLines.some((line) => line.productId === match.id)) {
        throw new Error("This product is already added to the return.");
      }
      setReturnLines((lines) => {
        const empty = lines.find((line) => !line.productId);
        return empty
          ? lines.map((line) => line.id === empty.id ? { ...line, productId: match.id } : line)
          : [...lines, { id: uid(), productId: match.id, qty: "" }];
      });
      setScan("");
      setScanError("");
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Could not scan product.");
    }
  }

  return (
    <form
      onSubmit={(e) =>
        submit(e, (f) => {
          const kind = returnKind as "Sales return" | "Purchase return" | "Damaged stock";
          const original = selectedTrade
            ? (kind === "Sales return" ? s.invoices : s.purchases).find(t => t.id === selectedTrade)
            : undefined;
          const lines = returnLines.filter((line) => line.productId);
          if (!lines.length) throw new Error("Select at least one product to return.");
          if (lines.some((line) => !Number.isFinite(Number(line.qty)) || Number(line.qty) <= 0)) {
            throw new Error("Enter a positive quantity for every selected product.");
          }
          const returned = lines.reduce((next, line) => recordReturn(next, {
            id: uid(),
            date: text(f, "date"),
            kind,
            tradeId: selectedTrade,
            productId: line.productId,
            qty: Number(line.qty),
            reason: text(f, "reason"),
            amount: 0,
            cost: 0,
          }), s);
          const returnValue = returned.returns
            .slice(s.returns.length)
            .reduce((sum, entry) => sum + entry.amount, 0);
          const credit = original ? Math.min(returnValue, Math.max(0, -balance(returned, original))) : 0;
          const hasParty = !!original?.contactId;
          // Walk-in (no contact) has no ledger to hold a credit, so it is always refunded.
          const canRefund = credit > 0 && (
            hasParty ? refundMode === "Refund payment" : true
          );
          const next = canRefund
            ? recordPayment(returned, {
              id: uid(),
              date: text(f, "date"),
              kind: kind === "Sales return" ? "Customer" : "Supplier",
              contactId: original!.contactId,
              tradeId: original!.id,
              amount: -credit,
              method: text(f, "refundMethod") || "Cash",
              head: kind === "Sales return" ? "Customer payments" : "Supplier payments",
              notes: `Automatic refund for return ${lines.map((line) => line.productId).join(", ")}`,
            })
            : returned;
          commit(
            next,
            canRefund
              ? "Return recorded and payment refunded."
              : credit > 0 && hasParty
                ? `Return recorded. ${money(credit)} credit left on the party ledger.`
                : "Return / damage recorded. Stock and balances updated.",
          );
        })
      }
    >
      <BarcodeInput value={scan} onChange={setScan} onScan={scanProduct}
        label="Return barcode scanner input" action="Select item" />
      {scanError && <p role="alert" className="form-error">{scanError}</p>}
      <div className="form-grid">
        <Field label="Type">
          <GlassSelect
            value={returnKind}
            onValueChange={(e) => {
              setReturnLines([{ id: uid(), productId: "", qty: "" }]);
              setScanError("");
              setRefundMode("Refund payment");
              setReturnKind(e);
              setSelectedTrade("");
            }}
          >
            <option>Sales return</option>
            <option>Purchase return</option>
            <option>Damaged stock</option>
          </GlassSelect>
        </Field>
        <Field label="Date">
          <input type="date" name="date" required defaultValue={today()} />
        </Field>
        {returnKind !== "Damaged stock" && (
          <Field label="Original transaction">
            <GlassSelect
              required
              value={selectedTrade}
              onValueChange={(e) => {
                setSelectedTrade(e);
                setReturnLines([{ id: uid(), productId: "", qty: "" }]);
                setScanError("");
              }}
            >
              <option value="">Select transaction</option>
              {trades.filter(isPosted).map(
                (t) => (
                  <option key={t.id} value={t.id}>
                    {t.number} · {t.date}
                  </option>
                ),
              )}
            </GlassSelect>
          </Field>
        )}
        {selectedOriginal && (
          <div className="return-bill-details" aria-label="Original bill details">
            <div className="return-bill-heading">
              <div>
                <span>Original bill</span>
                <strong>{selectedOriginal.number}</strong>
              </div>
              <small>{selectedOriginal.date}</small>
            </div>
            <div className="return-bill-party">{originalParty || "Walk-in customer"}</div>
            <div className="return-bill-grid">
              <div><span>Subtotal</span><strong>{money(subtotal(selectedOriginal))}</strong></div>
              <div><span>Discount</span><strong>{money(selectedOriginal.discount)}</strong></div>
              <div><span>Tax</span><strong>{selectedOriginal.tax}%</strong></div>
              <div><span>Bill total</span><strong>{money(total(selectedOriginal))}</strong></div>
              <div><span>Paid</span><strong>{money(paid(s, selectedOriginal))}</strong></div>
              <div><span>Balance</span><strong>{money(balance(s, selectedOriginal))}</strong></div>
            </div>
          </div>
        )}
        <div className="return-lines" aria-label="Products to return">
          <div className="return-lines-heading">
            <span>Products to return</span>
            <small>{selectedOriginal ? `${eligible.length} product${eligible.length === 1 ? "" : "s"} from ${selectedOriginal.number}` : "Add one or more products"}</small>
          </div>
          {returnLines.map((line, index) => {
            const lineProduct = s.products.find((p) => p.id === line.productId);
            const originalLines = selectedOriginal?.lines.filter((item) => item.productId === line.productId) || [];
            const originalQty = originalLines.reduce((sum, item) => sum + item.qty, 0);
            const lineReturnedQty = selectedTrade && line.productId
              ? s.returns.filter((entry) => entry.tradeId === selectedTrade && entry.productId === line.productId).reduce((sum, entry) => sum + entry.qty, 0)
              : 0;
            const lineRemainingQty = selectedOriginal && line.productId ? Math.max(0, originalQty - lineReturnedQty) : undefined;
            const lineUom = lineProduct?.unit || "piece";
            const linePrice = originalLines.reduce((sum, item) => sum + item.qty * item.price, 0) / (originalQty || 1);
            return (
              <div className="return-line" key={line.id}>
                <Field label={`Product ${index + 1}`}>
                  <GlassSelect
                    required
                    value={line.productId}
                    onValueChange={(value) => {
                      setReturnLines((lines) => lines.map((item) => item.id === line.id ? { ...item, productId: value } : item));
                    }}
                  >
                    <option value="">Select product</option>
                    {availableProducts(line.productId).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.unit || "piece"}</option>)}
                  </GlassSelect>
                </Field>
                <Field label={`Quantity (${lineUom})`}>
                  <input type="number" min="0.001" max={lineRemainingQty} step="0.001" required value={line.qty} onChange={(e) => setReturnLines((lines) => lines.map((item) => item.id === line.id ? { ...item, qty: e.target.value } : item))} />
                </Field>
                <div className="return-detail">
                  {lineProduct && selectedOriginal ? <>
                    <span>Available from invoice</span>
                    <strong>{lineRemainingQty} {lineUom} · {money(linePrice)} each</strong>
                    <small>Returned so far: {lineReturnedQty} {lineUom}</small>
                  </> : <><span>Unit of measure</span><strong>{lineUom}</strong></>}
                </div>
                {returnLines.length > 1 && <button type="button" className="link return-line-remove" onClick={() => setReturnLines((lines) => lines.filter((item) => item.id !== line.id))}>Remove</button>}
              </div>
            );
          })}
          {eligible.length > returnLines.filter((line) => line.productId).length && <button type="button" className="secondary return-add-line" onClick={() => setReturnLines((lines) => [...lines, { id: uid(), productId: "", qty: "" }])}>+ Add another product</button>}
        </div>
        {hasLinkedParty && (
          <>
            <Field label="If payment is due back">
              <GlassSelect
                value={refundMode}
                onValueChange={(v) => setRefundMode(v as RefundMode)}
              >
                <option>Refund payment</option>
                <option>Adjust in ledger</option>
              </GlassSelect>
            </Field>
            {refundMode === "Refund payment" && (
              <Field label="Refund method">
                <GlassSelect name="refundMethod" defaultValue="Cash">
                  <option>Cash</option>
                  <option>Bank</option>
                  {(s.financialAccounts || []).filter(a => a.active !== false).map(a => <option key={a.id}>{a.name}</option>)}
                </GlassSelect>
              </Field>
            )}
          </>
        )}
        {returnKind !== "Damaged stock" && selectedOriginal && !selectedOriginal.contactId && (
          <Field label="Refund method (walk-in)">
            <GlassSelect name="refundMethod" defaultValue="Cash">
              <option>Cash</option>
              <option>Bank</option>
              {(s.financialAccounts || []).filter(a => a.active !== false).map(a => <option key={a.id}>{a.name}</option>)}
            </GlassSelect>
          </Field>
        )}
        <Field label="Reason / remarks">
          <input name="reason" required />
        </Field>
      </div>
      <p className="form-hint">
        Returns use the original transaction prices, proportional discounts, and
        taxes. Sales returns put stock back; purchase returns and damage remove
        stock. If the return creates a credit on a linked paid transaction, you
        can either refund it using the selected method or leave it as a credit
        on the party ledger. Walk-in returns are always refunded.
      </p>
      <div className="form-foot">
        <button className="primary">Record return / damage</button>
      </div>
    </form>
  );
}

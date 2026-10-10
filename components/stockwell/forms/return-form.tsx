"use client";
import { BarcodeInput } from "@/components/stockwell/barcode-input";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { Field } from "@/components/stockwell/ui";
import { findProductByCode, isPosted, recordReturn, today, uid, type Store } from "@/lib/stockwell/model";
import type { Dispatch, SetStateAction } from "react";
import { useState, type FormEvent } from "react";
type Props = {
  submit: (e: FormEvent<HTMLFormElement>, fn: (data: FormData) => void) => void;
  commit: (next: Store, message: string) => void;
  s: Store;
  text: (f: FormData, key: string) => string;
  returnKind: string;
  selectedTrade: string;
  num: (f: FormData, key: string) => number;
  setReturnKind: Dispatch<SetStateAction<string>>;
  setSelectedTrade: Dispatch<SetStateAction<string>>;
};
export function ReturnForm({
  submit,
  commit,
  s,
  text,
  returnKind,
  selectedTrade,
  num,
  setReturnKind,
  setSelectedTrade,
}: Props) {
  const [product, setProduct] = useState("");
  const [scan, setScan] = useState("");
  const [scanError, setScanError] = useState("");
  const trades = returnKind === "Sales return" ? s.invoices : s.purchases;
  const selectedOriginal = trades.find((t) => t.id === selectedTrade);
  const eligible = s.products.filter((p) => returnKind === "Damaged stock" ||
    selectedOriginal?.lines.some((l) => l.productId === p.id));
  const selectedLine = selectedOriginal?.lines.find((line) => line.productId === product);
  const returnedQty = selectedTrade && product
    ? s.returns.filter((entry) => entry.tradeId === selectedTrade && entry.productId === product).reduce((sum, entry) => sum + entry.qty, 0)
    : 0;
  const remainingQty = selectedLine ? Math.max(0, selectedLine.qty - returnedQty) : undefined;
  function scanProduct(code = scan) {
    try {
      const match = findProductByCode(s.products, code);
      if (!eligible.some((p) => p.id === match.id))
        throw new Error("Select an original transaction containing this product first.");
      setProduct(match.id);
      setScan("");
      setScanError("");
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Could not scan product.");
    }
  }
  return (
    <form
      onSubmit={(e) =>
        submit(e, (f) =>
          commit(
            recordReturn(s, {
              id: uid(),
              date: text(f, "date"),
              kind: returnKind as
                "Sales return" | "Purchase return" | "Damaged stock",
              tradeId: selectedTrade,
              productId: text(f, "product"),
              qty: num(f, "qty"),
              reason: text(f, "reason"),
              amount: 0,
              cost: 0,
            }),
            "Return / damage recorded. Stock and balances updated.",
          ),
        )
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
              setProduct("");
              setScanError("");
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
              onValueChange={(e) => { setSelectedTrade(e); setProduct(""); setScanError(""); }}
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
        <Field label="Product">
          <GlassSelect
            name="product"
            required
            value={product}
            onValueChange={setProduct}
          >
            <option value="">Select product</option>
            {eligible.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.unit || "piece"}
                </option>
              ))}
          </GlassSelect>
        </Field>
        <Field label="Quantity">
          <input name="qty" type="number" min="0.001" max={remainingQty} step="0.001" required />
        </Field>
        {remainingQty !== undefined && <div className="return-detail"><span>Available to return</span><strong>{remainingQty} {s.products.find((p) => p.id === product)?.unit || "piece"}</strong><small>{selectedOriginal?.contactId ? "Linked to the original transaction" : "Original transaction selected"}</small></div>}
        <Field label="Reason / remarks">
          <input name="reason" required />
        </Field>
      </div>
      <p className="form-hint">
        Returns use the original transaction prices, proportional discounts, and
        taxes. Sales returns put stock back; purchase returns and damage remove
        stock. A negative balance is a credit to settle with the contact.
      </p>
      <div className="form-foot">
        <button className="primary">Record return / damage</button>
      </div>
    </form>
  );
}

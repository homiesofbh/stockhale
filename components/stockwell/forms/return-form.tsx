"use client";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { Field } from "@/components/stockwell/ui";
import { findProductByCode, recordReturn, today, uid, type Store } from "@/lib/stockwell/model";
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
  const eligible = s.products.filter((p) => returnKind === "Damaged stock" ||
    (returnKind === "Sales return" ? s.invoices : s.purchases)
      .find((t) => t.id === selectedTrade)?.lines.some((l) => l.productId === p.id));
  function scanProduct() {
    try {
      const match = findProductByCode(s.products, scan);
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
      <div className="scan-row mb-10">
        <input autoComplete="off" aria-label="Return barcode scanner input" placeholder="Scan barcode or enter SKU, then press Enter"
          value={scan} onChange={(e) => setScan(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); scanProduct(); } }} />
        <button type="button" className="secondary-button" onClick={scanProduct}>Select item</button>
      </div>
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
              {(returnKind === "Sales return" ? s.invoices : s.purchases).map(
                (t) => (
                  <option key={t.id} value={t.id}>
                    {t.number}
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
                  {p.name}
                </option>
              ))}
          </GlassSelect>
        </Field>
        <Field label="Quantity">
          <input name="qty" type="number" min="0.001" step="0.001" required />
        </Field>
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

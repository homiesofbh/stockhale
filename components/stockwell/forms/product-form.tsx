"use client";
import { BarcodeInput } from "@/components/stockwell/barcode-input";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { Field } from "@/components/stockwell/ui";
import {
  saveProduct,
  uid,
  type Product,
  type Store,
} from "@/lib/stockwell/model";
import type { Dispatch, SetStateAction } from "react";
import { useState, type FormEvent } from "react";
type Props = {
  submit: (e: FormEvent<HTMLFormElement>, fn: (data: FormData) => void) => void;
  editProduct: Product | null;
  text: (f: FormData, key: string) => string;
  num: (f: FormData, key: string) => number;
  commit: (next: Store, message: string) => void;
  s: Store;
  setModal: Dispatch<SetStateAction<string>>;
};
export function ProductForm({
  submit,
  editProduct,
  text,
  num,
  commit,
  s,
  setModal,
}: Props) {
  const [barcode, setBarcode] = useState(editProduct?.barcode || "");
  return (
    <form
      onSubmit={(e) =>
        submit(e, (f) => {
          const p: Product = {
            id: editProduct?.id || uid(),
            name: text(f, "name"),
            sku: text(f, "sku"),
            barcode: text(f, "barcode"),
            category: text(f, "category"),
            cost: num(f, "cost"),
            price: num(f, "price"),
            low: num(f, "low"),
          };
          commit(saveProduct(s, p, num(f, "opening")), "Product saved.");
        })
      }
    >
      <div className="form-grid">
        <Field label="Product name">
          <input
            name="name"
            required
            defaultValue={editProduct?.name}
          />
        </Field>
        <Field label="Category">
          <GlassSelect name="category" defaultValue={editProduct?.category}>
            {s.categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </GlassSelect>
        </Field>
        <Field label="SKU / Item code">
          <input name="sku" required defaultValue={editProduct?.sku} />
        </Field>
        <div className="field">
          <span>Barcode (scan or type)</span>
          <BarcodeInput
            name="barcode" label="Barcode (scan or type)"
            value={barcode} onChange={setBarcode} onScan={(code) => setBarcode(code.trim())}
            action="Use code" placeholder="Scan a product barcode here"
          />
        </div>
        <Field label="Cost price (PKR)">
          <input
            name="cost"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={editProduct?.cost || 0}
          />
        </Field>
        <Field label="Selling price (PKR)">
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={editProduct?.price || 0}
          />
        </Field>
        <Field label="Low-stock threshold">
          <input
            name="low"
            type="number"
            min="0"
            step="0.001"
            required
            defaultValue={editProduct?.low ?? 5}
          />
        </Field>
        {!editProduct && (
          <Field label="Opening stock">
            <input
              name="opening"
              type="number"
              min="0"
              step="0.001"
              defaultValue="0"
            />
          </Field>
        )}
      </div>
      <p className="form-hint">
        Stock changes after creation are recorded through purchases, billing,
        returns, or stock adjustments.
      </p>
      <div className="form-foot">
        <button
          type="button"
          className="secondary-button"
          onClick={() => setModal("")}
        >
          Cancel
        </button>
        <button className="primary">Save product</button>
      </div>
    </form>
  );
}

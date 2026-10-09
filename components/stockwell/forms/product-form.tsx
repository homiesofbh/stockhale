"use client";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { Field } from "@/components/stockwell/ui";
import {
  saveProduct,
  uid,
  type Product,
  type Store,
} from "@/lib/stockwell/model";
import type { Dispatch, SetStateAction } from "react";
import { type FormEvent } from "react";
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
  return (
    <form
      onSubmit={(e) =>
        submit(e, (f) => {
          const p: Product = {
            id: editProduct?.id || uid(),
            name: text(f, "name"),
            sku: text(f, "sku"),
            barcode: text(f, "barcode"),
            unit: text(f, "unit") || "piece",
            category: text(f, "category"),
            cost: num(f, "cost"),
            price: num(f, "price"),
            low: num(f, "low"),
            maximum: num(f, "maximum") || undefined,
            color: text(f, "color"),
            gsm: num(f, "gsm") || undefined,
            active: !editProduct || f.has("active"),
          };
          commit(saveProduct(s, p, num(f, "opening")), "Product saved.");
        })
      }
    >
      <div className="form-grid">
        <div className="form-wide">
        <Field label="Product name">
          <input
            name="name"
            required
            defaultValue={editProduct?.name}
          />
        </Field>
        </div>
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
        <Field label="Measurement unit">
          <GlassSelect name="unit" defaultValue={editProduct?.unit || "piece"}>
            {(s.units || ["piece", "kg", "g", "liter", "ml", "box", "pack", "dozen", "meter", "yard"]).map((unit) => <option key={unit}>{unit}</option>)}
          </GlassSelect>
        </Field>
        <Field label="Colour (optional)"><input name="color" maxLength={80} defaultValue={editProduct?.color || ""} /></Field>
        <Field label="GSM (optional)"><input name="gsm" type="number" min="0" step="0.01" defaultValue={editProduct?.gsm ?? ""} /></Field>
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
        <div className={editProduct ? "form-wide" : undefined}>
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
        </div>
        <Field label="Maximum stock (optional)">
          <input name="maximum" type="number" min="0" step="0.001" defaultValue={editProduct?.maximum ?? ""} />
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
        <div className="field">
          <span>Barcode (optional)</span>
          <input name="barcode" defaultValue={editProduct?.barcode || ""} placeholder="Leave blank if you do not use barcodes" />
        </div>
      <p className="form-hint">
        Stock changes after creation are recorded through purchases, billing,
        returns, or stock adjustments.
      </p>
      {editProduct && <label className="checkbox-row"><input name="active" type="checkbox" defaultChecked={editProduct.active !== false} /> Active product</label>}
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

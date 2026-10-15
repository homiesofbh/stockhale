"use client";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { BarcodeInput } from "@/components/stockwell/barcode-input";
import { Field } from "@/components/stockwell/ui";
import {
  saveProduct,
  orderedUnits,
  standardUnits,
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
  commitInline?: (next: Store, message: string) => void;
  s: Store;
  setModal: Dispatch<SetStateAction<string>>;
};
export function ProductForm({
  submit,
  editProduct,
  text,
  num,
  commit,
  commitInline,
  s,
  setModal,
}: Props) {
  const defaultUnits = orderedUnits(s.units || standardUnits);
  const [unit, setUnit] = useState(editProduct?.unit || "piece");
  const [customUnit, setCustomUnit] = useState("");
  const [barcode, setBarcode] = useState(editProduct?.barcode || "");
  const [category, setCategory] = useState(editProduct?.category || s.categories[0] || "");
  const [newCategories, setNewCategories] = useState<string[]>([]);
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const categories = [...s.categories, ...newCategories.filter(name => !s.categories.some(existing => existing.toLowerCase() === name.toLowerCase()))];
  const isCustomUnit = unit === "__custom__";
  return (
    <form
      onSubmit={(e) =>
        submit(e, (f) => {
          if (addingCategory) throw new Error("Add or cancel the new category before saving the product.");
          const p: Product = {
            id: editProduct?.id || uid(),
            name: text(f, "name"),
            sku: text(f, "sku"),
            barcode: text(f, "barcode"),
            unit: (isCustomUnit ? customUnit : unit).trim().toLowerCase() || "piece",
            category: text(f, "category"),
            cost: num(f, "cost"),
            price: num(f, "price"),
            low: num(f, "low"),
            maximum: num(f, "maximum") || undefined,
            color: text(f, "color"),
            gsm: num(f, "gsm") || undefined,
            packing: text(f, "packing"),
            store: text(f, "store"),
            size: text(f, "size"),
            active: !editProduct || f.has("active"),
            variantOf: text(f, "variantOf") || undefined,
          };
          const next = saveProduct({ ...s, categories }, p, num(f, "opening"));
          const units = next.units || defaultUnits;
          const matchingUnit = units.find(existing => existing.trim().toLowerCase() === p.unit);
          commit(
            p.unit && !matchingUnit ? { ...next, units: [...units, p.unit] } : next,
            "Product saved.",
          );
        })
      }
    >
      <div className="field">
        <span>Barcode (optional)</span>
        <BarcodeInput name="barcode" value={barcode} onChange={setBarcode} onScan={setBarcode} label="Product barcode" />
      </div>
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
          <div>
          <GlassSelect aria-label="Category" name="category" value={category} onValueChange={setCategory}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </GlassSelect>
          {!addingCategory && <button type="button" className="link" onClick={() => { setAddingCategory(true); setCategoryError(""); }}>+ Add category</button>}
          {addingCategory && <div>
            <input aria-label="New category name" value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder="Category name" maxLength={100} onKeyDown={event => {
              if (event.key === "Enter") { event.preventDefault(); event.currentTarget.parentElement?.querySelector<HTMLButtonElement>("button")?.click(); }
            }} />
            <button type="button" className="secondary-button" onClick={() => {
              const name = categoryName.trim();
              if (!name) { setCategoryError("Enter a category name."); return; }
              const existing = categories.find(value => value.toLowerCase() === name.toLowerCase());
              if (!existing) {
                try {
                  if (commitInline) commitInline({ ...s, categories: [...s.categories, name] }, "Category added.");
                  else setNewCategories(values => [...values, name]);
                } catch (error) { setCategoryError(error instanceof Error ? error.message : "Could not add category."); return; }
              }
              setCategory(existing || name);
              setAddingCategory(false); setCategoryName(""); setCategoryError("");
            }}>Add category</button>
            <button type="button" className="link" onClick={() => { setAddingCategory(false); setCategoryName(""); setCategoryError(""); }}>Cancel</button>
            {categoryError && <p className="form-error" role="alert">{categoryError}</p>}
          </div>}
          </div>
        </Field>
        <Field label="SKU / Item code">
          <input name="sku" required defaultValue={editProduct?.sku} />
        </Field>
        <Field label="Measurement unit">
          <GlassSelect name="unit" value={unit} onValueChange={setUnit}>
            {defaultUnits.map((value) => <option key={value}>{value}</option>)}
            {editProduct?.unit && !defaultUnits.includes(editProduct.unit) && <option>{editProduct.unit}</option>}
            <option value="__custom__">Add custom UOM…</option>
          </GlassSelect>
        </Field>
        {isCustomUnit && <Field label="Custom UOM"><input name="customUnit" value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} placeholder="e.g. roll, set, bundle" maxLength={40} required /></Field>}
        <Field label="Colour (optional)"><input name="color" maxLength={80} defaultValue={editProduct?.color || ""} /></Field>
        <Field label="GSM (optional)"><input name="gsm" type="number" min="0" step="0.01" defaultValue={editProduct?.gsm ?? ""} /></Field>
        <Field label="Packing (optional)"><input name="packing" maxLength={80} defaultValue={editProduct?.packing || ""} placeholder="e.g. 25 kg bag" /></Field>
        <Field label="Store (optional)"><input name="store" maxLength={80} defaultValue={editProduct?.store || ""} /></Field>
        <Field label="Size (optional)"><input name="size" maxLength={80} defaultValue={editProduct?.size || ""} /></Field>
        <Field label="Variant parent (optional)"><GlassSelect name="variantOf" defaultValue={editProduct?.variantOf || ""}><option value="">Standalone product</option>{s.products.filter(x => x.id !== editProduct?.id).map(x => <option key={x.id} value={x.id}>{x.name} · {x.sku}</option>)}</GlassSelect></Field>
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

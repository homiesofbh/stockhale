"use client";
import { BarcodeInput } from "@/components/stockwell/barcode-input";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { Field, Table } from "@/components/stockwell/ui";
import type { InvoicePaper } from "@/lib/stockwell/invoice-pdf";
import {
  money,
  recordTrade,
  round,
  stock,
  subtotal,
  today,
  uid,
  type Line,
  type Contact,
  type Store,
  type Trade,
} from "@/lib/stockwell/model";
import { X } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useState, type FormEvent } from "react";
type Props = {
  submit: (e: FormEvent<HTMLFormElement>, fn: (data: FormData) => void) => void;
  text: (f: FormData, key: string) => string;
  num: (f: FormData, key: string) => number;
  s: Store;
  modal: "Purchase" | "Bill";
  commit: (next: Store, message: string) => void;
  setInvoice: Dispatch<SetStateAction<Trade | null>>;
  setPaper: Dispatch<SetStateAction<InvoicePaper>>;
  scanInput: RefObject<HTMLInputElement | null>;
  scan: string;
  setScan: Dispatch<SetStateAction<string>>;
  scanProduct: (code?: string) => void;
  addLine: (id: string) => void;
  lines: Line[];
  pName: (id: string) => string;
  setLines: Dispatch<SetStateAction<Line[]>>;
  discount: number;
  setDiscount: Dispatch<SetStateAction<number>>;
  tax: number;
  setTax: Dispatch<SetStateAction<number>>;
  billTotal: number;
  setModal: Dispatch<SetStateAction<string>>;
  canAddSupplier: boolean;
  addSupplier: (supplier: Contact) => void;
};
export function TradeForm({
  submit,
  text,
  num,
  s,
  modal,
  commit,
  setInvoice,
  setPaper,
  scanInput,
  scan,
  setScan,
  scanProduct,
  addLine,
  lines,
  pName,
  setLines,
  discount,
  setDiscount,
  tax,
  setTax,
  billTotal,
  setModal,
  canAddSupplier,
  addSupplier,
}: Props) {
  const [contact, setContact] = useState("");
  const [method, setMethod] = useState("Cash");
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [supplierError, setSupplierError] = useState("");
  const [supplier, setSupplier] = useState({ name: "", phone: "", email: "", address: "" });
  function saveSupplier() {
    try {
      const draft = Object.fromEntries(Object.entries(supplier).map(([key, value]) => [key, value.trim()])) as typeof supplier;
      if (!draft.name) throw new Error("Supplier name is required.");
      if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) throw new Error("Enter a valid supplier email.");
      const created = { ...draft, id: uid() };
      addSupplier(created);
      setContact(created.id);
      setAddingSupplier(false);
      setSupplier({ name: "", phone: "", email: "", address: "" });
      setSupplierError("");
    } catch (error) {
      setSupplierError(error instanceof Error ? error.message : "Could not add supplier.");
    }
  }
  return (
    <form
      onSubmit={(e) =>
        submit(e, (f) => {
          if (addingSupplier) throw new Error("Save or cancel the new supplier before saving the purchase.");
          const t: Trade = {
            status: (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "draft" ? "draft" : "posted",
            id: uid(),
            number: "",
            date: text(f, "date"),
            contactId: text(f, "contact"),
            lines,
            discount,
            tax,
            paid: num(f, "paid"),
            method: text(f, "method"),
            head: text(f, "head"),
            chequeNumber: text(f, "chequeNumber"),
            chequeBank: text(f, "chequeBank"),
            chequeDate: text(f, "chequeDate"),
            walkInName: modal === "Bill" && !text(f, "contact") ? text(f, "walkInName") : "",
            walkInCompany: modal === "Bill" && !text(f, "contact") ? text(f, "walkInCompany") : "",
            walkInAddress: modal === "Bill" && !text(f, "contact") ? text(f, "walkInAddress") : "",
            walkInPhone: modal === "Bill" && !text(f, "contact") ? text(f, "walkInPhone") : "",
          };
          const next = recordTrade(
            s,
            modal === "Bill" ? "Sale" : "Purchase",
            t,
          );
          commit(
            next,
            t.status === "draft" ? "Draft saved. Stock and balances unchanged." : modal === "Bill" ? "Bill posted. Inventory updated." : "Purchase posted. Inventory updated.",
          );
          if (modal === "Bill" && t.status !== "draft") {
            setInvoice(next.invoices[next.invoices.length - 1]);
            setPaper("A4");
          }
        })
      }
    >
      <div className="form-grid">
        <div>
          <Field label={modal === "Purchase" ? "Supplier" : "Customer (walk-in or company)"}>
          <GlassSelect name="contact" value={contact} onValueChange={setContact} required={modal === "Purchase"}>
            <option value="">
              {modal === "Purchase" ? "Select supplier" : "Walk-in customer"}
            </option>
            {(modal === "Purchase" ? s.suppliers : s.customers).map((c) => (
              <option key={c.id} value={c.id}>
                {modal === "Purchase" ? c.name : [c.name, c.company, c.phone].filter(Boolean).join(" · ")}
              </option>
            ))}
          </GlassSelect>
          </Field>
          {modal === "Bill" && !contact && (
            <>
              <Field label="Walk-in customer name (optional)"><input name="walkInName" maxLength={200} /></Field>
              <Field label="Company name (optional)"><input name="walkInCompany" maxLength={200} /></Field>
              <Field label="Walk-in address (optional)"><input name="walkInAddress" maxLength={500} /></Field>
              <Field label="Contact number (optional)"><input name="walkInPhone" type="tel" maxLength={40} /></Field>
            </>
          )}
          {modal === "Purchase" && canAddSupplier && !addingSupplier && (
            <button type="button" className="secondary-button" onClick={() => { setAddingSupplier(true); setSupplierError(""); }}>
              Add supplier
            </button>
          )}
        </div>
        <Field label="Date">
          <input type="date" name="date" required defaultValue={today()} />
        </Field>
      </div>
      {modal === "Purchase" && addingSupplier && (
        <fieldset className="inline-supplier">
          <legend>New supplier</legend>
          <div className="form-grid">
            {(["name", "phone", "email", "address"] as const).map((key) => (
              <Field key={key} label={key === "name" ? "Supplier name" : key[0].toUpperCase() + key.slice(1)}>
                <input
                  type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
                  value={supplier[key]}
                  maxLength={key === "address" ? 500 : 200}
                  autoFocus={key === "name"}
                  onChange={(event) => setSupplier({ ...supplier, [key]: event.target.value })}
                />
              </Field>
            ))}
          </div>
          {supplierError && <p className="form-error" role="alert">{supplierError}</p>}
          <div className="form-foot">
            <button type="button" className="secondary-button" onClick={() => { setAddingSupplier(false); setSupplierError(""); }}>Cancel supplier</button>
            <button type="button" className="primary" onClick={saveSupplier}>Save supplier</button>
          </div>
        </fieldset>
      )}
      <BarcodeInput inputRef={scanInput} value={scan} onChange={setScan} onScan={scanProduct} />
      <Field label="Or choose a product">
        <GlassSelect value="" onValueChange={(e) => addLine(e)}>
          <option value="">Select product to add</option>
          {s.products.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name} · {p.sku} · {stock(s, p.id)} in stock
            </option>
          ))}
        </GlassSelect>
      </Field>
      <div className="bill-lines">
        {lines.length ? (
          <Table
            headers={[
              "Product",
              "Quantity",
              modal === "Purchase" ? "Cost price" : "Unit price",
              "Total",
              "",
            ]}
            rows={lines.map((l, i) => [
              <>
                {pName(l.productId)}
                <small>
                  {s.products.find((p) => p.id === l.productId)?.sku} · {l.unit || s.products.find((p) => p.id === l.productId)?.unit || "piece"}
                </small>
              </>,
              <input
                aria-label={`Quantity for ${pName(l.productId)}`}
                type="number"
                min="0.001"
                step="0.001"
                required
                value={l.qty}
                onChange={(e) =>
                  setLines(
                    lines.map((x, n) =>
                      n === i ? { ...x, qty: Number(e.target.value) } : x,
                    ),
                  )
                }
              />,
              <input
                aria-label={`Price for ${pName(l.productId)}`}
                type="number"
                min="0"
                step="0.01"
                required
                value={l.price}
                onChange={(e) =>
                  setLines(
                    lines.map((x, n) =>
                      n === i
                        ? {
                            ...x,
                            price: Number(e.target.value),
                            cost:
                              modal === "Purchase"
                                ? Number(e.target.value)
                                : x.cost,
                          }
                        : x,
                    ),
                  )
                }
              />,
              money(l.qty * l.price),
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove ${pName(l.productId)}`}
                onClick={() => setLines(lines.filter((_, n) => n !== i))}
              >
                <X size={16} />
              </button>,
            ])}
              />
        ) : (
          <div className="line-placeholder">
            Scan or select a product to start your{" "}
            {modal === "Bill" ? "bill" : "purchase"}.
          </div>
        )}
      </div>
      <div className="form-grid">
        <Field label="Discount amount (PKR)">
          <input
            type="number"
            min="0"
            max={subtotal({ lines })}
            step="0.01"
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
            required
          />
        </Field>
        <Field label="Tax (%)">
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={tax}
            onChange={(e) => setTax(Number(e.target.value))}
            required
          />
        </Field>
        <Field label={method === "Cheque" ? "Cheque amount (PKR)" : "Amount paid (PKR)"}>
          <input
            key={billTotal}
            name="paid"
            type="number"
            min="0"
            max={Math.max(0, billTotal)}
            step="0.01"
            defaultValue={Math.max(0, billTotal)}
            required
          />
        </Field>
        <Field label="Payment method">
          <GlassSelect name="method" value={method} onValueChange={setMethod}>
            <option>Cash</option>
            {(s.financialAccounts || []).filter(a => a.active !== false).map((account) => <option key={account.id}>{account.name}</option>)}
            <option>Cheque</option>
          </GlassSelect>
        </Field>
        {method === "Cheque" && <>
          <Field label="Cheque number"><input name="chequeNumber" maxLength={80} required /></Field>
          <Field label="Cheque bank"><input name="chequeBank" maxLength={120} required /></Field>
          <Field label="Expected clearance date"><input name="chequeDate" type="date" min={today()} required /></Field>
        </>}
        <Field label="Account head">
          <GlassSelect
            name="head"
            defaultValue={modal === "Bill" ? "Sales" : "Purchases"}
          >
            {s.heads.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </GlassSelect>
        </Field>
      </div>
      <p className="form-hint">
        Use zero paid for credit; a partial amount leaves a pending balance. A
        customer is required for credit bills. Cheques remain pending until
        marked cleared in Payments, then they reduce the balance.
      </p>
      <div className="bill-summary">
        <span>
          Subtotal <b>{money(subtotal({ lines }))}</b>
        </span>
        <span>
          Discount <b>− {money(discount)}</b>
        </span>
        <span>
          Tax{" "}
          <b>{money(round(((subtotal({ lines }) - discount) * tax) / 100))}</b>
        </span>
        <span className="net-total">
          Net payable <b>{money(billTotal)}</b>
        </span>
      </div>
      <div className="form-foot">
        <button
          type="button"
          className="secondary-button"
          onClick={() => setModal("")}
        >
          Cancel
        </button>
        <button className="secondary" value="draft" disabled={!lines.length || addingSupplier}>Save draft</button>
        <button className="primary" value="post" disabled={!lines.length || addingSupplier}>
          Post {modal === "Bill" ? "bill" : "purchase"}
        </button>
      </div>
    </form>
  );
}

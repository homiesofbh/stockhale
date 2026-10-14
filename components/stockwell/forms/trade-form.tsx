"use client";
import { BarcodeInput } from "@/components/stockwell/barcode-input";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { Field, Table } from "@/components/stockwell/ui";
import type { InvoicePaper } from "@/lib/stockwell/invoice-pdf";
import {
  money,
  orderedUnits,
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
import { useEffect, useState, type FormEvent } from "react";
import { uploadAttachment } from "@/lib/stockwell/attachment-client";
const searchableContactText = (contact: Contact) => {
  const text = [contact.name, contact.company, contact.phone, contact.mobile, contact.email]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const digits = [contact.phone, contact.mobile]
    .filter(Boolean)
    .join(" ")
    .replace(/\D/g, "");
  return { text, digits };
};
type Props = {
  submit: (e: FormEvent<HTMLFormElement>, fn: (data: FormData) => void | Promise<void>) => void;
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
  scanProduct: (code?: string) => string | false | void;
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
  canAddCustomer: boolean;
  addCustomer: (customer: Contact) => void;
  canChangeHead: boolean;
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
  canAddCustomer,
  addCustomer,
  canChangeHead,
}: Props) {
  const [contact, setContact] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [method, setMethod] = useState("Cash");
  const [paidAmount, setPaidAmount] = useState(billTotal);
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [supplierError, setSupplierError] = useState("");
  const [supplier, setSupplier] = useState({ name: "", phone: "", email: "", address: "" });
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState("");
  const [customerKind, setCustomerKind] = useState<"Walk-in customer" | "Company">("Walk-in customer");
  const [customer, setCustomer] = useState({ name: "", company: "", phone: "", mobile: "", address: "", email: "" });
  const contacts = modal === "Purchase" ? s.suppliers : s.customers;
  const contactSearch = contactQuery.trim().toLowerCase();
  const matchingContacts = contactSearch
    ? contacts.filter((c) => {
        const searchable = searchableContactText(c);
        const queryDigits = contactSearch.replace(/\D/g, "");
        return searchable.text.includes(contactSearch) || (!!queryDigits && searchable.digits.includes(queryDigits));
      })
    : [];
  const productSearch = productQuery.trim().toLowerCase();
  const selectableProducts = s.products.filter((p) => p.active !== false && (!productSearch || [p.name, p.sku, p.barcode, p.category, p.color, p.gsm, p.unit].filter(Boolean).join(" ").toLowerCase().includes(productSearch)));
  useEffect(() => setPaidAmount(billTotal), [billTotal]);
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
  function saveCustomer() {
    try {
      const draft = Object.fromEntries(Object.entries(customer).map(([key, value]) => [key, value.trim()])) as typeof customer;
      if (!draft.name && !draft.company) throw new Error("Enter a customer or company name.");
      const created = { ...draft, id: uid() };
      addCustomer(created);
      setContact(created.id);
      setContactQuery("");
      setAddingCustomer(false);
      setCustomerKind("Walk-in customer");
      setCustomer({ name: "", company: "", phone: "", mobile: "", address: "", email: "" });
      setCustomerError("");
    } catch (error) {
      setCustomerError(error instanceof Error ? error.message : "Could not add customer.");
    }
  }
  return (
    <form
      onSubmit={(e) =>
        submit(e, async (f) => {
          if (addingSupplier || addingCustomer) throw new Error("Save or cancel the new contact before saving the transaction.");
          const id = uid();
          const file = (f.get("attachment") as File)?.size ? (f.get("attachment") as File) : undefined;
          const attachment = modal === "Purchase" && file ? await uploadAttachment(file, "purchase", id) : undefined;
          const t: Trade = {
            status: (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "draft" ? "draft" : "posted",
            id,
            number: "",
            reference: text(f, "reference"),
            attachments: attachment ? [attachment] : undefined,
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
      <div className="form-grid bill-customer-row">
        <div className="bill-customer-picker">
          <Field label={modal === "Purchase" ? "Supplier" : "Customer (walk-in or company)"}>
          <div>
          <input
            aria-label={modal === "Purchase" ? "Search suppliers" : "Search customers"}
            placeholder={modal === "Purchase" ? "Search suppliers…" : "Search customers…"}
            value={contactQuery}
            onChange={(e) => setContactQuery(e.target.value)}
          />
          <input type="hidden" name="contact" value={contact} />
          {contactSearch && <div className="contact-results" role="listbox" aria-label={modal === "Purchase" ? "Matching suppliers" : "Matching customers"}>
            {matchingContacts
              .map((c) => (
                <button type="button" role="option" aria-selected={contact === c.id} className={contact === c.id ? "contact-result selected" : "contact-result"} key={c.id} onClick={() => { setContact(c.id); setContactQuery(""); }}>
                {modal === "Purchase" ? c.name : [c.name, c.company, c.phone || c.mobile].filter(Boolean).join(" · ")}
              </button>
              ))}
            {matchingContacts.length === 0 && <p className="field-help">No matching {modal === "Purchase" ? "suppliers" : "customers"}.</p>}
          </div>}
          {contact && !contactSearch && <p className="selected-contact">Selected: <b>{contacts.find((c) => c.id === contact)?.name || contacts.find((c) => c.id === contact)?.company}</b> <button type="button" className="link" onClick={() => setContact("")}>Clear</button></p>}
          <p className="field-help">Type a name, company, phone, mobile, or email to search. Select a result below.</p>
          </div>
          </Field>
          {modal === "Bill" && canAddCustomer && !addingCustomer && (
            <button type="button" className="secondary-button" onClick={() => { setAddingCustomer(true); setCustomerError(""); }}>
              Add customer
            </button>
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
      {modal === "Bill" && !contact && !addingCustomer && (
        <div className="form-grid walk-in-fields">
          <Field label="Walk-in customer name (optional)"><input name="walkInName" maxLength={200} /></Field>
          <Field label="Company name (optional)"><input name="walkInCompany" maxLength={200} /></Field>
          <Field label="Walk-in address (optional)"><input name="walkInAddress" maxLength={500} /></Field>
          <Field label="Contact number (optional)"><input name="walkInPhone" type="tel" maxLength={40} /></Field>
        </div>
      )}
      {modal === "Bill" && addingCustomer && <fieldset className="inline-supplier inline-customer"><legend>New customer</legend><p className="field-help">Choose whether this is a walk-in customer or a company, then enter the contact details.</p><div className="form-grid">
        <Field label="Customer type"><GlassSelect value={customerKind} onValueChange={value => setCustomerKind(value as typeof customerKind)}><option>Walk-in customer</option><option>Company</option></GlassSelect></Field>
        <Field label={customerKind === "Company" ? "Company name" : "Customer name"}><input value={customerKind === "Company" ? customer.company : customer.name} onChange={e => setCustomer(customerKind === "Company" ? { ...customer, company: e.target.value } : { ...customer, name: e.target.value })} required /></Field>
        {customerKind === "Company" && <Field label="Contact person (optional)"><input value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} /></Field>}
        <Field label="Phone"><input type="tel" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} /></Field>
        <Field label="Mobile"><input type="tel" value={customer.mobile} onChange={e => setCustomer({ ...customer, mobile: e.target.value })} /></Field>
        <Field label="Email"><input type="email" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} /></Field>
        <Field label="Address"><input value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })} /></Field>
      </div>{customerError && <p className="form-error" role="alert">{customerError}</p>}<div className="form-foot"><button type="button" className="secondary-button" onClick={() => { setAddingCustomer(false); setCustomerKind("Walk-in customer"); }}>Cancel customer</button><button type="button" className="primary" onClick={saveCustomer}>Save customer</button></div></fieldset>}
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
      <div className="product-picker-search"><Field label="Search stock / product"><div><input value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Search by product, SKU, barcode, colour, GSM, or UOM" />{productQuery.trim() && <div className="product-search-results" role="listbox" aria-label="Matching stock products">{selectableProducts.length ? selectableProducts.map((p) => <button key={p.id} type="button" className="product-search-result" onClick={() => { addLine(p.id); setProductQuery(""); }}><span><strong>{p.name}</strong><small>{[p.sku, p.color, p.gsm ? `${p.gsm} GSM` : "", p.unit || "piece"].filter(Boolean).join(" · ")}</small></span><small>{stock(s, p.id)} in stock</small></button>) : <p className="field-help">No active stock product matches “{productQuery.trim()}”.</p>}</div>}</div></Field>
      <Field label="Or choose a product">
        <GlassSelect value="" onValueChange={(e) => { addLine(e); setProductQuery(""); }}>
          <option value="">Select product to add</option>
          {selectableProducts.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name} · {p.sku} · {stock(s, p.id)} in stock
            </option>
          ))}
        </GlassSelect>
      </Field>
      </div>
      <div className="bill-lines">
        {lines.length ? (
          <Table
            headers={[
              "Product",
              "Colour",
              "Quantity",
              "UOM",
              "Number of rolls",
              modal === "Purchase" ? "Cost price" : "Unit price",
              "Line discount",
              "Total",
              "",
            ]}
            rows={lines.map((l, i) => [
              <>
                {pName(l.productId)}
                <small>
                  {s.products.find((p) => p.id === l.productId)?.sku}
                </small>
              </>,
              s.products.find((p) => p.id === l.productId)?.color || "—",
              <input
                aria-label={`Quantity for ${pName(l.productId)}`}
                data-barcode-quantity={l.productId}
                type="number"
                min="0.001"
                step="0.001"
                required
                value={l.qty}
                onChange={(e) =>
                  setLines(
                    lines.map((x, n) =>
                      n === i ? { ...x, qty: Number(e.target.value), discount: Math.min(x.discount || 0, Number(e.target.value) * x.price) } : x,
                    ),
                  )
                }
              />,
              <GlassSelect aria-label={`UOM for ${pName(l.productId)}`} value={l.unit || s.products.find((p) => p.id === l.productId)?.unit || "piece"} onValueChange={(value) => setLines(lines.map((x, n) => n === i ? { ...x, unit: value } : x))}>{orderedUnits(s.units).map(unit => <option key={unit}>{unit}</option>)}</GlassSelect>,
              <input aria-label={`Number of rolls for ${pName(l.productId)}`} type="number" min="0" step="1" placeholder="Rolls" value={l.packageCount ?? ""} onChange={(e) => setLines(lines.map((x, n) => n === i ? { ...x, packageCount: e.target.value ? Number(e.target.value) : undefined } : x))} />,
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
                            discount: Math.min(x.discount || 0, x.qty * Number(e.target.value)),
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
              <input
                aria-label={`Line discount for ${pName(l.productId)}`}
                type="number"
                min="0"
                max={l.qty * l.price}
                step="0.01"
                value={l.discount || 0}
                onChange={(e) => setLines(lines.map((x, n) => n === i ? { ...x, discount: Math.min(Number(e.target.value), x.qty * x.price) } : x))}
              />,
              money(l.qty * l.price - (l.discount || 0)),
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
        <Field label="Reference / book no.">
          <input name="reference" maxLength={120} placeholder="Optional" />
        </Field>
        {modal === "Purchase" && <Field label="Supplier bill copy (PDF/JPG/PNG/WEBP, max 5 MB)"><input name="attachment" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" /></Field>}
        <Field label="Discount amount (PKR)">
          <input
            type="number"
            min="0"
            max={Math.max(0, subtotal({ lines }) - lines.reduce((n, l) => n + (l.discount || 0), 0))}
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
            name="paid"
            type="number"
            min="0"
            max={Math.max(0, billTotal)}
            step="0.01"
            value={paidAmount}
            onChange={(e) => setPaidAmount(Number(e.target.value))}
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
          {canChangeHead ? (
            <GlassSelect name="head" defaultValue={modal === "Bill" ? "Sales" : "Purchases"}>
              {s.heads.map((h) => <option key={h}>{h}</option>)}
            </GlassSelect>
          ) : (
            <>
              <input type="hidden" name="head" value={modal === "Bill" ? "Sales" : "Purchases"} />
              <input value={modal === "Bill" ? "Sales" : "Purchases"} readOnly aria-label="Account head" />
            </>
          )}
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
          <b>{money(round(((subtotal({ lines }) - lines.reduce((n, l) => n + (l.discount || 0), 0) - discount) * tax) / 100))}</b>
        </span>
        <span className="net-total">
          Bill total <b>{money(billTotal)}</b>
        </span>
        <span>
          Amount paid <b>{money(Math.min(Math.max(0, paidAmount || 0), billTotal))}</b>
        </span>
        <span className="balance-due">
          Balance due <b>{money(Math.max(0, billTotal - (paidAmount || 0)))}</b>
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

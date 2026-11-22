"use client";
import { BarcodeInput } from "@/components/stockwell/barcode-input";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { Field, Modal, Table } from "@/components/stockwell/ui";
import { ServerPagination } from "@/components/stockwell/ui";
import { matchesProductQuery } from "@/lib/stockwell/record-selectors";
import { ProductForm } from "./product-form";
import type { InvoicePaper } from "@/lib/stockwell/invoice-pdf";
import {
  availableUnits,
  availableAdvancePayments,
  applyAdvanceToTrade,
  contactBalance,
  money,
  recordTrade,
  requiresWholeQuantity,
  tradeLineUnit,
  recordPayment,
  round,
  stock,
  subtotal,
  supplierPayableBalance,
  total,
  today,
  uid,
  type Line,
  type Contact,
  type Store,
  type Trade,
} from "@/lib/stockwell/model";
import { financialBalanceSnapshot } from "@/lib/stockwell/operations";
import { X } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect, useState, type FormEvent } from "react";
import { uploadAndSaveAttachment } from "@/lib/stockwell/attachment-client";
import { useServerCollection } from "@/lib/stockwell/use-server-collection";
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
  saving: boolean;
  text: (f: FormData, key: string) => string;
  num: (f: FormData, key: string) => number;
  s: Store;
  modal: "Purchase" | "Bill";
  isOwner: boolean;
  creator: { id: string; name: string };
  workspaceId: string;
  commit: (next: Store, message: string) => Promise<void>;
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
  canAddProduct: boolean;
  addProduct: (product: import("@/lib/stockwell/model").Product, opening: number) => void | Promise<Store | void>;
  saveProductCategory: (next: Store, message: string) => void;
};
export function TradeForm({
  submit,
  saving,
  text,
  num,
  s,
  modal,
  isOwner,
  creator,
  workspaceId,
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
  canAddProduct,
  addProduct,
  saveProductCategory,
}: Props) {
  const [contact, setContact] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [productColor, setProductColor] = useState("");
  const [productGsm, setProductGsm] = useState("");
  const [productUnit, setProductUnit] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);
  const [workingStore, setWorkingStore] = useState(s);
  const contactPage = useServerCollection<any>({ collection: modal === "Purchase" ? "suppliers" : "customers", module: modal === "Purchase" ? "Suppliers" : "Customers", query: contactQuery, pageSize: 12 });
  useEffect(() => { setWorkingStore(current => current.products.length > s.products.length ? current : s); }, [s]);
  const [addingProduct, setAddingProduct] = useState(false);
  const [productError, setProductError] = useState("");
  const [method, setMethod] = useState("Cash");
  const [paidAmount, setPaidAmount] = useState(billTotal);
  const [applyAdvance, setApplyAdvance] = useState(false);
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [supplierError, setSupplierError] = useState("");
  const [supplier, setSupplier] = useState({ name: "", phone: "", email: "", address: "" });
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState("");
  const [customerKind, setCustomerKind] = useState<"Walk-in customer" | "Company">("Walk-in customer");
  const [customer, setCustomer] = useState({ name: "", company: "", phone: "", mobile: "", address: "", email: "" });
  const contacts = modal === "Purchase" ? s.suppliers : s.customers;
  const contactSearch = contactQuery.trim().toLowerCase();
  const matchingContacts = contactPage.records;
  const activeProducts = workingStore.products.filter(product => product.active !== false);
  const productCategories = [...new Set(activeProducts.map(product => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const productColors = [...new Set(activeProducts.map(product => product.color).filter((color): color is string => !!color))].sort((a, b) => a.localeCompare(b));
  const productGsms = [...new Set(activeProducts.map(product => product.gsm).filter((gsm): gsm is number => gsm !== undefined && gsm !== null))].sort((a, b) => a - b);
  const productUnits = [...new Set(activeProducts.map(product => product.unit || "piece"))].sort((a, b) => a.localeCompare(b));
  const selectableProducts = activeProducts.filter(product => matchesProductQuery(productQuery, product) &&
    (!productCategory || product.category === productCategory) &&
    (!productColor || product.color === productColor) &&
    (!productGsm || String(product.gsm) === productGsm) &&
    (!productUnit || (product.unit || "piece") === productUnit));
  const hasProductFilters = !!(productQuery.trim() || productCategory || productColor || productGsm || productUnit);
  const units = availableUnits(workingStore.units, workingStore.products.map(product => product.unit));
  const contactKind = modal === "Purchase" ? "Supplier" : "Customer";
  const advanceSources = contact ? availableAdvancePayments(workingStore, contactKind, contact) : [];
  const availableAdvance = round(advanceSources.reduce((sum, source) => sum + source.amount, 0));
  const advanceToApply = applyAdvance ? round(Math.min(availableAdvance, billTotal)) : 0;
  const currentContactBalance = contact ? (modal === "Purchase" ? supplierPayableBalance(workingStore, contact) : contactBalance(workingStore, "Customer", contact)) : 0;
  const unpaidWalkIn = modal === "Bill" && !contact && paidAmount < billTotal;
  const insufficientStock = modal === "Bill"
    ? Array.from(lines.reduce((demand, line) => demand.set(line.productId, (demand.get(line.productId) || 0) + line.qty), new Map<string, number>()))
        .filter(([productId, quantity]) => quantity > stock(workingStore, productId))
        .map(([productId, quantity]) => ({ productId, quantity, available: stock(workingStore, productId) }))
    : [];
  const belowCost = modal === "Bill" && lines.some(line => line.price < line.cost);
  useEffect(() => setPaidAmount(Math.max(0, round(billTotal - advanceToApply))), [billTotal, advanceToApply]);
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
    <>
    <form
      onSubmit={(e) =>
        submit(e, async (f) => {
          if (addingSupplier || addingCustomer) throw new Error("Save or cancel the new contact before saving the transaction.");
          const id = uid();
          const file = (f.get("attachment") as File)?.size ? (f.get("attachment") as File) : undefined;
          const t: Trade = {
            status: (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "draft" ? "draft" : "posted",
            id,
            createdBy: creator.id,
            createdByName: creator.name,
            number: "",
            reference: text(f, "reference"),
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
          if (applyAdvance && t.status === "draft") throw new Error("Save the draft without applying the advance. You can apply it when you post this bill.");
          const kind = modal === "Bill" ? "Sale" : "Purchase";
          const billPaid = Math.min(t.paid, Math.max(0, round(total(t) - advanceToApply)));
          const excess = t.status === "draft" ? 0 : round(t.paid - billPaid);
          let recorded = recordTrade(workingStore, kind, { ...t, paid: t.status === "draft" ? t.paid : billPaid });
          const saved = (kind === "Sale" ? recorded.invoices : recorded.purchases).at(-1)!;
          if (advanceToApply > 0 && t.status !== "draft") recorded = applyAdvanceToTrade(recorded, saved, advanceToApply, t.date);
          if (excess > 0 && saved.contactId) recorded = recordPayment(recorded, { id: uid(), date: t.date, kind: kind === "Sale" ? "Customer" : "Supplier", contactId: saved.contactId, tradeId: "", advance: true, amount: excess, method: t.method, head: t.head, notes: `Excess paid with ${saved.number}`, chequeNumber: t.chequeNumber, chequeBank: t.chequeBank, chequeDate: t.chequeDate });
          const savedTrade = (modal === "Bill" ? recorded.invoices : recorded.purchases).find(item => item.id === saved.id)!;
          const snapshot = financialBalanceSnapshot(recorded);
          const next = modal === "Bill"
            ? { ...recorded, invoices: recorded.invoices.map(item => item.id === savedTrade.id ? { ...item, balanceAfter: snapshot } : item) }
            : { ...recorded, purchases: recorded.purchases.map(item => item.id === savedTrade.id ? { ...item, balanceAfter: snapshot } : item) };
          const message = t.status === "draft" ? "Draft saved. Stock and balances unchanged." : modal === "Bill" ? unpaidWalkIn ? "Unpaid bill recorded. Payment and remaining balance saved." : "Bill posted. Inventory and customer balance updated." : "Purchase posted. Inventory updated.";
          const save = (uploaded?: import("@/lib/stockwell/model").Attachment) => commit(uploaded ? {
            ...next,
            purchases: next.purchases.map(item => item.id === savedTrade.id ? { ...item, attachments: [...(item.attachments || []), uploaded] } : item),
          } : next, message);
          if (modal === "Purchase" && file) await uploadAndSaveAttachment(file, "purchase", id, save, { workspaceId, actorId: creator.id });
          else await save();
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
                <button type="button" role="option" aria-selected={contact === c.id} className={contact === c.id ? "contact-result selected" : "contact-result"} key={c.id} onClick={() => { setContact(c.id); setContactQuery(""); setApplyAdvance(false); }}>
                {modal === "Purchase" ? c.name : [c.name, c.company, c.phone || c.mobile].filter(Boolean).join(" · ")}
              </button>
              ))}
            {matchingContacts.length === 0 && <p className="field-help">No matching {modal === "Purchase" ? "suppliers" : "customers"}.</p>}
          </div>}
          {contactSearch && <ServerPagination page={contactPage.page} pageCount={contactPage.pageCount} count={contactPage.count} pageSize={contactPage.pageSize} setPage={contactPage.setPage} />}
          {contact && !contactSearch && <p className="selected-contact">Selected: <b>{contactPage.records.find((c) => c.id === contact)?.name || contacts.find((c) => c.id === contact)?.name || contacts.find((c) => c.id === contact)?.company}</b> <button type="button" className="link" onClick={() => { setContact(""); setApplyAdvance(false); }}>Clear</button></p>}
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
          <div>
            <input type="date" name="date" required defaultValue={today()} min={modal === "Bill" && !isOwner ? today() : undefined} max={today()} />
            {modal === "Bill" && !isOwner && <p className="field-help">Staff sales must be dated today. Ask the owner to enter a historical sale.</p>}
          </div>
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
      {modal === "Purchase" && canAddProduct && <button type="button" className="secondary-button" onClick={() => { setProductError(""); setAddingProduct(true); }}>+ Add product</button>}
      <div className="product-picker-search">
        <Field label="Search stock / product"><input value={productQuery} onChange={event => setProductQuery(event.target.value)} placeholder="Search name, SKU, barcode, colour, GSM, category, or UOM" /></Field>
        <div className="product-filter-grid">
          <Field label="Category"><GlassSelect aria-label="Filter products by category" value={productCategory} onValueChange={setProductCategory}><option value="">All categories</option>{productCategories.map(value => <option key={value} value={value}>{value}</option>)}</GlassSelect></Field>
          <Field label="Colour"><GlassSelect aria-label="Filter products by colour" value={productColor} onValueChange={setProductColor}><option value="">All colours</option>{productColors.map(value => <option key={value} value={value}>{value}</option>)}</GlassSelect></Field>
          <Field label="GSM"><GlassSelect aria-label="Filter products by GSM" value={productGsm} onValueChange={setProductGsm}><option value="">All GSM</option>{productGsms.map(value => <option key={value} value={String(value)}>{value}</option>)}</GlassSelect></Field>
          <Field label="UOM"><GlassSelect aria-label="Filter products by unit" value={productUnit} onValueChange={setProductUnit}><option value="">All units</option>{productUnits.map(value => <option key={value} value={value}>{value}</option>)}</GlassSelect></Field>
        </div>
        {hasProductFilters && <div className="product-filter-summary"><span>{selectableProducts.length} matching products</span><button type="button" className="link" onClick={() => { setProductQuery(""); setProductCategory(""); setProductColor(""); setProductGsm(""); setProductUnit(""); }}>Clear filters</button></div>}
        {productQuery.trim() && <div className="product-search-results" role="group" aria-label="Matching stock products">{selectableProducts.length ? selectableProducts.map(product => <button key={product.id} type="button" className="product-search-result" onClick={() => { addLine(product.id); setProductQuery(""); }}><span><strong>{product.name}</strong><small>{[product.sku, product.color, product.gsm != null ? `${product.gsm} GSM` : "", product.unit || "piece"].filter(Boolean).join(" · ")}</small></span><small>{stock(workingStore, product.id)} in stock</small></button>) : <p className="field-help">No matching stock product.</p>}</div>}
      <Field label="Or choose a product"><div className="server-select-field">
        <GlassSelect value="" onValueChange={(e) => { addLine(e); setProductQuery(""); }}>
          <option value="">Select product to add</option>
          {selectableProducts.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name} · {p.sku} · {stock(workingStore, p.id)} in stock
            </option>
          ))}
        </GlassSelect>
        </div>
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
            rows={lines.map((l, i) => {
              const product = workingStore.products.find(p => p.id === l.productId);
              const unit = tradeLineUnit(l, product);
              const wholeQuantity = requiresWholeQuantity(unit);
              return [
                <>
                  {pName(l.productId)}
                  <small>
                    {[product?.sku, product?.gsm ? `${product.gsm} GSM` : ""].filter(Boolean).join(" · ")}
                  </small>
                </>,
                product?.color || "—",
                <input
                  aria-label={`Quantity for ${pName(l.productId)}`}
                  data-barcode-quantity={l.productId}
                  className="trade-quantity-input"
                  type="number"
                  min={wholeQuantity ? 1 : 0.5}
                  step={wholeQuantity ? 1 : 0.001}
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
                <GlassSelect aria-label={`UOM for ${pName(l.productId)}`} value={unit} onValueChange={(value) => setLines(lines.map((x, n) => n === i ? { ...x, unit: value } : x))}>{units.map(unit => <option key={unit}>{unit}</option>)}</GlassSelect>,
                <input aria-label={`Number of rolls for ${pName(l.productId)}`} type="number" min="0" step="1" placeholder="Rolls" value={l.packageCount ?? ""} onChange={(e) => setLines(lines.map((x, n) => n === i ? { ...x, packageCount: e.target.value ? Number(e.target.value) : undefined } : x))} />,
                <input
                  aria-label={`Price for ${pName(l.productId)}`}
                  type="number"
                  min="1"
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
              ];
            })}
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
      {contact && <div className="payment-balance-summary" aria-live="polite">
        <div><span>{currentContactBalance > 0 ? modal === "Bill" ? "Customer balance due" : "Payable to supplier" : modal === "Bill" ? "Customer credit balance" : "Supplier credit due back"}</span><strong>{money(Math.abs(currentContactBalance))}</strong></div>
        <div><span>{modal === "Bill" ? "Available customer advance" : "Available supplier advance"}</span><strong>{money(availableAdvance)}</strong>{availableAdvance > 0 && <label className="checkbox-row payment-advance-toggle"><input type="checkbox" checked={applyAdvance} onChange={event => setApplyAdvance(event.target.checked)} /> Apply up to {money(Math.min(availableAdvance, billTotal))} of this advance to this {modal === "Bill" ? "invoice" : "purchase"}</label>}</div>
        {applyAdvance && <p className="field-help">Advance applied: {money(advanceToApply)} · paid now: {money(paidAmount)} · remaining due after posting: {money(Math.max(0, billTotal - advanceToApply - paidAmount))}</p>}
      </div>}
      <p className="form-hint">
        {modal === "Bill"
          ? contact
            ? "Post the bill to update this customer's ledger. Any unpaid amount is added to their outstanding balance."
            : "Enter the walk-in customer's details. A fully paid sale can be posted immediately; a sale with a remaining balance is recorded using Record unpaid bill."
          : "Use zero paid for credit; a partial payment leaves an outstanding supplier balance."}
        {" "}Cheques remain pending until marked cleared in Payments.
      </p>
      {unpaidWalkIn && <div className="payment-balance-summary" role="status"><div>
        <span>Unpaid bill</span>
        <strong>{money(Math.max(0, billTotal - paidAmount))} remaining</strong>
        <p className="field-help">Record this sale once with {money(paidAmount)} paid. The remaining amount stays on the bill for collection through Payments. Enter a customer name, company, or contact number above.</p>
      </div></div>}
      {!!insufficientStock.length && <div className="form-error" role="alert">{insufficientStock.map(({ productId, quantity, available }) => <p key={productId}>Insufficient stock for {pName(productId)}: {available} available, {quantity} requested.</p>)}</div>}
      {belowCost && <p className="form-error" role="status">Below-cost sale warning: at least one selling price is below its buying cost.</p>}
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
        <button className="secondary" value="draft" disabled={!lines.length || addingSupplier || addingCustomer || savingProduct || saving}>Save draft</button>
        <button className="primary" value={unpaidWalkIn ? "unpaid" : "post"} disabled={!lines.length || addingSupplier || addingCustomer || savingProduct || saving || !!insufficientStock.length}>
          {unpaidWalkIn ? "Record unpaid bill" : `Post ${modal === "Bill" ? "bill" : "purchase"}`}
        </button>
      </div>
    </form>
    {addingProduct && <Modal title="Add product to purchase" close={() => setAddingProduct(false)}>
      {productError && <p role="alert" className="form-error">{productError}</p>}
      <ProductForm s={s} editProduct={null} text={text} num={num}
        commitInline={saveProductCategory}
        setModal={() => setAddingProduct(false)}
        submit={async (event, fn) => {
          event.preventDefault(); setProductError("");
          try { await fn(new FormData(event.currentTarget)); }
          catch (error) { setProductError(error instanceof Error ? error.message : "Could not save product."); }
        }}
        commit={async (next) => {
          if (savingProduct) throw new Error("A product is already being saved.");
          setSavingProduct(true);
          const product = next.products.find(item => !s.products.some(existing => existing.id === item.id));
          try {
            if (!product) throw new Error("Could not identify the new product.");
            const nextStore = await addProduct(product, next.movements.find(movement => movement.productId === product.id && movement.type === "Opening")?.qty || 0);
            if (nextStore) {
              setWorkingStore(nextStore);
              setLines(current => [...current, { productId: product.id, unit: product.unit || "piece", qty: 1, price: modal === "Purchase" ? product.cost : product.price, cost: product.cost }]);
            }
            setAddingProduct(false);
          } finally { setSavingProduct(false); }
        }} />
    </Modal>}
    </>
  );
}

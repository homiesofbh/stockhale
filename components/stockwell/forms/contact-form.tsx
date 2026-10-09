"use client";
import { type Module } from "@/components/stockwell/navigation";
import { Field } from "@/components/stockwell/ui";
import { saveContact, uid, type Contact, type Store } from "@/lib/stockwell/model";
import type { Dispatch, SetStateAction } from "react";
import { type FormEvent } from "react";
type Props = {
  submit: (e: FormEvent<HTMLFormElement>, fn: (data: FormData) => void) => void;
  editContact: Contact | null;
  text: (f: FormData, key: string) => string;
  module: Module;
  commit: (next: Store, message: string) => void;
  s: Store;
  detailContact: Contact | null;
  setDetailContact: Dispatch<SetStateAction<Contact | null>>;
};
export function ContactForm({
  submit,
  editContact,
  text,
  module,
  commit,
  s,
  detailContact,
  setDetailContact,
}: Props) {
  return (
    <form
      onSubmit={(e) =>
        submit(e, (f) => {
          const c: Contact = {
            ...editContact,
            company: module === "Customers" ? text(f, "company") : editContact?.company,
            id: editContact?.id || uid(),
            name: text(f, "name"),
            phone: text(f, "phone"),
            email: text(f, "email"),
            address: text(f, "address"),
            ntn: module === "Suppliers" ? editContact?.ntn : text(f, "ntn"),
            contactPerson: text(f, "contactPerson"),
            mobile: text(f, "mobile"),
            salesTaxNumber: text(f, "salesTaxNumber"),
            description: text(f, "description"),
          };
          commit(saveContact(s, module === "Suppliers" ? "Supplier" : "Customer", c), "Contact saved.");
          if (detailContact?.id === c.id) setDetailContact(c);
        })
      }
    >
      <div className="form-grid">
        <div className="form-wide">
        <Field label={module === "Suppliers" ? "Supplier name" : "Customer / company name"}>
          <input
            name="name"
            required
            defaultValue={editContact?.name}
            autoFocus
          />
        </Field>
        </div>
        {module === "Customers" && <Field label="Company (optional)"><input name="company" defaultValue={editContact?.company || ""} maxLength={200} /></Field>}
        <Field label="Phone (optional)">
          <input name="phone" type="tel" defaultValue={editContact?.phone} />
        </Field>
        <Field label="Mobile (optional)"><input name="mobile" type="tel" defaultValue={editContact?.mobile || ""} /></Field>
        <Field label="Contact person (optional)"><input name="contactPerson" defaultValue={editContact?.contactPerson || ""} /></Field>
        <Field label="Email (optional)">
          <input name="email" type="email" defaultValue={editContact?.email} />
        </Field>
        <Field label="Address (optional)">
          <input name="address" defaultValue={editContact?.address} />
        </Field>
        {module === "Customers" && <Field label="NTN (optional)">
          <input name="ntn" defaultValue={editContact?.ntn || ""} />
        </Field>}
        <Field label="Sales-tax registration (optional)"><input name="salesTaxNumber" defaultValue={editContact?.salesTaxNumber || ""} /></Field>
        <div className="form-wide"><Field label="Description (optional)"><textarea name="description" defaultValue={editContact?.description || ""} maxLength={2000} /></Field></div>
      </div>
      {module === "Customers" && <p className="form-hint">Only a customer or company name is required. Walk-in bills automatically create or link a customer record.</p>}
      <div className="form-foot">
        <button className="primary">Save profile</button>
      </div>
    </form>
  );
}

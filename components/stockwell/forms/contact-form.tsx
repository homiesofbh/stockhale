"use client";
import { type Module } from "@/components/stockwell/navigation";
import { Field } from "@/components/stockwell/ui";
import { uid, type Contact, type Store } from "@/lib/stockwell/model";
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
            id: editContact?.id || uid(),
            name: text(f, "name"),
            phone: text(f, "phone"),
            email: text(f, "email"),
            address: text(f, "address"),
          };
          const key = module === "Suppliers" ? "suppliers" : "customers";
          if (!c.name) throw new Error("Name is required.");
          commit(
            {
              ...s,
              [key]: editContact
                ? s[key].map((x) => (x.id === c.id ? c : x))
                : [...s[key], c],
            },
            "Contact saved.",
          );
          if (detailContact?.id === c.id) setDetailContact(c);
        })
      }
    >
      <div className="form-grid">
        <Field label="Name">
          <input
            name="name"
            required
            defaultValue={editContact?.name}
            autoFocus
          />
        </Field>
        <Field label="Phone">
          <input name="phone" type="tel" defaultValue={editContact?.phone} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" defaultValue={editContact?.email} />
        </Field>
        <Field label="Address">
          <input name="address" defaultValue={editContact?.address} />
        </Field>
      </div>
      <div className="form-foot">
        <button className="primary">Save profile</button>
      </div>
    </form>
  );
}

"use client";
import { Table } from "@/components/stockwell/ui";
import {
  contactBalance,
  isPosted,
  money,
  type Contact,
  type Store,
  type Trade,
} from "@/lib/stockwell/model";
import { X } from "lucide-react";
import type { Dispatch, JSX, SetStateAction } from "react";
type Props = {
  module: "Suppliers" | "Customers";
  s: Store;
  matches: (...values: unknown[]) => boolean;
  setDetailContact: Dispatch<SetStateAction<Contact | null>>;
  setEditContact: Dispatch<SetStateAction<Contact | null>>;
  open: (name: string) => void;
  detailContact: Contact | null;
  basicHeaders: string[];
  tradeRows: (list: Trade[], supplier?: boolean) => (string | JSX.Element)[][];
};
export function ContactsView({
  module,
  s,
  matches,
  setDetailContact,
  setEditContact,
  open,
  detailContact,
  basicHeaders,
  tradeRows,
}: Props) {
  return (
    <>
      <section className="card">
        <Table
          headers={[
            module === "Customers" ? "Customer / company" : "Supplier name",
            "Contact details",
            "Address",
            "Outstanding balance",
            "",
          ]}
          rows={(module === "Suppliers" ? s.suppliers : s.customers)
            .filter((c) => matches(c.name, c.company, c.phone, c.mobile, c.email, c.address, c.ntn, c.contactPerson, c.salesTaxNumber, c.description))
            .map((c) => [
              <button className="link" onClick={() => setDetailContact(c)}>
                {c.name}
                {c.company && <small>{c.company}</small>}
                {c.ntn && <small>NTN: {c.ntn}</small>}
              </button>,
              <>
                {c.phone || "—"}
                <small>{c.mobile}</small>
                <small>{c.email}</small>
              </>,
              c.address || "—",
              money(
                contactBalance(
                  s,
                  module === "Suppliers" ? "Supplier" : "Customer",
                  c.id,
                ),
              ),
              <button
                className="link"
                onClick={() => {
                  setEditContact(c);
                  open("Contact");
                }}
              >
                Edit profile
              </button>,
            ])}
        />
      </section>
      {detailContact && (
        <section className="card contact-detail">
          <div className="section-head">
            <div>
              <h2>{detailContact.name}</h2>
              <p>
                {[detailContact.company, detailContact.contactPerson, detailContact.phone, detailContact.mobile, detailContact.email, detailContact.address, detailContact.ntn ? `NTN: ${detailContact.ntn}` : "", detailContact.salesTaxNumber ? `Sales tax: ${detailContact.salesTaxNumber}` : "", detailContact.description].filter(Boolean).join(" · ") || "No optional details provided."}
              </p>
            </div>
            <button
              className="icon-button"
              aria-label="Close contact history"
              onClick={() => setDetailContact(null)}
            >
              <X size={18} />
            </button>
          </div>
          <h3>
            {module === "Suppliers"
              ? "Purchase history"
              : "Billing & sales history"}
          </h3>
          <Table
            headers={
              module === "Suppliers"
                ? [
                    "Purchase",
                    "Supplier",
                    "Quantity",
                    "Net total",
                    "Status",
                    "Paid",
                    "Balance",
                    "",
                  ]
                : basicHeaders
            }
            rows={tradeRows(
              (module === "Suppliers" ? s.purchases : s.invoices).filter(
                (t) => t.contactId === detailContact.id,
              ),
              module === "Suppliers",
            )}
          />
          <h3>Payment history</h3>
          <Table
            headers={["Date", "Reference", "Amount", "Method", "Notes"]}
            rows={[
              ...(module === "Suppliers" ? s.purchases : s.invoices)
                .filter((t) => isPosted(t) && t.contactId === detailContact.id && t.paid > 0)
                .map((t) => [
                  t.date,
                  t.number,
                  money(t.paid),
                  t.method,
                  "Paid at creation",
                ]),
              ...s.payments
                .filter((p) => p.contactId === detailContact.id)
                .map((p) => [
                  p.date,
                  [...s.invoices, ...s.purchases].find(
                    (t) => t.id === p.tradeId,
                  )?.number,
                  money(p.amount),
                  p.method,
                  p.notes,
                ]),
            ]}
          />
        </section>
      )}
    </>
  );
}

"use client";
import { Badge, Stat, Table } from "@/components/stockwell/ui";
import { money, type Store } from "@/lib/stockwell/model";
type Props = {
  receivables: number;
  payables: number;
  cash: number;
  bank: number;
  s: Store;
  cName: (id: string, supplier?: boolean) => string;
  inRange: (date: string) => boolean;
  matches: (...values: unknown[]) => boolean;
};
export function PaymentsView({
  receivables,
  payables,
  cash,
  bank,
  s,
  cName,
  inRange,
  matches,
}: Props) {
  return (
    <>
      <div className="stats-grid three">
        <Stat
          label="Customer receivables"
          value={money(receivables)}
          detail="Outstanding bills"
          accent
        />
        <Stat
          label="Supplier payables"
          value={money(payables)}
          detail="Outstanding purchases"
        />
        <Stat
          label="Cash / Bank"
          value={money(cash)}
          detail={`Bank ${money(bank)}`}
        />
      </div>
      <section className="card">
        <div className="section-head">
          <h2>Payment history</h2>
          <p>Includes payments collected when a transaction was created.</p>
        </div>
        <Table
          headers={[
            "Date",
            "Contact",
            "Reference",
            "Type",
            "Amount",
            "Method",
            "Account head",
          ]}
          rows={[
            ...s.invoices
              .filter((t) => t.paid > 0)
              .map((t) => ({
                date: t.date,
                contact: cName(t.contactId),
                reference: t.number,
                kind: "Customer",
                amount: t.paid,
                method: t.method,
                head: t.head,
              })),
            ...s.purchases
              .filter((t) => t.paid > 0)
              .map((t) => ({
                date: t.date,
                contact: cName(t.contactId, true),
                reference: t.number,
                kind: "Supplier",
                amount: t.paid,
                method: t.method,
                head: t.head,
              })),
            ...s.payments.map((p) => ({
              date: p.date,
              contact: cName(p.contactId, p.kind === "Supplier"),
              reference:
                [...s.invoices, ...s.purchases].find((t) => t.id === p.tradeId)
                  ?.number || "",
              kind: p.kind,
              amount: p.amount,
              method: p.method,
              head: p.head,
            })),
          ]
            .filter(
              (p) =>
                inRange(p.date) &&
                matches(p.contact, p.reference, p.kind, p.head),
            )
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((p) => [
              p.date,
              p.contact,
              p.reference,
              <Badge tone={p.kind === "Customer" ? "green" : "amber"}>
                {p.kind}
              </Badge>,
              money(p.amount),
              p.method,
              p.head,
            ])}
        />
      </section>
    </>
  );
}

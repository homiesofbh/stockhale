"use client";
import { ChequeRegister } from "./cheque-register";
import type { Actor } from "@/lib/stockwell/operations";
import { BankVouchersView } from "./bank-vouchers-view";
import { Badge, Stat, Table } from "@/components/stockwell/ui";
import { clearCheque, money, type Store } from "@/lib/stockwell/model";
type Props = {
  actor: Actor;
  receivables: number;
  payables: number;
  cash: number;
  bank: number;
  s: Store;
  cName: (id: string, supplier?: boolean) => string;
  inRange: (date: string) => boolean;
  matches: (...values: unknown[]) => boolean;
  commit: (next: Store, message: string) => void;
};
export function PaymentsView({
  actor,
  receivables,
  payables,
  cash,
  bank,
  s,
  cName,
  inRange,
  matches,
  commit,
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
      <ChequeRegister s={s} actor={actor} matches={matches} commit={commit} />
      <BankVouchersView actor={actor} s={s} matches={matches} inRange={inRange} commit={commit} />
      <section className="card mt-8">
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
            "Cheque details",
            "Account head",
            "Action",
          ]}
          rows={[
            ...s.invoices
              .filter((t) => t.status !== "draft" && t.status !== "void" && t.paid > 0)
              .map((t) => ({
                date: t.date,
                contact: t.contactId ? cName(t.contactId) : [t.walkInName, t.walkInCompany, t.walkInPhone].filter(Boolean).join(" · ") || "Walk-in customer",
                reference: t.number,
                kind: "Customer",
                amount: t.paid,
                method: t.method,
                cheque: "",
                chequeStatus: undefined,
                paymentId: "",
                head: t.head,
              })),
            ...s.purchases
              .filter((t) => t.status !== "draft" && t.status !== "void" && t.paid > 0)
              .map((t) => ({
                date: t.date,
                contact: cName(t.contactId, true),
                reference: t.number,
                kind: "Supplier",
                amount: t.paid,
                method: t.method,
                cheque: "",
                chequeStatus: undefined,
                paymentId: "",
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
              method: p.chequeStatus ? `Cheque ${p.chequeStatus}` : p.method,
              cheque: p.chequeNumber ? `${p.chequeNumber} · ${p.chequeBank} · due ${p.chequeDate}${p.clearedDate ? ` · cleared ${p.clearedDate}` : ""}` : "",
              chequeStatus: p.chequeStatus,
              paymentId: p.id,
              head: p.head,
            })),
          ]
            .filter(
              (p) =>
                inRange(p.date) &&
                matches(p.contact, p.reference, p.kind, p.head, p.cheque),
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
              p.cheque,
              p.head,
              p.chequeStatus === "pending" ? "Use cheque register" : "",
            ])}
        />
      </section>
    </>
  );
}

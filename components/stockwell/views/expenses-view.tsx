"use client";
import { Table } from "@/components/stockwell/ui";
import { attachmentDownloadUrl } from "@/lib/stockwell/attachment-client";
import { useState } from "react";
import { money, type Store } from "@/lib/stockwell/model";
type Props = {
  s: Store;
  inRange: (date: string) => boolean;
  matches: (...values: unknown[]) => boolean;
  open: (name: string) => void;
};
export function ExpensesView({ s, inRange, matches, open }: Props) {
  const [error, setError] = useState("");
  const links = (attachments: any[] = []) => <>{attachments.map(a => <button key={a.id} className="link" onClick={async () => { try { window.open(await attachmentDownloadUrl(a.key), "_blank", "noopener,noreferrer"); } catch (e) { setError(e instanceof Error ? e.message : "Could not open attachment."); } }}>{a.name}</button>)}</>;
  return (
    <>
      <div className="sub-actions">
        <span>
          Total in view:{" "}
          <b>
            {money(
              s.expenses
                .filter(
                  (e) =>
                    inRange(e.date) && matches(e.category, e.notes, e.head),
                )
                .reduce((n, e) => n + e.amount, 0),
            )}
          </b>
        </span>
        <button
          className="secondary-button"
          onClick={() => open("Expense category")}
        >
          Expense categories
        </button>
      </div>
      <section className="card">
        {error && <p className="form-error" role="alert">{error}</p>}
        <Table
          headers={[
            "Date",
            "Category",
            "Account head",
            "Amount",
            "Paid from",
            "Notes",
            "Attachments",
          ]}
          rows={s.expenses
            .filter(
              (e) => inRange(e.date) && matches(e.category, e.notes, e.head),
            )
            .slice()
            .reverse()
            .map((e) => [
              e.date,
              e.category,
              e.head,
              money(e.amount),
              e.method,
              e.notes || "—",
              links(e.attachments),
            ])}
        />
      </section>
    </>
  );
}

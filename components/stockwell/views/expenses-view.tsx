"use client";
import { ServerPagination, Table } from "@/components/stockwell/ui";
import { attachmentDownloadUrl, deleteAttachment } from "@/lib/stockwell/attachment-client";
import { useState } from "react";
import { money, type Store } from "@/lib/stockwell/model";
import { useServerCollection } from "@/lib/stockwell/use-server-collection";
type Props = {
  s: Store;
  category: string;
  query: string;
  from: string;
  to: string;
  open: (name: string) => void;
  owner: boolean;
  memberName: (id?: string, name?: string) => string;
  commit: (next: Store, message: string) => void;
};
export function ExpensesView({ s, category, query, from, to, open, owner, memberName, commit }: Props) {
  const [error, setError] = useState("");
  const result = useServerCollection<any>({ collection: "expenses", query, from, to, category, pageSize: 25 });
  const links = (attachments: any[] = [], expenseId = "") => <>{attachments.map(a => <span key={a.id}><button className="link" onClick={async () => { try { window.open(await attachmentDownloadUrl(a.key), "_blank", "noopener,noreferrer"); } catch (e) { setError(e instanceof Error ? e.message : "Could not open attachment."); } }}>{a.name}</button>{owner && <button className="link" onClick={async () => { if (!confirm("Delete this attachment?")) return; try { await deleteAttachment(a.key); commit({ ...s, expenses: s.expenses.map(e => e.id === expenseId ? { ...e, attachments: (e.attachments || []).filter(x => x.id !== a.id) } : e) }, "Attachment deleted."); } catch (e) { setError(e instanceof Error ? e.message : "Could not delete attachment."); } }}>Delete</button>}</span>)}</>;
  const visibleExpenses = result.records;
  const total = result.aggregates?.total || 0;
  return (
    <>
      <div className="sub-actions">
        <span>
          {result.count} expenses · Total in view: {" "}
          <b>
            {money(
              total,
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
        {result.error && <p className="form-error" role="alert">{result.error}</p>}
        <Table
          headers={[
            "Date",
            "Added by",
            "Category",
            "Account head",
            "Amount",
            "Paid from",
            "Notes",
            "Attachments",
          ]}
          rows={visibleExpenses.map((e) => [
              e.date,
              memberName(e.createdBy, e.createdByName),
              e.category,
              e.head,
              money(e.amount),
              e.method,
              e.notes || "—",
              links(e.attachments, e.id),
            ])}
        />
        <ServerPagination page={result.page} pageCount={result.pageCount} count={result.count} pageSize={result.pageSize} setPage={result.setPage} />
      </section>
    </>
  );
}

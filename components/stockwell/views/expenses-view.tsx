"use client";
import { Table } from "@/components/stockwell/ui";
import { attachmentDownloadUrl, scheduleAttachmentDeletion } from "@/lib/stockwell/attachment-client";
import { useState } from "react";
import { money, type Expense, type Store } from "@/lib/stockwell/model";
type Props = {
  s: Store;
  inRange: (date: string) => boolean;
  matches: (...values: unknown[]) => boolean;
  category: string;
  open: (name: string) => void;
  owner: boolean;
  memberName: (id?: string, name?: string) => string;
  commit: (next: Store, message: string) => Promise<unknown>;
  workspaceId: string;
  actorId: string;
  onEdit: (expense: Expense) => void;
};
export function ExpensesView({ s, inRange, matches, category, open, owner, memberName, commit, workspaceId, actorId, onEdit }: Props) {
  const [error, setError] = useState("");
  const links = (attachments: any[] = [], expenseId = "") => <>{attachments.map(a => <span key={a.id}><button className="link" onClick={async () => { try { window.open(await attachmentDownloadUrl(a.key), "_blank", "noopener,noreferrer"); } catch (e) { setError(e instanceof Error ? e.message : "The attachment could not be opened. Check your connection and try again."); } }}>{a.name}</button>{owner && <button className="link" onClick={async () => { if (!confirm("Delete this attachment?")) return; try { await scheduleAttachmentDeletion({ workspaceId, actorId, key: a.key }); await commit({ ...s, expenses: s.expenses.map(e => e.id === expenseId ? { ...e, attachments: (e.attachments || []).filter(x => x.id !== a.id) } : e) }, "Attachment removed. Cleanup will finish after sync."); } catch (e) { setError(e instanceof Error ? e.message : "The attachment could not be removed. Check your connection and try again."); } }}>Delete</button>}</span>)}</>;
  const visibleExpenses = s.expenses.filter(
    (e) => inRange(e.date) && (category === "All" || e.category === category) && matches(e.category, e.notes, e.head),
  );
  const total = visibleExpenses.reduce((n, e) => n + e.amount, 0);
  return (
    <>
      <section className="inventory-value-summary expense-total-summary" aria-label="Expense total in view">
        <div><span className="eyebrow">Selected records</span><h2>Total expenses in view</h2><p>Based on the current date, category, and search filters.</p></div>
        <div className="inventory-value-amount"><strong>{money(total)}</strong><span>{visibleExpenses.length} expense {visibleExpenses.length === 1 ? "entry" : "entries"}</span></div>
      </section>
      <div className="sub-actions">
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
            "Added by",
            "Category",
            "Account head",
            "Amount",
            "Paid from",
            "Notes",
            "Attachments",
            ...(owner ? ["Actions"] : []),
          ]}
          rows={visibleExpenses
            .slice()
            .reverse()
            .map((e) => [
              e.date,
              memberName(e.createdBy, e.createdByName),
              e.category,
              e.head,
              money(e.amount),
              e.method,
              e.notes || "—",
              links(e.attachments, e.id),
              ...(owner ? [<button className="link" onClick={() => onEdit(e)} aria-label={`Edit expense from ${e.date}`}>Edit</button>] : []),
            ])}
        />
      </section>
    </>
  );
}

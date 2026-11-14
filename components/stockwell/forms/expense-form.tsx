"use client";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { Field } from "@/components/stockwell/ui";
import { saveExpense, previousDate, type Actor } from "@/lib/stockwell/operations";
import { paymentAccountId, round, today, uid, type Expense, type Store } from "@/lib/stockwell/model";
import { useState, type FormEvent } from "react";
import { uploadAttachment } from "@/lib/stockwell/attachment-client";
type Props = {
  submit: (e: FormEvent<HTMLFormElement>, fn: (data: FormData) => void | Promise<void>) => void;
  num: (f: FormData, key: string) => number;
  commit: (next: Store, message: string) => Promise<void>;
  s: Store;
  actor: Actor;
  workspaceId: string;
  text: (f: FormData, key: string) => string;
  commitInline: (next: Store, message: string) => Promise<void>;
  expense?: Expense;
  onSaved?: () => void;
};
export function ExpenseForm({ submit, num, commit, commitInline, s, text, actor, workspaceId, expense, onSaved }: Props) {
  const [category, setCategory] = useState(expense?.category || s.expenseCategories[0] || "");
  const [head, setHead] = useState(expense?.head || (s.heads.includes("Expenses") ? "Expenses" : ""));
  const [method, setMethod] = useState(expense?.method || "Cash");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [categoryError, setCategoryError] = useState("");
  return (
    <form
      onSubmit={(e) =>
        submit(e, async (f) => {
          const amount = num(f, "amount");
          if (!Number.isFinite(amount) || amount <= 0)
            throw new Error("Enter an expense amount greater than Rs 0.00. Use up to two decimal places.");
          const id = expense?.id || uid();
          const next = saveExpense(s, { ...(expense || {}), id, date: text(f, "date"), category, head, amount: round(amount), financialAccountId: paymentAccountId(s, method) ?? (expense?.method === method ? expense.financialAccountId : undefined), method, notes: text(f, "notes"), createdBy: expense?.createdBy || actor.id, createdByName: expense?.createdByName || actor.name, attachments: expense?.attachments }, actor);
          const file = (f.get("attachment") as File)?.size ? (f.get("attachment") as File) : undefined;
          const attachment = file ? await uploadAttachment(file, "expense", id, workspaceId) : undefined;
          await commit(
            attachment ? { ...next, expenses: next.expenses.map(item => item.id === id ? { ...item, attachments: [...(item.attachments || []), attachment] } : item) } : next,
            expense ? "Expense updated." : "Expense recorded.",
          );
          onSaved?.();
        })
      }
    >
      <div className="form-grid">
        <Field label="Expense category">
          <GlassSelect name="category" value={category} onValueChange={setCategory} required>
            {!category && <option value="">Select category</option>}
            {s.expenseCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </GlassSelect>
        </Field>
        <div className="inline-field-action">
          <button type="button" className="secondary-button" onClick={() => { setAddingCategory(!addingCategory); setCategoryError(""); }}>
            {addingCategory ? "Cancel category" : "Add category"}
          </button>
        </div>
        <Field label="Account head">
          <GlassSelect name="head" value={head} onValueChange={setHead} required>
            {!head && <option value="">Select account head</option>}
            {s.heads.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </GlassSelect>
        </Field>
        <Field label="Amount (PKR)">
          <input name="amount" type="number" min="0.01" step="0.01" defaultValue={expense?.amount} required />
        </Field>
        <Field label="Date">
          <input name="date" type="date" defaultValue={expense?.date || today()} min={actor.role === "owner" ? undefined : previousDate(today(), 2)} max={today()} required />
        </Field>
        <Field label="Paid from">
          <GlassSelect name="method" value={method} onValueChange={setMethod} required>
            <option>Cash</option>
            {expense && expense.method !== "Cash" && !(s.financialAccounts || []).some(account => account.name === expense.method && account.active !== false) && <option value={expense.method}>{expense.method} (inactive)</option>}
            {(s.financialAccounts || []).filter(a => a.active !== false).map((account) => <option key={account.id} value={account.name}>{account.name}</option>)}
          </GlassSelect>
        </Field>
        <Field label="Notes / details">
          <input name="notes" defaultValue={expense?.notes || ""} />
        </Field>
        <Field label="Evidence attachment (PDF/JPG/PNG/WEBP, max 5 MB)"><input name="attachment" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" /></Field>
      </div>
      {addingCategory && <fieldset className="inline-supplier">
        <legend>New expense category</legend>
        <div className="form-grid">
          <Field label="Category name"><input value={newCategory} autoFocus onChange={(e) => setNewCategory(e.target.value)} required /></Field>
        </div>
        {categoryError && <p className="form-error" role="alert">{categoryError}</p>}
        <div className="form-foot">
          <button type="button" className="primary" onClick={async () => {
            const name = newCategory.trim();
            if (!name) return setCategoryError("Enter a name for the expense category.");
            if (s.expenseCategories.some((c) => c.toLowerCase() === name.toLowerCase())) return setCategoryError("That expense category already exists. Enter a different name.");
            try {
              await commitInline({ ...s, expenseCategories: [...s.expenseCategories, name] }, "Expense category added.");
              setCategory(name);
              setNewCategory("");
              setAddingCategory(false);
            } catch (error) { setCategoryError(error instanceof Error ? error.message : "The category could not be added. Check that its name is unique and try again."); }
          }}>Save category</button>
        </div>
      </fieldset>}
      <div className="form-foot">
        <button className="primary">{expense ? "Save changes" : "Save expense"}</button>
      </div>
    </form>
  );
}

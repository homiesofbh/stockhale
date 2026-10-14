"use client";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { Field } from "@/components/stockwell/ui";
import { saveExpense, previousDate, type Actor } from "@/lib/stockwell/operations";
import { paymentAccountId, round, today, uid, type Store } from "@/lib/stockwell/model";
import { useState, type FormEvent } from "react";
import { uploadAttachment } from "@/lib/stockwell/attachment-client";
type Props = {
  submit: (e: FormEvent<HTMLFormElement>, fn: (data: FormData) => void | Promise<void>) => void;
  num: (f: FormData, key: string) => number;
  commit: (next: Store, message: string) => void;
  s: Store;
  actor: Actor;
  text: (f: FormData, key: string) => string;
};
export function ExpenseForm({ submit, num, commit, s, text, actor }: Props) {
  const [category, setCategory] = useState(s.expenseCategories[0] || "");
  const [newCategories, setNewCategories] = useState<string[]>([]);
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const categories = [...s.expenseCategories, ...newCategories.filter(name => !s.expenseCategories.some(existing => existing.toLowerCase() === name.toLowerCase()))];
  function addCategory() {
    const name = categoryName.trim();
    if (!name) { setCategoryError("Enter a category name."); return; }
    const existing = categories.find(value => value.toLowerCase() === name.toLowerCase());
    if (!existing) setNewCategories(values => [...values, name]);
    setCategory(existing || name);
    setAddingCategory(false);
    setCategoryName("");
    setCategoryError("");
  }
  return (
    <form
      onSubmit={(e) =>
        submit(e, async (f) => {
          if (addingCategory) throw new Error("Add or cancel the new category before saving the expense.");
          const amount = num(f, "amount");
          if (!Number.isFinite(amount) || amount <= 0)
            throw new Error("Amount must be greater than zero.");
          const id = uid();
          const file = (f.get("attachment") as File)?.size ? (f.get("attachment") as File) : undefined;
          const attachment = file ? await uploadAttachment(file, "expense", id) : undefined;
          commit(
            saveExpense({ ...s, expenseCategories: categories }, { id, date: text(f, "date"), category: text(f, "category"), head: text(f, "head"), amount: round(amount), financialAccountId: paymentAccountId(s, text(f, "method")), method: text(f, "method"), notes: text(f, "notes"), attachments: attachment ? [attachment] : undefined }, actor),
            "Expense recorded.",
          );
        })
      }
    >
      <div className="form-grid">
        <Field label="Expense category">
          <div>
          <GlassSelect aria-label="Expense category" name="category" value={category} onValueChange={setCategory}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </GlassSelect>
          {!addingCategory && <button type="button" className="link" onClick={() => setAddingCategory(true)}>+ Add category</button>}
          {addingCategory && <div>
            <input aria-label="New expense category name" value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder="Category name" maxLength={100} onKeyDown={event => {
              if (event.key === "Enter") { event.preventDefault(); addCategory(); }
            }} />
            <button type="button" className="secondary-button" onClick={addCategory}>Add category</button>
            <button type="button" className="link" onClick={() => { setAddingCategory(false); setCategoryName(""); setCategoryError(""); }}>Cancel</button>
            {categoryError && <p className="form-error" role="alert">{categoryError}</p>}
          </div>}
          </div>
        </Field>
        <Field label="Account head">
          <GlassSelect name="head" defaultValue="Expenses">
            {s.heads.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </GlassSelect>
        </Field>
        <Field label="Amount (PKR)">
          <input name="amount" type="number" min="0.01" step="0.01" required />
        </Field>
        <Field label="Date">
          <input name="date" type="date" defaultValue={today()} min={actor.role === "owner" ? undefined : previousDate(today(), 2)} max={today()} required />
        </Field>
        <Field label="Paid from">
          <GlassSelect name="method">
            <option>Cash</option>
            {(s.financialAccounts || []).filter(a => a.active !== false).map((account) => <option key={account.id}>{account.name}</option>)}
          </GlassSelect>
        </Field>
        <Field label="Notes / details">
          <input name="notes" />
        </Field>
        <Field label="Evidence attachment (PDF/JPG/PNG/WEBP, max 5 MB)"><input name="attachment" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" /></Field>
      </div>
      <div className="form-foot">
        <button className="primary">Save expense</button>
      </div>
    </form>
  );
}

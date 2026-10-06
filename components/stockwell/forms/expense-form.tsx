"use client";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { Field } from "@/components/stockwell/ui";
import { round, today, uid, type Store } from "@/lib/stockwell/model";
import { type FormEvent } from "react";
type Props = {
  submit: (e: FormEvent<HTMLFormElement>, fn: (data: FormData) => void) => void;
  num: (f: FormData, key: string) => number;
  commit: (next: Store, message: string) => void;
  s: Store;
  text: (f: FormData, key: string) => string;
};
export function ExpenseForm({ submit, num, commit, s, text }: Props) {
  return (
    <form
      onSubmit={(e) =>
        submit(e, (f) => {
          const amount = num(f, "amount");
          if (!Number.isFinite(amount) || amount <= 0)
            throw new Error("Amount must be greater than zero.");
          commit(
            {
              ...s,
              expenses: [
                ...s.expenses,
                {
                  id: uid(),
                  date: text(f, "date"),
                  category: text(f, "category"),
                  head: text(f, "head"),
                  amount: round(amount),
                  method: text(f, "method") as "Cash" | "Bank",
                  notes: text(f, "notes"),
                },
              ],
            },
            "Expense recorded.",
          );
        })
      }
    >
      <div className="form-grid">
        <Field label="Expense category">
          <GlassSelect name="category">
            {s.expenseCategories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </GlassSelect>
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
          <input name="date" type="date" defaultValue={today()} required />
        </Field>
        <Field label="Paid from">
          <GlassSelect name="method">
            <option>Cash</option>
            <option>Bank</option>
          </GlassSelect>
        </Field>
        <Field label="Notes / details">
          <input name="notes" />
        </Field>
      </div>
      <div className="form-foot">
        <button className="primary">Save expense</button>
      </div>
    </form>
  );
}

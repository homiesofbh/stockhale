"use client";
import { Field } from "@/components/stockwell/ui";
import { adjustStock, stock, today, type Store } from "@/lib/stockwell/model";
import { type FormEvent } from "react";
type Props = {
  submit: (e: FormEvent<HTMLFormElement>, fn: (data: FormData) => void) => void;
  commit: (next: Store, message: string) => void;
  s: Store;
  text: (f: FormData, key: string) => string;
  num: (f: FormData, key: string) => number;
};
export function AdjustmentForm({ submit, commit, s, text, num }: Props) {
  return (
    <form
      onSubmit={(e) =>
        submit(e, (f) =>
          commit(
            adjustStock(
              s,
              text(f, "product"),
              num(f, "qty"),
              text(f, "reason"),
              text(f, "date"),
            ),
            "Stock adjustment recorded.",
          ),
        )
      }
    >
      <div className="form-grid">
        <Field label="Product">
          <select name="product" required>
            <option value="">Select product</option>
            {s.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {stock(s, p.id)} in stock
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" name="date" required defaultValue={today()} />
        </Field>
        <Field label="Quantity change (+ in / − out)">
          <input type="number" name="qty" step="0.001" required />
        </Field>
        <Field label="Reason">
          <input name="reason" required />
        </Field>
      </div>
      <div className="form-foot">
        <button className="primary">Record adjustment</button>
      </div>
    </form>
  );
}

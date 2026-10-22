"use client";

import { useState } from "react";
import { BankVoucherForm } from "../forms/bank-voucher-form";
import { GlassSelect } from "../glass-select";
import { Modal } from "../ui";
import {
  cashStatement,
  closeDay,
  reopenDay,
  type Actor,
} from "@/lib/stockwell/operations";
import { bankStatement, nextBankVoucherNumber } from "@/lib/stockwell/bank-vouchers";
import { money, profit, round, today, uid, type Store } from "@/lib/stockwell/model";
import { Badge, Field, InfoTip, Table } from "../ui";
import { ReasonDialog } from "../reason-dialog";

export function DailyClosingView({
  s,
  actor,
  commit,
}: {
  s: Store;
  actor: Actor;
  commit: (s: Store, message: string) => void;
}) {
  const formatClosingDate = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return new Intl.DateTimeFormat("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Karachi",
    }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  };
  const [date, setDate] = useState(today());
  const [error, setError] = useState("");
  const [reopening, setReopening] = useState("");
  const [counted, setCounted] = useState("");
  const [unknownReason, setUnknownReason] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [closingStatus, setClosingStatus] = useState("All");

  const cash = cashStatement(s, date, date);
  const activeClose = s.dailyCloses?.find(
    (c) => c.date === date && c.status === "closed"
  );
  const expected = cashStatement(s, "", date).closing;
  const bankBalances = (s.financialAccounts || []).map((account) => ({
    account,
    day: bankStatement(s, account, date, date),
    closing: bankStatement(s, account, "", date).closing,
  }));
  const recordedProfit = profit(s, date, date);
  const variance =
    counted !== "" && Number.isFinite(Number(counted))
      ? round(Number(counted) - expected)
      : null;
  const unknownExplanation =
    variance === null || variance === 0
      ? ""
      : `Unexplained cash ${variance < 0 ? "shortage" : "overage"} of ${money(Math.abs(variance))}; pending investigation.`;

  return (
    <section className="card mt-8">
      <div className="section-head">
        <div>
          <h2>Daily closing and reconciliation</h2>
          <p>
            Count the cash drawer before closing. A closed day locks new
            entries and corrections on or before that date.
          </p>
        </div>
        <Field label="Closing date">
          <input
            type="date"
            value={date}
            max={today()}
            onChange={(e) => {
              setDate(e.target.value || today());
              setCounted("");
              setUnknownReason(false);
              setError("");
            }}
          />
        </Field>
      </div>

      <div className="closing-ledger-grid">
        <div>
          <div className="closing-ledger-heading">
            <div>
              <div className="closing-title-row">
                <h3>Cash in hand · drawer</h3>
                <InfoTip label="How drawer cash is calculated">
                  <span>Expected cash = opening cash + cash received − cash paid out.</span>
                  <span>Cash received includes the cash-paid part of sales, customer payments received in cash, partner contributions in cash, and posted cash debits. Cash paid out includes cash-paid purchases, supplier payments, expenses, partner drawings, and posted cash credits.</span>
                  <span>A debit to the Cash asset account increases the drawer. A credit decreases it. Bank, wallet, cheque, and credit sales do not count as physical drawer cash. A supplier refund recorded as a negative supplier payment increases cash.</span>
                  <span>For this date: {money(cash.opening + cash.openingAdjustment)} + {money(cash.receipts)} − {money(cash.payments)} = {money(cash.closing)}.</span>
                </InfoTip>
              </div>
              <p>Only physical cash belongs in the counted cash field below.</p>
            </div>
            <div className="journal-register-actions"><Badge tone="green">Drawer reconciliation</Badge>{actor.role === "owner" && <button className="secondary" onClick={() => setDepositOpen(true)}>Deposit cash to bank</button>}</div>
          </div>
          <Table
            headers={["Opening cash", "Cash received", "Cash paid out", "Expected cash in hand"]}
            rows={[[
              money(cash.opening + cash.openingAdjustment),
              money(cash.receipts),
              money(cash.payments),
              money(cash.closing),
            ]]}
          />
        </div>

        <div>
          <div className="closing-ledger-heading">
            <div>
              <div className="closing-title-row">
                <h3>Cash in bank · wallets</h3>
                <InfoTip label="How bank and wallet balances are calculated">
                  <span>Each account is shown separately: opening balance + money received − money paid = balance through the selected date.</span>
                  <span>Receipts increase that bank or wallet; payments decrease it. Transfers move money between accounts and do not change the cash drawer. A cheque affects a bank only when it is cleared.</span>
                  <span>These balances are separate from physical cash in the drawer.</span>
                </InfoTip>
              </div>
              <p>Bank receipts/payments are movements; the balance is what remains in each account.</p>
            </div>
            <Badge>Bank balances</Badge>
          </div>
          <Table
            headers={["Bank / wallet", "Received today", "Paid today", "Balance through date"]}
            rows={bankBalances.map(({ account, day, closing }) => [
              account.name,
              money(day.receipts),
              money(day.payments),
              money(closing),
            ])}
            empty="No bank or wallet accounts configured"
          />
        </div>
      </div>

      <div className="closing-profit-heading">
        <h3>Recorded profit summary</h3>
        <InfoTip label="How recorded net profit is calculated">
          <span>Net profit = net sales − cost of goods sold − recorded expenses − damaged stock cost.</span>
          <span>Net sales subtract discounts and sales returns. Cost of goods sold uses the recorded cost of sold items, less the cost of returned items. Damage uses the recorded cost of damaged stock.</span>
          <span>This summary uses recorded transactions for the selected date. It does not use the drawer count or unexplained cash difference.</span>
          <span>For this date: {money(recordedProfit.revenue)} − {money(recordedProfit.cogs)} − {money(recordedProfit.expenses)} − {money(recordedProfit.damage)} = {money(recordedProfit.net)}.</span>
        </InfoTip>
      </div>
      <div className="closing-history-head"><div><h3>Closing history</h3><p>Closed and reopened days remain in this register for audit.</p></div><Field label="Status"><GlassSelect value={closingStatus} onValueChange={setClosingStatus}><option>All</option><option>Closed</option><option>Reopened</option></GlassSelect></Field></div>
      <Table
        headers={[
          "Recorded net sales",
          "Cost of goods sold",
          "Recorded expenses",
          "Damaged stock cost",
          "Recorded net profit",
        ]}
        rows={[
          [
            money(recordedProfit.revenue),
            money(recordedProfit.cogs),
            money(recordedProfit.expenses),
            money(recordedProfit.damage),
            money(recordedProfit.net),
          ],
        ]}
      />

      <div className="form-hint closing-variance-help">
        <InfoTip label="How the cash difference is calculated">
          <span>Cash difference = counted cash − expected cash.</span>
          <span>A negative result is a shortage; a positive result is an overage. Saving a difference records the count and explanation only. It does not change cash, expenses, or profit. Record the confirmed receipt, expense, or correction separately.</span>
          <span>Current expected drawer cash: {money(expected)}.</span>
        </InfoTip>
        <span className="closing-variance-copy">Need help understanding the count? Select the info icon to expand the explanation.</span>
      </div>

      {actor.role === "owner" && !activeClose && (
        <form
          className="daily-close-form mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              commit(
                closeDay(
                  s,
                  date,
                  Number(f.get("counted")),
                  [
                    unknownReason ? unknownExplanation : "",
                    String(f.get("explanation") || "").trim(),
                  ]
                    .filter(Boolean)
                    .join(" "),
                  actor
                ),
                "Day closed. Counted cash and variance saved."
              );
              setError("");
              setCounted("");
              setUnknownReason(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Closing failed.");
            }
          }}
        >
          <div className="form-grid">
            <Field label="Counted cash in drawer (cash in hand, PKR)">
              <input
                name="counted"
                type="number"
                min="0"
                step="0.01"
                required
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
              />
            </Field>
            <Field label="Variance explanation">
              <textarea
                key={date}
                name="explanation"
                className="mr-2"
                maxLength={2000}
                required={
                  variance !== null && variance !== 0 && !unknownReason
                }
              placeholder={`Expected cash in hand is ${money(expected)}. Explain any shortage, overage, forgotten expense, or unrecorded receipt.`}
              />
            </Field>
          </div>

          {variance !== null && (
            <p role="status">
              <Badge tone={variance === 0 ? "green" : "amber"}>
                {variance === 0
                  ? "Cash matches"
                  : `${money(Math.abs(variance))} ${variance < 0 ? "shortage" : "overage"
                  }`}
              </Badge>
            </p>
          )}

          {variance !== null && variance !== 0 && (
            <label className="form-hint">
              <input
                type="checkbox"
                checked={unknownReason}
                onChange={(e) => setUnknownReason(e.target.checked)}
              />{" "}
              Reason unknown — save as an unexplained cash difference pending
              investigation
            </label>
          )}

          <p className="form-hint">
            You can close with an unexplained difference. It is saved with the
            cash count and does not change recorded expenses, profit or the
            cash ledger. When you find the cause, reopen the day, record the
            confirmed expense, receipt or correction, then close again. Later
            closed days must be reopened first.
          </p>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="form-foot">
            <button className="primary">Confirm daily close</button>
          </div>
        </form>
      )}

      <Table
        headers={[
          "Business date",
          "Expected cash",
          "Counted cash",
          "Variance",
          "Explanation",
          "Status",
          "Recorded by / at",
          "Action",
        ]}
        rows={[...(s.dailyCloses || [])]
          .sort(
            (a, b) =>
              b.date.localeCompare(a.date) ||
              b.closedAt.localeCompare(a.closedAt)
          )
          .map((c) => [
            <time key="date" dateTime={c.date}>{formatClosingDate(c.date)}</time>,
            money(c.expected),
            money(c.counted),
            money(c.variance),
            c.explanation || "—",
            <Badge
              key="status"
              tone={c.status === "closed" ? "green" : "amber"}
            >
              {c.status}
            </Badge>,
            <div key="actor">
              {c.actorName ||
                (c.actorId === actor.id ? actor.name : undefined) ||
                `Owner · ${c.actorId.slice(0, 8)}`}
              <small>
                Recorded {new Date(c.closedAt).toLocaleString("en-PK", {
                  timeZone: "Asia/Karachi",
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
              {c.reopenReason && <small>Reopened: {c.reopenReason}</small>}
            </div>,
            actor.role === "owner" && c.status === "closed" ? (
              <button
                key="reopen"
                className="link"
                onClick={() => setReopening(c.id)}
              >
                Reopen
              </button>
            ) : (
              "—"
            ),
          ])}
      />

      {[...(s.dailyCloses || [])]
        .filter((c) => !!c.summary)
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            b.closedAt.localeCompare(a.closedAt)
        )
        .map((c) => (
          <details className="daily-close-form" key={c.id}>
            <summary>
              <time dateTime={c.date}>{formatClosingDate(c.date)}</time> · saved closing summary ({c.status})
            </summary>
            <Table
              headers={[
                "Net billed sales",
                "Net purchases",
                "Recorded expenses",
                "Opening cash",
                "Cash receipts",
                "Cash payments",
                "Bank closing",
              ]}
              rows={[
                [
                  money(c.summary!.sales),
                  money(c.summary!.purchases),
                  money(c.summary!.expenses),
                  money(c.summary!.openingCash),
                  money(c.summary!.cashReceipts),
                  money(c.summary!.cashPayments),
                  money(c.summary!.bankClosing),
                ],
              ]}
            />
            <Table
              headers={["Bank / wallet", "Saved closing balance"]}
              rows={c.summary!.bankBalances.map((a) => [
                a.name,
                money(a.closing),
              ])}
            />
          </details>
        ))}

      {depositOpen && <Modal title="Deposit drawer cash" close={() => setDepositOpen(false)}><BankVoucherForm s={s} voucher={{ id: uid(), number: nextBankVoucherNumber(s), date, kind: "Payment", accountId: "", toAccountId: "", counterAccountId: "", amount: 0, reference: "Cash deposit", notes: "Drawer cash deposited to bank", status: "draft", createdAt: Date.now() }} commit={(next, message) => { commit(next, message); setDepositOpen(false); }} /></Modal>}
      {reopening && (
        <ReasonDialog
          title="Reopen daily close"
          withDate={false}
          close={() => setReopening("")}
          confirm={(reason) =>
            commit(
              reopenDay(s, reopening, reason, actor),
              "Closing reopened. Original closing figures retained."
            )
          }
        />
      )}
    </section>
  );
}

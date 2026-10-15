"use client";
import { DailyClosingView } from "./daily-closing-view";
import type { Actor } from "@/lib/stockwell/operations";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { Badge, Field, Table } from "@/components/stockwell/ui";
import { csv } from "@/lib/stockwell/downloads";
import { type Store } from "@/lib/stockwell/model";
import { FileText } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
type Props = {
  actor: Actor;
  commit: (s: Store, message: string) => void;
  report: string;
  setReport: Dispatch<SetStateAction<string>>;
  setReportContact: Dispatch<SetStateAction<string>>;
  reportContact: string;
  s: Store;
  reportResult: {
    columns: string[];
    rows: unknown[][];
  };
};
export function ReportsView({
  actor, commit,
  report,
  setReport,
  setReportContact,
  reportContact,
  s,
  reportResult,
}: Props) {
  return (
    <>
      <div className="report-toolbar">
        <div>
          <Field label="Report">
            <GlassSelect
              value={report}
              onValueChange={(e) => {
                setReport(e);
                setReportContact("");
              }}
            >
              {[
                "Cash-in-hand report",
                "Bank-balance report",
                "Cash-flow report",
                "Unposted bills",
                "Billing report",
                "Sales report",
                "Cash-sale report",
                "Credit-sale report",
                "Purchase report",
                "Inventory report",
                "Stock movement report",
                "Stock aging report",
                "Daily cash sheet",
                "Expense report",
                "Customer ledger",
                "Supplier ledger",
                "Receivables report",
                "Payables report",
                "Payment report",
                "Partner capital report",
                "Account aging report",
                "Yearly summary",
                "Trial balance",
                "Income statement",
                "Balance sheet",
                "Accounts Head report",
                "Profit summary",
                "Date-wise transaction report",
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </GlassSelect>
          </Field>
          {["Customer ledger", "Supplier ledger"].includes(report) && (
            <Field
              label={report === "Customer ledger" ? "Customer" : "Supplier"}
            >
              <GlassSelect
                value={reportContact}
                onValueChange={(e) => setReportContact(e)}
              >
                <option value="">All contacts</option>
                {(report === "Customer ledger" ? s.customers : s.suppliers).map(
                  (c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ),
                )}
              </GlassSelect>
            </Field>
          )}
        </div>
        <div className="report-actions">
          <button
            className="secondary-button"
            onClick={() =>
              csv(
                report.toLowerCase().replaceAll(" ", "-"),
                reportResult.columns,
                reportResult.rows,
              )
            }
          >
            <FileText size={16} /> Download CSV
          </button>
          <button className="secondary-button" onClick={() => window.print()}>
            Print report
          </button>
        </div>
      </div>
      <section className="card">
        <div className="section-head">
          <div>
            <h2>{report}</h2>
            <p>
              {report === "Inventory report"
                ? "Current stock snapshot. Date filters do not change this report."
                : report === "Bank-balance report"
                  ? "Receipts includes all money added to the account. Sales receipts shows only money received from sales and customer payments. Payments shows money leaving the account."
                : report.includes("ledger")
                  ? "Running balance includes transactions before the selected start date."
                  : ["Billing report", "Sales report", "Purchase report", "Receivables report", "Payables report"].includes(report)
                    ? "Bills are selected by date range. Paid, return credit, balance, and status are calculated through the end date, or through today’s recorded activity when no end date is selected. Unapplied advances appear as separate credit rows in receivables and payables reports."
                    : "Figures reflect the selected date range."}{" "}
              Amounts in PKR.
            </p>
          </div>
          <Badge>{reportResult.rows.length} rows</Badge>
        </div>
        <Table
          headers={reportResult.columns}
          rows={reportResult.rows.map((r) =>
            r.map((v) =>
              typeof v === "number"
                ? v.toLocaleString("en-PK", {
                    maximumFractionDigits: 2,
                  })
                : String(v),
            ),
          )}
        />
      </section>
      <DailyClosingView s={s} actor={actor} commit={commit} />
    </>
  );
}

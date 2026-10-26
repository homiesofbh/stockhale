"use client";
import { DailyClosingView } from "./daily-closing-view";
import type { Actor } from "@/lib/stockwell/operations";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { Badge, Field, Table } from "@/components/stockwell/ui";
import { csv } from "@/lib/stockwell/downloads";
import { type Store } from "@/lib/stockwell/model";
import { FileText } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

function printReport(report: string, columns: string[], rows: unknown[][], from: string, to: string) {
  const popup = window.open("", "_blank", "width=1100,height=800");
  if (!popup) {
    window.alert("Allow pop-ups to print this report.");
    return;
  }
  const escape = (value: unknown) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" })[char]!);
  popup.document.write(`<!doctype html><html><head><title>${escape(report)} · StockHale</title><style>body{font:13px Arial,sans-serif;color:#222;margin:32px}h1{font-size:22px;margin:0 0 6px}p{color:#555;margin:0 0 20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:7px;text-align:left}th{background:#f2f2f2}@media print{body{margin:12mm}}</style></head><body><h1>StockHale · ${escape(report)}</h1><p>${from || to ? `Period: ${escape(from || "—")} to ${escape(to || "—")}` : "All dates"} · Amounts in PKR</p><table><thead><tr>${columns.map((column) => `<th>${escape(column)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((value) => `<td>${escape(typeof value === "number" ? value.toLocaleString("en-PK", { maximumFractionDigits: 2 }) : value)}</td>`).join("")}</tr>`).join("")}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
  popup.document.close();
}

type Props = {
  actor: Actor;
  commit: (s: Store, message: string) => void;
  reopenWithOwnerPassword: (closingId: string, reason: string, password: string) => Promise<unknown>;
  report: string;
  setReport: Dispatch<SetStateAction<string>>;
  setReportContact: Dispatch<SetStateAction<string>>;
  reportContact: string;
  from: string;
  to: string;
  s: Store;
  reportResult: {
    columns: string[];
    rows: unknown[][];
    customerIds?: string[];
    contactSummary?: { business: number; payments: number; outstanding: number };
  };
};
export function ReportsView({
  actor, commit, reopenWithOwnerPassword,
  report,
  setReport,
  setReportContact,
  reportContact,
  from,
  to,
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
                "Customer business report",
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
              ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })).map((r) => (
                <option key={r}>{r}</option>
              ))}
            </GlassSelect>
          </Field>
          {["Customer business report", "Customer ledger", "Supplier ledger"].includes(report) && (
            <Field
              label={report === "Customer ledger" ? "Customer" : "Supplier"}
            >
              <GlassSelect
                value={reportContact}
                onValueChange={(e) => setReportContact(e)}
                searchable
                searchPlaceholder="Search contacts"
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
          <button className="secondary-button" onClick={() => printReport(report, reportResult.columns, reportResult.rows, from, to)}>
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
                : report === "Daily cash sheet"
                  ? "One row per day in the selected date range, including days with no activity."
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
          rows={reportResult.rows.map((r, rowIndex) =>
            r.map((v, columnIndex) =>
              reportResult.columns[columnIndex] === "Customer" && reportResult.customerIds?.[rowIndex]
                ? <button className="link" onClick={() => { setReport("Customer ledger"); setReportContact(reportResult.customerIds![rowIndex]); }}>{String(v)}</button>
                : typeof v === "number"
                  ? v.toLocaleString("en-PK", { maximumFractionDigits: 2 })
                  : String(v),
            ),
          )}
        />
      </section>
      <DailyClosingView s={s} actor={actor} commit={commit} reopenWithOwnerPassword={reopenWithOwnerPassword} />
    </>
  );
}

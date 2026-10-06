"use client";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { Badge, Field, Table } from "@/components/stockwell/ui";
import { csv } from "@/lib/stockwell/downloads";
import { type Store } from "@/lib/stockwell/model";
import { FileText } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
type Props = {
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
                "Billing report",
                "Sales report",
                "Purchase report",
                "Inventory report",
                "Stock movement report",
                "Expense report",
                "Customer ledger",
                "Supplier ledger",
                "Receivables report",
                "Payables report",
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
      </div>
      <section className="card">
        <div className="section-head">
          <div>
            <h2>{report}</h2>
            <p>
              {report === "Inventory report"
                ? "Current stock snapshot. Date filters do not change this report."
                : report.includes("ledger")
                  ? "Running balance includes transactions before the selected start date."
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
    </>
  );
}

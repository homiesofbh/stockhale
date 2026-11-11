"use client";
import { DailyClosingView } from "./daily-closing-view";
import type { Actor } from "@/lib/stockwell/operations";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { Badge, Field, ServerPagination, Table } from "@/components/stockwell/ui";
import { csv } from "@/lib/stockwell/downloads";
import { type Store } from "@/lib/stockwell/model";
import { FileText } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import type { ReportData } from "@/lib/stockwell/reports";
import { useServerCollection } from "@/lib/stockwell/use-server-collection";

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
  manufacturer: boolean;
  commit: (s: Store, message: string) => void;
  reopenWithOwnerPassword: (closingId: string, reason: string, password: string) => Promise<unknown>;
  report: string;
  setReport: Dispatch<SetStateAction<string>>;
  setReportContact: Dispatch<SetStateAction<string>>;
  reportContact: string;
  reportProduct: string;
  setReportProduct: Dispatch<SetStateAction<string>>;
  from: string;
  to: string;
  s: Store;
  query: string;
  status: string;
  paymentMethod: string;
  samplePreview?: boolean;
  sampleReportResult?: ReportData;
};
export function ReportsView({
  actor, manufacturer, commit, reopenWithOwnerPassword,
  report,
  setReport,
  setReportContact,
  reportContact,
  reportProduct,
  setReportProduct,
  from,
  to,
  s,
  query,
  status,
  paymentMethod,
  samplePreview = false,
  sampleReportResult,
}: Props) {
  const [page, setPage] = useState(1);
  const [reportResult, setReportResult] = useState<ReportData & { count: number; page: number; pageSize: number }>(() => sampleReportResult ? { ...sampleReportResult, count: sampleReportResult.rows.length, page: 1, pageSize: 25 } : { columns: [], rows: [], count: 0, page: 1, pageSize: 25 });
  const [reportError, setReportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [reportContactQuery, setReportContactQuery] = useState("");
  const [reportProductQuery, setReportProductQuery] = useState("");
  const reportContacts = useServerCollection<any>({ collection: report === "Supplier ledger" ? "suppliers" : "customers", module: report === "Supplier ledger" ? "Suppliers" : "Customers", query: reportContactQuery, pageSize: 10, enabled: ["Customer business report", "Customer ledger", "Supplier ledger"].includes(report) });
  const reportProducts = useServerCollection<any>({ collection: "products", query: reportProductQuery, pageSize: 10, enabled: report === "Stock movement report" || report === "Production ledger" });
  const makeParams = (all = false) => new URLSearchParams({ report: "1", q: query, from, to, status, paymentMethod, name: report, contact: reportContact, product: reportProduct, manufacturer: manufacturer ? "1" : "0", page: String(page), pageSize: "25", ...(all ? { all: "1" } : {}) });
  useEffect(() => { setPage(1); }, [query, from, to, status, paymentMethod, report, reportContact, reportProduct]);
  useEffect(() => {
    if (samplePreview) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/workspace?${makeParams()}`, { cache: "no-store", signal: controller.signal });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || "Could not load report.");
        setReportResult(value); setReportError("");
      } catch (error) { if (!controller.signal.aborted) setReportError(error instanceof Error ? error.message : "Could not load report."); }
    }, 100);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, from, to, status, paymentMethod, report, reportContact, reportProduct, page, manufacturer, samplePreview]);
  async function exportAll(kind: "csv" | "print") {
    setExporting(true); setReportError("");
    try {
      let full: ReportData = reportResult;
      if (!samplePreview) {
        const response = await fetch(`/api/workspace?${makeParams(true)}`, { cache: "no-store" });
        full = await response.json();
        if (!response.ok) throw new Error((full as any).error || "Could not load report.");
      }
      if (kind === "csv") csv(report.toLowerCase().replaceAll(" ", "-"), full.columns, full.rows);
      else printReport(report, full.columns, full.rows, from, to);
    } catch (error) { setReportError(error instanceof Error ? error.message : "Could not export report."); }
    finally { setExporting(false); }
  }
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
                "Cash Flow / Fund Movement Report",
                "Unposted bills",
                "Billing report",
                "Sales report",
                "Cash-sale report",
                "Credit-sale report",
                "Purchase report",
                "Inventory report",
                "Stock movement report",
                ...(manufacturer ? ["Production ledger"] : []),
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
                "Profit & Loss Report",
                "Balance sheet",
                "Accounts Head report",
                "Date-wise transaction report",
              ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })).map((r) => (
                <option key={r}>{r}</option>
              ))}
            </GlassSelect>
          </Field>
          {(report === "Stock movement report" || report === "Production ledger") && <Field label={report === "Production ledger" ? "Production product" : "Product stock history"}><div className="server-select-field"><GlassSelect aria-label={report === "Production ledger" ? "Production product" : "Product stock history"} value={reportProduct} onValueChange={setReportProduct}><option value="">All products</option>{reportProducts.records.map(product => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</GlassSelect><input type="search" aria-label="Search report products" placeholder="Search products…" value={reportProductQuery} onChange={event => setReportProductQuery(event.target.value)} /><ServerPagination page={reportProducts.page} pageCount={reportProducts.pageCount} count={reportProducts.count} pageSize={reportProducts.pageSize} setPage={reportProducts.setPage} /></div></Field>}
          {["Customer business report", "Customer ledger", "Supplier ledger"].includes(report) && (
            <Field
              label={report === "Customer ledger" ? "Customer" : "Supplier"}
            >
              <div className="server-select-field"><GlassSelect
                value={reportContact}
                onValueChange={(e) => setReportContact(e)}
                searchable
                searchPlaceholder="Search contacts"
              >
                <option value="">All contacts</option>
                {reportContacts.records.map(
                  (c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ),
                )}
              </GlassSelect>
              <input type="search" aria-label="Search report contacts" placeholder="Search contacts…" value={reportContactQuery} onChange={event => setReportContactQuery(event.target.value)} />
              <ServerPagination page={reportContacts.page} pageCount={reportContacts.pageCount} count={reportContacts.count} pageSize={reportContacts.pageSize} setPage={reportContacts.setPage} />
              </div>
            </Field>
          )}
        </div>
        <div className="report-actions">
          <button
            className="secondary-button"
            disabled={exporting}
            onClick={() => void exportAll("csv")}
          >
            <FileText size={16} /> Download CSV
          </button>
          <button className="secondary-button" disabled={exporting} onClick={() => void exportAll("print")}>
            Print report
          </button>
        </div>
      </div>
      <section className="card">
        {reportError && <p className="form-error" role="alert">{reportError}</p>}
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
          <Badge>{reportResult.count} rows</Badge>
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
        {!samplePreview && <ServerPagination page={reportResult.page} pageCount={Math.max(1, Math.ceil(reportResult.count / reportResult.pageSize))} count={reportResult.count} pageSize={reportResult.pageSize} setPage={setPage} />}
      </section>
      <DailyClosingView s={s} actor={actor} commit={commit} reopenWithOwnerPassword={reopenWithOwnerPassword} />
    </>
  );
}

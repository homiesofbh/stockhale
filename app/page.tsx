"use client";

import {
  cloneElement,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Barcode,
  Boxes,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  FileText,
  Download,
  ChevronDown,
  LayoutGrid,
  LayoutDashboard,
  Package,
  Plus,
  Printer,
  Search,
  Store as StoreIcon,
  TrendingUp,
  Truck,
  Undo2,
  Users,
  Wallet,
  X,
  Settings,
  Bell,
  LogOut,
  RefreshCw,
} from "lucide-react";
import {
  adjustStock,
  balance,
  contactBalance,
  emptyStore,
  financialRows,
  money,
  paid,
  periodMatch,
  profit,
  recordPayment,
  recordReturn,
  recordTrade,
  returned,
  round,
  saveProduct,
  stock,
  subtotal,
  today,
  total,
  uid,
  type Contact,
  type Line,
  type Product,
  type Store,
  type Trade,
} from "@/lib/stockwell/model";

import { StockArt } from "@/components/stockwell/stock-art";
import type { InvoicePaper } from "@/lib/stockwell/invoice-pdf";

import { useWorkspace } from "@/lib/stockwell/use-workspace";
import { WorkspaceSettings } from "@/components/stockwell/workspace-settings";

type Module =
  | "Dashboard"
  | "Inventory"
  | "Purchases"
  | "Billing"
  | "Sales"
  | "Accounts Heads"
  | "Expenses"
  | "Payments"
  | "Suppliers"
  | "Customers"
  | "Returns & Damage"
  | "Reports"
  | "Settings"
  | "Notifications";
const nav: { name: Module; icon: typeof Package }[] = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Inventory", icon: Boxes },
  { name: "Purchases", icon: Truck },
  { name: "Billing", icon: FileText },
  { name: "Sales", icon: TrendingUp },
  { name: "Accounts Heads", icon: ClipboardList },
  { name: "Expenses", icon: Wallet },
  { name: "Payments", icon: CreditCard },
  { name: "Suppliers", icon: StoreIcon },
  { name: "Customers", icon: Users },
  { name: "Returns & Damage", icon: Undo2 },
  { name: "Reports", icon: CircleDollarSign },
];
const descriptions: Record<Module, string> = {
  Settings: "Manage your store and team.",
  Notifications: "Admin notifications and activity history.",
  Dashboard: "A clear view of your business, from shelf to sale.",
  Inventory: "Every item, every movement. Keep your stock in balance.",
  Purchases: "Record incoming goods and manage supplier purchases.",
  Billing: "Build a bill, collect payment, and keep the queue moving.",
  Sales: "Your sales records, with the detail behind every number.",
  "Accounts Heads": "Organize your financial transactions by account head.",
  Expenses: "Track the everyday costs of running your business.",
  Payments: "Collect customer balances and settle supplier payments.",
  Suppliers: "Your suppliers, purchases, and outstanding balances.",
  Customers: "Customer details, billing history, and balances in one place.",
  "Returns & Damage": "Record returns and damage with a clear stock trail.",
  Reports: "Turn your daily records into a clearer business picture.",
};
const STORAGE = "stockwell.retail.v1";
const csvCell = (v: unknown) => {
  const value = String(v ?? "");
  return `"${(typeof v !== "number" && /^[=+@\-\t\r]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
};
function download(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function csv(name: string, columns: string[], rows: unknown[][]) {
  download(
    `${name}.csv`,
    "\uFEFF" +
      [columns, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n"),
    "text/csv;charset=utf-8",
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {cloneElement(children as ReactElement<{ "aria-label"?: string }>, {
        "aria-label": label,
      })}
    </label>
  );
}
function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Empty({
  title = "No records yet",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Package size={32} strokeWidth={1.3} />
      <h3>{title}</h3>
      <p>{children || "Your records will appear here as you work."}</p>
    </div>
  );
}
function Table({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: ReactNode[][];
  empty?: string;
}) {
  return rows.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty title={empty} />
  );
}
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog ref={dialog} onCancel={close} className="modal">
      <div className="modal-head">
        <div>
          <span className="eyebrow">STOCKWELL / NEW RECORD</span>
          <h2>{title}</h2>
        </div>
        <button
          className="icon-button"
          onClick={close}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Stat({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className={`stat ${accent ? "accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export default function Page() {
  const workspace = useWorkspace();
  const [s, setS] = useState<Store>(emptyStore);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [module, setModule] = useState<Module>("Dashboard");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("All");
  const [category, setCategory] = useState("All");
  const [modal, setModal] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [invoice, setInvoice] = useState<Trade | null>(null);
  const [paper, setPaper] = useState<InvoicePaper>("A4");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [dashboardPeriod, setDashboardPeriod] = useState("This month");
  const [quickProduct, setQuickProduct] = useState("");
  const [report, setReport] = useState("Billing report");
  const [reportContact, setReportContact] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [scan, setScan] = useState("");
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paymentKind, setPaymentKind] = useState("Customer");
  const [selectedContact, setSelectedContact] = useState("");
  const [returnKind, setReturnKind] = useState("Sales return");
  const [selectedTrade, setSelectedTrade] = useState("");
  const scanInput = useRef<HTMLInputElement>(null);
  const savedRaw = useRef<string | null>(null);
  useEffect(() => {
    if (workspace.cache) {
      setS(workspace.cache.workspace.store);
      setReady(true);
    } else if (workspace.ready) setReady(true);
  }, [workspace.cache, workspace.ready]);
  const account = workspace.cache?.workspace;
  const canAccess = (name: string) =>
    !!account &&
    (account.member.role === "owner" || account.member.modules.includes(name));
  useEffect(() => {
    if (
      account &&
      !canAccess(module) &&
      module !== "Settings" &&
      module !== "Notifications"
    ) {
      const first = account.member.modules[0];
      if (first) setModule(first as Module);
    }
  }, [account]);
  useEffect(() => {
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  function commit(next: Store, message: string) {
    if (storageError) throw new Error(storageError);
    workspace.commit(next, module, message);
    setS(next);
    setNotice(message);
    setError("");
    setModal("");
  }
  function go(m: Module) {
    if (!canAccess(m)) {
      setNotice("You do not have authority for this module.");
      return;
    }
    setModule(m);
    setQuery("");
    setFrom("");
    setTo("");
    setStatus("All");
    setCategory("All");
    setDetailContact(null);
    setReportContact("");
  }
  function open(name: string) {
    const target =
      name === "Bill" ? "Billing" : name === "Purchase" ? "Purchases" : module;
    if (!canAccess(target)) {
      setNotice("You do not have authority for this module.");
      return;
    }
    if (target !== module) setModule(target as Module);
    setError("");
    setModal(name);
    setSelectedContact("");
    setSelectedTrade("");
    setPaymentKind("Customer");
    setReturnKind("Sales return");
    if (name === "Purchase" || name === "Bill") {
      setLines([]);
      setDiscount(0);
      setTax(0);
      setScan("");
    }
  }
  function submit(e: FormEvent<HTMLFormElement>, fn: (data: FormData) => void) {
    e.preventDefault();
    setError("");
    try {
      fn(new FormData(e.currentTarget));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this record.");
    }
  }
  const text = (f: FormData, key: string) => String(f.get(key) || "").trim();
  const num = (f: FormData, key: string) => Number(f.get(key) || 0);
  const matches = (...values: unknown[]) =>
    values.join(" ").toLowerCase().includes(query.toLowerCase());
  const inRange = (date: string) => periodMatch(date, from, to);
  const pName = (id: string) =>
    s.products.find((p) => p.id === id)?.name || "Unknown item";
  const cName = (id: string, supplier = false) =>
    (supplier ? s.suppliers : s.customers).find((c) => c.id === id)?.name ||
    "Walk-in customer";
  const paymentStatus = (t: Trade) =>
    balance(s, t) < 0
      ? "Credit balance"
      : balance(s, t) === 0
        ? "Paid"
        : paid(s, t) > 0
          ? "Partial"
          : "Unpaid";
  const invoices = s.invoices.filter(
    (t) =>
      inRange(t.date) &&
      matches(
        t.number,
        cName(t.contactId),
        ...t.lines.map((l) => pName(l.productId)),
      ) &&
      (status === "All" || paymentStatus(t) === status),
  );
  const purchases = s.purchases.filter(
    (t) =>
      inRange(t.date) &&
      matches(
        t.number,
        cName(t.contactId, true),
        ...t.lines.map((l) => pName(l.productId)),
      ) &&
      (status === "All" || paymentStatus(t) === status),
  );
  const accounting = financialRows(s);
  const cash = accounting.reduce((n, r) => n + r.cash, 0);
  const bank = accounting.reduce((n, r) => n + r.bank, 0);
  const receivables = s.invoices.reduce(
    (n, t) => n + Math.max(balance(s, t), 0),
    0,
  );
  const payables = s.purchases.reduce(
    (n, t) => n + Math.max(balance(s, t), 0),
    0,
  );
  const lowStock = s.products.filter((p) => stock(s, p.id) <= p.low);
  const inventoryValue = s.products.reduce(
    (n, p) => n + stock(s, p.id) * p.cost,
    0,
  );
  const allProfit = profit(s);
  function addLine(id: string) {
    const p = s.products.find((p) => p.id === id);
    if (!p) return;
    setLines((old) => {
      const existing = old.find((l) => l.productId === id);
      return existing
        ? old.map((l) =>
            l.productId === id ? { ...l, qty: round(l.qty + 1) } : l,
          )
        : [
            ...old,
            {
              productId: id,
              qty: 1,
              price: modal === "Purchase" ? p.cost : p.price,
              cost: p.cost,
            },
          ];
    });
    setError("");
  }
  function scanProduct() {
    const code = scan.trim();
    if (!code) {
      setError("Scan a barcode or enter an item code first.");
      return;
    }
    const p = s.products.find(
      (p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase(),
    );
    if (!p) {
      setError(`No product matches barcode or SKU “${code}”.`);
      return;
    }
    addLine(p.id);
    setScan("");
    scanInput.current?.focus();
  }
  const billTotal = total({ lines, discount, tax });
  const action =
    module === "Inventory"
      ? "Add product"
      : module === "Purchases"
        ? "Record purchase"
        : module === "Billing"
          ? "New bill"
          : module === "Expenses"
            ? "Record expense"
            : module === "Payments"
              ? "Record payment"
              : module === "Suppliers"
                ? "Add supplier"
                : module === "Customers"
                  ? "Add customer"
                  : module === "Accounts Heads"
                    ? "Add account head"
                    : module === "Returns & Damage"
                      ? "Record return / damage"
                      : "";
  const actionModal =
    module === "Inventory"
      ? "Product"
      : module === "Purchases"
        ? "Purchase"
        : module === "Billing"
          ? "Bill"
          : module === "Expenses"
            ? "Expense"
            : module === "Payments"
              ? "Payment"
              : module === "Suppliers" || module === "Customers"
                ? "Contact"
                : module === "Accounts Heads"
                  ? "Head"
                  : "Return";
  const tradeRows = (list: Trade[], supplier = false) =>
    list.map((t) => [
      <button
        className="link"
        onClick={() => {
          setInvoice(t);
          setPaper("A4");
        }}
      >
        {t.number}
        <small>{t.date}</small>
      </button>,
      cName(t.contactId, supplier),
      `${t.lines.reduce((n, l) => n + l.qty, 0)} units`,
      money(total(t)),
      <Badge tone={balance(s, t) === 0 ? "green" : "amber"}>
        {paymentStatus(t)}
      </Badge>,
      money(paid(s, t)),
      money(balance(s, t)),
      <button
        className="icon-button"
        aria-label={`View ${t.number}`}
        onClick={() => {
          setInvoice(t);
          setPaper("A4");
        }}
      >
        <ChevronRight size={18} />
      </button>,
    ]);
  const basicHeaders = [
    "Invoice",
    "Customer",
    "Quantity",
    "Net total",
    "Status",
    "Paid",
    "Balance",
    "",
  ];

  function reportData(): { columns: string[]; rows: unknown[][] } {
    if (
      [
        "Billing report",
        "Sales report",
        "Purchase report",
        "Receivables report",
        "Payables report",
      ].includes(report)
    ) {
      const supplier =
        report === "Purchase report" || report === "Payables report";
      let list = supplier ? purchases : invoices;
      if (report === "Receivables report" || report === "Payables report")
        list = list.filter((t) => balance(s, t) !== 0);
      return {
        columns: [
          "Reference",
          "Date",
          supplier ? "Supplier" : "Customer",
          "Subtotal",
          "Discount",
          "Tax %",
          "Original total",
          "Return credit",
          "Paid",
          "Balance",
        ],
        rows: list.map((t) => [
          t.number,
          t.date,
          cName(t.contactId, supplier),
          subtotal(t),
          t.discount,
          t.tax,
          total(t),
          returned(s, t.id),
          paid(s, t),
          balance(s, t),
        ]),
      };
    }
    if (report === "Inventory report")
      return {
        columns: [
          "SKU",
          "Product",
          "Category",
          "Stock",
          "Cost price",
          "Selling price",
          "Inventory value",
          "Low-stock threshold",
        ],
        rows: s.products
          .filter((p) => matches(p.name, p.sku, p.category))
          .map((p) => [
            p.sku,
            p.name,
            p.category,
            stock(s, p.id),
            p.cost,
            p.price,
            round(stock(s, p.id) * p.cost),
            p.low,
          ]),
      };
    if (report === "Stock movement report")
      return {
        columns: [
          "Date",
          "Product",
          "Type",
          "Quantity change",
          "Reference",
          "Reason",
        ],
        rows: s.movements
          .filter(
            (m) =>
              inRange(m.date) &&
              matches(pName(m.productId), m.reference, m.reason),
          )
          .map((m) => [
            m.date,
            pName(m.productId),
            m.type,
            m.qty,
            m.reference,
            m.reason,
          ]),
      };
    if (report === "Expense report")
      return {
        columns: [
          "Date",
          "Category",
          "Account head",
          "Amount",
          "Method",
          "Notes",
        ],
        rows: s.expenses
          .filter(
            (e) => inRange(e.date) && matches(e.category, e.head, e.notes),
          )
          .map((e) => [
            e.date,
            e.category,
            e.head,
            e.amount,
            e.method,
            e.notes,
          ]),
      };
    if (report === "Profit summary") {
      const p = profit(s, from, to);
      return {
        columns: ["Measure", "Amount (PKR)"],
        rows: [
          ["Net sales excluding tax", p.revenue],
          ["Cost of goods sold", p.cogs],
          ["Expenses", p.expenses],
          ["Damaged stock cost", p.damage],
          ["Net profit", p.net],
        ],
      };
    }
    if (report === "Customer ledger" || report === "Supplier ledger") {
      const supplier = report === "Supplier ledger";
      const trades = supplier ? s.purchases : s.invoices;
      const kind = supplier ? "Supplier" : "Customer";
      const entries: {
        date: string;
        ref: string;
        name: string;
        type: string;
        charge: number;
        payment: number;
        id: string;
        order: number;
      }[] = [];
      trades
        .filter(
          (t) =>
            t.contactId && (!reportContact || t.contactId === reportContact),
        )
        .forEach((t) => {
          entries.push({
            date: t.date,
            ref: t.number,
            name: cName(t.contactId, supplier),
            type: supplier ? "Purchase" : "Bill",
            charge: total(t),
            payment: t.paid,
            id: t.contactId,
            order: t.createdAt || 0,
          });
          s.returns
            .filter((r) => r.tradeId === t.id)
            .forEach((r) =>
              entries.push({
                date: r.date,
                ref: t.number,
                name: cName(t.contactId, supplier),
                type: r.kind,
                charge: -r.amount,
                payment: 0,
                id: t.contactId,
                order: r.createdAt || 0,
              }),
            );
        });
      s.payments
        .filter(
          (p) =>
            p.kind === kind &&
            (!reportContact || p.contactId === reportContact),
        )
        .forEach((p) =>
          entries.push({
            date: p.date,
            ref: trades.find((t) => t.id === p.tradeId)?.number || "",
            name: cName(p.contactId, supplier),
            type: "Payment",
            charge: 0,
            payment: p.amount,
            id: p.contactId,
            order: p.createdAt || 0,
          }),
        );
      const balances = new Map<string, number>();
      const rows: unknown[][] = [];
      entries
        .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
        .forEach((e) => {
          const b = round((balances.get(e.id) || 0) + e.charge - e.payment);
          balances.set(e.id, b);
          if (inRange(e.date) && matches(e.name, e.ref, e.type))
            rows.push([e.date, e.name, e.ref, e.type, e.charge, e.payment, b]);
        });
      return {
        columns: [
          "Date",
          supplier ? "Supplier" : "Customer",
          "Reference",
          "Type",
          "Charge / credit",
          "Payment",
          "Running balance",
        ],
        rows,
      };
    }
    if (report === "Accounts Head report")
      return {
        columns: [
          "Account head",
          "Transaction count",
          "Net transaction amount",
          "Cash movement",
          "Bank movement",
        ],
        rows: s.heads
          .filter((h) => matches(h))
          .map((h) => {
            const rows = accounting.filter(
              (r) => r.head === h && inRange(r.date),
            );
            return [
              h,
              rows.length,
              round(rows.reduce((n, r) => n + r.amount, 0)),
              round(rows.reduce((n, r) => n + r.cash, 0)),
              round(rows.reduce((n, r) => n + r.bank, 0)),
            ];
          }),
      };
    return {
      columns: [
        "Date",
        "Reference",
        "Type",
        "Account head",
        "Method",
        "Amount",
        "Cash movement",
        "Bank movement",
      ],
      rows: accounting
        .filter((r) => inRange(r.date) && matches(r.reference, r.type, r.head))
        .map((r) => [
          r.date,
          r.reference,
          r.type,
          r.head,
          r.method,
          r.amount,
          r.cash,
          r.bank,
        ]),
    };
  }
  const reportResult = reportData();
  useEffect(() => {
    setPdfError("");
  }, [invoice?.id, paper]);
  const start = new Date();
  if (dashboardPeriod === "This month") start.setDate(1);
  if (dashboardPeriod === "This week")
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const dashboardFrom =
    dashboardPeriod === "All time" ? "" : start.toLocaleDateString("en-CA");
  const dashboardProfit = profit(s, dashboardFrom, today());
  const dashboardInvoices = s.invoices.filter((t) =>
    periodMatch(t.date, dashboardFrom, today()),
  );
  async function saveInvoicePdf() {
    if (!invoice || pdfBusy) return;
    setPdfBusy(true);
    setPdfError("");
    try {
      const { downloadInvoicePdf } =
        await import("@/lib/stockwell/invoice-pdf");
      const result = await downloadInvoicePdf(s, invoice, paper);
      setNotice(
        `PDF downloaded · ${(result.bytes / 1024).toFixed(1)} KB · ${result.pages} page${result.pages === 1 ? "" : "s"}`,
      );
    } catch (e) {
      setPdfError(
        e instanceof Error
          ? e.message
          : "The invoice could not be downloaded. Please try again.",
      );
    } finally {
      setPdfBusy(false);
    }
  }
  if (!ready)
    return (
      <div className="loading">
        Stockwell<span>Opening your workspace…</span>
      </div>
    );
  if (
    account &&
    account.member.role !== "owner" &&
    !account.member.modules.length
  )
    return (
      <div className="loading">
        No modules assigned.<span>Ask your workspace owner for access.</span>
        <button onClick={() => void workspace.signout()}>Sign out</button>
      </div>
    );
  if (!account)
    return (
      <div className="loading">
        Stockwell<a href="/sign-in">Sign in to open your workspace</a>
      </div>
    );
  return (
    <>
      <div className="app-shell">
        <header className="topbar">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              go("Dashboard");
            }}
          >
            <span className="brand-mark">
              <span>S</span>
            </span>
            STOCKWELL<span className="brand-dot">.</span>
          </a>
          <span className="retail-pill">RETAIL</span>
          <nav className="top-navigation" aria-label="Main navigation">
            {nav
              .filter(({ name }) => canAccess(name))
              .map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  className={module === name ? "active" : ""}
                  onClick={() => go(name)}
                  aria-label={name}
                  aria-current={module === name ? "page" : undefined}
                  title={name}
                >
                  <Icon size={20} strokeWidth={1.5} />
                  <span className="nav-label">{name}</span>
                </button>
              ))}
          </nav>
          <div className="top-profile">
            <span>
              {account.name}
              <small>{workspace.syncStatus}</small>
            </span>
            <span className="profile-orb">
              {account.image ? (
                <img src={account.image} alt={account.name} />
              ) : (
                account.name.slice(0, 1)
              )}
            </span>
          </div>
        </header>
        <div className="workspace-tools">
          <span>
            {account.member.name} · {account.member.role}
          </span>
          <button onClick={() => void workspace.sync()}>
            <RefreshCw size={16} /> {workspace.syncStatus}
            {workspace.cache?.queue.length
              ? ` (${workspace.cache.queue.length})`
              : ""}
          </button>
          {account.member.role === "owner" && (
            <>
              <button onClick={() => setModule("Notifications")}>
                <Bell size={16} /> Notifications & logs{" "}
                {account.audit.length &&
                account.audit[0].id !== account.readEvent ? (
                  <span className="badge paid">New</span>
                ) : null}
              </button>
              <button onClick={() => setModule("Settings")}>
                <Settings size={16} /> Settings
              </button>
            </>
          )}
          <button
            onClick={() =>
              void workspace.signout().catch((e) => setNotice(e.message))
            }
          >
            <LogOut size={16} /> Sign out
          </button>
          {!!workspace.cache?.queue.length && (
            <>
              <button onClick={workspace.exportPending}>
                Export pending changes
              </button>
              {workspace.syncStatus.startsWith("Conflict") && (
                <button
                  onClick={() =>
                    void workspace
                      .useServer()
                      .catch((e) => setNotice(e.message))
                  }
                >
                  Load server records
                </button>
              )}
            </>
          )}
        </div>
        <div
          className={`workspace ${module === "Dashboard" ? "dashboard-workspace" : ""}`}
        >
          <main>
            {module === "Settings" && account.member.role === "owner" ? (
              <WorkspaceSettings
                workspace={account}
                action={workspace.action}
              />
            ) : module === "Notifications" &&
              account.member.role === "owner" ? (
              <section className="settings-page">
                <div className="page-heading">
                  <div>
                    <h1>Notifications & activity logs</h1>
                    <p>Who changed what, with action and sync times.</p>
                    <button
                      onClick={() =>
                        void workspace
                          .action({
                            action: "read",
                            event: account.audit[0]?.id,
                          })
                          .catch((e) => setNotice(e.message))
                      }
                    >
                      Mark notifications read
                    </button>
                  </div>
                </div>
                <Table
                  headers={[
                    "Who",
                    "Module",
                    "Action / records",
                    "When",
                    "Email",
                  ]}
                  rows={account.audit.map((a) => [
                    a.actor,
                    a.module,
                    <div key={a.id}>
                      {a.action}
                      <small>{a.records}</small>
                    </div>,
                    <div key={a.id}>
                      {new Date(a.occurredAt).toLocaleString()}
                      <small>
                        Synced {new Date(a.receivedAt).toLocaleString()}
                      </small>
                    </div>,
                    a.emailStatus,
                  ])}
                />
              </section>
            ) : (
              <>
                <form
                  className="global-search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    go("Inventory");
                    setQuery(productSearch);
                  }}
                >
                  <Search size={18} strokeWidth={1.6} />
                  <input
                    aria-label="Search products"
                    placeholder="Search for a Product"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  <button
                    type="submit"
                    aria-label="Search inventory"
                    title="Search inventory"
                  >
                    <LayoutGrid size={19} strokeWidth={1.5} />
                  </button>
                </form>
                <div
                  className={`page-heading ${module === "Dashboard" ? "dashboard-heading" : ""}`}
                >
                  <div>
                    <span className="eyebrow">
                      {module === "Dashboard"
                        ? "YOUR BUSINESS, AT A GLANCE"
                        : "RETAIL OPERATIONS"}{" "}
                    </span>
                    <h1>
                      {module === "Dashboard"
                        ? "Everything in good order."
                        : module}
                    </h1>
                    <p>{descriptions[module]}</p>
                  </div>
                  <div className="heading-actions">
                    {module === "Dashboard" && (
                      <button
                        className="primary"
                        onClick={() => {
                          go("Billing");
                          open("Bill");
                        }}
                      >
                        <Plus size={17} /> New bill
                      </button>
                    )}
                    {action && (
                      <button
                        className="primary"
                        disabled={!!storageError}
                        onClick={() => {
                          setEditProduct(null);
                          setEditContact(null);
                          open(actionModal);
                        }}
                      >
                        <Plus size={17} />
                        {action}
                      </button>
                    )}
                  </div>
                </div>
                {storageError && (
                  <div className="error-banner" role="alert">
                    {storageError}
                  </div>
                )}
                {notice && (
                  <div className="toast" role="status">
                    {notice}
                  </div>
                )}
                {module === "Dashboard" ? (
                  <>
                    <section
                      className="dashboard-summary"
                      aria-label="Sales overview"
                    >
                      <div className="summary-avatar">
                        <StockArt compact />
                      </div>
                      <div className="summary-sales">
                        <label className="summary-period">
                          <span className="sr-only">Dashboard period</span>
                          <select
                            aria-label="Dashboard period"
                            value={dashboardPeriod}
                            onChange={(e) => setDashboardPeriod(e.target.value)}
                          >
                            <option>This month</option>
                            <option>This week</option>
                            <option>Today</option>
                            <option>All time</option>
                          </select>
                          <ChevronDown size={15} />
                        </label>
                        <div className="summary-value">
                          {money(dashboardProfit.revenue)}{" "}
                          <CircleDollarSign size={21} strokeWidth={1.3} />
                        </div>
                        <p>
                          {dashboardInvoices.length} completed sales{" "}
                          <span>·</span> Averaging{" "}
                          <b>
                            {money(
                              dashboardInvoices.length
                                ? dashboardProfit.revenue /
                                    dashboardInvoices.length
                                : 0,
                            )}
                          </b>
                        </p>
                      </div>
                      <div className="summary-detail">
                        <h3>
                          Your <b>retail</b> overview
                        </h3>
                        <dl>
                          <div>
                            <dt>Purchases</dt>
                            <dd>
                              {
                                s.purchases.filter((t) =>
                                  periodMatch(t.date, dashboardFrom, today()),
                                ).length
                              }
                            </dd>
                          </div>
                          <div>
                            <dt>Billing today</dt>
                            <dd>
                              {money(
                                s.invoices
                                  .filter((t) => t.date === today())
                                  .reduce((n, t) => n + total(t), 0),
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt>Expenses</dt>
                            <dd>{money(dashboardProfit.expenses)}</dd>
                          </div>
                          <div>
                            <dt>Low-stock items</dt>
                            <dd>{lowStock.length}</dd>
                          </div>
                        </dl>
                      </div>
                      <div className="stock-orb">
                        <div>
                          <span>
                            STOCK
                            <br />
                            ITEMS
                          </span>
                          <strong>{s.products.length}</strong>
                        </div>
                      </div>
                    </section>
                    <section
                      className="dashboard-heroes"
                      aria-label="Inventory and billing"
                    >
                      <button
                        className="inventory-hero"
                        onClick={() => go("Inventory")}
                      >
                        <StockArt />
                        <div className="inventory-hero-copy">
                          <Package size={33} strokeWidth={1.3} />
                          <h2>YOUR INVENTORY</h2>
                          <p>
                            {s.products.length} products · {s.categories.length}{" "}
                            {s.categories.length === 1
                              ? "category"
                              : "categories"}
                            <br />
                            {lowStock.length} items at low stock
                          </p>
                          <strong>{money(inventoryValue)}</strong>
                          <small>Current stock value</small>
                        </div>
                        <ChevronRight className="hero-arrow" size={22} />
                      </button>
                      <div className="billing-hero">
                        <svg
                          className="billing-shape"
                          viewBox="0 0 720 220"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          <defs>
                            <linearGradient id="billingHeroFill">
                              <stop stopColor="#c4c0d0" />
                              <stop offset=".55" stopColor="#c7c2d6" />
                              <stop offset="1" stopColor="#d9c2e8" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M28 0H630C685 0 720 23 720 59C720 93 699 110 656 110C699 110 720 129 720 164C720 198 689 220 638 220H28Q0 220 0 192V28Q0 0 28 0Z"
                            fill="url(#billingHeroFill)"
                          />
                        </svg>
                        <div className="billing-hero-form">
                          <select
                            aria-label="Quick bill product"
                            value={quickProduct}
                            onChange={(e) => setQuickProduct(e.target.value)}
                          >
                            <option value="">Select a product</option>
                            {s.products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <button
                            className="gradient-button"
                            disabled={!!storageError}
                            onClick={() => {
                              go("Billing");
                              open("Bill");
                              const p = s.products.find(
                                (p) => p.id === quickProduct,
                              );
                              if (p)
                                setLines([
                                  {
                                    productId: p.id,
                                    qty: 1,
                                    price: p.price,
                                    cost: p.cost,
                                  },
                                ]);
                            }}
                          >
                            CREATE A BILL
                          </button>
                        </div>
                        <div className="billing-hero-copy">
                          <h2>
                            MAKE A <br />
                            NEW BILL
                          </h2>
                          <p>Your next sale, in good order.</p>
                        </div>
                      </div>
                    </section>
                    <div className="dashboard-grid primary-records">
                      <section className="card recent">
                        <div className="section-head">
                          <div>
                            <h2>Recent invoices</h2>
                            <p>The latest from your counter.</p>
                          </div>
                          <button
                            className="text-button"
                            onClick={() => go("Billing")}
                          >
                            All invoices <ArrowUpRight size={15} />
                          </button>
                        </div>
                        <Table
                          headers={["Invoice", "Customer", "Total", "Payment"]}
                          rows={s.invoices
                            .slice(-5)
                            .reverse()
                            .map((t) => [
                              <button
                                className="link"
                                onClick={() => setInvoice(t)}
                              >
                                {t.number}
                                <small>{t.date}</small>
                              </button>,
                              cName(t.contactId),
                              money(total(t)),
                              <Badge
                                tone={balance(s, t) === 0 ? "green" : "amber"}
                              >
                                {paymentStatus(t)}
                              </Badge>,
                            ])}
                          empty="Ready for your first sale"
                        />
                      </section>
                      <section className="card stock-card">
                        <div className="section-head">
                          <div>
                            <h2>Stock watch</h2>
                            <p>{lowStock.length} items at or below threshold</p>
                          </div>
                          <span className="stock-icon">
                            <Boxes size={20} />
                          </span>
                        </div>
                        {lowStock.length ? (
                          lowStock.slice(0, 5).map((p) => (
                            <div className="stock-watch" key={p.id}>
                              <span className="product-icon">
                                <Package size={18} />
                              </span>
                              <div>
                                <b>{p.name}</b>
                                <small>{p.sku}</small>
                              </div>
                              <Badge tone="amber">{stock(s, p.id)} left</Badge>
                            </div>
                          ))
                        ) : (
                          <Empty title="Your shelves are in balance">
                            Low-stock items will be flagged here.
                          </Empty>
                        )}
                        <button
                          className="full-link"
                          onClick={() => go("Inventory")}
                        >
                          Manage inventory <ChevronRight size={16} />
                        </button>
                      </section>
                    </div>
                    <div className="section-label">
                      THE FINANCIAL PICTURE{" "}
                      <span>All recorded transactions</span>
                    </div>
                    <div className="stats-grid secondary">
                      <Stat
                        label="Cash position"
                        value={money(cash)}
                        detail={`Bank position ${money(bank)}`}
                      />
                      <Stat
                        label="Receivables"
                        value={money(receivables)}
                        detail="Outstanding customer bills"
                      />
                      <Stat
                        label="Payables"
                        value={money(payables)}
                        detail="Outstanding supplier purchases"
                      />
                      <Stat
                        label="Profit overview"
                        value={money(allProfit.net)}
                        detail={`${money(allProfit.expenses)} in expenses`}
                      />
                    </div>
                    <div className="dashboard-grid">
                      <section className="card">
                        <div className="section-head">
                          <h2>Recent purchases</h2>
                          <button
                            className="text-button"
                            onClick={() => go("Purchases")}
                          >
                            View all <ArrowUpRight size={15} />
                          </button>
                        </div>
                        <Table
                          headers={["Reference", "Supplier", "Amount"]}
                          rows={s.purchases
                            .slice(-4)
                            .reverse()
                            .map((t) => [
                              t.number,
                              cName(t.contactId, true),
                              money(total(t)),
                            ])}
                        />
                      </section>
                      <section className="card">
                        <div className="section-head">
                          <h2>Recent sales</h2>
                          <button
                            className="text-button"
                            onClick={() => go("Sales")}
                          >
                            View all <ArrowUpRight size={15} />
                          </button>
                        </div>
                        <Table
                          headers={["Date", "Product", "Quantity"]}
                          rows={s.invoices
                            .slice(-4)
                            .reverse()
                            .flatMap((t) =>
                              t.lines.map((l) => [
                                t.date,
                                pName(l.productId),
                                l.qty,
                              ]),
                            )}
                        />
                      </section>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="filters">
                      <label className="search">
                        <Search size={17} />
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder={`Search ${module.toLowerCase()}…`}
                          aria-label="Search records"
                        />
                      </label>
                      {["Purchases", "Billing"].includes(module) && (
                        <select
                          aria-label="Payment status"
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                        >
                          {[
                            "All",
                            "Paid",
                            "Partial",
                            "Unpaid",
                            "Credit balance",
                          ].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      )}
                      {module === "Inventory" && (
                        <>
                          <select
                            aria-label="Product category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                          >
                            <option>All</option>
                            {s.categories.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                          <select
                            aria-label="Stock status"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                          >
                            <option>All</option>
                            <option>Low stock</option>
                            <option>In stock</option>
                          </select>
                        </>
                      )}
                      {!["Inventory", "Suppliers", "Customers"].includes(
                        module,
                      ) && (
                        <div className="date-filter">
                          <input
                            type="date"
                            aria-label="From date"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                          />
                          <span>to</span>
                          <input
                            type="date"
                            aria-label="To date"
                            value={to}
                            min={from}
                            onChange={(e) => setTo(e.target.value)}
                          />
                        </div>
                      )}
                      {(query ||
                        from ||
                        to ||
                        status !== "All" ||
                        category !== "All") && (
                        <button
                          className="text-button"
                          onClick={() => {
                            setQuery("");
                            setFrom("");
                            setTo("");
                            setStatus("All");
                            setCategory("All");
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {module === "Inventory" && (
                      <>
                        <div className="sub-actions">
                          <span>
                            {s.products.length} products{" "}
                            <span className="muted">
                              / {lowStock.length} low stock
                            </span>
                          </span>
                          <div>
                            <button
                              className="secondary-button"
                              onClick={() => open("Category")}
                            >
                              Categories
                            </button>
                            <button
                              className="secondary-button"
                              onClick={() => open("Adjustment")}
                            >
                              <ArrowDownLeft size={16} /> Stock adjustment
                            </button>
                            <button
                              className="secondary-button"
                              onClick={() => open("Movements")}
                            >
                              Movement history
                            </button>
                          </div>
                        </div>
                        <section className="card">
                          <Table
                            headers={[
                              "Product",
                              "SKU / Barcode",
                              "Category",
                              "Stock",
                              "Cost price",
                              "Selling price",
                              "Status",
                              "",
                            ]}
                            rows={s.products
                              .filter(
                                (p) =>
                                  matches(
                                    p.name,
                                    p.sku,
                                    p.barcode,
                                    p.category,
                                  ) &&
                                  (category === "All" ||
                                    p.category === category) &&
                                  (status === "All" ||
                                    (status === "Low stock"
                                      ? stock(s, p.id) <= p.low
                                      : stock(s, p.id) > 0)),
                              )
                              .map((p) => [
                                <div className="product-name">
                                  <span className="product-icon">
                                    <Package size={18} />
                                  </span>
                                  <b>{p.name}</b>
                                </div>,
                                <>
                                  {p.sku}
                                  <small>
                                    {p.barcode || "No barcode assigned"}
                                  </small>
                                </>,
                                p.category,
                                <b>{stock(s, p.id)}</b>,
                                money(p.cost),
                                money(p.price),
                                <Badge
                                  tone={
                                    stock(s, p.id) <= p.low ? "amber" : "green"
                                  }
                                >
                                  {stock(s, p.id) <= p.low
                                    ? "Low stock"
                                    : "In stock"}
                                </Badge>,
                                <button
                                  className="link"
                                  onClick={() => {
                                    setEditProduct(p);
                                    open("Product");
                                  }}
                                >
                                  Edit
                                </button>,
                              ])}
                            empty="Add your first product"
                          />
                        </section>
                      </>
                    )}
                    {(module === "Purchases" || module === "Billing") && (
                      <>
                        <div className="sub-actions">
                          <span>
                            {module === "Billing"
                              ? invoices.length
                              : purchases.length}{" "}
                            records
                          </span>
                          <span className="muted">
                            Stock updates automatically with each transaction
                          </span>
                        </div>
                        <section className="card">
                          <Table
                            headers={
                              module === "Billing"
                                ? basicHeaders
                                : [
                                    "Purchase",
                                    "Supplier",
                                    "Quantity",
                                    "Net total",
                                    "Status",
                                    "Paid",
                                    "Balance",
                                    "",
                                  ]
                            }
                            rows={
                              module === "Billing"
                                ? tradeRows(invoices)
                                : tradeRows(purchases, true)
                            }
                          />
                        </section>
                      </>
                    )}
                    {module === "Sales" && (
                      <>
                        <div className="period-tabs">
                          {["All time", "Today", "This week", "This month"].map(
                            (label) => (
                              <button
                                key={label}
                                className={
                                  (label === "All time" && !from && !to) ||
                                  (label === "Today" &&
                                    from === today() &&
                                    to === today())
                                    ? "selected"
                                    : ""
                                }
                                onClick={() => {
                                  const date = new Date();
                                  if (label === "All time") {
                                    setFrom("");
                                    setTo("");
                                    return;
                                  }
                                  if (label === "This week")
                                    date.setDate(
                                      date.getDate() -
                                        ((date.getDay() + 6) % 7),
                                    );
                                  if (label === "This month") date.setDate(1);
                                  setFrom(
                                    label === "Today"
                                      ? today()
                                      : date.toLocaleDateString("en-CA"),
                                  );
                                  setTo(today());
                                }}
                              >
                                {label}
                              </button>
                            ),
                          )}
                        </div>
                        <div className="stats-grid three">
                          <Stat
                            label="Net sales"
                            value={money(profit(s, from, to).revenue)}
                            detail="After discounts and returns, excluding tax"
                            accent
                          />
                          <Stat
                            label="Quantity sold"
                            value={String(
                              invoices.reduce(
                                (n, t) =>
                                  n + t.lines.reduce((a, l) => a + l.qty, 0),
                                0,
                              ),
                            )}
                            detail="Original units on matching bills"
                          />
                          <Stat
                            label="Sales records"
                            value={String(invoices.length)}
                            detail="Every bill is recorded as a sale"
                          />
                        </div>
                        <section className="card">
                          <Table
                            headers={[
                              "Date / Invoice",
                              "Product",
                              "Quantity",
                              "Selling price",
                              "Allocated discount",
                              "Line total before tax",
                            ]}
                            rows={invoices.flatMap((t) =>
                              t.lines.map((l) => {
                                const d = subtotal(t)
                                  ? round(
                                      (t.discount * l.qty * l.price) /
                                        subtotal(t),
                                    )
                                  : 0;
                                return [
                                  <>
                                    {t.date}
                                    <small>{t.number}</small>
                                  </>,
                                  pName(l.productId),
                                  l.qty,
                                  money(l.price),
                                  money(d),
                                  money(l.qty * l.price - d),
                                ];
                              }),
                            )}
                          />
                        </section>
                      </>
                    )}
                    {module === "Accounts Heads" && (
                      <>
                        <div className="account-heads">
                          {s.heads
                            .filter((h) => matches(h))
                            .map((h) => {
                              const rows = accounting.filter(
                                (r) => r.head === h && inRange(r.date),
                              );
                              return (
                                <div className="account-head" key={h}>
                                  <ClipboardList size={17} />
                                  <b>{h}</b>
                                  <small>{rows.length} transactions</small>
                                </div>
                              );
                            })}
                        </div>
                        <section className="card">
                          <div className="section-head">
                            <h2>Transactions by account head</h2>
                          </div>
                          <Table
                            headers={[
                              "Date",
                              "Reference",
                              "Type",
                              "Account head",
                              "Amount",
                              "Payment method",
                            ]}
                            rows={accounting
                              .filter(
                                (r) =>
                                  inRange(r.date) &&
                                  matches(r.head, r.reference, r.type),
                              )
                              .map((r) => [
                                r.date,
                                r.reference,
                                r.type,
                                <Badge>{r.head}</Badge>,
                                money(r.amount),
                                r.method,
                              ])}
                          />
                        </section>
                      </>
                    )}
                    {module === "Expenses" && (
                      <>
                        <div className="sub-actions">
                          <span>
                            Total in view:{" "}
                            <b>
                              {money(
                                s.expenses
                                  .filter(
                                    (e) =>
                                      inRange(e.date) &&
                                      matches(e.category, e.notes, e.head),
                                  )
                                  .reduce((n, e) => n + e.amount, 0),
                              )}
                            </b>
                          </span>
                          <button
                            className="secondary-button"
                            onClick={() => open("Expense category")}
                          >
                            Expense categories
                          </button>
                        </div>
                        <section className="card">
                          <Table
                            headers={[
                              "Date",
                              "Category",
                              "Account head",
                              "Amount",
                              "Paid from",
                              "Notes",
                            ]}
                            rows={s.expenses
                              .filter(
                                (e) =>
                                  inRange(e.date) &&
                                  matches(e.category, e.notes, e.head),
                              )
                              .slice()
                              .reverse()
                              .map((e) => [
                                e.date,
                                e.category,
                                e.head,
                                money(e.amount),
                                e.method,
                                e.notes || "—",
                              ])}
                          />
                        </section>
                      </>
                    )}
                    {module === "Payments" && (
                      <>
                        <div className="stats-grid three">
                          <Stat
                            label="Customer receivables"
                            value={money(receivables)}
                            detail="Outstanding bills"
                            accent
                          />
                          <Stat
                            label="Supplier payables"
                            value={money(payables)}
                            detail="Outstanding purchases"
                          />
                          <Stat
                            label="Cash / Bank"
                            value={money(cash)}
                            detail={`Bank ${money(bank)}`}
                          />
                        </div>
                        <section className="card">
                          <div className="section-head">
                            <h2>Payment history</h2>
                            <p>
                              Includes payments collected when a transaction was
                              created.
                            </p>
                          </div>
                          <Table
                            headers={[
                              "Date",
                              "Contact",
                              "Reference",
                              "Type",
                              "Amount",
                              "Method",
                              "Account head",
                            ]}
                            rows={[
                              ...s.invoices
                                .filter((t) => t.paid > 0)
                                .map((t) => ({
                                  date: t.date,
                                  contact: cName(t.contactId),
                                  reference: t.number,
                                  kind: "Customer",
                                  amount: t.paid,
                                  method: t.method,
                                  head: t.head,
                                })),
                              ...s.purchases
                                .filter((t) => t.paid > 0)
                                .map((t) => ({
                                  date: t.date,
                                  contact: cName(t.contactId, true),
                                  reference: t.number,
                                  kind: "Supplier",
                                  amount: t.paid,
                                  method: t.method,
                                  head: t.head,
                                })),
                              ...s.payments.map((p) => ({
                                date: p.date,
                                contact: cName(
                                  p.contactId,
                                  p.kind === "Supplier",
                                ),
                                reference:
                                  [...s.invoices, ...s.purchases].find(
                                    (t) => t.id === p.tradeId,
                                  )?.number || "",
                                kind: p.kind,
                                amount: p.amount,
                                method: p.method,
                                head: p.head,
                              })),
                            ]
                              .filter(
                                (p) =>
                                  inRange(p.date) &&
                                  matches(
                                    p.contact,
                                    p.reference,
                                    p.kind,
                                    p.head,
                                  ),
                              )
                              .sort((a, b) => b.date.localeCompare(a.date))
                              .map((p) => [
                                p.date,
                                p.contact,
                                p.reference,
                                <Badge
                                  tone={
                                    p.kind === "Customer" ? "green" : "amber"
                                  }
                                >
                                  {p.kind}
                                </Badge>,
                                money(p.amount),
                                p.method,
                                p.head,
                              ])}
                          />
                        </section>
                      </>
                    )}
                    {(module === "Customers" || module === "Suppliers") && (
                      <>
                        <section className="card">
                          <Table
                            headers={[
                              "Name",
                              "Contact details",
                              "Address",
                              "Outstanding balance",
                              "",
                            ]}
                            rows={(module === "Suppliers"
                              ? s.suppliers
                              : s.customers
                            )
                              .filter((c) =>
                                matches(c.name, c.phone, c.email, c.address),
                              )
                              .map((c) => [
                                <button
                                  className="link"
                                  onClick={() => setDetailContact(c)}
                                >
                                  {c.name}
                                </button>,
                                <>
                                  {c.phone || "—"}
                                  <small>{c.email}</small>
                                </>,
                                c.address || "—",
                                money(
                                  contactBalance(
                                    s,
                                    module === "Suppliers"
                                      ? "Supplier"
                                      : "Customer",
                                    c.id,
                                  ),
                                ),
                                <button
                                  className="link"
                                  onClick={() => {
                                    setEditContact(c);
                                    open("Contact");
                                  }}
                                >
                                  Edit profile
                                </button>,
                              ])}
                          />
                        </section>
                        {detailContact && (
                          <section className="card contact-detail">
                            <div className="section-head">
                              <div>
                                <h2>{detailContact.name}</h2>
                                <p>
                                  {detailContact.phone} · {detailContact.email}{" "}
                                  · {detailContact.address}
                                </p>
                              </div>
                              <button
                                className="icon-button"
                                aria-label="Close contact history"
                                onClick={() => setDetailContact(null)}
                              >
                                <X size={18} />
                              </button>
                            </div>
                            <h3>
                              {module === "Suppliers"
                                ? "Purchase history"
                                : "Billing & sales history"}
                            </h3>
                            <Table
                              headers={
                                module === "Suppliers"
                                  ? [
                                      "Purchase",
                                      "Supplier",
                                      "Quantity",
                                      "Net total",
                                      "Status",
                                      "Paid",
                                      "Balance",
                                      "",
                                    ]
                                  : basicHeaders
                              }
                              rows={tradeRows(
                                (module === "Suppliers"
                                  ? s.purchases
                                  : s.invoices
                                ).filter(
                                  (t) => t.contactId === detailContact.id,
                                ),
                                module === "Suppliers",
                              )}
                            />
                            <h3>Payment history</h3>
                            <Table
                              headers={[
                                "Date",
                                "Reference",
                                "Amount",
                                "Method",
                                "Notes",
                              ]}
                              rows={[
                                ...(module === "Suppliers"
                                  ? s.purchases
                                  : s.invoices
                                )
                                  .filter(
                                    (t) =>
                                      t.contactId === detailContact.id &&
                                      t.paid > 0,
                                  )
                                  .map((t) => [
                                    t.date,
                                    t.number,
                                    money(t.paid),
                                    t.method,
                                    "Paid at creation",
                                  ]),
                                ...s.payments
                                  .filter(
                                    (p) => p.contactId === detailContact.id,
                                  )
                                  .map((p) => [
                                    p.date,
                                    [...s.invoices, ...s.purchases].find(
                                      (t) => t.id === p.tradeId,
                                    )?.number,
                                    money(p.amount),
                                    p.method,
                                    p.notes,
                                  ]),
                              ]}
                            />
                          </section>
                        )}
                      </>
                    )}
                    {module === "Returns & Damage" && (
                      <section className="card">
                        <Table
                          headers={[
                            "Date",
                            "Type",
                            "Reference",
                            "Product",
                            "Quantity",
                            "Credit adjustment",
                            "Reason",
                          ]}
                          rows={s.returns
                            .filter(
                              (r) =>
                                inRange(r.date) &&
                                matches(r.kind, r.reason, pName(r.productId)),
                            )
                            .slice()
                            .reverse()
                            .map((r) => [
                              r.date,
                              <Badge
                                tone={r.kind === "Damaged stock" ? "amber" : ""}
                              >
                                {r.kind}
                              </Badge>,
                              [...s.invoices, ...s.purchases].find(
                                (t) => t.id === r.tradeId,
                              )?.number || "—",
                              pName(r.productId),
                              r.qty,
                              r.kind === "Damaged stock"
                                ? "—"
                                : money(r.amount),
                              r.reason,
                            ])}
                        />
                      </section>
                    )}
                    {module === "Reports" && (
                      <>
                        <div className="report-toolbar">
                          <div>
                            <Field label="Report">
                              <select
                                value={report}
                                onChange={(e) => {
                                  setReport(e.target.value);
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
                              </select>
                            </Field>
                            {["Customer ledger", "Supplier ledger"].includes(
                              report,
                            ) && (
                              <Field
                                label={
                                  report === "Customer ledger"
                                    ? "Customer"
                                    : "Supplier"
                                }
                              >
                                <select
                                  value={reportContact}
                                  onChange={(e) =>
                                    setReportContact(e.target.value)
                                  }
                                >
                                  <option value="">All contacts</option>
                                  {(report === "Customer ledger"
                                    ? s.customers
                                    : s.suppliers
                                  ).map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
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
                    )}
                  </>
                )}
                <footer>
                  Stockwell <span>Retail Inventory & Operations</span>
                  <span>All amounts in PKR</span>
                </footer>
              </>
            )}
          </main>
        </div>
      </div>
      {modal && (
        <Modal
          title={
            modal === "Bill"
              ? "New customer bill"
              : modal === "Product"
                ? editProduct
                  ? "Edit product"
                  : "Add product"
                : modal === "Contact"
                  ? `${editContact ? "Edit" : "Add"} ${module === "Suppliers" ? "supplier" : "customer"}`
                  : modal
          }
          close={() => setModal("")}
        >
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {modal === "Product" && (
            <form
              onSubmit={(e) =>
                submit(e, (f) => {
                  const p: Product = {
                    id: editProduct?.id || uid(),
                    name: text(f, "name"),
                    sku: text(f, "sku"),
                    barcode: text(f, "barcode"),
                    category: text(f, "category"),
                    cost: num(f, "cost"),
                    price: num(f, "price"),
                    low: num(f, "low"),
                  };
                  commit(
                    saveProduct(s, p, num(f, "opening")),
                    "Product saved.",
                  );
                })
              }
            >
              <div className="form-grid">
                <Field label="Product name">
                  <input
                    name="name"
                    required
                    defaultValue={editProduct?.name}
                    autoFocus
                  />
                </Field>
                <Field label="Category">
                  <select name="category" defaultValue={editProduct?.category}>
                    {s.categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="SKU / Item code">
                  <input name="sku" required defaultValue={editProduct?.sku} />
                </Field>
                <Field label="Barcode (scan or type)">
                  <input
                    name="barcode"
                    defaultValue={editProduct?.barcode}
                    placeholder="Scan a product barcode here"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                  />
                </Field>
                <Field label="Cost price (PKR)">
                  <input
                    name="cost"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    defaultValue={editProduct?.cost || 0}
                  />
                </Field>
                <Field label="Selling price (PKR)">
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    defaultValue={editProduct?.price || 0}
                  />
                </Field>
                <Field label="Low-stock threshold">
                  <input
                    name="low"
                    type="number"
                    min="0"
                    step="0.001"
                    required
                    defaultValue={editProduct?.low ?? 5}
                  />
                </Field>
                {!editProduct && (
                  <Field label="Opening stock">
                    <input
                      name="opening"
                      type="number"
                      min="0"
                      step="0.001"
                      defaultValue="0"
                    />
                  </Field>
                )}
              </div>
              <p className="form-hint">
                Stock changes after creation are recorded through purchases,
                billing, returns, or stock adjustments.
              </p>
              <div className="form-foot">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setModal("")}
                >
                  Cancel
                </button>
                <button className="primary">Save product</button>
              </div>
            </form>
          )}
          {["Category", "Expense category", "Head"].includes(modal) && (
            <>
              <div className="tag-list">
                {(modal === "Category"
                  ? s.categories
                  : modal === "Head"
                    ? s.heads
                    : s.expenseCategories
                ).map((c) => (
                  <Badge key={c}>{c}</Badge>
                ))}
              </div>
              <form
                onSubmit={(e) =>
                  submit(e, (f) => {
                    const name = text(f, "name");
                    const key =
                      modal === "Category"
                        ? "categories"
                        : modal === "Head"
                          ? "heads"
                          : "expenseCategories";
                    if (
                      !name ||
                      s[key].some((x) => x.toLowerCase() === name.toLowerCase())
                    )
                      throw new Error("Enter a unique name.");
                    commit(
                      { ...s, [key]: [...s[key], name] },
                      `${modal} added.`,
                    );
                  })
                }
              >
                <Field label="Name">
                  <input name="name" required autoFocus />
                </Field>
                <div className="form-foot">
                  <button className="primary">Add {modal.toLowerCase()}</button>
                </div>
              </form>
            </>
          )}
          {modal === "Adjustment" && (
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
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={today()}
                  />
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
          )}
          {modal === "Movements" && (
            <>
              <div className="form-hint">
                Search products and references using the inventory search field.
              </div>
              <Table
                headers={[
                  "Date",
                  "Product",
                  "Type",
                  "Quantity",
                  "Reference",
                  "Reason",
                ]}
                rows={s.movements
                  .filter((m) =>
                    matches(pName(m.productId), m.reference, m.reason),
                  )
                  .slice()
                  .reverse()
                  .map((m) => [
                    m.date,
                    pName(m.productId),
                    m.type,
                    <Badge tone={m.qty > 0 ? "green" : "amber"}>
                      {m.qty > 0 ? "+" : ""}
                      {m.qty}
                    </Badge>,
                    m.reference,
                    m.reason || "—",
                  ])}
              />
            </>
          )}
          {modal === "Contact" && (
            <form
              onSubmit={(e) =>
                submit(e, (f) => {
                  const c: Contact = {
                    id: editContact?.id || uid(),
                    name: text(f, "name"),
                    phone: text(f, "phone"),
                    email: text(f, "email"),
                    address: text(f, "address"),
                  };
                  const key =
                    module === "Suppliers" ? "suppliers" : "customers";
                  if (!c.name) throw new Error("Name is required.");
                  commit(
                    {
                      ...s,
                      [key]: editContact
                        ? s[key].map((x) => (x.id === c.id ? c : x))
                        : [...s[key], c],
                    },
                    "Contact saved.",
                  );
                  if (detailContact?.id === c.id) setDetailContact(c);
                })
              }
            >
              <div className="form-grid">
                <Field label="Name">
                  <input
                    name="name"
                    required
                    defaultValue={editContact?.name}
                    autoFocus
                  />
                </Field>
                <Field label="Phone">
                  <input
                    name="phone"
                    type="tel"
                    defaultValue={editContact?.phone}
                  />
                </Field>
                <Field label="Email">
                  <input
                    name="email"
                    type="email"
                    defaultValue={editContact?.email}
                  />
                </Field>
                <Field label="Address">
                  <input name="address" defaultValue={editContact?.address} />
                </Field>
              </div>
              <div className="form-foot">
                <button className="primary">Save profile</button>
              </div>
            </form>
          )}
          {(modal === "Purchase" || modal === "Bill") && (
            <form
              onSubmit={(e) =>
                submit(e, (f) => {
                  const t: Trade = {
                    id: uid(),
                    number: "",
                    date: text(f, "date"),
                    contactId: text(f, "contact"),
                    lines,
                    discount,
                    tax,
                    paid: num(f, "paid"),
                    method: text(f, "method") as "Cash" | "Bank",
                    head: text(f, "head"),
                  };
                  const next = recordTrade(
                    s,
                    modal === "Bill" ? "Sale" : "Purchase",
                    t,
                  );
                  commit(
                    next,
                    modal === "Bill"
                      ? "Bill saved. Inventory updated."
                      : "Purchase saved. Inventory updated.",
                  );
                  if (modal === "Bill") {
                    setInvoice(next.invoices[next.invoices.length - 1]);
                    setPaper("A4");
                  }
                })
              }
            >
              <div className="form-grid">
                <Field label={modal === "Purchase" ? "Supplier" : "Customer"}>
                  <select name="contact" required={modal === "Purchase"}>
                    <option value="">
                      {modal === "Purchase"
                        ? "Select supplier"
                        : "Walk-in customer"}
                    </option>
                    {(modal === "Purchase" ? s.suppliers : s.customers).map(
                      (c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ),
                    )}
                  </select>
                </Field>
                <Field label="Date">
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={today()}
                  />
                </Field>
              </div>
              <div className="scan-row">
                <Barcode size={23} />
                <input
                  ref={scanInput}
                  value={scan}
                  onChange={(e) => setScan(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      scanProduct();
                    }
                  }}
                  placeholder="Scan barcode or enter SKU, then press Enter"
                  aria-label="Barcode scanner input"
                />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={scanProduct}
                >
                  Add item
                </button>
              </div>
              <p className="form-hint">
                USB and Bluetooth scanners that type the barcode and send Enter
                are supported. Keep the scan field focused.
              </p>
              <Field label="Or choose a product">
                <select value="" onChange={(e) => addLine(e.target.value)}>
                  <option value="">Select product to add</option>
                  {s.products.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name} · {p.sku} · {stock(s, p.id)} in stock
                    </option>
                  ))}
                </select>
              </Field>
              <div className="bill-lines">
                {lines.length ? (
                  <Table
                    headers={[
                      "Product",
                      "Quantity",
                      modal === "Purchase" ? "Cost price" : "Unit price",
                      "Total",
                      "",
                    ]}
                    rows={lines.map((l, i) => [
                      <>
                        {pName(l.productId)}
                        <small>
                          {s.products.find((p) => p.id === l.productId)?.sku}
                        </small>
                      </>,
                      <input
                        aria-label={`Quantity for ${pName(l.productId)}`}
                        type="number"
                        min="0.001"
                        step="0.001"
                        required
                        value={l.qty}
                        onChange={(e) =>
                          setLines(
                            lines.map((x, n) =>
                              n === i
                                ? { ...x, qty: Number(e.target.value) }
                                : x,
                            ),
                          )
                        }
                      />,
                      <input
                        aria-label={`Price for ${pName(l.productId)}`}
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={l.price}
                        onChange={(e) =>
                          setLines(
                            lines.map((x, n) =>
                              n === i
                                ? {
                                    ...x,
                                    price: Number(e.target.value),
                                    cost:
                                      modal === "Purchase"
                                        ? Number(e.target.value)
                                        : x.cost,
                                  }
                                : x,
                            ),
                          )
                        }
                      />,
                      money(l.qty * l.price),
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Remove ${pName(l.productId)}`}
                        onClick={() =>
                          setLines(lines.filter((_, n) => n !== i))
                        }
                      >
                        <X size={16} />
                      </button>,
                    ])}
                  />
                ) : (
                  <div className="line-placeholder">
                    Scan or select a product to start your{" "}
                    {modal === "Bill" ? "bill" : "purchase"}.
                  </div>
                )}
              </div>
              <div className="form-grid">
                <Field label="Discount amount (PKR)">
                  <input
                    type="number"
                    min="0"
                    max={subtotal({ lines })}
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    required
                  />
                </Field>
                <Field label="Tax (%)">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={tax}
                    onChange={(e) => setTax(Number(e.target.value))}
                    required
                  />
                </Field>
                <Field label="Amount paid (PKR)">
                  <input
                    key={billTotal}
                    name="paid"
                    type="number"
                    min="0"
                    max={Math.max(0, billTotal)}
                    step="0.01"
                    defaultValue={Math.max(0, billTotal)}
                    required
                  />
                </Field>
                <Field label="Payment method">
                  <select name="method">
                    <option>Cash</option>
                    <option>Bank</option>
                  </select>
                </Field>
                <Field label="Account head">
                  <select
                    name="head"
                    defaultValue={modal === "Bill" ? "Sales" : "Purchases"}
                  >
                    {s.heads.map((h) => (
                      <option key={h}>{h}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <p className="form-hint">
                Use zero paid for credit; a partial amount leaves a pending
                balance. A customer is required for credit bills.
              </p>
              <div className="bill-summary">
                <span>
                  Subtotal <b>{money(subtotal({ lines }))}</b>
                </span>
                <span>
                  Discount <b>− {money(discount)}</b>
                </span>
                <span>
                  Tax{" "}
                  <b>
                    {money(
                      round(((subtotal({ lines }) - discount) * tax) / 100),
                    )}
                  </b>
                </span>
                <span className="net-total">
                  Net payable <b>{money(billTotal)}</b>
                </span>
              </div>
              <div className="form-foot">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setModal("")}
                >
                  Cancel
                </button>
                <button className="primary" disabled={!lines.length}>
                  Save {modal === "Bill" ? "bill" : "purchase"}
                </button>
              </div>
            </form>
          )}
          {modal === "Expense" && (
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
                  <select name="category">
                    {s.expenseCategories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Account head">
                  <select name="head" defaultValue="Expenses">
                    {s.heads.map((h) => (
                      <option key={h}>{h}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Amount (PKR)">
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </Field>
                <Field label="Date">
                  <input
                    name="date"
                    type="date"
                    defaultValue={today()}
                    required
                  />
                </Field>
                <Field label="Paid from">
                  <select name="method">
                    <option>Cash</option>
                    <option>Bank</option>
                  </select>
                </Field>
                <Field label="Notes / details">
                  <input name="notes" />
                </Field>
              </div>
              <div className="form-foot">
                <button className="primary">Save expense</button>
              </div>
            </form>
          )}
          {modal === "Payment" && (
            <form
              onSubmit={(e) =>
                submit(e, (f) =>
                  commit(
                    recordPayment(s, {
                      id: uid(),
                      date: text(f, "date"),
                      kind: paymentKind as "Customer" | "Supplier",
                      contactId: selectedContact,
                      tradeId: text(f, "trade"),
                      amount:
                        round(num(f, "amount")) *
                        (balance(
                          s,
                          (paymentKind === "Customer"
                            ? s.invoices
                            : s.purchases
                          ).find((t) => t.id === selectedTrade)!,
                        ) < 0
                          ? -1
                          : 1),
                      method: text(f, "method") as "Cash" | "Bank",
                      head: text(f, "head"),
                      notes: text(f, "notes"),
                    }),
                    "Payment recorded. Balance updated.",
                  ),
                )
              }
            >
              <div className="form-grid">
                <Field label="Payment type">
                  <select
                    value={paymentKind}
                    onChange={(e) => {
                      setPaymentKind(e.target.value);
                      setSelectedContact("");
                      setSelectedTrade("");
                    }}
                  >
                    <option>Customer</option>
                    <option>Supplier</option>
                  </select>
                </Field>
                <Field label={paymentKind}>
                  <select
                    required
                    value={selectedContact}
                    onChange={(e) => {
                      setSelectedContact(e.target.value);
                      setSelectedTrade("");
                    }}
                  >
                    <option value="">Select contact</option>
                    {(paymentKind === "Customer"
                      ? s.customers
                      : s.suppliers
                    ).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Bill / purchase with a pending balance or credit">
                  <select
                    name="trade"
                    required
                    value={selectedTrade}
                    onChange={(e) => setSelectedTrade(e.target.value)}
                  >
                    <option value="">Select transaction</option>
                    {(paymentKind === "Customer" ? s.invoices : s.purchases)
                      .filter(
                        (t) =>
                          t.contactId === selectedContact &&
                          balance(s, t) !== 0,
                      )
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.number} · {money(Math.abs(balance(s, t)))}{" "}
                          {balance(s, t) < 0 ? "return credit" : "due"}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Amount (PKR)">
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                  />
                </Field>
                <Field label="Date">
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={today()}
                  />
                </Field>
                <Field label="Payment method">
                  <select name="method">
                    <option>Cash</option>
                    <option>Bank</option>
                  </select>
                </Field>
                <Field label="Account head">
                  <select
                    name="head"
                    key={paymentKind}
                    defaultValue={
                      paymentKind === "Customer"
                        ? "Customer payments"
                        : "Supplier payments"
                    }
                  >
                    {s.heads.map((h) => (
                      <option key={h}>{h}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Notes">
                  <input name="notes" />
                </Field>
              </div>
              <p className="form-hint">
                Selecting a return credit records a customer refund or money
                received back from a supplier. Enter a positive amount;
                Stockwell applies the correct direction.
              </p>
              <div className="form-foot">
                <button className="primary">Record payment</button>
              </div>
            </form>
          )}
          {modal === "Return" && (
            <form
              onSubmit={(e) =>
                submit(e, (f) =>
                  commit(
                    recordReturn(s, {
                      id: uid(),
                      date: text(f, "date"),
                      kind: returnKind as
                        "Sales return" | "Purchase return" | "Damaged stock",
                      tradeId: selectedTrade,
                      productId: text(f, "product"),
                      qty: num(f, "qty"),
                      reason: text(f, "reason"),
                      amount: 0,
                      cost: 0,
                    }),
                    "Return / damage recorded. Stock and balances updated.",
                  ),
                )
              }
            >
              <div className="form-grid">
                <Field label="Type">
                  <select
                    value={returnKind}
                    onChange={(e) => {
                      setReturnKind(e.target.value);
                      setSelectedTrade("");
                    }}
                  >
                    <option>Sales return</option>
                    <option>Purchase return</option>
                    <option>Damaged stock</option>
                  </select>
                </Field>
                <Field label="Date">
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={today()}
                  />
                </Field>
                {returnKind !== "Damaged stock" && (
                  <Field label="Original transaction">
                    <select
                      required
                      value={selectedTrade}
                      onChange={(e) => setSelectedTrade(e.target.value)}
                    >
                      <option value="">Select transaction</option>
                      {(returnKind === "Sales return"
                        ? s.invoices
                        : s.purchases
                      ).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.number}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Product">
                  <select
                    name="product"
                    required
                    key={`${returnKind}-${selectedTrade}`}
                  >
                    <option value="">Select product</option>
                    {s.products
                      .filter(
                        (p) =>
                          returnKind === "Damaged stock" ||
                          (returnKind === "Sales return"
                            ? s.invoices
                            : s.purchases
                          )
                            .find((t) => t.id === selectedTrade)
                            ?.lines.some((l) => l.productId === p.id),
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Quantity">
                  <input
                    name="qty"
                    type="number"
                    min="0.001"
                    step="0.001"
                    required
                  />
                </Field>
                <Field label="Reason / remarks">
                  <input name="reason" required />
                </Field>
              </div>
              <p className="form-hint">
                Returns use the original transaction prices, proportional
                discounts, and taxes. Sales returns put stock back; purchase
                returns and damage remove stock. A negative balance is a credit
                to settle with the contact.
              </p>
              <div className="form-foot">
                <button className="primary">Record return / damage</button>
              </div>
            </form>
          )}
        </Modal>
      )}
      {invoice && (
        <div className="invoice-overlay">
          <div className="invoice-controls">
            <button
              className="secondary-button"
              onClick={() => setInvoice(null)}
            >
              <X size={16} />
              Close
            </button>
            <div>
              <select
                aria-label="Printer paper size"
                value={paper}
                onChange={(e) => setPaper(e.target.value as InvoicePaper)}
              >
                <option value="A4">Standard printer · A4</option>
                <option value="80mm">Receipt printer · 80 mm</option>
                <option value="58mm">Receipt printer · 58 mm</option>
              </select>
              <button
                className="secondary-button"
                disabled={pdfBusy}
                onClick={saveInvoicePdf}
              >
                <Download size={17} />
                {pdfBusy ? "Preparing PDF…" : "Download PDF"}
              </button>
              <button className="primary" onClick={() => window.print()}>
                <Printer size={17} />
                Print / Save PDF
              </button>
            </div>
          </div>
          {pdfError && (
            <div className="pdf-error" role="alert">
              {pdfError}
            </div>
          )}
          <style>{`@media print { @page { size: ${paper === "A4" ? "A4" : paper + " 297mm"}; margin: ${paper === "A4" ? "12mm" : "2mm"}; } }`}</style>
          <article
            className={`print-sheet ${paper === "A4" ? "a4" : "receipt"}`}
            style={paper === "A4" ? {} : { width: paper }}
          >
            <div className="invoice-brand">
              <span className="brand-mark">
                <Boxes size={24} />
              </span>
              <h2>
                Stockwell<span>.</span>
              </h2>
            </div>
            <div className="invoice-title">
              <h1>
                {invoice.number.startsWith("PUR")
                  ? "Purchase record"
                  : "Invoice"}
              </h1>
              <div>
                <b>{invoice.number}</b>
                <span>{invoice.date}</span>
              </div>
            </div>
            <div className="invoice-customer">
              <div>
                <small>
                  {invoice.number.startsWith("PUR") ? "SUPPLIER" : "BILL TO"}
                </small>
                <b>
                  {cName(invoice.contactId, invoice.number.startsWith("PUR"))}
                </b>
                {(invoice.number.startsWith("PUR") ? s.suppliers : s.customers)
                  .filter((c) => c.id === invoice.contactId)
                  .map((c) => (
                    <p key={c.id}>
                      {[c.address, c.phone, c.email]
                        .filter(Boolean)
                        .map((v, i) => (
                          <span key={i}>{v}</span>
                        ))}
                    </p>
                  ))}
              </div>
              <div>
                <small>PAYMENT</small>
                <b>{paymentStatus(invoice)}</b>
                <span>{invoice.method}</span>
              </div>
            </div>
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((l, i) => (
                  <tr key={i}>
                    <td>
                      {pName(l.productId)}
                      <small>
                        {s.products.find((p) => p.id === l.productId)?.sku}
                      </small>
                    </td>
                    <td>{l.qty}</td>
                    <td>{l.price.toFixed(2)}</td>
                    <td>{round(l.qty * l.price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="invoice-totals">
              {[
                ["Subtotal", subtotal(invoice)],
                ["Discount", -invoice.discount],
                [
                  `Tax (${invoice.tax}%)`,
                  round(
                    ((subtotal(invoice) - invoice.discount) * invoice.tax) /
                      100,
                  ),
                ],
                ["Total (PKR)", total(invoice)],
                ["Return credit", -returned(s, invoice.id)],
                ["Paid", paid(s, invoice)],
                ["Balance / credit", balance(s, invoice)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className={label === "Total (PKR)" ? "invoice-grand" : ""}
                >
                  <span>{label}</span>
                  <b>{Number(value).toFixed(2)}</b>
                </div>
              ))}
            </div>
            <div className="invoice-thanks">
              Thank you for your business.
              <small>Generated with Stockwell</small>
            </div>
          </article>
        </div>
      )}
    </>
  );
}

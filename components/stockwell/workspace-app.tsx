"use client";
import { bankStatement } from "@/lib/stockwell/bank-vouchers";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  balance,
  contactBalance,
  findProductByCode,
  emptyStore,
  financialRows,
  isPosted,
  money,
  paid,
  periodMatch,
  profit,
  returned,
  round,
  stock,
  subtotal,
  today,
  total,
  normalizeStore,
  type Contact,
  type Line,
  type Product,
  type Store,
  type Trade,
} from "@/lib/stockwell/model";
import { ChevronRight, Plus, Search, X } from "lucide-react";
import { descriptions, type Module } from "./navigation";
import { Badge, Empty, Field, Modal, Table } from "./ui";
import type { InvoicePaper } from "@/lib/stockwell/invoice-pdf";
import { WorkspaceSettings } from "@/components/stockwell/workspace-settings";
import { accessibleModule, canAccessModule } from "@/lib/stockwell/workspace";
import { useWorkspace } from "@/lib/stockwell/use-workspace";
import { AdjustmentForm } from "@/components/stockwell/forms/adjustment-form";
import { ContactForm } from "@/components/stockwell/forms/contact-form";
import { ExpenseForm } from "@/components/stockwell/forms/expense-form";
import { acknowledgeAttachmentQueue, retryAttachmentQueue } from "@/lib/stockwell/attachment-client";
import { MovementsForm } from "@/components/stockwell/forms/movements-form";
import { PaymentForm } from "@/components/stockwell/forms/payment-form";
import { ProductForm } from "@/components/stockwell/forms/product-form";
import { ReturnForm } from "@/components/stockwell/forms/return-form";
import { WalkInReview } from "@/components/stockwell/views/walk-in-review";
import { TradeActions } from "@/components/stockwell/trade-actions";
import { TradeForm } from "@/components/stockwell/forms/trade-form";
import { InvoicePreview } from "@/components/stockwell/invoice-preview";
import { RecordFilters } from "@/components/stockwell/record-filters";
import { AccountForm } from "@/components/stockwell/forms/account-form";
import { AccountHeadsView } from "@/components/stockwell/views/account-heads-view";
import { ContactsView } from "@/components/stockwell/views/contacts-view";
import { DashboardView } from "@/components/stockwell/views/dashboard-view";
import { DailyClosingView } from "@/components/stockwell/views/daily-closing-view";
import { ExpensesView } from "@/components/stockwell/views/expenses-view";
import { InventoryView } from "@/components/stockwell/views/inventory-view";
import { ProductDetailView } from "@/components/stockwell/views/product-detail-view";
import { NotificationsView } from "@/components/stockwell/views/notifications-view";
import { getFirstRecordTarget } from "@/lib/stockwell/audit-target";
import { PaymentsView } from "@/components/stockwell/views/payments-view";
import { ReportsView } from "@/components/stockwell/views/reports-view";
import { ReturnsView } from "@/components/stockwell/views/returns-view";
import { SalesView } from "@/components/stockwell/views/sales-view";
import { TradeHistoryView } from "@/components/stockwell/views/trade-history-view";
import { ProductionView } from "@/components/stockwell/views/production-view";
import { BusinessSetup } from "@/components/stockwell/business-setup";
import { WorkspaceHeader } from "@/components/stockwell/workspace-header";
import {
  filterTrades,
  getPaymentStatus,
  matchesQuery,
} from "@/lib/stockwell/record-selectors";
import { createReportData } from "@/lib/stockwell/reports";

import { ProductSearch } from "./product-search";
import { AdminPanel } from "./admin-panel";

export function WorkspaceApp() {
  const workspace = useWorkspace();
  const [s, setS] = useState<Store>(emptyStore);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [requestedModule, setModule] = useState<Module>("Dashboard");
  const [adminOpen, setAdminOpen] = useState(false);
  const [routeReady, setRouteReady] = useState(false);
  const [trialExpired, setTrialExpired] = useState(false);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("All");
  const [paymentMethod, setPaymentMethod] = useState("All");
  const profileMenu = useRef<HTMLDetailsElement>(null);
  const notificationReturn = useRef<Module>("Dashboard");
  const [category, setCategory] = useState("All");
  const [modal, setModal] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
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
  const [reportProduct, setReportProduct] = useState("");
  const storeRef = useRef(s);
  storeRef.current = s;
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
    const hash = window.location.hash.slice(1);
    const savedModule = (Object.keys(descriptions) as Module[]).find(
      (name) => name.toLowerCase().replaceAll(" ", "-") === hash,
    );
    if (savedModule) setModule(savedModule);
    setRouteReady(true);
  }, []);
  useEffect(() => {
    if (!routeReady) return;
    const nextHash = requestedModule === "Dashboard"
      ? ""
      : `#${requestedModule.toLowerCase().replaceAll(" ", "-")}`;
    if (window.location.hash !== nextHash)
      window.history.replaceState(null, "", `${window.location.pathname}${nextHash}`);
  }, [requestedModule, routeReady]);
  useEffect(() => {
    if (workspace.cache) {
      setS(normalizeStore(workspace.cache.workspace.store));
      setReady(true);
      const refreshTrial = () => setTrialExpired(!!workspace.cache?.workspace.trial?.endsAt && !workspace.cache.workspace.trial.planActive && Date.now() >= Date.parse(workspace.cache.workspace.trial.endsAt));
      refreshTrial();
      const timer = window.setInterval(refreshTrial, 1000);
      return () => window.clearInterval(timer);
    } else if (workspace.ready) setReady(true);
  }, [workspace.cache, workspace.ready]);
  useEffect(() => {
    const retry = async () => {
      if (!navigator.onLine || !workspace.cache) return;
      await retryAttachmentQueue(workspace.cache.workspace.id, async completed => {
        const byModule = new Map<string, typeof completed>();
        for (const item of completed) {
          const moduleName = item.recordType === "expense" ? "Expenses" : "Purchases";
          byModule.set(moduleName, [...(byModule.get(moduleName) || []), item]);
        }
        for (const [moduleName, items] of byModule) {
          const base = workspace.cache!.workspace.store;
          const key = moduleName === "Expenses" ? "expenses" : "purchases";
          const attached = items.filter(item => item.workspaceId === workspace.cache!.workspace.id && base[key].some((record: any) => record.id === item.recordId && (record.attachments || []).some((attachment: any) => attachment.id === item.pendingId)));
          if (!attached.length) continue;
          const next = { ...base, [key]: base[key].map((record: any) => record.id && attached.some(item => item.recordId === record.id) ? { ...record, attachments: (record.attachments || []).map((attachment: any) => attached.find(item => item.pendingId === attachment.id) || attachment) } : record) };
          await workspace.commit(next, moduleName, "Offline attachments uploaded.");
          await acknowledgeAttachmentQueue(attached.map(item => item.pendingId));
        }
        setS(workspace.cache!.workspace.store);
      });
    };
    window.addEventListener("online", retry);
    void retry();
    return () => window.removeEventListener("online", retry);
  }, [workspace.cache]);
  useEffect(() => {
    if (!invoice) return;
    const latest = [...s.invoices, ...s.purchases].find(t => t.id === invoice.id);
    if (latest && JSON.stringify(latest) !== JSON.stringify(invoice)) setInvoice(latest);
  }, [s, invoice?.id]);
  const account = workspace.cache?.workspace;
  const canAccess = (name: string) => !!account && (name !== "Production" || account.businessType === "manufacturer") && canAccessModule(account.member, name);
  const module = (account ? (canAccess(requestedModule) ? requestedModule : accessibleModule(account.member, "Dashboard")) : "Dashboard") as Module;
  const modalModule = useRef<Module | null>(null);
  useEffect(() => {
    if (account && !canAccess(requestedModule)) {
      if (module) setModule(module);
      setProductSearch("");
    }
    if (modalModule.current && !canAccess(modalModule.current)) setModal("");
    if (invoice && !canAccess(invoice.number.startsWith("PUR") ? "Purchases" : "Billing") &&
      (invoice.number.startsWith("PUR") || !canAccess("Sales"))) setInvoice(null);
  }, [account, requestedModule]);
  useEffect(() => {
    if (account?.member.role === "member" && requestedModule === "Dashboard" && canAccessModule(account.member, "Billing")) setModule("Billing");
  }, [account?.member.id, account?.member.role, requestedModule]);
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
  function commitInline(next: Store, message: string, targetModule = module) {
    if (storageError) throw new Error(storageError);
    workspace.commit(next, targetModule, message);
    setS(next);
    setNotice(message);
    setError("");
  }
  function go(m: Module) {
    if (!canAccess(m)) {
      setNotice("You do not have authority for this module.");
      return;
    }
    if (profileMenu.current) profileMenu.current.open = false;
    setProductSearch("");
    setPaymentMethod("All");
    setModule(m);
    setQuery("");
    setFrom("");
    setTo("");
    setStatus("All");
    setCategory("All");
    setDetailContact(null);
    setReportContact("");
  }
  function openAuditRecord(event: NonNullable<typeof account>["audit"][number]) {
    if (!account) return;
    const target = getFirstRecordTarget(event.records, event.module);
    if (!target) {
      setModule(event.module as Module);
      setNotice("This activity entry does not contain a directly openable record.");
      return;
    }
    const { store } = account;
    if (target.collection === "invoices" || target.collection === "purchases") {
      const trade = (target.collection === "invoices" ? store.invoices : store.purchases).find(item => item.id === target.id);
      if (trade && canAccess(target.collection === "invoices" ? "Sales" : "Purchases")) {
        setModule(target.collection === "invoices" ? "Sales" : "Purchases");
        setInvoice(trade);
        setPaper("A4");
        return;
      }
    }
    if (target.collection === "products") {
      const product = store.products.find(item => item.id === target.id);
      if (product && canAccess("Inventory")) {
        setModule("Inventory");
        setDetailProduct(product);
        setModal("Product details");
        return;
      }
    }
    if (target.collection === "customers" || target.collection === "suppliers") {
      const contactModule = target.collection === "customers" ? "Customers" : "Suppliers";
      const contact = (target.collection === "customers" ? store.customers : store.suppliers).find(item => item.id === target.id);
      if (contact && canAccess(contactModule)) {
        setModule(contactModule);
        setDetailContact(contact);
        return;
      }
    }
    if (target.collection === "movements" && canAccess("Inventory")) {
      setModule("Inventory");
      setQuery(target.id);
      setFrom(""); setTo(""); setStatus("All"); setPaymentMethod("All");
      setError("");
      modalModule.current = "Inventory";
      setModal("Movements");
      return;
    }
    const targetModule = target.module as Module;
    setModule(targetModule);
    setQuery(target.id);
    setFrom("");
    setTo("");
    setStatus("All");
    setPaymentMethod("All");
    setNotice(`Opened ${target.label} ${target.id}.`);
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
    modalModule.current = target as Module;
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
  async function submit(e: FormEvent<HTMLFormElement>, fn: (data: FormData) => void | Promise<void>) {
    e.preventDefault();
    setError("");
    try {
      await fn(new FormData(e.currentTarget));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this record.");
    }
  }
  const text = (f: FormData, key: string) => String(f.get(key) || "").trim();
  const num = (f: FormData, key: string) => Number(f.get(key) || 0);
  const matches = (...values: unknown[]) => matchesQuery(query, ...values);
  const inRange = (date: string) => periodMatch(date, from, to);
  const pName = (id: string) =>
    s.products.find((p) => p.id === id)?.name || "Unknown item";
  const cName = (id: string, supplier = false) =>
    (supplier ? s.suppliers : s.customers).find((c) => c.id === id)?.name ||
    "Walk-in customer";
  const paymentStatus = (trade: Trade) => getPaymentStatus(s, trade);
  const filters = { query, from, to, status, paymentMethod };
  const invoices = filterTrades(s, s.invoices, filters).filter(t => module !== "Sales" || isPosted(t));
  const purchases = filterTrades(s, s.purchases, filters, true);
  const accounting = financialRows(s);
  const cash = accounting.reduce((n, r) => n + r.cash, 0);
  const bank = round((s.financialAccounts || []).reduce((n, a) => n + bankStatement(s, a).closing, 0) + accounting.filter(r => !r.financialAccountId).reduce((n, r) => n + r.bank, 0));
  const receivables = s.customers.reduce((sum, c) => sum + Math.max(contactBalance(s, "Customer", c.id), 0), s.invoices.filter(t => !s.customers.some(c => c.id === t.contactId)).reduce((sum, t) => sum + Math.max(balance(s, t), 0), 0));
  const payables = s.suppliers.reduce((sum, c) => sum + Math.max(contactBalance(s, "Supplier", c.id), 0), s.purchases.filter(t => !s.suppliers.some(c => c.id === t.contactId)).reduce((sum, t) => sum + Math.max(balance(s, t), 0), 0));
  const lowStock = s.products.filter((p) => stock(s, p.id) > 0 && stock(s, p.id) <= p.low);
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
              unit: p.unit || "piece",
              qty: 1,
              price: modal === "Purchase" ? p.cost : p.price,
              cost: p.cost,
            },
          ];
    });
    setError("");
  }
  function scanProduct(code = scan) {
    try {
      const productId = findProductByCode(s.products, code).id;
      addLine(productId);
      setScan("");
      return productId;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not scan product.");
      scanInput.current?.focus();
      scanInput.current?.select();
      return false;
    }
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
      t.createdByName || account?.members.find(member => member.id === t.createdBy)?.name || "Not recorded",
      t.contactId ? cName(t.contactId, supplier) : [t.walkInName, t.walkInCompany].filter(Boolean).join(" · ") || "Walk-in customer",
      t.lines.map((l) => l.qty).join(", "),
      t.lines.map((l) => l.unit || s.products.find((p) => p.id === l.productId)?.unit || "piece").join(", "),
      money(total(t)),
      <Badge tone={t.status === "draft" ? "amber" : t.status === "void" ? "" : balance(s, t) === 0 ? "green" : "amber"}>
        {paymentStatus(t)}
      </Badge>,
      money(paid(s, t)),
      money(balance(s, t)),
      <div className="journal-register-actions"><TradeActions s={s} trade={t} kind={supplier ? "Purchase" : "Sale"} actor={account!.member} commit={(next, message) => { workspace.commit(next, supplier ? "Purchases" : "Billing", message); setS(next); setNotice(message); }} />
      <button
        className="icon-button"
        aria-label={`View ${t.number}`}
        onClick={() => {
          setInvoice(t);
          setPaper("A4");
        }}
      >
        <ChevronRight size={18} />
      </button></div>,
    ]);
  const basicHeaders = [
    "Invoice",
    "Prepared by",
    "Customer",
    "Quantity",
    "UOM",
    "Net total",
    "Status",
    "Paid",
    "Balance",
    "",
  ];
  const reportResult = createReportData(s, {
    ...filters,
    report,
    reportContact,
    reportProduct,
    manufacturer: account?.businessType === "manufacturer",
  });
  useEffect(() => {
    setPdfError("");
  }, [invoice?.id, paper]);
  const start = new Date(`${today()}T12:00:00Z`);
  if (dashboardPeriod === "This month") start.setUTCDate(1);
  if (dashboardPeriod === "This week")
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const dashboardFrom =
    dashboardPeriod === "All time" ? "" : start.toISOString().slice(0, 10);
  const dashboardProfit = profit(s, dashboardFrom, today());
  const dashboardInvoices = s.invoices.filter(isPosted).filter((t) =>
    periodMatch(t.date, dashboardFrom, today()),
  );
  async function saveInvoicePdf() {
    if (!invoice || pdfBusy) return;
    if (!isPosted(invoice)) { setPdfError("Post the bill before issuing an invoice PDF."); return; }
    setPdfBusy(true);
    setPdfError("");
    try {
      const { downloadInvoicePdf } = await import("@/lib/stockwell/invoice-pdf");
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
        StockHale<span>Opening your workspace…</span>
      </div>
    );
  if (
    account &&
    account.member.role !== "owner" &&
    !module
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
        StockHale<a href="/sign-in">Sign in to open your workspace</a>
      </div>
    );
  if (!account.businessType) {
    if (account.member.role === "owner") return <BusinessSetup workspace={workspace} />;
    return <main className="business-setup-shell"><section className="business-setup-card"><span className="section-eyebrow">WORKSPACE SETUP</span><h1>Waiting for your workspace owner</h1><p>The owner needs to finish the one-time business setup before the team can start using this workspace.</p></section></main>;
  }
  const isPlatformAdmin = account.member.email.trim().toLowerCase() === "homiesbridge@gmail.com";
  if (account.locked || trialExpired) {
    if (isPlatformAdmin) return <div className="admin-expired-shell"><AdminPanel onBack={() => void workspace.signout()} /></div>;
    return <div className="trial-lock"><section><span className="section-eyebrow">WORKSPACE ACCESS PAUSED</span><h1>Choose a plan<br/><em>to keep going.</em></h1><p>Your workspace and records are safely saved. Contact our team to activate a subscription; once activated, you can continue where you left off.</p><a className="pricing-action" href="/pricing">Review plans</a><a className="trial-contact" href="mailto:hello@stockhale.app?subject=Activate%20StockHale%20plan">Contact us to activate</a><button onClick={() => void workspace.signout()}>Sign out</button></section></div>;
  }
  return (
    <>
      <div className="app-shell">
        <WorkspaceHeader
          go={go}
          canAccess={canAccess}
          module={module}
          profileMenu={profileMenu}
          account={account}
          workspace={workspace}
          notificationReturn={notificationReturn}
          setProductSearch={setProductSearch}
          setModule={setModule}
          setNotice={setNotice}
          isPlatformAdmin={isPlatformAdmin}
          openAdmin={() => setAdminOpen(true)}
        />
        <div
          className={`workspace ${module === "Dashboard" ? "dashboard-workspace" : ""}`}
        >
          <main>
            {adminOpen && isPlatformAdmin ? <AdminPanel onBack={() => setAdminOpen(false)} /> : null}
            {!adminOpen && <>
            {module === "Settings" && account.member.role === "owner" ? (
              <WorkspaceSettings
                workspace={account}
                action={workspace.action}
                cache={workspace.cache!}
                store={s}
                commitStore={(next) => {
                  workspace.commit(next, "Accounts Heads", "Payment accounts updated.");
                  setS(next);
                }}
              />
            ) : module === "Notifications" &&
              account.member.role === "owner" ? (
              <NotificationsView
                workspace={workspace}
                account={account}
                setNotice={setNotice}
                setModule={setModule}
                notificationReturn={notificationReturn}
                openRecord={openAuditRecord}
              />
            ) : (
              <>
                <ProductSearch
                  store={s}
                  query={productSearch}
                  onChange={setProductSearch}
                  canSearch={canAccess("Inventory")}
                  canSearchCustomers={canAccess("Customers")}
                  canSearchSuppliers={canAccess("Suppliers")}
                />
                <div hidden={!!productSearch.trim()}>
                  <div
                    className={`page-heading ${module === "Dashboard" ? "dashboard-heading" : ""}`}
                  >
                    <div>
                      <span className="eyebrow">
                        {module === "Dashboard"
                          ? "YOUR BUSINESS, AT A GLANCE"
                          : account.businessType === "manufacturer" ? "MANUFACTURING & SALES" : "RETAIL OPERATIONS"}{" "}
                      </span>
                      <h1>
                        {module === "Dashboard"
                          ? "Everything in good order."
                          : module}
                      </h1>
                      <p>{descriptions[module]}</p>
                    </div>
                    <div className="heading-actions">
                      {module === "Dashboard" && canAccess("Billing") && (
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
                      {action && (module !== "Accounts Heads" || account.member.role === "owner") && (
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
                      <button
                        className="icon-button"
                        aria-label="Dismiss notification"
                        onClick={() => setNotice("")}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  )}
                  {module === "Dashboard" ? (
                    <DashboardView
                      canAccess={canAccess}
                      dashboardPeriod={dashboardPeriod}
                      setDashboardPeriod={setDashboardPeriod}
                      dashboardProfit={dashboardProfit}
                      dashboardInvoices={dashboardInvoices}
                      s={s}
                      dashboardFrom={dashboardFrom}
                      lowStock={lowStock}
                      go={go}
                      inventoryValue={inventoryValue}
                      quickProduct={quickProduct}
                      setQuickProduct={setQuickProduct}
                      storageError={storageError}
                      open={open}
                      setLines={setLines}
                      setInvoice={setInvoice}
                      cName={cName}
                      paymentStatus={paymentStatus}
                      cash={cash}
                      bank={bank}
                      receivables={receivables}
                      payables={payables}
                      allProfit={allProfit}
                      pName={pName}
                      manufacturer={account.businessType === "manufacturer"}
                    />
                  ) : (
                    <>
                      {module !== "Closing" && !(["Customers", "Suppliers"] as Module[]).includes(module) && <RecordFilters
                        query={query}
                        setQuery={setQuery}
                        module={module}
                        status={status}
                        setStatus={setStatus}
                        paymentMethod={paymentMethod}
                        setPaymentMethod={setPaymentMethod}
                        category={category}
                        setCategory={setCategory}
                        s={s}
                        from={from}
                        to={to}
                        setFrom={setFrom}
                        setTo={setTo}
                      />}
                      {(module === "Customers" || module === "Suppliers") && <div className="contact-directory-toolbar">
                        <label className="search">
                          <Search size={17} aria-hidden="true" />
                          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${module.toLowerCase()} by name, phone, email…`} aria-label={`Search ${module.toLowerCase()}`} />
                        </label>
                        <span className="directory-count">{module === "Customers" ? s.customers.length : s.suppliers.length} accounts</span>
                        <button className="primary directory-add" disabled={!!storageError} onClick={() => { setEditContact(null); open("Contact"); }}><Plus size={16} /> Add {module === "Customers" ? "customer" : "supplier"}</button>
                      </div>}
                      {module === "Inventory" && (
                        <InventoryView
                          s={s}
                          manufacturer={account.businessType === "manufacturer"}
                          open={open}
                          query={query}
                          category={category}
                          status={status}
                          setEditProduct={setEditProduct}
                          selectProduct={(product) => { setDetailProduct(product); open("Product details"); }}
                        />
                      )}
                      {module === "Billing" && account.member.role !== "owner" && <p className="field-help billing-record-policy">New sales appear in this billing register and the Sales report. Staff can create sales dated today; posted bills can only be corrected by the owner, with changes recorded in the activity log.</p>}
                      {module === "Billing" && <WalkInReview s={s} actor={account.member} commit={commit} />}
                      {(module === "Purchases" || module === "Billing") && (
                        <TradeHistoryView
                          module={module}
                          invoices={invoices}
                          purchases={purchases}
                          basicHeaders={basicHeaders}
                          tradeRows={tradeRows}
                        />
                      )}
                      {module === "Sales" && (
                        <SalesView
                          from={from}
                          to={to}
                          setFrom={setFrom}
                          setTo={setTo}
                          s={s}
                          invoices={invoices}
                          pName={pName}
                          setInvoice={setInvoice}
                          setPaper={setPaper}
                          preparedBy={(id, name) => name || account.members.find(member => member.id === id)?.name || "Not recorded"}
                        />
                      )}
                      {module === "Accounts Heads" && (
                        <AccountHeadsView
                          actor={account.member}
                          commit={commit}
                          s={s}
                          matches={matches}
                          accounting={accounting}
                          inRange={inRange}
                        />
                      )}
                      {module === "Expenses" && (
                        <ExpensesView
                          s={s}
                          inRange={inRange}
                          matches={matches}
                          category={category}
                          open={open}
                          owner={account.member.role === "owner"}
                          memberName={(id, name) => name || account.members.find(member => member.id === id)?.name || "Not recorded"}
                          commit={commit}
                        />
                      )}
                      {module === "Payments" && (
                        <PaymentsView
                          actor={account.member}
                          receivables={receivables}
                          payables={payables}
                          cash={cash}
                          bank={bank}
                          s={s}
                          cName={cName}
                          inRange={inRange}
                          matches={matches}
                          commit={commit}
                          query={query}
                        />
                      )}
                      {(module === "Customers" || module === "Suppliers") && (
                        <ContactsView
                          module={module}
                          s={s}
                          matches={matches}
                          setDetailContact={setDetailContact}
                          setEditContact={setEditContact}
                          open={open}
                          detailContact={detailContact}
                          basicHeaders={basicHeaders}
                          tradeRows={tradeRows}
                        />
                      )}
                      {module === "Returns & Damage" && (
                        <ReturnsView
                          s={s}
                          inRange={inRange}
                          matches={matches}
                          pName={pName}
                          setInvoice={(trade) => { setInvoice(trade); setPaper("A4"); }}
                        />
                      )}
                      {module === "Reports" && (
                        <ReportsView
                          actor={account.member}
                          manufacturer={account.businessType === "manufacturer"}
                          commit={commit}
                          reopenWithOwnerPassword={(closingId, reason, password) => workspace.action({ action: "reopen-day", closingId, reason, password })}
                          report={report}
                          setReport={setReport}
                          setReportContact={setReportContact}
                          reportContact={reportContact}
                          reportProduct={reportProduct}
                          setReportProduct={setReportProduct}
                          from={from}
                          to={to}
                          s={s}
                          reportResult={reportResult}
                        />
                      )}
                      {module === "Closing" && <DailyClosingView s={s} actor={account.member} query={query} commit={commit} reopenWithOwnerPassword={(closingId, reason, password) => workspace.action({ action: "reopen-day", closingId, reason, password })} />}
                      {module === "Production" && account.businessType === "manufacturer" && <ProductionView store={s} actor={account.member} query={query} commit={async (next, message) => { await workspace.commit(next, "Production", message); setS(next); setNotice(message); setError(""); }} />}
                    </>
                  )}
                </div>
                <footer>
                  StockHale <span>{account.businessType === "manufacturer" ? "Manufacturing & Operations" : "Retail Inventory & Operations"}</span>
                  <span>All amounts in PKR</span>
                </footer>
              </>
            )}
            </>}
          </main>
        </div>
      </div>
      {modal && modalModule.current && canAccess(modalModule.current) && (
        <Modal
          title={
            modal === "Bill"
              ? "New customer bill"
              : modal === "Product"
                ? editProduct
                  ? "Edit product"
                  : "Add product"
                : modal === "Product details" ? detailProduct?.name || "Product details"
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
          {modal === "Product details" && detailProduct && <ProductDetailView s={s} product={detailProduct} openStockReport={canAccess("Reports") ? () => { setReport("Stock movement report"); setReportProduct(detailProduct.id); setModule("Reports"); setModal(""); } : undefined} />}
          {modal === "Product" && (
            <ProductForm
              commitInline={(next, message) => commitInline(next, message, "Inventory")}
              submit={submit}
              editProduct={editProduct}
              text={text}
              num={num}
              commit={commit}
              s={s}
              setModal={setModal}
            />
          )}
          {modal === "Head" && <AccountForm s={s} commit={commit} />}
          {["Category", "Expense category"].includes(modal) && (
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
            <AdjustmentForm
              submit={submit}
              commit={commit}
              s={s}
              text={text}
              num={num}
            />
          )}
          {modal === "Movements" && (
            <MovementsForm s={s} matches={matches} pName={pName} />
          )}
          {modal === "Contact" && (
            <ContactForm
              submit={submit}
              editContact={editContact}
              text={text}
              num={num}
              module={module}
              commit={commit}
              s={s}
              detailContact={detailContact}
              setDetailContact={setDetailContact}
            />
          )}
          {(modal === "Purchase" || modal === "Bill") && (
            <TradeForm
              submit={submit}
              text={text}
              num={num}
              s={s}
              modal={modal}
              isOwner={account.member.role === "owner"}
              creator={{ id: account.member.id, name: account.member.name }}
              workspaceId={account.id}
              commit={async (next, message) => {
                await commit(next, message);
                if (modal === "Bill") { setQuery(""); setFrom(""); setTo(""); }
              }}
              setInvoice={setInvoice}
              setPaper={setPaper}
              scanInput={scanInput}
              scan={scan}
              setScan={setScan}
              scanProduct={scanProduct}
              addLine={addLine}
              lines={lines}
              pName={pName}
              setLines={setLines}
              discount={discount}
              setDiscount={setDiscount}
              tax={tax}
              setTax={setTax}
              billTotal={billTotal}
              setModal={setModal}
              canAddSupplier={canAccess("Suppliers")}
              canAddProduct={canAccess("Purchases")}
              saveProductCategory={(next, message) => commitInline(next, message, "Inventory")}
              addProduct={async (product, opening) => {
                if (storageError) throw new Error(storageError);
                const { saveProduct } = await import("@/lib/stockwell/model");
                const next = saveProduct(storeRef.current, product, opening);
                await workspace.commit(next, "Purchases", "Product saved and added to purchase.");
                storeRef.current = next;
                setS(next);
                setLines(current => [...current, { productId: product.id, unit: product.unit || "piece", qty: 1, price: product.cost, cost: product.cost }]);
                setNotice("Product saved and added to purchase.");
                setError("");
                return next;
              }}
              canAddCustomer={canAccess("Customers")}
              canChangeHead={account.member.role === "owner"}
              addSupplier={(supplier) => {
                if (storageError) throw new Error(storageError);
                const next = { ...s, suppliers: [...s.suppliers, supplier] };
                workspace.commit(next, "Suppliers", "Supplier added from purchase form.");
                setS(next);
                setNotice("Supplier saved and selected.");
                setError("");
              }}
              addCustomer={(customer) => {
                if (storageError) throw new Error(storageError);
                const next = { ...s, customers: [...s.customers, customer] };
                workspace.commit(next, "Customers", "Customer added from billing form.");
                setS(next);
                setNotice("Customer saved and selected.");
                setError("");
              }}
            />
          )}
          {modal === "Expense" && (
            <ExpenseForm
              commitInline={(next, message) => commitInline(next, message, "Expenses")}
              actor={account.member}
              workspaceId={account.id}
              submit={submit}
              num={num}
              commit={commit}
              s={s}
              text={text}
            />
          )}
          {modal === "Payment" && (
            <PaymentForm
              submit={submit}
              commit={commit}
              s={s}
              text={text}
              paymentKind={paymentKind}
              selectedContact={selectedContact}
              num={num}
              selectedTrade={selectedTrade}
              setPaymentKind={setPaymentKind}
              setSelectedContact={setSelectedContact}
              setSelectedTrade={setSelectedTrade}
            />
          )}
          {modal === "Return" && (
            <ReturnForm
              submit={submit}
              commit={commit}
              s={s}
              text={text}
              returnKind={returnKind}
              selectedTrade={selectedTrade}
              setReturnKind={setReturnKind}
              setSelectedTrade={setSelectedTrade}
            />
          )}
        </Modal>
      )}
      {invoice && (canAccess(invoice.number.startsWith("PUR") ? "Purchases" : "Billing") || (!invoice.number.startsWith("PUR") && canAccess("Sales"))) && (
        <InvoicePreview
          setInvoice={setInvoice}
          paper={paper}
          setPaper={setPaper}
          pdfBusy={pdfBusy}
          saveInvoicePdf={saveInvoicePdf}
          pdfError={pdfError}
          invoice={invoice}
          cName={cName}
          s={s}
          paymentStatus={paymentStatus}
          pName={pName}
          preparedBy={invoice.createdByName || account.members.find(member => member.id === invoice.createdBy)?.name || "Not recorded"}
        />
      )}
    </>
  );
}

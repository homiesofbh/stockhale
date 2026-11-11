"use client";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { type Module } from "@/components/stockwell/navigation";
import { StockArt } from "@/components/stockwell/stock-art";
import { Badge, Empty, ServerPagination, Stat, Table } from "@/components/stockwell/ui";
import {
  balance,
  money,
  today,
  total,
  type Line,
  type Product,
  type Store,
  type Trade,
} from "@/lib/stockwell/model";
import {
  ArrowUpRight,
  Boxes,
  ChevronRight,
  CircleDollarSign,
  Package,
} from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useServerCollection } from "@/lib/stockwell/use-server-collection";
import { useState } from "react";
type Props = {
  canAccess: (module: string) => boolean;
  dashboardPeriod: string;
  setDashboardPeriod: Dispatch<SetStateAction<string>>;
  s: Store;
  dashboardFrom: string;
  go: (m: Module) => void;
  quickProduct: string;
  setQuickProduct: Dispatch<SetStateAction<string>>;
  storageError: string;
  open: (name: string) => void;
  setLines: Dispatch<SetStateAction<Line[]>>;
  setInvoice: Dispatch<SetStateAction<Trade | null>>;
  cName: (id: string, supplier?: boolean) => string;
  paymentStatus: (t: Trade) => "Credit balance" | "Paid" | "Partial" | "Unpaid" | "Draft" | "Voided";
  cash: number;
  bank: number;
  pName: (id: string) => string;
  manufacturer: boolean;
};
export function DashboardView({
  canAccess,
  dashboardPeriod,
  setDashboardPeriod,
  s,
  dashboardFrom,
  go,
  quickProduct,
  setQuickProduct,
  storageError,
  open,
  setLines,
  setInvoice,
  cName,
  paymentStatus,
  cash,
  bank,
  pName,
  manufacturer,
}: Props) {
  const [quickProductQuery, setQuickProductQuery] = useState("");
  const latestInvoices = useServerCollection<Trade>({ collection: "invoices", module: "Sales", pageSize: 5, enabled: canAccess("Billing") });
  const latestPurchases = useServerCollection<Trade>({ collection: "purchases", module: "Inventory", pageSize: 4, enabled: canAccess("Purchases") });
  const latestSales = useServerCollection<Trade>({ collection: "invoices", module: "Sales", pageSize: 4, enabled: canAccess("Sales") });
  const periodPurchases = useServerCollection<Trade>({ collection: "purchases", module: "Inventory", from: dashboardFrom, to: today(), pageSize: 1, enabled: canAccess("Purchases") });
  const todaySalesSummary = useServerCollection<Trade>({ collection: "invoices", module: "Billing", from: today(), to: today(), pageSize: 1, enabled: canAccess("Billing") });
  const inventoryPage = useServerCollection<Product>({ collection: "products", status: "Low stock", pageSize: 5, enabled: canAccess("Inventory") });
  const inventoryAll = useServerCollection<Product>({ collection: "products", query: quickProductQuery, pageSize: 10, enabled: canAccess("Inventory") });
  const receivableStats = useServerCollection<any>({ collection: "dashboardSummary", module: "Billing", pageSize: 1, enabled: canAccess("Billing") });
  const payableStats = useServerCollection<any>({ collection: "dashboardSummary", module: "Purchases", pageSize: 1, enabled: canAccess("Purchases") });
  const periodStats = useServerCollection<any>({ collection: "dashboardSummary", module: "Billing", from: dashboardFrom, to: today(), pageSize: 1, enabled: canAccess("Billing") });
  const allProfitStats = useServerCollection<any>({ collection: "dashboardSummary", module: "Billing", pageSize: 1, enabled: canAccess("Billing") });
  const periodInvoiceCount = Number(periodStats.aggregates?.invoiceCount || 0);
  const lowStockCount = Number(inventoryPage.aggregates?.lowStock || 0);
  const productionRuns = useServerCollection<any>({ collection: "productionRuns", from: dashboardFrom || undefined, to: today(), pageSize: 1, enabled: manufacturer });
  return (
    <>
      <section className="dashboard-summary" aria-label="Sales overview">
        <div className="summary-avatar">
          <StockArt compact />
        </div>
        <div className="summary-sales">
          <label className="summary-period">
            <span className="sr-only">Dashboard period</span>
            <GlassSelect
              aria-label="Dashboard period"
              value={dashboardPeriod}
              onValueChange={(e) => setDashboardPeriod(e)}
            >
              <option>This month</option>
              <option>This week</option>
              <option>Today</option>
              <option>All time</option>
            </GlassSelect>
          </label>
          <div className="summary-value">
            {money(periodStats.aggregates?.profit?.revenue || 0)}{" "}
            <CircleDollarSign size={21} strokeWidth={1.3} />
          </div>
          <p>
            {periodInvoiceCount} completed sales <span>·</span> Averaging{" "}
            <b>
              {money(
                periodInvoiceCount
                ? (periodStats.aggregates?.profit?.revenue || 0) / periodInvoiceCount
                  : 0,
              )}
            </b>
          </p>
        </div>
        <div className="summary-detail">
          <h3>
            Your <b>{manufacturer ? "manufacturing" : "retail"}</b> overview
          </h3>
          <dl>
            <div>
              <dt>Purchases</dt>
              <dd>
                {
                  periodPurchases.count
                }
              </dd>
            </div>
            <div>
              <dt>{manufacturer ? "Production runs" : "Billing today"}</dt>
              <dd>
                {manufacturer ? productionRuns.count : money(todaySalesSummary.aggregates?.total || 0)}
              </dd>
            </div>
            {manufacturer && <div><dt>Material cost transferred</dt><dd>{money(productionRuns.aggregates?.materialCost || 0)}</dd></div>}
            <div>
              <dt>Expenses</dt>
              <dd>{money(periodStats.aggregates?.profit?.expenses || 0)}</dd>
            </div>
            <div>
              <dt>Low-stock items</dt>
              <dd>{lowStockCount}</dd>
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
            <strong>{inventoryAll.count}</strong>
          </div>
        </div>
      </section>
      <section className="dashboard-heroes" aria-label="Inventory and billing">
        {canAccess("Inventory") && <button className="inventory-hero" onClick={() => go("Inventory")}>
          <StockArt />
          <div className="inventory-hero-copy">
            <Package size={33} strokeWidth={1.3} />
            <h2>YOUR INVENTORY</h2>
            <p>
              {inventoryAll.count} products · {s.categories.length}{" "}
              {s.categories.length === 1 ? "category" : "categories"}
              <br />
              {lowStockCount} items at low stock
            </p>
            <strong>{money(inventoryAll.aggregates?.stockValue || 0)}</strong>
            <small>Current stock value</small>
          </div>
          <ChevronRight className="hero-arrow" size={22} />
        </button>}
        {canAccess("Billing") && <div className="billing-hero">
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
            <GlassSelect
              aria-label="Quick bill product"
              value={quickProduct}
              onValueChange={(e) => setQuickProduct(e)}
            >
              <option value="">Select a product</option>
              {(inventoryAll.records as Product[]).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </GlassSelect>
            <input type="search" aria-label="Search products to bill" placeholder="Search products…" value={quickProductQuery} onChange={event => setQuickProductQuery(event.target.value)} />
            <ServerPagination page={inventoryAll.page} pageCount={inventoryAll.pageCount} count={inventoryAll.count} pageSize={inventoryAll.pageSize} setPage={inventoryAll.setPage} />
            <button
              className="gradient-button"
              disabled={!!storageError}
              onClick={() => {
                go("Billing");
                open("Bill");
                const p = inventoryAll.records.find((p) => p.id === quickProduct) || s.products.find((p) => p.id === quickProduct);
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
        </div>}
      </section>
      <div className="dashboard-grid primary-records">
        {canAccess("Billing") && <section className="card recent">
          <div className="section-head">
            <div>
              <h2>Recent invoices</h2>
              <p>The latest posted sales.</p>
            </div>
            <button className="text-button" onClick={() => go("Billing")}>
              All invoices <ArrowUpRight size={15} />
            </button>
          </div>
          <Table
            headers={["Invoice", "Customer", "Total", "Payment"]}
            rows={latestInvoices.records.map((t) => [
                <button className="link" onClick={() => setInvoice(t)}>
                  {t.number}
                  <small>{t.date}</small>
                </button>,
                cName(t.contactId),
                money(total(t)),
                <Badge tone={balance(s, t) === 0 ? "green" : "amber"}>
                  {paymentStatus(t)}
                </Badge>,
              ])}
            empty="Ready for your first sale"
          />
        </section>}
        {canAccess("Inventory") && <section className="card stock-card">
          <div className="section-head">
            <div>
              <h2>Stock watch</h2>
              <p>{lowStockCount} items at or below threshold</p>
            </div>
            <span className="stock-icon">
              <Boxes size={20} />
            </span>
          </div>
          {inventoryPage.records.length ? (
            inventoryPage.records.map((p) => (
              <div className="stock-watch" key={p.id}>
                <span className="product-icon">
                  <Package size={18} />
                </span>
                <div>
                  <b>{p.name}</b>
                  <small>{p.sku}</small>
                </div>
                <Badge tone="amber">{Number((p as Product & { currentStock?: number }).currentStock || 0)} left</Badge>
              </div>
            ))
          ) : (
            <Empty title="No items are at low stock">
              Low-stock items will be flagged here.
            </Empty>
          )}
          <button className="full-link" onClick={() => go("Inventory")}>
            Manage inventory <ChevronRight size={16} />
          </button>
        </section>}
      </div>
      <div className="section-label">
        THE FINANCIAL PICTURE <span>All recorded transactions</span>
      </div>
      <div className="stats-grid secondary">
        <Stat
          label="Cash position"
          value={money(cash)}
          detail={`Bank position ${money(bank)}`}
        />
        <Stat
          label="Receivables"
          value={money(receivableStats.aggregates?.balance || 0)}
          detail="Outstanding customer bills"
        />
        <Stat
          label="Payables"
          value={money(payableStats.aggregates?.balance || 0)}
          detail="Outstanding supplier purchases"
        />
        <Stat
          label="Profit overview"
          value={money(allProfitStats.aggregates?.profit?.net || 0)}
          detail={`${money((allProfitStats.aggregates?.profit?.expenses || 0) + (allProfitStats.aggregates?.profit?.otherExpenses || 0))} in expenses · ${money(allProfitStats.aggregates?.profit?.otherIncome || 0)} other income`}
        />
      </div>
      <div className="dashboard-grid">
        {canAccess("Purchases") && <section className="card">
          <div className="section-head">
            <h2>Recent purchases</h2>
            <button className="text-button" onClick={() => go("Purchases")}>
              View all <ArrowUpRight size={15} />
            </button>
          </div>
          <Table
            headers={["Reference", "Supplier", "Amount"]}
            rows={latestPurchases.records.map((t) => [
                t.number,
                cName(t.contactId, true),
                money(total(t)),
              ])}
          />
        </section>}
        {canAccess("Sales") && <section className="card">
          <div className="section-head">
            <h2>Recent sales</h2>
            <button className="text-button" onClick={() => go("Sales")}>
              View all <ArrowUpRight size={15} />
            </button>
          </div>
          <Table
            headers={["Date", "Product", "Quantity"]}
            rows={latestSales.records.flatMap((t) =>
                t.lines.map((l) => [t.date, pName(l.productId), l.qty]),
              )}
          />
        </section>}
      </div>
    </>
  );
}

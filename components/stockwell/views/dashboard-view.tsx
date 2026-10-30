"use client";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { type Module } from "@/components/stockwell/navigation";
import { StockArt } from "@/components/stockwell/stock-art";
import { Badge, Empty, Stat, Table } from "@/components/stockwell/ui";
import {
  balance,
  money,
  isPosted,
  periodMatch,
  stock,
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
type Props = {
  canAccess: (module: string) => boolean;
  dashboardPeriod: string;
  setDashboardPeriod: Dispatch<SetStateAction<string>>;
  dashboardProfit: {
    revenue: number;
    otherIncome: number;
    cogs: number;
    expenses: number;
    otherExpenses: number;
    damage: number;
    net: number;
  };
  dashboardInvoices: Trade[];
  s: Store;
  dashboardFrom: string;
  lowStock: Product[];
  go: (m: Module) => void;
  inventoryValue: number;
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
  receivables: number;
  payables: number;
  allProfit: {
    revenue: number;
    otherIncome: number;
    cogs: number;
    expenses: number;
    otherExpenses: number;
    damage: number;
    net: number;
  };
  pName: (id: string) => string;
};
export function DashboardView({
  canAccess,
  dashboardPeriod,
  setDashboardPeriod,
  dashboardProfit,
  dashboardInvoices,
  s,
  dashboardFrom,
  lowStock,
  go,
  inventoryValue,
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
  receivables,
  payables,
  allProfit,
  pName,
}: Props) {
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
            {money(dashboardProfit.revenue)}{" "}
            <CircleDollarSign size={21} strokeWidth={1.3} />
          </div>
          <p>
            {dashboardInvoices.length} completed sales <span>·</span> Averaging{" "}
            <b>
              {money(
                dashboardInvoices.length
                  ? dashboardProfit.revenue / dashboardInvoices.length
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
                  s.purchases.filter(isPosted).filter((t) =>
                    periodMatch(t.date, dashboardFrom, today()),
                  ).length
                }
              </dd>
            </div>
            <div>
              <dt>Billing today</dt>
              <dd>
                {money(
                  s.invoices.filter(isPosted)
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
      <section className="dashboard-heroes" aria-label="Inventory and billing">
        {canAccess("Inventory") && <button className="inventory-hero" onClick={() => go("Inventory")}>
          <StockArt />
          <div className="inventory-hero-copy">
            <Package size={33} strokeWidth={1.3} />
            <h2>YOUR INVENTORY</h2>
            <p>
              {s.products.length} products · {s.categories.length}{" "}
              {s.categories.length === 1 ? "category" : "categories"}
              <br />
              {lowStock.length} items at low stock
            </p>
            <strong>{money(inventoryValue)}</strong>
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
              {s.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </GlassSelect>
            <button
              className="gradient-button"
              disabled={!!storageError}
              onClick={() => {
                go("Billing");
                open("Bill");
                const p = s.products.find((p) => p.id === quickProduct);
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
              <p>The latest from your counter.</p>
            </div>
            <button className="text-button" onClick={() => go("Billing")}>
              All invoices <ArrowUpRight size={15} />
            </button>
          </div>
          <Table
            headers={["Invoice", "Customer", "Total", "Payment"]}
            rows={s.invoices.filter(isPosted)
              .slice(-5)
              .reverse()
              .map((t) => [
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
          detail={`${money(allProfit.expenses + allProfit.otherExpenses)} in expenses · ${money(allProfit.otherIncome)} other income`}
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
            rows={s.purchases.filter(isPosted)
              .slice(-4)
              .reverse()
              .map((t) => [
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
            rows={s.invoices.filter(isPosted)
              .slice(-4)
              .reverse()
              .flatMap((t) =>
                t.lines.map((l) => [t.date, pName(l.productId), l.qty]),
              )}
          />
        </section>}
      </div>
    </>
  );
}

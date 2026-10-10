"use client";
import { GlassSelect } from "@/components/stockwell/glass-select";
import { type Store } from "@/lib/stockwell/model";
import { Search, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
type Props = {
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  module:
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
  status: string;
  setStatus: Dispatch<SetStateAction<string>>;
  paymentMethod: string;
  setPaymentMethod: Dispatch<SetStateAction<string>>;
  category: string;
  setCategory: Dispatch<SetStateAction<string>>;
  s: Store;
  from: string;
  to: string;
  setFrom: Dispatch<SetStateAction<string>>;
  setTo: Dispatch<SetStateAction<string>>;
};
export function RecordFilters({
  query,
  setQuery,
  module,
  status,
  setStatus,
  paymentMethod,
  setPaymentMethod,
  category,
  setCategory,
  s,
  from,
  to,
  setFrom,
  setTo,
}: Props) {
  return (
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
      {["Purchases", "Billing", "Sales"].includes(module) && (
        <GlassSelect
          aria-label="Payment status"
          value={status}
          onValueChange={(e) => setStatus(e)}
        >
          {["All", "Draft", "Paid", "Partial", "Unpaid", "Credit balance", "Voided"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </GlassSelect>
      )}
      {["Purchases", "Billing", "Sales"].includes(module) && (
        <GlassSelect
          aria-label="Payment method"
          value={paymentMethod}
          onValueChange={(e) => setPaymentMethod(e)}
        >
          <option value="All">All payments</option>
          <option>Cash</option>
          <option>Bank</option>
          <option>Cheque</option>
          {(s.financialAccounts || []).map((account) => <option key={account.id}>{account.name}</option>)}
        </GlassSelect>
      )}
      {module === "Inventory" && (
        <>
          <GlassSelect
            aria-label="Product category"
            value={category}
            onValueChange={(e) => setCategory(e)}
          >
            <option>All</option>
            {s.categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </GlassSelect>
          <GlassSelect
            aria-label="Stock status"
            value={status}
            onValueChange={(e) => setStatus(e)}
          >
            <option>All</option>
            <option>Low stock</option>
            <option>In stock</option>
          </GlassSelect>
        </>
      )}
      {module === "Expenses" && (
        <GlassSelect
          aria-label="Expense category"
          value={category}
          onValueChange={(e) => setCategory(e)}
        >
          <option>All</option>
          {s.expenseCategories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </GlassSelect>
      )}
      {!["Inventory", "Suppliers", "Customers"].includes(module) && (
        <div className="date-filter">
          <input
            type="date"
            aria-label="From date"
            value={from}
            max={to || undefined}
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
        paymentMethod !== "All" ||
        status !== "All" ||
        category !== "All") && (
        <button
          className="icon-button filter-clear-button"
          aria-label="Clear filters"
          title="Clear filters"
          onClick={() => {
            setQuery("");
            setFrom("");
            setTo("");
            setStatus("All");
            setCategory("All");
            setPaymentMethod("All");
          }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

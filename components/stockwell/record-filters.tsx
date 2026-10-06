"use client";
import { type Store } from "@/lib/stockwell/model";
import { Search } from "lucide-react";
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
        <select
          aria-label="Payment status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {["All", "Paid", "Partial", "Unpaid", "Credit balance"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      )}
      {["Purchases", "Billing", "Sales"].includes(module) && (
        <select
          aria-label="Payment method"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        >
          <option value="All">All payments</option>
          <option>Cash</option>
          <option>Bank</option>
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
          className="text-button"
          onClick={() => {
            setQuery("");
            setFrom("");
            setTo("");
            setStatus("All");
            setCategory("All");
            setPaymentMethod("All");
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}

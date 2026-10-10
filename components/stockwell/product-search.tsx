"use client";

import { Search, X } from "lucide-react";
import { money, stock, type Store } from "@/lib/stockwell/model";
import { searchProducts } from "@/lib/stockwell/record-selectors";
import { Empty, Table } from "./ui";

type Props = {
  store: Store;
  query: string;
  onChange: (query: string) => void;
  canSearch: boolean;
  canSearchCustomers?: boolean;
  canSearchSuppliers?: boolean;
};

export function ProductSearch({ store, query, onChange, canSearch, canSearchCustomers = canSearch, canSearchSuppliers = canSearch }: Props) {
  if (!canSearch && !canSearchCustomers && !canSearchSuppliers) return null;
  return (
    <>
      <form
        className="global-search"
        onSubmit={(event) => event.preventDefault()}
      >
        <Search size={18} strokeWidth={1.6} />
        <input
          aria-label="Search products, customers, and suppliers"
          placeholder="Search products, customers, or suppliers"
          value={query}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          aria-label="Clear search"
          title="Clear search"
          type="button"
          onClick={() => onChange("")}
        >
          <X size={19} strokeWidth={1.5} />
        </button>
      </form>
      {query.trim() && (
        <section
          className="product-search-results"
          aria-label="Product search results"
        >
          <div className="page-heading">
            <div>
              <h1>Product results</h1>
              <p>Matching names, SKU, barcode, and category.</p>
            </div>
          </div>
          {canSearch ? (
            <Table
              headers={[
                "Product",
                "SKU / Barcode",
                "Category",
                "Stock",
                "Selling price",
              ]}
              empty="No matching products"
              rows={searchProducts(store.products, query).map((product) => [
                product.name,
                <>
                  {product.sku}
                  <small>{product.barcode}</small>
                </>,
                product.category,
                stock(store, product.id),
                money(product.price),
              ])}
            />
          ) : null}
          {(canSearchCustomers || canSearchSuppliers) && <>
            <div className="page-heading global-search-subheading"><div><h2>Contacts</h2><p>Matching customers and suppliers.</p></div></div>
            <Table
              headers={["Name", "Type", "Company", "Phone", "Email"]}
              empty="No matching customers or suppliers"
              rows={[...(canSearchCustomers ? store.customers.map((contact) => [contact, "Customer"] as const) : []), ...(canSearchSuppliers ? store.suppliers.map((contact) => [contact, "Supplier"] as const) : [])]
                .filter(([contact]) => [contact.name, contact.company, contact.phone, contact.mobile, contact.email].filter(Boolean).join(" ").toLowerCase().includes(query.trim().toLowerCase()))
                .map(([contact, type]) => [contact.name || contact.company, type, contact.company || "—", contact.phone || contact.mobile || "—", contact.email || "—"])}
            />
          </>}
          {!canSearch && !canSearchCustomers && !canSearchSuppliers && <Empty title="No search access" />}
        </section>
      )}
    </>
  );
}

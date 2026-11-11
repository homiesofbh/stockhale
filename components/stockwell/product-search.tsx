"use client";

import { Search, X } from "lucide-react";
import { money, stock, type Store } from "@/lib/stockwell/model";
import { Empty, Table } from "./ui";
import { ServerPagination } from "./ui";
import { useServerCollection } from "@/lib/stockwell/use-server-collection";

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
  const normalizedQuery = query.trim().toLowerCase();
  const productsPage = useServerCollection<any>({ collection: "products", query, pageSize: 10, enabled: canSearch && !!normalizedQuery });
  const customersPage = useServerCollection<any>({ collection: "customers", query, module: "Customers", pageSize: 10, enabled: canSearchCustomers && !!normalizedQuery });
  const suppliersPage = useServerCollection<any>({ collection: "suppliers", query, module: "Suppliers", pageSize: 10, enabled: canSearchSuppliers && !!normalizedQuery });
  const matchingProducts = productsPage.records;
  const matchingContacts = [...customersPage.records.map(contact => [contact, "Customer"] as const), ...suppliersPage.records.map(contact => [contact, "Supplier"] as const)];
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
        <section className="product-search-results" aria-label="Search results">
          {canSearch && matchingProducts.length > 0 ? (
            <div>
              <div className="page-heading">
                <div className="ml-4">
                  <h1>Product results</h1>
                  <p>Matching names, SKU, barcode, and category.</p>
                </div>
              </div>
            <Table
              headers={[
                "Product",
                "SKU / Barcode",
                "Category",
                "Stock",
                "Selling price",
              ]}
              empty="No matching products"
              rows={matchingProducts.map((product) => [
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
            <ServerPagination page={productsPage.page} pageCount={productsPage.pageCount} count={productsPage.count} pageSize={productsPage.pageSize} setPage={productsPage.setPage} />
            </div>
          ) : null}
          {matchingContacts.length > 0 && <>
            <div className="page-heading global-search-subheading"><div className="ml-4"><h2>Contacts</h2><p>Matching customers and suppliers.</p></div></div>
            <Table
              headers={["Name", "Type", "Company", "Phone", "Email"]}
              empty="No matching customers or suppliers"
              rows={matchingContacts
                .map(([contact, type]) => [contact.name || contact.company, type, contact.company || "—", contact.phone || contact.mobile || "—", contact.email || "—"])}
            />
            <ServerPagination page={customersPage.page} pageCount={customersPage.pageCount} count={customersPage.count} pageSize={customersPage.pageSize} setPage={customersPage.setPage} />
            <ServerPagination page={suppliersPage.page} pageCount={suppliersPage.pageCount} count={suppliersPage.count} pageSize={suppliersPage.pageSize} setPage={suppliersPage.setPage} />
          </>}
          {!matchingProducts.length && !matchingContacts.length && <Empty title="No matching records" />}
        </section>
      )}
    </>
  );
}

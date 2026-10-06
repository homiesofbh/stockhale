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
};

export function ProductSearch({ store, query, onChange, canSearch }: Props) {
  return (
    <>
      <form
        className="global-search"
        onSubmit={(event) => event.preventDefault()}
      >
        <Search size={18} strokeWidth={1.6} />
        <input
          aria-label="Search products"
          placeholder="Search for a product"
          value={query}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          aria-label="Clear product search"
          title="Clear product search"
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
          ) : (
            <Empty title="Inventory access required" />
          )}
        </section>
      )}
    </>
  );
}

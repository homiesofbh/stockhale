"use client";
import { Badge, Table } from "@/components/stockwell/ui";
import { money, stock, type Product, type Store } from "@/lib/stockwell/model";
import { ArrowDownLeft, Package } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
type Props = {
  s: Store;
  lowStock: Product[];
  open: (name: string) => void;
  matches: (...values: unknown[]) => boolean;
  category: string;
  status: string;
  setEditProduct: Dispatch<SetStateAction<Product | null>>;
};
export function InventoryView({
  s,
  lowStock,
  open,
  matches,
  category,
  status,
  setEditProduct,
}: Props) {
  return (
    <>
      <div className="sub-actions">
        <span>
          {s.products.length} products{" "}
          <span className="muted">/ {lowStock.length} low stock</span>
        </span>
        <div>
          <button className="secondary-button" onClick={() => open("Category")}>
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
            "Colour / GSM",
            "Packing / Store / Size",
            "Stock",
            "Cost price",
            "Selling price",
            "Max stock",
            "Status",
            "Suppliers",
            "Variant",
            "",
          ]}
          rows={s.products
            .filter(
              (p) =>
                matches(p.name, p.sku, p.barcode, p.category) &&
                (category === "All" || p.category === category) &&
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
                <small>{p.barcode || "No barcode assigned"}</small>
              </>,
              p.category,
              [p.color, p.gsm ? `${p.gsm} GSM` : ""].filter(Boolean).join(" · ") || "—",
              [p.packing, p.store, p.size].filter(Boolean).join(" · ") || "—",
              <b>{stock(s, p.id)} {p.unit || "piece"}</b>,
              money(p.cost),
              money(p.price),
              p.maximum ?? "—",
              <Badge tone={stock(s, p.id) <= p.low ? "amber" : "green"}>
                {stock(s, p.id) <= p.low ? "Low stock" : "In stock"}
              </Badge>,
              (p.supplierIds || []).map(id => s.suppliers.find(supplier => supplier.id === id)?.name).filter(Boolean).join(", ") || "—",
              p.variantOf ? `Variant of ${s.products.find(parent => parent.id === p.variantOf)?.name || "unknown"}` : "Standalone",
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
  );
}

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
  selectProduct: (product: Product) => void;
};
export function InventoryView({
  s,
  lowStock,
  open,
  matches,
  category,
  status,
  setEditProduct,
  selectProduct,
}: Props) {
  const totalStockValue = s.products.reduce((total, product) => total + stock(s, product.id) * product.cost, 0);
  const totalStockUnits = s.products.reduce((total, product) => total + stock(s, product.id), 0);
  return (
    <>
      <section className="inventory-value-summary" aria-label="Inventory value"><div><span className="eyebrow">Inventory valuation</span><h2>Total value of stock</h2><p>Money currently held in inventory at cost price.</p></div><div className="inventory-value-amount"><strong>{money(totalStockValue)}</strong><span>{totalStockUnits.toLocaleString("en-PK")} units in stock</span></div></section>
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
                matches(p.name, p.sku, p.barcode, p.category, p.color, p.gsm, p.gsm ? `${p.gsm} GSM` : "") &&
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
                <button className="product-name-button" onClick={() => selectProduct(p)} aria-label={`View details for ${p.name}`}><b>{p.name}</b></button>
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

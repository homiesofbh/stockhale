"use client";
import { Badge, Empty } from "@/components/stockwell/ui";
import { ProductPlaceholder } from "@/components/stockwell/product-placeholder";
import { money, stock, type Product, type Store } from "@/lib/stockwell/model";
import { ArrowDownLeft, ArrowUpRight, Barcode, Box, Package, Pencil, Warehouse } from "lucide-react";
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
  const products = s.products.filter((p) => matches(p.name, p.sku, p.barcode, p.category, p.color, p.gsm, p.gsm ? `${p.gsm} GSM` : "") && (category === "All" || p.category === category) && (status === "All" || (status === "Low stock" ? stock(s, p.id) <= p.low : stock(s, p.id) > 0)));
  return (
    <>
      <section className="inventory-value-summary" aria-label="Inventory value"><div><span className="eyebrow">Inventory valuation</span><h2>Total value of stock</h2><p>Money currently held in inventory at cost price.</p></div><div className="inventory-value-amount"><strong>{money(totalStockValue)}</strong><span>{totalStockUnits.toLocaleString("en-PK")} units in stock</span></div></section>
      <div className="sub-actions inventory-actions">
        <span>{products.length} products <span className="muted">/ {lowStock.length} low stock</span></span>
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
      {products.length ? <section className="inventory-product-grid" aria-label="Products">
        {products.map((p) => {
          const quantity = stock(s, p.id);
          const productSuppliers = (p.supplierIds || []).map(id => s.suppliers.find(supplier => supplier.id === id)?.name).filter(Boolean);
          return <article className="inventory-product-card" key={p.id}>
            <button className="inventory-product-visual" onClick={() => selectProduct(p)} aria-label={`View details for ${p.name}`}><ProductPlaceholder name={p.name} category={p.category} /><span className={`inventory-stock-pill${quantity <= p.low ? " low" : " healthy"}`}><i />{quantity <= p.low ? "Low stock" : "In stock"}</span></button>
            <div className="inventory-product-body">
              <div className="inventory-product-overline"><span>{p.sku || "NO SKU"}</span>{p.barcode && <span><Barcode size={12} /> {p.barcode}</span>}</div>
              <button className="inventory-product-title" onClick={() => selectProduct(p)}>{p.name}</button>
              <div className="inventory-product-category">{p.category || "Uncategorized"}</div>
              <div className="inventory-product-stock"><div><strong>{quantity.toLocaleString("en-PK")}</strong><span>{p.unit || "piece"} in stock</span></div><span className="inventory-product-stock-icon"><Box size={16} /></span></div>
              <div className="inventory-product-prices"><div><small>SELLING PRICE</small><strong>{money(p.price)}</strong></div><div><small>COST PRICE</small><strong>{money(p.cost)}</strong></div></div>
              <div className="inventory-product-meta">{p.store && <span><Warehouse size={13} />{p.store}</span>}{p.packing && <span>{p.packing}</span>}{p.size && <span>{p.size}</span>}{p.color && <span>{p.color}</span>}{p.gsm && <span>{p.gsm} GSM</span>}{p.maximum != null && <span>Max {p.maximum}</span>}{productSuppliers.map(name => <span key={name}>Supplier: {name}</span>)}{p.variantOf && <span>Variant: {s.products.find(parent => parent.id === p.variantOf)?.name || "unknown"}</span>}</div>
              <div className="inventory-product-footer"><span className={quantity <= p.low ? "low" : "healthy"}><i />{quantity <= p.low ? `Reorder at ${p.low}` : "Stock available"}</span><button onClick={() => { setEditProduct(p); open("Product"); }} aria-label={`Edit ${p.name}`}><Pencil size={14} /> Edit</button><button className="inventory-product-open" onClick={() => selectProduct(p)} aria-label={`Open ${p.name}`}><ArrowUpRight size={15} /></button></div>
            </div>
          </article>;
        })}
      </section> : <section className="card inventory-empty"><Empty title={s.products.length ? "No products match these filters" : "Add your first product"}>Adjust your search or filters to see inventory.</Empty></section>}
    </>
  );
}

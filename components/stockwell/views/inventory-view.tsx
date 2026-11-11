"use client";
import { Empty, ServerPagination } from "@/components/stockwell/ui";
import { ProductPlaceholder } from "@/components/stockwell/product-placeholder";
import { money, stock, type Product, type Store } from "@/lib/stockwell/model";
import { filterInventory } from "@/lib/stockwell/record-selectors";
import { useServerCollection } from "@/lib/stockwell/use-server-collection";
import { ArrowDownLeft, ArrowUpRight, Barcode, Box, Package, Pencil, Warehouse } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
type Props = {
  s: Store;
  manufacturer: boolean;
  open: (name: string) => void;
  query: string;
  category: string;
  status: string;
  setEditProduct: Dispatch<SetStateAction<Product | null>>;
  selectProduct: (product: Product) => void;
  samplePreview?: boolean;
};
export function InventoryView({
  s,
  manufacturer,
  open,
  query,
  category,
  status,
  setEditProduct,
  selectProduct,
  samplePreview = false,
}: Props) {
  const result = useServerCollection<Product>({ collection: "products", query, category, status, pageSize: 24, enabled: !samplePreview });
  const products = samplePreview ? filterInventory(s, query, category, status) : result.records;
  const totalStockValue = samplePreview ? products.reduce((total, product) => total + stock(s, product.id) * product.cost, 0) : result.aggregates?.stockValue || 0;
  const totalStockUnits = samplePreview ? products.reduce((total, product) => total + stock(s, product.id), 0) : result.aggregates?.stockUnits || 0;
  const lowStock = samplePreview ? products.filter(product => stock(s, product.id) > 0 && stock(s, product.id) <= product.low).length : result.aggregates?.lowStock || 0;
  const recipeInputs = new Set(s.recipes.flatMap(recipe => recipe.ingredients.map(ingredient => ingredient.productId)));
  const recipeOutputs = new Set(s.recipes.map(recipe => recipe.outputProductId));
  const role = (productId: string) => {
    const input = recipeInputs.has(productId), output = recipeOutputs.has(productId);
    return input && output ? "Material & finished good" : output ? "Finished good" : input ? "Raw material" : "Not assigned to a recipe";
  };
  return (
    <>
      <section className="inventory-value-summary" aria-label="Inventory value"><div><span className="eyebrow">Inventory valuation</span><h2>{category !== "All" || status !== "All" || query.trim() ? "Stock value in view" : "Total value of stock"}</h2><p>Filtered products, valued at cost price.{manufacturer ? " Production transfers materials into finished stock at recorded cost." : ""}</p></div><div className="inventory-value-amount"><strong>{money(totalStockValue)}</strong><span>{totalStockUnits.toLocaleString("en-PK")} units in stock</span></div></section>
      <div className="sub-actions inventory-actions">
        <span>{samplePreview ? products.length : result.count} products <span className="muted">/ {lowStock} low stock</span></span>
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
      {result.error && <p className="form-error" role="alert">{result.error}</p>}
      {products.length ? <section className="inventory-product-grid" aria-label="Products" aria-busy={!samplePreview && result.loading}>
        {products.map((p) => {
          const quantity = samplePreview ? stock(s, p.id) : Number((p as Product & { currentStock?: number }).currentStock || 0);
          const productSuppliers = (p.supplierIds || []).map(id => s.suppliers.find(supplier => supplier.id === id)?.name).filter(Boolean);
          return <article className="inventory-product-card" key={p.id}>
          <button className="inventory-product-visual" onClick={() => selectProduct(p)} aria-label={`View details for ${p.name}`}><ProductPlaceholder name={p.name} category={p.category} /><span className={`inventory-stock-pill${quantity === 0 || quantity <= p.low ? " low" : " healthy"}`}><i />{quantity === 0 ? "Out of stock" : quantity <= p.low ? "Low stock" : "In stock"}</span></button>
            <div className="inventory-product-body">
              <div className="inventory-product-overline"><span>{p.sku || "NO SKU"}</span>{p.barcode && <span><Barcode size={12} /> {p.barcode}</span>}</div>
              <button className="inventory-product-title" onClick={() => selectProduct(p)}>{p.name}</button>
              <div className="inventory-product-category">{p.category || "Uncategorized"}</div>
              {manufacturer && <div className="inventory-product-category">{role(p.id)}</div>}
              <div className="inventory-product-stock"><div><strong>{quantity.toLocaleString("en-PK")}</strong><span>{p.unit || "piece"} in stock</span></div><span className="inventory-product-stock-icon"><Box size={16} /></span></div>
              <div className="inventory-product-prices"><div><small>SELLING PRICE</small><strong>{money(p.price)}</strong></div><div><small>COST PRICE</small><strong>{money(p.cost)}</strong></div></div>
              <div className="inventory-product-meta">{p.store && <span><Warehouse size={13} />{p.store}</span>}{p.packing && <span>{p.packing}</span>}{p.size && <span>{p.size}</span>}{p.color && <span>{p.color}</span>}{p.gsm && <span>{p.gsm} GSM</span>}{p.maximum != null && <span>Max {p.maximum}</span>}{productSuppliers.map(name => <span key={name}>Supplier: {name}</span>)}{p.variantOf && <span>Variant: {s.products.find(parent => parent.id === p.variantOf)?.name || "unknown"}</span>}</div>
              <div className="inventory-product-footer"><span className={quantity <= p.low ? "low" : "healthy"}><i />{quantity <= p.low ? `Reorder at ${p.low}` : "Stock available"}</span><button onClick={() => { setEditProduct(p); open("Product"); }} aria-label={`Edit ${p.name}`}><Pencil size={14} /> Edit</button><button className="inventory-product-open" onClick={() => selectProduct(p)} aria-label={`Open ${p.name}`}><ArrowUpRight size={15} /></button></div>
            </div>
          </article>;
        })}
      </section> : <section className="card inventory-empty"><Empty title={!samplePreview && result.loading ? "Loading products" : samplePreview ? "No matching sample products" : s.products.length ? "No products match these filters" : "Add your first product"}>Adjust your search or filters to see inventory.</Empty></section>}
      {!samplePreview && <ServerPagination page={result.page} pageCount={result.pageCount} count={result.count} pageSize={result.pageSize} setPage={result.setPage} />}
    </>
  );
}

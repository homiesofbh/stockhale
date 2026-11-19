"use client";
import { Empty, ServerPagination, Table } from "@/components/stockwell/ui";
import { ProductPlaceholder } from "@/components/stockwell/product-placeholder";
import { money, postStockCount, startStockCount, stock, type Product, type Store } from "@/lib/stockwell/model";
import { filterInventory } from "@/lib/stockwell/record-selectors";
import { useServerCollection } from "@/lib/stockwell/use-server-collection";
import { ArrowDownLeft, ArrowUpRight, Barcode, Box, Package, Pencil, Warehouse } from "lucide-react";
import { useState } from "react";
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
  commit?: (next: Store, message: string) => Promise<void>;
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
  commit,
  samplePreview = false,
}: Props) {
  const [countId, setCountId] = useState("");
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [countError, setCountError] = useState("");
  const [countBusy, setCountBusy] = useState(false);
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
  const openCount = (id: string) => {
    const count = s.stockCounts?.find(item => item.id === id);
    if (!count || count.status !== "draft") return;
    setCountId(id);
    setCounted(Object.fromEntries(count.lines.map(line => [line.productId, String(line.counted ?? line.expected)])));
    setCountError("");
  };
  const beginCount = async () => {
    if (!commit) return;
    if (countBusy) return;
    setCountBusy(true);
    setCountError("");
    try {
      const next = startStockCount(s);
      const count = next.stockCounts?.at(-1);
      await commit(next, "Physical stock count started.");
      if (count) {
        setCountId(count.id);
        setCounted(Object.fromEntries(count.lines.map(line => [line.productId, String(line.expected)])));
      }
    } catch (error) {
      setCountError(error instanceof Error ? error.message : "Could not start a stock count.");
    } finally {
      setCountBusy(false);
    }
  };
  const finishCount = async () => {
    if (!commit) return;
    if (countBusy) return;
    setCountBusy(true);
    setCountError("");
    try {
      const quantities = Object.fromEntries(Object.entries(counted).map(([id, value]) => [id, value.trim() === "" ? Number.NaN : Number(value)]));
      await commit(postStockCount(s, countId, quantities), "Physical stock count posted.");
      setCountId("");
    } catch (error) {
      setCountError(error instanceof Error ? error.message : "Could not post this stock count.");
    } finally {
      setCountBusy(false);
    }
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
          {!samplePreview && <button className="secondary-button" disabled={countBusy} onClick={() => void beginCount()}>Start stock count</button>}
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
      {countError && !countId && <p className="form-error" role="alert">{countError}</p>}
      {!samplePreview && !!s.stockCounts?.length && <section className="card stock-count-history">
        <h2>Stock counts</h2>
        <Table headers={["Date", "Products", "Status", ""]} rows={s.stockCounts.slice().reverse().map(count => [
          count.date, count.lines.length, count.status === "posted" ? "Posted" : "Draft",
          count.status === "draft" ? <button className="link" onClick={() => openCount(count.id)}>Continue count</button> : "—",
        ])} />
      </section>}
      {!samplePreview && countId && (() => {
        const count = s.stockCounts?.find(item => item.id === countId);
        if (!count || count.status !== "draft") return null;
        return <section className="card stock-count-editor">
          <h2>Physical count · {count.date}</h2>
          <p>Enter the quantity physically present for each product. Posting records only the difference from expected stock.</p>
          <Table headers={["Product", "Expected", "Counted", "Variance"]} rows={count.lines.map(line => {
            const product = s.products.find(item => item.id === line.productId);
            const rawQuantity = counted[line.productId] ?? String(line.expected);
            const quantity = rawQuantity.trim() === "" ? Number.NaN : Number(rawQuantity);
            return [product?.name || "Product", line.expected, <input aria-label={`Count ${product?.name || line.productId}`} type="number" min="0" step="0.001" value={rawQuantity} disabled={countBusy} onChange={event => setCounted(current => ({ ...current, [line.productId]: event.target.value }))} />, Number.isFinite(quantity) ? quantity - line.expected : "—"];
          })} />
          {countError && <p className="form-error" role="alert">{countError}</p>}
          <button className="primary" disabled={countBusy} onClick={() => void finishCount()}>{countBusy ? "Posting…" : "Post count"}</button>
        </section>;
      })()}
      {products.length ? <section className="inventory-product-grid" aria-label="Products" aria-busy={!samplePreview && result.loading}>
        {products.map((p) => {
          const quantity = samplePreview ? stock(s, p.id) : Number((p as Product & { currentStock?: number }).currentStock || 0);
          const productSuppliers = (p.supplierIds || []).map(id => s.suppliers.find(supplier => supplier.id === id)?.name).filter(Boolean);
          return <article className="inventory-product-card" key={p.id}>
          <button className="inventory-product-visual" onClick={() => selectProduct(p)} aria-label={`View details for ${p.name}`}><ProductPlaceholder name={p.name} category={p.category} /><span className={`inventory-stock-pill${p.active === false || quantity === 0 || quantity <= p.low ? " low" : " healthy"}`}><i />{p.active === false ? "Inactive" : quantity === 0 ? "Out of stock" : quantity <= p.low ? "Low stock" : "In stock"}</span></button>
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

"use client";
import { useState, type FormEvent } from "react";
import { recordProduction, validateRecipe } from "@/lib/stockwell/production";
import { money, stock, today, type Recipe, type Store } from "@/lib/stockwell/model";
import { Empty, Field, ServerPagination, Table } from "@/components/stockwell/ui";
import type { Member } from "@/lib/stockwell/workspace";
import { useServerCollection } from "@/lib/stockwell/use-server-collection";

export function ProductionView({ store, actor, commit, query = "" }: { store: Store; actor: Member; commit: (store: Store, message: string) => Promise<void>; query?: string }) {
  const blank = (): Recipe => ({ id: crypto.randomUUID(), name: "", outputProductId: "", outputQuantity: 1, ingredients: [{ productId: "", quantity: 1 }] });
  const [recipe, setRecipe] = useState<Recipe>(blank);
  const [selectedRecipe, setSelectedRecipe] = useState("");
  const [batches, setBatches] = useState(1);
  const [date, setDate] = useState(today());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const recipePage = useServerCollection<Recipe>({ collection: "recipes", query, pageSize: 20 });
  const runsPage = useServerCollection<any>({ collection: "productionRuns", query, pageSize: 20 });
  async function saveRecipe(event: FormEvent) {
    event.preventDefault();
    setError(""); setNotice("");
    try {
      validateRecipe(store, recipe);
      const exists = store.recipes.some(item => item.id === recipe.id);
      await commit({ ...store, recipes: exists ? store.recipes.map(item => item.id === recipe.id ? recipe : item) : [...store.recipes, recipe] }, exists ? "Production recipe updated." : "Production recipe saved.");
      setNotice(exists ? "Recipe updated." : "Recipe saved.");
      setRecipe(blank());
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save this recipe."); }
  }
  async function startProduction(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    const selected = store.recipes.find(item => item.id === selectedRecipe);
    if (!selected) { setError("Choose a recipe."); return; }
    try {
      await commit(recordProduction(store, selected, batches, { id: actor.id, name: actor.name }, date), `${selected.name} production recorded.`);
      setNotice(`${selected.name} production recorded.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not record production."); }
  }
  function edit(item: Recipe) { setRecipe({ ...item, ingredients: item.ingredients.map(ingredient => ({ ...ingredient })) }); window.scrollTo({ top: 0, behavior: "smooth" }); }
  const productName = (id: string) => store.products.find(product => product.id === id)?.name || "Unknown product";
  const productUnit = (id: string) => store.products.find(product => product.id === id)?.unit || "piece";
  return <section className="production-page">
    <div className="page-heading"><div><span className="eyebrow">MANUFACTURING</span><h1>Production</h1><p>Buy raw materials in Purchases, define recipes, then record completed batches. Sell finished goods in Billing to retailers, individual customers, or companies.</p></div></div>
    <div className="production-grid">
      <form className="card production-form" onSubmit={saveRecipe}><div className="section-head"><div><h2>{store.recipes.some(item => item.id === recipe.id) ? "Edit recipe" : "Create a recipe"}</h2><p>Ingredient quantities are required for one recipe batch.</p></div></div>
        <Field label="Recipe name"><input value={recipe.name} required maxLength={120} onChange={event => setRecipe({ ...recipe, name: event.target.value })} placeholder="e.g. Standard cotton shirt" /></Field>
        <div className="production-output-row"><Field label="Finished product"><select value={recipe.outputProductId} required onChange={event => setRecipe({ ...recipe, outputProductId: event.target.value })}><option value="">Select product</option>{store.products.map(product => <option key={product.id} value={product.id}>{product.name} · {product.unit || "piece"}</option>)}</select></Field><Field label={`Output per batch (${productUnit(recipe.outputProductId)})`}><input type="number" min="0.001" step="0.001" required value={recipe.outputQuantity} onChange={event => setRecipe({ ...recipe, outputQuantity: Number(event.target.value) })} /></Field></div>
        <div className="section-head production-ingredients-head"><div><h3>Raw materials</h3><p>Quantity consumed per batch.</p></div><button type="button" className="secondary-button" onClick={() => setRecipe({ ...recipe, ingredients: [...recipe.ingredients, { productId: "", quantity: 1 }] })}>Add material</button></div>
        {recipe.ingredients.map((ingredient, index) => <div className="production-ingredient-row" key={index}><Field label={`Material ${index + 1}`}><select required value={ingredient.productId} onChange={event => setRecipe({ ...recipe, ingredients: recipe.ingredients.map((item, i) => i === index ? { ...item, productId: event.target.value } : item) })}><option value="">Select raw material</option>{store.products.map(product => <option key={product.id} value={product.id}>{product.name} · {product.unit || "piece"}</option>)}</select></Field><Field label={`Quantity (${productUnit(ingredient.productId)})`}><input type="number" min="0.001" step="0.001" required value={ingredient.quantity} onChange={event => setRecipe({ ...recipe, ingredients: recipe.ingredients.map((item, i) => i === index ? { ...item, quantity: Number(event.target.value) } : item) })} /></Field>{recipe.ingredients.length > 1 && <button type="button" className="production-remove" aria-label={`Remove material ${index + 1}`} onClick={() => setRecipe({ ...recipe, ingredients: recipe.ingredients.filter((_, i) => i !== index) })}>Remove</button>}</div>)}
        <div className="form-foot"><button className="primary">Save recipe</button>{store.recipes.some(item => item.id === recipe.id) && <button type="button" className="secondary-button" onClick={() => setRecipe(blank())}>Cancel edit</button>}</div>
      </form>
      <form className="card production-form" onSubmit={startProduction}><div className="section-head"><div><h2>Record production</h2><p>Raw materials are deducted and finished stock is added.</p></div></div><Field label="Recipe"><select required value={selectedRecipe} onChange={event => setSelectedRecipe(event.target.value)}><option value="">Select recipe</option>{store.recipes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><div className="production-output-row"><Field label="Batches"><input type="number" min="1" step="1" required value={batches} onChange={event => setBatches(Number(event.target.value))} /></Field><Field label="Production date"><input type="date" required min={today()} max={today()} value={date} onChange={event => setDate(event.target.value)} /></Field></div>{selectedRecipe && (() => { const selected = store.recipes.find(item => item.id === selectedRecipe)!; const materialCost = selected.ingredients.reduce((sum, item) => sum + item.quantity * batches * (store.products.find(product => product.id === item.productId)?.cost || 0), 0); const output = selected.outputQuantity * batches; return <div className="production-preview"><strong>Produces {output} {productUnit(selected.outputProductId)} {productName(selected.outputProductId)}</strong>{selected.ingredients.map(item => <span key={item.productId}>Uses {item.quantity * batches} {productUnit(item.productId)} {productName(item.productId)} · {stock(store, item.productId)} {productUnit(item.productId)} available · {money((store.products.find(product => product.id === item.productId)?.cost || 0) * item.quantity * batches)}</span>)}<span>Estimated material cost {money(materialCost)} · unit cost {money(output ? materialCost / output : 0)} per {productUnit(selected.outputProductId)}</span></div>; })()}<div className="form-foot"><button className="primary" disabled={!store.recipes.length}>Record production</button></div></form>
    </div>
    {(error || notice) && <p role={error ? "alert" : "status"} className={error ? "form-error" : "form-hint"}>{error || notice}</p>}
    <section className="card production-table-section"><div className="section-head"><div><h2>Recipes</h2><p>{recipePage.count} saved recipes</p></div></div>{recipePage.records.length ? <Table headers={["Recipe", "Finished product", "Batch output", "Raw materials", ""]} rows={recipePage.records.map(item => [item.name, productName(item.outputProductId), `${item.outputQuantity} ${productUnit(item.outputProductId)}`, item.ingredients.map(ingredient => `${productName(ingredient.productId)}: ${ingredient.quantity} ${productUnit(ingredient.productId)}`).join(" · "), <button className="link" onClick={() => edit(item)}>Edit recipe</button>])} /> : <Empty title={query ? "No matching recipes" : "No recipes yet"}>Add a recipe to convert raw materials into finished stock.</Empty>}<ServerPagination page={recipePage.page} pageCount={recipePage.pageCount} count={recipePage.count} pageSize={recipePage.pageSize} setPage={recipePage.setPage} /></section>
    <section className="card production-table-section"><div className="section-head"><div><h2>Production history</h2><p>{runsPage.count} production runs · Material cost transfers into finished stock and reaches cost of goods sold when finished goods are sold.</p></div></div>{runsPage.records.length ? <Table headers={["Reference", "Date", "Recipe", "Finished goods", "Materials consumed", "Material cost", "Unit cost", "Recorded by"]} rows={runsPage.records.map(run => [run.reference, run.date, run.recipeName, `${run.outputQuantity} ${productUnit(run.outputProductId)} · ${productName(run.outputProductId)}`, run.ingredients.map((item: any) => `${productName(item.productId)}: ${item.quantity} ${productUnit(item.productId)}`).join(" · "), money(run.materialCost), money(run.outputUnitCost), run.actorName || "Not recorded"])} /> : <Empty title={query ? "No matching production runs" : "No production recorded"}>Production runs will appear here with their stock movements.</Empty>}<ServerPagination page={runsPage.page} pageCount={runsPage.pageCount} count={runsPage.count} pageSize={runsPage.pageSize} setPage={runsPage.setPage} /></section>
  </section>;
}

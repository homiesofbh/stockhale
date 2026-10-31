import { round, roundQty, stock, uid, type ProductionRun, type Recipe, type Store } from "./model";
import { check, requireOpenDate, type Actor } from "./operations";

export function validateRecipe(store: Store, recipe: Recipe) {
  check(!!recipe.id && !!recipe.name.trim(), "Enter a recipe name.");
  check(store.products.some(product => product.id === recipe.outputProductId), "Choose a finished product for this recipe.");
  check(Number.isFinite(recipe.outputQuantity) && recipe.outputQuantity > 0, "Enter a valid batch output quantity.");
  check(Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0, "Add at least one raw material.");
  const ids = new Set<string>();
  for (const ingredient of recipe.ingredients) {
    check(store.products.some(product => product.id === ingredient.productId), "A recipe ingredient no longer exists.");
    check(ingredient.productId !== recipe.outputProductId, "Choose a different product for the finished product and each ingredient.");
    check(!ids.has(ingredient.productId), "A recipe can list each raw material only once.");
    check(Number.isFinite(ingredient.quantity) && ingredient.quantity > 0, "Enter valid ingredient quantities.");
    ids.add(ingredient.productId);
  }
}

export function productionMovements(run: ProductionRun) {
  const createdAt = Date.now();
  return [
    ...run.ingredients.map(item => ({ id: uid(), createdAt, productId: item.productId, qty: -item.quantity, date: run.date, type: "Production use", reference: run.reference, reason: `Used for ${run.recipeName}` })),
    { id: uid(), createdAt, productId: run.outputProductId, qty: run.outputQuantity, date: run.date, type: "Production output", reference: run.reference, reason: `Produced from ${run.recipeName}` },
  ];
}

export function recordProduction(store: Store, recipe: Recipe, batches: number, actor: Pick<Actor, "id" | "name">, date: string): Store {
  validateRecipe(store, recipe);
  check(Number.isInteger(batches) && batches > 0, "Enter a valid number of batches.");
  requireOpenDate(store, date);
  const ingredients = recipe.ingredients.map(item => ({
    productId: item.productId,
    quantity: roundQty(item.quantity * batches),
    unitCost: store.products.find(product => product.id === item.productId)!.cost,
  }));
  for (const item of ingredients) check(stock(store, item.productId) >= item.quantity, `Not enough ${store.products.find(product => product.id === item.productId)!.name} in stock.`);
  const outputQuantity = roundQty(recipe.outputQuantity * batches);
  const materialCost = round(ingredients.reduce((sum, item) => sum + item.quantity * item.unitCost, 0));
  const run: ProductionRun = {
    id: uid(), recipeId: recipe.id, recipeName: recipe.name, date,
    reference: `PR-${Date.now()}`, batches, outputProductId: recipe.outputProductId,
    outputQuantity, outputUnitCost: outputQuantity ? round(materialCost / outputQuantity) : 0,
    materialCost, ingredients, actorId: actor.id, actorName: actor.name || "",
  };
  const movements = productionMovements(run);
  return {
    ...store,
    products: store.products.map(product => product.id === run.outputProductId ? { ...product, cost: run.outputUnitCost } : product),
    movements: [...store.movements, ...movements],
    productionRuns: [...(store.productionRuns || []), run],
  };
}

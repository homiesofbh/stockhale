const placeholders = [
  { name: "Fresh produce", image: "photo-1542838132-92c53300491e", keywords: ["food", "fruit", "produce", "grocery"] },
  { name: "Coffee and tea", image: "photo-1445116572660-236099ec97a0", keywords: ["coffee", "tea", "beverage", "drink"] },
  { name: "Apparel", image: "photo-1483985988355-763728e1935b", keywords: ["clothing", "apparel", "fashion", "garment", "textile"] },
  { name: "Home furniture", image: "photo-1555041469-a586c61ea9bc", keywords: ["home", "furniture", "decor", "chair"] },
  { name: "Personal care", image: "photo-1608248543803-ba4f8c70ae0b", keywords: ["care", "cosmetic", "beauty", "medical", "pharma"] },
  { name: "Garden and floral", image: "photo-1416879595882-3373a0480b5b", keywords: ["garden", "plant", "flower", "floral"] },
  { name: "Tools and hardware", image: "photo-1504148455328-c376907d081c", keywords: ["tool", "hardware", "construction", "building"] },
  { name: "Electronics", image: "photo-1498049794561-7780e7231661", keywords: ["electronic", "cable", "tech", "computer", "mobile"] },
  { name: "Kitchenware", image: "photo-1556911220-e15b29be8c8f", keywords: ["kitchen", "cookware", "utensil", "cooking"] },
  { name: "Kids and baby", image: "photo-1515488042361-ee00e0ddd4e4", keywords: ["baby", "kids", "toy", "child"] },
  { name: "Bags and travel", image: "photo-1553062407-98eeb64c6a62", keywords: ["bag", "travel", "luggage", "office"] },
  { name: "Cleaning supplies", image: "photo-1563453392212-326f5e854473", keywords: ["clean", "household", "supplies", "maintenance"] },
];

export function productPlaceholderIndex(name: string, category: string) {
  const text = `${name} ${category}`.toLowerCase();
  const match = placeholders.findIndex(item => item.keywords.some(keyword => text.includes(keyword)));
  if (match >= 0) return match;
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % placeholders.length;
}

export function ProductPlaceholder({ name, category }: { name: string; category: string }) {
  const placeholder = placeholders[productPlaceholderIndex(name, category)];
  const src = `https://images.unsplash.com/${placeholder.image}?auto=format&fit=crop&w=800&q=80`;
  return <span className="product-placeholder" aria-label={`${placeholder.name} placeholder`} role="img" style={{ backgroundImage: `linear-gradient(180deg, #1111, #1115), url("${src}")` }}>
    <span className="product-placeholder-caption">{placeholder.name}</span>
  </span>;
}

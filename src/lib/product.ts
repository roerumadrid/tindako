import type { Product } from "@/types/database";

/** Case-insensitive name filter; empty or whitespace-only query returns all products. */
export function filterProductsByNameSearch(products: readonly Product[], search: string): Product[] {
  const q = search.trim().toLowerCase();
  if (!q) return [...products];
  return products.filter((p) => p.name.toLowerCase().includes(q));
}

/** `select` value for products with no category (must match inventory category filter). */
export const INVENTORY_UNCATEGORIZED_VALUE = "__uncategorized__";

/** PostgREST select: product columns plus joined category (FK `products.category_id` → `categories`). */
export const PRODUCT_LIST_SELECT = "*, categories(id,name)";

/** Empty `categoryKey` = all categories; otherwise match `category_id` or uncategorized sentinel. */
export function filterProductsByCategory(products: readonly Product[], categoryKey: string): Product[] {
  const k = categoryKey.trim();
  if (!k) return [...products];
  if (k === INVENTORY_UNCATEGORIZED_VALUE) {
    return products.filter((p) => !(p.category_id ?? "").trim());
  }
  return products.filter((p) => (p.category_id ?? "").trim() === k);
}

function categoryDisplayFromRow(row: Record<string, unknown>): string {
  const embed = row.categories;
  if (embed && typeof embed === "object" && !Array.isArray(embed)) {
    const n = String((embed as { name?: unknown }).name ?? "").trim();
    if (n) return n;
  }
  const cid = row.category_id != null ? String(row.category_id).trim() : "";
  if (cid) return "";
  return row.category != null ? String(row.category).trim() : "";
}

/** Maps a Supabase row to Product; supports legacy column names after DB renames. */
export function normalizeProduct(row: Record<string, unknown>): Product {
  const selling =
    row.selling_price != null
      ? Number(row.selling_price)
      : Number((row as { unit_price?: unknown }).unit_price ?? 0);
  const stock =
    row.stock_qty != null ? Number(row.stock_qty) : Number((row as { quantity?: unknown }).quantity ?? 0);
  const reorder =
    row.reorder_level != null
      ? Number(row.reorder_level)
      : Number((row as { low_stock_threshold?: unknown }).low_stock_threshold ?? 5);

  const category = row.category != null ? String(row.category) : "";
  const category_id = row.category_id != null ? String(row.category_id) : null;

  return {
    id: String(row.id),
    store_id: row.store_id != null ? String(row.store_id) : "",
    name: String(row.name),
    category,
    category_id,
    category_display: categoryDisplayFromRow(row),
    cost_price: Number(row.cost_price ?? 0),
    selling_price: selling,
    stock_qty: stock,
    reorder_level: reorder,
    unit: row.unit != null ? String(row.unit) : "pc",
    created_at: String(row.created_at ?? ""),
  };
}

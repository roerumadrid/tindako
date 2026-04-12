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

export type InventoryStockFilter = "all" | "low" | "out";

/** Parse `?stock=` from the inventory URL; unknown values → `"all"`. */
export function parseInventoryStockParam(raw: string | null | undefined): InventoryStockFilter {
  if (raw === "low" || raw === "out") return raw;
  return "all";
}

/** Inventory stock tabs: all, low (1…reorder_level), out (0). Composes with search/category filters. */
export function filterProductsByStockFilter(
  products: readonly Product[],
  stock: InventoryStockFilter
): Product[] {
  if (stock !== "low" && stock !== "out") return [...products];
  if (stock === "out") {
    return products.filter((p) => p.stock_qty === 0);
  }
  return products.filter((p) => p.stock_qty > 0 && p.stock_qty <= p.reorder_level);
}

/**
 * Inventory list urgency (lower = show first). Used after search/category/stock filters.
 *
 * | Value | Meaning |
 * |-------|---------|
 * | 0 | Out of stock (`stock_qty === 0`) |
 * | 1 | Low stock (`stock_qty > 0` and `<= reorder_level`) |
 * | 2 | Fast selling (product id in today’s top sellers set, stock above reorder) |
 * | 3 | Normal |
 */
export function getProductUrgency(product: Product, topProductIds: ReadonlySet<string>): number {
  const { stock_qty, reorder_level, id } = product;
  if (stock_qty === 0) return 0;
  if (stock_qty > 0 && stock_qty <= reorder_level) return 1;
  if (topProductIds.has(id)) return 2;
  return 3;
}

/** Sort by {@link getProductUrgency} ascending, then name (locale, case-insensitive). */
export function sortProductsByUrgencyThenName(
  products: readonly Product[],
  topProductIds: ReadonlySet<string>
): Product[] {
  return [...products].sort((a, b) => {
    const ua = getProductUrgency(a, topProductIds);
    const ub = getProductUrgency(b, topProductIds);
    if (ua !== ub) return ua - ub;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
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

import type { Product } from "@/types/database";

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

  return {
    id: String(row.id),
    store_id: row.store_id != null ? String(row.store_id) : "",
    name: String(row.name),
    category: row.category != null ? String(row.category) : "",
    cost_price: Number(row.cost_price ?? 0),
    selling_price: selling,
    stock_qty: stock,
    reorder_level: reorder,
    unit: row.unit != null ? String(row.unit) : "pc",
    created_at: String(row.created_at ?? ""),
  };
}

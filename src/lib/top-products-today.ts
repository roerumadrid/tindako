/** Rows from `sale_items` with `product_id` and `qty` (or equivalent). */
export type SaleItemQtyRow = {
  product_id?: unknown;
  qty?: unknown;
};

/**
 * Product IDs with highest qty sold in the row set (e.g. today’s sale_items), top `limit` ties by id.
 */
export function topProductIdsByQtySold(rows: readonly SaleItemQtyRow[], limit: number): Set<string> {
  const sums = new Map<string, number>();
  for (const row of rows) {
    const id = String(row.product_id ?? "").trim();
    if (!id) continue;
    const qty = Number(row.qty ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    sums.set(id, (sums.get(id) ?? 0) + qty);
  }
  const ids = [...sums.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, limit)
    .map(([id]) => id);
  return new Set(ids);
}

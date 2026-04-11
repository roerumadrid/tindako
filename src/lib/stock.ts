import type { Product, StockStatus } from "@/types/database";

export function getStockStatus(product: Pick<Product, "stock_qty" | "reorder_level">): StockStatus {
  if (product.stock_qty <= 0) return "out";
  if (product.stock_qty <= product.reorder_level) return "low";
  return "ok";
}

export const stockStatusLabel: Record<StockStatus, string> = {
  out: "Out of stock",
  low: "Low stock",
  ok: "In stock",
};

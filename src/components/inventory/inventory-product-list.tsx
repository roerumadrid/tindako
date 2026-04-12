"use client";

import { useMemo } from "react";
import { ProductDialog } from "@/components/inventory/product-dialog";
import { DeleteProductButton } from "@/components/inventory/delete-product-button";
import { RestockProductButton } from "@/components/inventory/restock-product-button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPeso } from "@/lib/money";
import {
  filterProductsByCategory,
  filterProductsByNameSearch,
  filterProductsByStockFilter,
  sortProductsByUrgencyThenName,
  type InventoryStockFilter,
} from "@/lib/product";
import { getStockStatus, stockStatusLabel } from "@/lib/stock";
import { cn } from "@/lib/utils";
import type { Product, StockStatus } from "@/types/database";

const EMPTY_TOP_PRODUCT_IDS = new Set<string>();

const stockBadgeStyles: Record<StockStatus, string> = {
  out: "bg-red-100 text-red-900 dark:bg-red-950/85 dark:text-red-100",
  low: "bg-amber-100 text-amber-950 dark:bg-amber-950/65 dark:text-amber-50",
  ok: "bg-emerald-100 text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-50",
};

type Props = {
  loading: boolean;
  products: Product[];
  searchQuery: string;
  /** Empty string = all categories (see `INVENTORY_UNCATEGORIZED_VALUE` in `@/lib/product`). */
  categoryFilter?: string;
  /** Stock condition filter (with search and category). */
  stockFilter?: InventoryStockFilter;
  /** After delete succeeds, remove the product from parent state so the list updates immediately. */
  onProductDeleted?: (productId: string) => void;
  /** Product IDs in “Top Products Today” (qty sold today); used for urgency sort after filters. */
  topProductIdsToday?: ReadonlySet<string>;
};

export function InventoryProductList({
  loading,
  products,
  searchQuery,
  categoryFilter = "",
  stockFilter = "all",
  onProductDeleted,
  topProductIdsToday = EMPTY_TOP_PRODUCT_IDS,
}: Props) {
  const visibleProducts = useMemo(() => {
    const byName = filterProductsByNameSearch(products, searchQuery);
    const byCategory = filterProductsByCategory(byName, categoryFilter);
    const byStock = filterProductsByStockFilter(byCategory, stockFilter);
    return sortProductsByUrgencyThenName(byStock, topProductIdsToday);
  }, [products, searchQuery, categoryFilter, stockFilter, topProductIdsToday]);

  const emphasizeRestock = stockFilter === "low" || stockFilter === "out";

  if (loading) {
    return (
      <section aria-busy="true" aria-label="Loading products">
        <p className="rounded-2xl border border-dashed border-border/60 bg-muted/25 px-4 py-12 text-center text-base text-muted-foreground shadow-sm">
          Loading products…
        </p>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section aria-label="Product list">
        <Card className="border-dashed border-muted-foreground/30 shadow-none ring-0">
          <CardContent className="px-5 py-14 text-center">
            <p className="text-base font-medium text-foreground">No products yet</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Tap <span className="font-medium text-foreground">+ Add Product</span> to add your first item.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (visibleProducts.length === 0) {
    return (
      <section aria-label="Product list">
        <p className="rounded-2xl border border-dashed border-border/60 bg-muted/25 px-4 py-12 text-center text-base text-muted-foreground shadow-sm">
          No products match your search, category, or stock filter.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Product list">
      <ul className="flex flex-col gap-4">
        {visibleProducts.map((p) => {
          const status = getStockStatus(p);
          return (
          <li key={p.id}>
            <Card
              className={cn(
                status === "out" && "ring-red-200/90 dark:ring-red-900/60",
                status === "low" && "ring-amber-200/90 dark:ring-amber-900/50"
              )}
            >
              <CardContent className="flex flex-col gap-5 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-2 gap-y-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="text-lg font-semibold leading-snug tracking-tight text-foreground">{p.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {p.category_display.trim() ? (
                        p.category_display
                      ) : (
                        <span className="italic opacity-80">Uncategorized</span>
                      )}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-tight tracking-wide sm:px-2.5 sm:text-xs sm:leading-none sm:tracking-normal",
                      stockBadgeStyles[status]
                    )}
                  >
                    {stockStatusLabel[status]}
                  </span>
                </div>

                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 rounded-xl bg-muted/40 px-4 py-3.5">
                  <dt className="self-center text-xs font-medium uppercase tracking-wide text-muted-foreground">Price</dt>
                  <dd className="text-right text-lg font-semibold tabular-nums text-foreground">{formatPeso(p.selling_price)}</dd>
                  <dt className="self-center text-xs font-medium uppercase tracking-wide text-muted-foreground">Stock</dt>
                  <dd className="text-right text-lg font-semibold tabular-nums text-foreground">{p.stock_qty}</dd>
                </dl>

                <div className="flex flex-wrap items-start gap-2 border-t border-border/50 pt-4">
                  <ProductDialog product={p} />
                  <RestockProductButton product={p} emphasizeTrigger={emphasizeRestock} />
                  <DeleteProductButton productId={p.id} productName={p.name} onDeleted={onProductDeleted} />
                </div>
              </CardContent>
            </Card>
          </li>
          );
        })}
      </ul>
    </section>
  );
}

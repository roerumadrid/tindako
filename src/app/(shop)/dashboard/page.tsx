"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { AUTH_DISABLED_FOR_DEV } from "@/lib/dev-auth";
import { getManilaTodayUtcRange } from "@/lib/manila-day";
import { formatPeso } from "@/lib/money";
import { TINDAKO_DATA_EVENT } from "@/lib/refresh-events";
import { resolveShopForClient } from "@/lib/resolve-shop-client";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type TopProductEntry = {
  productId: string;
  name: string;
  totalSold: number;
};

type RestockReason = "Out of stock" | "Low stock";

type RestockSuggestion = {
  productId: string;
  name: string;
  reason: RestockReason;
  priority: "high" | "medium";
};

type DashboardStats = {
  todaySalesTotal: number;
  todayProfit: number;
  totalProfit: number;
  topProductsToday: TopProductEntry[];
  restockSuggestions: RestockSuggestion[];
  /** Total products that are low or out of stock (may exceed `restockSuggestions.length`). */
  needsRestockCount: number;
  productCount: number;
  lowStockCount: number;
  outOfStockCount: number;
};

type SaleItemProfitRow = {
  product_id?: unknown;
  qty?: unknown;
  unit_price?: unknown;
  products?: { cost_price?: unknown; name?: unknown } | { cost_price?: unknown; name?: unknown }[] | null;
};

function productNameFromSaleItemRow(row: SaleItemProfitRow): string {
  const p = row.products;
  if (p == null) return "Unknown product";
  if (Array.isArray(p)) return String(p[0]?.name ?? "Unknown product").trim() || "Unknown product";
  return String(p.name ?? "Unknown product").trim() || "Unknown product";
}

function topProductsFromSaleItems(rows: SaleItemProfitRow[], limit: number): TopProductEntry[] {
  const sums = new Map<string, { name: string; total: number }>();
  for (const row of rows) {
    const id = String(row.product_id ?? "").trim();
    if (!id) continue;
    const qty = Number(row.qty ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const name = productNameFromSaleItemRow(row);
    const prev = sums.get(id);
    if (prev) prev.total += qty;
    else sums.set(id, { name, total: qty });
  }
  return [...sums.entries()]
    .map(([productId, { name, total }]) => ({ productId, name, totalSold: total }))
    .sort((a, b) => b.totalSold - a.totalSold)
    .slice(0, limit);
}

function sumProfitFromSaleItemRows(rows: SaleItemProfitRow[]): number {
  let total = 0;
  for (const row of rows) {
    const qty = Number(row.qty ?? 0);
    const unit = Number(row.unit_price ?? 0);
    const p = row.products;
    const cost =
      p == null
        ? 0
        : Array.isArray(p)
          ? Number(p[0]?.cost_price ?? 0)
          : Number(p.cost_price ?? 0);
    if (Number.isFinite(qty) && Number.isFinite(unit) && Number.isFinite(cost)) {
      total += (unit - cost) * qty;
    }
  }
  return total;
}

/** Calendar day for “today” metrics (same timezone as {@link getManilaTodayUtcRange}). */
function formatDate(): string {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date());
}

type ProductStockRow = {
  id: string;
  name: string;
  stock_qty: number;
  reorder_level: number;
};

const RESTOCK_SUGGESTIONS_MAX = 5;

function parseProductStockRow(row: {
  id?: unknown;
  name?: unknown;
  stock_qty?: unknown;
  reorder_level?: unknown;
}): ProductStockRow | null {
  const id = String(row.id ?? "").trim();
  if (!id) return null;
  const stock = Number(row.stock_qty);
  const reorder = Number(row.reorder_level);
  if (!Number.isFinite(stock) || !Number.isFinite(reorder)) return null;
  const name = String(row.name ?? "").trim() || "Product";
  return { id, name, stock_qty: stock, reorder_level: reorder };
}

/** Low stock first, then out of stock; reasons match inventory filters. */
function needsRestockFromProducts(
  rows: { id?: unknown; name?: unknown; stock_qty?: unknown; reorder_level?: unknown }[]
): { suggestions: RestockSuggestion[]; total: number } {
  const products = rows.map(parseProductStockRow).filter((p): p is ProductStockRow => p != null);
  const lowStock = products.filter((p) => p.stock_qty > 0 && p.stock_qty <= p.reorder_level);
  const outOfStock = products.filter((p) => p.stock_qty === 0);
  const needsRestock = [...lowStock, ...outOfStock];

  const suggestions: RestockSuggestion[] = needsRestock.map((p) => ({
    productId: p.id,
    name: p.name,
    reason: p.stock_qty === 0 ? "Out of stock" : "Low stock",
    priority: "high" as const,
  }));

  return {
    total: suggestions.length,
    suggestions: suggestions.slice(0, RESTOCK_SUGGESTIONS_MAX),
  };
}

function countStockBuckets(rows: { stock_qty?: unknown; reorder_level?: unknown }[]) {
  let lowStockCount = 0;
  let outOfStockCount = 0;
  for (const r of rows) {
    const stock = Number(r.stock_qty);
    const reorder = Number(r.reorder_level);
    if (stock === 0) {
      outOfStockCount += 1;
    } else if (stock > 0 && stock <= reorder) {
      lowStockCount += 1;
    }
  }
  return { lowStockCount, outOfStockCount };
}

export default function DashboardPage() {
  const [storeName, setStoreName] = useState("");
  const [stats, setStats] = useState<DashboardStats>({
    todaySalesTotal: 0,
    todayProfit: 0,
    totalProfit: 0,
    topProductsToday: [],
    restockSuggestions: [],
    needsRestockCount: 0,
    productCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { startIso, endIso } = getManilaTodayUtcRange();

    if (AUTH_DISABLED_FOR_DEV) {
      const supabase = createClient();

      const profitSelect =
        "product_id, qty, unit_price, products (cost_price, name), sales!inner (created_at)";
      const totalProfitSelect = "qty, unit_price, products (cost_price), sales!inner (id)";

      const [
        { data: salesRows },
        { count: productCount },
        { data: products },
        { data: profitRows },
        { data: totalProfitRows },
      ] = await Promise.all([
        supabase.from("sales").select("total_amount").gte("created_at", startIso).lte("created_at", endIso),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id, name, stock_qty, reorder_level"),
        supabase
          .from("sale_items")
          .select(profitSelect)
          .gte("sales.created_at", startIso)
          .lte("sales.created_at", endIso),
        supabase.from("sale_items").select(totalProfitSelect),
      ]);

      const todaySalesTotal = (salesRows ?? []).reduce((sum, row) => sum + Number((row as { total_amount?: unknown }).total_amount ?? 0), 0);
      const profitRowsTyped = (profitRows ?? []) as SaleItemProfitRow[];
      const todayProfit = sumProfitFromSaleItemRows(profitRowsTyped);
      const totalProfit = sumProfitFromSaleItemRows((totalProfitRows ?? []) as SaleItemProfitRow[]);
      const topProductsToday = topProductsFromSaleItems(profitRowsTyped, 5);
      const rows = products ?? [];
      const { lowStockCount, outOfStockCount } = countStockBuckets(rows);
      const { suggestions: restockSuggestions, total: needsRestockCount } = needsRestockFromProducts(rows);

      setStoreName("Overview");
      setStats({
        todaySalesTotal,
        todayProfit,
        totalProfit,
        topProductsToday,
        restockSuggestions,
        needsRestockCount,
        productCount: productCount ?? 0,
        lowStockCount,
        outOfStockCount,
      });
      setLoading(false);
      return;
    }

    const { supabase, store } = await resolveShopForClient();
    if (!store) {
      setStoreName("");
      setStats({
        todaySalesTotal: 0,
        todayProfit: 0,
        totalProfit: 0,
        topProductsToday: [],
        restockSuggestions: [],
        needsRestockCount: 0,
        productCount: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
      });
      setLoading(false);
      return;
    }

    setStoreName(store.name);

    const profitSelect =
      "product_id, qty, unit_price, products (cost_price, name), sales!inner (created_at, store_id)";
    const totalProfitSelect = "qty, unit_price, products (cost_price), sales!inner (store_id)";

    const [
      { data: salesRows },
      { count: productCount },
      { data: products },
      { data: profitRows },
      { data: totalProfitRows },
    ] = await Promise.all([
      supabase
        .from("sales")
        .select("total_amount")
        .eq("store_id", store.id)
        .gte("created_at", startIso)
        .lte("created_at", endIso),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id),
      supabase.from("products").select("id, name, stock_qty, reorder_level").eq("store_id", store.id),
      supabase
        .from("sale_items")
        .select(profitSelect)
        .eq("sales.store_id", store.id)
        .gte("sales.created_at", startIso)
        .lte("sales.created_at", endIso),
      supabase.from("sale_items").select(totalProfitSelect).eq("sales.store_id", store.id),
    ]);

    const todaySalesTotal = (salesRows ?? []).reduce((sum, row) => sum + Number((row as { total_amount?: unknown }).total_amount ?? 0), 0);
    const profitRowsTyped = (profitRows ?? []) as SaleItemProfitRow[];
    const todayProfit = sumProfitFromSaleItemRows(profitRowsTyped);
    const totalProfit = sumProfitFromSaleItemRows((totalProfitRows ?? []) as SaleItemProfitRow[]);
    const topProductsToday = topProductsFromSaleItems(profitRowsTyped, 5);
    const rows = products ?? [];
    const { lowStockCount, outOfStockCount } = countStockBuckets(rows);
    const { suggestions: restockSuggestions, total: needsRestockCount } = needsRestockFromProducts(rows);

    setStats({
      todaySalesTotal,
      todayProfit,
      totalProfit,
      topProductsToday,
      restockSuggestions,
      needsRestockCount,
      productCount: productCount ?? 0,
      lowStockCount,
      outOfStockCount,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener(TINDAKO_DATA_EVENT, onRefresh);
    return () => window.removeEventListener(TINDAKO_DATA_EVENT, onRefresh);
  }, [load]);

  const topProductsMaxSold = useMemo(() => {
    const items = stats.topProductsToday;
    if (!items.length) return 1;
    return Math.max(...items.map((i) => i.totalSold), 1);
  }, [stats.topProductsToday]);

  const formattedDate = useMemo(() => formatDate(), []);

  return (
    <>
      <AppHeader
        storeName={storeName.trim() || undefined}
        subtitle={storeName.trim() ? undefined : "Overview"}
      />

      <div className="flex flex-col gap-6 pb-6">
        {loading ? (
          <p className="rounded-2xl border border-dashed border-border/60 bg-muted/25 px-4 py-12 text-center text-base text-muted-foreground shadow-sm">
            Loading…
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-6">
              <Card>
                <CardContent className="flex flex-col gap-1.5 px-5 py-6 sm:px-6 sm:py-7">
                  <p className="text-sm font-medium text-muted-foreground">Sales Today</p>
                  <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
                    {formatPeso(stats.todaySalesTotal)}
                  </p>
                  <p className="pt-1 text-sm text-muted-foreground">{formattedDate}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex flex-col gap-1.5 px-5 py-6 sm:px-6 sm:py-7">
                  <p className="text-sm font-medium text-muted-foreground">Profit Today</p>
                  <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
                    {formatPeso(stats.todayProfit)}
                  </p>
                  <p className="pt-1 text-sm text-muted-foreground">{formattedDate}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-1 border border-primary/30 bg-primary/5 sm:mt-2">
              <CardContent className="flex flex-col gap-1.5 px-5 py-6 sm:px-6 sm:py-7">
                <p className="text-sm font-medium text-muted-foreground">Total Profit</p>
                <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
                  {formatPeso(stats.totalProfit)}
                </p>
                <p className="pt-1 text-xs leading-relaxed text-muted-foreground">Total profit earned</p>
              </CardContent>
            </Card>

            <section
              className="mt-6 w-full border-t border-border/50 pt-5 px-5 sm:px-6"
              aria-labelledby="top-products-today-heading"
            >
              <h2 id="top-products-today-heading" className="text-lg font-semibold tracking-tight text-foreground">
                Top Products Today
              </h2>
              {stats.topProductsToday.length === 0 ? (
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">No sales yet today.</p>
              ) : (
                <ol className="mt-4 flex list-none flex-col space-y-3 pl-0" role="list">
                  {stats.topProductsToday.map((item, index) => {
                    const rank = index + 1;
                    const isFirst = index === 0;
                    const barPct = topProductsMaxSold > 0 ? (item.totalSold / topProductsMaxSold) * 100 : 0;
                    return (
                      <li
                        key={item.productId}
                        className={cn(
                          "rounded-xl border border-neutral-200 px-4 py-3 dark:border-border",
                          isFirst && "bg-green-50 dark:bg-green-950/20"
                        )}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2 gap-y-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="shrink-0 tabular-nums text-xs font-medium text-muted-foreground">
                              {rank}.
                            </span>
                            <span
                              className={cn(
                                "min-w-0 leading-snug text-foreground",
                                isFirst ? "text-base font-semibold" : "text-sm font-medium"
                              )}
                            >
                              {item.name}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 tabular-nums text-sm",
                              isFirst ? "font-medium text-foreground" : "text-muted-foreground"
                            )}
                          >
                            {item.totalSold} sold
                          </span>
                        </div>
                        <div
                          className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-muted/60 dark:bg-muted/40"
                          aria-hidden
                        >
                          <div
                            className={cn(
                              "h-full max-w-full rounded-full transition-[width] duration-300 ease-out",
                              isFirst ? "bg-green-600/35 dark:bg-green-500/30" : "bg-foreground/15 dark:bg-foreground/20"
                            )}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <section
              className="mt-6 w-full border-t border-border/50 pt-5 px-5 sm:px-6"
              aria-labelledby="what-to-restock-heading"
              aria-describedby="what-to-restock-subtitle"
            >
              <h2 id="what-to-restock-heading" className="text-lg font-semibold tracking-tight text-foreground">
                What to Restock
              </h2>
              <p id="what-to-restock-subtitle" className="mt-1 text-sm text-muted-foreground">
                Based on stock vs reorder level
              </p>
              {stats.needsRestockCount === 0 ? (
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">All good…</p>
              ) : (
                <>
                  <p className="mt-4 text-base leading-relaxed text-foreground">
                    You have {stats.needsRestockCount} {stats.needsRestockCount === 1 ? "item" : "items"} to restock.
                  </p>
                  <ol className="mt-3 list-decimal space-y-3 pl-5 text-base leading-relaxed text-foreground">
                    {stats.restockSuggestions.map((item, index) => (
                      <li key={item.productId} className="pl-1 marker:font-medium marker:text-muted-foreground">
                        <span
                          className={cn(
                            "text-foreground",
                            index === 0 ? "font-semibold" : "font-medium"
                          )}
                        >
                          {item.name}
                        </span>
                        <span className="text-muted-foreground"> — </span>
                        <span className="font-medium text-foreground">{item.reason}</span>
                      </li>
                    ))}
                  </ol>
                  {stats.needsRestockCount > RESTOCK_SUGGESTIONS_MAX ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Showing {RESTOCK_SUGGESTIONS_MAX} of {stats.needsRestockCount}. See{" "}
                      <Link href="/inventory" className="font-medium text-primary underline-offset-4 hover:underline">
                        Inventory
                      </Link>{" "}
                      for the full list.
                    </p>
                  ) : null}
                </>
              )}
            </section>

            <Card className="overflow-hidden">
              <Link
                href="/inventory"
                className={cn(
                  "block text-foreground no-underline outline-none transition-colors",
                  "hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
              >
                <CardContent className="flex flex-col gap-1.5 px-5 py-6 sm:px-6 sm:py-7">
                  <p className="text-sm font-medium text-muted-foreground">Products</p>
                  <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
                    {stats.productCount}
                  </p>
                  <p className="pt-1 text-xs leading-relaxed text-muted-foreground">Items in your catalog</p>
                </CardContent>
              </Link>
            </Card>

            <Card className="overflow-hidden bg-yellow-50 border border-yellow-200 ring-0">
              <Link
                href="/inventory?stock=low"
                className={cn(
                  "block text-foreground no-underline outline-none transition-colors",
                  "hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
              >
                <CardContent className="flex flex-col gap-1.5 px-5 py-6 sm:px-6 sm:py-7">
                  <p className="text-sm font-medium text-muted-foreground">Low stock items</p>
                  <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
                    {stats.lowStockCount}
                  </p>
                  <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
                    Has stock left, but quantity is at or below reorder level.
                  </p>
                </CardContent>
              </Link>
            </Card>

            <Card className="overflow-hidden bg-red-50 border border-red-200 ring-0">
              <Link
                href="/inventory?stock=out"
                className={cn(
                  "block text-foreground no-underline outline-none transition-colors",
                  "hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
              >
                <CardContent className="flex flex-col gap-1.5 px-5 py-6 sm:px-6 sm:py-7">
                  <p className="text-sm font-medium text-muted-foreground">Out of stock items</p>
                  <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
                    {stats.outOfStockCount}
                  </p>
                  <p className="pt-1 text-xs leading-relaxed text-muted-foreground">On-hand quantity is zero.</p>
                </CardContent>
              </Link>
            </Card>

            <p className="text-center text-sm text-muted-foreground">
              <Link href="/inventory" className="font-medium text-primary underline-offset-4 hover:underline">
                Inventory
              </Link>
              {" · "}
              <Link href="/pos" className="font-medium text-primary underline-offset-4 hover:underline">
                POS
              </Link>
            </p>
          </div>
        )}
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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

type RestockReason = "Out of stock" | "Low stock" | "Fast selling";

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

function manilaTodayMetricsDateSubtitle(): string {
  return `${new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date())} · Manila`;
}

function buildStockByProductId(rows: { id?: unknown; stock_qty?: unknown; reorder_level?: unknown }[]) {
  const map = new Map<string, { stock: number; reorder: number }>();
  for (const r of rows) {
    const id = String(r.id ?? "").trim();
    if (!id) continue;
    map.set(id, { stock: Number(r.stock_qty), reorder: Number(r.reorder_level) });
  }
  return map;
}

const RESTOCK_SUGGESTIONS_MAX = 5;

/** Out → Low → Fast selling (by today’s sales rank within each tier); max 5 rows. */
function restockSuggestionsFromTopAndStock(
  topProducts: TopProductEntry[],
  productRows: { id?: unknown; stock_qty?: unknown; reorder_level?: unknown }[]
): RestockSuggestion[] {
  if (topProducts.length === 0) return [];

  const stockMap = buildStockByProductId(productRows);

  type Enriched = TopProductEntry & {
    reason: RestockReason;
    priority: "high" | "medium";
    rank: number;
    /** Sort among high: 0 = out of stock, 1 = low stock */
    highTier: number;
  };

  const enriched: Enriched[] = topProducts.map((tp, rank) => {
    const row = stockMap.get(tp.productId);
    const stock = row ? row.stock : Number.NaN;
    const reorder = row ? row.reorder : Number.NaN;

    if (!Number.isFinite(stock)) {
      return { ...tp, reason: "Fast selling", priority: "medium", rank, highTier: 2 };
    }
    if (stock === 0) {
      return { ...tp, reason: "Out of stock", priority: "high", rank, highTier: 0 };
    }
    if (stock > 0 && stock <= reorder) {
      return { ...tp, reason: "Low stock", priority: "high", rank, highTier: 1 };
    }
    return { ...tp, reason: "Fast selling", priority: "medium", rank, highTier: 2 };
  });

  const high = enriched.filter((e) => e.priority === "high");
  high.sort((a, b) => {
    if (a.highTier !== b.highTier) return a.highTier - b.highTier;
    return a.rank - b.rank;
  });
  const medium = enriched.filter((e) => e.priority === "medium").sort((a, b) => a.rank - b.rank);

  return [...high, ...medium]
    .slice(0, RESTOCK_SUGGESTIONS_MAX)
    .map(({ productId, name, reason, priority }) => ({ productId, name, reason, priority }));
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
        supabase.from("products").select("id, stock_qty, reorder_level"),
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
      const restockSuggestions = restockSuggestionsFromTopAndStock(topProductsToday, rows);

      setStoreName("Overview");
      setStats({
        todaySalesTotal,
        todayProfit,
        totalProfit,
        topProductsToday,
        restockSuggestions,
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
      supabase.from("products").select("id, stock_qty, reorder_level").eq("store_id", store.id),
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
    const restockSuggestions = restockSuggestionsFromTopAndStock(topProductsToday, rows);

    setStats({
      todaySalesTotal,
      todayProfit,
      totalProfit,
      topProductsToday,
      restockSuggestions,
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

  return (
    <>
      <AppHeader subtitle={storeName || "Overview"} />

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
                  <p className="pt-1 text-xs leading-relaxed text-muted-foreground">{manilaTodayMetricsDateSubtitle()}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex flex-col gap-1.5 px-5 py-6 sm:px-6 sm:py-7">
                  <p className="text-sm font-medium text-muted-foreground">Profit Today</p>
                  <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
                    {formatPeso(stats.todayProfit)}
                  </p>
                  <p className="pt-1 text-xs leading-relaxed text-muted-foreground">{manilaTodayMetricsDateSubtitle()}</p>
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
                <ol className="mt-4 list-decimal space-y-3 pl-5 text-base leading-relaxed text-foreground">
                  {stats.topProductsToday.map((item, index) => (
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
                      <span className="text-muted-foreground tabular-nums">{item.totalSold} sold</span>
                    </li>
                  ))}
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
                Based on today&apos;s sales and stock
              </p>
              {stats.restockSuggestions.length === 0 ? (
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  All good. No restock needed today.
                </p>
              ) : (
                <ol className="mt-4 list-decimal space-y-3 pl-5 text-base leading-relaxed text-foreground">
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
                      <span
                        className={
                          item.priority === "high"
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                        }
                      >
                        {item.reason}
                      </span>
                    </li>
                  ))}
                </ol>
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

            <Card className="overflow-hidden">
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

            <Card className="overflow-hidden">
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

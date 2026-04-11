"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { AUTH_DISABLED_FOR_DEV, getDevStoreId } from "@/lib/dev-auth";
import { getManilaTodayUtcRange } from "@/lib/manila-day";
import { formatPeso } from "@/lib/money";
import { TINDAKO_DATA_EVENT } from "@/lib/refresh-events";
import { resolveShopForClient } from "@/lib/resolve-shop-client";
import { createClient } from "@/lib/supabase";

type DashboardStats = {
  todaySalesTotal: number;
  productCount: number;
  lowStockCount: number;
  outOfStockCount: number;
};

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
    productCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { startIso, endIso } = getManilaTodayUtcRange();

    if (AUTH_DISABLED_FOR_DEV) {
      const supabase = createClient();

      const [{ data: salesRows }, { count: productCount }, { data: products }] = await Promise.all([
        supabase.from("sales").select("total_amount").gte("created_at", startIso).lte("created_at", endIso),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("products").select("stock_qty, reorder_level"),
      ]);

      const todaySalesTotal = (salesRows ?? []).reduce((sum, row) => sum + Number((row as { total_amount?: unknown }).total_amount ?? 0), 0);
      const rows = products ?? [];
      const { lowStockCount, outOfStockCount } = countStockBuckets(rows);

      setStoreName(getDevStoreId() ? "Dev mode" : "Dev mode — all stores");
      setStats({
        todaySalesTotal,
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
      setStats({ todaySalesTotal: 0, productCount: 0, lowStockCount: 0, outOfStockCount: 0 });
      setLoading(false);
      return;
    }

    setStoreName(store.name);

    const [{ data: salesRows }, { count: productCount }, { data: products }] = await Promise.all([
      supabase
        .from("sales")
        .select("total_amount")
        .eq("store_id", store.id)
        .gte("created_at", startIso)
        .lte("created_at", endIso),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id),
      supabase.from("products").select("stock_qty, reorder_level").eq("store_id", store.id),
    ]);

    const todaySalesTotal = (salesRows ?? []).reduce((sum, row) => sum + Number((row as { total_amount?: unknown }).total_amount ?? 0), 0);
    const rows = products ?? [];
    const { lowStockCount, outOfStockCount } = countStockBuckets(rows);

    setStats({
      todaySalesTotal,
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
      <AppHeader title="Dashboard" subtitle={storeName || "Overview"} />

      <div className="flex flex-col gap-6 pb-6">
        {loading ? (
          <p className="rounded-2xl border border-dashed border-border/60 bg-muted/25 px-4 py-12 text-center text-base text-muted-foreground shadow-sm">
            Loading…
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            <Card>
              <CardContent className="flex flex-col gap-1.5 px-5 py-6 sm:px-6 sm:py-7">
                <p className="text-sm font-medium text-muted-foreground">Today&apos;s Sales</p>
                <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
                  {formatPeso(stats.todaySalesTotal)}
                </p>
                <p className="pt-1 text-xs leading-relaxed text-muted-foreground">Manila calendar day · total_amount</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-col gap-1.5 px-5 py-6 sm:px-6 sm:py-7">
                <p className="text-sm font-medium text-muted-foreground">Products</p>
                <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">{stats.productCount}</p>
                <p className="pt-1 text-xs leading-relaxed text-muted-foreground">Items in your catalog</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-col gap-1.5 px-5 py-6 sm:px-6 sm:py-7">
                <p className="text-sm font-medium text-muted-foreground">Low stock items</p>
                <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
                  {stats.lowStockCount}
                </p>
                <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
                  Has stock left, but quantity is at or below reorder level.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-col gap-1.5 px-5 py-6 sm:px-6 sm:py-7">
                <p className="text-sm font-medium text-muted-foreground">Out of stock items</p>
                <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
                  {stats.outOfStockCount}
                </p>
                <p className="pt-1 text-xs leading-relaxed text-muted-foreground">On-hand quantity is zero.</p>
              </CardContent>
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

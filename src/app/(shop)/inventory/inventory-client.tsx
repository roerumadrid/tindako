"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AddProductForm } from "@/components/inventory/add-product-form";
import { InventoryProductList } from "@/components/inventory/inventory-product-list";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TINDAKO_DATA_EVENT, type TindakoDataRefreshDetail } from "@/lib/refresh-events";
import { AUTH_DISABLED_FOR_DEV } from "@/lib/dev-auth";
import { getManilaTodayUtcRange } from "@/lib/manila-day";
import {
  INVENTORY_UNCATEGORIZED_VALUE,
  normalizeProduct,
  parseInventoryStockParam,
  PRODUCT_LIST_SELECT,
  type InventoryStockFilter,
} from "@/lib/product";
import { topProductIdsByQtySold, type SaleItemQtyRow } from "@/lib/top-products-today";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { resolveShopForClient } from "@/lib/resolve-shop-client";
import { createClient } from "@/lib/supabase";
import type { Product } from "@/types/database";

export function InventoryClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [topProductIdsToday, setTopProductIdsToday] = useState<ReadonlySet<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState<InventoryStockFilter>("all");
  const [addProductOpen, setAddProductOpen] = useState(false);

  useEffect(() => {
    setStockFilter(parseInventoryStockParam(searchParams.get("stock")));
  }, [searchParams]);

  const applyStockFilter = useCallback(
    (next: InventoryStockFilter) => {
      setStockFilter(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "all") {
        params.delete("stock");
      } else {
        params.set("stock", next);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const categorySelectOptions = useMemo(() => {
    const rows: { value: string; label: string }[] = [{ value: "", label: "All categories" }];
    const byFilterValue = new Map<string, string>();
    for (const p of products) {
      const cid = (p.category_id ?? "").trim();
      if (!cid) {
        byFilterValue.set(INVENTORY_UNCATEGORIZED_VALUE, "Uncategorized");
        continue;
      }
      const label = p.category_display.trim() || "Uncategorized";
      if (!byFilterValue.has(cid)) byFilterValue.set(cid, label);
    }
    for (const [value, label] of byFilterValue) {
      rows.push({ value, label });
    }
    rows.sort((a, b) => {
      if (!a.value) return -1;
      if (!b.value) return 1;
      if (a.value === INVENTORY_UNCATEGORIZED_VALUE) return -1;
      if (b.value === INVENTORY_UNCATEGORIZED_VALUE) return 1;
      return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    });
    return rows;
  }, [products]);

  const stockFilterSummary = useMemo(() => {
    if (stockFilter === "low") return "Showing: Low stock items";
    if (stockFilter === "out") return "Showing: Out of stock items";
    return "Showing: All products";
  }, [stockFilter]);

  const selectFieldClass = cn(
    "min-h-12 w-full cursor-pointer appearance-none rounded-xl border border-input bg-transparent px-3 py-2 pr-10 text-base text-foreground shadow-sm transition-colors outline-none",
    "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
    "dark:bg-input/30"
  );

  const load = useCallback(async () => {
    const { startIso, endIso } = getManilaTodayUtcRange();
    const saleSelectTodayDev = "product_id, qty, sales!inner (created_at)";
    const saleSelectTodayStore = "product_id, qty, sales!inner (created_at, store_id)";

    if (AUTH_DISABLED_FOR_DEV) {
      const supabase = createClient();
      const [{ data: productRows }, { data: saleRows }] = await Promise.all([
        supabase.from("products").select(PRODUCT_LIST_SELECT).order("name"),
        supabase
          .from("sale_items")
          .select(saleSelectTodayDev)
          .gte("sales.created_at", startIso)
          .lte("sales.created_at", endIso),
      ]);
      setProducts((productRows ?? []).map((row) => normalizeProduct(row as Record<string, unknown>)));
      setTopProductIdsToday(topProductIdsByQtySold((saleRows ?? []) as SaleItemQtyRow[], 5));
      setLoading(false);
      return;
    }

    const { supabase, store } = await resolveShopForClient();
    if (!store) {
      setProducts([]);
      setTopProductIdsToday(new Set());
      setLoading(false);
      return;
    }
    const [{ data: productRows }, { data: saleRows }] = await Promise.all([
      supabase.from("products").select(PRODUCT_LIST_SELECT).eq("store_id", store.id).order("name"),
      supabase
        .from("sale_items")
        .select(saleSelectTodayStore)
        .eq("sales.store_id", store.id)
        .gte("sales.created_at", startIso)
        .lte("sales.created_at", endIso),
    ]);
    setProducts((productRows ?? []).map((row) => normalizeProduct(row as Record<string, unknown>)));
    setTopProductIdsToday(topProductIdsByQtySold((saleRows ?? []) as SaleItemQtyRow[], 5));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = (e: Event) => {
      const detail = (e as CustomEvent<TindakoDataRefreshDetail>).detail;
      if (detail?.inventoryProductsAlreadyUpdated) return;
      void load();
    };
    window.addEventListener(TINDAKO_DATA_EVENT, onRefresh);
    return () => window.removeEventListener(TINDAKO_DATA_EVENT, onRefresh);
  }, [load]);

  const handleProductDeleted = useCallback((productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  }, []);

  return (
    <div className="flex flex-col gap-3 pb-8">
        <div
          className={cn(
            "sticky top-0 z-20 -mx-4 border-b border-border/70 bg-background/95 px-4 py-3 shadow-sm backdrop-blur-md",
            "supports-[backdrop-filter]:bg-background/85"
          )}
        >
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end sm:gap-3">
              <div className="flex flex-col gap-1.5 sm:col-span-5">
                <Label htmlFor="inventory-product-search" className="text-xs font-medium text-muted-foreground">
                  Search
                </Label>
                <Input
                  id="inventory-product-search"
                  type="search"
                  enterKeyHint="search"
                  placeholder="Search product..."
                  value={search}
                  onValueChange={setSearch}
                  className="min-h-12 w-full rounded-xl text-base"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-4">
                <Label htmlFor="inventory-category-filter" className="text-xs font-medium text-muted-foreground">
                  Category
                </Label>
                <div className="relative">
                  <select
                    id="inventory-category-filter"
                    className={selectFieldClass}
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    aria-label="Filter by category"
                  >
                    {categorySelectOptions.map((opt) => (
                      <option key={opt.value || "all"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                </div>
              </div>
              <div className="flex sm:col-span-3 sm:justify-end">
                <Button
                  type="button"
                  size="lg"
                  className="h-12 min-h-12 w-full font-semibold sm:mt-0 sm:min-h-12 sm:w-full"
                  onClick={() => setAddProductOpen(true)}
                >
                  + Add Product
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-border/50 pt-3">
              <p className="text-xs font-medium leading-snug text-muted-foreground" aria-live="polite">
                {stockFilterSummary}
              </p>
              <div
                className="flex flex-wrap justify-start gap-2"
                role="group"
                aria-label="Filter by stock status"
              >
                {(
                  [
                    { id: "all" as const, label: "All", aria: "All products" },
                    { id: "low" as const, label: "Low", aria: "Low stock" },
                    { id: "out" as const, label: "Out", aria: "Out of stock" },
                  ] as const
                ).map(({ id, label, aria }) => (
                  <Button
                    key={id}
                    type="button"
                    variant={stockFilter === id ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "min-h-10 shrink-0 rounded-xl px-3.5 text-sm font-semibold sm:px-4",
                      stockFilter === id && "shadow-sm ring-2 ring-primary/25 ring-offset-2 ring-offset-background"
                    )}
                    aria-label={aria}
                    onClick={() => applyStockFilter(id)}
                    aria-pressed={stockFilter === id}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Dialog
          open={addProductOpen}
          disablePointerDismissal
          onOpenChange={(next, details) => {
            if (!next && details.reason === "escape-key") {
              details.cancel();
              return;
            }
            setAddProductOpen(next);
          }}
        >
          <DialogContent variant="stacked" className="w-[calc(100%-1.5rem)] max-w-lg sm:max-w-lg">
            <DialogHeader className="border-b border-border/60 px-4 pt-4 pr-12 pb-3 sm:px-6 sm:pr-14">
              <DialogTitle>Add product</DialogTitle>
              <DialogDescription>Fill in the details below. Everything saves to your inventory.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              {addProductOpen ? (
                <AddProductForm embeddedInModal onRequestClose={() => setAddProductOpen(false)} />
              ) : null}
            </DialogBody>
          </DialogContent>
        </Dialog>

        <section className="flex flex-col gap-2 pt-1">
          <h2 className="px-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Products</h2>
          <InventoryProductList
            loading={loading}
            products={products}
            searchQuery={search}
            categoryFilter={categoryFilter}
            stockFilter={stockFilter}
            topProductIdsToday={topProductIdsToday}
            onProductDeleted={handleProductDeleted}
          />
        </section>
    </div>
  );
}

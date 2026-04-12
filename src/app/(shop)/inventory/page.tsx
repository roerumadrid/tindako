"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
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
import { TINDAKO_DATA_EVENT } from "@/lib/refresh-events";
import { AUTH_DISABLED_FOR_DEV } from "@/lib/dev-auth";
import { INVENTORY_UNCATEGORIZED_VALUE, normalizeProduct, PRODUCT_LIST_SELECT } from "@/lib/product";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { resolveShopForClient } from "@/lib/resolve-shop-client";
import { createClient } from "@/lib/supabase";
import type { Product } from "@/types/database";

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [addProductOpen, setAddProductOpen] = useState(false);

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

  const selectFieldClass = cn(
    "min-h-12 w-full cursor-pointer appearance-none rounded-xl border border-input bg-transparent px-3 py-2 pr-10 text-base text-foreground shadow-sm transition-colors outline-none",
    "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
    "dark:bg-input/30"
  );

  const load = useCallback(async () => {
    if (AUTH_DISABLED_FOR_DEV) {
      const supabase = createClient();
      const { data } = await supabase.from("products").select(PRODUCT_LIST_SELECT).order("name");
      setProducts((data ?? []).map((row) => normalizeProduct(row as Record<string, unknown>)));
      setLoading(false);
      return;
    }

    const { supabase, store } = await resolveShopForClient();
    if (!store) {
      setProducts([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("products")
      .select(PRODUCT_LIST_SELECT)
      .eq("store_id", store.id)
      .order("name");
    setProducts((data ?? []).map((row) => normalizeProduct(row as Record<string, unknown>)));
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
      <AppHeader title="Inventory" subtitle="Your product list and stock" />
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
          />
        </section>
      </div>
    </>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AddProductForm } from "@/components/inventory/add-product-form";
import { InventoryProductList } from "@/components/inventory/inventory-product-list";
import { TINDAKO_DATA_EVENT } from "@/lib/refresh-events";
import { AUTH_DISABLED_FOR_DEV } from "@/lib/dev-auth";
import { normalizeProduct } from "@/lib/product";
import { resolveShopForClient } from "@/lib/resolve-shop-client";
import { createClient } from "@/lib/supabase";
import type { Product } from "@/types/database";

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (AUTH_DISABLED_FOR_DEV) {
      const supabase = createClient();
      const { data } = await supabase.from("products").select("*").order("name");
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
    const { data } = await supabase.from("products").select("*").eq("store_id", store.id).order("name");
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
      <div className="flex flex-col gap-8 pb-6">
        <AddProductForm />
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Products</h2>
          <InventoryProductList loading={loading} products={products} />
        </section>
      </div>
    </>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { PosCheckout } from "@/components/pos/pos-checkout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_DISABLED_FOR_DEV } from "@/lib/dev-auth";
import { TINDAKO_DATA_EVENT } from "@/lib/refresh-events";
import { normalizeProduct, PRODUCT_LIST_SELECT } from "@/lib/product";
import { resolveShopForClient } from "@/lib/resolve-shop-client";
import { createClient } from "@/lib/supabase";
import type { Product } from "@/types/database";

export default function PosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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
      <AppHeader title="Point of sale" subtitle="Tap products to add 1 each — or use optional quantity, then complete sale" />
      <div className="flex flex-col gap-6 pb-8">
        <div className="flex flex-col gap-2">
          <Label htmlFor="pos-product-search" className="sr-only">
            Search products
          </Label>
          <Input
            id="pos-product-search"
            type="search"
            enterKeyHint="search"
            placeholder="Search product..."
            value={search}
            onValueChange={setSearch}
            className="min-h-12 w-full rounded-xl text-base"
            autoComplete="off"
          />
        </div>
        <PosCheckout products={products} productSearchQuery={search} loading={loading} />
      </div>
    </>
  );
}

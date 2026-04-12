"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { StoreForm } from "@/components/store/store-form";
import { TINDAKO_DATA_EVENT } from "@/lib/refresh-events";
import { resolveShopForClient } from "@/lib/resolve-shop-client";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { store } = await resolveShopForClient();
    if (store) {
      setName(store.name);
    }
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

  if (loading) {
    return (
      <p className="rounded-2xl border border-dashed border-border/60 bg-muted/25 px-4 py-12 text-center text-base text-muted-foreground shadow-sm">
        Loading…
      </p>
    );
  }

  return (
    <>
      <AppHeader subtitle="Store name" />
      <StoreForm
        title="Store details"
        description="Update how your store appears in TindaKo."
        submitLabel="Save changes"
        defaultName={name}
        afterSaveHref="/settings"
        onSaved={(store) => setName(store.name)}
      />
    </>
  );
}

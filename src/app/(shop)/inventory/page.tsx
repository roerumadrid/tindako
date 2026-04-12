import { Suspense } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { InventoryClient } from "./inventory-client";

export default function InventoryPage() {
  return (
    <>
      <AppHeader subtitle="Your product list and stock" />
      <Suspense
        fallback={
          <p className="rounded-2xl border border-dashed border-border/60 bg-muted/25 px-4 py-12 text-center text-base text-muted-foreground shadow-sm">
            Loading inventory…
          </p>
        }
      >
        <InventoryClient />
      </Suspense>
    </>
  );
}

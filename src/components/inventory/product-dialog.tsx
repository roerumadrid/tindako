"use client";

import { useState, useTransition } from "react";
import { useAutoDismissString } from "@/hooks/use-auto-dismiss";
import { emitTindakoDataRefresh } from "@/lib/refresh-events";
import { updateProduct } from "@/lib/supabase/mutations";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Product } from "@/types/database";

function fieldClass() {
  return "min-h-11 w-full rounded-xl text-base";
}

type Props = { product: Product };

export function ProductDialog({ product }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useAutoDismissString(error, () => setError(null));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setError(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("id", product.id);
    startTransition(async () => {
      const result = await updateProduct(fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      emitTindakoDataRefresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-9 shrink-0"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Edit
      </Button>
      <DialogContent variant="stacked" className="w-[calc(100%-1.5rem)] max-w-lg sm:max-w-lg">
        <form
          onSubmit={onSubmit}
          onInput={() => setError(null)}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          <DialogHeader className="border-b border-border/60 px-4 pt-4 pr-12 pb-3 sm:px-6 sm:pr-14">
            <DialogTitle>Edit product</DialogTitle>
            <DialogDescription>Update details. Selling price is used at POS.</DialogDescription>
          </DialogHeader>

          <DialogBody>
            {error ? (
              <p
                className="mb-4 rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5 text-sm leading-snug text-destructive dark:border-destructive/40"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div key={product.id} className="grid gap-5 pb-2">
              <section className="space-y-3">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Basics</p>
                <div className="space-y-2">
                  <Label htmlFor="p-name">Product name</Label>
                  <Input
                    id="p-name"
                    name="name"
                    required
                    autoComplete="off"
                    className={fieldClass()}
                    defaultValue={product.name}
                    placeholder="e.g. Coke 500ml"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-category">Category</Label>
                  <Input
                    id="p-category"
                    name="category"
                    autoComplete="off"
                    className={fieldClass()}
                    defaultValue={product.category}
                    placeholder="e.g. Beverages, Snacks"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-unit">Unit</Label>
                  <Input
                    id="p-unit"
                    name="unit"
                    autoComplete="off"
                    className={fieldClass()}
                    defaultValue={product.unit}
                    placeholder="pc, bottle, kg…"
                  />
                  <p className="text-xs text-muted-foreground">How you count this item.</p>
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Pricing (₱)</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="p-cost">Cost price</Label>
                    <Input
                      id="p-cost"
                      name="cost_price"
                      type="text"
                      inputMode="decimal"
                      className={fieldClass()}
                      defaultValue={String(product.cost_price)}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">What you pay per unit.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-sell">Selling price</Label>
                    <Input
                      id="p-sell"
                      name="selling_price"
                      type="text"
                      inputMode="decimal"
                      required
                      className={fieldClass()}
                      defaultValue={String(product.selling_price)}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">Price at POS.</p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Stock</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="p-qty">Stock quantity</Label>
                    <Input
                      id="p-qty"
                      name="stock_qty"
                      type="number"
                      min={0}
                      required
                      className={fieldClass()}
                      defaultValue={product.stock_qty}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-reorder">Reorder level</Label>
                    <Input
                      id="p-reorder"
                      name="reorder_level"
                      type="number"
                      min={0}
                      required
                      className={fieldClass()}
                      defaultValue={product.reorder_level}
                    />
                    <p className="text-xs text-muted-foreground">Yellow alert at or below this. Red at zero.</p>
                  </div>
                </div>
              </section>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-12 w-full sm:min-h-11 sm:w-auto" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-12 w-full font-semibold sm:min-h-11 sm:w-auto" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

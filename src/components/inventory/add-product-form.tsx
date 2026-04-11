"use client";

import { useState } from "react";
import { createProduct } from "@/lib/supabase/mutations";
import { emitTindakoDataRefresh } from "@/lib/refresh-events";
import { FEEDBACK_AUTO_HIDE_MS, useAutoDismissString, useAutoDismissTrue } from "@/hooks/use-auto-dismiss";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const inputClass = "min-h-11 w-full rounded-xl text-base";

export function AddProductForm() {
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  useAutoDismissString(error, () => setError(null), FEEDBACK_AUTO_HIDE_MS);
  useAutoDismissTrue(success, () => setSuccess(false), FEEDBACK_AUTO_HIDE_MS);

  function clearFeedback() {
    setError(null);
    setSuccess(false);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const fd = new FormData(e.currentTarget);

    setPending(true);
    try {
      const result = await createProduct(fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      emitTindakoDataRefresh();
      setSuccess(true);
      setFormKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save product.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Add product</CardTitle>
        <CardDescription>Fill in the details below. Everything saves to your inventory.</CardDescription>
      </CardHeader>

      <form key={formKey} onSubmit={onSubmit} onInput={clearFeedback}>
        <CardContent className="space-y-6">
          {success ? (
            <p
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-2.5 text-sm leading-snug font-medium text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/35 dark:text-emerald-100"
              role="status"
            >
              Product added successfully. You can add another below.
            </p>
          ) : null}

          {error ? (
            <p
              className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5 text-sm leading-snug text-destructive dark:border-destructive/40"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="add-name">Product name</Label>
            <Input
              id="add-name"
              name="name"
              required
              autoComplete="off"
              className={inputClass}
              placeholder="e.g. Lucky Me Pancit Canton"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-category">Category</Label>
            <Input
              id="add-category"
              name="category"
              autoComplete="off"
              className={inputClass}
              placeholder="e.g. Noodles, Drinks"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-cost">Cost price (₱)</Label>
              <Input
                id="add-cost"
                name="cost_price"
                type="text"
                inputMode="decimal"
                className={inputClass}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">What you paid per unit.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-sell">Selling price (₱)</Label>
              <Input
                id="add-sell"
                name="selling_price"
                type="text"
                inputMode="decimal"
                required
                className={inputClass}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">Price at checkout (POS).</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-stock">Stock quantity</Label>
              <Input
                id="add-stock"
                name="stock_qty"
                type="number"
                min={0}
                required
                className={inputClass}
                defaultValue={0}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-reorder">Reorder level</Label>
              <Input
                id="add-reorder"
                name="reorder_level"
                type="number"
                min={0}
                required
                className={inputClass}
                defaultValue={5}
              />
              <p className="text-xs text-muted-foreground">Warn when stock is at or below this.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-unit">Unit</Label>
            <Input
              id="add-unit"
              name="unit"
              autoComplete="off"
              className={inputClass}
              defaultValue="pc"
              placeholder="pc, bottle, sack…"
            />
          </div>
        </CardContent>

        <CardFooter className="flex-col gap-3 sm:flex-row">
          <Button type="submit" size="lg" className="min-h-12 w-full" disabled={pending}>
            {pending ? "Saving…" : "Save product"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

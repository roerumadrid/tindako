"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FEEDBACK_AUTO_HIDE_MS, useAutoDismissString } from "@/hooks/use-auto-dismiss";
import { emitTindakoDataRefresh } from "@/lib/refresh-events";
import { restockProduct } from "@/lib/supabase/mutations";
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
import { cn } from "@/lib/utils";
import type { Product } from "@/types/database";

type Props = {
  product: Product;
  /** When inventory is filtered to low/out stock, draw attention to Restock. */
  emphasizeTrigger?: boolean;
};

export function RestockProductButton({ product, emphasizeTrigger = false }: Props) {
  const { id, name, stock_qty } = product;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qtyInput, setQtyInput] = useState("1");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useAutoDismissString(error, () => setError(null), FEEDBACK_AUTO_HIDE_MS);
  useAutoDismissString(success, () => setSuccess(null), FEEDBACK_AUTO_HIDE_MS);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setError(null);
      setQtyInput("1");
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = Number.parseInt(qtyInput, 10);
    startTransition(async () => {
      const { error: err } = await restockProduct(product, parsed);
      if (err) {
        setError(err);
        return;
      }
      setOpen(false);
      setQtyInput("1");
      setSuccess("Stock updated.");
      emitTindakoDataRefresh();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-stretch gap-1.5">
      {success ? (
        <p
          className="max-w-[16rem] rounded-md border border-emerald-500/25 bg-emerald-500/[0.08] px-2 py-1.5 text-xs font-medium leading-snug text-emerald-800 dark:text-emerald-200"
          role="status"
        >
          {success}
        </p>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={cn(
          "min-h-9 shrink-0",
          emphasizeTrigger &&
            "border-2 border-primary/45 bg-primary/10 font-semibold text-foreground shadow-sm ring-1 ring-primary/20 hover:bg-primary/15 dark:border-primary/50 dark:bg-primary/15 dark:ring-primary/25"
        )}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Restock
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent variant="stacked" className="w-[calc(100%-1.5rem)] max-w-md sm:max-w-md">
          <form onSubmit={onSubmit} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <DialogHeader className="border-b border-border/60 px-4 pt-4 pr-12 pb-3 sm:px-6 sm:pr-14">
              <DialogTitle>Restock</DialogTitle>
              <DialogDescription className="text-left">
                <span className="font-medium text-foreground">{name}</span>
                <span className="text-muted-foreground"> — current stock: </span>
                <span className="font-medium tabular-nums text-foreground">{stock_qty}</span>
              </DialogDescription>
            </DialogHeader>

            <DialogBody>
              {error ? (
                <p
                  className="mb-3 rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5 text-sm leading-snug text-destructive"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor={`restock-qty-${id}`} className="text-base font-medium">
                  Add stock
                </Label>
                <Input
                  id={`restock-qty-${id}`}
                  name="add_qty"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={qtyInput}
                  onChange={(ev) => setQtyInput(ev.target.value)}
                  className="min-h-12 rounded-xl text-base"
                  autoComplete="off"
                  disabled={pending}
                />
                <p className="text-xs text-muted-foreground">Units to add to your on-hand quantity.</p>
              </div>
            </DialogBody>

            <DialogFooter className="flex-row">
              <Button
                type="button"
                variant="outline"
                className="min-h-12 min-w-0 flex-1 sm:min-h-11"
                disabled={pending}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="min-h-12 min-w-0 flex-1 font-semibold sm:min-h-11" disabled={pending}>
                {pending ? "Saving…" : "Add to stock"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

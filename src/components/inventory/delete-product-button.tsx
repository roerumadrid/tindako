"use client";

import { useState, useTransition } from "react";
import { FEEDBACK_AUTO_HIDE_MS, useAutoDismissString } from "@/hooks/use-auto-dismiss";
import { emitTindakoDataRefresh } from "@/lib/refresh-events";
import { deleteProduct } from "@/lib/supabase/mutations";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  productId: string;
  productName: string;
  /** Called after a successful delete so the parent can update local list state immediately. */
  onDeleted?: (productId: string) => void;
};

export function DeleteProductButton({ productId, productName, onDeleted }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useAutoDismissString(error, () => setError(null), FEEDBACK_AUTO_HIDE_MS);
  useAutoDismissString(success, () => setSuccess(null), FEEDBACK_AUTO_HIDE_MS);

  function confirmDelete() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const { error: delErr } = await deleteProduct(productId);
      setDialogOpen(false);
      if (delErr) {
        setError(delErr);
        return;
      }
      onDeleted?.(productId);
      emitTindakoDataRefresh(
        onDeleted ? { inventoryProductsAlreadyUpdated: true } : undefined
      );
      if (!onDeleted) {
        setSuccess("Product removed.");
      }
    });
  }

  return (
    <>
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && pending) return;
          setDialogOpen(open);
        }}
      >
        <DialogContent variant="stacked" showCloseButton={false} className="w-[calc(100%-1.5rem)] max-w-md sm:max-w-md">
          <DialogHeader className="space-y-2 border-b border-border/60 px-4 pt-4 pb-4 sm:px-6 sm:pr-14">
            <DialogTitle className="text-lg font-semibold leading-snug">Remove product</DialogTitle>
            <DialogDescription className="space-y-2 text-left">
              <span className="block text-base leading-snug font-medium text-foreground">
                Remove &lsquo;{productName}&rsquo; from inventory?
              </span>
              <span className="block text-xs leading-normal text-muted-foreground">This cannot be undone.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-3 border-0 px-4 pt-2 pb-4 sm:flex-row sm:px-6 sm:pb-5">
            <Button
              type="button"
              variant="outline"
              className="min-h-12 w-full sm:min-h-11 sm:flex-1"
              disabled={pending}
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-12 w-full font-semibold sm:min-h-11 sm:flex-1"
              disabled={pending}
              onClick={() => void confirmDelete()}
            >
              {pending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col items-stretch gap-1.5">
        {error ? (
          <p
            className="max-w-[16rem] rounded-md border border-destructive/25 bg-destructive/[0.06] px-2 py-1.5 text-xs leading-snug text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}
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
          variant="destructive"
          size="sm"
          className="min-h-9"
          disabled={pending}
          onClick={() => setDialogOpen(true)}
        >
          Remove
        </Button>
      </div>
    </>
  );
}

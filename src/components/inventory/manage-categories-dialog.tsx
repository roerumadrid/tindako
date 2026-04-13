"use client";

import { useCallback, useState } from "react";
import { ChevronRight, Loader2, Trash2 } from "lucide-react";
import { displayCategoryName } from "@/lib/category-names";
import { emitTindakoDataRefresh } from "@/lib/refresh-events";
import {
  countProductsUsingCategory,
  deleteCategory,
} from "@/lib/supabase/mutations";
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
import { handleError } from "@/components/ui/use-toast";
import type { Category } from "@/types/database";

const BLOCKED_MESSAGE =
  "Cannot delete this category because it is still used by existing products.";

type Props = {
  categories: Category[];
  disabled?: boolean;
  onRefreshCategories: () => Promise<void>;
  /** After a successful delete; parent should clear `selectedCategoryId` when it matches `deletedId`. */
  onCategoryDeleted: (deletedId: string) => void;
  /** Fires when the manage dialog opens or closes (for dimming a parent modal). */
  onManageDialogOpenChange?: (open: boolean) => void;
};

type Step = "list" | "confirm";

export function ManageCategoriesDialog({
  categories,
  disabled = false,
  onRefreshCategories,
  onCategoryDeleted,
  onManageDialogOpenChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("list");
  const [pendingCategory, setPendingCategory] = useState<Category | null>(null);
  const [rowErrorById, setRowErrorById] = useState<Record<string, string>>({});
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const resetTransient = useCallback(() => {
    setStep("list");
    setPendingCategory(null);
    setRowErrorById({});
    setCheckingId(null);
    setConfirmError(null);
    setDeletePending(false);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      onManageDialogOpenChange?.(next);
      if (!next) resetTransient();
    },
    [onManageDialogOpenChange, resetTransient]
  );

  async function handleDeleteClick(c: Category) {
    setRowErrorById((prev) => {
      const next = { ...prev };
      delete next[c.id];
      return next;
    });
    setCheckingId(c.id);
    try {
      const { count, error } = await countProductsUsingCategory(c.id);
      if (error) {
        setRowErrorById((prev) => ({ ...prev, [c.id]: error }));
        return;
      }
      if (count > 0) {
        setRowErrorById((prev) => ({ ...prev, [c.id]: BLOCKED_MESSAGE }));
        return;
      }
      setPendingCategory(c);
      setStep("confirm");
      setConfirmError(null);
    } finally {
      setCheckingId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingCategory) return;
    setConfirmError(null);
    setDeletePending(true);
    try {
      const { error } = await deleteCategory(pendingCategory.id);
      if (error) {
        setConfirmError(error);
        return;
      }
      onCategoryDeleted(pendingCategory.id);
      emitTindakoDataRefresh();
      await onRefreshCategories();
      handleError("Category deleted", {
        closeModal: () => handleOpenChange(false),
        shouldCloseModal: true,
      });
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto min-h-11 w-fit cursor-pointer justify-start gap-1 px-0 py-2 text-left text-sm font-medium text-primary underline-offset-4 hover:text-primary/90 hover:underline disabled:no-underline"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span>Manage categories</span>
        <ChevronRight className="size-4 shrink-0 opacity-90" aria-hidden />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent depth={2} variant="stacked" className="w-[calc(100%-1.5rem)] max-w-md sm:max-w-md">
          {step === "list" ? (
            <>
              <DialogHeader className="border-b border-border/60 px-4 pt-4 pr-12 pb-3 sm:px-6 sm:pr-14">
                <DialogTitle>Categories</DialogTitle>
                <DialogDescription className="text-left">
                  Remove categories that are not used by any product. Categories still linked to products cannot be
                  deleted.
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="space-y-0 px-0 sm:px-0">
                {categories.length === 0 ? (
                  <p className="px-4 text-sm text-muted-foreground sm:px-6">No categories yet. Add one from the form.</p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {categories.map((c) => {
                      const rowErr = rowErrorById[c.id];
                      const busy = checkingId === c.id;
                      return (
                        <li key={c.id} className="px-4 sm:px-6">
                          <div className="flex min-h-12 items-center justify-between gap-3 py-2">
                            <span className="min-w-0 truncate text-base font-medium text-foreground">
                              {displayCategoryName(c.name)}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                              disabled={busy || deletePending}
                              aria-label={`Delete category ${displayCategoryName(c.name)}`}
                              onClick={() => void handleDeleteClick(c)}
                            >
                              {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                            </Button>
                          </div>
                          {rowErr ? (
                            <p className="pb-2 text-xs leading-snug text-destructive" role="alert">
                              {rowErr}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" className="min-h-12 w-full sm:min-h-11" onClick={() => handleOpenChange(false)}>
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader className="border-b border-border/60 px-4 pt-4 pr-12 pb-3 sm:px-6 sm:pr-14">
                <DialogTitle>Delete category</DialogTitle>
                <DialogDescription className="text-left">
                  Delete this category? This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="space-y-3">
                {pendingCategory ? (
                  <p className="text-base text-foreground">
                    <span className="font-medium">{displayCategoryName(pendingCategory.name)}</span>
                  </p>
                ) : null}
                {confirmError ? (
                  <p className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-sm text-destructive" role="alert">
                    {confirmError}
                  </p>
                ) : null}
              </DialogBody>
              <DialogFooter className="flex-col sm:flex-col">
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-12 w-full sm:min-h-11 sm:flex-1"
                    disabled={deletePending}
                    onClick={() => {
                      setStep("list");
                      setPendingCategory(null);
                      setConfirmError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="min-h-12 w-full font-semibold sm:min-h-11 sm:flex-1"
                    disabled={deletePending || !pendingCategory}
                    onClick={() => void handleConfirmDelete()}
                  >
                    {deletePending ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Deleting…
                      </>
                    ) : (
                      "Delete"
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

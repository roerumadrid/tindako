"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createCategory, createProduct } from "@/lib/supabase/mutations";
import { emitTindakoDataRefresh, TINDAKO_DATA_EVENT } from "@/lib/refresh-events";
import { FEEDBACK_AUTO_HIDE_MS, useAutoDismissString, useAutoDismissTrue } from "@/hooks/use-auto-dismiss";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { Category } from "@/types/database";

const inputClass = "min-h-11 w-full rounded-xl text-base";

/** `select` value that opens the “new category” dialog instead of selecting a category. */
const ADD_CATEGORY_SELECT_VALUE = "__add_category__";

const selectClass = cn(
  "min-h-12 w-full cursor-pointer appearance-none rounded-xl border border-input bg-transparent px-3 py-2 pr-10 text-base text-foreground shadow-sm transition-colors outline-none",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "dark:bg-input/30"
);

type Props = {
  /** Renders without outer card chrome; use inside inventory “Add product” dialog. */
  embeddedInModal?: boolean;
  /** With `embeddedInModal`, shows Cancel to close the dialog without saving. */
  onRequestClose?: () => void;
};

export function AddProductForm({ embeddedInModal = false, onRequestClose }: Props) {
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addCategoryError, setAddCategoryError] = useState<string | null>(null);
  const [addCategoryPending, setAddCategoryPending] = useState(false);

  useAutoDismissString(error, () => setError(null), FEEDBACK_AUTO_HIDE_MS);
  useAutoDismissTrue(success, () => setSuccess(false), FEEDBACK_AUTO_HIDE_MS);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    const supabase = createClient();
    const { data, error: qErr } = await supabase.from("categories").select("id,name,created_at").order("name");
    if (qErr) {
      setCategories([]);
      setCategoriesError(qErr.message);
    } else {
      setCategories(
        (data ?? []).map((row) => ({
          id: String((row as { id: unknown }).id),
          name: String((row as { name: unknown }).name),
          created_at: String((row as { created_at?: unknown }).created_at ?? ""),
        }))
      );
    }
    setCategoriesLoading(false);
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const onRefresh = () => void loadCategories();
    window.addEventListener(TINDAKO_DATA_EVENT, onRefresh);
    return () => window.removeEventListener(TINDAKO_DATA_EVENT, onRefresh);
  }, [loadCategories]);

  useEffect(() => {
    setSelectedCategoryId("");
  }, [formKey]);

  const selectedCategoryName = useMemo(() => {
    if (!selectedCategoryId) return "";
    return categories.find((c) => c.id === selectedCategoryId)?.name ?? "";
  }, [categories, selectedCategoryId]);

  function clearFeedback() {
    setError(null);
    setSuccess(false);
  }

  function handleAddCategoryDialogOpen(next: boolean) {
    setAddCategoryOpen(next);
    if (!next) {
      setNewCategoryName("");
      setAddCategoryError(null);
    }
  }

  async function submitNewCategory() {
    setAddCategoryError(null);
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setAddCategoryError("Enter a category name.");
      return;
    }
    setAddCategoryPending(true);
    try {
      const out = await createCategory(trimmed);
      if (out.error) {
        setAddCategoryError(out.error);
        return;
      }
      emitTindakoDataRefresh();
      await loadCategories();
      if (out.category) setSelectedCategoryId(out.category.id);
      handleAddCategoryDialogOpen(false);
    } finally {
      setAddCategoryPending(false);
    }
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
    <>
    <Card
      className={cn(
        "border shadow-sm",
        embeddedInModal && "gap-0 border-0 bg-transparent py-0 shadow-none ring-0"
      )}
    >
      {!embeddedInModal ? (
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Add product</CardTitle>
          <CardDescription>Fill in the details below. Everything saves to your inventory.</CardDescription>
        </CardHeader>
      ) : null}

      <form key={formKey} onSubmit={onSubmit} onInput={clearFeedback}>
        <CardContent className={cn("space-y-6", embeddedInModal && "px-0 pt-0")}>
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
            <Label htmlFor="add-category-id">Category</Label>
            <input type="hidden" name="category" value={selectedCategoryName} readOnly aria-hidden />
            {categoriesError ? (
              <p className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-sm text-destructive" role="alert">
                {categoriesError}{" "}
                <button
                  type="button"
                  className="font-semibold underline underline-offset-2"
                  onClick={() => void loadCategories()}
                >
                  Retry
                </button>
              </p>
            ) : null}
            <div className="relative">
              <select
                id="add-category-id"
                name="category_id"
                className={selectClass}
                value={selectedCategoryId}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === ADD_CATEGORY_SELECT_VALUE) {
                    handleAddCategoryDialogOpen(true);
                    return;
                  }
                  clearFeedback();
                  setSelectedCategoryId(v);
                }}
                disabled={categoriesLoading}
                aria-busy={categoriesLoading}
                aria-label="Product category"
              >
                <option value="">{categoriesLoading ? "Loading categories…" : "No category"}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value={ADD_CATEGORY_SELECT_VALUE}>+ Add category</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
            </div>
            <p className="text-xs text-muted-foreground">Pick a category or add a new one.</p>
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

        <CardFooter
          className={cn(
            "flex-col gap-3 sm:flex-row",
            embeddedInModal && onRequestClose && "sm:justify-end",
            embeddedInModal && "border-0 px-0 pb-0 pt-2"
          )}
        >
          {embeddedInModal && onRequestClose ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-12 w-full sm:min-h-11 sm:w-auto"
              disabled={pending || categoriesLoading}
              onClick={onRequestClose}
            >
              Cancel
            </Button>
          ) : null}
          <Button
            type="submit"
            size="lg"
            className={cn(
              "min-h-12 w-full font-semibold sm:min-h-11",
              embeddedInModal && onRequestClose ? "sm:w-auto" : null
            )}
            disabled={pending || categoriesLoading}
          >
            {pending ? "Saving…" : "Save product"}
          </Button>
        </CardFooter>
      </form>
    </Card>

    <Dialog open={addCategoryOpen} onOpenChange={handleAddCategoryDialogOpen}>
      <DialogContent variant="stacked" className="w-[calc(100%-1.5rem)] max-w-md sm:max-w-md">
        <DialogHeader className="border-b border-border/60 px-4 pt-4 pr-12 pb-3 sm:px-6 sm:pr-14">
          <DialogTitle>New category</DialogTitle>
          <DialogDescription className="text-left">Name is checked so duplicates are not added (ignores letter case).</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {addCategoryError ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-sm text-destructive" role="alert">
              {addCategoryError}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="new-category-name" className="text-base font-medium">
              Category name
            </Label>
            <Input
              id="new-category-name"
              type="text"
              autoComplete="off"
              placeholder="e.g. Snacks"
              value={newCategoryName}
              onValueChange={(v) => {
                setAddCategoryError(null);
                setNewCategoryName(v);
              }}
              className="min-h-12 rounded-xl text-base"
              disabled={addCategoryPending}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="min-h-12 w-full sm:min-h-11 sm:flex-1"
            disabled={addCategoryPending}
            onClick={() => handleAddCategoryDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="min-h-12 w-full font-semibold sm:min-h-11 sm:flex-1"
            disabled={addCategoryPending}
            onClick={() => void submitNewCategory()}
          >
            {addCategoryPending ? "Saving…" : "Save category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

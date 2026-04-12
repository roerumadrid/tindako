"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { useAutoDismissString } from "@/hooks/use-auto-dismiss";
import { emitTindakoDataRefresh, TINDAKO_DATA_EVENT } from "@/lib/refresh-events";
import { createCategory, updateProduct } from "@/lib/supabase/mutations";
import { createClient } from "@/lib/supabase";
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
import type { Category, Product } from "@/types/database";

function fieldClass() {
  return "min-h-11 w-full rounded-xl text-base";
}

const ADD_CATEGORY_SELECT_VALUE = "__add_category__";

const selectClass = cn(
  "min-h-12 w-full cursor-pointer appearance-none rounded-xl border border-input bg-transparent px-3 py-2 pr-10 text-base text-foreground shadow-sm transition-colors outline-none",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "dark:bg-input/30"
);

function resolveInitialCategoryId(product: Product, categories: Category[]): string {
  if (product.category_id && categories.some((c) => c.id === product.category_id)) {
    return product.category_id;
  }
  const t = (product.category_display || product.category).trim().toLowerCase();
  if (t) {
    const m = categories.find((c) => c.name.trim().toLowerCase() === t);
    if (m) return m.id;
  }
  return "";
}

type Props = { product: Product };

export function ProductDialog({ product }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const categorySeedDoneRef = useRef(false);

  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addCategoryError, setAddCategoryError] = useState<string | null>(null);
  const [addCategoryPending, setAddCategoryPending] = useState(false);

  useAutoDismissString(error, () => setError(null));

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
    if (!open) {
      categorySeedDoneRef.current = false;
      return;
    }
    void loadCategories();
  }, [open, loadCategories]);

  useEffect(() => {
    const onRefresh = () => void loadCategories();
    window.addEventListener(TINDAKO_DATA_EVENT, onRefresh);
    return () => window.removeEventListener(TINDAKO_DATA_EVENT, onRefresh);
  }, [loadCategories]);

  useEffect(() => {
    if (!open || categoriesLoading) return;
    if (!categorySeedDoneRef.current) {
      setSelectedCategoryId(resolveInitialCategoryId(product, categories));
      categorySeedDoneRef.current = true;
    }
  }, [open, categoriesLoading, categories, product]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setError(null);
    if (!next) {
      setAddCategoryOpen(false);
      setNewCategoryName("");
      setAddCategoryError(null);
    }
  }

  function handleDialogOpenChange(next: boolean, details: { reason: string; cancel: () => void }) {
    if (!next && details.reason === "escape-key") {
      details.cancel();
      return;
    }
    handleOpenChange(next);
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

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("id", product.id);
    fd.set("category_id", selectedCategoryId);
    startTransition(async () => {
      const result = await updateProduct(fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      handleOpenChange(false);
      emitTindakoDataRefresh();
    });
  }

  return (
    <>
      <Dialog open={open} disablePointerDismissal onOpenChange={handleDialogOpenChange}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9 shrink-0"
          onClick={() => {
            setError(null);
            handleOpenChange(true);
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
                    <Label htmlFor="p-category-id">Category</Label>
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
                        id="p-category-id"
                        name="category_id"
                        className={selectClass}
                        value={selectedCategoryId}
                        onChange={(e) => {
                          setError(null);
                          const v = e.target.value;
                          if (v === ADD_CATEGORY_SELECT_VALUE) {
                            handleAddCategoryDialogOpen(true);
                            return;
                          }
                          setSelectedCategoryId(v);
                        }}
                        disabled={categoriesLoading || pending}
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
              <Button
                type="button"
                variant="outline"
                className="min-h-12 w-full sm:min-h-11 sm:w-auto"
                disabled={pending || categoriesLoading}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="min-h-12 w-full font-semibold sm:min-h-11 sm:w-auto" disabled={pending || categoriesLoading}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
              <Label htmlFor="edit-new-category-name" className="text-base font-medium">
                Category name
              </Label>
              <Input
                id="edit-new-category-name"
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

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { useAutoDismissString } from "@/hooks/use-auto-dismiss";
import { emitTindakoDataRefresh, TINDAKO_DATA_EVENT } from "@/lib/refresh-events";
import { parseMoneyInput } from "@/lib/money";
import { isStandardUnitSelectValue, storedUnitToSelectValue, UNIT_OPTIONS } from "@/lib/product-units";
import { displayCategoryName, normalizeCategoryName } from "@/lib/category-names";
import { ManageCategoriesDialog } from "@/components/inventory/manage-categories-dialog";
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
import { handleSuccess } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { Category, Product } from "@/types/database";

function fieldClass() {
  return "min-h-11 w-full rounded-xl text-base";
}

const ADD_CATEGORY_SELECT_VALUE = "__add_category__";

/** Normalize category / product FK ids for reliable `<select>` matching. */
function normalizeCategoryId(id: unknown): string {
  return String(id ?? "").trim();
}

function normalizeCategoryRow(row: Record<string, unknown>): Category {
  return {
    id: normalizeCategoryId(row.id),
    name: String((row as { name: unknown }).name ?? "").trim(),
    created_at: String((row as { created_at?: unknown }).created_at ?? ""),
  };
}

/** Product FK as stored for edit form + resolver (always string, never `"undefined"`). */
function normalizedProductCategoryId(product: Product): string {
  if (product.category_id == null) return "";
  const s = String(product.category_id).trim();
  if (s === "" || s === "undefined" || s === "null") return "";
  return s;
}

const selectClass = cn(
  "min-h-12 w-full cursor-pointer appearance-none rounded-xl border border-input bg-transparent px-3 py-2 pr-10 text-base text-foreground shadow-sm transition-colors outline-none",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "dark:bg-input/30"
);

function resolveInitialCategoryId(product: Product, categories: Category[]): string {
  const normalizedPid = normalizedProductCategoryId(product);
  if (normalizedPid) {
    const pidLower = normalizedPid.toLowerCase();
    const byId = categories.find((c) => normalizeCategoryId(c.id).toLowerCase() === pidLower);
    if (byId) return normalizeCategoryId(byId.id);
  }
  const t = (product.category_display || product.category).trim().toLowerCase();
  if (t) {
    const m = categories.find((c) => normalizeCategoryName(c.name) === t);
    if (m) return normalizeCategoryId(m.id);
  }
  return "";
}

type EditFormSnapshot = {
  name: string;
  categoryId: string;
  unit: string;
  costPrice: string;
  sellingPrice: string;
  stockQty: string;
  reorderLevel: string;
};

/** Baseline row; pass `resolvedCategoryId` from `resolveInitialCategoryId` (categories must be loaded). */
function snapshotFromProduct(product: Product, resolvedCategoryId: string): EditFormSnapshot {
  return {
    name: product.name,
    categoryId: resolvedCategoryId,
    unit: storedUnitToSelectValue(product.unit) || "pc",
    costPrice: String(product.cost_price),
    sellingPrice: String(product.selling_price),
    stockQty: String(product.stock_qty),
    reorderLevel: String(product.reorder_level),
  };
}

function parseStockInt(value: string): number {
  const n = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function snapshotsDirty(a: EditFormSnapshot, b: EditFormSnapshot): boolean {
  return (
    a.name.trim() !== b.name.trim() ||
    a.categoryId !== b.categoryId ||
    a.unit.trim() !== b.unit.trim() ||
    parseMoneyInput(a.costPrice) !== parseMoneyInput(b.costPrice) ||
    parseMoneyInput(a.sellingPrice) !== parseMoneyInput(b.sellingPrice) ||
    parseStockInt(a.stockQty) !== parseStockInt(b.stockQty) ||
    parseStockInt(a.reorderLevel) !== parseStockInt(b.reorderLevel)
  );
}

type Props = { product: Product };

export function ProductDialog({ product }: Props) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;
  const productRef = useRef(product);
  productRef.current = product;

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(() => {
    if (!product) return "";
    return resolveInitialCategoryId(product, categories);
  });

  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addCategoryError, setAddCategoryError] = useState<string | null>(null);
  const [addCategoryPending, setAddCategoryPending] = useState(false);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [unit, setUnit] = useState(() => storedUnitToSelectValue(product.unit) || "pc");

  const [name, setName] = useState(product.name);
  const [costPrice, setCostPrice] = useState(String(product.cost_price));
  const [sellingPrice, setSellingPrice] = useState(String(product.selling_price));
  const [stockQty, setStockQty] = useState(String(product.stock_qty));
  const [reorderLevel, setReorderLevel] = useState(String(product.reorder_level));
  const [initialSnapshot, setInitialSnapshot] = useState<EditFormSnapshot | null>(null);

  useAutoDismissString(error, () => setError(null));

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    const supabase = createClient();
    const { data, error: qErr } = await supabase.from("categories").select("id,name,created_at").order("name");
    if (qErr) {
      setCategories([]);
      setCategoriesError(qErr.message);
      if (openRef.current) {
        setSelectedCategoryId(resolveInitialCategoryId(productRef.current, []));
      }
    } else {
      const mapped = (data ?? []).map((row) => normalizeCategoryRow(row as Record<string, unknown>));
      setCategories(mapped);
      if (openRef.current) {
        setSelectedCategoryId(resolveInitialCategoryId(productRef.current, mapped));
      }
    }
    setCategoriesLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadCategories();
  }, [open, loadCategories]);

  useEffect(() => {
    if (!open) {
      setInitialSnapshot(null);
      setSelectedCategoryId("");
    }
  }, [open]);

  useEffect(() => {
    setInitialSnapshot(null);
    if (!product) return;
    setSelectedCategoryId(resolveInitialCategoryId(product, categories));
    // Intentionally product.id only: category refresh when categories load runs in loadCategories.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- spec: sync on product row change, not categoriesLoading
  }, [product.id]);

  useEffect(() => {
    const onRefresh = () => void loadCategories();
    window.addEventListener(TINDAKO_DATA_EVENT, onRefresh);
    return () => window.removeEventListener(TINDAKO_DATA_EVENT, onRefresh);
  }, [loadCategories]);

  useEffect(() => {
    if (!open) return;
    if (!product) return;
    if (categoriesLoading) return;
    if (initialSnapshot) return;

    const resolved = resolveInitialCategoryId(product, categories);
    const snap = snapshotFromProduct(product, resolved);

    setName(snap.name);
    setUnit(snap.unit);
    setCostPrice(snap.costPrice);
    setSellingPrice(snap.sellingPrice);
    setStockQty(snap.stockQty);
    setReorderLevel(snap.reorderLevel);
    setInitialSnapshot(snap);
  }, [open, product, categoriesLoading, categories, initialSnapshot]);

  const currentSnapshot = useMemo(
    (): EditFormSnapshot => ({
      name,
      categoryId: selectedCategoryId,
      unit,
      costPrice,
      sellingPrice,
      stockQty,
      reorderLevel,
    }),
    [name, selectedCategoryId, unit, costPrice, sellingPrice, stockQty, reorderLevel]
  );

  const isDirty =
    initialSnapshot !== null && snapshotsDirty(currentSnapshot, initialSnapshot);

  const isReady =
    open && Boolean(product) && !categoriesLoading && initialSnapshot !== null;

  const unitSelectShowsLegacy = useMemo(() => !isStandardUnitSelectValue(unit), [unit]);

  function handleOpenChange(next: boolean) {
    setError(null);
    if (next) {
      setSelectedCategoryId(resolveInitialCategoryId(product, categories));
    }
    setOpen(next);
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
    const normalizedName = normalizeCategoryName(newCategoryName);
    if (!normalizedName) {
      setAddCategoryError("Enter a category name.");
      return;
    }
    const localMatch = categories.find((c) => normalizeCategoryName(c.name) === normalizedName);
    if (localMatch) {
      setSelectedCategoryId(normalizeCategoryId(localMatch.id));
      handleAddCategoryDialogOpen(false);
      return;
    }
    setAddCategoryPending(true);
    try {
      const out = await createCategory(normalizedName);
      if (out.error) {
        setAddCategoryError(out.error);
        return;
      }
      emitTindakoDataRefresh();
      await loadCategories();
      if (out.category) setSelectedCategoryId(normalizeCategoryId(out.category.id));
      handleSuccess("Category added successfully", {
        description: "You can now use it for products",
        closeModal: () => handleAddCategoryDialogOpen(false),
        shouldCloseOnSuccess: true,
      });
    } finally {
      setAddCategoryPending(false);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!isReady) return;
    if (!isDirty) return;

    const resolvedUnit = unit.trim() || "pc";
    const fd = new FormData();
    fd.set("id", product.id);
    fd.set("name", name.trim());
    fd.set("category_id", selectedCategoryId);
    fd.set("cost_price", costPrice);
    fd.set("selling_price", sellingPrice);
    fd.set("stock_qty", stockQty);
    fd.set("reorder_level", reorderLevel);
    fd.set("unit", resolvedUnit);
    startTransition(async () => {
      const result = await updateProduct(fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      emitTindakoDataRefresh();
      handleSuccess("Product updated", {
        closeModal: () => handleOpenChange(false),
        shouldCloseOnSuccess: true,
      });
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
        <DialogContent
          dimmed={addCategoryOpen || manageCategoriesOpen}
          variant="stacked"
          className="w-[calc(100%-1.5rem)] max-w-lg sm:max-w-lg"
        >
          <form onSubmit={onSubmit} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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

              {categoriesError ? (
                <p
                  className="mb-4 rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
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

              {!isReady ? (
                <div className="p-6 text-sm text-muted-foreground" aria-live="polite" aria-busy="true">
                  Loading product…
                </div>
              ) : (
                <div className="grid gap-5 pb-2">
                <section className="space-y-3">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Basics</p>
                  <div className="space-y-2">
                    <Label htmlFor="p-name">Product name</Label>
                    <Input
                      id="p-name"
                      required
                      autoComplete="off"
                      className={fieldClass()}
                      value={name}
                      onValueChange={(v) => {
                        setError(null);
                        setName(v);
                      }}
                      placeholder="e.g. Coke 500ml"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p-category-id">Category</Label>
                    <div className="relative">
                      <select
                        id="p-category-id"
                        className={selectClass}
                        value={selectedCategoryId}
                        onChange={(e) => {
                          setError(null);
                          const v = e.target.value;
                          if (v === ADD_CATEGORY_SELECT_VALUE) {
                            handleAddCategoryDialogOpen(true);
                            return;
                          }
                          setSelectedCategoryId(normalizeCategoryId(v));
                        }}
                        disabled={categoriesLoading || pending}
                        aria-busy={categoriesLoading}
                        aria-label="Product category"
                      >
                        <option value="">{categoriesLoading ? "Loading categories…" : "No category"}</option>
                        {categories.map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {displayCategoryName(c.name)}
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
                    <ManageCategoriesDialog
                      categories={categories}
                      disabled={categoriesLoading || pending}
                      onRefreshCategories={loadCategories}
                      onManageDialogOpenChange={setManageCategoriesOpen}
                      onCategoryDeleted={(deletedId) => {
                        if (selectedCategoryId === deletedId) setSelectedCategoryId("");
                      }}
                    />
                  </div>
                  <div className="mb-4 max-w-xs space-y-1.5 sm:max-w-sm">
                    <Label htmlFor="p-unit-select">Unit</Label>
                    <div className="relative">
                      <select
                        id="p-unit-select"
                        className={selectClass}
                        value={unit}
                        onChange={(e) => {
                          setError(null);
                          setUnit(e.target.value);
                        }}
                        disabled={pending || categoriesLoading}
                        aria-label="Product unit"
                      >
                        {UNIT_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                        {unitSelectShowsLegacy ? (
                          <option value={unit}>
                            {unit} (current)
                          </option>
                        ) : null}
                      </select>
                      <ChevronDown
                        className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                    </div>
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
                        type="text"
                        inputMode="decimal"
                        className={fieldClass()}
                        value={costPrice}
                        onValueChange={(v) => {
                          setError(null);
                          setCostPrice(v);
                        }}
                        placeholder="0.00"
                      />
                      <p className="text-xs text-muted-foreground">What you pay per unit.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p-sell">Selling price</Label>
                      <Input
                        id="p-sell"
                        type="text"
                        inputMode="decimal"
                        required
                        className={fieldClass()}
                        value={sellingPrice}
                        onValueChange={(v) => {
                          setError(null);
                          setSellingPrice(v);
                        }}
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
                        type="number"
                        min={0}
                        required
                        className={fieldClass()}
                        value={stockQty}
                        onValueChange={(v) => {
                          setError(null);
                          setStockQty(v);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p-reorder">Reorder level</Label>
                      <Input
                        id="p-reorder"
                        type="number"
                        min={0}
                        required
                        className={fieldClass()}
                        value={reorderLevel}
                        onValueChange={(v) => {
                          setError(null);
                          setReorderLevel(v);
                        }}
                      />
                      <p className="text-xs text-muted-foreground">Yellow alert at or below this. Red at zero.</p>
                    </div>
                  </div>
                </section>
                </div>
              )}
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
              <Button
                type="submit"
                className={cn(
                  "min-h-12 w-full font-semibold sm:min-h-11 sm:w-auto",
                  (!isReady || !isDirty || pending || categoriesLoading) && "cursor-not-allowed opacity-50"
                )}
                disabled={!isReady || !isDirty || pending || categoriesLoading}
              >
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={addCategoryOpen} onOpenChange={handleAddCategoryDialogOpen}>
        <DialogContent depth={2} variant="stacked" className="w-[calc(100%-1.5rem)] max-w-md sm:max-w-md">
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

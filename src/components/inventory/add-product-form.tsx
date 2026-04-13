"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { displayCategoryName, normalizeCategoryName } from "@/lib/category-names";
import { ManageCategoriesDialog } from "@/components/inventory/manage-categories-dialog";
import { createCategory, createProduct } from "@/lib/supabase/mutations";
import { emitTindakoDataRefresh, TINDAKO_DATA_EVENT } from "@/lib/refresh-events";
import { FEEDBACK_AUTO_HIDE_MS, useAutoDismissString } from "@/hooks/use-auto-dismiss";
import { parseMoneyInput } from "@/lib/money";
import { UNIT_OPTIONS } from "@/lib/product-units";
import { handleSuccess } from "@/components/ui/use-toast";
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
  /** When a nested dialog (new category or manage categories) opens or closes. */
  onNestedModalOpenChange?: (open: boolean) => void;
  /** When the “New category” nested dialog opens or closes (for dimming the Add Product shell). */
  onAddCategoryOpenChange?: (open: boolean) => void;
};

export function AddProductForm({
  embeddedInModal = false,
  onRequestClose,
  onNestedModalOpenChange,
  onAddCategoryOpenChange,
}: Props) {
  const topRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addCategoryError, setAddCategoryError] = useState<string | null>(null);
  const [addCategoryPending, setAddCategoryPending] = useState(false);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  /** Intentional unit choice (no default preset). */
  const [unit, setUnit] = useState("");
  const [name, setName] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [stockQty, setStockQty] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("5");

  useAutoDismissString(error, () => setError(null), FEEDBACK_AUTO_HIDE_MS);

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
    onNestedModalOpenChange?.(addCategoryOpen || manageCategoriesOpen);
  }, [addCategoryOpen, manageCategoriesOpen, onNestedModalOpenChange]);

  useEffect(() => {
    onAddCategoryOpenChange?.(addCategoryOpen);
  }, [addCategoryOpen, onAddCategoryOpenChange]);

  useEffect(() => {
    setName("");
    setCostPrice("");
    setSellingPrice("");
    setStockQty("0");
    setReorderLevel("5");
    setSelectedCategoryId("");
    setUnit("");
  }, [formKey]);

  const categoryId = selectedCategoryId.trim();
  const costPriceNum = parseMoneyInput(costPrice);
  const sellingPriceNum = parseMoneyInput(sellingPrice);
  const stockQtyNum = Number.parseInt(String(stockQty).trim(), 10);
  const reorderLevelNum = Number.parseInt(String(reorderLevel).trim(), 10);
  const costFilled = costPrice.trim() !== "";
  const stockFilled = stockQty.trim() !== "";
  const reorderFilled = reorderLevel.trim() !== "";

  const isFormValid =
    name.trim() !== "" &&
    Boolean(categoryId) &&
    sellingPriceNum > 0 &&
    costFilled &&
    costPriceNum >= 0 &&
    stockFilled &&
    Number.isFinite(stockQtyNum) &&
    stockQtyNum >= 0 &&
    reorderFilled &&
    Number.isFinite(reorderLevelNum) &&
    reorderLevelNum >= 0 &&
    unit !== "";

  const selectedCategoryName = useMemo(() => {
    if (!selectedCategoryId) return "";
    return categories.find((c) => c.id === selectedCategoryId)?.name ?? "";
  }, [categories, selectedCategoryId]);

  function clearFeedback() {
    setError(null);
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
      setSelectedCategoryId(localMatch.id);
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
      if (out.category) setSelectedCategoryId(out.category.id);
      handleSuccess("Category added successfully", {
        description: "You can now use it for products",
        closeModal: () => handleAddCategoryDialogOpen(false),
        shouldCloseOnSuccess: true,
      });
    } finally {
      setAddCategoryPending(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!isFormValid) return;
    const fd = new FormData(e.currentTarget);
    fd.set("unit", unit);

    setPending(true);
    try {
      const result = await createProduct(fd);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if (!("data" in result) || !result.data) {
        setError("Product insert did not return a row.");
        return;
      }

      emitTindakoDataRefresh();
      setError(null);
      setFormKey((k) => k + 1);
      handleSuccess("Product added successfully", {
        closeModal: onRequestClose,
        shouldCloseOnSuccess: false,
        description: "Item saved to inventory",
      });

      requestAnimationFrame(() => {
        nameInputRef.current?.focus();
      });
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
        <CardContent className={cn(embeddedInModal && "px-0 pt-0")}>
          <div ref={topRef} className="space-y-6">
          {error ? (
            <p
              className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5 text-sm leading-snug text-destructive dark:border-destructive/40"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="add-name" className="block pt-[2px]">
              Product name
            </Label>
            <Input
              ref={nameInputRef}
              id="add-name"
              name="name"
              autoComplete="off"
              className={inputClass}
              placeholder="e.g. Lucky Me Pancit Canton"
              value={name}
              onValueChange={(v) => {
                clearFeedback();
                setName(v);
              }}
              aria-invalid={name.trim() === ""}
              aria-required
            />
            {name.trim() === "" ? (
              <p className="text-xs text-destructive" role="status">
                Required
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-category-id">Category</Label>
            <input type="hidden" name="category" value={selectedCategoryName} readOnly aria-hidden />
            {selectedCategoryId.trim() === "" ? (
              <p className="text-xs text-destructive" role="status">
                Choose a category
              </p>
            ) : null}
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
                value={costPrice}
                onValueChange={(v) => {
                  clearFeedback();
                  setCostPrice(v);
                }}
                aria-invalid={!costFilled}
                aria-required
              />
              {!costFilled ? (
                <p className="text-xs text-destructive" role="status">
                  Required
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">What you paid per unit.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-sell">Selling price (₱)</Label>
              <Input
                id="add-sell"
                name="selling_price"
                type="text"
                inputMode="decimal"
                className={inputClass}
                placeholder="0.00"
                value={sellingPrice}
                onValueChange={(v) => {
                  clearFeedback();
                  setSellingPrice(v);
                }}
                aria-invalid={sellingPriceNum <= 0}
                aria-required
              />
              {sellingPriceNum <= 0 ? (
                <p className="text-xs text-destructive" role="status">
                  Must be greater than 0
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Price at checkout (POS).</p>
              )}
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
                className={inputClass}
                value={stockQty}
                onValueChange={(v) => {
                  clearFeedback();
                  setStockQty(v);
                }}
                aria-invalid={!Number.isFinite(stockQtyNum) || stockQtyNum < 0}
                aria-required
              />
              {!stockFilled ? (
                <p className="text-xs text-destructive" role="status">
                  Required
                </p>
              ) : !Number.isFinite(stockQtyNum) || stockQtyNum < 0 ? (
                <p className="text-xs text-destructive" role="status">
                  Must be zero or more
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-reorder">Reorder level</Label>
              <Input
                id="add-reorder"
                name="reorder_level"
                type="number"
                min={0}
                className={inputClass}
                value={reorderLevel}
                onValueChange={(v) => {
                  clearFeedback();
                  setReorderLevel(v);
                }}
                aria-invalid={!Number.isFinite(reorderLevelNum) || reorderLevelNum < 0}
                aria-required
              />
              {!reorderFilled ? (
                <p className="text-xs text-destructive" role="status">
                  Required
                </p>
              ) : !Number.isFinite(reorderLevelNum) || reorderLevelNum < 0 ? (
                <p className="text-xs text-destructive" role="status">
                  Must be zero or more
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Warn when stock is at or below this.</p>
              )}
            </div>
          </div>

          <div className="mb-4 max-w-xs space-y-1.5 sm:max-w-sm">
            <Label htmlFor="add-unit-select">Unit</Label>
            <div className="relative">
              <select
                id="add-unit-select"
                name="unit"
                className={selectClass}
                value={unit}
                onChange={(e) => {
                  clearFeedback();
                  setUnit(e.target.value);
                }}
                aria-label="Product unit"
                aria-invalid={unit === ""}
                aria-required
              >
                <option value="" disabled>
                  Select unit
                </option>
                {UNIT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
            </div>
            {unit === "" ? (
              <p className="text-xs text-destructive" role="status">
                Please select a unit
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">How you count this item (piece, weight, volume, etc.).</p>
            )}
          </div>
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
              "min-h-12 w-full font-semibold transition-opacity sm:min-h-11",
              embeddedInModal && onRequestClose ? "sm:w-auto" : null,
              !isFormValid ? "cursor-not-allowed opacity-60" : "cursor-pointer opacity-100"
            )}
            disabled={!isFormValid || pending || categoriesLoading}
          >
            {pending ? "Saving..." : "Save product"}
          </Button>
        </CardFooter>
      </form>
    </Card>

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

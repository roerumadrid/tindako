"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FEEDBACK_AUTO_HIDE_MS, useAutoDismissString } from "@/hooks/use-auto-dismiss";
import { emitTindakoDataRefresh } from "@/lib/refresh-events";
import { completeSale } from "@/lib/supabase/mutations";
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
import { Separator } from "@/components/ui/separator";
import { formatPeso } from "@/lib/money";
import { filterProductsByNameSearch } from "@/lib/product";
import { getStockStatus } from "@/lib/stock";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/database";

type Cart = Record<string, number>;

type Props = {
  products: Product[];
  /** Filters section 1 only; cart and checkout still use full `products`. */
  productSearchQuery?: string;
  loading?: boolean;
};

export function PosCheckout({ products, productSearchQuery = "", loading = false }: Props) {
  const router = useRouter();
  const [cart, setCart] = useState<Cart>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qtyInput, setQtyInput] = useState("1");
  const [message, setMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useAutoDismissString(message, () => setMessage(null), FEEDBACK_AUTO_HIDE_MS);
  useAutoDismissString(successMessage, () => setSuccessMessage(null), FEEDBACK_AUTO_HIDE_MS);

  function clearPosFeedback() {
    setMessage(null);
    setSuccessMessage(null);
  }

  const selected = useMemo(() => products.find((p) => p.id === selectedId) ?? null, [products, selectedId]);

  const lines = useMemo(() => {
    return products
      .map((p) => {
        const qty = cart[p.id] ?? 0;
        return qty > 0 ? { product: p, qty } : null;
      })
      .filter(Boolean) as { product: Product; qty: number }[];
  }, [cart, products]);

  const total = useMemo(() => {
    return lines.reduce((sum, { product, qty }) => sum + product.selling_price * qty, 0);
  }, [lines]);

  const listProducts = useMemo(
    () => filterProductsByNameSearch(products, productSearchQuery),
    [products, productSearchQuery]
  );

  /** Quick sell: each tap adds 1 to cart (while stock allows). Keeps product selected for optional bulk add. */
  function quickAddFromProductTap(p: Product) {
    if (p.stock_qty <= 0) return;
    clearPosFeedback();
    setSelectedId(p.id);
    const current = cart[p.id] ?? 0;
    if (current >= p.stock_qty) {
      setMessage(`No more stock for ${p.name}.`);
      setQtyInput("1");
      return;
    }
    setCart((c) => ({ ...c, [p.id]: current + 1 }));
    setQtyInput("1");
  }

  function addToCartFromSelection() {
    clearPosFeedback();
    if (!selected) {
      setMessage("Tap a product in the list first, or add from the list with one tap each.");
      return;
    }
    const parsed = Number.parseInt(qtyInput, 10);
    const want = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    const current = cart[selected.id] ?? 0;
    const maxAdd = selected.stock_qty - current;
    if (maxAdd <= 0) {
      setMessage(`No more stock for ${selected.name}.`);
      return;
    }
    const add = Math.min(want, maxAdd);
    setCart((c) => ({ ...c, [selected.id]: current + add }));
    setQtyInput(String(add));
  }

  function removeOne(productId: string) {
    clearPosFeedback();
    setCart((c) => {
      const next = { ...c };
      const q = (next[productId] ?? 0) - 1;
      if (q <= 0) delete next[productId];
      else next[productId] = q;
      return next;
    });
  }

  /** Remove this product from the cart entirely. */
  function removeLine(productId: string) {
    clearPosFeedback();
    setCart((c) => {
      const next = { ...c };
      delete next[productId];
      return next;
    });
    setSelectedId((id) => (id === productId ? null : id));
  }

  function addOne(p: Product) {
    clearPosFeedback();
    const current = cart[p.id] ?? 0;
    if (current >= p.stock_qty) {
      setMessage(`No more stock for ${p.name}.`);
      return;
    }
    setCart((c) => ({ ...c, [p.id]: current + 1 }));
  }

  function clearCart() {
    clearPosFeedback();
    setCart({});
  }

  function openCheckoutConfirm() {
    console.log("[POS] Complete sale — open confirm", { lineCount: lines.length, lines });
    clearPosFeedback();
    if (!lines.length) {
      setMessage("Tap products above to add at least one item to the cart.");
      return;
    }
    setConfirmOpen(true);
  }

  function handleConfirmDialogOpen(next: boolean) {
    if (!next && pending) return;
    setConfirmOpen(next);
  }

  async function confirmCompleteSale() {
    if (!lines.length) {
      setConfirmOpen(false);
      return;
    }

    const payload = lines.map(({ product, qty }) => ({
      product_id: product.id,
      qty,
      unit_price: product.selling_price,
    }));

    clearPosFeedback();
    setPending(true);
    try {
      console.log("[POS] awaiting completeSale(…)", payload);
      const result = await completeSale(payload);
      console.log("[POS] completeSale resolved", result);

      if (result.error) {
        setMessage(result.error);
        return;
      }

      const sid = result.saleId;
      const idNote =
        typeof sid === "string" && sid.length > 0 ? ` (ref ${sid.length > 8 ? `${sid.slice(0, 8)}…` : sid})` : "";
      setSuccessMessage(`Sale completed successfully.${idNote} Stock updated.`);
      setConfirmOpen(false);
      setCart({});
      setSelectedId(null);
      setQtyInput("1");
      emitTindakoDataRefresh();
      router.refresh();
    } catch (e) {
      console.error("[POS] completeSale rejected / threw", e);
      setMessage(e instanceof Error ? e.message : "Checkout failed unexpectedly.");
    } finally {
      setPending(false);
      console.log("[POS] checkout finished (pending cleared)");
    }
  }

  if (loading) {
    return (
      <p className="rounded-2xl border border-dashed border-border/60 bg-muted/25 px-4 py-16 text-center text-base text-muted-foreground shadow-sm">
        Loading products…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Dialog open={confirmOpen} onOpenChange={handleConfirmDialogOpen}>
        <DialogContent variant="stacked" showCloseButton={false} className="w-[calc(100%-1.5rem)] max-w-md sm:max-w-md">
          <DialogHeader className="border-b border-border/60 px-4 pt-4 pb-3 sm:px-6">
            <DialogTitle className="text-lg font-semibold">Confirm sale</DialogTitle>
            <DialogDescription className="text-left text-sm leading-relaxed">
              Review this sale before recording it. This cannot be undone in the app.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Items</p>
            <ul className="mt-2 space-y-2.5" aria-label="Sale line items">
              {lines.map(({ product, qty }) => (
                <li
                  key={product.id}
                  className="flex items-baseline justify-between gap-3 rounded-xl border border-border/50 bg-muted/35 px-3 py-2.5 text-sm"
                >
                  <span className="min-w-0 font-medium leading-snug text-foreground">{product.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    × <span className="font-semibold text-foreground">{qty}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-border/50 pt-4 text-base font-bold">
              <span className="text-muted-foreground">Total</span>
              <span className="tabular-nums text-foreground">{formatPeso(total)}</span>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-12 w-full sm:min-h-11 sm:flex-1"
              disabled={pending}
              onClick={() => handleConfirmDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-12 w-full text-base font-semibold sm:min-h-11 sm:flex-1"
              disabled={pending}
              onClick={() => void confirmCompleteSale()}
            >
              {pending ? "Saving…" : "Confirm sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {successMessage ? (
        <p
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-2.5 text-sm leading-snug font-medium text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/35 dark:text-emerald-100"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}
      {message ? (
        <p
          className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5 text-sm leading-snug text-destructive dark:border-destructive/40"
          role="alert"
        >
          {message}
        </p>
      ) : null}

      <section className="flex flex-col gap-3" aria-label="Products for sale">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">1. Products — tap to add 1</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Each tap adds <span className="font-medium text-foreground">one</span> to the cart. Tap again for more. Use section 2 if you need a bigger amount at once.
        </p>
        <ul className="flex flex-col gap-4">
          {products.length === 0 ? (
            <li className="rounded-2xl border border-dashed px-4 py-12 text-center text-base text-muted-foreground">
              No products yet. Add items in Inventory first.
            </li>
          ) : listProducts.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-border/60 bg-muted/25 px-4 py-12 text-center text-base text-muted-foreground shadow-sm">
              No products match your search.
            </li>
          ) : (
            listProducts.map((p) => {
              const status = getStockStatus(p);
              const disabled = p.stock_qty <= 0;
              const isSelected = p.id === selectedId;
              const inCart = cart[p.id] ?? 0;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => quickAddFromProductTap(p)}
                    className={cn(
                      "flex w-full min-h-[4.25rem] flex-col justify-center gap-1 rounded-2xl border-2 bg-card px-4 py-3 text-left shadow-sm transition-colors sm:min-h-[4.5rem] sm:flex-row sm:items-center sm:justify-between sm:gap-4",
                      disabled ? "cursor-not-allowed opacity-45" : "active:bg-muted/70",
                      isSelected ? "border-primary ring-2 ring-primary/30" : "border-transparent"
                    )}
                  >
                    <span className="text-lg font-semibold leading-tight">{p.name}</span>
                    <span className="flex shrink-0 flex-wrap items-center gap-2 text-base">
                      <span className="font-medium tabular-nums text-foreground">{formatPeso(p.selling_price)}</span>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-sm font-medium",
                          status === "out" && "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
                          status === "low" && "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
                          status === "ok" && "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                        )}
                      >
                        {p.stock_qty} left
                      </span>
                      {inCart > 0 ? (
                        <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums">
                          In cart: {inCart}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="flex flex-col gap-3" aria-label="Optional quantity">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">2. Add more (optional)</h2>
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-6">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Selected</p>
                <p className="mt-1 text-xl font-semibold leading-snug">{selected.name}</p>
                <p className="mt-1 text-base text-muted-foreground">
                  {formatPeso(selected.selling_price)} <span className="text-sm">per {selected.unit}</span>
                </p>
                {(cart[selected.id] ?? 0) > 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    In cart now: <span className="font-semibold tabular-nums text-foreground">{cart[selected.id]}</span>
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pos-qty" className="text-base">
                  How many to add?
                </Label>
                <Input
                  id="pos-qty"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={selected.stock_qty}
                  value={qtyInput}
                  onChange={(e) => {
                    clearPosFeedback();
                    setQtyInput(e.target.value);
                  }}
                  className="min-h-14 text-center text-2xl font-semibold tabular-nums"
                />
                <p className="text-sm text-muted-foreground">
                  In stock: <span className="font-medium text-foreground">{selected.stock_qty}</span>
                </p>
              </div>
              <Button type="button" size="lg" className="min-h-12 w-full text-base font-semibold sm:min-h-11 sm:text-lg" onClick={addToCartFromSelection}>
                Add to cart
              </Button>
            </div>
          ) : (
            <p className="text-center text-sm leading-relaxed text-muted-foreground">
              Tap a product above to select it, then set a quantity here if you want more than one at a time.
            </p>
          )}
        </div>
      </section>

      <section
        aria-label="Cart and checkout"
        className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
      >
        <div className="border-b border-border/50 px-5 py-4 sm:px-6">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">3. Cart</h2>
          <p className="mt-1 text-lg font-semibold text-foreground">Your cart</p>
        </div>
        <div className="space-y-3 px-5 py-5 sm:px-6">
          {lines.length === 0 ? (
            <p className="text-base text-muted-foreground">Cart is empty.</p>
          ) : (
            <ul className="space-y-4">
              {lines.map(({ product, qty }) => {
                const unitPrice = product.selling_price;
                const subtotal = unitPrice * qty;
                return (
                  <li
                    key={product.id}
                    className="flex flex-col gap-4 rounded-2xl border border-border/40 bg-muted/40 px-4 py-4 sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="text-lg font-semibold leading-snug">{product.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatPeso(unitPrice)} <span className="text-muted-foreground/80">×</span> {qty}{" "}
                        <span className="text-muted-foreground/80">=</span>{" "}
                        <span className="font-semibold tabular-nums text-foreground">{formatPeso(subtotal)}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-14 min-h-14 min-w-14 shrink-0 rounded-xl border-2 px-0 text-2xl font-semibold leading-none"
                        onClick={() => removeOne(product.id)}
                        aria-label={`Decrease quantity of ${product.name}`}
                      >
                        −
                      </Button>
                      <span className="min-w-[3rem] text-center text-2xl font-bold tabular-nums text-foreground" aria-live="polite">
                        {qty}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-14 min-h-14 min-w-14 shrink-0 rounded-xl border-2 px-0 text-2xl font-semibold leading-none"
                        onClick={() => addOne(product)}
                        disabled={qty >= product.stock_qty}
                        aria-label={`Increase quantity of ${product.name}`}
                      >
                        +
                      </Button>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-12 w-full border-destructive/40 text-sm font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removeLine(product.id)}
                      aria-label={`Remove ${product.name} from cart`}
                    >
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {lines.length > 0 ? (
          <>
            <Separator />
            <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
              <div className="flex items-baseline justify-between gap-4 text-xl font-bold" aria-live="polite" aria-atomic="true">
                <span className="text-muted-foreground">Total</span>
                <span className="tabular-nums text-foreground">{formatPeso(total)}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button type="button" variant="outline" size="lg" className="min-h-12 w-full sm:min-h-11" onClick={clearCart} disabled={pending}>
                  Clear cart
                </Button>
                <Button
                  type="button"
                  size="lg"
                  className="min-h-12 w-full text-base font-semibold sm:min-h-11 sm:text-lg"
                  onClick={openCheckoutConfirm}
                  disabled={pending}
                >
                  Complete sale
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FEEDBACK_AUTO_HIDE_MS, useAutoDismissString } from "@/hooks/use-auto-dismiss";
import { emitTindakoDataRefresh } from "@/lib/refresh-events";
import { createSale } from "@/lib/supabase/mutations";
import { handleError, handleSuccess } from "@/components/ui/use-toast";
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

/** Short pulse after a successful tap (visual only). */
const TAP_FEEDBACK_MS = 140;

export function PosCheckout({ products, productSearchQuery = "", loading = false }: Props) {
  const router = useRouter();
  const [cart, setCart] = useState<Cart>({});
  const [tapFeedbackId, setTapFeedbackId] = useState<string | null>(null);
  const tapFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cartRemoveTarget, setCartRemoveTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    return () => {
      if (tapFeedbackTimerRef.current) clearTimeout(tapFeedbackTimerRef.current);
    };
  }, []);

  useAutoDismissString(message, () => setMessage(null), FEEDBACK_AUTO_HIDE_MS);
  useAutoDismissString(successMessage, () => setSuccessMessage(null), FEEDBACK_AUTO_HIDE_MS);

  function clearPosFeedback() {
    setMessage(null);
    setSuccessMessage(null);
  }

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

  /** Each tap adds 1 to the cart (until stock cap). Quantity changes in the cart use + / − / Remove. */
  function quickAddFromProductTap(p: Product) {
    if (p.stock_qty <= 0) return;
    clearPosFeedback();
    const current = cart[p.id] ?? 0;
    if (current >= p.stock_qty) {
      setMessage(`No more available for ${p.name}.`);
      return;
    }
    setCart((c) => ({ ...c, [p.id]: current + 1 }));
    if (tapFeedbackTimerRef.current) clearTimeout(tapFeedbackTimerRef.current);
    setTapFeedbackId(p.id);
    tapFeedbackTimerRef.current = setTimeout(() => {
      setTapFeedbackId(null);
      tapFeedbackTimerRef.current = null;
    }, TAP_FEEDBACK_MS);
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
  }

  function addOne(p: Product) {
    clearPosFeedback();
    const current = cart[p.id] ?? 0;
    if (current >= p.stock_qty) {
      setMessage(`No more available for ${p.name}.`);
      return;
    }
    setCart((c) => ({ ...c, [p.id]: current + 1 }));
  }

  function clearCart() {
    clearPosFeedback();
    setCart({});
  }

  function openCheckoutConfirm() {
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

  function handleCartRemoveDialogOpen(next: boolean) {
    if (!next) setCartRemoveTarget(null);
  }

  function confirmRemoveFromCart() {
    if (!cartRemoveTarget) return;
    const { id } = cartRemoveTarget;
    setCartRemoveTarget(null);
    removeLine(id);
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
      const result = await createSale(payload);

      if (result.error) {
        setMessage(result.error);
        handleError("Sale failed", { description: result.error });
        return;
      }

      setSuccessMessage("Sale completed successfully. Stock updated.");
      setCart({});
      setTapFeedbackId(null);
      emitTindakoDataRefresh();
      router.refresh();

      handleSuccess("Sale completed successfully.", {
        closeModal: () => setConfirmOpen(false),
        shouldCloseOnSuccess: true,
        description: "Stock updated.",
        toastDelayMs: 150,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Checkout failed unexpectedly.";
      setMessage(msg);
      handleError("Sale failed", { description: msg });
    } finally {
      setPending(false);
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
    <div className="flex flex-col gap-5">
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

      <Dialog open={cartRemoveTarget !== null} onOpenChange={handleCartRemoveDialogOpen}>
        <DialogContent variant="stacked" showCloseButton={false} className="w-[calc(100%-1.5rem)] max-w-md sm:max-w-md">
          <DialogHeader className="space-y-2 border-b border-border/60 px-4 pt-4 pb-4 sm:px-6 sm:pr-14">
            <DialogTitle className="text-lg font-semibold leading-snug">Remove item</DialogTitle>
            {cartRemoveTarget ? (
              <DialogDescription className="text-left text-base leading-snug font-medium text-foreground">
                Remove &lsquo;{cartRemoveTarget.name}&rsquo; from cart?
              </DialogDescription>
            ) : null}
          </DialogHeader>
          <DialogFooter className="flex-col gap-3 border-0 px-4 pt-2 pb-4 sm:flex-row sm:px-6 sm:pb-5">
            <Button
              type="button"
              variant="outline"
              className="min-h-12 w-full sm:min-h-11 sm:flex-1"
              onClick={() => setCartRemoveTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-12 w-full font-semibold sm:min-h-11 sm:flex-1"
              onClick={confirmRemoveFromCart}
            >
              Remove
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
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">1. Products</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Tap to add <span className="font-medium text-foreground">one</span> at a time. Tap again to add more. Use{" "}
          <span className="font-medium text-foreground">+</span> / <span className="font-medium text-foreground">−</span> in the cart to adjust.
        </p>
        <ul className="flex flex-col gap-3">
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
              const inCart = cart[p.id] ?? 0;
              const availableStock = Math.max(0, p.stock_qty - inCart);
              const shelfEmpty = p.stock_qty <= 0;
              const cannotAddMore = availableStock <= 0;
              const status = getStockStatus({ stock_qty: availableStock, reorder_level: p.reorder_level });
              const ariaStock = shelfEmpty
                ? "Out of stock"
                : availableStock <= 0
                  ? `No more available, ${p.stock_qty} total in shelf`
                  : `${availableStock} left to sell of ${p.stock_qty} total`;
              const showTapFlash = tapFeedbackId === p.id;
              const inCartHighlight = inCart > 0 && !cannotAddMore;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={cannotAddMore}
                    onClick={() => quickAddFromProductTap(p)}
                    aria-label={`${p.name}, ${formatPeso(p.selling_price)}, ${ariaStock}${inCart > 0 ? `, ${inCart} in cart` : ""}`}
                    className={cn(
                      "flex w-full min-h-[4.25rem] touch-manipulation flex-col justify-center gap-2 rounded-2xl border-2 bg-card px-4 py-3 text-left shadow-sm sm:min-h-[4.5rem] sm:flex-row sm:items-center sm:justify-between sm:gap-4",
                      "transition-[transform,background-color,box-shadow,border-color] duration-100 ease-out motion-reduce:transition-none motion-reduce:transform-none",
                      cannotAddMore
                        ? "cursor-not-allowed border-border/30 bg-muted/20 opacity-50"
                        : "border-border/50 active:scale-[0.985] active:bg-muted/40",
                      inCartHighlight && "border-primary/40 bg-primary/[0.06]",
                      showTapFlash &&
                        "scale-[0.98] border-primary/55 bg-primary/15 ring-2 ring-primary/25 ring-offset-2 ring-offset-background"
                    )}
                  >
                    <span className="min-w-0 text-lg font-semibold leading-tight">{p.name}</span>
                    <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
                      <span className="text-base font-medium tabular-nums text-foreground">{formatPeso(p.selling_price)}</span>
                      <div className="flex max-w-full flex-wrap items-center gap-1.5 sm:justify-end">
                        <span
                          className={cn(
                            "inline-flex min-h-8 max-w-full flex-col items-center justify-center gap-0.5 rounded-full px-2.5 py-1 text-center text-[11px] leading-tight font-medium tabular-nums sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-xs",
                            status === "out" && "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
                            status === "low" && "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
                            status === "ok" && "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                          )}
                        >
                          {shelfEmpty ? (
                            "Out of stock"
                          ) : availableStock <= 0 ? (
                            <>
                              <span className="font-semibold leading-tight">No more available</span>
                              <span className="text-[10px] font-normal opacity-90 tabular-nums">({p.stock_qty} total)</span>
                            </>
                          ) : (
                            <span className="whitespace-nowrap">{`${availableStock} left (${p.stock_qty} total)`}</span>
                          )}
                        </span>
                        {inCart > 0 ? (
                          <span className="inline-flex min-h-8 items-center rounded-full border border-primary/30 bg-primary/12 px-2.5 py-1 text-[11px] font-semibold text-primary tabular-nums sm:text-xs">
                            In cart: {inCart}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section
        aria-label="Cart and checkout"
        className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
      >
        <div className="border-b border-border/50 px-5 py-4 sm:px-6">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">2. Cart</h2>
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
                      onClick={() => setCartRemoveTarget({ id: product.id, name: product.name })}
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

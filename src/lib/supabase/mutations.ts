import { AUTH_DISABLED_FOR_DEV, getDevStoreId } from "@/lib/dev-auth";
import { normalizeCategoryName } from "@/lib/category-names";
import { createClient } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStoreForUser } from "@/lib/store";
import { parseMoneyInput } from "@/lib/money";
import type { Category, Product, Store } from "@/types/database";

/** User-facing copy when delete is blocked by `sale_items` → `products` FK (sales history preserved). */
export const PRODUCT_DELETE_BLOCKED_SALES_MESSAGE =
  "This product cannot be deleted because it has sales history.";

function isForeignKeyViolation(err: { message?: string; code?: string }): boolean {
  const msg = (err.message ?? "").toLowerCase();
  return (
    err.code === "23503" ||
    msg.includes("violates foreign key constraint") ||
    msg.includes("foreign key constraint")
  );
}

export type SaveStoreResult = { error: string; store?: never } | { error?: never; store: Store };

export async function saveStore(formData: FormData): Promise<SaveStoreResult> {
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "Store name is required." };
  }

  const supabase = createClient();
  const devStoreId = getDevStoreId();

  if (AUTH_DISABLED_FOR_DEV && devStoreId) {
    const { data: updated, error: updateError } = await supabase
      .from("stores")
      .update({ name })
      .eq("id", devStoreId)
      .select("id, name, user_id")
      .single();

    if (updateError) {
      console.error("store update failed", updateError);
      return { error: updateError.message };
    }
    return { store: updated as Store };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Please sign in again." };
  }

  const userId = user.id;

  // Resolve row by user_id (never update by user_id — only by primary key).
  const { data: store, error: fetchError } = await supabase
    .from("stores")
    .select("id, name, user_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.error("store fetch failed", fetchError);
    return { error: fetchError.message };
  }

  if (!store?.id) {
    console.warn("No store found for user, creating one…", { userId });
    const { data: created, error: insertError } = await supabase
      .from("stores")
      .insert({
        user_id: userId,
        name,
      })
      .select("id, name, user_id")
      .single();

    if (insertError) {
      console.error("store create failed", insertError);
      return { error: insertError.message };
    }
    return { store: created as Store };
  }

  const { data: updated, error: updateError } = await supabase
    .from("stores")
    .update({ name })
    .eq("id", store.id)
    .select("id, name, user_id")
    .single();

  if (updateError) {
    console.error("store update failed", updateError);
    return { error: updateError.message };
  }
  return { store: updated as Store };
}

async function requireStoreId() {
  const supabase = createClient();
  const devStoreId = getDevStoreId();
  if (AUTH_DISABLED_FOR_DEV && devStoreId) {
    return { error: null, storeId: devStoreId, supabase };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const, storeId: null, supabase: null };
  const store = await getStoreForUser(supabase, user.id);
  if (!store) return { error: "No store" as const, storeId: null, supabase: null };
  return { error: null, storeId: store.id, supabase };
}

export async function createProduct(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category = normalizeCategoryName(String(formData.get("category") ?? ""));
  const categoryIdRaw = String(formData.get("category_id") ?? "").trim();
  const categoryId = categoryIdRaw.length > 0 ? categoryIdRaw : null;
  const costPrice = parseMoneyInput(String(formData.get("cost_price") ?? "0"));
  const sellingPrice = parseMoneyInput(String(formData.get("selling_price") ?? "0"));
  const stockQty = Number.parseInt(String(formData.get("stock_qty") ?? "0"), 10);
  const reorderLevel = Number.parseInt(String(formData.get("reorder_level") ?? "5"), 10);
  const unit = String(formData.get("unit") ?? "pc").trim() || "pc";

  if (!name) return { error: "Product name is required." };

  const ctx = await requireStoreId();
  if (ctx.error || !ctx.storeId || !ctx.supabase) {
    return { error: ctx.error ?? "No store" };
  }
  const { storeId, supabase } = ctx;

  const stockSafe = Number.isFinite(stockQty) ? Math.max(0, stockQty) : 0;
  const reorderSafe = Number.isFinite(reorderLevel) ? Math.max(0, reorderLevel) : 5;

  console.log("🧠 storeId", storeId);

  const payload = {
    name,
    category,
    category_id: categoryId,
    cost_price: costPrice,
    selling_price: sellingPrice,
    stock_qty: stockSafe,
    reorder_level: reorderSafe,
    unit,
    store_id: storeId,
  };

  console.log("🚀 product payload", payload);

  const { data, error } = await supabase.from("products").insert(payload).select().single();

  console.log("🔥 insert result", { data, error });

  if (error) return { error: error.message };
  if (!data) return { error: "Product insert did not return a row." };
  return { error: null, data };
}

function categoryFromRow(row: { id: unknown; name: unknown; created_at?: unknown }): Category {
  return {
    id: String(row.id),
    name: String(row.name),
    created_at: String(row.created_at ?? ""),
  };
}

export async function createCategory(name: string): Promise<{ error: string | null; category?: Category }> {
  const normalizedName = normalizeCategoryName(name);
  if (!normalizedName) return { error: "Category name is required." };

  const supabase = createClient();
  const { data: rows, error: fetchErr } = await supabase.from("categories").select("id,name,created_at");
  if (fetchErr) return { error: fetchErr.message };

  const existing = (rows ?? []).find((r) => normalizeCategoryName(String(r.name)) === normalizedName);
  if (existing) {
    return { error: null, category: categoryFromRow(existing) };
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({ name: normalizedName })
    .select("id,name,created_at")
    .single();

  if (error) {
    if (error.code === "23505" || error.message.toLowerCase().includes("unique")) {
      const { data: again, error: againErr } = await supabase.from("categories").select("id,name,created_at");
      if (!againErr && again) {
        const found = again.find((r) => normalizeCategoryName(String(r.name)) === normalizedName);
        if (found) return { error: null, category: categoryFromRow(found) };
      }
      return { error: error.message };
    }
    return { error: error.message };
  }

  if (!data) return { error: "Could not create category." };

  return { error: null, category: categoryFromRow(data as { id: unknown; name: unknown; created_at?: unknown }) };
}

const CATEGORY_IN_USE_DELETE_ERROR =
  "Cannot delete this category because it is still used by existing products.";

/** Count products referencing `category_id` (FK only; legacy text-only `category` is ignored). */
export async function countProductsUsingCategory(
  categoryId: string
): Promise<{ count: number; error: string | null }> {
  const id = String(categoryId ?? "").trim();
  if (!id) return { count: 0, error: "Invalid category." };

  const supabase = createClient();
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if (error) return { count: 0, error: error.message };
  return { count: count ?? 0, error: null };
}

/** Deletes a category only when no products reference it by `category_id`. */
export async function deleteCategory(categoryId: string): Promise<{ error: string | null }> {
  const id = String(categoryId ?? "").trim();
  if (!id) return { error: "Invalid category." };

  const supabase = createClient();
  const { count, error: countErr } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if (countErr) return { error: countErr.message };
  if ((count ?? 0) > 0) {
    return { error: CATEGORY_IN_USE_DELETE_ERROR };
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: error.message };
  return { error: null };
}

export async function updateProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const categoryIdRaw = String(formData.get("category_id") ?? "").trim();
  const categoryId = categoryIdRaw.length > 0 ? categoryIdRaw : null;
  const costPrice = parseMoneyInput(String(formData.get("cost_price") ?? "0"));
  const sellingPrice = parseMoneyInput(String(formData.get("selling_price") ?? "0"));
  const stockQty = Number.parseInt(String(formData.get("stock_qty") ?? "0"), 10);
  const reorderLevel = Number.parseInt(String(formData.get("reorder_level") ?? "5"), 10);
  const unit = String(formData.get("unit") ?? "pc").trim() || "pc";

  if (!id || !name) return { error: "Invalid product." };

  const supabase = createClient();

  let categoryDisplay = "";
  if (categoryId) {
    const { data: catRow, error: catErr } = await supabase.from("categories").select("name").eq("id", categoryId).maybeSingle();
    if (catErr) return { error: catErr.message };
    if (!catRow) return { error: "Category not found." };
    categoryDisplay = normalizeCategoryName(String((catRow as { name: unknown }).name));
  }

  const { data: updatedRows, error } = await supabase
    .from("products")
    .update({
      name,
      category: categoryDisplay,
      category_id: categoryId,
      cost_price: costPrice,
      selling_price: sellingPrice,
      stock_qty: Number.isFinite(stockQty) ? Math.max(0, stockQty) : 0,
      reorder_level: Number.isFinite(reorderLevel) ? Math.max(0, reorderLevel) : 5,
      unit,
    })
    .eq("id", id)
    .select("id");

  if (error) return { error: error.message };
  if (!updatedRows?.length) {
    return { error: "Product was not updated. Check that this product exists and you have access." };
  }
  return { error: null };
}

/** Adds `addQty` to `stock_qty` for the product identified by `product.id` (RLS scopes access). */
export async function restockProduct(
  product: Pick<Product, "id" | "stock_qty">,
  addQty: number
): Promise<{ error: string | null }> {
  const id = String(product.id ?? "").trim();
  if (!id) return { error: "Invalid product." };

  const qty = Math.floor(Number(addQty));
  if (!Number.isFinite(qty) || qty < 1) {
    return { error: "Enter a whole number of at least 1." };
  }

  const supabase = createClient();

  const { data: row, error: fetchErr } = await supabase
    .from("products")
    .select("stock_qty")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!row) return { error: "Product not found." };

  const newStock = Number(row.stock_qty) + qty;

  console.log("[restockProduct] before update", { productId: id, newStock });

  const { error } = await supabase.from("products").update({ stock_qty: newStock }).eq("id", id);

  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Deletes a product row. Prefer `productStoreId` from the loaded product (`product.store_id`) so the
 * filter matches the row even when dev `NEXT_PUBLIC_DEV_STORE_ID` drifts from rows returned by list queries.
 * RLS still restricts who can delete. Falls back to the session store when `productStoreId` is omitted/empty.
 */
export async function deleteProduct(
  productId: string,
  productStoreId?: string | null
): Promise<{ error: string | null }> {
  const ctx = await requireStoreId();
  if (ctx.error || !ctx.storeId || !ctx.supabase) {
    return { error: ctx.error ?? "No store" };
  }

  const id = String(productId ?? "").trim();
  if (!id) return { error: "Invalid product." };

  const rowStore = String(productStoreId ?? "").trim();
  const storeIdForDelete = rowStore.length > 0 ? rowStore : ctx.storeId;
  if (rowStore && rowStore !== ctx.storeId) {
    console.warn("[deleteProduct] product.store_id !== session store; deleting with product row store_id", {
      productId: id,
      productStoreId: rowStore,
      sessionStoreId: ctx.storeId,
    });
  }

  const { data, error } = await ctx.supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("store_id", storeIdForDelete)
    .select();

  if (error) {
    if (isForeignKeyViolation(error)) {
      return { error: PRODUCT_DELETE_BLOCKED_SALES_MESSAGE };
    }
    console.error("delete failed", error);
    return { error: error.message };
  }

  if (!data || data.length === 0) {
    return { error: "Delete failed (no rows affected)" };
  }

  console.log("deleted rows:", data);

  return { error: null };
}

/** Cart line for checkout (maps to `sale_items`: qty, unit_price, subtotal). */
export type CartLine = {
  product_id: string;
  qty: number;
  /** Line selling price (stored on `sale_items.unit_price`). */
  unit_price: number;
};

/**
 * Inserts `sales` + `sale_items` and decrements `products.stock_qty` (RLS must allow).
 * Used for authenticated users and dev checkout (no `complete_sale` RPC).
 */
async function completeSaleDirectInserts(
  supabase: SupabaseClient,
  storeId: string,
  lines: CartLine[]
): Promise<
  { error: string; saleId?: never; sale?: never } | { error: null; saleId: string; sale: Record<string, unknown> }
> {
  for (const l of lines) {
    if (!Number.isFinite(l.qty) || l.qty <= 0) {
      return { error: "Each line needs a quantity greater than zero." };
    }
    const productId = String(l.product_id).trim();
    if (!productId) {
      return { error: "Each line needs a valid product id." };
    }
    const { data: row, error: qErr } = await supabase
      .from("products")
      .select("stock_qty")
      .eq("id", productId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (qErr) return { error: qErr.message };
    if (!row) return { error: "One or more products were not found in this store." };
    if (Number(row.stock_qty) < l.qty) {
      return { error: "Not enough stock for one or more items." };
    }
  }

  const totalAmount = lines.reduce((sum, l) => sum + l.qty * l.unit_price, 0);

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      store_id: storeId,
      total_amount: totalAmount,
    })
    .select()
    .single();

  if (saleError) {
    console.error("sale insert failed", saleError);
    return { error: saleError.message };
  }

  if (!sale) {
    return { error: "Sale insert returned no data." };
  }

  const saleId = String(sale.id ?? "").trim();
  if (!saleId) {
    return { error: "Sale insert did not return a valid id." };
  }

  const saleItemsPayload = lines.map((line) => ({
    sale_id: saleId,
    product_id: line.product_id,
    qty: line.qty,
    unit_price: line.unit_price,
    subtotal: line.qty * line.unit_price,
  }));

  console.log("🚀 inserting sale_items...", saleItemsPayload);

  const { data: itemsData, error: itemsError } = await supabase
    .from("sale_items")
    .insert(saleItemsPayload)
    .select();

  console.log("🔥 sale_items insert result", { itemsData, itemsError });

  if (itemsError) {
    console.error("❌ sale_items insert failed FULL", itemsError);

    await supabase.from("sales").delete().eq("id", saleId);

    return { error: itemsError.message };
  }

  console.log("✅ sale_items insert success", itemsData);

  const appliedDecrements: { product_id: string; qty: number }[] = [];

  async function restoreStock() {
    for (const m of [...appliedDecrements].reverse()) {
      const productId = String(m.product_id).trim();
      const { data: p } = await supabase.from("products").select("stock_qty").eq("id", productId).maybeSingle();
      const back = Number(p?.stock_qty ?? 0) + m.qty;
      await supabase.from("products").update({ stock_qty: back }).eq("id", productId).select("id");
    }
  }

  for (const line of lines) {
    const productId = String(line.product_id).trim();
    const { data: prod } = await supabase.from("products").select("stock_qty").eq("id", productId).maybeSingle();
    const newStock = Number(prod?.stock_qty ?? 0) - line.qty;

    console.log("🛠 updating product stock", {
      product_id: line.product_id,
      storeId,
      qty: line.qty,
    });

    const { data, error } = await supabase
      .from("products")
      .update({ stock_qty: newStock })
      .eq("id", line.product_id)
      .eq("store_id", storeId)
      .select("id");

    console.log("📦 product update result", { data, error });

    const updatedCount = data?.length ?? 0;

    if (error) {
      await supabase.from("sales").delete().eq("id", saleId);
      await restoreStock();
      return { error: error.message };
    }
    if (updatedCount === 0) {
      await supabase.from("sales").delete().eq("id", saleId);
      await restoreStock();
      return {
        error:
          "Stock was not updated (0 rows). Check product id matches the database and RLS allows updating this product.",
      };
    }

    appliedDecrements.push({ product_id: productId, qty: line.qty });
  }

  const saleRecord = sale as Record<string, unknown>;
  return { error: null, saleId, sale: saleRecord };
}

/** Dev / no-auth: resolve store then same direct inserts as production checkout. */
async function completeSaleClientDev(
  lines: CartLine[]
): Promise<
  { error: string; saleId?: never; sale?: never } | { error: null; saleId: string; sale: Record<string, unknown> }
> {
  console.log("[completeSale] completeSaleClientDev start", { lines });
  const supabase = createClient();
  let resolvedStoreId = getDevStoreId();
  if (!resolvedStoreId) {
    const { data: rows } = await supabase.from("stores").select("id").limit(1);
    resolvedStoreId = rows?.[0]?.id ?? null;
  }
  if (!resolvedStoreId) {
    console.log("[completeSale] completeSaleClientDev abort: no store id");
    return {
      error: "Add a store row or set NEXT_PUBLIC_DEV_STORE_ID so checkout can attach a sale.",
    };
  }

  return completeSaleDirectInserts(supabase, resolvedStoreId, lines);
}

/** Records a sale from cart lines via direct `sales` / `sale_items` inserts (no RPC). */
export async function completeSale(
  lines: CartLine[]
): Promise<
  | { error: string; saleId?: never; sale?: never }
  | { error: null; saleId: string; sale?: Record<string, unknown> }
> {
  console.log("[completeSale] start", { lineCount: lines.length, authDev: AUTH_DISABLED_FOR_DEV, lines });

  if (!lines.length) {
    console.log("[completeSale] abort: empty cart");
    return { error: "Cart is empty." };
  }

  try {
    const supabase = createClient();

    if (AUTH_DISABLED_FOR_DEV) {
      const out = await completeSaleClientDev(lines);
      console.log("[completeSale] completeSaleClientDev returned", out);
      return out;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.log("[completeSale] abort: no user");
      return { error: "Please sign in again." };
    }

    const store = await getStoreForUser(supabase, user.id);
    if (!store?.id) {
      return { error: "No store found. Finish store setup first." };
    }

    return completeSaleDirectInserts(supabase, store.id, lines);
  } catch (e) {
    console.error("[completeSale] threw", e);
    return { error: e instanceof Error ? e.message : "Unexpected error during checkout." };
  }
}

/** Alias for `completeSale` (POS / confirm-sale flows). */
export const createSale = completeSale;

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

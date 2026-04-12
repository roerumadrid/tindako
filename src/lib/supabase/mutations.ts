import { AUTH_DISABLED_FOR_DEV, getDevStoreId } from "@/lib/dev-auth";
import { createClient } from "@/lib/supabase";
import { getStoreForUser } from "@/lib/store";
import { parseMoneyInput } from "@/lib/money";
import type { Category, Product } from "@/types/database";

export type SaveStoreResult = { error?: string };

export async function saveStore(formData: FormData): Promise<SaveStoreResult> {
  const name = String(formData.get("name") ?? "").trim();
  const ownerName = String(formData.get("owner_name") ?? "").trim();

  if (!name || !ownerName) {
    return { error: "Store name and owner name are required." };
  }

  const supabase = createClient();
  const devStoreId = getDevStoreId();

  if (AUTH_DISABLED_FOR_DEV && devStoreId) {
    const { error } = await supabase
      .from("stores")
      .update({
        name,
        owner_name: ownerName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", devStoreId);
    if (error) return { error: error.message };
    return {};
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Please sign in again." };
  }

  const { error } = await supabase.from("stores").upsert(
    {
      user_id: user.id,
      name,
      owner_name: ownerName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { error: error.message };
  }
  return {};
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
  const category = String(formData.get("category") ?? "").trim();
  const categoryIdRaw = String(formData.get("category_id") ?? "").trim();
  const categoryId = categoryIdRaw.length > 0 ? categoryIdRaw : null;
  const costPrice = parseMoneyInput(String(formData.get("cost_price") ?? "0"));
  const sellingPrice = parseMoneyInput(String(formData.get("selling_price") ?? "0"));
  const stockQty = Number.parseInt(String(formData.get("stock_qty") ?? "0"), 10);
  const reorderLevel = Number.parseInt(String(formData.get("reorder_level") ?? "5"), 10);
  const unit = String(formData.get("unit") ?? "pc").trim() || "pc";

  if (!name) return { error: "Product name is required." };

  const supabase = createClient();
  const stockSafe = Number.isFinite(stockQty) ? Math.max(0, stockQty) : 0;
  const reorderSafe = Number.isFinite(reorderLevel) ? Math.max(0, reorderLevel) : 5;

  const { error } = await supabase.from("products").insert({
    name,
    category,
    category_id: categoryId,
    cost_price: costPrice,
    selling_price: sellingPrice,
    stock_qty: stockSafe,
    reorder_level: reorderSafe,
    unit,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function createCategory(name: string): Promise<{ error: string | null; category?: Category }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Category name is required." };

  const supabase = createClient();
  const { data: rows, error: fetchErr } = await supabase.from("categories").select("id,name");
  if (fetchErr) return { error: fetchErr.message };

  const lower = trimmed.toLowerCase();
  const exists = (rows ?? []).some((r) => String(r.name).trim().toLowerCase() === lower);
  if (exists) {
    return { error: "A category with that name already exists." };
  }

  const { data, error } = await supabase.from("categories").insert({ name: trimmed }).select("id,name,created_at").single();

  if (error) {
    if (error.code === "23505" || error.message.toLowerCase().includes("unique")) {
      return { error: "A category with that name already exists." };
    }
    return { error: error.message };
  }

  if (!data) return { error: "Could not create category." };

  return {
    error: null,
    category: {
      id: String(data.id),
      name: String(data.name),
      created_at: String(data.created_at ?? ""),
    },
  };
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
    categoryDisplay = String((catRow as { name: unknown }).name).trim();
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

export async function deleteProduct(productId: string): Promise<{ error: string | null }> {
  const ctx = await requireStoreId();
  if (ctx.error || !ctx.storeId || !ctx.supabase) {
    return { error: ctx.error ?? "No store" };
  }

  const { error } = await ctx.supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("store_id", ctx.storeId);

  if (error) return { error: error.message };
  return { error: null };
}

/** Payload for `complete_sale` RPC and dev checkout (keys must match DB / function JSON). */
export type CartLine = {
  product_id: string;
  qty: number;
  /** Line selling price (stored on `sale_items.unit_price`). */
  unit_price: number;
};

/** Dev / no-auth: insert `sales` + `sale_items` and decrement `products.stock_qty` (requires RLS to allow). */
async function completeSaleClientDev(lines: CartLine[]): Promise<{ error: string | null; saleId?: string }> {
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
      .maybeSingle();
    if (qErr) return { error: qErr.message };
    if (!row) return { error: "One or more products were not found." };
    if (Number(row.stock_qty) < l.qty) {
      return { error: "Not enough stock for one or more items." };
    }
  }

  const total = lines.reduce((sum, l) => sum + l.qty * l.unit_price, 0);

  console.log("[completeSale] before sales insert", { resolvedStoreId, total });
  const { data: saleRow, error: saleErr } = await supabase
    .from("sales")
    .insert({ store_id: resolvedStoreId, total_amount: total })
    .select("id")
    .single();

  if (saleErr || !saleRow?.id) {
    console.log("[completeSale] after sales insert (failed)", { saleErr, saleRow });
    return { error: saleErr?.message ?? "Could not create sale." };
  }

  const saleId = saleRow.id as string;
  console.log("[completeSale] after sales insert (ok)", { saleId });
  const appliedDecrements: { product_id: string; qty: number }[] = [];

  async function restoreStock() {
    for (const m of [...appliedDecrements].reverse()) {
      const productId = String(m.product_id).trim();
      const { data: p } = await supabase.from("products").select("stock_qty").eq("id", productId).maybeSingle();
      const back = Number(p?.stock_qty ?? 0) + m.qty;
      const { data: restored, error: reErr } = await supabase
        .from("products")
        .update({ stock_qty: back })
        .eq("id", productId)
        .select("id");
      console.log("[completeSale] restoreStock row", {
        productId,
        back,
        updatedRows: restored?.length ?? 0,
        reErr,
      });
    }
  }

  for (const l of lines) {
    const productId = String(l.product_id).trim();
    if (!productId) {
      await supabase.from("sales").delete().eq("id", saleId);
      await restoreStock();
      return { error: "Missing product id on a cart line." };
    }

    const subtotal = l.qty * l.unit_price;
    const row = {
      sale_id: saleId,
      product_id: productId,
      qty: l.qty,
      unit_price: l.unit_price,
      subtotal,
    };
    console.log("[completeSale] before sale_items insert", row);
    const { error: itemErr } = await supabase.from("sale_items").insert(row);
    console.log("[completeSale] after sale_items insert", { productId, itemErr });
    if (itemErr) {
      await supabase.from("sales").delete().eq("id", saleId);
      await restoreStock();
      return { error: itemErr.message };
    }

    const { data: prod } = await supabase.from("products").select("stock_qty").eq("id", productId).maybeSingle();
    const newStock = Number(prod?.stock_qty ?? 0) - l.qty;
    console.log("[completeSale] before stock update", { productId, newStock, priorStock: prod?.stock_qty });

    const { data: updatedRows, error: upErr } = await supabase
      .from("products")
      .update({ stock_qty: newStock })
      .eq("id", productId)
      .select("id");

    const updatedCount = updatedRows?.length ?? 0;
    console.log("[completeSale] after stock update", { productId, newStock, upErr, updatedRowsCount: updatedCount });

    if (upErr) {
      await supabase.from("sales").delete().eq("id", saleId);
      await restoreStock();
      return { error: upErr.message };
    }
    if (updatedCount === 0) {
      await supabase.from("sales").delete().eq("id", saleId);
      await restoreStock();
      return {
        error:
          "Stock was not updated (0 rows). Check product id matches the database and RLS allows updating this product.",
      };
    }

    appliedDecrements.push({ product_id: productId, qty: l.qty });
  }

  console.log("[completeSale] completeSaleClientDev done", { saleId });
  return { error: null, saleId };
}

export async function completeSale(lines: CartLine[]) {
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

    const payload = lines.map((l) => ({
      product_id: l.product_id,
      qty: l.qty,
      unit_price: l.unit_price,
      subtotal: l.qty * l.unit_price,
    }));

    console.log("[completeSale] before complete_sale RPC", { payload });
    const { data, error } = await supabase.rpc("complete_sale", {
      p_items: payload,
    });
    console.log("[completeSale] after complete_sale RPC", { data, error });

    if (error) {
      const msg = error.message.includes("insufficient")
        ? "Not enough stock for one or more items."
        : error.message;
      return { error: msg };
    }

    return { error: null, saleId: data as string };
  } catch (e) {
    console.error("[completeSale] threw", e);
    return { error: e instanceof Error ? e.message : "Unexpected error during checkout." };
  }
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

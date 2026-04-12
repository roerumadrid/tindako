export type Store = {
  id: string;
  user_id: string;
  name: string;
  owner_name: string;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  name: string;
  created_at: string;
};

export type Product = {
  id: string;
  store_id: string;
  name: string;
  category: string;
  /** Optional FK to `categories`; legacy `category` text remains for compatibility. */
  category_id: string | null;
  /** Prefer in UI: `categories.name` from list queries that embed `categories`; otherwise derived in `normalizeProduct`. */
  category_display: string;
  cost_price: number;
  selling_price: number;
  stock_qty: number;
  reorder_level: number;
  unit: string;
  created_at: string;
};

export type Sale = {
  id: string;
  store_id: string;
  total_amount: number;
  created_at: string;
};

/** One line on a receipt (column names match sale_items table). */
export type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  subtotal: number;
};

export type StockStatus = "out" | "low" | "ok";

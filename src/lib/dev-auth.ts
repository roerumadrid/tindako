/**
 * When `true`, the app skips auth gates, login/onboarding redirects, and
 * optional session checks in mutations. No middleware auth runs (none is configured).
 *
 * For **data** (products, sales) without a logged-in user, set
 * `NEXT_PUBLIC_DEV_STORE_ID` to a real `stores.id` UUID from your Supabase project
 * and relax RLS for local dev if needed — otherwise lists stay empty and writes fail at the API.
 *
 * Set to `false` before shipping or when testing auth again.
 */
export const AUTH_DISABLED_FOR_DEV = true;

/** Dev-only: use this store for client-side reads/writes when auth is off. */
export function getDevStoreId(): string | null {
  if (!AUTH_DISABLED_FOR_DEV) return null;
  const raw = process.env.NEXT_PUBLIC_DEV_STORE_ID?.trim();
  return raw && raw.length > 0 ? raw : null;
}

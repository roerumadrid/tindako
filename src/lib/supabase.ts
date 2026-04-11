import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Browser-only Supabase client (Client Components, event handlers, `useEffect`).
 * Uses `createBrowserClient` from `@supabase/ssr` — no `next/headers` or server cookies API.
 */
export function createClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("createClient() only runs in the browser. Use it inside Client Components.");
  }
  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local."
    );
  }
  return createBrowserClient(url, anonKey);
}

/**
 * Ping Supabase from the browser (Auth session check — no table required).
 */
export async function testSupabaseConnection(): Promise<{
  ok: boolean;
  error: string | null;
}> {
  if (typeof window === "undefined") {
    return { ok: false, error: "Run this from a Client Component (browser only)." };
  }
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.getSession();
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Something went wrong";
    return { ok: false, error: message };
  }
}

/** Example read once `stores` exists (RLS applies). */
export async function fetchStoresSample() {
  const supabase = createClient();
  return supabase.from("stores").select("id, name").limit(1);
}

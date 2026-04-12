import { createClient } from "@/lib/supabase";
import { AUTH_DISABLED_FOR_DEV, getDevStoreId } from "@/lib/dev-auth";
import { getStoreForUser } from "@/lib/store";
import type { Store } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ResolvedShopClient = {
  supabase: SupabaseClient;
  store: Store | null;
};

/**
 * Resolves the active store for shop pages: dev store id when auth is disabled,
 * otherwise the signed-in user's store.
 */
export async function resolveShopForClient(): Promise<ResolvedShopClient> {
  const supabase = createClient();
  const devId = getDevStoreId();

  if (AUTH_DISABLED_FOR_DEV && devId) {
    const { data, error } = await supabase
      .from("stores")
      .select("id, name, user_id")
      .eq("id", devId)
      .maybeSingle();
    if (error || !data) {
      return { supabase, store: null };
    }
    return { supabase, store: data as Store };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, store: null };
  }

  const store = await getStoreForUser(supabase, user.id);
  return { supabase, store };
}

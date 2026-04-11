import type { SupabaseClient } from "@supabase/supabase-js";
import type { Store } from "@/types/database";

export async function getStoreForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<Store | null> {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Store;
}

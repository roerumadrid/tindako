import type { SupabaseClient } from "@supabase/supabase-js";
import type { Store } from "@/types/database";

function logSupabaseError(context: string, error: { message?: string; code?: string; details?: string; hint?: string } | null) {
  if (!error) return;
  console.error(context, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
    stringified: JSON.stringify(error, Object.getOwnPropertyNames(error)),
  });
}

export async function getStoreForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<Store | null> {
  const { data, error } = await supabase
    .from("stores")
    .select("id, name, user_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as Store;
}

/** Creates a minimal store row when the user has none (idempotent). */
export async function ensureDefaultStoreForUser(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = { id: userId, email: email ?? null };
    console.log("store bootstrap input", user);

    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      console.error("ensureDefaultStoreForUser: invalid userId", userId);
      return { ok: false, error: "Missing user id." };
    }

    const { data: existingRow, error: selectError } = await supabase
      .from("stores")
      .select("id, name, user_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    console.log("get store result", existingRow, selectError);
    if (selectError) {
      logSupabaseError("get store failed", selectError);
      return { ok: false, error: selectError.message || "Select failed." };
    }
    if (existingRow) {
      return { ok: true };
    }

    const payload = {
      name: "My Store",
      user_id: userId,
    };
    console.log("store insert payload", payload);

    const attemptInsert = async () => {
      const { data, error } = await supabase.from("stores").insert(payload).select().single();
      console.log("store insert result FULL", data, error);
      if (error) {
        logSupabaseError("store insert error details", error);
      }
      return { data, error } as const;
    };

    let { error: insError } = await attemptInsert();
    if (!insError) {
      return { ok: true };
    }

    if (insError.code === "23505") {
      console.log("insert store duplicate user_id → ok");
      return { ok: true };
    }

    const retryable =
      insError.code === "42501" ||
      insError.message?.toLowerCase().includes("permission") ||
      insError.message?.toLowerCase().includes("jwt") ||
      insError.message?.toLowerCase().includes("policy");

    if (retryable) {
      console.warn("insert store failed (may be auth timing); retry after getUser + delay", insError);
      await supabase.auth.getUser();
      await new Promise((r) => setTimeout(r, 250));
      const { error: retryErr } = await attemptInsert();
      if (!retryErr) {
        return { ok: true };
      }
      if (retryErr.code === "23505") {
        return { ok: true };
      }
      const msg = retryErr.message || retryErr.code || JSON.stringify(retryErr) || "Insert failed.";
      return { ok: false, error: msg };
    }

    const msg = insError.message || insError.code || JSON.stringify(insError) || "Insert failed.";
    return { ok: false, error: msg };
  } catch (err) {
    console.error("ensureDefaultStoreForUser error FULL", err);
    return { ok: false, error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

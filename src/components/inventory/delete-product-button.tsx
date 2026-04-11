"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FEEDBACK_AUTO_HIDE_MS, useAutoDismissString } from "@/hooks/use-auto-dismiss";
import { emitTindakoDataRefresh } from "@/lib/refresh-events";
import { deleteProduct } from "@/lib/supabase/mutations";
import { Button } from "@/components/ui/button";

export function DeleteProductButton({ productId, productName }: { productId: string; productName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useAutoDismissString(error, () => setError(null), FEEDBACK_AUTO_HIDE_MS);
  useAutoDismissString(success, () => setSuccess(null), FEEDBACK_AUTO_HIDE_MS);

  function onDelete() {
    if (!window.confirm(`Remove "${productName}" from your inventory?`)) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const { error: delErr } = await deleteProduct(productId);
      if (delErr) {
        setError(delErr);
        return;
      }
      setSuccess("Product removed.");
      emitTindakoDataRefresh();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-stretch gap-1.5">
      {error ? (
        <p
          className="max-w-[16rem] rounded-md border border-destructive/25 bg-destructive/[0.06] px-2 py-1.5 text-xs leading-snug text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="max-w-[16rem] rounded-md border border-emerald-500/25 bg-emerald-500/[0.08] px-2 py-1.5 text-xs font-medium leading-snug text-emerald-800 dark:text-emerald-200"
          role="status"
        >
          {success}
        </p>
      ) : null}
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="min-h-9"
        disabled={pending}
        onClick={onDelete}
      >
        {pending ? "…" : "Remove"}
      </Button>
    </div>
  );
}

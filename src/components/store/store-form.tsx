"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FEEDBACK_AUTO_HIDE_MS, useAutoDismissString } from "@/hooks/use-auto-dismiss";
import { emitTindakoDataRefresh } from "@/lib/refresh-events";
import { saveStore } from "@/lib/supabase/mutations";
import type { Store } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  defaultName?: string;
  title: string;
  description: string;
  submitLabel: string;
  /** Where to go after a successful save (default: dashboard). */
  afterSaveHref?: string;
  /** Called with the row returned from Supabase so parent state can update immediately. */
  onSaved?: (store: Store) => void;
};

export function StoreForm({
  defaultName = "",
  title,
  description,
  submitLabel,
  afterSaveHref = "/dashboard",
  onSaved,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [nameValue, setNameValue] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setNameValue(defaultName);
  }, [defaultName]);

  useAutoDismissString(error, () => setError(null), FEEDBACK_AUTO_HIDE_MS);
  useAutoDismissString(success, () => setSuccess(null), FEEDBACK_AUTO_HIDE_MS);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const result = await saveStore(fd);
        if ("error" in result) {
          setError(result.error ?? "Save failed.");
          return;
        }
        setNameValue(result.store.name);
        onSaved?.(result.store);
        setSuccess("Store updated");
        emitTindakoDataRefresh();
        router.refresh();
        if (afterSaveHref !== pathname) {
          router.push(afterSaveHref);
        }
      } catch (err) {
        console.error("saveStore", err);
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <form
        onSubmit={onSubmit}
        onInput={() => {
          setError(null);
          setSuccess(null);
        }}
      >
        <CardContent className="space-y-5">
          {error ? (
            <p
              className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5 text-sm leading-snug text-destructive dark:border-destructive/40"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          {success ? (
            <p
              className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-2.5 text-sm leading-snug text-emerald-800 dark:text-emerald-100"
              role="status"
            >
              {success}
            </p>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="name">Store name</Label>
            <Input
              id="name"
              name="name"
              required
              value={nameValue}
              onChange={(ev) => setNameValue(ev.target.value)}
              placeholder="e.g. Aling Nena Sari-Sari"
              className="min-h-11 text-base"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" size="lg" className="min-h-12 w-full" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

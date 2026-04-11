"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FEEDBACK_AUTO_HIDE_MS, useAutoDismissString } from "@/hooks/use-auto-dismiss";
import { emitTindakoDataRefresh } from "@/lib/refresh-events";
import { saveStore } from "@/lib/supabase/mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  defaultName?: string;
  defaultOwnerName?: string;
  title: string;
  description: string;
  submitLabel: string;
  /** Where to go after a successful save (default: dashboard). */
  afterSaveHref?: string;
};

export function StoreForm({
  defaultName = "",
  defaultOwnerName = "",
  title,
  description,
  submitLabel,
  afterSaveHref = "/dashboard",
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useAutoDismissString(error, () => setError(null), FEEDBACK_AUTO_HIDE_MS);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveStore(fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      emitTindakoDataRefresh();
      router.push(afterSaveHref);
    });
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} onInput={() => setError(null)}>
        <CardContent className="space-y-5">
          {error ? (
            <p
              className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5 text-sm leading-snug text-destructive dark:border-destructive/40"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="name">Store name</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={defaultName}
              placeholder="e.g. Aling Nena Sari-Sari"
              className="min-h-11 text-base"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="owner_name">Owner name</Label>
            <Input
              id="owner_name"
              name="owner_name"
              required
              defaultValue={defaultOwnerName}
              placeholder="Your name"
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

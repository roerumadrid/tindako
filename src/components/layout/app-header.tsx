"use client";

import { useRouter } from "next/navigation";
import { AUTH_DISABLED_FOR_DEV } from "@/lib/dev-auth";
import { signOut } from "@/lib/supabase/mutations";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const router = useRouter();

  async function onSignOut() {
    await signOut();
    router.replace(AUTH_DISABLED_FOR_DEV ? "/" : "/login");
  }

  return (
    <header className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        className="shrink-0"
        aria-label="Sign out"
        onClick={() => void onSignOut()}
      >
        <LogOut className="size-5" />
      </Button>
    </header>
  );
}

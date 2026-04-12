"use client";

import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { AUTH_DISABLED_FOR_DEV } from "@/lib/dev-auth";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function AppHeader({ subtitle }: { subtitle?: string }) {
  const router = useRouter();

  async function handleLogout() {
    if (AUTH_DISABLED_FOR_DEV) {
      router.replace("/");
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <Logo />
        {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        className="shrink-0"
        aria-label="Sign out"
        onClick={() => void handleLogout()}
      >
        <LogOut className="size-5" />
      </Button>
    </header>
  );
}

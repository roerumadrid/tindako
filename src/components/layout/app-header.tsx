"use client";

import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { AUTH_DISABLED_FOR_DEV } from "@/lib/dev-auth";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";

type AppHeaderProps = {
  /** Muted line under the logo (e.g. page hints). Not shown when `storeName` is set. */
  subtitle?: string;
  /** Store identity: pill badge; navigates to Store Settings when clicked. */
  storeName?: string;
};

export function AppHeader({ subtitle, storeName }: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const trimmedStore = storeName?.trim();
  const showStoreBadge = Boolean(trimmedStore);

  function goToStoreSettings() {
    if (pathname === "/settings") return;
    router.push("/settings");
  }

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
      <div className="min-w-0 flex-1">
        <Logo />
        {showStoreBadge ? (
          <div className="mt-2 min-w-0">
            <button
              type="button"
              onClick={goToStoreSettings}
              title={pathname === "/settings" ? "Store settings" : "Open store settings"}
              className={cn(
                "inline-flex max-w-full min-w-0 cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-gray-100 px-3 py-1.5 text-left text-sm font-medium text-gray-800 shadow-sm transition",
                "hover:bg-gray-200",
                "dark:border-gray-700 dark:bg-gray-800/90 dark:text-gray-100 dark:hover:bg-gray-700"
              )}
            >
              <span className="shrink-0 select-none" aria-hidden>
                🏪
              </span>
              <span className="min-w-0 truncate">{trimmedStore}</span>
            </button>
          </div>
        ) : subtitle ? (
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
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

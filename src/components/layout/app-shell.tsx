import Link from "next/link";
import { LayoutDashboard, Package, ShoppingCart, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/pos", label: "POS", icon: ShoppingCart },
  { href: "/settings", label: "Store", icon: Settings },
] as const;

export function AppShell({
  children,
  currentPath,
}: {
  children: React.ReactNode;
  currentPath: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col pb-[calc(4.75rem+env(safe-area-inset-bottom))]">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-4 pt-5 pb-2">{children}</main>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.08)] backdrop-blur-md dark:shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.35)]"
        aria-label="Main"
      >
        <ul className="mx-auto flex max-w-lg justify-between gap-1 px-2 pt-2.5">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = currentPath === href || currentPath.startsWith(`${href}/`);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  className={cn(
                    "flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium transition-colors",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className={cn("size-6", active && "stroke-[2.5]")} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

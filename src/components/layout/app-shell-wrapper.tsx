"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";

export function AppShellWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <AppShell currentPath={pathname}>{children}</AppShell>;
}

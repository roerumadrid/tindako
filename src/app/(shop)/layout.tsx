import { AppShellWrapper } from "@/components/layout/app-shell-wrapper";
import { ShopGate } from "@/components/auth/auth-gates";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShopGate>
      <AppShellWrapper>{children}</AppShellWrapper>
    </ShopGate>
  );
}

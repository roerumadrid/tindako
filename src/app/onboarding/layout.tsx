import type { Metadata } from "next";
import { OnboardingGate } from "@/components/auth/auth-gates";

export const metadata: Metadata = {
  title: "Set up your store",
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingGate>
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">{children}</div>
    </OnboardingGate>
  );
}

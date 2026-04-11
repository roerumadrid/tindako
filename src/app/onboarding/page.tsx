import { StoreForm } from "@/components/store/store-form";

export default function OnboardingPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm font-medium text-primary">TindaKo</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Welcome — let&apos;s set up your store</h1>
        <p className="mt-2 text-sm text-muted-foreground">Takes a minute. You can change this later in Store.</p>
      </div>
      <StoreForm
        title="Store details"
        description="This name shows on your dashboard. Owner name is for your records."
        submitLabel="Save and continue"
      />
    </div>
  );
}

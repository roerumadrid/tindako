import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

const wordmarkClass =
  "text-2xl font-semibold tracking-tight sm:text-3xl";
const taglineClass = "text-sm text-muted-foreground/80";

type LogoProps = {
  className?: string;
  /**
   * `inline` — row, left-aligned (e.g. app header).
   * `stacked` — column, centered (e.g. login / register).
   */
  layout?: "inline" | "stacked";
};

export function Logo({ className, layout = "inline" }: LogoProps) {
  const textBlock = (
    <div
      className={cn(
        "flex min-w-0 flex-col leading-tight",
        layout === "stacked" ? "items-center text-center" : "text-left"
      )}
    >
      <span className={wordmarkClass}>TindaKo</span>
      <span className={taglineClass}>Track mo ang Tinda mo!</span>
    </div>
  );

  if (layout === "stacked") {
    return (
      <div className={cn("flex flex-col items-center gap-2 text-center", className)}>
        <ShoppingCart className="size-10 shrink-0 text-primary" aria-hidden strokeWidth={2} />
        {textBlock}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <ShoppingCart className="size-10 shrink-0 text-primary" aria-hidden strokeWidth={2} />
      {textBlock}
    </div>
  );
}

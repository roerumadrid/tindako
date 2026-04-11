import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getStockStatus, stockStatusLabel } from "@/lib/stock";
import type { Product } from "@/types/database";

type Props = {
  product: Pick<Product, "stock_qty" | "reorder_level">;
  className?: string;
};

export function StockBadge({ product, className }: Props) {
  const status = getStockStatus(product);
  return (
    <Badge
      variant="secondary"
      className={cn(
        "shrink-0 text-xs font-medium",
        status === "out" && "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200",
        status === "low" && "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100",
        status === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100",
        className
      )}
    >
      {stockStatusLabel[status]}
    </Badge>
  );
}

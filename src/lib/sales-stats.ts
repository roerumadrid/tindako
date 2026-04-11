import type { Sale } from "@/types/database";

function manilaCalendarDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export function aggregateSalesByManilaCalendar(
  sales: Pick<Sale, "total_amount" | "created_at">[]
): { today: number; month: number } {
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const monthPrefix = todayStr.slice(0, 7);

  let today = 0;
  let month = 0;

  for (const s of sales) {
    const d = manilaCalendarDate(s.created_at);
    const amt = Number(s.total_amount);
    if (d === todayStr) today += amt;
    if (d.startsWith(monthPrefix)) month += amt;
  }

  return { today, month };
}

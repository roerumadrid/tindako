/** Philippines uses UTC+8 year-round (no DST). */
export function getManilaTodayUtcRange(): { startIso: string; endIso: string } {
  const now = new Date();
  const ymd = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const start = new Date(`${ymd}T00:00:00+08:00`);
  const end = new Date(`${ymd}T23:59:59.999+08:00`);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/** Canonical category name for DB and comparisons (trimmed, lowercase). */
export function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase();
}

/** Title-style label for UI only (never persist this shape). */
export function displayCategoryName(name: string): string {
  const t = normalizeCategoryName(name);
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

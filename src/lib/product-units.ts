/** Shared unit choices for Add / Edit product (value is what we persist). */
export const UNIT_OPTIONS = [
  { label: "Piece (pc)", value: "pc" },
  { label: "Kilogram (kg)", value: "kg" },
  { label: "Gram (g)", value: "g" },
  { label: "Liter (l)", value: "l" },
  { label: "Milliliter (ml)", value: "ml" },
] as const;

const UNIT_VALUE_SET = new Set<string>(UNIT_OPTIONS.map((o) => o.value));

/**
 * Map DB `unit` to `<select>` `value`: canonical option id (lowercase), legacy `liter` → `l`,
 * or the trimmed stored string if it is not one of {@link UNIT_OPTIONS}.
 */
export function storedUnitToSelectValue(stored: string): string {
  const raw = stored.trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (lower === "liter") return "l";
  if (UNIT_VALUE_SET.has(lower)) return lower;
  return raw;
}

export function isStandardUnitSelectValue(value: string): boolean {
  return UNIT_VALUE_SET.has(value.trim().toLowerCase());
}

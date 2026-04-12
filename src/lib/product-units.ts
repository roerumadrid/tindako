/** Preset unit values for product forms (lowercase). */
export const PRODUCT_UNIT_PRESETS = [
  "pc",
  "pack",
  "box",
  "bottle",
  "can",
  "sachet",
  "dozen",
  "kg",
  "g",
  "liter",
  "ml",
] as const;

/** Select option value that opens the custom unit field. */
export const PRODUCT_UNIT_OTHER_VALUE = "__other__";

const PRESET_SET = new Set<string>(PRODUCT_UNIT_PRESETS);

export function isPresetUnit(unit: string): boolean {
  return PRESET_SET.has(unit.trim().toLowerCase());
}

/** Map DB `unit` to controlled select + optional custom string. */
export function unitSelectValueFromStored(stored: string): { selectValue: string; custom: string } {
  const t = stored.trim();
  if (!t) return { selectValue: "pc", custom: "" };
  const lower = t.toLowerCase();
  if (PRESET_SET.has(lower)) return { selectValue: lower, custom: "" };
  return { selectValue: PRODUCT_UNIT_OTHER_VALUE, custom: t };
}

/** Final unit string for save, or `null` if "Other" is selected but custom is empty. */
export function resolveUnitForSubmit(selectValue: string, customTrimmed: string): string | null {
  if (selectValue === PRODUCT_UNIT_OTHER_VALUE) {
    const c = customTrimmed.trim();
    return c.length > 0 ? c : null;
  }
  const v = selectValue.trim();
  return v.length > 0 ? v : "pc";
}

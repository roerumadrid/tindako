/**
 * Derives up to two-letter initials from a store (or any) display name.
 *
 * @example getInitials("Admin Store") → "AS"
 * @example getInitials("TindaKo") → "TI"
 * @example getInitials("My Shop") → "MS"
 */
export function getInitials(name: string): string {
  if (!name) return "S";

  const words = name.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return "S";

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (words[0][0] + words[1][0]).toUpperCase();
}

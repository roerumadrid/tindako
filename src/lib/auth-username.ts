/** Internal domain for Supabase email auth when users sign in with a username only. */
export const SYNTHETIC_AUTH_EMAIL_DOMAIN = "tindako.app";

const USERNAME_PATTERN = /^[a-z0-9_]{3,}$/;

/** Live input: lowercase, strip spaces, keep only letters, numbers, underscore. */
export function sanitizeUsernameInput(value: string): string {
  return value.toLowerCase().replace(/\s/g, "").replace(/[^a-z0-9_]/g, "");
}

/**
 * Validates a username for submit. Returns an error message or null if valid.
 * Rules: lowercase, no spaces, [a-z0-9_], min 3 characters.
 */
export function validateUsername(username: string): string | null {
  const normalized = sanitizeUsernameInput(username);
  if (normalized.length < 3) {
    return "Username must be at least 3 characters (letters, numbers, underscore only).";
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    return "Username can only use lowercase letters, numbers, and underscores.";
  }
  return null;
}

/** Maps a username to the synthetic email used with `signUp` / `signInWithPassword`. */
export function usernameToSyntheticEmail(username: string): string {
  const normalized = sanitizeUsernameInput(username);
  return `${normalized}@${SYNTHETIC_AUTH_EMAIL_DOMAIN}`;
}

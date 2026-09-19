/** Canonical avatar defaults — use when no photo URL is set. */
export const DEFAULT_KID_AVATAR = "phosphor:Smiley";
export const DEFAULT_PARENT_AVATAR = "phosphor:User";

const isUrl = (v: string) =>
  /^https?:\/\//.test(v) || v.startsWith("/") || v.startsWith("data:image/");

/** Legacy emoji DB defaults → icon tokens (avoids mojibake / missing glyphs). */
const LEGACY_EMOJI: Record<string, string> = {
  "🧒": DEFAULT_KID_AVATAR,
  "👨‍👩‍👧": DEFAULT_PARENT_AVATAR,
  "🚀": "phosphor:Rocket",
  "🙂": DEFAULT_KID_AVATAR,
  "😊": DEFAULT_KID_AVATAR,
  "😺": "phosphor:Cat",
  "🐶": "phosphor:Dog",
  "⭐": "phosphor:Star",
  "🌟": "phosphor:Star",
};

function looksBroken(v: string) {
  // Mojibake / latin1 garbling of UTF-8 emoji (e.g. ðŸ'©)
  if (/Ã.|Â.|ðŸ|â.|ï¸|�/.test(v)) return true;
  // Phosphor without prefix but looks like an icon name
  if (/^[A-Z][a-zA-Z0-9]+$/.test(v)) return false;
  return false;
}

/**
 * Resolve any stored avatar value to a renderable URL or phosphor:* token.
 * Photos (http/data) are kept; empty, emoji, and broken values get a default icon.
 */
export function resolveAvatar(
  value: string | null | undefined,
  kind: "kid" | "parent" = "kid",
): string {
  const fallback = kind === "kid" ? DEFAULT_KID_AVATAR : DEFAULT_PARENT_AVATAR;
  if (value == null) return fallback;
  const v = String(value).trim();
  if (!v) return fallback;
  if (isUrl(v)) return v;
  if (v.startsWith("phosphor:")) return v;
  if (LEGACY_EMOJI[v]) return LEGACY_EMOJI[v];
  if (looksBroken(v)) return fallback;
  // Prefer default icon over raw emoji for consistent “avatar pic” look
  try {
    if (/\p{Extended_Pictographic}/u.test(v)) return fallback;
  } catch {
    /* older engines without unicode property escapes */
  }
  return fallback;
}

export function hasPhotoAvatar(value: string | null | undefined): boolean {
  return !!value && isUrl(String(value).trim());
}

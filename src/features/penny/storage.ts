import type { ChatMessage } from "./types";

export const PENNY_STORAGE_KEY_PREFIX = "centsibility.penny.messages.";

export function getPennyStorageKey(mode: "kid" | "parent"): string {
  return `${PENNY_STORAGE_KEY_PREFIX}${mode}`;
}

export function loadCachedMessages(
  mode: "kid" | "parent",
): ChatMessage[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(getPennyStorageKey(mode));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // sessionStorage failure is non-fatal
  }
  return null;
}

export function saveCachedMessages(
  mode: "kid" | "parent",
  msgs: ChatMessage[],
) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      getPennyStorageKey(mode),
      JSON.stringify(msgs),
    );
  } catch {
    // sessionStorage failure is non-fatal
  }
}

export function clearCachedMessages(mode?: "kid" | "parent") {
  if (typeof window === "undefined") return;
  try {
    if (mode) {
      window.sessionStorage.removeItem(getPennyStorageKey(mode));
    } else {
      window.sessionStorage.removeItem(getPennyStorageKey("kid"));
      window.sessionStorage.removeItem(getPennyStorageKey("parent"));
    }
  } catch {
    // sessionStorage failure is non-fatal
  }
}

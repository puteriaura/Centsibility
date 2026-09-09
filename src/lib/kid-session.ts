// Kid client-side session: code stored in localStorage; server validates on every call.
const KEY = "centsibility.kid";

/** Session expires after 24 hours of inactivity */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type KidSession = { kidId: string; code: string; name: string };

type StoredSession = KidSession & { expiresAt: number };

export function getKidSession(): KidSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredSession;

    // Check expiry
    if (stored.expiresAt && Date.now() > stored.expiresAt) {
      localStorage.removeItem(KEY);
      return null;
    }

    // Refresh TTL on access (sliding window)
    stored.expiresAt = Date.now() + SESSION_TTL_MS;
    localStorage.setItem(KEY, JSON.stringify(stored));

    return { kidId: stored.kidId, code: stored.code, name: stored.name };
  } catch {
    return null;
  }
}

export function setKidSession(s: KidSession) {
  const stored: StoredSession = { ...s, expiresAt: Date.now() + SESSION_TTL_MS };
  localStorage.setItem(KEY, JSON.stringify(stored));
}

export function clearKidSession() {
  localStorage.removeItem(KEY);
}

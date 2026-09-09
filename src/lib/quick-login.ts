// Quick PIN-based parent re-login. Stores credentials in localStorage gated by PIN UI.
// Demo-grade convenience layer; not a security boundary on its own.
const KEY = "centsibility.parent.quicklogin";

export type QuickLogin = { email: string; password: string; pin: string };

export function getQuickLogin(): QuickLogin | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QuickLogin) : null;
  } catch {
    return null;
  }
}

export function saveQuickLogin(q: QuickLogin) {
  localStorage.setItem(KEY, JSON.stringify(q));
}

export function clearQuickLogin() {
  localStorage.removeItem(KEY);
}

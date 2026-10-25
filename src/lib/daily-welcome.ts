import { mytDay } from "@/lib/insight-period";
const sessionSeen = new Set<string>();
type WelcomeStorage = Pick<Storage, "getItem" | "setItem">;

/** Claim before displaying, so a second mount cannot replay today's welcome. */
export function claimDailyWelcome(kidId: string, now = new Date(), getStorage: () => WelcomeStorage = () => window.localStorage, seen = sessionSeen): boolean {
  if (!kidId) return false;
  try {
    const storage = getStorage();
    const key = `centsibility.welcome.${kidId}`;
    const date = mytDay(now);
    if (storage.getItem(key) === date) return false;
    storage.setItem(key, date);
    return true;
  } catch {
    if (seen.has(kidId)) return false;
    seen.add(kidId);
    return true;
  }
}

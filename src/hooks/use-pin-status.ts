import { useEffect, useState } from "react";
import { edgePinStatus, type PinStatus } from "@/lib/edge";

/** Refresh the account counter, including changes on other devices. */
export function usePinStatus(mode: "kid" | "parent", active: boolean) {
  const [status, setStatus] = useState<PinStatus | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let pending = false;
    const refresh = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const next = await edgePinStatus(mode);
        if (!disposed) { setStatus(next); setUnavailable(false); }
      } catch {
        if (!disposed) setUnavailable(true);
      } finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(refresh, 3000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [mode, active]);
  const locked = Boolean(status?.lockedUntil && Date.parse(status.lockedUntil) > Date.now());
  const message = unavailable ? "Attempt status unavailable. Reconnecting…" : locked
    ? "Too many wrong PINs. Wait for the lockout to end."
    : status ? `${status.attemptsLeft} ${status.attemptsLeft === 1 ? "try" : "tries"} left.` : "Checking attempt status…";
  return { status, locked, message };
}

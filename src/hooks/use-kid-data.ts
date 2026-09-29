import { useCallback, useEffect, useRef, useState } from "react";
import { edgeKidGetState } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";
import { cleanApprovalReason } from "@/lib/qard";
import { isKidBypassed } from "@/lib/admin-bypass";
import { DEMO_KID_STATE } from "@/lib/demo-data";
import equal from "fast-deep-equal";

export type KidState = Awaited<ReturnType<typeof edgeKidGetState>>;

const SEEN_KEY = "centsi:kid-seen-resolutions";

function getSeen(): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}");
  } catch {
    return {};
  }
}
function markSeen(ids: string[]) {
  const seen = getSeen();
  ids.forEach((id) => (seen[id] = true));
  localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
}

export function useKidData() {
  const [data, setData] = useState<KidState | null>(() => {
    if (isKidBypassed()) return DEMO_KID_STATE as unknown as KidState;
    return null;
  });
  const [loading, setLoading] = useState(true);
  // Set when the latest fetch failed. Pages keep showing the last good data;
  // with nothing loaded yet they show <KidLoadError> with a retry button.
  const [error, setError] = useState<string | null>(null);
  const firstLoad = useRef(true);

  const refresh = useCallback(async () => {
    const s = getKidSession();
    if (!s) {
      if (isKidBypassed()) {
        setData(DEMO_KID_STATE as unknown as KidState);
      }
      setLoading(false);
      return;
    }
    try {
      const res = await edgeKidGetState({ code: s.code });
      setData((prev: KidState | null) => (equal(prev, res) ? prev : res));
      setError(null);

      // Notify kid about parent decisions
      const seen = getSeen();
      const newlyResolved: string[] = [];
      for (const a of res.approvals) {
        if (!a.resolved_at || a.status === "pending") continue;
        if (seen[a.id]) continue;
        newlyResolved.push(a.id);
        if (firstLoad.current) continue; // skip toast on very first load to avoid spam
        const reasonClean = cleanApprovalReason(a.reason);
        const label =
          a.kind === "QARD"
            ? "Loan"
            : a.kind === "DEPOSIT"
              ? "Deposit"
              : a.kind === "WITHDRAWAL"
                ? "Withdraw"
                : a.kind;
        if (a.status === "approved") {
          sfx.success();
          toast.success(`✅ ${label} approved: ${reasonClean || "RM " + a.amount}`);
        } else {
          sfx.error();
          toast.error(`❌ ${label} declined: ${reasonClean || "RM " + a.amount}`);
        }
      }
      for (const r of res.rewards) {
        if (r.status === "requested") continue;
        if (seen[r.id]) continue;
        newlyResolved.push(r.id);
        if (firstLoad.current) continue;
        if (r.status === "approved") {
          sfx.success();
          toast.success(`🎁 Reward granted: ${r.name}`);
        } else if (r.status === "declined") {
          sfx.error();
          toast.error(`Reward declined: ${r.name}`);
        }
      }
      if (newlyResolved.length) markSeen(newlyResolved);
      firstLoad.current = false;
    } catch (err) {
      console.warn("Failed to fetch kid state from edge function:", err);
      // Demo data only stands in for the DEV demo account. A real account must
      // never show made-up balances because the server could not be reached.
      if (isKidBypassed()) {
        setData((prev) => prev ?? (DEMO_KID_STATE as unknown as KidState));
      } else {
        setError(err instanceof Error ? err.message : "Could not load your account");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll every 20s so the kid sees parent decisions without a manual refresh.
  // Polls pause while the tab is hidden and catch up as soon as it is shown;
  // the first load above always runs, so a page opened in a background tab
  // does not sit on its skeleton.
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const id = setInterval(poll, 20000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [refresh]);

  return { data, loading, error, refresh };
}

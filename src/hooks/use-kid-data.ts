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
    if (document.visibilityState === "hidden") return; // Pause polling when tab is inactive
    try {
      const res = await edgeKidGetState({ code: s.code });
      setData((prev: KidState | null) => (equal(prev, res) ? prev : res));

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
      if (isKidBypassed() || s.code === "AIMAN1" || !data) {
        setData((prev) => prev ?? (DEMO_KID_STATE as unknown as KidState));
      }
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll every 20s so the kid sees parent decisions without a manual refresh
  useEffect(() => {
    const id = setInterval(refresh, 20000);
    return () => clearInterval(id);
  }, [refresh]);

  return { data, loading, refresh };
}

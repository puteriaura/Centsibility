import { useLoadingTransition } from "@/hooks/use-loading-transition";
import { useCallback, useEffect, useRef, useState } from "react";
import { edgeKidGetState } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";
import { cleanApprovalReason } from "@/lib/qard";
import { isKidBypassed } from "@/lib/admin-bypass";
import { DEMO_KID_STATE } from "@/lib/demo-data";
import { approvalKindLabel } from "@/lib/labels";
import equal from "fast-deep-equal";

import type { PennyState } from "@/components/PennyMascot";

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
  const [loading, finishLoading] = useLoadingTransition();
  // Set when the latest fetch failed. Pages keep showing the last good data;
  // with nothing loaded yet they show <KidLoadError> with a retry button.
  const [error, setError] = useState<string | null>(null);
  const [pennyMood, setPennyMood] = useState<PennyState>("idle");
  const firstLoad = useRef(true);
  const prevBalanceRef = useRef<number | null>(null);
  const prevGoalDoneCountRef = useRef<number | null>(null);
  const moodTimerRef = useRef<number | null>(null);

  const triggerMood = useCallback((next: PennyState) => {
    setPennyMood(next);
    if (moodTimerRef.current) window.clearTimeout(moodTimerRef.current);
    moodTimerRef.current = window.setTimeout(() => {
      setPennyMood("idle");
      moodTimerRef.current = null;
    }, 4500);
  }, []);

  const refresh = useCallback(async () => {
    const s = getKidSession();
    if (!s) {
      if (isKidBypassed()) {
        setData(DEMO_KID_STATE as unknown as KidState);
      }
      finishLoading();
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
                : approvalKindLabel(a.kind);
        if (a.status === "approved") {
          sfx.success();
          toast.success(`${label} approved: ${reasonClean || "RM " + a.amount}`);
          triggerMood("money_in");
        } else {
          sfx.error();
          toast.error(`${label} declined: ${reasonClean || "RM " + a.amount}`);
          triggerMood("declined");
        }
      }
      for (const r of res.rewards) {
        if (r.status === "requested") continue;
        if (seen[r.id]) continue;
        newlyResolved.push(r.id);
        if (firstLoad.current) continue;
        if (r.status === "approved") {
          sfx.success();
          toast.success(`Reward granted: ${r.name}`);
        } else if (r.status === "declined") {
          sfx.error();
          toast.error(`Reward declined: ${r.name}`);
        }
      }
      if (newlyResolved.length) markSeen(newlyResolved);

      const nextBal = Number(res.kid?.balance ?? 0);
      const goalDoneCount = (res.goals ?? []).filter((g) => {
        const goal = g as { saved?: unknown; saved_amount?: unknown; target?: unknown; target_amount?: unknown };
        const target = Number(goal.target ?? goal.target_amount ?? 0);
        const saved = Number(goal.saved ?? goal.saved_amount ?? 0);
        return target > 0 && saved >= target;
      }).length;
      if (!firstLoad.current) {
        if (prevGoalDoneCountRef.current !== null && goalDoneCount > prevGoalDoneCountRef.current) {
          triggerMood("goal_reached");
        } else if (prevBalanceRef.current !== null && nextBal > prevBalanceRef.current) {
          triggerMood("money_in");
        }
      }
      prevBalanceRef.current = nextBal;
      prevGoalDoneCountRef.current = goalDoneCount;

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
      finishLoading();
    }
  }, [finishLoading]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll every 20s while a request is pending, otherwise every 60s.
  // Polls pause while the tab is hidden and catch up as soon as it is shown.
  const hasPending = Boolean(data?.approvals?.some((a) => a.status === "pending"));
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const id = setInterval(poll, hasPending ? 20000 : 60000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [refresh, hasPending]);

  return { data, loading, error, refresh, pennyMood, triggerMood };
}

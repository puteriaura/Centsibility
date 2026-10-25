import { useLoadingTransition } from "@/hooks/use-loading-transition";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth";
import equal from "fast-deep-equal";
import { isParentBypassed } from "@/lib/admin-bypass";
import {
  DEMO_KID,
  DEMO_KIDS,
  DEMO_APPROVALS,
  DEMO_REWARDS,
  DEMO_LOANS,
  DEMO_TRANSACTIONS,
  DEMO_NOTIFICATIONS,
  DEMO_SCHEDULED_HIBAHS,
  DEMO_GOALS,
} from "@/lib/demo-data";
import { edgeParentGetKidInvestments, type InvestmentItem } from "@/lib/edge";
import type {
  Kid,
  Approval,
  Reward,
  Loan,
  Transaction,
  Notification,
  ScheduledHibah,
} from "@/types/domain";

export interface ParentGoal {
  kid_id: string;
  saved: number;
}

export type {
  Kid,
  Approval,
  Reward,
  Loan,
  Transaction,
  Notification,
  ScheduledHibah,
};

export function useParentData() {
  const { user } = useAuth();
  const [kids, setKids] = useState<Kid[]>(() =>
    isParentBypassed() ? DEMO_KIDS : [],
  );
  const [goals, setGoals] = useState<ParentGoal[]>(() =>
    isParentBypassed()
      ? DEMO_GOALS.map((g) => ({ kid_id: g.kid_id, saved: Number(g.saved) }))
      : [],
  );
  const [approvals, setApprovals] = useState<Approval[]>(() =>
    isParentBypassed() ? DEMO_APPROVALS : [],
  );
  const [rewards, setRewards] = useState<Reward[]>(() =>
    isParentBypassed() ? DEMO_REWARDS : [],
  );
  const [loans, setLoans] = useState<Loan[]>(() =>
    isParentBypassed() ? DEMO_LOANS : [],
  );
  const [txs, setTxs] = useState<Transaction[]>(() =>
    isParentBypassed() ? DEMO_TRANSACTIONS : [],
  );
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    isParentBypassed() ? DEMO_NOTIFICATIONS : [],
  );
  const [scheduledHibahs, setScheduledHibahs] = useState<ScheduledHibah[]>(
    () => (isParentBypassed() ? DEMO_SCHEDULED_HIBAHS : []),
  );
  const [investmentsByKid, setInvestmentsByKid] = useState<
    Record<string, InvestmentItem[]>
  >({});
  const [loading, finishLoading] = useLoadingTransition();
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(() => isParentBypassed());
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(() =>
    isParentBypassed() ? new Date() : null,
  );

  const refresh = useCallback(async () => {
    if (!user) {
      finishLoading();
      return;
    }
    if (isParentBypassed()) {
      setKids(DEMO_KIDS);
      setGoals(
        DEMO_GOALS.map((g) => ({ kid_id: g.kid_id, saved: Number(g.saved) })),
      );
      setApprovals(DEMO_APPROVALS);
      setRewards(DEMO_REWARDS);
      setLoans(DEMO_LOANS);
      setTxs(DEMO_TRANSACTIONS);
      setNotifications(DEMO_NOTIFICATIONS);
      setScheduledHibahs(DEMO_SCHEDULED_HIBAHS);
      setHasLoaded(true);
      setLastLoadedAt(new Date());
      setError(null);
      finishLoading();
      return;
    }
    try {
      const [k, a, r, l, t, n, g] = await Promise.all([
        supabase
          .from("kids")
          .select(
            "id,parent_id,name,comfort_name,username,login_code,has_pin,balance,coins,unclaimed_coins,xp,level,streak,hibah_rate,trust_score,created_at,invest_balance,invest_rate,invest_last_paid,quiz_date,quiz_correct,quiz_wrong,quiz_index,coins_decimal,avatar,birth_date,birth_year,bio,last_login_date,card_frozen,card_daily_limit,card_online_enabled,card_controls_locked,age_group_override,market_tracker_enabled",
          )
          .order("created_at"),
        supabase
          .from("approvals")
          .select(
            "*, kids!approvals_kid_id_fkey(name), to_kid:kids!approvals_to_kid_id_fkey(name, comfort_name)",
          )
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
        supabase
          .from("rewards")
          .select("*, kids(name)")
          .eq("status", "requested")
          .order("created_at", { ascending: false }),
        supabase
          .from("loans")
          .select("*, kids(name)")
          .order("created_at", { ascending: false }),
        supabase
          .from("transactions")
          .select("*, kids(name)")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(30),
        supabase.from("goals").select("kid_id, saved"),
      ]);

      // Collect .error from the core queries
      const queryResults = [
        { name: "kids", res: k },
        { name: "approvals", res: a },
        { name: "rewards", res: r },
        { name: "loans", res: l },
        { name: "transactions", res: t },
        { name: "notifications", res: n },
        { name: "goals", res: g },
      ];
      const failed = queryResults.find((item) => item.res.error);

      if (failed) {
        console.warn(
          `Failed to fetch ${failed.name} from Supabase:`,
          failed.res.error,
        );
        if (isParentBypassed()) {
          setKids([DEMO_KID]);
          setGoals(
            DEMO_GOALS.map((item) => ({
              kid_id: item.kid_id,
              saved: Number(item.saved),
            })),
          );
          setApprovals(DEMO_APPROVALS);
          setRewards(DEMO_REWARDS);
          setLoans(DEMO_LOANS);
          setTxs(DEMO_TRANSACTIONS);
          setNotifications(DEMO_NOTIFICATIONS);
          setScheduledHibahs(DEMO_SCHEDULED_HIBAHS);
          setHasLoaded(true);
          setLastLoadedAt(new Date());
          setError(null);
        } else {
          setError(failed.res.error?.message || "Could not load parent data");
          // Keep last good data: do not overwrite state arrays
        }
        return;
      }

      // Fetch scheduled_hibahs separately to gracefully handle missing table
      let sh: { data: ScheduledHibah[] | null; error: unknown } = {
        data: [],
        error: null,
      };
      try {
        sh = await supabase
          .from("scheduled_hibahs")
          .select("*")
          .order("next_run_at", { ascending: true });
        if (sh.error) {
          console.warn("Failed to fetch scheduled_hibahs:", sh.error);
        }
      } catch (err) {
        console.warn("Failed to fetch scheduled_hibahs:", err);
        sh = { data: [], error: null };
      }

      setError(null);
      setHasLoaded(true);
      setLastLoadedAt(new Date());

      const hasKids = Boolean(k.data && k.data.length > 0);

      if (!hasKids && isParentBypassed()) {
        // Use demo dataset in bypass mode when no kids are in database
        setKids([DEMO_KID]);
        setGoals(
          DEMO_GOALS.map((item) => ({
            kid_id: item.kid_id,
            saved: Number(item.saved),
          })),
        );
        setApprovals(DEMO_APPROVALS);
        setRewards(DEMO_REWARDS);
        setLoans(DEMO_LOANS);
        setTxs(DEMO_TRANSACTIONS);
        setNotifications(DEMO_NOTIFICATIONS);
        setScheduledHibahs(DEMO_SCHEDULED_HIBAHS);
      } else {
        setKids((prev) =>
          equal(prev, k.data || []) ? prev : ((k.data || []) as Kid[]),
        );
        setGoals((prev) =>
          equal(prev, g.data || [])
            ? prev
            : ((g.data || []) as unknown as ParentGoal[]),
        );
        setApprovals((prev) =>
          equal(prev, a.data || []) ? prev : ((a.data || []) as Approval[]),
        );
        setRewards((prev) =>
          equal(prev, r.data || []) ? prev : ((r.data || []) as Reward[]),
        );
        setLoans((prev) =>
          equal(prev, l.data || []) ? prev : ((l.data || []) as Loan[]),
        );
        setTxs((prev) =>
          equal(prev, t.data || []) ? prev : ((t.data || []) as Transaction[]),
        );
        setNotifications((prev) =>
          equal(prev, n.data || []) ? prev : ((n.data || []) as Notification[]),
        );
        setScheduledHibahs((prev) =>
          equal(prev, sh.data || [])
            ? prev
            : ((sh.data || []) as ScheduledHibah[]),
        );
      }

      // Fetch kid investments
      try {
        const invRes = await edgeParentGetKidInvestments();
        if (invRes?.investmentsByKid) {
          setInvestmentsByKid(invRes.investmentsByKid);
        }
      } catch (err) {
        console.warn("Failed to fetch kid investments:", err);
      }
    } catch (err) {
      console.warn("Failed to fetch parent data from Supabase:", err);
      if (isParentBypassed()) {
        setKids([DEMO_KID]);
        setGoals(
          DEMO_GOALS.map((item) => ({
            kid_id: item.kid_id,
            saved: Number(item.saved),
          })),
        );
        setApprovals(DEMO_APPROVALS);
        setRewards(DEMO_REWARDS);
        setLoans(DEMO_LOANS);
        setTxs(DEMO_TRANSACTIONS);
        setNotifications(DEMO_NOTIFICATIONS);
        setScheduledHibahs(DEMO_SCHEDULED_HIBAHS);
        setHasLoaded(true);
        setLastLoadedAt(new Date());
        setError(null);
      } else {
        setError(
          err instanceof Error ? err.message : "Could not load parent data",
        );
        // Keep last good data: do not overwrite state arrays
      }
    } finally {
      finishLoading();
    }
  }, [user, finishLoading]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll for updates. Polls pause while the tab is hidden and catch up as soon
  // as it is shown; the first load above always runs.
  useEffect(() => {
    if (!user) return;
    const poll = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const interval = setInterval(poll, 20000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [user, refresh]);

  return {
    kids,
    goals,
    approvals,
    rewards,
    loans,
    txs,
    notifications,
    scheduledHibahs,
    investmentsByKid,
    loading,
    error,
    hasLoaded,
    lastLoadedAt,
    refresh,
  };
}

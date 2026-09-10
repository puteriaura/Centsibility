import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth";
import equal from "fast-deep-equal";
import { isParentBypassed } from "@/lib/admin-bypass";
import {
  DEMO_KID,
  DEMO_APPROVALS,
  DEMO_REWARDS,
  DEMO_LOANS,
  DEMO_TRANSACTIONS,
  DEMO_NOTIFICATIONS,
  DEMO_SCHEDULED_HIBAHS,
} from "@/lib/demo-data";
import type {
  Kid,
  Approval,
  Reward,
  Loan,
  Transaction,
  Notification,
  ScheduledHibah,
} from "@/types/domain";

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
  const [kids, setKids] = useState<Kid[]>(() => (isParentBypassed() ? [DEMO_KID] : []));
  const [approvals, setApprovals] = useState<Approval[]>(() =>
    isParentBypassed() ? DEMO_APPROVALS : [],
  );
  const [rewards, setRewards] = useState<Reward[]>(() =>
    isParentBypassed() ? DEMO_REWARDS : [],
  );
  const [loans, setLoans] = useState<Loan[]>(() => (isParentBypassed() ? DEMO_LOANS : []));
  const [txs, setTxs] = useState<Transaction[]>(() =>
    isParentBypassed() ? DEMO_TRANSACTIONS : [],
  );
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    isParentBypassed() ? DEMO_NOTIFICATIONS : [],
  );
  const [scheduledHibahs, setScheduledHibahs] = useState<ScheduledHibah[]>(() =>
    isParentBypassed() ? DEMO_SCHEDULED_HIBAHS : [],
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    if (document.visibilityState === "hidden") return; // Pause polling when tab is inactive
    try {
      const [k, a, r, l, t, n] = await Promise.all([
        supabase.from("kids").select("*").order("created_at"),
        supabase
          .from("approvals")
          .select("*, kids(name)")
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
        supabase
          .from("rewards")
          .select("*, kids(name)")
          .eq("status", "requested")
          .order("created_at", { ascending: false }),
        supabase.from("loans").select("*, kids(name)").order("created_at", { ascending: false }),
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
      ]);

      // Fetch scheduled_hibahs separately to gracefully handle missing table
      let sh: { data: ScheduledHibah[] | null; error: unknown } = { data: [], error: null };
      try {
        sh = await supabase
          .from("scheduled_hibahs")
          .select("*")
          .order("next_run_at", { ascending: true });
      } catch {
        sh = { data: [], error: null };
      }

      const hasKids = Boolean(k.data && k.data.length > 0);

      if (!hasKids && isParentBypassed()) {
        // Use demo dataset in bypass mode when no kids are in database
        setKids([DEMO_KID]);
        setApprovals(DEMO_APPROVALS);
        setRewards(DEMO_REWARDS);
        setLoans(DEMO_LOANS);
        setTxs(DEMO_TRANSACTIONS);
        setNotifications(DEMO_NOTIFICATIONS);
        setScheduledHibahs(DEMO_SCHEDULED_HIBAHS);
      } else {
        setKids((prev) => (equal(prev, k.data || []) ? prev : ((k.data || []) as Kid[])));
        setApprovals((prev) => (equal(prev, a.data || []) ? prev : ((a.data || []) as Approval[])));
        setRewards((prev) => (equal(prev, r.data || []) ? prev : ((r.data || []) as Reward[])));
        setLoans((prev) => (equal(prev, l.data || []) ? prev : ((l.data || []) as Loan[])));
        setTxs((prev) => (equal(prev, t.data || []) ? prev : ((t.data || []) as Transaction[])));
        setNotifications((prev) =>
          equal(prev, n.data || []) ? prev : ((n.data || []) as Notification[]),
        );
        setScheduledHibahs((prev) =>
          equal(prev, sh.data || []) ? prev : ((sh.data || []) as ScheduledHibah[]),
        );
      }
    } catch (err) {
      console.warn("Failed to fetch parent data from Supabase:", err);
      if (isParentBypassed()) {
        setKids([DEMO_KID]);
        setApprovals(DEMO_APPROVALS);
        setRewards(DEMO_REWARDS);
        setLoans(DEMO_LOANS);
        setTxs(DEMO_TRANSACTIONS);
        setNotifications(DEMO_NOTIFICATIONS);
        setScheduledHibahs(DEMO_SCHEDULED_HIBAHS);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Polling for updates
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(refresh, 20000);
    return () => clearInterval(interval);
  }, [user, refresh]);

  return { kids, approvals, rewards, loans, txs, notifications, scheduledHibahs, loading, refresh };
}

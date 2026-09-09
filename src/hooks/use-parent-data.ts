import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth";
import type { Tables } from "@/integrations/supabase/types";
import equal from "fast-deep-equal";

export type Kid = Tables<"kids">;
export type Approval = Tables<"approvals"> & { kids: { name: string } | null };
export type Reward = Tables<"rewards"> & { kids: { name: string } | null };
export type Loan = Tables<"loans"> & { kids: { name: string } | null };
export type Transaction = Tables<"transactions"> & { kids: { name: string } | null };
export type Notification = Tables<"notifications">;
export type ScheduledHibah = Tables<"scheduled_hibahs">;

export function useParentData() {
  const { user } = useAuth();
  const [kids, setKids] = useState<Kid[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [scheduledHibahs, setScheduledHibahs] = useState<ScheduledHibah[]>([]);
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
    } catch (err) {
      console.error("Failed to fetch parent data", err);
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

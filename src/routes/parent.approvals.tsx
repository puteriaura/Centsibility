import { Skeleton } from "@/components/ui/skeleton";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, Card, SectionTitle } from "@/components/AppShell";
import { useParentData } from "@/hooks/use-parent-data";
import {
  edgeParentApproveRequest,
  edgeParentResolveReward,
  edgeParentMarkNotificationsRead,
} from "@/lib/edge";
import { toast } from "sonner";
import {
  Money,
  Star,
  Gift,
  CheckCircle,
  XCircle,
  FlyingSaucer,
  Planet,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/parent/approvals")({
  head: () => ({ meta: [{ title: "Approvals — Centsibility" }] }),
  component: Approvals,
});

function parseQard(reason: string) {
  const [main, sig] = (reason || "").split(" :: SIG::");
  const dueMatch = main.match(/\(due (\d+)d\)/);
  const dueDays = dueMatch ? parseInt(dueMatch[1]) : 14;
  const cleanReason = main.replace(/\(due \d+d\)$/, "").trim();
  return { reason: cleanReason, dueDays, signature: sig || null };
}

function Approvals() {
  const { approvals, rewards, loading, refresh } = useParentData();
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    edgeParentMarkNotificationsRead();
  }, []);

  const [animatingId, setAnimatingId] = useState<string | null>(null);

  const decide = async (id: string, decision: "approve" | "decline") => {
    setBusyId(id);
    if (decision === "approve") {
      setAnimatingId(id);
      // Wait for animation
      await new Promise((r) => setTimeout(r, 1200));
    }

    try {
      await edgeParentApproveRequest({ approvalId: id, decision });
      toast.success(decision === "approve" ? "Transmission Approved" : "Declined");
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setBusyId(null);
      if (decision === "approve") setAnimatingId(null);
    }
  };
  const decideReward = async (id: string, decision: "approve" | "decline") => {
    setBusyId(id);
    if (decision === "approve") {
      setAnimatingId(id);
      await new Promise((r) => setTimeout(r, 1200));
    }

    try {
      await edgeParentResolveReward({ rewardId: id, decision });
      toast.success(decision === "approve" ? "Reward granted" : "Declined");
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setBusyId(null);
      if (decision === "approve") setAnimatingId(null);
    }
  };

  if (loading)
    return (
      <AppShell mode="parent">
        <div className="space-y-3">
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
        </div>
      </AppShell>
    );

  return (
    <AppShell mode="parent">
      <h1 className="font-display text-2xl font-bold text-starlight">Pending Transmissions</h1>
      <p className="font-body text-sm text-starlight/60 mt-1">
        Review and confirm requests from your astronauts.
      </p>

      {approvals.length + rewards.length === 0 && (
        <Card className="mt-5 text-center text-starlight/60 font-body glass-panel shadow-none border border-starlight/10">
          No pending signals.
        </Card>
      )}

      {approvals.length > 0 && <SectionTitle>Money Requests</SectionTitle>}
      <div className="space-y-4">
        <AnimatePresence>
          {approvals.map((a) => {
            const isQard = a.kind === "QARD";
            const parsed = isQard ? parseQard(a.reason) : null;
            const isAnimating = animatingId === a.id;

            if (isAnimating) {
              return (
                <motion.div
                  key={a.id}
                  initial={{ scale: 1, y: 0, borderRadius: "2rem" }}
                  animate={{
                    scale: [1, 0.5, 0.3],
                    y: [0, 50, -800],
                    opacity: [1, 1, 0],
                    rotate: [0, 180, 360],
                  }}
                  transition={{ duration: 1.2, ease: "easeInOut" }}
                  className="mx-auto w-16 h-16 rounded-full bg-neon-mint flex items-center justify-center shadow-neon z-50 relative"
                >
                  <Planet weight="fill" className="w-10 h-10 text-void" />
                </motion.div>
              );
            }

            return (
              <motion.div
                key={a.id}
                layout
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <Card className="glass-panel border-starlight/20 shadow-soft">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="rounded-full bg-void/50 px-3 py-1 font-kid text-[10px] font-bold text-starlight uppercase tracking-widest border border-starlight/10 shadow-inner">
                        {a.kind}
                      </span>
                      <div className="mt-3 font-kid font-bold text-starlight text-lg tracking-wide">
                        {a.kids?.name}
                      </div>
                      <div className="font-body text-sm text-starlight/70 mt-1">
                        {parsed?.reason ?? a.reason}
                      </div>
                      {isQard && (
                        <div className="font-body text-[11px] text-neon-mint mt-1.5 font-bold">
                          Due in {parsed?.dueDays} days
                        </div>
                      )}
                    </div>
                    <div className="font-mono text-xl font-bold text-neon-mint drop-shadow-[0_0_5px_var(--neon-mint)]">
                      RM {a.amount}
                    </div>
                  </div>

                  {isQard && parsed?.signature && (
                    <div className="mt-4 rounded-3xl bg-void/30 p-4 border border-starlight/10 shadow-inner">
                      <div className="font-kid text-[10px] font-bold uppercase tracking-widest text-starlight/50 mb-2">
                        Astronaut's signature
                      </div>
                      <img
                        src={parsed.signature}
                        alt="signature"
                        className="mt-2 w-full rounded-2xl bg-white/10 mix-blend-screen opacity-80"
                      />
                    </div>
                  )}

                  {isQard && (
                    <>
                      {/* Fee breakdown */}
                      <div className="mt-4 rounded-[1.5rem] bg-cosmic-blue/10 border border-cosmic-blue/30 p-4 space-y-2 shadow-sm">
                        <div className="font-kid text-xs font-bold text-starlight mb-2 flex items-center gap-2">
                          <Money weight="duotone" className="w-5 h-5 text-cosmic-blue" /> Loan
                          breakdown
                        </div>
                        <div className="flex justify-between font-body text-xs text-starlight/70">
                          <span>Requested</span>
                          <span className="font-mono font-bold text-starlight">
                            RM {Number(a.amount).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between font-body text-xs text-starlight/70">
                          <span>− Fuel fee</span>
                          <span className="font-mono text-nova-red">− RM 3.00</span>
                        </div>
                        <div className="flex justify-between font-body text-xs text-starlight/70">
                          <span>− Oxygen fee</span>
                          <span className="font-mono text-nova-red">− RM 2.50</span>
                        </div>
                        <div className="border-t border-starlight/20 pt-2 flex justify-between font-kid text-sm font-bold text-starlight">
                          <span>Astronaut receives</span>
                          <span className="font-mono text-neon-mint drop-shadow-[0_0_5px_var(--neon-mint)]">
                            RM {Math.max(0, Number(a.amount) - 5.5).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between font-body text-[10px] text-starlight/50">
                          <span>Astronaut repays</span>
                          <span className="font-mono">RM {Number(a.amount).toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="mt-3 rounded-[1.25rem] bg-void/50 p-3 font-body text-xs text-starlight/60 border border-starlight/10 shadow-sm leading-relaxed">
                        Qard agreement: 0% interest loan. Late repayment lowers trust score (100%
                        Halal).
                      </div>
                    </>
                  )}

                  <div className="mt-5 flex gap-3">
                    <button
                      onClick={() => decide(a.id, "approve")}
                      disabled={busyId === a.id}
                      className="btn-press flex-1 rounded-[1.5rem] bg-neon-mint py-3.5 font-kid text-sm font-bold text-void disabled:opacity-50 shadow-neon flex items-center justify-center gap-2 transition hover:scale-105"
                    >
                      {busyId === a.id ? (
                        "Launching…"
                      ) : (
                        <>
                          <CheckCircle weight="bold" className="w-5 h-5" /> Approve
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => decide(a.id, "decline")}
                      disabled={busyId === a.id}
                      className="btn-press flex-1 rounded-[1.5rem] border border-nova-red/40 bg-void py-3.5 font-kid text-sm font-bold text-nova-red disabled:opacity-50 shadow-sm flex items-center justify-center gap-2 hover:bg-nova-red/10 transition"
                    >
                      <XCircle weight="bold" className="w-5 h-5" /> Decline
                    </button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {rewards.length > 0 && <SectionTitle>Reward Transmissions</SectionTitle>}
      <div className="space-y-4">
        <AnimatePresence>
          {rewards.map((r) => {
            const isAnimating = animatingId === r.id;

            if (isAnimating) {
              return (
                <motion.div
                  key={r.id}
                  initial={{ scale: 1, y: 0, borderRadius: "2rem" }}
                  animate={{
                    scale: [1, 0.5, 0.3],
                    y: [0, 50, -800],
                    opacity: [1, 1, 0],
                    rotate: [0, 180, 360],
                  }}
                  transition={{ duration: 1.2, ease: "easeInOut" }}
                  className="mx-auto w-16 h-16 rounded-full bg-nebula-pink flex items-center justify-center shadow-[0_0_20px_var(--nebula-pink)] z-50 relative"
                >
                  <FlyingSaucer weight="fill" className="w-10 h-10 text-white" />
                </motion.div>
              );
            }

            return (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <Card className="glass-panel border-nebula-pink/30 shadow-soft">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="rounded-full bg-nebula-pink/20 px-3 py-1 font-kid text-[10px] font-bold text-nebula-pink uppercase tracking-widest flex items-center gap-1.5 w-max mb-3 border border-nebula-pink/30 shadow-inner">
                        <Gift weight="fill" className="w-3.5 h-3.5" /> REWARD
                      </span>
                      <div className="mt-1 font-kid text-starlight text-sm">
                        {r.kids?.name} requested:
                      </div>
                      <div className="font-kid font-bold text-lg text-starlight mt-1">
                        "{r.name}"
                      </div>
                    </div>
                    <div className="font-mono text-2xl font-bold text-starlight flex items-center gap-1">
                      {r.cost}{" "}
                      <Star
                        weight="fill"
                        className="w-6 h-6 text-starlight drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]"
                      />
                    </div>
                  </div>
                  <div className="mt-5 flex gap-3">
                    <button
                      onClick={() => decideReward(r.id, "approve")}
                      disabled={busyId === r.id}
                      className="btn-press flex-1 rounded-[1.5rem] bg-nebula-pink py-3.5 font-kid text-sm font-bold text-white disabled:opacity-50 shadow-[0_0_15px_var(--nebula-pink)] flex items-center justify-center gap-2 transition hover:scale-105"
                    >
                      {busyId === r.id ? (
                        "Launching…"
                      ) : (
                        <>
                          <CheckCircle weight="bold" className="w-5 h-5" /> Grant (-{r.cost})
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => decideReward(r.id, "decline")}
                      disabled={busyId === r.id}
                      className="btn-press flex-1 rounded-[1.5rem] border border-starlight/20 bg-void py-3.5 font-kid text-sm font-bold text-starlight disabled:opacity-50 shadow-sm flex items-center justify-center gap-2 hover:bg-white/10 transition"
                    >
                      <XCircle weight="bold" className="w-5 h-5" /> Decline
                    </button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}

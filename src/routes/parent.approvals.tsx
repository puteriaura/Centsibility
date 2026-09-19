import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useParentData } from "@/hooks/use-parent-data";
import {
  edgeParentApproveRequest,
  edgeParentResolveReward,
  edgeParentMarkNotificationsRead,
} from "@/lib/edge";
import { toast } from "sonner";
import { parseQardReason } from "@/lib/qard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppIcon } from "@/components/ui/app-icon";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/parent/approvals")({
  head: () => ({ meta: [{ title: "Approvals — Centsibility" }] }),
  component: Approvals,
});

const parseQard = parseQardReason;

function Approvals() {
  const { approvals, rewards, loading, refresh } = useParentData();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<"requests" | "rewards">("requests");

  useEffect(() => {
    edgeParentMarkNotificationsRead();
  }, []);

  const decide = async (id: string, decision: "approve" | "decline") => {
    setBusyId(id);
    try {
      await edgeParentApproveRequest({ approvalId: id, decision });
      toast.success(decision === "approve" ? "Request Approved" : "Request Declined");
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setBusyId(null);
    }
  };

  const decideReward = async (id: string, decision: "approve" | "decline") => {
    setBusyId(id);
    try {
      await edgeParentResolveReward({ rewardId: id, decision });
      toast.success(decision === "approve" ? "Reward granted" : "Reward declined");
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton style={{ height: "4rem", borderRadius: "16px" }} />
        <Skeleton style={{ height: "12rem", borderRadius: "20px" }} />
        <Skeleton style={{ height: "12rem", borderRadius: "20px" }} />
      </div>
    );
  }

  const totalPending = approvals.length + rewards.length;

  return (
    <div className="space-y-5 pb-12">
      <div>
        <h1 className="settings-page-title">Notifications</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1 mb-0">
          Review money requests and reward wishlists from your children.
        </p>
      </div>

      <div className="segment-tabs" role="tablist" aria-label="Notification categories">
        <button
          type="button"
          role="tab"
          id="tab-req"
          aria-selected={tab === "requests"}
          aria-controls="panel-req"
          className="segment-tab"
          onClick={() => setTab("requests")}
        >
          Alerts
          {approvals.length > 0 ? (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-[var(--error)] text-white text-[10px] font-bold">
              {approvals.length > 99 ? "99+" : approvals.length}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          role="tab"
          id="tab-rew"
          aria-selected={tab === "rewards"}
          aria-controls="panel-rew"
          className="segment-tab"
          onClick={() => setTab("rewards")}
        >
          Rewards
          {rewards.length > 0 ? (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-[var(--error)] text-white text-[10px] font-bold">
              {rewards.length > 99 ? "99+" : rewards.length}
            </span>
          ) : null}
        </button>
      </div>

      {totalPending === 0 && (
        <Card variant="soft" className="p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--success-soft)] text-[var(--success)] flex items-center justify-center mx-auto">
            <AppIcon name="approve" size={24} />
          </div>
          <h3 className="text-base font-bold text-[var(--ink)]">All Clear!</h3>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            No pending child authorization requests at this time.
          </p>
        </Card>
      )}

      {tab === "requests" && (
        <div className="space-y-3" role="tabpanel" id="panel-req" aria-labelledby="tab-req">
          {approvals.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-6 text-center">No money or loan alerts.</p>
          ) : (
            approvals.map((a) => {
              const isQard = a.kind === "QARD";
              const parsed = isQard ? parseQard(a.reason) : null;
              const isBusy = busyId === a.id;

              return (
                <Card
                  key={a.id}
                  variant="default"
                  className="p-5 sm:p-6 space-y-4 border border-[var(--border)] shadow-sm"
                >
                  <div className="notif-item__meta">
                    <span className="notif-item__date">
                      {new Date(a.created_at).toLocaleDateString(undefined, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span className="notif-item__dot" aria-label="Unread" />
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={isQard ? "warning" : "brand"}>
                          {isQard ? "Qard Loan" : a.kind}
                        </Badge>
                        <h3 className="notif-item__title">{a.kids?.name}</h3>
                      </div>
                      <p className="notif-item__body mt-1">{parsed?.reason ?? a.reason}</p>
                      {isQard && parsed?.dueDays && (
                        <p className="text-xs font-semibold text-[var(--primary)] mt-1">
                          Promise to repay in {parsed.dueDays} days
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xl font-extrabold text-[var(--ink)] tabular-nums block">
                        RM {Number(a.amount).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {isQard && parsed?.signature && (
                    <div className="p-3 bg-[var(--surface-soft)] rounded-xl border border-[var(--border)]">
                      <span className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1.5">
                        Child&apos;s Digital Signature:
                      </span>
                      <div className="bg-white p-2 rounded-lg border border-[var(--border)] inline-block max-w-[240px]">
                        <img
                          src={parsed.signature}
                          alt="Signature"
                          className="max-h-16 w-auto object-contain"
                        />
                      </div>
                    </div>
                  )}

                  {isQard && (
                    <div className="p-3.5 rounded-xl bg-[var(--surface-pink)]/50 border border-[var(--primary-soft)] space-y-1.5 text-xs">
                      <strong className="text-[var(--ink)] block mb-1">Loan Settlement Details</strong>
                      <div className="flex justify-between text-[var(--text-secondary)]">
                        <span>Requested Amount</span>
                        <span className="tabular-nums font-semibold">
                          RM {Number(a.amount).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[var(--text-secondary)]">
                        <span>Interest / Admin Charges</span>
                        <span className="text-[var(--success)] font-bold">RM 0.00 (Halal Qard)</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-[var(--border)] font-bold text-[var(--ink)]">
                        <span>Child Repayment Due</span>
                        <span className="tabular-nums text-[var(--primary)]">
                          RM {Number(a.amount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border)]">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => decide(a.id, "decline")}
                    >
                      <AppIcon name="close" size={14} /> Decline
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={isBusy}
                      loading={isBusy}
                      onClick={() => decide(a.id, "approve")}
                    >
                      <AppIcon name="approve" size={14} /> Approve Request
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {tab === "rewards" && (
        <div className="space-y-3" role="tabpanel" id="panel-rew" aria-labelledby="tab-rew">
          {rewards.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-6 text-center">No reward requests.</p>
          ) : (
            rewards.map((r) => {
              const isBusy = busyId === r.id;
              return (
                <Card
                  key={r.id}
                  variant="default"
                  className="p-5 space-y-3 border border-[var(--border)] shadow-sm"
                >
                  <div className="notif-item__meta">
                    <span className="notif-item__date">
                      {new Date(r.created_at).toLocaleDateString(undefined, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span className="notif-item__dot" aria-label="Unread" />
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="soft">Reward Store</Badge>
                        <h4 className="notif-item__title">{r.kids?.name}</h4>
                      </div>
                      <p className="notif-item__body mt-1">
                        Requested: <strong className="text-[var(--ink)]">&ldquo;{r.name}&rdquo;</strong>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-base font-bold text-[var(--primary)] flex items-center gap-1 justify-end">
                        {r.cost} <AppIcon name="star" size={14} />
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border)]">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => decideReward(r.id, "decline")}
                    >
                      <AppIcon name="close" size={14} /> Decline
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={isBusy}
                      loading={isBusy}
                      onClick={() => decideReward(r.id, "approve")}
                    >
                      <AppIcon name="approve" size={14} /> Grant Reward (-{r.cost} pts)
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
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
import { formatDate, formatRM } from "@/lib/format";
import { ParentLoadError } from "@/features/parent/components/ParentLoadError";
import { approvalKindLabel, sanitizeDisplayText } from "@/lib/labels";
import { Money, maskAmounts, usePrivacy } from "@/features/privacy";

type ApprovalsTab = "requests" | "rewards" | "activity";

export const Route = createFileRoute("/parent/approvals")({
  validateSearch: (s: Record<string, unknown>): { tab?: ApprovalsTab } => ({
    tab:
      s.tab === "rewards" || s.tab === "activity" || s.tab === "requests"
        ? s.tab
        : undefined,
  }),
  head: () => ({ meta: [{ title: "Approvals | Centsibility" }] }),
  component: Approvals,
});

const parseQard = parseQardReason;

function Approvals() {
  const {
    approvals,
    rewards,
    notifications,
    loading,
    error,
    hasLoaded,
    lastLoadedAt,
    refresh,
  } = useParentData();
  const { locked } = usePrivacy();
  const search = Route.useSearch();
  const [busyId, setBusyId] = useState<string | null>(null);
  // The bell opens the Activity tab: notifications are marked read on this
  // page, so this is also where their text has to be readable.
  const [tab, setTab] = useState<ApprovalsTab>(search.tab ?? "requests");
  useEffect(() => {
    setTab(search.tab ?? "requests");
  }, [search.tab]);

  useEffect(() => {
    if (tab === "activity") void edgeParentMarkNotificationsRead().then(() => refresh()).catch(console.error);
  }, [tab, refresh]);

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

  if (loading && !hasLoaded && !error) {
    return (
      <div className="space-y-4">
        <Skeleton style={{ height: "4rem", borderRadius: "16px" }} />
        <Skeleton style={{ height: "12rem", borderRadius: "20px" }} />
        <Skeleton style={{ height: "12rem", borderRadius: "20px" }} />
      </div>
    );
  }

  if (error && !hasLoaded) {
    return (
      <div className="space-y-5 pb-12">
        <ParentLoadError variant="page" onRetry={refresh} message={error} />
      </div>
    );
  }

  const totalPending = approvals.length + rewards.length;

  return (
    <div className="space-y-5 pb-12">
      {error && hasLoaded && (
        <ParentLoadError variant="banner" onRetry={refresh} lastLoadedAt={lastLoadedAt} />
      )}
      <p className="text-sm text-[var(--text-2)] m-0">
        Review money requests and reward wishlists from your children.
      </p>

      <div className="segment-tabs" role="tablist" aria-label="Approval categories">
        <button
          type="button"
          role="tab"
          id="tab-req"
          aria-selected={tab === "requests"}
          aria-controls="panel-req"
          className="segment-tab"
          onClick={() => setTab("requests")}
        >
          Requests
          {approvals.length > 0 ? (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-[var(--neg)] text-white text-[11px] font-bold">
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
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-[var(--neg)] text-white text-[11px] font-bold">
              {rewards.length > 99 ? "99+" : rewards.length}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          role="tab"
          id="tab-act"
          aria-selected={tab === "activity"}
          aria-controls="panel-act"
          className="segment-tab"
          onClick={() => setTab("activity")}
        >
          Activity
        </button>
      </div>

      {tab !== "activity" && hasLoaded && !error && totalPending === 0 && (
        <Card variant="soft" className="p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--success-soft)] text-[var(--success-text)] flex items-center justify-center mx-auto">
            <AppIcon name="approve" size={24} />
          </div>
          <h3 className="m-0 text-base font-bold text-[var(--ink)]">All clear</h3>
          <p className="m-0 text-sm text-[var(--text-2)]">
            Nothing is waiting for your approval.
          </p>
        </Card>
      )}

      {tab === "requests" && (
        <div className="space-y-3" role="tabpanel" id="panel-req" aria-labelledby="tab-req">
          {hasLoaded && !error && approvals.length === 0 ? (
            <p className="text-sm text-[var(--text-3)] py-6 text-center">No money or loan requests.</p>
          ) : (
            approvals.map((a) => {
              const isQard = a.kind === "QARD";
              const isTransfer = a.kind === "TRANSFER";
              const parsed = isQard ? parseQard(a.reason) : null;
              const isBusy = busyId === a.id;
              const senderName = a.kids?.name || "Child";
              const recipientName = a.to_kid?.comfort_name || a.to_kid?.name || "Sibling";

              return (
                <Card
                  key={a.id}
                  variant="default"
                  className="p-5 sm:p-6 space-y-4 border border-[var(--border)] shadow-sm"
                >
                  <div className="notif-item__meta">
                    <span className="notif-item__date">
                      {formatDate(a.created_at)}
                    </span>
                    <span className="notif-item__dot" aria-label="Unread" />
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={isQard ? "warning" : isTransfer ? "soft" : "brand"}>
                          {isQard ? "Qard Loan" : isTransfer ? "Transfer Request" : approvalKindLabel(a.kind)}
                        </Badge>
                        <h3 className="notif-item__title">
                          {isTransfer ? `${senderName} → ${recipientName}` : a.kids?.name}
                        </h3>
                      </div>
                      <p className="notif-item__body mt-1">
                        {isTransfer
                          ? (a.reason ? `“${a.reason}” · ${senderName} wants to transfer ${formatRM(Number(a.amount))} to ${recipientName}` : `${senderName} wants to transfer ${formatRM(Number(a.amount))} to ${recipientName}`) // privacy-ok: typing
                          : (parsed?.reason ?? a.reason)}
                      </p>
                      {isQard && parsed?.dueDays && (
                        <p className="text-xs font-semibold text-[var(--primary-text)] mt-1">
                          Promise to repay in {parsed.dueDays} days
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xl font-extrabold text-[var(--ink)] tabular-nums block">
                        <Money amount={Number(a.amount)} />
                      </span>
                    </div>
                  </div>

                  {isQard && parsed?.signature && (
                    <div className="p-3 bg-[var(--surface-soft)] rounded-xl border border-[var(--border)]">
                      <span className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1.5">
                        Child&apos;s Digital Signature:
                      </span>
                      <div className="bg-[var(--surface)] p-2 rounded-lg border border-[var(--border)] inline-block max-w-[240px]">
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
                      <strong className="text-[var(--ink)] block mb-1">Loan settlement details</strong>
                      <div className="flex justify-between text-[var(--text-secondary)]">
                        <span>Requested amount</span>
                        <span className="tabular-nums font-semibold">
                          <Money amount={Number(a.amount)} />
                        </span>
                      </div>
                      <p>Qard Hasan has no interest or fees.</p>
                      <div className="flex justify-between pt-1 border-t border-[var(--border)] font-bold text-[var(--ink)]">
                        <span>Child repayment due</span>
                        <span className="tabular-nums text-[var(--primary-text)]">
                          <Money amount={Number(a.amount)} />
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
                      <AppIcon name="approve" size={14} /> Approve
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
          {hasLoaded && !error && rewards.length === 0 ? (
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
                      {formatDate(r.created_at)}
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
                      <span className="text-base font-bold text-[var(--primary-text)] flex items-center gap-1 justify-end">
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

      {tab === "activity" && (
        <div role="tabpanel" id="panel-act" aria-labelledby="tab-act">
          {notifications.length === 0 ? (
            <p className="text-sm text-[var(--text-3)] py-6 text-center">No activity yet.</p>
          ) : (
            <div className="list-panel">
              {notifications.slice(0, 30).map((n) => {
                const text = maskAmounts(sanitizeDisplayText(n.message), locked);
                const body = (
                  <>
                    <span className="list-row__icon" aria-hidden="true">
                      <AppIcon name="bell" size={18} />
                    </span>
                    <span className="list-row__body">
                      <span className="text-sm font-semibold leading-snug text-[var(--ink)]">{text}</span>
                      <span className="list-row__sub">{formatDate(n.created_at)}</span>
                    </span>
                    {!n.read && <span className="notif-item__dot" aria-label="New" />}
                  </>
                );
                return n.link ? (
                  <Link key={n.id} to={n.link} className="list-row">
                    {body}
                  </Link>
                ) : (
                  <div key={n.id} className="list-row">
                    {body}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

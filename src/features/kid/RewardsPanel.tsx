import { SUGGESTED_REWARDS as SUGGESTED } from "../../../supabase/functions/_shared/reward-catalogue";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/ui/section-title";
import { useKidData } from "@/hooks/use-kid-data";
import { edgeKidRequestReward } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";
import { AppIcon } from "@/components/ui/app-icon";
import { formatDate } from "@/lib/format";
import { useMoneyAction } from "@/hooks/use-money-action";

interface RewardsPanelProps {
  onGoToQuests?: () => void;
}

export function RewardsPanel({ onGoToQuests }: RewardsPanelProps) {
  const { data, refresh } = useKidData();
  const { busy, run } = useMoneyAction();

  if (!data) return null;

  const k = data.kid;
  const code = getKidSession()?.code;
  const totalPoints = Number(k.coins || 0);

  const questsCompleted = Number((data as Record<string, unknown>).questsCompleted ?? 0);
  const quizTotalCorrect = Number((k as Record<string, unknown>).quiz_total_correct ?? 0);
  const rewardsUnlocked = questsCompleted >= 1 || quizTotalCorrect >= 3;

  const submit = async (n: string, cost: number) => {
    if (!code || !n.trim()) return;
    if (cost > totalPoints) {
      sfx.error();
      toast.error(`Not enough points! (Need ${cost.toLocaleString()} pts, you have ${Math.round(totalPoints).toLocaleString()} pts)`);
      return;
    }
    const rewardName = n.trim();
    await run(
      () => edgeKidRequestReward({ code, name: rewardName, cost }),
      {
        success: `Reward request sent: ${rewardName}`,
        failure: "Reward request didn't go through",
        refresh,
      }
    );
  };

  const pending = (data.rewards || []).filter(
    (r: (typeof data.rewards)[number]) => r.status === "requested",
  );
  const history = (data.rewards || []).filter(
    (r: (typeof data.rewards)[number]) => r.status !== "requested",
  );

  return (
    <div className="space-y-6">
      {/* Quick Picks */}
      <div className="space-y-3">
        <SectionTitle>Quick Wishlist Picks</SectionTitle>

        {!rewardsUnlocked && (
          <Card variant="soft" className="p-4 border border-[var(--primary-soft)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--surface-pink)] text-[var(--primary-text)] flex items-center justify-center shrink-0">
                <AppIcon name="lock" size={20} />
              </div>
              <div>
                <strong className="text-xs sm:text-sm text-[var(--ink)] block">
                  Complete 1 Quest to Unlock Rewards
                </strong>
                <small className="text-xs text-[var(--text-secondary)]">
                  Finish your first quest to unlock real-life privileges.
                </small>
              </div>
            </div>
            {onGoToQuests ? (
              <button
                type="button"
                onClick={() => {
                  sfx.tap();
                  onGoToQuests();
                }}
                className="text-xs font-bold text-[var(--primary-text)] hover:underline shrink-0 bg-transparent border-0 cursor-pointer p-0"
              >
                Go to quests
              </button>
            ) : null}
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          {SUGGESTED.map((s) => {
            const hasEnough = totalPoints >= s.cost;
            return (
              <button
                key={s.name}
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!rewardsUnlocked) {
                    toast.error("Complete at least 1 quest to unlock rewards!");
                    return;
                  }
                  void submit(s.name, s.cost);
                }}
                aria-label={
                  !rewardsUnlocked
                    ? "Locked: complete a quest first"
                    : `Request ${s.name} for ${s.cost} points`
                }
                className={`p-4 rounded-2xl border text-left transition-colors duration-150 cursor-pointer min-h-[90px] flex flex-col justify-between ${
                  !rewardsUnlocked
                    ? "bg-[var(--surface)] border-transparent"
                    : hasEnough
                      ? "bg-[var(--surface)] border-transparent hover:border-[var(--primary)] shadow-sm"
                      : "bg-[var(--surface)] border-dashed border-[var(--border)] hover:border-[var(--primary-soft)]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-[var(--surface-pink)] text-[var(--primary-text)] flex items-center justify-center">
                    <AppIcon name={!rewardsUnlocked ? "lock" : s.icon} size={18} />
                  </div>
                  <span className={`inline-flex items-center gap-1 text-sm font-bold ${hasEnough ? "text-[var(--primary-hover)]" : "text-[var(--text-muted)]"}`}>
                    {s.cost.toLocaleString("en-MY")} <AppIcon name="star" size={12} color={hasEnough ? "var(--action-text)" : "var(--text-muted)"} />
                  </span>
                </div>
                <strong className="text-sm font-semibold text-[var(--ink)] line-clamp-2 leading-snug">
                  {s.name}
                </strong>
              </button>
            );
          })}
        </div>
      </div>

      {/* Waiting for Parent Section */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <SectionTitle>Pending Approval</SectionTitle>
          <Card variant="default" className="p-3 divide-y divide-[var(--border)]">
            {pending.map((r: (typeof pending)[number]) => (
              <div key={r.id} className="py-3 px-2 flex items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="flex items-center gap-2.5">
                  <Badge variant="warning">Pending</Badge>
                  <strong className="text-[var(--ink)]">{r.name}</strong>
                </div>
                <span className="font-bold text-[var(--primary-text)] flex items-center gap-1">
                  {r.cost} <AppIcon name="star" size={14} color="var(--primary)" />
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Rewards History */}
      <div className="space-y-3">
        <SectionTitle>Reward Redemptions</SectionTitle>
        {history.length === 0 ? (
          <Card variant="soft" className="p-6 text-center text-xs sm:text-sm text-[var(--text-muted)]">
            No past reward requests. Choose a reward above!
          </Card>
        ) : (
          <Card variant="default" className="p-3 divide-y divide-[var(--border)]">
            {history.map((r: (typeof history)[number]) => (
              <div key={r.id} className="py-3 px-2 flex items-center justify-between gap-3 text-xs sm:text-sm">
                <div>
                  <strong className="text-[var(--ink)] block">{r.name}</strong>
                  <span className="text-xs text-[var(--text-muted)]">
                    {formatDate(r.created_at)} · {r.cost} pts
                  </span>
                </div>
                <div>
                  {r.status === "approved" ? (
                    <Badge variant="success">Granted</Badge>
                  ) : (
                    <Badge variant="error">Declined</Badge>
                  )}
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

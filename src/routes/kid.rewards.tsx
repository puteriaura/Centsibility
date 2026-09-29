import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/ui/section-title";
import { useKidData } from "@/hooks/use-kid-data";
import { KidLoadError } from "@/features/kid/components";
import { edgeKidRequestReward } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";
import { Skeleton } from "@/components/ui/skeleton";
import { NumericKeypad } from "@/components/ui/numeric-keypad";
import { AppIcon } from "@/components/ui/app-icon";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/kid/rewards")({
  head: () => ({ meta: [{ title: "Rewards — Centsibility" }] }),
  component: KidRewards,
});

const SUGGESTED = [
  { name: "Pick the family movie", cost: 2100, icon: "movie" },
  { name: "Special treat or snack", cost: 3000, icon: "treat" },
  { name: "Stay up 30 min late", cost: 6000, icon: "moon" },
  { name: "Toy of my choice", cost: 4500, icon: "game" },
  { name: "Day at the park", cost: 2400, icon: "park" },
  { name: "New book of my choice", cost: 3000, icon: "book" },
  { name: "Cook favourite meal", cost: 2250, icon: "meal" },
  { name: "Fun outing with parent", cost: 3000, icon: "outing" },
];

function KidRewards() {
  const { data, loading, error, refresh } = useKidData();
  const [name, setName] = useState("");
  const [rawPts, setRawPts] = useState("");

  if (!data && error) return <KidLoadError onRetry={refresh} />;
  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton style={{ height: "8rem", borderRadius: "20px" }} />
        <Skeleton style={{ height: "12rem", borderRadius: "20px" }} />
        <Skeleton style={{ height: "12rem", borderRadius: "20px" }} />
      </div>
    );
  }

  const k = data.kid;
  const code = getKidSession()?.code;
  const totalPoints = Number(k.coins);
  const maxPts = Math.max(1, Math.floor(totalPoints));
  const parsedPts = Math.min(parseInt(rawPts || "0", 10), maxPts);

  const quizTotalCorrect = Number((k as Record<string, unknown>).quiz_total_correct ?? 0);
  const QUIZ_GATE = 3;
  const quizUnlocked = quizTotalCorrect >= QUIZ_GATE;

  const submit = async (n: string, cost: number) => {
    if (!code || !n.trim()) return;
    if (cost > totalPoints) {
      sfx.error();
      toast.error("Not enough points!");
      return;
    }
    try {
      await edgeKidRequestReward({ code, name: n.trim(), cost });
      sfx.success();
      toast.success("Reward request sent to parent!");
      setName("");
      setRawPts("");
      refresh();
    } catch (e: unknown) {
      sfx.error();
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  const pressKey = (key: string) => {
    if (key === "⌫") {
      setRawPts((r) => r.slice(0, -1));
      return;
    }
    setRawPts((r) => {
      const next = r + key;
      const val = parseInt(next, 10);
      if (val > maxPts) return r;
      return next.slice(0, 6);
    });
  };

  const pending = data.rewards.filter(
    (r: (typeof data.rewards)[number]) => r.status === "requested",
  );
  const history = data.rewards.filter(
    (r: (typeof data.rewards)[number]) => r.status !== "requested",
  );

  return (
    <div className="space-y-6 pb-12">
      <section className="deposit-hero" aria-label="Available reward points">
        <div className="deposit-hero__copy">
          <p className="deposit-hero__label">Available points</p>
          <p className="deposit-hero__amount tabular-nums">{totalPoints.toLocaleString()}</p>
          <p className="deposit-hero__link" style={{ cursor: "default", textDecoration: "none" }}>
            Earn more from quests &amp; savings
          </p>
        </div>
        <div className="deposit-hero__mascot" aria-hidden="true">
          <AppIcon name="star" size={32} color="#fff" />
        </div>
      </section>

      <div>
        <h1 className="text-lg font-bold text-[var(--ink)] m-0">Reward Store</h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5 mb-0">
          Redeem points for real-life privileges. Parent approves.
        </p>
      </div>

      {/* Quick Picks */}
      <div className="space-y-3">
        <SectionTitle>Quick Wishlist Picks</SectionTitle>

        {!quizUnlocked && (
          <Card variant="soft" className="p-4 border border-[var(--primary-soft)] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--surface-pink)] text-[var(--primary-text)] flex items-center justify-center shrink-0">
              <AppIcon name="lock" size={20} />
            </div>
            <div>
              <strong className="text-xs sm:text-sm text-[var(--ink)] block">
                Answer {QUIZ_GATE} Quiz Questions to Unlock
              </strong>
              <small className="text-xs text-[var(--text-secondary)]">
                Current progress: {quizTotalCorrect}/{QUIZ_GATE} completed
              </small>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          {SUGGESTED.map((s) => {
            const can = quizUnlocked && totalPoints >= s.cost;
            return (
              <button
                key={s.name}
                type="button"
                onClick={() => can && submit(s.name, s.cost)}
                disabled={!can}
                aria-label={
                  !quizUnlocked
                    ? `Locked — complete ${QUIZ_GATE} quiz answers first`
                    : `Request ${s.name} for ${s.cost} points`
                }
                className={`p-4 rounded-2xl border text-left transition-all duration-150 cursor-pointer min-h-[90px] flex flex-col justify-between disabled:opacity-100 ${
                  !quizUnlocked
                    ? "bg-white border-transparent cursor-not-allowed"
                    : can
                      ? "bg-white border-transparent hover:border-[var(--primary)]"
                      : "bg-white border-transparent cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-[var(--surface-pink)] text-[var(--primary-text)] flex items-center justify-center">
                    <AppIcon name={!quizUnlocked ? "lock" : s.icon} size={18} />
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-[var(--primary-hover)]">
                    {s.cost.toLocaleString("en-MY")} <AppIcon name="star" size={12} color="var(--primary)" />
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

      {/* Custom Reward Request */}
      <div className="space-y-3">
        <SectionTitle>Custom Reward</SectionTitle>
        <Card variant="default" className="p-5 space-y-4 border border-[var(--border)]">
          <Input
            label="What reward would you like?"
            id="reward-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="E.g. Visit science museum, new coloring set"
            maxLength={100}
          />

          <div>
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1.5">
              <span>Points to Spend</span>
              <span>Balance: <strong>{totalPoints.toFixed(0)} pts</strong></span>
            </div>
            <div className="p-4 rounded-xl bg-[var(--surface-soft)] border border-[var(--border)] text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-[var(--primary-text)] flex items-center justify-center gap-1.5 tabular-nums">
                {parsedPts.toLocaleString()}
                <AppIcon name="star" size={20} />
              </div>
              {parsedPts > 0 && (
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  of {maxPts.toLocaleString()} points available
                </p>
              )}
            </div>
          </div>

          <NumericKeypad onKeyPress={pressKey} />

          <Button
            type="button"
            variant="primary"
            onClick={() => submit(name, parsedPts)}
            disabled={!name.trim() || parsedPts < 1 || parsedPts > totalPoints}
            className="w-full justify-center text-sm font-bold min-h-[48px]"
          >
            Submit Request for {parsedPts.toLocaleString()} Points
          </Button>
        </Card>
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

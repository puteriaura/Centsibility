import { kidLevel } from "@/lib/kid-level";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AppIcon } from "@/components/ui/app-icon";
import { useKidData } from "@/hooks/use-kid-data";
import { getKidSession } from "@/lib/kid-session";
import { isKidBypassed } from "@/lib/admin-bypass";
import {
  edgeKidQuestBoard,
  extractEdgeErrorMessage,
  type QuestNode,
} from "@/lib/edge";
import { sfx } from "@/lib/sounds";
import { RewardsPanel } from "@/features/kid/RewardsPanel";
import { StreakBadge } from "@/components/StreakBadge";

interface MissionsSearch {
  tab?: "quests" | "rewards";
}

export const Route = createFileRoute("/kid/missions")({
  validateSearch: (search: Record<string, unknown>): MissionsSearch => ({
    tab: search.tab === "rewards" ? "rewards" : "quests",
  }),
  head: () => ({ meta: [{ title: "Missions | Centsibility" }] }),
  component: KidMissionsPage,
});

function KidMissionsPage() {
  const { tab = "quests" } = Route.useSearch();
  const navigate = useNavigate();
  const { data: kidState, loading: kidLoading, refresh } = useKidData();

  const [quests, setQuests] = useState<QuestNode[]>([]);
  const [boardAgeGroup, setBoardAgeGroup] = useState<string>("10-12");
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState<string | null>(null);

  const fetchBoard = async () => {
    setBoardLoading(true);
    setBoardError(null);
    const session = getKidSession();
    const code = session?.code || (isKidBypassed() ? "demo-code" : "");

    if (!code) {
      setBoardError("Sign in to access quests.");
      setBoardLoading(false);
      return;
    }

    try {
      const res = await edgeKidQuestBoard({ code });
      setQuests(res.quests || []);
      setBoardAgeGroup(res.ageGroup || "10-12");
    } catch (err) {
      setBoardError(await extractEdgeErrorMessage(err));
    } finally {
      setBoardLoading(false);
    }
  };

  useEffect(() => {
    void fetchBoard();
  }, []);

  const setTab = (newTab: "quests" | "rewards") => {
    sfx.tap();
    void navigate({
      to: "/kid/missions",
      search: { tab: newTab },
      replace: true,
    });
  };

  const kid = kidState?.kid;
  const coins = Number(kid?.coins ?? 0);
  const { level } = kidLevel(kid);
  const streak = Number(kid?.streak ?? 1);
  const ageGroup = String(
    boardAgeGroup || (kidState as Record<string, unknown>)?.ageGroup || "10-12",
  );

  const completedCount = quests.filter((q) => q.status === "done").length;
  const totalQuests = quests.length || 8;
  const progressPct =
    totalQuests > 0 ? Math.round((completedCount / totalQuests) * 100) : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Stat Strip */}
      <section
        className="deposit-hero"
        aria-label="Missions & Rewards overview"
      >
        <div className="deposit-hero__copy">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--blue-800)] text-white">
              {ageGroup === "6-9"
                ? "Little Savers · ages 6 to 9"
                : ageGroup === "13-17"
                  ? "Money Pros · ages 13 to 17"
                  : "Smart Savers · ages 10 to 12"}
            </span>
            <StreakBadge count={streak} />
          </div>
          <p className="deposit-hero__label">Total points</p>
          <div className="flex items-baseline gap-2">
            <p className="deposit-hero__amount tabular-nums">
              {coins.toLocaleString()}
            </p>
            <span className="text-sm font-bold text-white">
              pts · Lvl {level}
            </span>
          </div>
        </div>
        <div className="deposit-hero__mascot" aria-hidden="true">
          <AppIcon name="star" size={32} color="#fff" />
        </div>
      </section>

      {/* Segmented Control Tabs */}
      <div className="flex items-center p-1 bg-[var(--surface-soft)] rounded-2xl border border-[var(--border)]">
        <button
          type="button"
          onClick={() => setTab("quests")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 cursor-pointer border-0 ${
            tab === "quests"
              ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm"
              : "bg-transparent text-[var(--text-secondary)] hover:text-[var(--ink)]"
          }`}
          aria-selected={tab === "quests"}
          role="tab"
        >
          <span className="flex items-center justify-center gap-2">
            <AppIcon name="missions" size={16} />
            Quests
            {completedCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[var(--surface-pink)] text-[var(--primary-text)]">
                {completedCount}/{totalQuests}
              </span>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("rewards")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 cursor-pointer border-0 ${
            tab === "rewards"
              ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm"
              : "bg-transparent text-[var(--text-secondary)] hover:text-[var(--ink)]"
          }`}
          aria-selected={tab === "rewards"}
          role="tab"
        >
          <span className="flex items-center justify-center gap-2">
            <AppIcon name="gift" size={16} />
            Reward Store
          </span>
        </button>
      </div>

      {/* Quests Tab Content */}
      {tab === "quests" && (
        <div className="space-y-4">
          {/* Progress Card */}
          <Card
            variant="soft"
            className="p-4 border border-[var(--border)] space-y-2"
          >
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <strong className="text-[var(--ink)] font-bold">
                Quest Journey
              </strong>
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                {completedCount} of {totalQuests} quests completed
              </span>
            </div>
            <div className="w-full bg-[var(--surface-muted)] rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-[var(--primary)] h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </Card>

          {boardLoading ? (
            <div className="space-y-3">
              <Skeleton style={{ height: "5.5rem", borderRadius: "20px" }} />
              <Skeleton style={{ height: "5.5rem", borderRadius: "20px" }} />
              <Skeleton style={{ height: "5.5rem", borderRadius: "20px" }} />
              <Skeleton style={{ height: "5.5rem", borderRadius: "20px" }} />
            </div>
          ) : boardError ? (
            <Card variant="soft" className="p-6 text-center space-y-3">
              <p className="text-sm text-[var(--error)] font-semibold">
                {boardError}
              </p>
              <button
                type="button"
                onClick={() => void fetchBoard()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--primary)] text-white border-0 cursor-pointer"
              >
                Try Again
              </button>
            </Card>
          ) : (
            <div className="space-y-3" role="feed" aria-label="Quest track">
              {quests.map((q, idx) => {
                const isLocked = q.status === "locked";
                const isDone = q.status === "done";
                const prevTitle = idx > 0 ? quests[idx - 1].title : null;
                const cardContent = (
                  <Card
                    variant={isDone ? "soft" : "default"}
                    className={`p-4 border transition-all duration-150 flex items-center justify-between gap-3 ${
                      isLocked
                        ? "opacity-60 bg-[var(--surface-soft)] border-transparent cursor-not-allowed"
                        : "hover:border-[var(--primary)] shadow-sm cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                          isDone
                            ? "bg-[var(--success-soft)] text-[var(--success)]"
                            : isLocked
                              ? "bg-[var(--surface-muted)] text-[var(--text-muted)]"
                              : "bg-[var(--surface-pink)] text-[var(--primary-text)]"
                        }`}
                      >
                        <AppIcon
                          name={isLocked ? "lock" : q.icon || "quest"}
                          size={22}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[var(--text-muted)]">
                            Quest {q.position}
                          </span>
                          <span className="text-[11px] font-bold text-[var(--primary-hover)]">
                            +{q.points} pts
                          </span>
                        </div>
                        <h2 className="text-sm font-bold text-[var(--ink)] truncate m-0">
                          {q.title}
                        </h2>
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-1 mt-0.5 mb-0">
                          {isLocked && prevTitle ? `Finish ${prevTitle} to unlock` : q.summary}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {isDone ? (
                        <>
                          <Badge variant="success">Done</Badge>
                          {q.bestCorrect !== null && (
                            <span className="text-[11px] text-[var(--text-muted)] font-medium">
                              Score: {q.bestCorrect}/{q.questionCount}
                            </span>
                          )}
                        </>
                      ) : isLocked ? (
                        <Badge variant="outline">Locked</Badge>
                      ) : (
                        <span className="inline-flex h-8 items-center rounded-full bg-[var(--action)] px-4 text-xs font-bold text-white">
                          Start
                        </span>
                      )}
                    </div>
                  </Card>
                );

                if (isLocked) {
                  return (
                    <div key={q.id} aria-disabled="true">
                      {cardContent}
                    </div>
                  );
                }

                return (
                  <Link
                    key={q.id}
                    to="/kid/quest/$questId"
                    params={{ questId: q.id }}
                    onClick={() => sfx.tap()}
                    className="no-underline block"
                  >
                    {cardContent}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Rewards Tab Content */}
      {tab === "rewards" && (
        <RewardsPanel onGoToQuests={() => setTab("quests")} />
      )}
    </div>
  );
}

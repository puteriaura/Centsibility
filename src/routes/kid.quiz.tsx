import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SectionTitle } from "@/components/ui/section-title";
import { useKidData } from "@/hooks/use-kid-data";
import { KidLoadError } from "@/features/kid/components";
import { edgeKidQuizState, edgeKidQuizAnswer } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { ALL_QUESTIONS } from "@/data/quiz-bank";
import { AppIcon } from "@/components/ui/app-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/kid/quiz")({
  head: () => ({ meta: [{ title: "Daily Quest — Centsibility" }] }),
  component: KidQuiz,
});

const MAX = 5;
const MAX_WRONG = 2;
const PTS_PER_CORRECT = 100;

function KidQuiz() {
  const [state, setState] = useState<{ correct: number; wrong: number; index: number } | null>(
    null,
  );
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, error, refresh } = useKidData();

  const code = getKidSession()?.code;

  useEffect(() => {
    (async () => {
      if (!code) return;
      const s = await edgeKidQuizState({ code });
      setState({ correct: s.correct, wrong: s.wrong, index: s.index });
    })();
  }, [code]);

  if (!data && error) return <KidLoadError onRetry={refresh} />;
  if (!state) {
    return (
      <div className="space-y-4">
        <Skeleton style={{ height: "4rem", borderRadius: "16px" }} />
        <Skeleton style={{ height: "14rem", borderRadius: "20px" }} />
      </div>
    );
  }

  const totalPoints = Math.round(Number(data?.kid.coins ?? 0));
  const done = state.correct >= MAX;
  const q = ALL_QUESTIONS[state.index % ALL_QUESTIONS.length];
  const livesLeft = MAX_WRONG - state.wrong;

  const submit = async () => {
    if (picked === null || !code) return;
    setBusy(true);
    const isCorrect = picked === q.answer;
    try {
      const res = await edgeKidQuizAnswer({ code, correct: isCorrect });
      setState({ correct: res.correct, wrong: res.wrong, index: res.index });
      if (isCorrect) {
        sfx.success();
        toast.success(`+${PTS_PER_CORRECT} points earned!`);
      } else {
        sfx.error();
        toast.error("Not quite! Try again next question.");
      }
      if (res.cycled) toast.info("New round started! Keep going.");
      setTimeout(() => setPicked(null), 700);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setBusy(false);
    }
  };

  const tiers = [
    { pts: 100, label: "1 correct", icon: "approve", need: 1 },
    { pts: 200, label: "2 correct", icon: "trend", need: 2 },
    { pts: 500, label: "4 correct", icon: "star", need: 4 },
    { pts: 1000, label: "All 5", icon: "trophy", need: 5 },
  ];

  if (done) {
    return (
      <div className="space-y-6 pb-12">
        <PointsHeader totalPoints={totalPoints} />

        <Card variant="default" className="p-8 text-center space-y-4 border-2 border-[var(--primary)]/20 shadow-md">
          <div className="w-16 h-16 rounded-2xl bg-[var(--surface-pink)] text-[var(--primary-text)] flex items-center justify-center mx-auto shadow-sm">
            <AppIcon name="trophy" size={36} />
          </div>
          <h2 className="text-2xl font-extrabold text-[var(--ink)]">Mashallah! Quest Complete!</h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-sm mx-auto">
            You solved 5 questions today and earned{" "}
            <strong className="text-[var(--primary-text)] font-bold">{MAX * PTS_PER_CORRECT}</strong> bonus points!
          </p>
          <div className="pt-2">
            <Link to="/kid/rewards">
              <Button variant="primary" className="mx-auto">
                <AppIcon name="gift" size={16} />
                Visit Rewards Store →
              </Button>
            </Link>
          </div>
        </Card>

        {/* Reward milestones summary */}
        <Card variant="soft" className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AppIcon name="gift" size={18} color="var(--primary)" />
            <span className="text-sm font-bold text-[var(--ink)]">Quest Rewards Tiers</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tiers.map((tier) => (
              <div
                key={tier.pts}
                className="p-2.5 rounded-xl text-center bg-white border border-[var(--border)]"
              >
                <div className="text-sm font-bold text-[var(--primary-text)]">{tier.pts}</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{tier.label}</div>
              </div>
            ))}
          </div>
        </Card>

        <QuizHistory attempts={data?.attempts ?? []} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <section className="deposit-hero" aria-label="Daily quest progress">
        <div className="deposit-hero__copy">
          <p className="deposit-hero__label">Penny · Daily quest</p>
          <p className="deposit-hero__amount tabular-nums">
            {state ? `${state.correct + state.wrong}/${MAX}` : "…"}
          </p>
          <p className="deposit-hero__link" style={{ cursor: "default", textDecoration: "none" }}>
            {totalPoints} points · {MAX_WRONG - (state?.wrong ?? 0)} lives left
          </p>
        </div>
        <div className="deposit-hero__mascot" aria-hidden="true">
          <AppIcon name="penny" size={32} color="#fff" />
        </div>
      </section>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-[var(--ink)] m-0">
            Learn & earn
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5 mb-0">
            Shariah principles in bite-sized quizzes.
          </p>
        </div>
        <PointsHeader totalPoints={totalPoints} />
      </div>

      {/* Progress & Lives Indicator */}
      <Card variant="default" className="p-4 sm:p-5 space-y-3 border border-[var(--border)]">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-[var(--text-secondary)]">Daily Quest Progress</span>
          <span className="text-[var(--primary-text)] font-bold">
            {state.correct} of {MAX} Questions Solved
          </span>
        </div>
        <Progress value={state.correct} max={MAX} height={8} />
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-1">
          <span className="flex items-center gap-1">
            Lives remaining: <strong className="text-[var(--ink)]">{livesLeft} / {MAX_WRONG}</strong>
          </span>
          <span className="text-[var(--success-text)] font-medium">+{PTS_PER_CORRECT} pts each</span>
        </div>
      </Card>

      {/* Question Card */}
      <Card variant="default" className="p-5 sm:p-6 space-y-5 border border-[var(--border)] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--surface-pink)] text-[var(--primary-text)] flex items-center justify-center shrink-0">
            <AppIcon name="brain" size={20} />
          </div>
          <span className="text-xs font-bold text-[var(--primary-text)] uppercase tracking-wider">
            Question #{((state.index % ALL_QUESTIONS.length) + 1)}
          </span>
        </div>

        <h2 className="text-base sm:text-lg font-bold text-[var(--ink)] leading-snug">
          {q.q}
        </h2>

        {/* Options */}
        <div className="space-y-2.5">
          {q.options.map((option, i) => {
            const isSelected = picked === i;
            return (
              <button
                key={i}
                type="button"
                disabled={busy}
                onClick={() => {
                  sfx.tap();
                  setPicked(i);
                }}
                className={`w-full flex items-center gap-3 p-3.5 sm:p-4 rounded-xl text-left text-sm font-medium transition-all duration-150 cursor-pointer min-h-[48px] border ${
                  isSelected
                    ? "border-[var(--primary)] bg-[var(--surface-pink)] text-[var(--primary-text)] font-bold shadow-xs"
                    : "border-[var(--border)] bg-white text-[var(--ink)] hover:bg-[var(--surface-soft)]"
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 border ${
                    isSelected
                      ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                      : "bg-[var(--surface-soft)] text-[var(--text-secondary)] border-[var(--border)]"
                  }`}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="leading-snug">{option}</span>
              </button>
            );
          })}
        </div>

        {/* Submit button */}
        <Button
          type="button"
          variant="primary"
          onClick={submit}
          disabled={picked === null || busy}
          loading={busy}
          className="w-full justify-center text-sm font-bold min-h-[48px]"
        >
          {busy ? "Checking Answer…" : "Confirm Answer"}
        </Button>
      </Card>

      {/* Quest Reward Milestones */}
      <div className="space-y-3">
        <SectionTitle>Reward Milestones</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {tiers.map((tier) => {
            const unlocked = state.correct >= tier.need;
            return (
              <Card
                key={tier.pts}
                variant="default"
                className={`p-3.5 rounded-xl text-center border transition-all duration-150 ${
                  unlocked
                    ? "border-[var(--primary)] bg-[var(--surface-pink)]/40"
                    : "border-[var(--border)] bg-white opacity-60"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-1.5 ${
                    unlocked
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--surface-soft)] text-[var(--text-muted)]"
                  }`}
                >
                  <AppIcon name={tier.icon} size={16} />
                </div>
                <div className="text-base font-bold text-[var(--ink)]">{tier.pts} pts</div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{tier.label}</div>
              </Card>
            );
          })}
        </div>
      </div>

      <QuizHistory attempts={data?.attempts ?? []} />
    </div>
  );
}

function PointsHeader({ totalPoints }: { totalPoints: number }) {
  return (
    <div className="shrink-0 flex items-center gap-1.5 bg-[var(--surface-pink)] text-[var(--primary-text)] px-3.5 py-1.5 rounded-full text-xs font-bold border border-[var(--primary-soft)]">
      <AppIcon name="star" size={14} />
      <span>{totalPoints.toLocaleString()} Points</span>
    </div>
  );
}

function QuizHistory({
  attempts,
}: {
  attempts: { id: string; correct: boolean; question_text: string; created_at: string }[];
}) {
  if (attempts.length === 0) return null;
  return (
    <div className="space-y-3">
      <SectionTitle>Recent Quiz Questions</SectionTitle>
      <Card variant="default" className="p-3 divide-y divide-[var(--border)]">
        {attempts.slice(0, 15).map((a) => (
          <div key={a.id} className="py-2.5 px-2 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                  a.correct
                    ? "bg-[var(--success-soft)] text-[var(--success-text)]"
                    : "bg-[var(--error-soft)] text-[var(--error-text)]"
                }`}
              >
                <AppIcon name={a.correct ? "approve" : "close"} size={13} />
              </div>
              <span className="text-[var(--ink)] font-medium truncate">{a.question_text}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[var(--text-muted)]">
                {formatDate(a.created_at)}
              </span>
              {a.correct && (
                <span className="text-[var(--success-text)] font-bold">+{PTS_PER_CORRECT}</span>
              )}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

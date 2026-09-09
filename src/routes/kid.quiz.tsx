import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, Card, SectionTitle } from "@/components/AppShell";
import { useKidData } from "@/hooks/use-kid-data";
import { edgeKidQuizState, edgeKidQuizAnswer } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { ALL_QUESTIONS } from "@/lib/quiz-bank";
import { toast } from "sonner";
import {
  Trophy,
  TrendUp,
  Star,
  Heart,
  CheckCircle,
  XCircle,
  Brain,
  Gift,
  Check,
  X as XIcon,
  GameController,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/kid/quiz")({
  head: () => ({ meta: [{ title: "Daily Quest — Centsibility" }] }),
  component: KidQuiz,
});

const MAX = 5;
const MAX_WRONG = 2;

/* Points awarded per correct answer (shown as integer pts) */
const PTS_PER_CORRECT = 100; // displayed; the DB still credits 0.4 coins internally

function KidQuiz() {
  const [state, setState] = useState<{ correct: number; wrong: number; index: number } | null>(
    null,
  );
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, refresh } = useKidData();

  const code = getKidSession()?.code;

  useEffect(() => {
    (async () => {
      if (!code) return;
      const s = await edgeKidQuizState({ code });
      setState({ correct: s.correct, wrong: s.wrong, index: s.index });
    })();
  }, [code]);

  if (!state)
    return (
      <AppShell mode="kid">
        <Card>Loading…</Card>
      </AppShell>
    );

  const totalPoints = Math.round(Number(data?.kid.coins ?? 0));
  const done = state.correct >= MAX;
  const q = ALL_QUESTIONS[state.index % ALL_QUESTIONS.length];

  const submit = async () => {
    if (picked === null || !code) return;
    setBusy(true);
    const isCorrect = picked === q.answer;
    try {
      const res = await edgeKidQuizAnswer({ code, correct: isCorrect });
      setState({ correct: res.correct, wrong: res.wrong, index: res.index });
      if (isCorrect) toast.success(`✅ +${PTS_PER_CORRECT} pts`);
      else toast.error("❌ Not quite");
      if (res.cycled) toast.info("🔁 New round! Try again.");
      setTimeout(() => setPicked(null), 700);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setBusy(false);
    }
  };

  /* ── Done screen ── */
  if (done) {
    return (
      <AppShell mode="kid">
        {/* Points balance header */}
        <PointsHeader totalPoints={totalPoints} />

        <Card className="text-center mt-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-emerald-halal/30">
          <div className="flex justify-center mb-4 text-emerald-halal opacity-90">
            <Trophy weight="duotone" className="w-16 h-16" />
          </div>
          <h2 className="mt-4 font-display text-3xl text-charcoal">Mashallah!</h2>
          <p className="mt-2 font-body text-slate-parent">
            5 correct today · <span className="font-mono font-bold">{MAX * PTS_PER_CORRECT}</span>{" "}
            pts earned
          </p>
          <p className="mt-4 font-body text-xs text-pewter">
            Come back tomorrow for a fresh quest.
          </p>
        </Card>

        {/* Points breakdown */}
        <Card className="mt-4 bg-gradient-to-br from-sunny/20 to-emerald-halal/10 border border-emerald-halal/20 shadow-soft">
          <p className="font-kid text-xs font-bold text-pewter uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Gift weight="duotone" className="w-4 h-4 text-emerald-halal" /> Quest Rewards
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[100, 200, 500, 1000].map((pts) => (
              <div key={pts} className="rounded-2xl bg-white/70 p-2 text-center shadow-soft">
                <div className="font-mono text-sm font-bold text-charcoal">{pts}</div>
                <div className="font-kid text-[9px] text-pewter">pts</div>
              </div>
            ))}
          </div>
          <p className="mt-3 font-body text-[11px] text-pewter text-center flex items-center justify-center gap-1">
            Use your points in the Reward store{" "}
            <Star weight="fill" className="w-3.5 h-3.5 text-gold-nur" />
          </p>
        </Card>

        <QuizHistory attempts={data?.attempts ?? []} />
      </AppShell>
    );
  }

  const isPicked = picked !== null;

  return (
    <AppShell mode="kid">
      {/* Points balance header */}
      <PointsHeader totalPoints={totalPoints} />

      <div className="mt-4 flex items-center justify-between">
        <h1 className="font-display text-2xl text-charcoal flex items-center gap-2">
          <GameController weight="duotone" className="w-8 h-8 text-sunny" />
          Daily Quest
        </h1>
        <span className="font-mono text-sm text-pewter">
          {state.correct} / {MAX}
        </span>
      </div>

      {/* Progress dots */}
      <div className="mt-3 flex gap-2">
        {Array.from({ length: MAX }).map((_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-all ${i < state.correct ? "bg-emerald-halal" : "bg-cream"}`}
          />
        ))}
      </div>
      <p className="mt-3 text-center font-kid text-xs text-pewter flex items-center justify-center gap-1.5">
        Lives:{" "}
        {Array.from({ length: MAX_WRONG }).map((_, i) => (
          <Heart
            key={i}
            weight={i < MAX_WRONG - state.wrong ? "fill" : "regular"}
            className={`w-3.5 h-3.5 ${i < MAX_WRONG - state.wrong ? "text-coral" : "text-pewter"}`}
          />
        ))}{" "}
        · 2 wrong = round resets
      </p>

      {/* Points per question teaser */}
      <div className="mt-3 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sunny/30 px-3 py-1 font-kid text-[11px] font-bold text-charcoal shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)] border border-sunny/40">
          +{PTS_PER_CORRECT} pts per correct answer{" "}
          <Star weight="fill" className="w-3.5 h-3.5 text-gold-nur" />
        </span>
      </div>

      {/* Question card */}
      <Card className="mt-4 border border-border shadow-soft">
        <div className="flex justify-center mb-2 text-charcoal opacity-80">
          <Brain weight="duotone" className="w-12 h-12" />
        </div>
        <h2 className="mt-3 text-center font-kid text-lg font-bold text-charcoal">{q.q}</h2>
        <div className="mt-5 space-y-2">
          {q.options.map((o, i) => (
            <button
              key={i}
              disabled={busy}
              onClick={() => setPicked(i)}
              className={`w-full rounded-2xl border-2 px-4 py-3 text-left font-kid font-semibold transition ${
                picked === i
                  ? "border-sky bg-sky/10 text-charcoal"
                  : "border-border bg-card text-charcoal"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
        <button
          onClick={submit}
          disabled={!isPicked || busy}
          className="btn-press mt-5 w-full rounded-[1.25rem] bg-charcoal py-3.5 font-kid font-bold text-white disabled:opacity-40 shadow-soft"
        >
          {busy ? "…" : "Submit"}
        </button>
      </Card>

      {/* Quest rewards info */}
      <SectionTitle>Quest rewards</SectionTitle>
      <div className="grid grid-cols-4 gap-2">
        {[
          {
            pts: 100,
            label: "1 correct",
            icon: <CheckCircle weight="duotone" className="w-6 h-6 text-emerald-halal" />,
          },
          {
            pts: 200,
            label: "2 correct",
            icon: <TrendUp weight="duotone" className="w-6 h-6 text-coral" />,
          },
          {
            pts: 500,
            label: "4 correct",
            icon: <Star weight="duotone" className="w-6 h-6 text-sunny" />,
          },
          {
            pts: 1000,
            label: "All 5",
            icon: <Trophy weight="duotone" className="w-6 h-6 text-gold-nur" />,
          },
        ].map((tier) => (
          <div
            key={tier.pts}
            className={`rounded-2xl p-3 text-center shadow-soft border ${
              state.correct >=
              (tier.pts === 100 ? 1 : tier.pts === 200 ? 2 : tier.pts === 500 ? 4 : 5)
                ? "border-emerald-halal bg-emerald-halal/10"
                : "border-border bg-card"
            }`}
          >
            <div className="flex justify-center">{tier.icon}</div>
            <div className="font-mono text-sm font-bold text-charcoal mt-1.5">{tier.pts}</div>
            <div className="font-kid text-[9px] text-pewter">pts</div>
          </div>
        ))}
      </div>
      <p className="mt-3 font-body text-[11px] text-center text-pewter flex items-center justify-center gap-1">
        Redeem in <span className="font-bold text-bubblegum">Rewards</span> store{" "}
        <Gift weight="fill" className="w-3.5 h-3.5 text-bubblegum" />
      </p>

      <QuizHistory attempts={data?.attempts ?? []} />
    </AppShell>
  );
}

/* ── Points balance header pill ── */
function PointsHeader({ totalPoints }: { totalPoints: number }) {
  return (
    <div className="flex items-center justify-between rounded-[2rem] bg-gradient-to-r from-sunny/40 to-bubblegum/30 px-5 py-3 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-sunny/20">
      <div className="font-kid text-xs font-bold text-charcoal uppercase tracking-wider">
        Your Points
      </div>
      <div className="font-mono text-xl font-extrabold text-charcoal flex items-center gap-1.5">
        {totalPoints.toLocaleString()}{" "}
        <Star weight="fill" className="w-5 h-5 text-gold-nur drop-shadow-md" />
      </div>
    </div>
  );
}

/* ── Quiz history ── */
function QuizHistory({
  attempts,
}: {
  attempts: { id: string; correct: boolean; question_text: string; created_at: string }[];
}) {
  if (attempts.length === 0) return null;
  return (
    <>
      <SectionTitle>Quiz history</SectionTitle>
      <Card>
        <ul className="space-y-1.5 max-h-72 overflow-y-auto">
          {attempts.slice(0, 30).map((a) => (
            <li
              key={a.id}
              className="flex items-start gap-2 text-[11px] py-1 border-b border-border/50 last:border-0"
            >
              <span className={`mt-0.5 ${a.correct ? "text-emerald-halal" : "text-coral"}`}>
                {a.correct ? (
                  <Check weight="bold" className="w-3 h-3" />
                ) : (
                  <XIcon weight="bold" className="w-3 h-3" />
                )}
              </span>
              <span className="font-body text-charcoal flex-1 truncate">{a.question_text}</span>
              <span className="font-body text-pewter">
                {new Date(a.created_at).toLocaleDateString()}
              </span>
              {a.correct && (
                <span className="font-mono text-emerald-halal font-bold">+{PTS_PER_CORRECT}</span>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

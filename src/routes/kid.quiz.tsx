import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, Card, SectionTitle } from "@/components/AppShell";
import { useKidData } from "@/hooks/use-kid-data";
import { edgeKidQuizState, edgeKidQuizAnswer } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { ALL_QUESTIONS } from "@/data/quiz-bank";
import { toast } from "sonner";

export const Route = createFileRoute("/kid/quiz")({
  head: () => ({ meta: [{ title: "Daily Quest — Centsibility" }] }),
  component: KidQuiz,
});

const MAX = 5;
const MAX_WRONG = 2;

/* Points awarded per correct answer */
const PTS_PER_CORRECT = 100;

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
        <Card className="wireframe-card">Loading…</Card>
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
      if (isCorrect) toast.success(`[✓] +${PTS_PER_CORRECT} pts`);
      else toast.error("[✗] Not quite");
      if (res.cycled) toast.info("New round! Try again.");
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
        <PointsHeader totalPoints={totalPoints} />

        <Card className="wireframe-card" style={{ textAlign: "center", marginTop: "1rem" }}>
          <div>[icon: trophy]</div>
          <h2>Mashallah!</h2>
          <p>
            5 correct today · <strong>{MAX * PTS_PER_CORRECT}</strong> pts earned
          </p>
          <p><small>Come back tomorrow for a fresh quest.</small></p>
        </Card>

        {/* Points breakdown */}
        <Card className="wireframe-card" style={{ marginTop: "1rem" }}>
          <p><strong>[icon: gift] Quest Rewards</strong></p>
          <div className="wireframe-grid-4" style={{ textAlign: "center", margin: "0.5rem 0" }}>
            {[100, 200, 500, 1000].map((pts) => (
              <div key={pts} className="wireframe-box">
                <strong>{pts}</strong>
                <div><small>pts</small></div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center" }}>
            <small>Use your points in the Reward store [icon: star]</small>
          </p>
        </Card>

        <QuizHistory attempts={data?.attempts ?? []} />
      </AppShell>
    );
  }

  const isPicked = picked !== null;

  return (
    <AppShell mode="kid">
      <PointsHeader totalPoints={totalPoints} />

      <div className="wireframe-space-between" style={{ marginTop: "1rem" }}>
        <h1>[icon: quest] Daily Quest</h1>
        <span>{state.correct} / {MAX}</span>
      </div>

      {/* Progress */}
      <div style={{ margin: "0.5rem 0" }}>
        <progress value={state.correct} max={MAX} style={{ width: "100%" }} />
      </div>
      <p style={{ textAlign: "center" }}>
        <small>Lives: {MAX_WRONG - state.wrong} / {MAX_WRONG} · 2 wrong = round resets</small>
      </p>

      {/* Points per question teaser */}
      <div style={{ textAlign: "center", margin: "0.5rem 0" }}>
        <small>+{PTS_PER_CORRECT} pts per correct answer [icon: star]</small>
      </div>

      {/* Question card */}
      <Card className="wireframe-card">
        <div style={{ textAlign: "center" }}>[icon: brain]</div>
        <h2 style={{ textAlign: "center", margin: "0.5rem 0" }}>{q.q}</h2>
        <div className="wireframe-col" style={{ margin: "1rem 0" }}>
          {q.options.map((o, i) => (
            <button
              key={i}
              type="button"
              disabled={busy}
              onClick={() => setPicked(i)}
              style={{
                border: picked === i ? "2px solid #000" : "1px solid #ccc",
                textAlign: "left",
                fontWeight: picked === i ? "bold" : "normal",
              }}
            >
              {o}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!isPicked || busy}
          style={{ width: "100%" }}
        >
          {busy ? "…" : "Submit"}
        </button>
      </Card>

      {/* Quest rewards info */}
      <SectionTitle>Quest rewards</SectionTitle>
      <div className="wireframe-grid-4">
        {[
          { pts: 100, label: "1 correct", iconLabel: "[icon: check]" },
          { pts: 200, label: "2 correct", iconLabel: "[icon: trend]" },
          { pts: 500, label: "4 correct", iconLabel: "[icon: star]" },
          { pts: 1000, label: "All 5", iconLabel: "[icon: trophy]" },
        ].map((tier) => (
          <div
            key={tier.pts}
            className="wireframe-box"
            style={{
              textAlign: "center",
              border: state.correct >= (tier.pts === 100 ? 1 : tier.pts === 200 ? 2 : tier.pts === 500 ? 4 : 5) ? "2px solid #000" : "1px solid #ccc",
            }}
          >
            <div>{tier.iconLabel}</div>
            <strong>{tier.pts}</strong>
            <div><small>pts</small></div>
          </div>
        ))}
      </div>

      <QuizHistory attempts={data?.attempts ?? []} />
    </AppShell>
  );
}

/* ── Points balance header pill ── */
function PointsHeader({ totalPoints }: { totalPoints: number }) {
  return (
    <div className="wireframe-space-between wireframe-box">
      <small><strong>Your Points</strong></small>
      <div>
        <strong>{totalPoints.toLocaleString()} [icon: star]</strong>
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
      <Card className="wireframe-card">
        <ul style={{ maxHeight: "250px", overflowY: "auto" }}>
          {attempts.slice(0, 30).map((a) => (
            <li
              key={a.id}
              className="wireframe-space-between"
              style={{ padding: "0.25rem 0", borderBottom: "1px solid #eee" }}
            >
              <span>{a.correct ? "[✓]" : "[✗]"} {a.question_text}</span>
              <span>
                <small>{new Date(a.created_at).toLocaleDateString()}</small>{" "}
                {a.correct && <strong>+{PTS_PER_CORRECT}</strong>}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

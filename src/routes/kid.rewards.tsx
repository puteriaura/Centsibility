import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/section-title";
import { useKidData } from "@/hooks/use-kid-data";
import { edgeKidRequestReward } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";
import { Skeleton } from "@/components/ui/skeleton";
import { NumericKeypad } from "@/components/ui/numeric-keypad";

export const Route = createFileRoute("/kid/rewards")({
  head: () => ({ meta: [{ title: "Rewards — Centsibility" }] }),
  component: KidRewards,
});

/* ── Suggested rewards ── */
const SUGGESTED = [
  { name: "Pick the family movie", cost: 2100, iconLabel: "[icon: movie]" },
  { name: "Special treat", cost: 3000, iconLabel: "[icon: treat]" },
  { name: "Stay up 30 min late", cost: 6000, iconLabel: "[icon: moon]" },
  { name: "Toy of my choice", cost: 4500, iconLabel: "[icon: game]" },
  { name: "Day at the park", cost: 2400, iconLabel: "[icon: park]" },
  { name: "New book of my choice", cost: 3000, iconLabel: "[icon: book]" },
  { name: "Cook favourite meal", cost: 2250, iconLabel: "[icon: meal]" },
  { name: "Fun outing with parent", cost: 3000, iconLabel: "[icon: outing]" },
];

function KidRewards() {
  const { data, loading, refresh } = useKidData();
  const [name, setName] = useState("");
  const [rawPts, setRawPts] = useState("");

  if (loading || !data) {
    return (
      <div className="wireframe-col">
        <Skeleton style={{ height: "6rem" }} />
        <Skeleton style={{ height: "10rem" }} />
        <Skeleton style={{ height: "10rem" }} />
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
    <>
      <h1>[icon: gift] Rewards</h1>
      <p>Spend your points on real-life treats. Parent must approve!</p>

      {/* Points balance */}
      <Card className="wireframe-card" style={{ marginTop: "1rem" }}>
        <small>Your Points</small>
        <div style={{ fontSize: "2rem", fontWeight: "bold" }}>
          {totalPoints.toFixed(0)} [icon: star]
        </div>
        <small>Earn more from Daily Quests</small>
      </Card>

      <SectionTitle>Quick picks</SectionTitle>
      {!quizUnlocked && (
        <div className="wireframe-box">
          <strong>Complete {QUIZ_GATE} quiz answers to unlock</strong>
          <div><small>{quizTotalCorrect}/{QUIZ_GATE} correct answers so far</small></div>
        </div>
      )}
      <div className="wireframe-grid-2">
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
              className="wireframe-card"
              style={{ textAlign: "left" }}
            >
              <div>{!quizUnlocked ? "[Locked]" : s.iconLabel}</div>
              <strong>{s.name}</strong>
              <div><small>{s.cost} [icon: star]</small></div>
            </button>
          );
        })}
      </div>

      <SectionTitle>Custom reward</SectionTitle>
      <Card className="wireframe-card">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What do you want? e.g. New book"
          maxLength={100}
        />
        <p><small>You have {totalPoints.toFixed(0)} [icon: star]</small></p>

        {/* Points keypad */}
        <div className="wireframe-box" style={{ textAlign: "center", margin: "0.5rem 0" }}>
          <div style={{ fontSize: "2rem", fontWeight: "bold" }}>
            {parsedPts} [icon: star]
          </div>
          {parsedPts > 0 && (
            <small>of {maxPts} pts available</small>
          )}
        </div>
        <NumericKeypad onKeyPress={pressKey} />
        <button
          type="button"
          onClick={() => submit(name, parsedPts)}
          disabled={!name.trim() || parsedPts < 1 || parsedPts > totalPoints}
          style={{ width: "100%", marginTop: "0.5rem" }}
        >
          Request for {parsedPts} [icon: star]
        </button>
      </Card>

      {pending.length > 0 && (
        <>
          <SectionTitle>Waiting for parent</SectionTitle>
          <div className="wireframe-col">
            {pending.map((r: (typeof pending)[number]) => (
              <Card key={r.id} className="wireframe-box">
                <div className="wireframe-space-between">
                  <strong>{r.name}</strong>
                  <span>{r.cost} [icon: star]</span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionTitle>History</SectionTitle>
      {history.length === 0 ? (
        <Card className="wireframe-box" style={{ textAlign: "center" }}>
          No reward history yet. Request your first reward above!
        </Card>
      ) : (
        <div className="wireframe-col">
          {history.map((r: (typeof history)[number]) => (
            <div key={r.id} className="wireframe-space-between wireframe-box">
              <div>
                <strong>{r.name}</strong>
                <div>
                  <small>{new Date(r.created_at).toLocaleDateString()} · {r.cost} [icon: star]</small>
                </div>
              </div>
              <div>
                <strong>{r.status === "approved" ? "[✓ Granted]" : "[✗ Declined]"}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

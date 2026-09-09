import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Card, SectionTitle } from "@/components/AppShell";
import { useKidData } from "@/hooks/use-kid-data";
import { edgeKidRequestReward } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Gift,
  Star,
  FilmStrip,
  Storefront,
  Moon,
  GameController,
  Tent,
  BookOpen,
  HandHeart,
  Ticket,
  CheckCircle,
  XCircle,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/kid/rewards")({
  head: () => ({ meta: [{ title: "Rewards — Centsibility" }] }),
  component: KidRewards,
});

/* ── Suggested rewards (no screen time) ── */
const SUGGESTED = [
  {
    name: "Pick the family movie",
    cost: 2100,
    icon: <FilmStrip weight="duotone" className="w-8 h-8 text-bubblegum" />,
  },
  {
    name: "Special treat",
    cost: 3000,
    icon: <Storefront weight="duotone" className="w-8 h-8 text-sky" />,
  },
  {
    name: "Stay up 30 min late",
    cost: 6000,
    icon: <Moon weight="duotone" className="w-8 h-8 text-starlight" />,
  },
  {
    name: "Toy of my choice",
    cost: 4500,
    icon: <GameController weight="duotone" className="w-8 h-8 text-sunny" />,
  },
  {
    name: "Day at the park",
    cost: 2400,
    icon: <Tent weight="duotone" className="w-8 h-8 text-emerald-halal" />,
  },
  {
    name: "New book of my choice",
    cost: 3000,
    icon: <BookOpen weight="duotone" className="w-8 h-8 text-starlight" />,
  },
  {
    name: "Cook favourite meal",
    cost: 2250,
    icon: <HandHeart weight="duotone" className="w-8 h-8 text-coral" />,
  },
  {
    name: "Fun outing with parent",
    cost: 3000,
    icon: <Ticket weight="duotone" className="w-8 h-8 text-gold-nur" />,
  },
];

function KidRewards() {
  const { data, loading, refresh } = useKidData();
  const [name, setName] = useState("");
  const [rawPts, setRawPts] = useState("");

  if (loading || !data) {
    return (
      <AppShell mode="kid">
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
        </div>
      </AppShell>
    );
  }

  const k = data.kid;
  const code = getKidSession()?.code;
  const totalPoints = Number(k.coins);
  const maxPts = Math.max(1, Math.floor(totalPoints));
  const parsedPts = Math.min(parseInt(rawPts || "0", 10), maxPts);

  // Quick picks require at least 3 correct quiz answers (lifetime)
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
  const Keys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["00", "0", "⌫"],
  ];

  return (
    <AppShell mode="kid">
      <h1 className="font-display text-2xl text-starlight flex items-center gap-2">
        <Gift weight="duotone" className="w-8 h-8 text-bubblegum" /> Rewards
      </h1>
      <p className="font-body text-sm text-starlight/70">
        Spend your points on real-life treats. Parent must approve!
      </p>

      {/* Points balance */}
      <Card className="mt-4 bg-gradient-to-br from-sunny to-bubblegum text-void shadow-soft border border-white/20">
        <div className="font-kid text-xs font-bold uppercase opacity-80">Your Points</div>
        <div className="mt-1 font-mono text-4xl font-bold flex items-center gap-1.5">
          {totalPoints.toFixed(0)} <Star weight="fill" className="w-7 h-7 text-void" />
        </div>
        <div className="mt-1 font-body text-xs opacity-80">Earn more from Daily Quests</div>
      </Card>

      <SectionTitle>Quick picks</SectionTitle>
      {!quizUnlocked && (
        <div className="rounded-2xl bg-sunny/10 border border-sunny/30 px-4 py-3 mb-3 flex items-center gap-3">
          <span className="text-2xl">🔒</span>
          <div>
            <div className="font-kid font-bold text-sm text-starlight">
              Complete {QUIZ_GATE} quiz answers to unlock
            </div>
            <div className="font-body text-xs text-starlight/60 mt-0.5">
              {quizTotalCorrect}/{QUIZ_GATE} correct answers so far
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {SUGGESTED.map((s) => {
          const can = quizUnlocked && totalPoints >= s.cost;
          return (
            <button
              key={s.name}
              onClick={() => can && submit(s.name, s.cost)}
              disabled={!can}
              aria-label={
                !quizUnlocked
                  ? `Locked — complete ${QUIZ_GATE} quiz answers first`
                  : `Request ${s.name} for ${s.cost} points`
              }
              className={`btn-press rounded-[1.5rem] p-4 text-left shadow-soft transition ${can ? "bg-card hover:border-bubblegum" : "bg-cream opacity-50 cursor-not-allowed"} border border-border flex flex-col items-start`}
            >
              <div className="mb-2" aria-hidden="true">
                {!quizUnlocked ? <span className="text-2xl">🔒</span> : s.icon}
              </div>
              <div className="mt-1 font-kid font-bold text-sm text-starlight leading-tight flex-1">
                {s.name}
              </div>
              <div className="mt-2 font-mono text-sm font-bold text-bubblegum flex items-center gap-1">
                {s.cost} <Star weight="fill" className="w-3.5 h-3.5" />
              </div>
            </button>
          );
        })}
      </div>

      <SectionTitle>Custom reward</SectionTitle>
      <Card className="glass-panel bg-void/50 border-starlight/20">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What do you want? e.g. New book"
          className="w-full rounded-2xl border border-white/10 bg-void/50 px-4 py-3 font-body text-sm text-starlight"
          maxLength={100}
        />
        <p className="mt-2 font-body text-[11px] text-starlight/70 mb-3 flex items-center gap-1">
          You have{" "}
          <span className="font-mono font-bold text-starlight flex items-center gap-0.5">
            {totalPoints.toFixed(0)} <Star weight="fill" className="w-3.5 h-3.5 text-gold-nur" />
          </span>
        </p>

        {/* Points keypad */}
        <div className="flex flex-col items-center rounded-3xl bg-gradient-to-b from-sunny/20 to-void/50 border border-white/10 px-6 py-4 shadow-inner mb-3">
          <div className="font-mono text-4xl font-extrabold text-starlight flex items-center gap-1.5">
            {parsedPts} <Star weight="fill" className="w-7 h-7 text-gold-nur drop-shadow-sm" />
          </div>
          {parsedPts > 0 && (
            <p className="mt-1 font-body text-[11px] text-starlight/70">
              of {maxPts} pts available
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {Keys.flat().map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => pressKey(key)}
              aria-label={key === "⌫" ? "Delete" : `Key ${key}`}
              className={`rounded-2xl py-4 font-mono text-xl font-bold transition active:scale-90 ${
                key === "⌫"
                  ? "bg-white/10 text-coral text-2xl border border-white/10"
                  : "glass-panel text-starlight shadow-soft hover:bg-white/10 border border-white/10"
              }`}
            >
              {key}
            </button>
          ))}
        </div>
        <button
          onClick={() => submit(name, parsedPts)}
          disabled={!name.trim() || parsedPts < 1 || parsedPts > totalPoints}
          className="btn-press mt-4 w-full rounded-[1.25rem] bg-bubblegum py-3.5 font-kid font-bold text-white disabled:opacity-40 shadow-soft flex items-center justify-center gap-1.5"
        >
          Request for {parsedPts} <Star weight="fill" className="w-4 h-4" />
        </button>
      </Card>

      {pending.length > 0 && (
        <>
          <SectionTitle>Waiting for parent</SectionTitle>
          <div className="space-y-2">
            {pending.map((r: (typeof pending)[number]) => (
              <Card key={r.id} className="bg-sunny/20 border border-sunny/30">
                <div className="flex items-center justify-between">
                  <div className="font-kid font-bold text-sm text-starlight">{r.name}</div>
                  <div className="font-mono font-bold text-starlight flex items-center gap-1">
                    {r.cost} <Star weight="fill" className="w-4 h-4 text-gold-nur" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionTitle>History</SectionTitle>
      {history.length === 0 ? (
        <Card className="text-center py-8 shadow-sm glass-panel bg-void/50 border-starlight/20">
          <div className="flex justify-center mb-3 text-starlight/50 opacity-50">
            <Gift weight="duotone" className="w-12 h-12" />
          </div>
          <p className="font-body text-sm text-starlight/70">
            No reward history yet. Request your first reward above!
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {history.map((r: (typeof history)[number]) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-2xl glass-panel bg-void/50 border-starlight/20 p-3 shadow-soft"
            >
              <div>
                <div className="font-kid font-bold text-sm text-starlight">{r.name}</div>
                <div className="font-body text-[11px] text-starlight/70 flex items-center gap-1 mt-0.5">
                  {new Date(r.created_at).toLocaleDateString()} · {r.cost}{" "}
                  <Star weight="fill" className="w-3 h-3 text-gold-nur" />
                </div>
              </div>
              <div
                className={`font-kid text-xs font-bold flex items-center gap-1 ${r.status === "approved" ? "text-emerald-halal" : "text-coral"}`}
              >
                {r.status === "approved" ? (
                  <>
                    <CheckCircle weight="bold" className="w-4 h-4" /> Granted
                  </>
                ) : (
                  <>
                    <XCircle weight="bold" className="w-4 h-4" /> Declined
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

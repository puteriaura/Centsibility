import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Card } from "@/components/AppShell";
import { useKidData } from "@/hooks/use-kid-data";
import { edgeKidSadaqah } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { MoneyKeypad } from "@/components/MoneyKeypad";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Mosque, Baby, Drop, CheckCircle } from "@phosphor-icons/react";

export const Route = createFileRoute("/kid/sadaqah")({
  head: () => ({ meta: [{ title: "Sadaqah — Centsibility" }] }),
  component: KidSadaqah,
});

function KidSadaqah() {
  const { data, loading, refresh } = useKidData();
  const [given, setGiven] = useState(false);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const [sadaqahTotal, setSadaqahTotal] = useState(0);

  // Query all SADAQAH transactions for the current year (not capped at 100)
  useEffect(() => {
    if (!data) return;
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
    supabase
      .from("transactions")
      .select("amount")
      .eq("kid_id", data.kid.id)
      .eq("type", "SADAQAH")
      .gte("created_at", yearStart)
      .then(({ data: txs }) => {
        const sum = (txs ?? []).reduce((s, t) => s + Number(t.amount), 0);
        setSadaqahTotal(sum);
      });
  }, [data]);

  const causes = [
    {
      name: "Masjid",
      icon: <Mosque weight="duotone" className="w-8 h-8 text-gold-nur mx-auto" />,
      impact: "1 day of electricity",
    },
    {
      name: "Orphans",
      icon: <Baby weight="duotone" className="w-8 h-8 text-bubblegum mx-auto" />,
      impact: "1 nutritious meal",
    },
    {
      name: "Water Wells",
      icon: <Drop weight="duotone" className="w-8 h-8 text-sky mx-auto" />,
      impact: "Clean water for a family",
    },
  ];

  if (loading || !data)
    return (
      <AppShell mode="kid">
        <Card>Loading…</Card>
      </AppShell>
    );
  const balance = Number(data.kid.balance);

  const give = async (amount: number) => {
    if (amount > balance) return;
    const code = getKidSession()?.code;
    if (!code) return;
    try {
      await edgeKidSadaqah({ code, amount });
      setGiven(true);
      setPendingAmount(null);
      setTimeout(() => setGiven(false), 2500);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  return (
    <AppShell mode="kid">
      <h1 className="font-display text-2xl text-charcoal flex items-center gap-2">
        <Heart weight="duotone" className="w-8 h-8 text-emerald-halal" />
        Sadaqah
      </h1>
      <p className="font-arabic text-base text-emerald-halal mt-1">
        الصَّدَقَةُ تُطْفِئُ الخَطِيئَةَ
      </p>
      <p className="font-body text-sm italic text-slate-parent">
        "Sadaqah extinguishes sin." — Hadith
      </p>

      <Card className="mt-5 bg-gradient-halal text-[color:var(--warm-white)]">
        <div className="font-body text-xs uppercase opacity-80">Your Sadaqah this year</div>
        <div className="mt-1 font-mono text-3xl font-bold">RM {sadaqahTotal.toFixed(2)}</div>
        <div className="mt-2 font-kid text-xs">
          Mashallah, you've helped {Math.floor(sadaqahTotal / 5)} families!
        </div>
      </Card>

      <Card className="mt-4 border border-border shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
        <p className="font-body text-xs text-pewter mb-3">
          Balance:{" "}
          <span className="font-mono font-bold text-charcoal">RM {balance.toFixed(2)}</span>
        </p>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {causes.map((c) => (
            <div
              key={c.name}
              className="rounded-[1.25rem] bg-cream p-3 text-center shadow-sm border border-border"
            >
              <div className="mb-2">{c.icon}</div>
              <div className="font-kid text-xs font-bold text-charcoal">{c.name}</div>
              <div className="font-body text-[10px] text-pewter mt-1 leading-tight">{c.impact}</div>
            </div>
          ))}
        </div>

        <MoneyKeypad
          min={0.5}
          max={balance}
          confirmLabel="Give Sadaqah"
          confirmBg="bg-emerald-halal"
          onConfirm={(amt) => setPendingAmount(amt)}
        />

        {given && (
          <div className="mt-3 rounded-[1.25rem] bg-mint/40 p-4 text-center font-kid text-sm font-bold text-charcoal flex items-center justify-center gap-2 border border-mint/50">
            <CheckCircle weight="fill" className="w-5 h-5 text-emerald-halal" /> Jazakallah khair!
            Your kindness was recorded.
          </div>
        )}
      </Card>

      {/* Confirmation dialog */}
      {pendingAmount !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[2.5rem] bg-card p-8 shadow-xl text-center border border-white/10">
            <div className="flex justify-center mb-4 text-emerald-halal opacity-90">
              <Heart weight="duotone" className="w-12 h-12" />
            </div>
            <h3 className="font-parent text-xl font-bold text-charcoal">Give Sadaqah?</h3>
            <p className="mt-3 font-body text-sm text-slate-parent">
              Are you sure you want to donate{" "}
              <span className="font-mono font-bold text-emerald-halal">
                RM {pendingAmount.toFixed(2)}
              </span>{" "}
              as Sadaqah?
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setPendingAmount(null)}
                className="btn-press flex-1 rounded-[1.25rem] bg-cream py-3.5 font-kid font-bold text-charcoal shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => give(pendingAmount)}
                className="btn-press flex-1 rounded-[1.25rem] bg-emerald-halal py-3.5 font-kid font-bold text-white shadow-soft flex items-center justify-center gap-1.5"
              >
                Yes, Give <Heart weight="fill" className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

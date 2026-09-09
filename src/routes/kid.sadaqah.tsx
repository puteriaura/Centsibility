import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useKidData } from "@/hooks/use-kid-data";
import { edgeKidSadaqah } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { MoneyKeypad } from "@/components/MoneyKeypad";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/kid/sadaqah")({
  head: () => ({ meta: [{ title: "Sadaqah — Centsibility" }] }),
  component: KidSadaqah,
});

function KidSadaqah() {
  const { data, loading, refresh } = useKidData();
  const [given, setGiven] = useState(false);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const [sadaqahTotal, setSadaqahTotal] = useState(0);

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
    { name: "Masjid", iconLabel: "[icon: mosque]", impact: "1 day of electricity" },
    { name: "Orphans", iconLabel: "[icon: baby]", impact: "1 nutritious meal" },
    { name: "Water Wells", iconLabel: "[icon: water]", impact: "Clean water for a family" },
  ];

  if (loading || !data)
    return (
      <Card className="wireframe-card">Loading…</Card>
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
    <>
      <h1>[icon: heart] Sadaqah</h1>
      <p>الصَّدَقَةُ تُطْفِئُ الخَطِيئَةَ</p>
      <p><small>"Sadaqah extinguishes sin." — Hadith</small></p>

      <Card className="wireframe-card" style={{ marginTop: "1rem" }}>
        <small>Your Sadaqah this year</small>
        <div style={{ fontSize: "2rem", fontWeight: "bold" }}>RM {sadaqahTotal.toFixed(2)}</div>
        <small>Mashallah, you've helped {Math.floor(sadaqahTotal / 5)} families!</small>
      </Card>

      <Card className="wireframe-card" style={{ marginTop: "1rem" }}>
        <p><small>Balance: RM {balance.toFixed(2)}</small></p>

        <div className="wireframe-grid-3" style={{ margin: "0.5rem 0" }}>
          {causes.map((c) => (
            <div key={c.name} className="wireframe-box" style={{ textAlign: "center" }}>
              <div>{c.iconLabel}</div>
              <strong>{c.name}</strong>
              <div><small>{c.impact}</small></div>
            </div>
          ))}
        </div>

        <MoneyKeypad
          min={0.5}
          max={balance}
          confirmLabel="Give Sadaqah"
          onConfirm={(amt) => setPendingAmount(amt)}
        />

        {given && (
          <div className="wireframe-box" style={{ marginTop: "0.5rem", textAlign: "center" }}>
            [✓] Jazakallah khair! Your kindness was recorded.
          </div>
        )}
      </Card>

      {/* Confirmation dialog */}
      {pendingAmount !== null && (
        <div className="wireframe-box" style={{ marginTop: "1rem", border: "2px solid #000" }}>
          <div style={{ textAlign: "center" }}>[icon: heart]</div>
          <h3>Give Sadaqah?</h3>
          <p>
            Are you sure you want to donate <strong>RM {pendingAmount.toFixed(2)}</strong> as Sadaqah?
          </p>
          <div className="wireframe-row">
            <button type="button" onClick={() => setPendingAmount(null)}>
              Cancel
            </button>
            <button type="button" onClick={() => give(pendingAmount)}>
              Confirm & Donate
            </button>
          </div>
        </div>
      )}
    </>
  );
}

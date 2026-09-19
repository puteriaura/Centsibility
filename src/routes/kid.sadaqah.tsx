import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useKidData } from "@/hooks/use-kid-data";
import { edgeKidSadaqah } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { MoneyKeypad } from "@/components/MoneyKeypad";
import { AppIcon } from "@/components/ui/app-icon";
import { Skeleton } from "@/components/ui/skeleton";
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
    { name: "Local Masjid", icon: "mosque", impact: "Helps community electricity & care" },
    { name: "Orphan Relief", icon: "baby", impact: "Provides wholesome hot meals" },
    { name: "Clean Water Wells", icon: "water", impact: "Brings fresh clean water to families" },
  ];

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton style={{ height: "4rem", borderRadius: "16px" }} />
        <Skeleton style={{ height: "10rem", borderRadius: "20px" }} />
        <Skeleton style={{ height: "12rem", borderRadius: "20px" }} />
      </div>
    );
  }

  const balance = Number(data.kid.balance);

  const give = async (amount: number) => {
    if (amount > balance) return;
    const code = getKidSession()?.code;
    if (!code) return;
    try {
      await edgeKidSadaqah({ code, amount });
      setGiven(true);
      setPendingAmount(null);
      setTimeout(() => setGiven(false), 3000);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <section className="deposit-hero" aria-label="Sadaqah contributions this year">
        <div className="deposit-hero__copy">
          <p className="deposit-hero__label">Given this year</p>
          <p className="deposit-hero__amount tabular-nums">RM{sadaqahTotal.toFixed(2)}</p>
          <p className="deposit-hero__link" style={{ cursor: "default", textDecoration: "none" }}>
            Wallet RM{balance.toFixed(2)} · Give anytime
          </p>
        </div>
        <div className="deposit-hero__mascot" aria-hidden="true">
          <AppIcon name="sadaqah" size={32} color="#fff" />
        </div>
      </section>

      <div className="p-3 rounded-xl bg-[var(--surface-pink)] border border-[var(--primary-soft)] text-center">
        <p className="text-sm font-bold text-[var(--primary)] mb-0.5">
          الصَّدَقَةُ تُطْفِئُ الخَطِيئَةَ
        </p>
        <p className="text-xs text-[var(--text-secondary)] m-0">
          &ldquo;Charity extinguishes sins just as water extinguishes fire.&rdquo; — Hadith
        </p>
      </div>

      <div className="aeon-banner aeon-banner--purple">
        <div className="max-w-[70%]">
          <h2 className="text-sm sm:text-base font-extrabold text-[var(--ink)] leading-snug m-0">
            Give sadaqah and earn stardust — start with RM1
          </h2>
          <p className="text-xs text-[var(--ink)]/80 mt-1 mb-0">
            Your kindness reaches local masjids, orphans, and clean water projects.
          </p>
        </div>
        <div className="w-14 h-14 rounded-full bg-[var(--ink)]/10 flex items-center justify-center text-[var(--ink)] shrink-0">
          <AppIcon name="heart" size={28} />
        </div>
      </div>

      {/* Donation Form Card */}
      <Card variant="default" className="p-5 sm:p-6 space-y-4 border border-[var(--border)]">
        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] pb-2 border-b border-[var(--border)]">
          <span>Available Wallet Balance</span>
          <strong className="text-sm text-[var(--ink)] tabular-nums">RM {balance.toFixed(2)}</strong>
        </div>

        {/* Causes Grid — Common Region / Similarity */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="list" aria-label="Sadaqah causes">
          {causes.map((c) => (
            <div
              key={c.name}
              role="listitem"
              className="p-3 rounded-xl bg-[var(--surface-soft)] border border-[var(--border)] text-center space-y-1"
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--surface-pink)] text-[var(--primary)] flex items-center justify-center mx-auto">
                <AppIcon name={c.icon} size={16} />
              </div>
              <strong className="text-xs font-bold text-[var(--ink)] block">{c.name}</strong>
              <small className="text-[10px] text-[var(--text-muted)] block leading-tight">{c.impact}</small>
            </div>
          ))}
        </div>

        <MoneyKeypad
          min={0.5}
          max={balance}
          confirmLabel="Donate Sadaqah"
          onConfirm={(amt) => setPendingAmount(amt)}
        />

        {given && (
          <div
            className="p-4 rounded-xl bg-[var(--success-soft)] text-[var(--success)] text-xs font-bold flex items-center gap-2 border border-[var(--success)]/20"
            role="status"
          >
            <AppIcon name="approve" size={18} />
            <span>Jazakallah khair! May Allah bless your kindness and generosity.</span>
          </div>
        )}
      </Card>

      {/* Confirmation Modal */}
      <Modal
        isOpen={pendingAmount !== null}
        onClose={() => setPendingAmount(null)}
        title="Confirm Sadaqah Donation"
        description="Share blessings from your digital savings with those in need."
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setPendingAmount(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (pendingAmount !== null) give(pendingAmount);
              }}
            >
              Confirm & Donate RM {pendingAmount?.toFixed(2)}
            </Button>
          </div>
        }
      >
        <div className="text-center py-4 space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[var(--surface-pink)] text-[var(--primary)] flex items-center justify-center mx-auto shadow-xs">
            <AppIcon name="heart" size={28} />
          </div>
          <p className="text-sm text-[var(--ink)]">
            Are you sure you want to give{" "}
            <strong className="text-base text-[var(--primary)] font-extrabold tabular-nums">
              RM {pendingAmount?.toFixed(2)}
            </strong>{" "}
            as Sadaqah?
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            This amount will be deducted from your active wallet balance.
          </p>
        </div>
      </Modal>
    </div>
  );
}
